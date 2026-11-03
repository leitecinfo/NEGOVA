import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  createQuotation,
  getQuotations,
  getQuotationById,
  convertQuotationToSale,
  cancelQuotation,
  getQuotationsKPIs,
} from "@/lib/quotations/quotations-service";
import { calculateCartSummary, PosCartItem } from "@/lib/pos/types";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const BUSINESS_B = "22222222-bbbb-4bbb-bbbb-222222222222";
const USER_A = "user-1111-aaaa";

let inMemoryQuotations: any[] = [];
let inMemorySequences: any[] = [];
let inMemoryInventoryStock: any[] = [];
let inMemoryInventoryMovements: any[] = [];
let inMemoryCashMovements: any[] = [];
let inMemoryCustomers: any[] = [];

const mockSupabase = {
  from: (tableName: string) => {
    if (tableName === "quotations") {
      return {
        select: (_cols: string = "*", options?: any) => {
          let list = [...inMemoryQuotations];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              list = list.filter((r) => r[col] !== val);
              return chain;
            },
            lt: (col: string, val: any) => {
              list = list.filter((r) => new Date(r[col]).getTime() < new Date(val).getTime());
              return chain;
            },
            gte: (col: string, val: any) => {
              list = list.filter((r) => new Date(r[col]).getTime() >= new Date(val).getTime());
              return chain;
            },
            lte: (col: string, val: any) => {
              list = list.filter((r) => new Date(r[col]).getTime() <= new Date(val).getTime());
              return chain;
            },
            ilike: (col: string, pattern: string) => {
              const regex = new RegExp(pattern.replace(/%/g, ".*"), "i");
              list = list.filter((r) => regex.test(String(r[col] || "")));
              return chain;
            },
            or: (condString: string) => {
              // Simular OR ilike
              const matchVal = condString.match(/ilike\.%([^%]+)%/);
              if (matchVal) {
                const searchStr = matchVal[1].toLowerCase();
                list = list.filter(
                  (r) =>
                    (r.quotation_number && r.quotation_number.toLowerCase().includes(searchStr)) ||
                    (r.customer_name && r.customer_name.toLowerCase().includes(searchStr)) ||
                    (r.customer_phone && r.customer_phone.toLowerCase().includes(searchStr))
                );
              }
              return chain;
            },
            order: (col: string, { ascending }: { ascending: boolean } = { ascending: true }) => {
              list.sort((a, b) => {
                if (a[col] < b[col]) return ascending ? -1 : 1;
                if (a[col] > b[col]) return ascending ? 1 : -1;
                return 0;
              });
              return chain;
            },
            range: (from: number, to: number) => {
              list = list.slice(from, to + 1);
              return chain;
            },
            limit: (n: number) => {
              list = list.slice(0, n);
              return chain;
            },
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            then: (resolve: any) =>
              resolve({
                data: list,
                count: options?.count === "exact" ? inMemoryQuotations.length : null,
                error: null,
              }),
          };
          return chain;
        },
        insert: (rowOrRows: any) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
          const inserted = rows.map((r) => ({
            id: r.id || `quote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...r,
          }));
          inMemoryQuotations.push(...inserted);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: inserted[0], error: null }),
            }),
          };
        },
        update: (updates: any) => {
          return {
            eq: (col1: string, val1: any) => ({
              eq: (col2: string, val2: any) => {
                inMemoryQuotations = inMemoryQuotations.map((r) => {
                  if (r[col1] === val1 && r[col2] === val2) {
                    return { ...r, ...updates };
                  }
                  return r;
                });
                return Promise.resolve({ error: null });
              },
            }),
          };
        },
      };
    }

    if (tableName === "quotation_sequences") {
      return {
        select: (_cols: string = "*") => {
          let list = [...inMemorySequences];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
          };
          return chain;
        },
        upsert: (record: any) => {
          const idx = inMemorySequences.findIndex(
            (s) => s.business_id === record.business_id && s.year === record.year
          );
          if (idx >= 0) {
            inMemorySequences[idx] = { ...inMemorySequences[idx], ...record };
          } else {
            inMemorySequences.push({ ...record });
          }
          return Promise.resolve({ error: null });
        },
      };
    }

    if (tableName === "customers") {
      return {
        select: (_cols: string = "*") => {
          let list = [...inMemoryCustomers];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
          };
          return chain;
        },
      };
    }

    if (tableName === "inventory_stock") {
      return {
        select: () => Promise.resolve({ data: inMemoryInventoryStock, error: null }),
      };
    }

    if (tableName === "inventory_movements") {
      return {
        select: () => Promise.resolve({ data: inMemoryInventoryMovements, error: null }),
        insert: (item: any) => {
          inMemoryInventoryMovements.push(item);
          return Promise.resolve({ error: null });
        },
      };
    }

    if (tableName === "cash_movements") {
      return {
        select: () => Promise.resolve({ data: inMemoryCashMovements, error: null }),
        insert: (item: any) => {
          inMemoryCashMovements.push(item);
          return Promise.resolve({ error: null });
        },
      };
    }

    return {
      select: () => Promise.resolve({ data: [], error: null }),
    };
  },
  rpc: (rpcName: string, args: any) => {
    if (rpcName === "get_next_quotation_number") {
      const { p_business_id, p_year } = args;
      const idx = inMemorySequences.findIndex(
        (s) => s.business_id === p_business_id && s.year === p_year
      );
      let nextNum = 1;
      if (idx >= 0) {
        nextNum = inMemorySequences[idx].current_number + 1;
        inMemorySequences[idx].current_number = nextNum;
      } else {
        inMemorySequences.push({
          business_id: p_business_id,
          year: p_year,
          current_number: 1,
        });
      }
      return Promise.resolve({
        data: `COT-${p_year}-${String(nextNum).padStart(4, "0")}`,
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  },
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

// ==============================================================================
// PRODUCTOS MODELO PARA CARRITO
// ==============================================================================

const SAMPLE_ITEMS: PosCartItem[] = [
  {
    id: "prod-1-base",
    productId: "prod-1",
    productName: "Hamburguesa Artesanal Clásica",
    basePrice: 25000,
    quantity: 2,
    selectedModifiers: [
      {
        groupId: "mod-cheese",
        groupName: "Queso",
        optionId: "opt-cheddar",
        optionName: "Queso Cheddar Extra",
        price: 3000,
      },
    ],
    modifiersPrice: 3000,
    unitPrice: 28000,
    lineTotal: 56000,
    taxPercentage: 19,
    taxIncludedInPrice: true,
    taxAmount: 8941,
    netSubtotal: 47059,
  },
  {
    id: "prod-2-base",
    productId: "prod-2",
    productName: "Limonada Natural",
    basePrice: 8000,
    quantity: 2,
    selectedModifiers: [],
    modifiersPrice: 0,
    unitPrice: 8000,
    lineTotal: 16000,
    taxPercentage: 0,
    taxIncludedInPrice: true,
    taxAmount: 0,
    netSubtotal: 16000,
  },
];

// ==============================================================================
// PRUEBAS DE ACEPTACIÓN — [POS-004] COTIZACIONES
// ==============================================================================

describe("[POS-004] Cotizaciones en POS", () => {
  beforeEach(() => {
    inMemoryQuotations = [];
    inMemorySequences = [];
    inMemoryInventoryStock = [{ product_id: "prod-1", quantity: 50 }];
    inMemoryInventoryMovements = [];
    inMemoryCashMovements = [];
    inMemoryCustomers = [
      {
        id: "cust-1",
        business_id: BUSINESS_A,
        name: "Restaurante El Roble",
        phone: "3101234567",
        email: "roble@comercial.com",
      },
    ];
  });

  it("1. Debe crear una cotización con numeración propia (COT-YYYY-XXXX) y vigencia configurable", async () => {
    const quotation = await createQuotation(
      BUSINESS_A,
      {
        customerName: "Empresa Aliada SAS",
        customerPhone: "3009876543",
        items: SAMPLE_ITEMS,
        validDays: 15, // Vencimiento configurable a 15 días
        notes: "Precios sujetos a confirmación de volumen",
      },
      USER_A
    );

    const currentYear = new Date().getFullYear();
    expect(quotation).toBeDefined();
    expect(quotation.quotationNumber).toBe(`COT-${currentYear}-0001`);
    expect(quotation.total).toBe(72000); // 56.000 + 16.000
    expect(quotation.status).toBe("pending");
    expect(quotation.customerName).toBe("Empresa Aliada SAS");

    // Verificar vigencia (15 días en el futuro)
    const validUntil = new Date(quotation.validUntil);
    const now = new Date();
    const diffDays = Math.round(
      (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBeGreaterThanOrEqual(14);
    expect(diffDays).toBeLessThanOrEqual(16);
    expect(quotation.isExpired).toBe(false);
  });

  it("2. INVARIANTE CRÍTICO: La creación de cotización NO debe afectar existencias de stock ni efectivo de caja", async () => {
    const initialMovementsCount = inMemoryInventoryMovements.length;
    const initialCashMovementsCount = inMemoryCashMovements.length;

    await createQuotation(
      BUSINESS_A,
      {
        customerId: "cust-1",
        items: SAMPLE_ITEMS,
        validDays: 7,
      },
      USER_A
    );

    // Stock inalterado
    expect(inMemoryInventoryMovements.length).toBe(initialMovementsCount);
    expect(inMemoryInventoryStock[0].quantity).toBe(50); // No descontó las 2 hamburguesas

    // Caja inalterada
    expect(inMemoryCashMovements.length).toBe(initialCashMovementsCount);
  });

  it("3. Debe listar cotizaciones y calcular dinámicamente el estado 'expired' según la fecha de vigencia", async () => {
    // Cotización 1: Vigente
    await createQuotation(
      BUSINESS_A,
      {
        customerName: "Cliente Vigente",
        items: SAMPLE_ITEMS,
        validDays: 7,
      },
      USER_A
    );

    // Cotización 2: Vencida en el pasado
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    inMemoryQuotations.push({
      id: "quote-expired-01",
      business_id: BUSINESS_A,
      quotation_number: `COT-${pastDate.getFullYear()}-0002`,
      customer_name: "Cliente Vencido",
      items: SAMPLE_ITEMS,
      subtotal: 72000,
      discount_total: 0,
      tax_total: 8941,
      total: 72000,
      valid_until: pastDate.toISOString(),
      status: "pending",
      created_at: pastDate.toISOString(),
    });

    const result = await getQuotations({
      businessId: BUSINESS_A,
      status: "all",
    });

    expect(result.quotations.length).toBe(2);
    const expiredQuote = result.quotations.find((q) => q.customerName === "Cliente Vencido");
    expect(expiredQuote).toBeDefined();
    expect(expiredQuote?.isExpired).toBe(true);
    expect(expiredQuote?.status).toBe("expired");

    const validQuote = result.quotations.find((q) => q.customerName === "Cliente Vigente");
    expect(validQuote).toBeDefined();
    expect(validQuote?.isExpired).toBe(false);
    expect(validQuote?.status).toBe("pending");
  });

  it("4. Debe permitir convertir la cotización a venta: restaura ítems al carrito con exactitud y marca status 'converted'", async () => {
    const quotation = await createQuotation(
      BUSINESS_A,
      {
        customerName: "Cliente para Conversión",
        items: SAMPLE_ITEMS,
        validDays: 30,
      },
      USER_A
    );

    // 1. Obtener cotización para cargar en carrito
    const quoteToLoad = await getQuotationById(BUSINESS_A, quotation.id);
    expect(quoteToLoad).toBeDefined();
    expect(quoteToLoad?.items.length).toBe(2);

    // 2. Simular carga en el carrito del POS y recálculo del resumen
    const restoredCartItems: PosCartItem[] = quoteToLoad!.items;
    const cartSummary = calculateCartSummary(restoredCartItems);
    expect(cartSummary.total).toBe(quotation.total);
    expect(cartSummary.itemsCount).toBe(4); // 2 hamburguesas + 2 limonadas

    // 3. Simular conclusión de la venta en POS
    const generatedOrderId = "order-pos-777";
    const convertResult = await convertQuotationToSale(
      BUSINESS_A,
      quotation.id,
      generatedOrderId
    );
    expect(convertResult.success).toBe(true);

    // 4. Verificar que la cotización queda marcada como 'converted'
    const updatedQuote = await getQuotationById(BUSINESS_A, quotation.id);
    expect(updatedQuote?.status).toBe("converted");
    expect(updatedQuote?.convertedOrderId).toBe(generatedOrderId);
    expect(updatedQuote?.convertedAt).toBeDefined();
  });

  it("5. Debe aislar estrictamente las cotizaciones entre distintos comercios (multi-tenant)", async () => {
    // Crear cotización para negocio A
    await createQuotation(
      BUSINESS_A,
      {
        customerName: "Cliente de Negocio A",
        items: SAMPLE_ITEMS,
        validDays: 5,
      },
      USER_A
    );

    // Negocio B consulta cotizaciones
    const resB = await getQuotations({
      businessId: BUSINESS_B,
      status: "all",
    });

    expect(resB.quotations.length).toBe(0);
  });

  it("6. CUMPLIMIENTO DE REGLA GLOBAL: Cero uso de alertas nativas (window.alert/confirm/prompt/Alert.alert)", () => {
    const filesToCheck = [
      "src/components/pos/create-quotation-modal.tsx",
      "src/components/pos/quotations-list-modal.tsx",
      "src/app/workspace/[businessId]/ventas/workspace-quotations-tab.tsx",
      "src/app/workspace/[businessId]/ventas/quotation-actions.ts",
      "src/lib/quotations/quotations-service.ts",
    ];

    const forbiddenPatterns = [
      /window\.alert\(/,
      /window\.confirm\(/,
      /window\.prompt\(/,
      /Alert\.alert\(/,
    ];

    for (const file of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        for (const pattern of forbiddenPatterns) {
          expect(
            pattern.test(content),
            `El archivo ${file} contiene una llamada a alerta nativa prohibida (${pattern})`
          ).toBe(false);
        }
      }
    }
  });
});
