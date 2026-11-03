import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createLocation,
  getBusinessLocations,
  ensureDefaultLocation,
  getInventoryKPIs,
  getProductStockMatrix,
} from "../../src/lib/inventory/inventory-service";
import { CreateLocationInput } from "../../src/lib/inventory/types";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA
// ==============================================================================

const TEST_BUSINESS_ID = "biz-1111-2222-3333-444444444444";
const OTHER_BUSINESS_ID = "biz-9999-8888-7777-666666666666";

let inMemoryLocations: any[] = [];
let inMemoryProducts: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryMovements: any[] = [];

// Mock de Supabase Client & Server
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

const mockSupabaseClient = {
  from: (table: string) => {
    if (table === "locations") {
      return {
        insert: (data: any) => ({
          select: () => ({
            single: async () => {
              const inserted = {
                ...data,
                id: data.id || `loc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                created_at: new Date().toISOString(),
              };
              inMemoryLocations.push(inserted);
              return { data: inserted, error: null };
            },
          }),
        }),
        select: (cols: string = "*") => {
          let list = [...inMemoryLocations];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: (col: string, opts?: any) => {
              list.sort((a, b) => {
                if (a[col] < b[col]) return opts?.ascending === false ? 1 : -1;
                if (a[col] > b[col]) return opts?.ascending === false ? -1 : 1;
                return 0;
              });
              return chain;
            },
            limit: (n: number) => {
              list = list.slice(0, n);
              return chain;
            },
            maybeSingle: async () => {
              return { data: list[0] || null, error: null };
            },
            single: async () => {
              return { data: list[0] || null, error: null };
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
      };
    }

    if (table === "products") {
      return {
        select: (cols: string = "*", opts?: any) => {
          let list = [...inMemoryProducts];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              list = list.filter((r) => r[col] !== val);
              return chain;
            },
            ilike: (col: string, pattern: string) => {
              const clean = pattern.replace(/%/g, "").toLowerCase();
              list = list.filter((r) => r[col] && r[col].toLowerCase().includes(clean));
              return chain;
            },
            order: (col: string, optsOrder?: any) => {
              list.sort((a, b) => (a[col] > b[col] ? 1 : -1));
              return chain;
            },
            then: (resolve: any, reject?: any) => {
              if (opts?.count === "exact" && opts?.head) {
                return Promise.resolve({ count: list.length, data: null, error: null }).then(
                  resolve,
                  reject
                );
              }
              return Promise.resolve({ data: list, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
      };
    }

    if (table === "inventory_stock") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryStock];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
      };
    }

    if (table === "inventory_movements") {
      return {
        select: (cols: string = "*", opts?: any) => {
          let list = [...inMemoryMovements];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            gte: (col: string, val: any) => {
              list = list.filter((r) => r[col] >= val);
              return chain;
            },
            then: (resolve: any, reject?: any) => {
              if (opts?.count === "exact" && opts?.head) {
                return Promise.resolve({ count: list.length, data: null, error: null }).then(
                  resolve,
                  reject
                );
              }
              return Promise.resolve({ data: list, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
      };
    }

    return {};
  },
};

describe("[INV-002] Inventory UI & Stock by Location Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryLocations = [
      {
        id: "loc-pos-1",
        business_id: TEST_BUSINESS_ID,
        name: "Punto de Venta Barra",
        type: "point_of_sale",
        address: "Barra principal",
        is_visible_in_menu: true,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: "loc-wh-1",
        business_id: TEST_BUSINESS_ID,
        name: "Bodega Fría",
        type: "warehouse",
        address: "Piso 2",
        is_visible_in_menu: false,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];

    inMemoryProducts = [
      {
        id: "prod-1",
        business_id: TEST_BUSINESS_ID,
        name: "Cerveza Artesanal IPA",
        price: 12000,
        category_id: "cat-bebidas",
        status: "active",
        categories: { name: "Bebidas Alcohólicas" },
        metadata: { cost: 5000, sku: "IPA-001", min_stock: 10, track_stock: true },
      },
      {
        id: "prod-2",
        business_id: TEST_BUSINESS_ID,
        name: "Hamburguesa Doble Carne",
        price: 25000,
        category_id: "cat-comidas",
        status: "active",
        categories: { name: "Comidas" },
        metadata: { cost: 11000, sku: "HAM-002", min_stock: 5, track_stock: true },
      },
      // Producto de otro negocio
      {
        id: "prod-other",
        business_id: OTHER_BUSINESS_ID,
        name: "Producto Aislado",
        price: 1000,
        category_id: "cat-other",
        status: "active",
        metadata: { cost: 500, track_stock: true },
      },
    ];

    inMemoryStock = [
      // Cerveza IPA en Barra: 8 un (Stock Bajo porque min_stock = 10)
      {
        id: "stock-1",
        business_id: TEST_BUSINESS_ID,
        product_id: "prod-1",
        location_id: "loc-pos-1",
        quantity: 8,
        min_stock: 10,
        cost: 5000,
      },
      // Cerveza IPA en Bodega Fría: 40 un
      {
        id: "stock-2",
        business_id: TEST_BUSINESS_ID,
        product_id: "prod-1",
        location_id: "loc-wh-1",
        quantity: 40,
        min_stock: 5,
        cost: 5000,
      },
      // Hamburguesa en Barra: 15 un (Stock Normal)
      {
        id: "stock-3",
        business_id: TEST_BUSINESS_ID,
        product_id: "prod-2",
        location_id: "loc-pos-1",
        quantity: 15,
        min_stock: 5,
        cost: 11000,
      },
    ];

    const today = new Date().toISOString();
    inMemoryMovements = [
      {
        id: "mov-1",
        business_id: TEST_BUSINESS_ID,
        created_at: today,
      },
      {
        id: "mov-2",
        business_id: TEST_BUSINESS_ID,
        created_at: today,
      },
    ];
  });

  // ----------------------------------------------------------------------------
  // 1. Creación de Ubicaciones tipo Bodega y Punto de Venta
  // ----------------------------------------------------------------------------
  it("debe permitir crear una ubicación tipo 'Bodega' y otra 'Punto de venta'", async () => {
    const bodegaInput: CreateLocationInput = {
      name: "Depósito Seco",
      type: "warehouse",
      address: "Estante 3B",
      isVisibleInMenu: false,
      isActive: true,
    };

    const bodega = await createLocation(TEST_BUSINESS_ID, bodegaInput);
    expect(bodega).toBeDefined();
    expect(bodega.name).toBe("Depósito Seco");
    expect(bodega.type).toBe("warehouse");
    expect(bodega.isVisibleInMenu).toBe(false);

    const posInput: CreateLocationInput = {
      name: "Punto Express Terraza",
      type: "point_of_sale",
      address: "Terraza exterior",
      isVisibleInMenu: true,
      isActive: true,
    };

    const pos = await createLocation(TEST_BUSINESS_ID, posInput);
    expect(pos).toBeDefined();
    expect(pos.name).toBe("Punto Express Terraza");
    expect(pos.type).toBe("point_of_sale");
    expect(pos.isVisibleInMenu).toBe(true);

    const allLocations = await getBusinessLocations(TEST_BUSINESS_ID);
    expect(allLocations.length).toBe(4); // 2 iniciales + 2 nuevas
  });

  // ----------------------------------------------------------------------------
  // 2. Matriz de Stock por Ubicación (Columnas de ubicaciones)
  // ----------------------------------------------------------------------------
  it("debe desglosar el stock por cada ubicación activa en columnas y calcular total consolidado", async () => {
    const result = await getProductStockMatrix(TEST_BUSINESS_ID);

    expect(result.locations.length).toBe(2);
    expect(result.rows.length).toBe(2);

    // Fila Cerveza IPA
    const ipaRow = result.rows.find((r) => r.productId === "prod-1");
    expect(ipaRow).toBeDefined();
    expect(ipaRow?.productName).toBe("Cerveza Artesanal IPA");
    expect(ipaRow?.categoryName).toBe("Bebidas Alcohólicas");
    expect(ipaRow?.totalStock).toBe(48); // 8 en Barra + 40 en Bodega
    expect(ipaRow?.stockByLocation["loc-pos-1"]?.quantity).toBe(8);
    expect(ipaRow?.stockByLocation["loc-wh-1"]?.quantity).toBe(40);
    // En loc-pos-1 tiene 8 <= min_stock (10) -> isLow = true
    expect(ipaRow?.stockByLocation["loc-pos-1"]?.isLow).toBe(true);
    expect(ipaRow?.isLowStock).toBe(true);

    // Fila Hamburguesa
    const burgerRow = result.rows.find((r) => r.productId === "prod-2");
    expect(burgerRow).toBeDefined();
    expect(burgerRow?.stockByLocation["loc-pos-1"]?.quantity).toBe(15);
    expect(burgerRow?.stockByLocation["loc-wh-1"]?.quantity).toBe(0); // Sin stock en bodega
    expect(burgerRow?.totalStock).toBe(15);
  });

  // ----------------------------------------------------------------------------
  // 3. Filtros de la Matriz (Categoría, Buscador, Stock Bajo)
  // ----------------------------------------------------------------------------
  it("debe filtrar correctamente por búsqueda de texto y por solo productos con stock bajo", async () => {
    // Filtro por búsqueda "ipa"
    const searchResult = await getProductStockMatrix(TEST_BUSINESS_ID, { search: "IPA" });
    expect(searchResult.rows.length).toBe(1);
    expect(searchResult.rows[0].productName).toBe("Cerveza Artesanal IPA");

    // Filtro por solo stock bajo (Cerveza IPA tiene 8 <= 10 en Barra)
    const lowStockResult = await getProductStockMatrix(TEST_BUSINESS_ID, { lowStockOnly: true });
    expect(lowStockResult.rows.length).toBe(1);
    expect(lowStockResult.rows[0].productId).toBe("prod-1");
  });

  // ----------------------------------------------------------------------------
  // 4. Cálculo de KPIs de Inventario
  // ----------------------------------------------------------------------------
  it("debe calcular correctamente los KPIs de total productos, stock bajo, valor al costo y movimientos hoy", async () => {
    const kpis = await getInventoryKPIs(TEST_BUSINESS_ID);

    // Total productos activos del negocio = 2 (excluye al de otro negocio)
    expect(kpis.totalProducts).toBe(2);

    // Stock bajo: solo prod-1 está bajo en al menos una ubicación
    expect(kpis.lowStockCount).toBe(1);

    // Valor al costo total:
    // prod-1 en pos: 8 * 5000 = 40,000
    // prod-1 en wh: 40 * 5000 = 200,000
    // prod-2 en pos: 15 * 11000 = 165,000
    // Total = 40,000 + 200,000 + 165,000 = 405,000
    expect(kpis.totalCostValue).toBe(405000);

    // Movimientos de hoy = 2
    expect(kpis.todayMovementsCount).toBe(2);
  });

  // ----------------------------------------------------------------------------
  // 5. Aislamiento Multi-Tenant por business_id
  // ----------------------------------------------------------------------------
  it("los datos deben estar estrictamente aislados por business_id", async () => {
    const otherLocations = await getBusinessLocations(OTHER_BUSINESS_ID);
    expect(otherLocations.length).toBe(0);

    const otherMatrix = await getProductStockMatrix(OTHER_BUSINESS_ID);
    // No debe contener productos ni ubicaciones del TEST_BUSINESS_ID
    expect(otherMatrix.rows.some((r) => r.productName === "Cerveza Artesanal IPA")).toBe(false);
  });
});

