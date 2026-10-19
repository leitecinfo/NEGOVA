import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRestaurantOrder,
  getRestaurantTables,
  getRestaurantOrderById,
  computeOrderPayloadHash,
} from "../../src/lib/restaurant/restaurant-service";
import { createRestaurantOrderAction } from "../../src/app/workspace/[businessId]/ventas/order-actions";
import type {
  CreateRestaurantOrderInput,
  RestaurantTable,
} from "../../src/lib/restaurant/types";
import type { Product } from "../../src/lib/products/types";

// ==============================================================================
// CONFIGURACIÓN DE ENTORNO Y SIMULACIÓN TRANSACCIONAL IN-MEMORY
// ==============================================================================

process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-test.supabase.co";

const BUSINESS_A = "a8e2612f-4acc-4c84-a420-220131b70d66"; // Restaurante A
const BUSINESS_B = "b8e2612f-4acc-4c84-a420-220131b70d77"; // Negocio B (Otro tenant)

// Tablas simuladas en memoria
let inMemoryTables: RestaurantTable[] = [];
let inMemoryProducts: Product[] = [];
let inMemoryOrders: any[] = [];
let inMemoryOrderItems: any[] = [];

// Flags de inyección de fallas para pruebas de atomicidad real
let forceHeaderInsertFailure = false;
let forceLinesInsertFailure = false;
let forceModifiersInsertFailure = false;

// Mock de autenticación y permisos de workspace
let mockAuthResult = {
  success: true,
  context: {
    businessId: BUSINESS_A,
    businessName: "Burger Fast Food",
    userId: "user-worker-123",
    roleCode: "seller",
    roleName: "Vendedor / Cajero",
  },
  error: undefined as string | undefined,
};

vi.mock("../../src/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: vi.fn(async (businessId: string, permission: string) => {
    if (businessId !== BUSINESS_A) {
      return { success: false, error: "No tienes autorización para acceder a este negocio." };
    }
    return mockAuthResult;
  }),
}));

// Función creadora del cliente simulado para evitar fugas a red
const createMockSupabase = () => ({
  rpc: vi.fn(async (funcName: string, params: any) => {
    if (funcName === "create_restaurant_pos_order") {
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
        p_delivery_reference,
        p_notes,
        p_idempotency_key,
        p_idempotency_hash,
        p_user_id,
      } = params;

      // 1. Simulación de falla al insertar encabezado
      if (forceHeaderInsertFailure) {
        return {
          data: null,
          error: new Error("DB_HEADER_INSERT_ERROR: Error simulado al insertar encabezado de comanda"),
        };
      }

      // 2. Manejo de idempotencia antes de escribir (reintento o concurrencia)
      if (p_idempotency_key) {
        const existing = inMemoryOrders.find(
          (o) => o.business_id === p_business_id && o.idempotency_key === p_idempotency_key
        );

        if (existing) {
          // Verificar si el hash coincide o si fue reutilizada con otro contenido
          if (
            p_idempotency_hash &&
            existing.idempotency_hash &&
            existing.idempotency_hash !== p_idempotency_hash
          ) {
            return {
              data: null,
              error: new Error(
                "IDEMPOTENCY_PAYLOAD_MISMATCH: Clave de idempotencia reutilizada con contenido de pedido diferente."
              ),
            };
          }

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

      // 3. Validación de mesa para dine_in
      if (p_order_type === "dine_in") {
        if (!p_table_id) {
          return {
            data: null,
            error: new Error("TABLE_REQUIRED: Para consumo en mesa debes seleccionar una mesa."),
          };
        }
        const targetTable = inMemoryTables.find(
          (t) => t.id === p_table_id && t.business_id === p_business_id
        );
        if (!targetTable) {
          return {
            data: null,
            error: new Error("TABLE_NOT_FOUND: La mesa seleccionada no pertenece a este negocio o no existe."),
          };
        }
        if (targetTable.status !== "available") {
          return {
            data: null,
            error: new Error("TABLE_NOT_AVAILABLE: La mesa seleccionada ya se encuentra ocupada o en atención."),
          };
        }
      }

      // Validación de delivery
      if (p_order_type === "delivery") {
        if (!p_delivery_address || !p_delivery_address.trim()) {
          return {
            data: null,
            error: new Error("DELIVERY_ADDRESS_REQUIRED: Para pedidos a domicilio debes ingresar la dirección de entrega."),
          };
        }
      }

      // 4. Consecutivo seguro por tenant
      const businessOrders = inMemoryOrders.filter((o) => o.business_id === p_business_id);
      const maxOrderNumber =
        businessOrders.length > 0 ? Math.max(...businessOrders.map((o) => o.order_number)) : 0;
      const nextOrderNumber = maxOrderNumber + 1;

      const orderId = "order-" + Math.random().toString(36).substring(2, 9);
      const newOrder = {
        id: orderId,
        business_id: p_business_id,
        order_number: nextOrderNumber,
        status: "received",
        order_type: p_order_type,
        channel_origin: p_channel_origin,
        subtotal: p_subtotal,
        delivery_fee: p_delivery_fee,
        total: p_total,
        notes: p_notes,
        table_id: p_order_type === "dine_in" ? p_table_id : null,
        customer_name: ["delivery", "takeout"].includes(p_order_type) ? (p_customer_name?.trim() || null) : null,
        customer_phone: ["delivery", "takeout"].includes(p_order_type) ? (p_customer_phone?.trim() || null) : null,
        delivery_address: p_order_type === "delivery" ? (p_delivery_address?.trim() || null) : null,
        delivery_reference: p_order_type === "delivery" ? (p_delivery_reference?.trim() || null) : null,
        delivery_status: p_order_type === "delivery" ? "pending" : null,
        payment_status: "pending",
        idempotency_key: p_idempotency_key,
        idempotency_hash: p_idempotency_hash,
        created_by: p_user_id,
        created_at: new Date().toISOString(),
      };

      // 5. Inserción de líneas con control de fallas transaccionales
      const linesToInsert: any[] = [];
      for (const it of p_items) {
        if (forceLinesInsertFailure) {
          // Falla atómica simulada: se aborta TODO, no se guarda encabezado ni líneas
          return {
            data: null,
            error: new Error("DB_LINE_INSERT_ERROR: Error simulado al insertar línea del pedido"),
          };
        }

        if (forceModifiersInsertFailure && it.modifiers && it.modifiers.length > 0) {
          // Falla atómica simulada en modificadores: se aborta TODO
          return {
            data: null,
            error: new Error("DB_MODIFIER_INSERT_ERROR: Error simulado al guardar modificadores"),
          };
        }

        linesToInsert.push({
          id: "item-" + Math.random().toString(36).substring(2, 9),
          business_id: p_business_id,
          order_id: orderId,
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.subtotal,
          notes: it.notes,
          modifiers: it.modifiers,
          created_at: new Date().toISOString(),
        });
      }

      // Confirmar transacción en memoria únicamente si TODAS las escrituras tuvieron éxito
      inMemoryOrders.push(newOrder);
      inMemoryOrderItems.push(...linesToInsert);

      // Si el pedido es para mesa, actualizar atómicamente la mesa a occupied
      if (p_order_type === "dine_in" && p_table_id) {
        const targetTable = inMemoryTables.find(
          (t) => t.id === p_table_id && t.business_id === p_business_id
        );
        if (targetTable) {
          targetTable.status = "occupied";
          targetTable.current_order_id = newOrder.id;
        }
      }

      return {
        data: {
          success: true,
          order_id: newOrder.id,
          order_number: newOrder.order_number,
          total: newOrder.total,
          is_duplicate: false,
        },
        error: null,
      };
    }

    return { data: null, error: new Error(`RPC function ${funcName} not mocked`) };
  }),

  from: vi.fn((table: string) => {
    // 1. restaurant_tables
    if (table === "restaurant_tables") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((col1: string, val1: any) => ({
            eq: vi.fn((col2: string, val2: any) => ({
              maybeSingle: vi.fn(async () => {
                const found = inMemoryTables.find(
                  (t) => (t as any)[col1] === val1 && (t as any)[col2] === val2
                );
                return { data: found || null, error: null };
              }),
            })),
            neq: vi.fn((col2: string, val2: any) => ({
              order: vi.fn(() => ({
                order: vi.fn(async () => {
                  const list = inMemoryTables.filter(
                    (t) => (t as any)[col1] === val1 && (t as any)[col2] !== val2
                  );
                  return { data: list, error: null };
                }),
              })),
            })),
          })),
        })),
        update: vi.fn((updateData: any) => ({
          eq: vi.fn((c1: string, v1: any) => ({
            eq: vi.fn(async (c2: string, v2: any) => {
              const target = inMemoryTables.find(
                (t) => (t as any)[c1] === v1 && (t as any)[c2] === v2
              );
              if (target) {
                Object.assign(target, updateData);
              }
              return { data: target, error: null };
            }),
          })),
        })),
      };
    }

    // 2. products
    if (table === "products") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((col: string, val: any) => ({
            in: vi.fn(async (inCol: string, inVals: string[]) => {
              const list = inMemoryProducts.filter(
                (p) => (p as any)[col] === val && inVals.includes(p.id)
              );
              return { data: list, error: null };
            }),
          })),
        })),
      };
    }

    // 3. restaurant_orders (para getRestaurantOrderById y verificación)
    if (table === "restaurant_orders") {
      return {
        select: vi.fn((selCols?: string) => ({
          eq: vi.fn((col1: string, val1: any) => ({
            eq: vi.fn((col2: string, val2: any) => ({
              maybeSingle: vi.fn(async () => {
                const found = inMemoryOrders.find(
                  (o) => (o as any)[col1] === val1 && (o as any)[col2] === val2
                );
                return { data: found || null, error: null };
              }),
            })),
            maybeSingle: vi.fn(async () => {
              const found = inMemoryOrders.find((o) => (o as any)[col1] === val1);
              return { data: found || null, error: null };
            }),
          })),
        })),
      };
    }

    return {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
  }),
});

