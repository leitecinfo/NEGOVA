import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSpoilageRecord,
  getSpoilageRecords,
  getSpoilageKPIs,
  updateSpoilageRecord,
  cancelSpoilageRecord,
} from "../../src/lib/spoilage/spoilage-service";
import { CreateSpoilageInput, SpoilageCause, SpoilageItemType } from "../../src/lib/spoilage/types";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA
// ==============================================================================

const TEST_BUSINESS_ID = "biz-1111-2222-3333-444444444444";
const OTHER_BUSINESS_ID = "biz-9999-8888-7777-666666666666";

const TEST_LOCATION_ID = "loc-def-1111-2222-3333-444444444444";
const TEST_PRODUCT_ID = "prod-aaaa-bbbb-cccc-dddddddddddd";

let inMemorySpoilageRecords: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryMovements: any[] = [];
let inMemoryProducts: any[] = [];

// Mock de inventory-service
vi.mock("@/lib/inventory/inventory-service", () => ({
  ensureDefaultLocation: vi.fn(async (bizId: string) => ({
    id: `loc-def-${bizId}`,
    name: "Punto de Venta Principal",
    type: "point_of_sale",
  })),
  getInventoryStock: vi.fn(async (bizId: string, filters: { productId?: string; locationId?: string }) => {
    return inMemoryStock.filter((s) => {
      if (s.business_id !== bizId) return false;
      if (filters.productId && s.product_id !== filters.productId) return false;
      if (filters.locationId && s.location_id !== filters.locationId) return false;
      return true;
    }).map((s) => ({
      id: s.id,
      businessId: s.business_id,
      productId: s.product_id,
      locationId: s.location_id,
      quantity: s.quantity,
      minStock: s.min_stock,
      cost: s.cost,
      updatedAt: s.updated_at,
    }));
  }),
  upsertInventoryStock: vi.fn(async (bizId: string, input: any) => {
    const existingIdx = inMemoryStock.findIndex(
      (s) => s.business_id === bizId && s.product_id === input.productId && s.location_id === input.locationId
    );
    if (existingIdx !== -1) {
      inMemoryStock[existingIdx] = {
        ...inMemoryStock[existingIdx],
        quantity: input.quantity,
        cost: input.cost ?? inMemoryStock[existingIdx].cost,
        updated_at: new Date().toISOString(),
      };
      return inMemoryStock[existingIdx];
    } else {
      const newItem = {
        id: `stock-${Date.now()}`,
        business_id: bizId,
        product_id: input.productId,
        location_id: input.locationId,
        quantity: input.quantity,
        min_stock: input.minStock || 0,
        cost: input.cost || 0,
        updated_at: new Date().toISOString(),
      };
      inMemoryStock.push(newItem);
      return newItem;
    }
  }),
  recordInventoryMovement: vi.fn(async (bizId: string, input: any, createdBy?: string | null) => {
    const mov = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      business_id: bizId,
      product_id: input.productId,
      location_id: input.locationId,
      movement_type: input.movementType,
      quantity: input.quantity,
      unit_cost: input.unitCost,
      total_cost: input.totalCost,
      reference_id: input.referenceId,
      reference_type: input.referenceType,
      notes: input.notes,
      created_by: createdBy || null,
      created_at: new Date().toISOString(),
    };
    inMemoryMovements.push(mov);
    return mov;
  }),
}));

// Mock de Supabase Client & Server
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

