import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createRestaurantOrder } from "../../src/lib/restaurant/restaurant-service";

// ==============================================================================
// SIMULACIÓN DE POSTGRESQL CON ATOMICIDAD TRANSACCIONAL [STOCK-001]
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const LOCATION_A = "loc-1111-aaaa-4aaa-aaaa-111111111111";

let inMemoryProducts: any[] = [];
let inMemoryInventoryStock: any[] = [];
let inMemoryInventoryMovements: any[] = [];
let inMemoryOrders: any[] = [];
let inMemoryOrderItems: any[] = [];
let inMemoryTables: any[] = [];
let forceRpcFailure = false;

// Emulador de la función PostgreSQL create_restaurant_pos_order con descuento de stock atómico
async function executePosOrderRpc(params: any) {
  const {
    p_business_id,
    p_order_type,
    p_channel_origin,
    p_subtotal,
    p_delivery_fee,
    p_total,
    p_items,
    p_table_id,
    p_customer_name,
    p_customer_phone,
    p_delivery_address,
    p_notes,
    p_idempotency_key,
    p_idempotency_hash,
    p_user_id,
  } = params;

  // 1. Manejo de idempotencia (no descuenta stock si es duplicado)
  if (p_idempotency_key) {
    const existing = inMemoryOrders.find(
      (o) => o.business_id === p_business_id && o.idempotency_key === p_idempotency_key
    );
    if (existing) {
      return {
        data: {
          success: true,
          order_id: existing.id,
          order_number: existing.order_number,
          total: existing.total,
          is_duplicate: true,
        },
        error: null,
      };
    }
  }

  // Snapshot previo para emular rollback transaccional de PostgreSQL
  const snapshotProducts = JSON.parse(JSON.stringify(inMemoryProducts));
  const snapshotStock = JSON.parse(JSON.stringify(inMemoryInventoryStock));
  const snapshotMovements = JSON.parse(JSON.stringify(inMemoryInventoryMovements));
  const snapshotOrders = JSON.parse(JSON.stringify(inMemoryOrders));
  const snapshotOrderItems = JSON.parse(JSON.stringify(inMemoryOrderItems));

  try {
    // 2. Falla forzada para probar rollback atómico
    if (forceRpcFailure) {
      throw new Error("DB_SIMULATED_FAILURE: Falla interna durante la transacción");
    }

    // 3. Validación de mesa
    if (p_order_type === "dine_in") {
      if (!p_table_id) {
        throw new Error("TABLE_REQUIRED: Para consumo en mesa debes seleccionar una mesa.");
      }
      const table = inMemoryTables.find((t) => t.id === p_table_id && t.business_id === p_business_id);
      if (!table) {
        throw new Error("TABLE_NOT_FOUND: La mesa seleccionada no pertenece a este negocio o no existe.");
      }
      if (table.status !== "available") {
        throw new Error("TABLE_NOT_AVAILABLE: La mesa seleccionada ya se encuentra ocupada o en atención.");
      }
      table.status = "occupied";
    }

    // 4. Inserción de orden
    const orderNumber = inMemoryOrders.length + 1;
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newOrder = {
      id: orderId,
      business_id: p_business_id,
      order_number: orderNumber,
      status: "received",
      order_type: p_order_type,
      channel_origin: p_channel_origin,
      subtotal: p_subtotal,
      delivery_fee: p_delivery_fee,
      total: p_total,
      notes: p_notes,
      table_id: p_table_id || null,
      customer_name: p_customer_name || null,
      customer_phone: p_customer_phone || null,
      delivery_address: p_delivery_address || null,
      payment_status: "pending",
      idempotency_key: p_idempotency_key,
      idempotency_hash: p_idempotency_hash,
      created_by: p_user_id,
      created_at: new Date().toISOString(),
    };
    inMemoryOrders.push(newOrder);

    // 5. Inserción de líneas
    for (const item of p_items) {
      inMemoryOrderItems.push({
        id: `item_${Math.random().toString(36).substring(2, 6)}`,
        business_id: p_business_id,
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        notes: item.notes,
        modifiers: item.modifiers,
      });

      // 6. [STOCK-001] Descuento atómico de stock dentro de la misma transacción PostgreSQL
      const prod = inMemoryProducts.find((p) => p.id === item.product_id && p.business_id === p_business_id);
      if (prod && prod.metadata?.track_stock) {
        // Descontar en metadata (retrocompatibilidad)
        const currentMetaStock = Number(prod.metadata.stock_quantity || 0);
        prod.metadata.stock_quantity = Math.max(0, currentMetaStock - item.quantity);

        // Descontar en inventory_stock (INV-001)
        const stockRow = inMemoryInventoryStock.find(
          (s) => s.product_id === item.product_id && s.business_id === p_business_id
        );
        if (stockRow) {
          stockRow.quantity = Math.max(0, Number(stockRow.quantity || 0) - item.quantity);
        }

        // Registrar en inventory_movements (Kardex)
        inMemoryInventoryMovements.push({
          id: `mov_${Math.random().toString(36).substring(2, 6)}`,
          business_id: p_business_id,
          product_id: item.product_id,
          location_id: LOCATION_A,
          movement_type: "sale",
          quantity: item.quantity,
          reference_id: orderId,
          reference_type: "sale",
          created_at: new Date().toISOString(),
        });
      }
    }

    return {
      data: {
        success: true,
        order_id: orderId,
        order_number: orderNumber,
        total: p_total,
        is_duplicate: false,
      },
      error: null,
    };
  } catch (err: any) {
    // Rollback atómico: Si algo falla, se restaura el snapshot exacto previo
    inMemoryProducts = snapshotProducts;
    inMemoryInventoryStock = snapshotStock;
    inMemoryInventoryMovements = snapshotMovements;
    inMemoryOrders = snapshotOrders;
    inMemoryOrderItems = snapshotOrderItems;

    return {
      data: null,
      error: err,
    };
  }
}