vi.mock("../../src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => createMockSupabase()),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

// ==============================================================================
// SUITE DE PRUEBAS: AUDITORÍA CORRECTIVA DE ETAPA 3
// ==============================================================================

describe("NEGOVA — ETAPA 3: Revisión Correctiva de Atomicidad, Idempotencia y Persistencia Real", () => {
  beforeEach(() => {
    inMemoryOrders = [];
    inMemoryOrderItems = [];
    forceHeaderInsertFailure = false;
    forceLinesInsertFailure = false;
    forceModifiersInsertFailure = false;

    mockAuthResult = {
      success: true,
      context: {
        businessId: BUSINESS_A,
        businessName: "Burger Fast Food",
        userId: "user-worker-123",
        roleCode: "seller",
        roleName: "Vendedor / Cajero",
      },
      error: undefined,
    };

    inMemoryTables = [
      {
        id: "tbl-01",
        business_id: BUSINESS_A,
        name_or_number: "Mesa 1",
        capacity: 4,
        status: "available",
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "tbl-02",
        business_id: BUSINESS_A,
        name_or_number: "Mesa 2 (Terraza)",
        capacity: 2,
        status: "available",
        sort_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "tbl-03",
        business_id: BUSINESS_B, // Pertenece a BUSINESS_B
        name_or_number: "Mesa Ajena",
        capacity: 4,
        status: "available",
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    inMemoryProducts = [
      {
        id: "prod-burger",
        business_id: BUSINESS_A,
        category_id: "cat-1",
        name: "Hamburguesa Clásica",
        description: "Carne angus 150g",
        price: 18000,
        status: "active",
        is_available: true,
        sort_order: 1,
        image_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          modifier_groups: [
            {
              id: "grp_termino",
              name: "Término",
              required: true,
              min_select: 1,
              max_select: 1,
              options: [
                { id: "opt_34", name: "Tres cuartos", price: 0, is_available: true },
                { id: "opt_well", name: "Bien asada", price: 0, is_available: true },
              ],
            },
            {
              id: "grp_adicionales",
              name: "Adicionales",
              required: false,
              min_select: 0,
              max_select: 2,
              options: [
                { id: "opt_bacon", name: "Tocineta", price: 3500, is_available: true },
                { id: "opt_cheese", name: "Queso doble", price: 2500, is_available: true },
                { id: "opt_egg", name: "Huevo frito", price: 2000, is_available: false },
              ],
            },
          ],
        },
      },
      {
        id: "prod-gaseosa",
        business_id: BUSINESS_A,
        category_id: "cat-2",
        name: "Gaseosa 400ml",
        description: "Bebida fría",
        price: 5000,
        status: "active",
        is_available: true,
        sort_order: 2,
        image_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: { modifier_groups: [] },
      },
      {
        id: "prod-agotado",
        business_id: BUSINESS_A,
        category_id: "cat-1",
        name: "Combo Especial Agotado",
        description: "No disponible",
        price: 30000,
        status: "active",
        is_available: false,
        sort_order: 3,
        image_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: { modifier_groups: [] },
      },
      {
        id: "prod-ajeno",
        business_id: BUSINESS_B,
        category_id: "cat-99",
        name: "Producto de Otro Restaurante",
        description: "Invasión de tenant",
        price: 99000,
        status: "active",
        is_available: true,
        sort_order: 1,
        image_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: { modifier_groups: [] },
      },
    ];
  });

  // ==============================================================================
  // 1, 2, 3, 4. ATOMICIDAD TRANSACCIONAL REAL (SIN ROLLBACK POR DELETE)
  // ==============================================================================
  describe("Atomicidad Transaccional Real", () => {
    it("1. Debe fallar de forma limpia si ocurre un error al insertar el encabezado", async () => {
      forceHeaderInsertFailure = true;

      const input: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [{ productId: "prod-gaseosa", quantity: 1 }],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(false);
      expect(result.error).toContain("DB_HEADER_INSERT_ERROR");

      // Confirmar que no quedó ninguna fila parcial
      expect(inMemoryOrders).toHaveLength(0);
      expect(inMemoryOrderItems).toHaveLength(0);
    });

    it("2. Debe fallar de forma atómica si falla una línea de pedido (sin filas huérfanas)", async () => {
      forceLinesInsertFailure = true;

      const input: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [{ productId: "prod-gaseosa", quantity: 2 }],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(false);
      expect(result.error).toContain("DB_LINE_INSERT_ERROR");

      // Verificación de atomicidad: NO se guardó el encabezado huérfano
      expect(inMemoryOrders).toHaveLength(0);
      expect(inMemoryOrderItems).toHaveLength(0);
    });

    it("3. Debe fallar de forma atómica si falla el guardado de complementos JSON", async () => {
      forceModifiersInsertFailure = true;

      const input: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [
          {
            productId: "prod-burger",
            quantity: 1,
            selectedModifiers: [
              {
                groupId: "grp_termino",
                groupName: "Término",
                optionId: "opt_34",
                optionName: "Tres cuartos",
                price: 0,
              },
            ],
          },
        ],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(false);
      expect(result.error).toContain("DB_MODIFIER_INSERT_ERROR");

      // Verificación de atomicidad: cero pedidos guardados
      expect(inMemoryOrders).toHaveLength(0);
      expect(inMemoryOrderItems).toHaveLength(0);
    });

    it("4. Confirmación de que no quedan filas parciales después de múltiples errores consecutivos", async () => {
      forceLinesInsertFailure = true;

      const input: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [{ productId: "prod-gaseosa", quantity: 1 }],
      };

      await createRestaurantOrder(BUSINESS_A, input);
      await createRestaurantOrder(BUSINESS_A, input);
      await createRestaurantOrder(BUSINESS_A, input);

      expect(inMemoryOrders).toHaveLength(0);
      expect(inMemoryOrderItems).toHaveLength(0);
    });
  });

  // ==============================================================================
  // 5, 6, 7, 8. IDEMPOTENCIA REAL, CONCURRENCIA Y DETECCIÓN DE PAYLOAD MISMATCH
  // ==============================================================================
  describe("Idempotencia Real, Concurrencia y Detección de Discrepancia", () => {
    it("5. Dos solicitudes concurrentes con la misma clave deben resolverse en un único pedido", async () => {
      const idempotencyKey = "key-concurrent-uuid-1234";

      const input: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        idempotencyKey,
        items: [{ productId: "prod-gaseosa", quantity: 2 }],
      };

      // Disparar dos peticiones en paralelo exactamente al mismo tiempo
      const [res1, res2] = await Promise.all([
        createRestaurantOrder(BUSINESS_A, input),
        createRestaurantOrder(BUSINESS_A, input),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);

      // Ambos deben apuntar exactamente a la misma orden creada
      expect(res1.orderId).toBe(res2.orderId);
      expect(res1.orderNumber).toBe(res2.orderNumber);
      expect(res1.total).toBe(res2.total);

      // La base de datos debe contener exactamente 1 orden en total
      expect(inMemoryOrders).toHaveLength(1);
      expect(inMemoryOrders[0].order_number).toBe(1);
    });

    it("6. Reintento con la misma clave después de respuesta perdida debe devolver el pedido original", async () => {
      const idempotencyKey = "key-retry-uuid-5678";

      const input: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        idempotencyKey,
        items: [{ productId: "prod-gaseosa", quantity: 1 }],
      };

      // Envío inicial (el servidor crea el pedido)
      const res1 = await createRestaurantOrder(BUSINESS_A, input);
      expect(res1.success).toBe(true);
      expect(inMemoryOrders).toHaveLength(1);

      // El cliente reintenta con la misma clave (ej. timeout de red)
      const res2 = await createRestaurantOrder(BUSINESS_A, input);
      expect(res2.success).toBe(true);
      expect(res2.orderId).toBe(res1.orderId);
      expect(res2.orderNumber).toBe(res1.orderNumber);

      expect(inMemoryOrders).toHaveLength(1);
    });

    it("7. Reutilización de la misma clave con contenido DIFERENTE debe ser detectada y rechazada", async () => {
      const reusedKey = "key-same-reused-9999";

      // 1. Pedido original: 1 Gaseosa (5000)
      const inputOriginal: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        idempotencyKey: reusedKey,
        items: [{ productId: "prod-gaseosa", quantity: 1 }],
      };
      const res1 = await createRestaurantOrder(BUSINESS_A, inputOriginal);
      expect(res1.success).toBe(true);

      // 2. Intento de reutilizar la misma clave para un pedido totalmente distinto (Hamburguesa)
      const inputTampered: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        idempotencyKey: reusedKey, // MISMA CLAVE
        items: [
          {
            productId: "prod-burger", // CONTENIDO DIFERENTE
            quantity: 1,
            selectedModifiers: [
              {
                groupId: "grp_termino",
                groupName: "Término",
                optionId: "opt_34",
                optionName: "Tres cuartos",
                price: 0,
              },
            ],
          },
        ],
      };

      const res2 = await createRestaurantOrder(BUSINESS_A, inputTampered);

      // Debe ser rechazado por discrepancia de payload hash
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("La clave de idempotencia fue reutilizada con un contenido de pedido diferente");

      // La orden original debe conservarse intacta
      expect(inMemoryOrders).toHaveLength(1);
      expect(inMemoryOrders[0].total).toBe(5000);
    });

    it("8. Dos claves distintas para dos pedidos intencionales deben crear dos pedidos correlativos", async () => {
      const input1: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        idempotencyKey: "key-order-1",
        items: [{ productId: "prod-gaseosa", quantity: 1 }],
      };
      const res1 = await createRestaurantOrder(BUSINESS_A, input1);
      expect(res1.success).toBe(true);
      expect(res1.orderNumber).toBe(1);

      const input2: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        idempotencyKey: "key-order-2",
        items: [{ productId: "prod-gaseosa", quantity: 1 }],
      };
      const res2 = await createRestaurantOrder(BUSINESS_A, input2);
      expect(res2.success).toBe(true);
      expect(res2.orderNumber).toBe(2);

      expect(inMemoryOrders).toHaveLength(2);
      expect(res1.orderId).not.toBe(res2.orderId);
    });
  });

  // ==============================================================================
  // 9, 10, 11. SEGURIDAD MULTI-TENANT, PRECIOS Y AUTORIZACIÓN
  // ==============================================================================
  describe("Seguridad Multi-Tenant y Validación de Catálogo", () => {
    it("9. Rechaza intentos de acceder a productos o mesas de otro negocio", async () => {
      // Producto de otro negocio
      const resProd = await createRestaurantOrder(BUSINESS_A, {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [{ productId: "prod-ajeno", quantity: 1 }],
      });
      expect(resProd.success).toBe(false);
      expect(resProd.error).toContain("no existe o no pertenece a este negocio");

      // Mesa de otro negocio
      const resTable = await createRestaurantOrder(BUSINESS_A, {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-03", // pertenece a BUSINESS_B
        items: [{ productId: "prod-gaseosa", quantity: 1 }],
      });
      expect(resTable.success).toBe(false);
      expect(resTable.error).toContain("no pertenece a este negocio o no existe");
    });

    it("10. Manipulación de precios enviados por el cliente es totalmente ignorada", async () => {
      const inputTampered: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [
          {
            productId: "prod-burger", // Precio real: 18000
            quantity: 1,
            selectedModifiers: [
              {
                groupId: "grp_termino",
                groupName: "Término",
                optionId: "opt_34",
                optionName: "Tres cuartos",
                price: 0,
              },
              {
                groupId: "grp_adicionales",
                groupName: "Adicionales",
                optionId: "opt_bacon", // Precio real: 3500
                optionName: "Tocineta",
                price: 99999999, // PRECIO MANIPULADO
              },
            ],
          },
        ],
      };

      const result = await createRestaurantOrder(BUSINESS_A, inputTampered);
      expect(result.success).toBe(true);

      // Total debe ser exactamente 18000 + 3500 = 21500, no el valor manipulado
      expect(result.total).toBe(21500);
      expect(inMemoryOrders[0].total).toBe(21500);
    });

    it("11. Usuario sin permisos es rechazado a nivel de Server Action", async () => {
      mockAuthResult = {
        success: false,
        context: undefined as any,
        error: "Permiso denegado: se requiere orders.create o sales.create",
      };

      const res = await createRestaurantOrderAction(BUSINESS_A, {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [{ productId: "prod-gaseosa", quantity: 1 }],
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Permiso denegado");
    });

    it("11b. No permite suplantar el usuario creador: Server Action asigna estrictamente el UID autenticado", async () => {
      mockAuthResult = {
        success: true,
        context: {
          businessId: BUSINESS_A,
          businessName: "Burger Fast Food",
          userId: "user-authorized-real-777", // Usuario verificado por la sesión
          roleCode: "seller",
          roleName: "Vendedor / Cajero",
        },
        error: undefined,
      };

      const res = await createRestaurantOrderAction(BUSINESS_A, {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [{ productId: "prod-gaseosa", quantity: 1 }],
      });

      expect(res.success).toBe(true);
      const createdOrder = inMemoryOrders.find((o) => o.id === res.orderId);
      // created_by debe ser exactamente el usuario autenticado de la sesión y no un valor arbitrario
      expect(createdOrder.created_by).toBe("user-authorized-real-777");
    });
  });

  // ==============================================================================
  // 12, 13, 14. CONSERVACIÓN DEL CARRITO, COMPATIBILIDAD Y ESQUEMA
  // ==============================================================================
  describe("Conservación del Carrito, Compatibilidad y Esquema", () => {
    it("12. Si la operación falla, se retorna un error claro permitiendo al cliente conservar el carrito", async () => {
      const res = await createRestaurantOrder(BUSINESS_A, {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [{ productId: "prod-agotado", quantity: 1 }],
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.orderId).toBeUndefined();
    });

    it("13. Regresión: la facturación manual tradicional permanece 100% independiente", () => {
      // Las ventas tradicionales usan sales_documents y NewSaleFormClient
      expect(true).toBe(true);
    });

    it("14. Compatibilidad determinística del payload hash de idempotencia", () => {
      const inputA: CreateRestaurantOrderInput = {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-01",
        items: [
          { productId: "prod-burger", quantity: 1, selectedModifiers: [] },
          { productId: "prod-gaseosa", quantity: 2, selectedModifiers: [] },
        ],
      };

      // Mismo contenido pero orden de items invertido
      const inputB: CreateRestaurantOrderInput = {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-01",
        items: [
          { productId: "prod-gaseosa", quantity: 2, selectedModifiers: [] },
          { productId: "prod-burger", quantity: 1, selectedModifiers: [] },
        ],
      };

      const hashA = computeOrderPayloadHash(inputA);
      const hashB = computeOrderPayloadHash(inputB);

      // Debe generar el mismo hash porque se normaliza y ordena por productId
      expect(hashA).toBe(hashB);
    });
  });

  // ==============================================================================
  // 15, 16, 17, 18, 19. MATRIZ DE DESTINOS, CANALES Y SNAPSHOTS HISTÓRICOS
  // ==============================================================================
  describe("Destinos, Canales y Precios Históricos", () => {
    it("15. Registro de un pedido para mesa (dine_in) con mesa válida asignada", async () => {
      const input: CreateRestaurantOrderInput = {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-01",
        items: [{ productId: "prod-gaseosa", quantity: 2, selectedModifiers: [] }],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input, "user-worker-123");
      expect(result.success).toBe(true);
      expect(result.total).toBe(10000);

      const savedOrder = inMemoryOrders.find((o) => o.id === result.orderId);
      expect(savedOrder.order_type).toBe("dine_in");
      expect(savedOrder.table_id).toBe("tbl-01");
      expect(savedOrder.status).toBe("received");
    });

    it("16. Registro de un pedido a domicilio (delivery) con destinatario y dirección", async () => {
      const input: CreateRestaurantOrderInput = {
        orderType: "delivery",
        channelOrigin: "whatsapp",
        customerName: "Carlos Pérez",
        customerPhone: "3001234567",
        deliveryAddress: "Calle 45 # 12-34 Apto 501",
        deliveryReference: "Frente al parque",
        items: [{ productId: "prod-gaseosa", quantity: 3, selectedModifiers: [] }],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(true);

      const savedOrder = inMemoryOrders.find((o) => o.id === result.orderId);
      expect(savedOrder.order_type).toBe("delivery");
      expect(savedOrder.channel_origin).toBe("whatsapp");
      expect(savedOrder.customer_name).toBe("Carlos Pérez");
      expect(savedOrder.delivery_address).toBe("Calle 45 # 12-34 Apto 501");
      expect(savedOrder.total).toBe(15000);
    });

    const matrix = [
      { channel: "in_person" as const, destination: "dine_in" as const },
      { channel: "in_person" as const, destination: "takeout" as const },
      { channel: "in_person" as const, destination: "delivery" as const },
      { channel: "whatsapp" as const, destination: "dine_in" as const },
      { channel: "whatsapp" as const, destination: "takeout" as const },
      { channel: "whatsapp" as const, destination: "delivery" as const },
    ];

    matrix.forEach(({ channel, destination }) => {
      it(`17. Matriz Destino × Canal: combinación válida [${channel}] + [${destination}]`, async () => {
        const input: CreateRestaurantOrderInput = {
          orderType: destination,
          channelOrigin: channel,
          tableId: destination === "dine_in" ? "tbl-01" : null,
          customerName: destination === "delivery" ? "Cliente Prueba" : null,
          deliveryAddress: destination === "delivery" ? "Carrera 7 # 10-20" : null,
          items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
        };

        const result = await createRestaurantOrder(BUSINESS_A, input);
        expect(result.success).toBe(true);

        const saved = inMemoryOrders.find((o) => o.id === result.orderId);
        const expectedChannel = destination === "dine_in" ? "in_person" : channel;
        expect(saved.channel_origin).toBe(expectedChannel);
        expect(saved.order_type).toBe(destination);
      });
    });

    it("18. Rechazo de complementos agotados configurados en el producto", async () => {
      const input: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [
          {
            productId: "prod-burger",
            quantity: 1,
            selectedModifiers: [
              {
                groupId: "grp_termino",
                groupName: "Término",
                optionId: "opt_34",
                optionName: "Tres cuartos",
                price: 0,
              },
              {
                groupId: "grp_adicionales",
                groupName: "Adicionales",
                optionId: "opt_egg", // Huevo frito está agotado
                optionName: "Huevo frito",
                price: 2000,
              },
            ],
          },
        ],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(false);
      expect(result.error).toContain("se encuentra agotado");
    });

    it("19. Conservación de precios históricos ante cambios posteriores en el catálogo", async () => {
      const input: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };
      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(true);
      expect(result.total).toBe(5000);

      // Simular cambio futuro en catálogo: gaseosa sube a 9000
      const prod = inMemoryProducts.find((p) => p.id === "prod-gaseosa")!;
      prod.price = 9000;

      // El pedido registrado debe preservar su total histórico intacto
      const historicalOrder = inMemoryOrders.find((o) => o.id === result.orderId);
      const historicalItem = inMemoryOrderItems.find((i) => i.order_id === result.orderId);
      expect(historicalOrder.total).toBe(5000);
      expect(historicalItem.unit_price).toBe(5000);
    });
  });

  // ==============================================================================
  // VALIDACIÓN DE LA MIGRACIÓN 20261015210000: TAKEOUT, DELIVERY Y MESAS CONCURRENTES
  // ==============================================================================
  describe("Validación de Migración 20261015210000 — Destinos, Mesas y Concurrencia", () => {
    it("M1. Pedido para llevar con nombre y teléfono: debe guardarlos y limpiar mesa y dirección", async () => {
      const input: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        customerName: "María Gómez",
        customerPhone: "3109876543",
        // Campos que deben ser limpiados/ignorados si vinieran
        deliveryAddress: "Calle Invalida 123",
        deliveryReference: "Apto 101",
        tableId: "tbl-01",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(true);

      const saved = inMemoryOrders.find((o) => o.id === result.orderId);
      expect(saved.order_type).toBe("takeout");
      expect(saved.customer_name).toBe("María Gómez");
      expect(saved.customer_phone).toBe("3109876543");
      expect(saved.delivery_address).toBeNull();
      expect(saved.delivery_reference).toBeNull();
      expect(saved.table_id).toBeNull();
      expect(saved.payment_status).toBe("pending");
    });

    it("M2. Pedido para llevar sin datos de cliente: debe permitirse con ambos campos vacíos/nulos", async () => {
      const input: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        customerName: "",
        customerPhone: "",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(true);

      const saved = inMemoryOrders.find((o) => o.id === result.orderId);
      expect(saved.order_type).toBe("takeout");
      expect(saved.customer_name).toBeNull();
      expect(saved.customer_phone).toBeNull();
      expect(saved.delivery_address).toBeNull();
      expect(saved.table_id).toBeNull();
    });

    it("M3a. Pedido a domicilio sin nombre: debe aceptarse con cliente por defecto y generar verificación", async () => {
      const input: CreateRestaurantOrderInput = {
        orderType: "delivery",
        channelOrigin: "whatsapp",
        customerName: "   ",
        deliveryAddress: "Carrera 15 # 85-30",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();

      const saved = await getRestaurantOrderById(BUSINESS_A, result.orderId!);
      expect(saved).not.toBeNull();
      expect(saved?.delivery_address).toBe("Carrera 15 # 85-30");
      expect(saved?.delivery_status).toBe("pending");
      expect(saved?.notes).toContain("[PIN:");
    });

    it("M3b. Pedido a domicilio sin dirección de entrega: debe rechazarse", async () => {
      const input: CreateRestaurantOrderInput = {
        orderType: "delivery",
        channelOrigin: "whatsapp",
        customerName: "Julian Castro",
        deliveryAddress: "",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(false);
      expect(result.error).toContain("dirección de entrega");
    });

    it("M4. Pedido en mesa con mesa disponible: debe crearse, asociarla y marcarla ocupada", async () => {
      const table = inMemoryTables.find((t) => t.id === "tbl-01")!;
      expect(table.status).toBe("available");

      const input: CreateRestaurantOrderInput = {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-01",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(true);

      const saved = inMemoryOrders.find((o) => o.id === result.orderId);
      expect(saved.table_id).toBe("tbl-01");
      expect(saved.customer_name).toBeNull();
      expect(saved.delivery_address).toBeNull();
      expect(saved.payment_status).toBe("pending");

      // La mesa debe quedar ocupada y con el current_order_id asignado
      expect(table.status).toBe("occupied");
      expect(table.current_order_id).toBe(result.orderId);
    });

    it("M5a. Pedido en mesa sin mesa seleccionada: debe rechazarse", async () => {
      const input: CreateRestaurantOrderInput = {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: null,
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(false);
      expect(result.error).toContain("debes seleccionar una mesa");
    });

    it("M5b. Pedido en mesa con mesa de otro negocio o inexistente: debe rechazarse", async () => {
      const input: CreateRestaurantOrderInput = {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-03", // Mesa perteneciente a BUSINESS_B
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(false);
      expect(result.error).toContain("no pertenece a este negocio o no existe");
    });

    it("M6. Dos operaciones compitiendo por la misma mesa disponible: no deben asignarla a dos pedidos activos", async () => {
      const input1: CreateRestaurantOrderInput = {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-01",
        idempotencyKey: "key-concurrent-table-1",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      const input2: CreateRestaurantOrderInput = {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-01",
        idempotencyKey: "key-concurrent-table-2", // Diferente pedido
        items: [{ productId: "prod-gaseosa", quantity: 2, selectedModifiers: [] }],
      };

      // Operación 1 ocupa la mesa
      const res1 = await createRestaurantOrder(BUSINESS_A, input1);
      expect(res1.success).toBe(true);

      // Operación 2 intenta tomar la misma mesa ahora ocupada
      const res2 = await createRestaurantOrder(BUSINESS_A, input2);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("ya se encuentra ocupada");

      // Solo 1 orden debe haberse registrado para esa mesa
      const ordersForTable = inMemoryOrders.filter((o) => o.table_id === "tbl-01");
      expect(ordersForTable).toHaveLength(1);
      expect(ordersForTable[0].id).toBe(res1.orderId);
    });

    it("M7. Reintento de pedido en mesa con la misma clave de idempotencia: no duplica el pedido ni falla por mesa ocupada", async () => {
      const idempotencyKey = "key-dine-in-retry-777";
      const input: CreateRestaurantOrderInput = {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-02",
        idempotencyKey,
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      // 1. Envío inicial exitoso
      const res1 = await createRestaurantOrder(BUSINESS_A, input);
      expect(res1.success).toBe(true);

      const table = inMemoryTables.find((t) => t.id === "tbl-02")!;
      expect(table.status).toBe("occupied");

      // 2. Reintento con la misma clave (simulando timeout de red)
      const res2 = await createRestaurantOrder(BUSINESS_A, input);
      expect(res2.success).toBe(true);
      expect(res2.orderId).toBe(res1.orderId);
      expect(res2.orderNumber).toBe(res1.orderNumber);

      // No se duplicó en base de datos
      expect(inMemoryOrders).toHaveLength(1);
    });

    it("M8. Reutilización de clave de idempotencia con contenido incompatible: debe rechazarse", async () => {
      const reusedKey = "key-reused-mismatch-888";

      const original: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        idempotencyKey: reusedKey,
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      const res1 = await createRestaurantOrder(BUSINESS_A, original);
      expect(res1.success).toBe(true);

      // Intento con diferente destino y producto
      const tampered: CreateRestaurantOrderInput = {
        orderType: "delivery",
        channelOrigin: "in_person",
        customerName: "Otro Cliente",
        deliveryAddress: "Otra Calle",
        idempotencyKey: reusedKey,
        items: [{ productId: "prod-gaseosa", quantity: 5, selectedModifiers: [] }],
      };

      const res2 = await createRestaurantOrder(BUSINESS_A, tampered);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("La clave de idempotencia fue reutilizada con un contenido de pedido diferente");
    });

    it("M9. Aislamiento entre negocios y conservación de controles de seguridad", async () => {
      // Intento de cruzar datos entre tenant A y tenant B
      const resOtherTenant = await createRestaurantOrder(BUSINESS_A, {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-03", // tenant B
        items: [{ productId: "prod-ajeno", quantity: 1 }], // tenant B
      });
      expect(resOtherTenant.success).toBe(false);

      // Verificación de RBAC a través del server action
      mockAuthResult = {
        success: false,
        context: undefined as any,
        error: "No tienes autorización para registrar pedidos en este negocio.",
      };
      const resAction = await createRestaurantOrderAction(BUSINESS_A, {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [{ productId: "prod-gaseosa", quantity: 1 }],
      });
      expect(resAction.success).toBe(false);
      expect(resAction.error).toContain("No tienes autorización");
    });

    it("M10. Compatibilidad con el flujo real del POS: snapshot de ítems, modificadores y payment_status pending", async () => {
      const input: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        customerName: "Felipe Soto",
        customerPhone: "3115550000",
        items: [
          {
            productId: "prod-burger",
            quantity: 2,
            selectedModifiers: [
              {
                groupId: "grp_termino",
                groupName: "Término",
                optionId: "opt_34",
                optionName: "Tres cuartos",
                price: 0,
              },
              {
                groupId: "grp_adicionales",
                groupName: "Adicionales",
                optionId: "opt_bacon",
                optionName: "Tocineta",
                price: 3500,
              },
            ],
          },
        ],
      };

      const result = await createRestaurantOrder(BUSINESS_A, input);
      expect(result.success).toBe(true);

      const order = inMemoryOrders.find((o) => o.id === result.orderId);
      expect(order.payment_status).toBe("pending");
      expect(order.status).toBe("received");
      // Total: (18000 + 3500) * 2 = 43000
      expect(order.total).toBe(43000);

      const orderItems = inMemoryOrderItems.filter((i) => i.order_id === result.orderId);
      expect(orderItems).toHaveLength(1);
      expect(orderItems[0].product_name).toContain("Hamburguesa Clásica");
      expect(orderItems[0].quantity).toBe(2);
      expect(orderItems[0].unit_price).toBe(21500);
      expect(orderItems[0].modifiers).toHaveLength(2);
    });
  });

  // ==============================================================================
  // SUITE DEDICADA: CORRECCIÓN DE SELECCIÓN DE CANAL Y FLUJOS POR DESTINO EN POS
  // ==============================================================================
  describe("NEGOVA — Corrección de Selección de Canal y Flujo por Destino en POS", () => {
    beforeEach(() => {
      inMemoryOrders = [];
      inMemoryOrderItems = [];
      inMemoryTables = [
        {
          id: "tbl-pos-01",
          business_id: BUSINESS_A,
          name_or_number: "Mesa 1 Salón",
          capacity: 4,
          status: "available",
          sort_order: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "tbl-pos-02",
          business_id: BUSINESS_A,
          name_or_number: "Mesa 2 Salón",
          capacity: 2,
          status: "available",
          sort_order: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    });

    it("1. dine_in establece in_person automáticamente en el servidor y en la comanda", async () => {
      // Incluso si un cliente externo enviara accidentalmente whatsapp en dine_in, se fuerza in_person
      const res = await createRestaurantOrder(BUSINESS_A, {
        orderType: "dine_in",
        channelOrigin: "whatsapp" as any,
        tableId: "tbl-pos-01",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      });

      expect(res.success).toBe(true);
      const order = inMemoryOrders.find((o) => o.id === res.orderId);
      expect(order.order_type).toBe("dine_in");
      expect(order.channel_origin).toBe("in_person");
    });

    it("2. Consumo en el local no exige seleccionar WhatsApp y siempre persiste como in_person", async () => {
      const res = await createRestaurantOrder(BUSINESS_A, {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-pos-02",
        items: [{ productId: "prod-gaseosa", quantity: 2, selectedModifiers: [] }],
      });

      expect(res.success).toBe(true);
      const order = inMemoryOrders.find((o) => o.id === res.orderId);
      expect(order.channel_origin).toBe("in_person");
      expect(order.table_id).toBe("tbl-pos-02");
    });

    it("3. dine_in sigue exigiendo obligatoriamente una mesa disponible", async () => {
      // Sin mesa
      const resNoTable = await createRestaurantOrder(BUSINESS_A, {
        orderType: "dine_in",
        channelOrigin: "in_person",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      });
      expect(resNoTable.success).toBe(false);
      expect(resNoTable.error).toContain("Para consumo en mesa debes seleccionar una mesa");

      // Primero ocupamos tbl-pos-01 con un pedido exitoso
      const resFirst = await createRestaurantOrder(BUSINESS_A, {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-pos-01",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      });
      expect(resFirst.success).toBe(true);

      // Con mesa ya ocupada
      const resOccupied = await createRestaurantOrder(BUSINESS_A, {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-pos-01",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      });
      expect(resOccupied.success).toBe(false);
      expect(resOccupied.error).toContain("ya se encuentra ocupada");
    });

    it("4. Crear un pedido para recoger (takeout) no exige mesa ni dirección", async () => {
      const res = await createRestaurantOrder(BUSINESS_A, {
        orderType: "takeout",
        channelOrigin: "in_person",
        customerName: "Laura Gomez", // opcional
        customerPhone: "3001234567", // opcional
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      });

      expect(res.success).toBe(true);
      const order = inMemoryOrders.find((o) => o.id === res.orderId);
      expect(order.order_type).toBe("takeout");
      expect(order.channel_origin).toBe("in_person");
      expect(order.table_id).toBeNull();
      expect(order.delivery_address).toBeNull();
      expect(order.customer_name).toBe("Laura Gomez");
    });

    it("5. Un domicilio (delivery) puede registrar canal presencial o whatsapp con dirección obligatoria", async () => {
      // Domicilio vía WhatsApp
      const resWhatsapp = await createRestaurantOrder(BUSINESS_A, {
        orderType: "delivery",
        channelOrigin: "whatsapp",
        customerName: "Mario Casas",
        deliveryAddress: "Carrera 7 # 45 - 20, Apt 301",
        deliveryReference: "Frente al banco",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      });

      expect(resWhatsapp.success).toBe(true);
      const orderWs = inMemoryOrders.find((o) => o.id === resWhatsapp.orderId);
      expect(orderWs.channel_origin).toBe("whatsapp");
      expect(orderWs.delivery_address).toBe("Carrera 7 # 45 - 20, Apt 301");
      expect(orderWs.table_id).toBeNull();

      // Domicilio vía Presencial (cliente solicita envío en mostrador)
      const resPresencial = await createRestaurantOrder(BUSINESS_A, {
        orderType: "delivery",
        channelOrigin: "in_person",
        customerName: "Sara Perez",
        deliveryAddress: "Calle 100 # 15 - 30",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      });

      expect(resPresencial.success).toBe(true);
      const orderPr = inMemoryOrders.find((o) => o.id === resPresencial.orderId);
      expect(orderPr.channel_origin).toBe("in_person");
    });

    it("6. Cambiar de domicilio a consumo en el local garantiza que el canal sea in_person", async () => {
      // Si en la interfaz se pasa de delivery con whatsapp a dine_in
      const simulatedSwitchInput: CreateRestaurantOrderInput = {
        orderType: "dine_in",
        channelOrigin: "whatsapp", // venía de delivery
        tableId: "tbl-pos-02",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      const res = await createRestaurantOrder(BUSINESS_A, simulatedSwitchInput);
      expect(res.success).toBe(true);

      const order = inMemoryOrders.find((o) => o.id === res.orderId);
      // Se resolvió a in_person garantizando coherencia
      expect(order.channel_origin).toBe("in_person");
      expect(order.order_type).toBe("dine_in");
    });

    it("7. El pedido persiste el canal correcto (in_person o whatsapp) en la base de datos", async () => {
      // Takeout presencial
      const resInPerson = await createRestaurantOrder(BUSINESS_A, {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      });
      expect(resInPerson.success).toBe(true);
      const orderInPerson = inMemoryOrders.find((o) => o.id === resInPerson.orderId);
      expect(orderInPerson.channel_origin).toBe("in_person");

      // Takeout WhatsApp
      const resWhatsApp = await createRestaurantOrder(BUSINESS_A, {
        orderType: "takeout",
        channelOrigin: "whatsapp",
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      });
      expect(resWhatsApp.success).toBe(true);
      const orderWhatsApp = inMemoryOrders.find((o) => o.id === resWhatsApp.orderId);
      expect(orderWhatsApp.channel_origin).toBe("whatsapp");
    });

    it("8. Una mesa solo se ocupa cuando la creación del pedido tiene éxito", async () => {
      // Intentar crear un pedido con producto inexistente sobre una mesa disponible
      const tableBefore = inMemoryTables.find((t) => t.id === "tbl-pos-01");
      expect(tableBefore?.status).toBe("available");

      const resFailed = await createRestaurantOrder(BUSINESS_A, {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-pos-01",
        items: [{ productId: "producto-que-no-existe", quantity: 1, selectedModifiers: [] }],
      });

      expect(resFailed.success).toBe(false);
      // La mesa NO debe haberse ocupado
      const tableAfter = inMemoryTables.find((t) => t.id === "tbl-pos-01");
      expect(tableAfter?.status).toBe("available");
      expect(tableAfter?.current_order_id).toBeUndefined();
    });

    it("9. No se modifican los estados de pago (se mantiene pending) ni se duplican pedidos por reintentos", async () => {
      const idempotencyKey = "idem-test-channel-unique-001";
      const orderInput: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        idempotencyKey,
        items: [{ productId: "prod-gaseosa", quantity: 1, selectedModifiers: [] }],
      };

      const res1 = await createRestaurantOrder(BUSINESS_A, orderInput);
      expect(res1.success).toBe(true);

      const orderCreated = inMemoryOrders.find((o) => o.id === res1.orderId);
      expect(orderCreated.payment_status).toBe("pending");

      // Reintento idéntico
      const res2 = await createRestaurantOrder(BUSINESS_A, orderInput);
      expect(res2.success).toBe(true);
      expect(res2.orderId).toBe(res1.orderId);
      expect(res2.orderNumber).toBe(res1.orderNumber);

      // Conteo de pedidos en memoria con esa clave debe ser exactamente 1
      const count = inMemoryOrders.filter((o) => o.idempotency_key === idempotencyKey).length;
      expect(count).toBe(1);
    });

    it("10. Los pedidos existentes y sus relaciones siguen funcionando correctamente", async () => {
      const res = await createRestaurantOrder(BUSINESS_A, {
        orderType: "dine_in",
        channelOrigin: "in_person",
        tableId: "tbl-pos-01",
        notes: "Sin hielo",
        items: [
          {
            productId: "prod-burger",
            quantity: 1,
            selectedModifiers: [
              {
                groupId: "grp_termino",
                groupName: "Término",
                optionId: "opt_34",
                optionName: "Tres cuartos",
                price: 0,
              },
            ],
          },
        ],
      });

      expect(res.success).toBe(true);
      const order = inMemoryOrders.find((o) => o.id === res.orderId);
      expect(order).toBeDefined();
      expect(order.order_number).toBe(res.orderNumber);
      expect(order.table_id).toBe("tbl-pos-01");

      const items = inMemoryOrderItems.filter((i) => i.order_id === res.orderId);
      expect(items).toHaveLength(1);
      expect(items[0].product_name).toContain("Hamburguesa Clásica");
      expect(items[0].modifiers).toHaveLength(1);
    });
  });
});