const mockSupabaseClient = {
  from: (table: string) => {
    if (table === "spoilage_records") {
      return {
        insert: (data: any) => ({
          select: (cols: string = "*") => ({
            single: async () => {
              const inserted = {
                ...data,
                id: data.id || `spoilage-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                locations: { name: "Punto de Venta Principal" },
              };
              inMemorySpoilageRecords.push(inserted);
              return { data: inserted, error: null };
            },
          }),
        }),
        update: (data: any) => {
          let targetId: string | null = null;
          const updChain: any = {
            eq: (col: string, val: any) => {
              if (col === "id") targetId = val;
              inMemorySpoilageRecords = inMemorySpoilageRecords.map((r) => {
                if (r[col] === val) {
                  return { ...r, ...data };
                }
                return r;
              });
              return updChain;
            },
            select: () => ({
              single: async () => {
                const updated = inMemorySpoilageRecords.find((r) => r.id === targetId);
                return { data: updated || null, error: null };
              },
            }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ error: null }).then(resolve, reject),
          };
          return updChain;
        },
        select: (cols: string = "*") => {
          let list = [...inMemorySpoilageRecords];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            gte: (col: string, val: any) => {
              list = list.filter((r) => r[col] >= val);
              return chain;
            },
            lte: (col: string, val: any) => {
              list = list.filter((r) => r[col] <= val);
              return chain;
            },
            or: (clause: string) => {
              const match = clause.match(/item_name\.ilike\.%([^%]+)%/);
              if (match) {
                const term = match[1].toLowerCase();
                list = list.filter(
                  (r) =>
                    (r.item_name && r.item_name.toLowerCase().includes(term)) ||
                    (r.notes && r.notes.toLowerCase().includes(term))
                );
              }
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
            single: async () => ({
              data: list[0] || null,
              error: null,
            }),
            maybeSingle: async () => ({
              data: list[0] || null,
              error: null,
            }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
      };
    }

    if (table === "products") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryProducts];
          const prodChain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((p: any) => p[col] === val);
              return prodChain;
            },
            single: async () => {
              return { data: list[0] || null, error: null };
            },
            maybeSingle: async () => {
              return { data: list[0] || null, error: null };
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return prodChain;
        },
        update: (data: any) => {
          const updChain: any = {
            eq: (col: string, val: any) => {
              inMemoryProducts = inMemoryProducts.map((p) => {
                if (p[col] === val) {
                  return {
                    ...p,
                    ...data,
                    metadata: {
                      ...(p.metadata || {}),
                      ...(data.metadata || {}),
                    },
                  };
                }
                return p;
              });
              return updChain;
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ error: null }).then(resolve, reject),
          };
          return updChain;
        },
      };
    }

    if (table === "inventory_movements") {
      return {
        insert: (data: any) => {
          inMemoryMovements.push(data);
          return Promise.resolve({ data, error: null });
        },
        update: (data: any) => {
          const updChain: any = {
            eq: (col: string, val: any) => {
              inMemoryMovements = inMemoryMovements.map((m) => {
                if (m[col] === val) {
                  return { ...m, ...data };
                }
                return m;
              });
              return updChain;
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ error: null }).then(resolve, reject),
          };
          return updChain;
        },
      };
    }

    if (table === "users") {
      return {
        select: (cols: string = "*") => ({
          in: (col: string, vals: any[]) => ({
            then: (resolve: any, reject?: any) =>
              Promise.resolve({
                data: vals.map((id) => ({
                  id,
                  name: `Usuario ${id.substring(0, 4)}`,
                  full_name: `Nombre Usuario ${id.substring(0, 4)}`,
                  email: `user_${id.substring(0, 4)}@negova.com`,
                })),
                error: null,
              }).then(resolve, reject),
          }),
        }),
      };
    }

    return {};
  },
};

describe("[CAT-007] Spoilage Service (Mermas de Productos e Ingredientes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inMemorySpoilageRecords = [];
    inMemoryMovements = [];
    inMemoryStock = [
      {
        id: "stock-1",
        business_id: TEST_BUSINESS_ID,
        product_id: TEST_PRODUCT_ID,
        location_id: `loc-def-${TEST_BUSINESS_ID}`,
        quantity: 50,
        min_stock: 5,
        cost: 2.5,
        updated_at: new Date().toISOString(),
      },
      {
        id: "stock-ing",
        business_id: TEST_BUSINESS_ID,
        product_id: "11111111-2222-3333-4444-555555555555",
        location_id: `loc-def-${TEST_BUSINESS_ID}`,
        quantity: 10,
        min_stock: 2,
        cost: 4000,
        updated_at: new Date().toISOString(),
      },
    ];
    inMemoryProducts = [
      {
        id: TEST_PRODUCT_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Limonada Natural",
        price: 5.0,
        metadata: {
          stock_quantity: 50,
          cost: 2.5,
          track_stock: true,
        },
      },
      {
        id: "11111111-2222-3333-4444-555555555555",
        business_id: TEST_BUSINESS_ID,
        name: "Tomates Frescos (Kilos)",
        price: 0,
        metadata: {
          product_type: "ingredient",
          stock_quantity: 10,
          cost: 4000,
          track_stock: true,
        },
      },
    ];
  });

  // ----------------------------------------------------------------------------
  // 1. Registro de Merma de Producto y Descuento Automático
  // ----------------------------------------------------------------------------
  it("debe registrar una merma de producto, descontar stock de inventory_stock y de metadata", async () => {
    const input: CreateSpoilageInput = {
      itemType: "product",
      itemId: TEST_PRODUCT_ID,
      itemName: "Limonada Natural",
      cause: "expired",
      quantity: 5,
      unitCost: 2.5,
      notes: "Botellas vencidas lote 2026-A",
    };

    const record = await createSpoilageRecord(TEST_BUSINESS_ID, input, "user-tester-1");

    expect(record).toBeDefined();
    expect(record.itemType).toBe("product");
    expect(record.itemName).toBe("Limonada Natural");
    expect(record.cause).toBe("expired");
    expect(record.quantity).toBe(5);
    expect(record.unitCost).toBe(2.5);
    expect(record.totalCost).toBe(12.5); // 5 * 2.5
    expect(record.locationName).toBe("Punto de Venta Principal");

    // Verificar descuento en inventory_stock: 50 - 5 = 45
    const updatedStock = inMemoryStock.find(
      (s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID
    );
    expect(updatedStock?.quantity).toBe(45);

    // Verificar descuento en products.metadata: 50 - 5 = 45
    const updatedProd = inMemoryProducts.find((p) => p.id === TEST_PRODUCT_ID);
    expect(updatedProd?.metadata.stock_quantity).toBe(45);
  });

  // ----------------------------------------------------------------------------
  // 2. Kardex: Generación de Movimiento de Inventario tipo 'spoilage'
  // ----------------------------------------------------------------------------
  it("debe crear un movimiento de inventario con tipo 'spoilage' y referencia a la merma", async () => {
    const input: CreateSpoilageInput = {
      itemType: "product",
      itemId: TEST_PRODUCT_ID,
      itemName: "Limonada Natural",
      cause: "damaged",
      quantity: 2,
      unitCost: 2.5,
      notes: "Envases rotos durante descarga",
    };

    const record = await createSpoilageRecord(TEST_BUSINESS_ID, input, "user-tester-2");

    expect(inMemoryMovements.length).toBe(1);
    const mov = inMemoryMovements[0];
    expect(mov.movement_type).toBe("spoilage");
    expect(mov.quantity).toBe(2);
    expect(mov.total_cost).toBe(5.0);
    expect(mov.reference_id).toBe(record.id);
    expect(mov.reference_type).toBe("adjustment");
    expect(mov.notes).toContain("Merma");
    expect(mov.created_by).toBe("user-tester-2");
  });

  // ----------------------------------------------------------------------------
  // 3. Merma de Ingrediente (Soporte sin FK a producto)
  // ----------------------------------------------------------------------------
  it("debe registrar una merma de ingrediente con causa, costo y notas", async () => {
    const fakeIngredientId = "11111111-2222-3333-4444-555555555555";
    const input: CreateSpoilageInput = {
      itemType: "ingredient",
      itemId: fakeIngredientId,
      itemName: "Tomates Frescos (Kilos)",
      cause: "spilled",
      quantity: 3.5,
      unitCost: 4000,
      notes: "Caja caída en bodega",
    };

    const record = await createSpoilageRecord(TEST_BUSINESS_ID, input, "user-tester-1");

    expect(record.itemType).toBe("ingredient");
    expect(record.itemName).toBe("Tomates Frescos (Kilos)");
    expect(record.cause).toBe("spilled");
    expect(record.quantity).toBe(3.5);
    expect(record.totalCost).toBe(14000); // 3.5 * 4000
    // No debe descontar producto inexistente
    expect(inMemoryStock[0].quantity).toBe(50);
  });

  // ----------------------------------------------------------------------------
  // 4. Validación de Entradas con Zod
  // ----------------------------------------------------------------------------
  it("debe rechazar cantidades menores o iguales a 0 o causas inválidas", async () => {
    // Cantidad <= 0
    await expect(
      createSpoilageRecord(TEST_BUSINESS_ID, {
        itemType: "product",
        itemId: TEST_PRODUCT_ID,
        itemName: "Limonada Natural",
        cause: "expired",
        quantity: 0,
        unitCost: 10,
      })
    ).rejects.toThrow();

    // Costo negativo
    await expect(
      createSpoilageRecord(TEST_BUSINESS_ID, {
        itemType: "product",
        itemId: TEST_PRODUCT_ID,
        itemName: "Limonada Natural",
        cause: "expired",
        quantity: 2,
        unitCost: -5,
      })
    ).rejects.toThrow();

    // Causa inexistente
    await expect(
      createSpoilageRecord(TEST_BUSINESS_ID, {
        itemType: "product",
        itemId: TEST_PRODUCT_ID,
        itemName: "Limonada Natural",
        cause: "invalid_cause" as any,
        quantity: 2,
        unitCost: 10,
      })
    ).rejects.toThrow();
  });

  // ----------------------------------------------------------------------------
  // 5. Cálculo de KPIs de Mermas
  // ----------------------------------------------------------------------------
  it("debe calcular correctamente los KPIs de pérdidas totales, incidentes y unidades", async () => {
    // Insertar mermas para TEST_BUSINESS_ID
    inMemorySpoilageRecords = [
      {
        id: "sp-1",
        business_id: TEST_BUSINESS_ID,
        item_type: "product",
        item_id: TEST_PRODUCT_ID,
        item_name: "Limonada",
        cause: "expired",
        quantity: 4,
        unit_cost: 2.5,
        total_cost: 10.0,
        date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      {
        id: "sp-2",
        business_id: TEST_BUSINESS_ID,
        item_type: "ingredient",
        item_id: "ing-1",
        item_name: "Queso Mozzarella",
        cause: "damaged",
        quantity: 2,
        unit_cost: 15.0,
        total_cost: 30.0,
        date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      // Registro de OTRO negocio que NO debe contaminar los KPIs
      {
        id: "sp-other",
        business_id: OTHER_BUSINESS_ID,
        item_type: "product",
        item_id: "other-prod",
        item_name: "Hamburguesa",
        cause: "stolen",
        quantity: 10,
        unit_cost: 20.0,
        total_cost: 200.0,
        date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ];

    const kpis = await getSpoilageKPIs(TEST_BUSINESS_ID);

    expect(kpis.totalRecords).toBe(2);
    expect(kpis.totalCost).toBe(40.0); // 10 + 30
    expect(kpis.totalQuantity).toBe(6); // 4 + 2
    expect(kpis.recentRecordsCount).toBe(2);
  });

  // ----------------------------------------------------------------------------
  // 6. Filtros de Búsqueda y Aislamiento Multi-Tenant
  // ----------------------------------------------------------------------------
  it("debe filtrar mermas por causa, tipo de ítem y aislar por negocio", async () => {
    inMemorySpoilageRecords = [
      {
        id: "sp-1",
        business_id: TEST_BUSINESS_ID,
        item_type: "product",
        cause: "expired",
        item_name: "Cerveza Corona",
        quantity: 6,
        unit_cost: 5,
        total_cost: 30,
        date: "2026-10-15T10:00:00Z",
      },
      {
        id: "sp-2",
        business_id: TEST_BUSINESS_ID,
        item_type: "ingredient",
        cause: "damaged",
        item_name: "Papas Congeladas",
        quantity: 5,
        unit_cost: 8,
        total_cost: 40,
        date: "2026-10-20T10:00:00Z",
      },
      {
        id: "sp-3",
        business_id: OTHER_BUSINESS_ID,
        item_type: "product",
        cause: "expired",
        item_name: "Vino Tinto",
        quantity: 1,
        unit_cost: 50,
        total_cost: 50,
        date: "2026-10-25T10:00:00Z",
      },
    ];

    // Consultar solo tipo 'product' en TEST_BUSINESS_ID
    const productsOnly = await getSpoilageRecords(TEST_BUSINESS_ID, { itemType: "product" });
    expect(productsOnly.length).toBe(1);
    expect(productsOnly[0].itemName).toBe("Cerveza Corona");

    // Consultar solo causa 'damaged'
    const damagedOnly = await getSpoilageRecords(TEST_BUSINESS_ID, { cause: "damaged" });
    expect(damagedOnly.length).toBe(1);
    expect(damagedOnly[0].itemName).toBe("Papas Congeladas");

    // Búsqueda por texto "corona"
    const searchResult = await getSpoilageRecords(TEST_BUSINESS_ID, { search: "Corona" });
    expect(searchResult.length).toBe(1);
    expect(searchResult[0].itemName).toBe("Cerveza Corona");

    // El negocio A nunca ve los registros del negocio B
    const allBizA = await getSpoilageRecords(TEST_BUSINESS_ID);
    expect(allBizA.some((r) => r.itemName === "Vino Tinto")).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // 7. Edición de Mermas (Cálculo de Diferencia Neta y Sincronización)
  // ----------------------------------------------------------------------------
  it("debe editar una merma existente ajustando el stock por la diferencia neta sin doble descuento", async () => {
    // 1. Crear una merma inicial de 5 unidades (Stock inicial = 50 -> queda en 45)
    const initialRecord = await createSpoilageRecord(
      TEST_BUSINESS_ID,
      {
        itemType: "product",
        itemId: TEST_PRODUCT_ID,
        itemName: "Coca-Cola 400ml",
        cause: "expired",
        quantity: 5,
        unitCost: 2.5,
        notes: "Lote caducado",
        idempotencyKey: `idemp-edit-${Date.now()}-${Math.random()}`,
      },
      "user-editor-1"
    );

    const stockAfterCreate = inMemoryStock.find(
      (s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID
    );
    expect(stockAfterCreate?.quantity).toBe(45);

    // 2. Modificar la merma de 5 a 8 unidades (Diferencia neta = +3 a restar de stock)
    const updated = await updateSpoilageRecord(
      TEST_BUSINESS_ID,
      {
        id: initialRecord.id,
        itemType: "product",
        itemId: TEST_PRODUCT_ID,
        itemName: "Coca-Cola 400ml",
        cause: "expired",
        quantity: 8,
        unitCost: 2.5,
        notes: "Lote caducado - conteo revisado",
      },
      "user-editor-1"
    );

    expect(updated.quantity).toBe(8);
    expect(updated.totalCost).toBe(20); // 8 * 2.5

    // Stock resultante: 45 - 3 = 42
    const stockAfterIncrease = inMemoryStock.find(
      (s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID
    );
    expect(stockAfterIncrease?.quantity).toBe(42);

    // 3. Modificar la merma reduciendo de 8 a 3 unidades (Diferencia neta = -5 a devolver al stock)
    const reduced = await updateSpoilageRecord(
      TEST_BUSINESS_ID,
      {
        id: initialRecord.id,
        itemType: "product",
        itemId: TEST_PRODUCT_ID,
        itemName: "Coca-Cola 400ml",
        cause: "damaged",
        quantity: 3,
        unitCost: 2.5,
        notes: "Corrección: solo 3 estaban dañadas",
      },
      "user-editor-1"
    );

    expect(reduced.quantity).toBe(3);
    // Stock resultante: 42 + 5 = 47
    const stockAfterDecrease = inMemoryStock.find(
      (s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID
    );
    expect(stockAfterDecrease?.quantity).toBe(47);
  });

  // ----------------------------------------------------------------------------
  // 8. Anulación de Mermas (Reversión de Stock y Trazabilidad)
  // ----------------------------------------------------------------------------
  it("debe anular una merma revirtiendo las existencias y evitando doble anulación", async () => {
    // 1. Crear merma de 10 unidades (Stock inicial = 50 -> queda en 40)
    const record = await createSpoilageRecord(
      TEST_BUSINESS_ID,
      {
        itemType: "product",
        itemId: TEST_PRODUCT_ID,
        itemName: "Coca-Cola 400ml",
        cause: "damaged",
        quantity: 10,
        unitCost: 2.5,
        notes: "Caja rota",
        idempotencyKey: `idemp-cancel-${Date.now()}-${Math.random()}`,
      },
      "user-admin"
    );

    expect(
      inMemoryStock.find((s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID)?.quantity
    ).toBe(40);

    // 2. Anular la merma por error de digitación
    const cancelled = await cancelSpoilageRecord(
      TEST_BUSINESS_ID,
      {
        id: record.id,
        reason: "Se registró por error en lugar de rotación de lote",
      },
      "user-supervisor"
    );

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledBy).toBe("user-supervisor");
    expect(cancelled.cancellationReason).toContain("error en lugar de rotación");

    // Stock debe regresar a 50
    expect(
      inMemoryStock.find((s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID)?.quantity
    ).toBe(50);

    // Kardex debe tener un movimiento compensatorio de tipo adjustment
    const cancelMovement = inMemoryMovements.find(
      (m) => m.reference_id === record.id && m.movement_type === "adjustment"
    );
    expect(cancelMovement).toBeDefined();
    expect(cancelMovement?.quantity).toBe(10);

    // 3. Intentar anularla por segunda vez debe fallar
    await expect(
      cancelSpoilageRecord(
        TEST_BUSINESS_ID,
        {
          id: record.id,
          reason: "Intento de segunda anulación",
        },
        "user-supervisor"
      )
    ).rejects.toThrow(/ya ha sido anulada/i);

    // Intentar editar una merma anulada debe fallar
    await expect(
      updateSpoilageRecord(
        TEST_BUSINESS_ID,
        {
          id: record.id,
          itemType: "product",
          itemId: TEST_PRODUCT_ID,
          itemName: "Coca-Cola 400ml",
          cause: "damaged",
          quantity: 5,
          unitCost: 2.5,
        },
        "user-supervisor"
      )
    ).rejects.toThrow(/No es posible editar una merma que ya ha sido anulada/i);
  });

  // ----------------------------------------------------------------------------
  // 9. Exclusión de Mermas Anuladas en KPIs Financieros
  // ----------------------------------------------------------------------------
  it("excluye mermas anuladas del cálculo de pérdidas financieras operativas en KPIs", async () => {
    const todayISO = new Date().toISOString();
    inMemorySpoilageRecords = [
      {
        id: "sp-active",
        business_id: TEST_BUSINESS_ID,
        item_type: "product",
        cause: "expired",
        item_name: "Producto Vigente",
        quantity: 2,
        unit_cost: 10,
        total_cost: 20,
        status: "active",
        date: todayISO,
        created_at: todayISO,
      },
      {
        id: "sp-cancelled",
        business_id: TEST_BUSINESS_ID,
        item_type: "product",
        cause: "damaged",
        item_name: "Producto Cancelado",
        quantity: 5,
        unit_cost: 10,
        total_cost: 50,
        status: "cancelled",
        date: todayISO,
        created_at: todayISO,
      },
    ];

    const kpis = await getSpoilageKPIs(TEST_BUSINESS_ID);

    // Total de registros activos: 1
    expect(kpis.totalRecords).toBe(1);
    // Costo total operativo debe ser solo de las vigentes (20), NO 70
    expect(kpis.totalCost).toBe(20);
    // Cantidad total operativa: solo 2
    expect(kpis.totalQuantity).toBe(2);
    // Estadísticas de anuladas separadas
    expect(kpis.cancelledRecordsCount).toBe(1);
    expect(kpis.cancelledCost).toBe(50);
  });
});
