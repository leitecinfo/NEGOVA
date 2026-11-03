import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  calculateWeightedAverageCost,
  createPurchase,
} from "../../src/lib/purchases/purchases-service";
import { CreatePurchaseInput } from "../../src/lib/purchases/types";

// ==============================================================================
// MOCKS Y BASE DE DATOS EN MEMORIA
// ==============================================================================

const TEST_BUSINESS_ID = "b1111111-2222-4333-8444-555555555555";
const INGREDIENT_ID = "a1111111-1111-4111-8111-111111111111"; // Tomate Chonto (Insumo)
const RESALE_PROD_ID = "c2222222-2222-4222-8222-222222222222"; // Cerveza Corona (Reventa)
const BODEGA_LOC_ID = "d3333333-3333-4333-8333-333333333333";  // Bodega de Insumos
const POS_LOC_ID = "e4444444-4444-4444-8444-444444444444";     // Nevera POS Principal
const SUPPLIER_ID = "f5555555-5555-4555-8555-555555555555";    // Distribuidora Central

let inMemoryPurchases: any[] = [];
let inMemoryPurchaseItems: any[] = [];
let inMemoryAccountsPayable: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryProducts: any[] = [];
let inMemoryMovements: any[] = [];
let inMemoryCashMovements: any[] = [];
let inMemoryCashTransactions: any[] = [];
let inMemorySuppliers: any[] = [];
let inMemoryLocations: any[] = [];

let mockActiveCashSession: any = {
  id: "sess-1",
  businessId: TEST_BUSINESS_ID,
  registerId: "reg-1",
  status: "open",
  initialAmount: 100000,
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock("@/lib/cash/cash-service", () => ({
  getActiveCashSession: vi.fn(async () => mockActiveCashSession),
  recordCashMovement: vi.fn(async (_bizId, input, _userId) => {
    inMemoryCashMovements.push(input);
    return {
      id: "mov-1",
      sessionId: input.sessionId,
      amount: input.amount,
      movementType: input.movementType,
    };
  }),
}));

const mockSupabaseClient: any = {
  rpc: vi.fn(async (fnName: string, args: any) => {
    if (fnName === "get_next_purchase_number") {
      const bId = args?.p_business_id;
      const count = inMemoryPurchases.filter((p) => p.business_id === bId).length + 1;
      return { data: `COMP-${String(count).padStart(5, "0")}`, error: null };
    }
    return { data: null, error: new Error("RPC not found") };
  }),

  from: (table: string) => {
    if (table === "suppliers") {
      let filters: Record<string, any> = {};
      const chain = {
        eq: (col: string, val: any) => {
          filters[col] = val;
          return chain;
        },
        maybeSingle: async () => {
          const found = inMemorySuppliers.find((s) =>
            Object.entries(filters).every(([k, v]) => s[k] === v)
          );
          return { data: found || null, error: null };
        },
      };
      return {
        select: () => chain,
      };
    }

    if (table === "purchases") {
      return {
        select: () => ({
          eq: (col: string, val: any) => ({
            order: () => ({
              limit: (n: number) => Promise.resolve({
                data: inMemoryPurchases.filter((p) => p[col] === val).slice(0, n),
                error: null,
              }),
            }),
          }),
        }),
        insert: (payload: any) => {
          const row = {
            id: crypto.randomUUID(),
            ...payload,
            created_at: new Date().toISOString(),
          };
          inMemoryPurchases.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
        update: (payload: any) => ({
          eq: async (col: string, val: any) => {
            const idx = inMemoryPurchases.findIndex((p) => p[col] === val);
            if (idx !== -1) {
              inMemoryPurchases[idx] = { ...inMemoryPurchases[idx], ...payload };
            }
            return { error: null };
          },
        }),
      };
    }

    if (table === "purchase_items") {
      return {
        insert: (payload: any) => {
          const items = Array.isArray(payload) ? payload : [payload];
          const inserted = items.map((it) => {
            const row = { id: crypto.randomUUID(), ...it, created_at: new Date().toISOString() };
            inMemoryPurchaseItems.push(row);
            return row;
          });
          return {
            select: () => Promise.resolve({ data: inserted, error: null }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: inserted, error: null }).then(resolve, reject),
          };
        },
      };
    }

    if (table === "inventory_stock") {
      return {
        select: () => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              eq: (col3: string, val3: any) => ({
                maybeSingle: async () => {
                  const s = inMemoryStock.find(
                    (r) => r[col1] === val1 && r[col2] === val2 && r[col3] === val3
                  );
                  return { data: s || null, error: null };
                },
              }),
            }),
          }),
        }),
        upsert: (payload: any) => {
          const idx = inMemoryStock.findIndex(
            (s) =>
              s.business_id === payload.business_id &&
              s.product_id === payload.product_id &&
              s.location_id === payload.location_id
          );
          if (idx !== -1) {
            inMemoryStock[idx] = { ...inMemoryStock[idx], ...payload };
          } else {
            inMemoryStock.push({ id: crypto.randomUUID(), ...payload });
          }
          return {
            select: () => ({
              single: async () => ({ data: payload, error: null }),
            }),
          };
        },
      };
    }

    if (table === "products") {
      return {
        select: () => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              maybeSingle: async () => {
                const prod = inMemoryProducts.find(
                  (p) => p[col1] === val1 && p[col2] === val2
                );
                return { data: prod || null, error: null };
              },
            }),
          }),
        }),
        update: (payload: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: async (col2: string, val2: any) => {
              const idx = inMemoryProducts.findIndex(
                (p) => p[col1] === val1 && p[col2] === val2
              );
              if (idx !== -1) {
                inMemoryProducts[idx] = {
                  ...inMemoryProducts[idx],
                  ...payload,
                  metadata: {
                    ...(inMemoryProducts[idx].metadata || {}),
                    ...(payload.metadata || {}),
                  },
                };
              }
              return { error: null };
            },
          }),
        }),
      };
    }

    if (table === "locations") {
      return {
        select: () => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              maybeSingle: async () => {
                const loc = inMemoryLocations.find(
                  (l) => l[col1] === val1 && l[col2] === val2
                );
                return { data: loc || null, error: null };
              },
            }),
          }),
        }),
      };
    }

    if (table === "accounts_payable") {
      return {
        insert: (payload: any) => {
          const row = { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() };
          inMemoryAccountsPayable.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
      };
    }

    if (table === "inventory_movements") {
      return {
        insert: (payload: any) => {
          const row = { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() };
          inMemoryMovements.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
      };
    }

    if (table === "cash_registers") {
      return {
        select: () => ({
          eq: (col: string, val: any) => ({
            maybeSingle: async () => {
              return { data: { id: val, name: "Caja Principal POS" }, error: null };
            },
          }),
        }),
      };
    }

    if (table === "cash_transactions") {
      return {
        insert: async (payload: any) => {
          inMemoryCashTransactions.push(payload);
          return { error: null };
        },
      };
    }

    return {};
  },
};