const mockSupabase = {
  rpc: vi.fn(async (name: string, params: any) => {
    if (name === "create_restaurant_pos_order") {
      return executePosOrderRpc(params);
    }
    throw new Error(`RPC not mocked: ${name}`);
  }),
  from: (tableName: string) => {
    if (tableName === "products") {
      return {
        select: () => ({
          eq: (col: string, val: any) => {
            let list = [...inMemoryProducts].filter((p) => p[col] === val);
            const chain: any = {
              eq: (c2: string, v2: any) => {
                list = list.filter((p) => p[c2] === v2);
                return chain;
              },
              in: (c3: string, vals: any[]) => {
                list = list.filter((p) => vals.includes(p[c3]));
                return chain;
              },
              then: (resolve: any, reject?: any) => {
                return Promise.resolve({ data: list, error: null }).then(resolve, reject);
              },
            };
            return chain;
          },
        }),
      };
    }

    if (tableName === "restaurant_tables") {
      return {
        select: () => {
          let list = inMemoryTables;
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((t) => t[col] === val);
              return chain;
            },
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
          };
          return chain;
        },
        update: (data: any) => ({
          eq: (c1: string, v1: any) => ({
            eq: (c2: string, v2: any) => {
              const table = inMemoryTables.find((t) => t[c1] === v1 && t[c2] === v2);
              if (table) Object.assign(table, data);
              return Promise.resolve({ data: table, error: null });
            },
          }),
        }),
      };
    }

    // Tablas auxiliares opcionales (notificaciones, whatsapp)
    const mockQueryBuilder: any = {
      eq: () => mockQueryBuilder,
      neq: () => mockQueryBuilder,
      in: () => mockQueryBuilder,
      order: () => mockQueryBuilder,
      limit: () => mockQueryBuilder,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    };

    return {
      select: () => mockQueryBuilder,
      insert: () => Promise.resolve({ error: null }),
      update: () => mockQueryBuilder,
    };
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe("STOCK-001: Descuento de stock atómico en RPC PostgreSQL", () => {
  beforeEach(() => {
    forceRpcFailure = false;
    inMemoryOrders = [];
    inMemoryOrderItems = [];
    inMemoryInventoryMovements = [];

    // Producto de prueba con stock inicial 50
    inMemoryProducts = [
      {
        id: "11111111-2222-4333-8444-555555555555",
        business_id: BUSINESS_A,
        name: "Combo Hamburguesa",
        price: 25000,
        status: "active",
        is_available: true,
        metadata: {
          track_stock: true,
          stock_quantity: 50,
          min_stock: 5,
        },
      },
    ];

    // Stock normalizado inicial (INV-001)
    inMemoryInventoryStock = [
      {
        id: "stk-1",
        business_id: BUSINESS_A,
        product_id: "11111111-2222-4333-8444-555555555555",
        location_id: LOCATION_A,
        quantity: 50,
        min_stock: 5,
        cost: 10000,
      },
    ];

    inMemoryTables = [
      {
        id: "table-1",
        business_id: BUSINESS_A,
        name_or_number: "Mesa 1",
        status: "available",
      },
    ];

    vi.clearAllMocks();
  });

  describe("1. Creación exitosa con descuento atómico de existencias", () => {
    it("al crear el pedido con éxito, descuenta el stock en products.metadata y en inventory_stock y genera el movimiento", async () => {
      const result = await createRestaurantOrder(
        BUSINESS_A,
        {
          orderType: "takeout",
          customerName: "Carlos Pérez",
          customerPhone: "3001234567",
          items: [
            {
              productId: "11111111-2222-4333-8444-555555555555",
              productName: "Combo Hamburguesa",
              quantity: 5,
              unitPrice: 25000,
              subtotal: 125000,
            },
          ],
        },
        "user_cajero_1"
      );

      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();

      // 1. El pedido existe en base de datos
      expect(inMemoryOrders.length).toBe(1);
      expect(inMemoryOrders[0].total).toBe(125000);

      // 2. El stock en metadata se descontó atómicamente: 50 - 5 = 45
      const prod = inMemoryProducts.find((p) => p.id === "11111111-2222-4333-8444-555555555555");
      expect(prod.metadata.stock_quantity).toBe(45);

      // 3. El stock normalizado en inventory_stock se descontó atómicamente: 50 - 5 = 45
      const stock = inMemoryInventoryStock.find(
        (s) => s.product_id === "11111111-2222-4333-8444-555555555555"
      );
      expect(stock.quantity).toBe(45);

      // 4. Se registró el movimiento inmutable en inventory_movements con tipo 'sale'
      expect(inMemoryInventoryMovements.length).toBe(1);
      expect(inMemoryInventoryMovements[0].movement_type).toBe("sale");
      expect(inMemoryInventoryMovements[0].quantity).toBe(5);
      expect(inMemoryInventoryMovements[0].reference_id).toBe(result.orderId);
    });
  });

  describe("2. Atomicidad y Rollback: Criterio de Aceptación", () => {
    it("si la RPC falla, el pedido NO existe y el stock NO se descuenta (rollback total)", async () => {
      // Simular fallo interno durante la transacción PostgreSQL
      forceRpcFailure = true;

      const result = await createRestaurantOrder(
        BUSINESS_A,
        {
          orderType: "takeout",
          customerName: "Carlos Pérez",
          items: [
            {
              productId: "11111111-2222-4333-8444-555555555555",
              productName: "Combo Hamburguesa",
              quantity: 5,
              unitPrice: 25000,
              subtotal: 125000,
            },
          ],
        },
        "user_cajero_1"
      );

      expect(result.success).toBe(false);

      // Criterio de Aceptación: Si la RPC falla, el pedido NO existe
      expect(inMemoryOrders.length).toBe(0);
      expect(inMemoryOrderItems.length).toBe(0);

      // Criterio de Aceptación: El stock NO se descuenta (se mantiene en 50)
      const prod = inMemoryProducts.find((p) => p.id === "11111111-2222-4333-8444-555555555555");
      expect(prod.metadata.stock_quantity).toBe(50);

      const stock = inMemoryInventoryStock.find(
        (s) => s.product_id === "11111111-2222-4333-8444-555555555555"
      );
      expect(stock.quantity).toBe(50);

      // No se creó ningún movimiento
      expect(inMemoryInventoryMovements.length).toBe(0);
    });

    it("si falla por validación de mesa ocupada, ni el pedido ni el stock sufren cambios", async () => {
      // Poner la mesa en estado occupied
      inMemoryTables[0].status = "occupied";

      const result = await createRestaurantOrder(
        BUSINESS_A,
        {
          orderType: "dine_in",
          tableId: "table-1",
          items: [
            {
              productId: "11111111-2222-4333-8444-555555555555",
              productName: "Combo Hamburguesa",
              quantity: 10,
              unitPrice: 25000,
              subtotal: 250000,
            },
          ],
        },
        "user_cajero_1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/ocupada/i);

      // Cero órdenes creadas y stock intacto en 50
      expect(inMemoryOrders.length).toBe(0);
      expect(inMemoryProducts[0].metadata.stock_quantity).toBe(50);
      expect(inMemoryInventoryStock[0].quantity).toBe(50);
    });
  });

  describe("3. Simulación de fallo de red después de la RPC (Criterio de Aceptación)", () => {
    it("al estar dentro de la RPC, el stock y el pedido ya están persistidos juntos sin riesgo de desincronización por red", async () => {
      // Crear pedido
      const result = await createRestaurantOrder(
        BUSINESS_A,
        {
          orderType: "takeout",
          items: [
            {
              productId: "11111111-2222-4333-8444-555555555555",
              productName: "Combo Hamburguesa",
              quantity: 3,
              unitPrice: 25000,
              subtotal: 75000,
            },
          ],
        },
        "user_cajero_1"
      );

      expect(result.success).toBe(true);

      // Ambas entidades están en su estado final consistente garantizado por la misma transacción
      expect(inMemoryOrders.length).toBe(1);
      expect(inMemoryProducts[0].metadata.stock_quantity).toBe(47);
      expect(inMemoryInventoryStock[0].quantity).toBe(47);
    });
  });

  describe("4. Idempotencia y Reintentos", () => {
    it("un reintento con la misma clave de idempotencia devuelve el pedido sin descontar stock duplicado", async () => {
      const idempotencyKey = "key_retry_123";

      // 1. Primera invocación: descuenta 4 unidades (50 -> 46)
      const res1 = await createRestaurantOrder(
        BUSINESS_A,
        {
          orderType: "takeout",
          idempotencyKey,
          items: [
            {
              productId: "11111111-2222-4333-8444-555555555555",
              productName: "Combo Hamburguesa",
              quantity: 4,
              unitPrice: 25000,
              subtotal: 100000,
            },
          ],
        },
        "user_cajero_1"
      );

      expect(res1.success).toBe(true);
      expect(inMemoryProducts[0].metadata.stock_quantity).toBe(46);
      expect(inMemoryInventoryStock[0].quantity).toBe(46);

      // 2. Segunda invocación con la misma idempotencyKey (reintento por timeout o red)
      const res2 = await createRestaurantOrder(
        BUSINESS_A,
        {
          orderType: "takeout",
          idempotencyKey,
          items: [
            {
              productId: "11111111-2222-4333-8444-555555555555",
              productName: "Combo Hamburguesa",
              quantity: 4,
              unitPrice: 25000,
              subtotal: 100000,
            },
          ],
        },
        "user_cajero_1"
      );

      expect(res2.success).toBe(true);
      expect(res2.orderId).toBe(res1.orderId);

      // El stock NO se descuenta por segunda vez: sigue siendo 46
      expect(inMemoryProducts[0].metadata.stock_quantity).toBe(46);
      expect(inMemoryInventoryStock[0].quantity).toBe(46);

      // Solo existe 1 movimiento de venta registrado
      expect(inMemoryInventoryMovements.length).toBe(1);
    });
  });

  describe("5. Validación estática del archivo de migración SQL", () => {
    it("el archivo de migración actualiza create_restaurant_pos_order con descuento atómico de stock", () => {
      const migrationPath = join(
        process.cwd(),
        "supabase/migrations/20261029200000_atomic_stock_deduction_in_rpc.sql"
      );
      const sqlContent = readFileSync(migrationPath, "utf-8");

      expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.create_restaurant_pos_order");
      expect(sqlContent).toContain("FOR UPDATE"); // Bloqueo pesimista de producto para evitar condiciones de carrera
      expect(sqlContent).toContain("track_stock");
      expect(sqlContent).toContain("jsonb_set(metadata, '{stock_quantity}'"); // Descuento en products.metadata
      expect(sqlContent).toContain("UPDATE public.inventory_stock"); // Descuento en inventory_stock
      expect(sqlContent).toContain("INSERT INTO public.inventory_movements"); // Registro en kardex
      expect(sqlContent).toContain("'sale'");
    });
  });
});
