import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createRestaurantOrder } from "../../src/lib/restaurant/restaurant-service";
import { deductRecipeIngredientsForSale } from "../../src/lib/recipes/recipe-service";

// ==============================================================================
// TEST SUITE: [REC-003] Descuento de ingredientes al vender en NEGOVA
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const LOCATION_A = "aaaaaaaa-1111-4aaa-aaaa-111111111111";

// IDs de Productos y Recetas
const PROD_PANCAKE = "bbbbbbbb-1111-4aaa-aaaa-111111111111";
const PROD_COFFEE = "cccccccc-1111-4aaa-aaaa-111111111111"; // Producto sin receta (stock directo)
const RECIPE_PANCAKE = "dddddddd-4aaa-aaaa-aaaa-111111111111";

// Ingredientes
const ING_HARINA = "eeeeeeee-4aaa-aaaa-aaaa-111111111111";
const ING_HUEVOS = "ffffffff-4aaa-aaaa-aaaa-111111111111";
const ING_MIEL_OPC = "11112222-4aaa-aaaa-aaaa-111111111111"; // Opcional

let inMemoryProducts: any[] = [];
let inMemoryRecipes: any[] = [];
let inMemoryRecipeIngredients: any[] = [];
let inMemoryInventoryStock: any[] = [];
let inMemoryInventoryMovements: any[] = [];
let inMemoryOrders: any[] = [];
let inMemoryOrderItems: any[] = [];
let inMemoryTables: any[] = [];