describe("Procesamiento Atómico de Compras y Modal de Confirmación", () => {
  beforeEach(() => {
    inMemoryPurchases = [];
    inMemoryPurchaseItems = [];
    inMemoryAccountsPayable = [];
    inMemoryMovements = [];
    inMemoryCashMovements = [];
    inMemoryCashTransactions = [];

    inMemorySuppliers = [
      {
        id: SUPPLIER_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Distribuidora de Alimentos S.A.S",
        phone: "3101234567",
        payment_terms_days: 30,
        status: "active",
      },
    ];

    inMemoryLocations = [
      { id: BODEGA_LOC_ID, business_id: TEST_BUSINESS_ID, name: "Bodega Almacén", is_default: true, is_active: true },
      { id: POS_LOC_ID, business_id: TEST_BUSINESS_ID, name: "Punto de Venta POS", is_default: false, is_active: true },
    ];

    // Insumo / Ingrediente con Stock = 20 y Costo = $1.000
    inMemoryProducts = [
      {
        id: INGREDIENT_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Tomate Chonto Fresco",
        status: "active",
        metadata: {
          product_type: "ingredient",
          unit: "kg",
          cost: 1000,
          stock_quantity: 20,
        },
      },
      // Producto de Reventa / Bebida con Stock = 10 y Costo = $3.000
      {
        id: RESALE_PROD_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Cerveza Corona 330ml",
        status: "active",
        available_in_pos: true,
        metadata: {
          product_type: "product",
          unit: "unidad",
          cost: 3000,
          stock_quantity: 10,
          available_in_pos: true,
        },
      },
    ];

    inMemoryStock = [
      {
        business_id: TEST_BUSINESS_ID,
        product_id: INGREDIENT_ID,
        location_id: BODEGA_LOC_ID,
        quantity: 20,
        cost: 1000,
        min_stock: 5,
      },
      {
        business_id: TEST_BUSINESS_ID,
        product_id: RESALE_PROD_ID,
        location_id: POS_LOC_ID,
        quantity: 10,
        cost: 3000,
        min_stock: 6,
      },
    ];
  });

  describe("1. Fórmula de Costo Promedio Ponderado (CPP)", () => {
    it("debe aplicar la fórmula ((Stock_actual x Costo_anterior) + (Cant_comprada x Costo_nuevo)) / Nuevo_Stock_Total", () => {
      // Stock previo = 20 @ $1.000 (Valor = $20.000)
      // Compra = 30 @ $1.500 (Valor = $45.000)
      // Total Unidades = 50. Total Valor = $65.000
      // Nuevo Costo = 65.000 / 50 = $1.300
      const nuevoCosto = calculateWeightedAverageCost(20, 1000, 30, 1500);
      expect(nuevoCosto).toBe(1300);
    });

    it("si el stock inicial es 0, el nuevo costo debe ser exactamente el costo de la compra", () => {
      const nuevoCosto = calculateWeightedAverageCost(0, 0, 15, 2400);
      expect(nuevoCosto).toBe(2400);
    });
  });

  describe("2. Procesamiento Atómico de Compras en Supabase", () => {
    it("debe generar código secuencial (COMP-00001) y registrar comprobante", async () => {
      const input: CreatePurchaseInput = {
        supplierId: SUPPLIER_ID,
        invoiceNumber: "FAC-9876",
        paymentType: "cash",
        paymentMethod: "cash",
        items: [
          {
            productId: INGREDIENT_ID,
            itemName: "Tomate Chonto Fresco",
            quantity: 30,
            unitCost: 1500,
            locationId: BODEGA_LOC_ID,
            isInventoryItem: true,
            itemCategory: "ingredient",
          },
        ],
        deductFromCashRegister: false,
      };

      const result = await createPurchase(TEST_BUSINESS_ID, input);

      expect(result.purchaseNumber).toBe("COMP-00001");
      expect(result.total).toBe(45000);
      expect(result.supplierName).toBe("Distribuidora de Alimentos S.A.S");
      expect(inMemoryPurchases.length).toBe(1);
      expect(inMemoryPurchaseItems.length).toBe(1);
    });

    it("si es [Insumo/Ingrediente]: Aumenta existencia en bodega y actualiza el costo promedio ponderado", async () => {
      const input: CreatePurchaseInput = {
        supplierId: SUPPLIER_ID,
        paymentType: "cash",
        paymentMethod: "transfer",
        items: [
          {
            productId: INGREDIENT_ID,
            itemName: "Tomate Chonto Fresco",
            quantity: 30,
            unitCost: 1500,
            locationId: BODEGA_LOC_ID,
            isInventoryItem: true,
            itemCategory: "ingredient",
          },
        ],
        deductFromCashRegister: false,
      };

      const result = await createPurchase(TEST_BUSINESS_ID, input);

      // Existencia en bodega: 20 + 30 = 50
      const stock = inMemoryStock.find(
        (s) => s.product_id === INGREDIENT_ID && s.location_id === BODEGA_LOC_ID
      );
      expect(stock?.quantity).toBe(50);
      // Costo recalculado con CPP = $1.300
      expect(stock?.cost).toBe(1300);

      // Producto en catálogo actualizado
      const prod = inMemoryProducts.find((p) => p.id === INGREDIENT_ID);
      expect(prod?.metadata.cost).toBe(1300);
      expect(prod?.metadata.stock_quantity).toBe(50);

      // Kardex generado tipo 'entry'
      expect(inMemoryMovements.length).toBe(1);
      expect(inMemoryMovements[0].movement_type).toBe("entry");
      expect(inMemoryMovements[0].quantity).toBe(30);

      // Impact summary devuelto
      expect(result.impactSummary?.inventoryImpacts[0].newAverageCost).toBe(1300);
      expect(result.impactSummary?.inventoryImpacts[0].newStock).toBe(50);
      expect(result.impactSummary?.inventoryImpacts[0].itemCategory).toBe("ingredient");
    });

    it("si es [Bebida/Reventa Directa]: Aumenta existencia en catálogo POS y actualiza costo con disponibilidad POS activa", async () => {
      // Stock previo = 10 @ $3.000. Compra = 20 @ $3.600. Total = 30 @ $3.400
      const input: CreatePurchaseInput = {
        supplierId: SUPPLIER_ID,
        paymentType: "cash",
        paymentMethod: "card",
        items: [
          {
            productId: RESALE_PROD_ID,
            itemName: "Cerveza Corona 330ml",
            quantity: 20,
            unitCost: 3600,
            locationId: POS_LOC_ID,
            isInventoryItem: true,
            itemCategory: "resale",
          },
        ],
        deductFromCashRegister: false,
      };

      const result = await createPurchase(TEST_BUSINESS_ID, input);

      const stock = inMemoryStock.find((s) => s.product_id === RESALE_PROD_ID);
      expect(stock?.quantity).toBe(30);
      expect(stock?.cost).toBe(3400);

      const prod = inMemoryProducts.find((p) => p.id === RESALE_PROD_ID);
      expect(prod?.metadata.stock_quantity).toBe(30);
      expect(prod?.metadata.cost).toBe(3400);
      expect(prod?.available_in_pos).toBe(true);
      expect(prod?.metadata.available_in_pos).toBe(true);

      expect(result.impactSummary?.inventoryImpacts[0].itemCategory).toBe("resale");
      expect(result.impactSummary?.inventoryImpacts[0].newStock).toBe(30);
      expect(result.impactSummary?.inventoryImpacts[0].newAverageCost).toBe(3400);
    });

    it("si tiene marcada salida de caja activa: Registra egreso automático vinculado al turno activo para arqueo", async () => {
      const input: CreatePurchaseInput = {
        supplierId: SUPPLIER_ID,
        paymentType: "cash",
        paymentMethod: "cash",
        deductFromCashRegister: true, // Salida de caja marcada
        items: [
          {
            productId: RESALE_PROD_ID,
            itemName: "Cerveza Corona 330ml",
            quantity: 5,
            unitCost: 3000,
            locationId: POS_LOC_ID,
            isInventoryItem: true,
            itemCategory: "resale",
          },
        ],
      };

      const result = await createPurchase(TEST_BUSINESS_ID, input);

      expect(inMemoryCashMovements.length).toBe(1);
      expect(inMemoryCashMovements[0].movementType).toBe("expense");
      expect(inMemoryCashMovements[0].amount).toBe(15000);
      expect(inMemoryCashMovements[0].sessionId).toBe("sess-1");

      // Registrado también en cash_transactions
      expect(inMemoryCashTransactions.length).toBe(1);
      expect(inMemoryCashTransactions[0].session_id).toBe("sess-1");
      expect(inMemoryCashTransactions[0].amount).toBe(15000);

      // Resumen del impacto en caja
      expect(result.impactSummary?.cashImpact.deducted).toBe(true);
      expect(result.impactSummary?.cashImpact.amount).toBe(15000);
      expect(result.impactSummary?.cashImpact.cashRegisterName).toBe("Caja Principal POS");
    });
  });

  describe("3. Modal de Confirmación ('Compra Registrada') - Estructura y Reglas", () => {
    it("el archivo del modal debe existir y no contener alertas nativas (window.alert, confirm, prompt, Alert.alert)", () => {
      const modalPath = path.resolve(
        __dirname,
        "../../src/app/workspace/[businessId]/compras/purchase-confirmation-modal.tsx"
      );
      expect(fs.existsSync(modalPath)).toBe(true);

      const content = fs.readFileSync(modalPath, "utf-8");
      expect(content).not.toMatch(/\bwindow\.alert\b/);
      expect(content).not.toMatch(/\balert\s*\(/);
      expect(content).not.toMatch(/\bwindow\.confirm\b/);
      expect(content).not.toMatch(/\bconfirm\s*\(/);
      expect(content).not.toMatch(/\bwindow\.prompt\b/);
      expect(content).not.toMatch(/\bprompt\s*\(/);
      expect(content).not.toMatch(/\bAlert\.alert\b/);
    });

    it("el modal debe implementar todas las secciones requeridas", () => {
      const modalPath = path.resolve(
        __dirname,
        "../../src/app/workspace/[businessId]/compras/purchase-confirmation-modal.tsx"
      );
      const content = fs.readFileSync(modalPath, "utf-8");

      // Encabezado
      expect(content).toContain("Compra Registrada");
      expect(content).toContain("CheckCircle2");
      expect(content).toContain("purchase.purchaseNumber");
      expect(content).toContain("purchase.supplierName");

      // Tarjetas
      expect(content).toContain("Valor liquidado");
      expect(content).toContain("Forma de pago");
      expect(content).toContain("Saldo por pagar");

      // Sección explicativa 'Qué pasó'
      expect(content).toContain("¿Qué pasó con esta compra?");
      expect(content).toContain("Impacto en Inventario & Kardex");
      expect(content).toContain("Costo Promedio Ponderado");
      expect(content).toContain("Impacto en Caja & Arqueo");

      // Botones
      expect(content).toContain("+ Registrar otra compra");
      expect(content).toContain("Listo");
    });
  });
});