/**
 * Emulador fidedigno de la RPC PostgreSQL `create_restaurant_pos_order` actualizada en REC-003.
 * Garantiza atomicidad y rollback transaccional idéntico al motor PL/pgSQL.
 */
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
    p_notes,
    p_idempotency_key,
    p_user_id,
  } = params;

  // Snapshot previo para rollback transaccional (All-or-Nothing)
  const snapProducts = JSON.parse(JSON.stringify(inMemoryProducts));
  const snapStock = JSON.parse(JSON.stringify(inMemoryInventoryStock));
  const snapMovements = JSON.parse(JSON.stringify(inMemoryInventoryMovements));
  const snapOrders = JSON.parse(JSON.stringify(inMemoryOrders));
  const snapOrderItems = JSON.parse(JSON.stringify(inMemoryOrderItems));

  try {
    // 1. Numeración correlativa
    const orderNumber = inMemoryOrders.length + 1;
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // =========================================================================
    // FASE 1: VALIDACIÓN DE EXISTENCIAS (TODO O NADA)
    // =========================================================================
    for (const item of p_items) {
      const recipe = inMemoryRecipes.find(
        (r) =>
          r.product_id === item.product_id &&
          r.business_id === p_business_id &&
          r.status === "active"
      );

      if (recipe) {
        const portions = Math.max(1, Number(recipe.portions) || 1);
        const ings = inMemoryRecipeIngredients.filter(
          (ri) => ri.recipe_id === recipe.id
        );

        for (const ri of ings) {
          // Regla: Ingredientes opcionales NO bloquean la venta ni se descuentan automáticamente
          if (ri.is_optional) {
            continue;
          }

          const requiredQty = (item.quantity * Number(ri.quantity)) / portions;

          const stockRow = inMemoryInventoryStock.find(
            (s) =>
              s.product_id === ri.ingredient_id &&
              s.business_id === p_business_id
          );
          const availQty = Number(stockRow?.quantity ?? 0);

          if (availQty < requiredQty) {
            const ingProd = inMemoryProducts.find((p) => p.id === ri.ingredient_id);
            const ingName = ingProd?.name || "Ingrediente";

            const dispAvail = availQty === 0 ? "0" : String(parseFloat(availQty.toFixed(4)));
            const dispReq = requiredQty === 0 ? "0" : String(parseFloat(requiredQty.toFixed(4)));

            throw new Error(
              `Existencias insuficientes para «${ingName}». Disponibles: ${dispAvail} ${ri.unit}, requeridas: ${dispReq} ${ri.unit}`
            );
          }
        }
      }
    }

    // 2. Creación de la orden si pasó validación
    const newOrder = {
      id: orderId,
      business_id: p_business_id,
      order_number: orderNumber,
      order_type: p_order_type,
      channel_origin: p_channel_origin,
      subtotal: p_subtotal,
      delivery_fee: p_delivery_fee,
      total: p_total,
      status: "received",
      payment_status: "pending",
      notes: p_notes,
      idempotency_key: p_idempotency_key,
      created_by: p_user_id,
      created_at: new Date().toISOString(),
    };
    inMemoryOrders.push(newOrder);

    // =========================================================================
    // FASE 2: DEDUCCIÓN DE STOCK Y REGISTRO EN KARDEX
    // =========================================================================
    for (const item of p_items) {
      inMemoryOrderItems.push({
        id: `item_${Math.random().toString(36).substring(2, 6)}`,
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      });

      const recipe = inMemoryRecipes.find(
        (r) =>
          r.product_id === item.product_id &&
          r.business_id === p_business_id &&
          r.status === "active"
      );

      if (recipe) {
        // CASO 1: Producto CON receta -> descontar ingredientes obligatorios
        const portions = Math.max(1, Number(recipe.portions) || 1);
        const ings = inMemoryRecipeIngredients.filter(
          (ri) => ri.recipe_id === recipe.id
        );

        for (const ri of ings) {
          // Ingredientes opcionales NO se descuentan automáticamente
          if (ri.is_optional) {
            continue;
          }

          const deductionQty = (item.quantity * Number(ri.quantity)) / portions;

          // Descontar en inventory_stock
          const stockRow = inMemoryInventoryStock.find(
            (s) =>
              s.product_id === ri.ingredient_id &&
              s.business_id === p_business_id
          );
          if (stockRow) {
            stockRow.quantity = Number(stockRow.quantity || 0) - deductionQty;
          }

          // Descontar en metadata consolidado
          const ingProd = inMemoryProducts.find((p) => p.id === ri.ingredient_id);
          if (ingProd && ingProd.metadata) {
            const currentMetaStock = Number(ingProd.metadata.stock_quantity || 0);
            ingProd.metadata.stock_quantity = Math.max(0, currentMetaStock - deductionQty);
          }

          // Registrar en Kardex (inventory_movements)
          inMemoryInventoryMovements.push({
            id: `mov_${Math.random().toString(36).substring(2, 6)}`,
            business_id: p_business_id,
            product_id: ri.ingredient_id,
            location_id: LOCATION_A,
            movement_type: "sale",
            quantity: deductionQty,
            reference_id: orderId,
            reference_type: "sale",
            notes: `Descuento por receta de ${item.product_name} (pedido #${orderNumber})`,
            created_at: new Date().toISOString(),
          });
        }
      } else {
        // CASO 2: Producto SIN receta -> Descontar stock directo del producto (STOCK-001)
        const prod = inMemoryProducts.find(
          (p) => p.id === item.product_id && p.business_id === p_business_id
        );
        if (prod && prod.metadata?.track_stock) {
          const currentMetaStock = Number(prod.metadata.stock_quantity || 0);
          prod.metadata.stock_quantity = Math.max(0, currentMetaStock - item.quantity);

          const stockRow = inMemoryInventoryStock.find(
            (s) =>
              s.product_id === item.product_id &&
              s.business_id === p_business_id
          );
          if (stockRow) {
            stockRow.quantity = Math.max(0, Number(stockRow.quantity || 0) - item.quantity);
          }

          inMemoryInventoryMovements.push({
            id: `mov_${Math.random().toString(36).substring(2, 6)}`,
            business_id: p_business_id,
            product_id: item.product_id,
            location_id: LOCATION_A,
            movement_type: "sale",
            quantity: item.quantity,
            reference_id: orderId,
            reference_type: "sale",
            notes: `Descuento automático por pedido #${orderNumber}`,
            created_at: new Date().toISOString(),
          });
        }
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
    // Rollback atómico estricto
    inMemoryProducts = snapProducts;
    inMemoryInventoryStock = snapStock;
    inMemoryInventoryMovements = snapMovements;
    inMemoryOrders = snapOrders;
    inMemoryOrderItems = snapOrderItems;

    return {
      data: null,
      error: err,
    };
  }
}

// Configuración de mocks de Supabase
const mockSupabaseClient: any = {
  rpc: vi.fn(async (fnName: string, params: any) => {
    if (fnName === "create_restaurant_pos_order") {
      return executePosOrderRpc(params);
    }
    return { data: null, error: new Error(`Unknown RPC ${fnName}`) };
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

    if (tableName === "recipes") {
      return {
        select: () => ({
          eq: (col: string, val: any) => ({
            in: (col2: string, vals: any[]) => ({
              eq: (col3: string, val3: any) => ({
                then: (resolve: any) =>
                  resolve({
                    data: inMemoryRecipes.filter(
                      (r) => r[col] === val && vals.includes(r[col2]) && r[col3] === val3
                    ),
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      };
    }

    if (tableName === "recipe_ingredients") {
      return {
        select: () => ({
          in: (col: string, vals: any[]) => ({
            order: () => ({
              then: (resolve: any) => {
                const list = inMemoryRecipeIngredients
                  .filter((ri) => vals.includes(ri[col]))
                  .map((ri) => ({
                    ...ri,
                    products: inMemoryProducts.find((p) => p.id === ri.ingredient_id) || null,
                  }));
                return resolve({ data: list, error: null });
              },
            }),
          }),
        }),
      };
    }

    if (tableName === "inventory_stock") {
      return {
        select: () => ({
          eq: (col: string, val: any) => ({
            in: (col2: string, vals: any[]) => ({
              then: (resolve: any) =>
                resolve({
                  data: inMemoryInventoryStock.filter(
                    (s) => s[col] === val && vals.includes(s[col2])
                  ),
                  error: null,
                }),
            }),
          }),
        }),
      };
    }

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

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock("@/lib/inventory/inventory-service", async () => {
  const actual = await vi.importActual<any>("@/lib/inventory/inventory-service");
  return {
    ...actual,
    ensureDefaultLocation: vi.fn(async () => ({
      id: LOCATION_A,
      name: "Cocina Principal",
      type: "point_of_sale",
    })),
    recordInventoryMovement: vi.fn(
      async (bId: string, movement: any, userId?: string) => {
        // Descontar en stock
        const stockRow = inMemoryInventoryStock.find(
          (s) => s.product_id === movement.productId && s.location_id === movement.locationId
        );
        if (stockRow) {
          stockRow.quantity -= movement.quantity;
        }

        // Registrar en movimientos
        inMemoryInventoryMovements.push({
          id: `mov_${Math.random().toString(36).substring(2, 6)}`,
          business_id: bId,
          product_id: movement.productId,
          location_id: movement.locationId,
          movement_type: movement.movementType,
          quantity: movement.quantity,
          reference_id: movement.referenceId,
          reference_type: movement.referenceType,
          notes: movement.notes,
          created_at: new Date().toISOString(),
        });
      }
    ),
  };
});

describe("[REC-003] Descuento de ingredientes al vender en RPC PostgreSQL", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 1. Productos
    inMemoryProducts = [
      {
        id: PROD_PANCAKE,
        business_id: BUSINESS_A,
        name: "Pancake Clásico",
        price: 15000,
        is_available: true,
        status: "active",
        metadata: { track_stock: false },
      },
      {
        id: PROD_COFFEE,
        business_id: BUSINESS_A,
        name: "Café Americano",
        price: 5000,
        is_available: true,
        status: "active",
        metadata: { track_stock: true, stock_quantity: 10 },
      },
      {
        id: ING_HARINA,
        business_id: BUSINESS_A,
        name: "Harina de Trigo",
        is_available: true,
        status: "active",
        metadata: { cost: 3000, unit: "kg", stock_quantity: 5 },
      },
      {
        id: ING_HUEVOS,
        business_id: BUSINESS_A,
        name: "Huevos AA",
        is_available: true,
        status: "active",
        metadata: { cost: 600, unit: "unidad", stock_quantity: 30 },
      },
      {
        id: ING_MIEL_OPC,
        business_id: BUSINESS_A,
        name: "Miel de Maple (Opcional)",
        is_available: true,
        status: "active",
        metadata: { cost: 1000, unit: "porcion", stock_quantity: 0 }, // Sin stock
      },
    ];

    // 2. Receta de Pancake Clásico:
    // Rinde: 1 porción
    // Ingredientes: 0.5kg Harina + 2 Huevos + 1 porción Miel (Opcional)
    inMemoryRecipes = [
      {
        id: RECIPE_PANCAKE,
        business_id: BUSINESS_A,
        product_id: PROD_PANCAKE,
        name: "Receta Pancake",
        portions: 1,
        location_id: LOCATION_A,
        status: "active",
      },
    ];

    inMemoryRecipeIngredients = [
      {
        id: "ri-1",
        recipe_id: RECIPE_PANCAKE,
        ingredient_id: ING_HARINA,
        quantity: 0.5,
        unit: "kg",
        is_optional: false,
      },
      {
        id: "ri-2",
        recipe_id: RECIPE_PANCAKE,
        ingredient_id: ING_HUEVOS,
        quantity: 2,
        unit: "unidad",
        is_optional: false,
      },
      {
        id: "ri-3",
        recipe_id: RECIPE_PANCAKE,
        ingredient_id: ING_MIEL_OPC,
        quantity: 1,
        unit: "porcion",
        is_optional: true, // OPCIONAL
      },
    ];

    // 3. Stock en almacén / cocina
    inMemoryInventoryStock = [
      {
        id: "stk-harina",
        business_id: BUSINESS_A,
        product_id: ING_HARINA,
        location_id: LOCATION_A,
        quantity: 5, // 5 kg
        cost: 3000,
      },
      {
        id: "stk-huevos",
        business_id: BUSINESS_A,
        product_id: ING_HUEVOS,
        location_id: LOCATION_A,
        quantity: 30, // 30 huevos
        cost: 600,
      },
      {
        id: "stk-miel",
        business_id: BUSINESS_A,
        product_id: ING_MIEL_OPC,
        location_id: LOCATION_A,
        quantity: 0, // 0 miel disponible
        cost: 1000,
      },
      {
        id: "stk-coffee",
        business_id: BUSINESS_A,
        product_id: PROD_COFFEE,
        location_id: LOCATION_A,
        quantity: 10,
        cost: 1500,
      },
    ];

    inMemoryInventoryMovements = [];
    inMemoryOrders = [];
    inMemoryOrderItems = [];
  });

  it("verifica que el archivo de migración SQL para REC-003 exista y contenga la lógica de recetas", () => {
    const migrationPath = join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261030060000_recipe_ingredients_sale_deduction.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sqlContent = readFileSync(migrationPath, "utf-8");
    expect(sqlContent).toContain("create_restaurant_pos_order");
    expect(sqlContent).toContain("public.recipes");
    expect(sqlContent).toContain("public.recipe_ingredients");
    expect(sqlContent).toContain("Existencias insuficientes para «%»");
    expect(sqlContent).toContain("is_optional IS TRUE THEN");
  });

  it("Criterio de Aceptación 1: Al vender 2 unidades con receta (1 porción, 0.5kg harina + 2 huevos), descuenta 1kg harina y 4 huevos, creando 2 movimientos", async () => {
    const orderInput: any = {
      orderType: "takeout",
      items: [
        {
          productId: PROD_PANCAKE,
          productName: "Pancake Clásico",
          quantity: 2, // Vender 2 unidades
          unitPrice: 15000,
          subtotal: 30000,
        },
      ],
      customerName: "Carlos Pérez",
      customerPhone: "3001234567",
    };

    const result = await createRestaurantOrder(BUSINESS_A, orderInput, "usr-1");

    expect(result.success).toBe(true);
    expect(result.orderId).toBeDefined();

    // Verificación de stock de Harina: 5kg iniciales - (2 * 0.5kg) = 4kg
    const stockHarina = inMemoryInventoryStock.find((s) => s.product_id === ING_HARINA);
    expect(stockHarina.quantity).toBe(4);

    // Verificación de stock de Huevos: 30 iniciales - (2 * 2 huevos) = 26
    const stockHuevos = inMemoryInventoryStock.find((s) => s.product_id === ING_HUEVOS);
    expect(stockHuevos.quantity).toBe(26);

    // Verificación de movimientos Kardex: exactamente 2 movimientos creados
    expect(inMemoryInventoryMovements.length).toBe(2);

    const movHarina = inMemoryInventoryMovements.find((m) => m.product_id === ING_HARINA);
    expect(movHarina).toBeDefined();
    expect(movHarina.quantity).toBe(1); // 1kg
    expect(movHarina.movement_type).toBe("sale");

    const movHuevos = inMemoryInventoryMovements.find((m) => m.product_id === ING_HUEVOS);
    expect(movHuevos).toBeDefined();
    expect(movHuevos.quantity).toBe(4); // 4 huevos
    expect(movHuevos.movement_type).toBe("sale");
  });

  it("Criterio de Aceptación 2: Si la harina solo tiene 0.3kg y se requieren 1kg, la venta se rechaza con mensaje exacto y rollback atómico", async () => {
    // Configurar Harina con solo 0.3 kg
    const stockHarina = inMemoryInventoryStock.find((s) => s.product_id === ING_HARINA);
    stockHarina.quantity = 0.3;

    const orderInput: any = {
      orderType: "takeout",
      items: [
        {
          productId: PROD_PANCAKE,
          productName: "Pancake Clásico",
          quantity: 2, // Requiere 2 * 0.5kg = 1kg de harina
          unitPrice: 15000,
          subtotal: 30000,
        },
      ],
      customerName: "Carlos Pérez",
      customerPhone: "3001234567",
    };

    const result = await createRestaurantOrder(BUSINESS_A, orderInput, "usr-1");

    // Debe fallar
    expect(result.success).toBe(false);
    expect(result.error).toContain(
      "Existencias insuficientes para «Harina de Trigo». Disponibles: 0.3 kg, requeridas: 1 kg"
    );

    // Rollback atómico: No se creó orden
    expect(inMemoryOrders.length).toBe(0);
    expect(inMemoryOrderItems.length).toBe(0);

    // No se alteró el stock de ningún ingrediente
    expect(stockHarina.quantity).toBe(0.3);
    const stockHuevos = inMemoryInventoryStock.find((s) => s.product_id === ING_HUEVOS);
    expect(stockHuevos.quantity).toBe(30);

    // No se generaron movimientos de inventario
    expect(inMemoryInventoryMovements.length).toBe(0);
  });

  it("Criterio de Aceptación 3: Si la receta tiene un ingrediente opcional sin stock (Miel), la venta se permite y el opcional no se descuenta", async () => {
    // Miel de Maple tiene stock 0
    const stockMiel = inMemoryInventoryStock.find((s) => s.product_id === ING_MIEL_OPC);
    expect(stockMiel.quantity).toBe(0);

    const orderInput: any = {
      orderType: "takeout",
      items: [
        {
          productId: PROD_PANCAKE,
          productName: "Pancake Clásico",
          quantity: 2,
          unitPrice: 15000,
          subtotal: 30000,
        },
      ],
      customerName: "Ana Gómez",
      customerPhone: "3001234567",
    };

    const result = await createRestaurantOrder(BUSINESS_A, orderInput, "usr-1");

    // Venta permitida con éxito
    expect(result.success).toBe(true);

    // Miel no se descontó ni bajó a negativo
    expect(stockMiel.quantity).toBe(0);

    // Harina y Huevos sí se descontaron
    const stockHarina = inMemoryInventoryStock.find((s) => s.product_id === ING_HARINA);
    expect(stockHarina.quantity).toBe(4); // 5 - 1 = 4kg
    const stockHuevos = inMemoryInventoryStock.find((s) => s.product_id === ING_HUEVOS);
    expect(stockHuevos.quantity).toBe(26); // 30 - 4 = 26

    // Solo se crearon movimientos para harina y huevos (ninguno para miel)
    expect(inMemoryInventoryMovements.length).toBe(2);
    expect(inMemoryInventoryMovements.some((m) => m.product_id === ING_MIEL_OPC)).toBe(false);
  });

  it("Regla de Negocio: Si el producto NO tiene receta activa, se descuenta el stock del producto directamente (STOCK-001)", async () => {
    // Café Americano no tiene receta activa y tiene track_stock = true con stock inicial = 10
    const stockCoffee = inMemoryInventoryStock.find((s) => s.product_id === PROD_COFFEE);
    expect(stockCoffee.quantity).toBe(10);

    const orderInput: any = {
      orderType: "takeout",
      items: [
        {
          productId: PROD_COFFEE,
          productName: "Café Americano",
          quantity: 3, // Venta de 3 cafés
          unitPrice: 5000,
          subtotal: 15000,
        },
      ],
      customerName: "Juan Valdez",
      customerPhone: "3001234567",
    };

    const result = await createRestaurantOrder(BUSINESS_A, orderInput, "usr-1");

    expect(result.success).toBe(true);

    // Stock de café descontado directamente a 7
    expect(stockCoffee.quantity).toBe(7);

    // Se registró 1 movimiento directo para el café
    expect(inMemoryInventoryMovements.length).toBe(1);
    expect(inMemoryInventoryMovements[0].product_id).toBe(PROD_COFFEE);
    expect(inMemoryInventoryMovements[0].quantity).toBe(3);
  });

  it("función deductRecipeIngredientsForSale valida y descuenta stock proporcionalmente", async () => {
    const saleItems = [
      {
        productId: PROD_PANCAKE,
        productName: "Pancake Clásico",
        quantity: 2,
      },
    ];

    const result = await deductRecipeIngredientsForSale(
      BUSINESS_A,
      saleItems,
      "ref-order-123",
      101,
      "usr-1"
    );

    expect(result.success).toBe(true);
    expect(result.deductedIngredients.length).toBe(2); // Harina y Huevos (Miel opcional excluida)

    const harinaDed = result.deductedIngredients.find((d) => d.ingredientId === ING_HARINA);
    expect(harinaDed?.quantityDeducted).toBe(1);

    const huevosDed = result.deductedIngredients.find((d) => d.ingredientId === ING_HUEVOS);
    expect(huevosDed?.quantityDeducted).toBe(4);
  });

  it("función deductRecipeIngredientsForSale rechaza si falta stock con mensaje detallado", async () => {
    // Reducir harina a 0.5kg e intentar vender 2 pancakes (requiere 1kg)
    const stockHarina = inMemoryInventoryStock.find((s) => s.product_id === ING_HARINA);
    stockHarina.quantity = 0.5;

    const saleItems = [
      {
        productId: PROD_PANCAKE,
        productName: "Pancake Clásico",
        quantity: 2,
      },
    ];

    await expect(
      deductRecipeIngredientsForSale(BUSINESS_A, saleItems, "ref-order-456", 102, "usr-1")
    ).rejects.toThrow(
      "Existencias insuficientes para «Harina de Trigo». Disponibles: 0.5 kg, requeridas: 1 kg"
    );
  });
});
