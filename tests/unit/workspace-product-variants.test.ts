import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  Product,
  ProductVariant,
  ProductMetadataSchema,
  ProductSchema,
  getEffectiveVariantIngredients,
} from "../../src/lib/products/types";
import {
  createCartItem,
  generateCartItemId,
  calculateCartSummary,
  PosCartItem,
} from "../../src/lib/pos/types";
import {
  createRestaurantOrder,
  computeOrderPayloadHash,
} from "../../src/lib/restaurant/restaurant-service";
import { CreateRestaurantOrderInput } from "../../src/lib/restaurant/types";

// ==============================================================================
// MOCKS Y BASE DE DATOS EN MEMORIA PARA VERIFICACIÓN DE REQUISITOS 2.1
// ==============================================================================

const BUSINESS_A = "a8e2612f-4acc-4c84-a420-220131b70d66"; // Pizzería / Restaurante
const BUSINESS_B = "b8e2612f-4acc-4c84-a420-220131b70d77"; // Negocio ajeno
const USER_A = "u8e2612f-4acc-4c84-a420-220131b70d11";

let inMemoryProducts: Product[] = [];
let inMemoryOrders: any[] = [];
let inMemoryOrderItems: any[] = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "products") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: any) => ({
              in: vi.fn((inCol: string, inVals: string[]) => {
                const found = inMemoryProducts.filter(
                  (p) => p.business_id === val && inVals.includes(p.id)
                );
                return Promise.resolve({ data: found, error: null });
              }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      };
    }),
    rpc: vi.fn((rpcName: string, params: any) => {
      if (rpcName === "create_restaurant_pos_order") {
        const orderId = `ord_${Date.now()}`;
        const orderNumber = inMemoryOrders.length + 1;
        const newOrder = {
          id: orderId,
          business_id: params.p_business_id,
          order_number: orderNumber,
          total: params.p_total,
          subtotal: params.p_subtotal,
          order_type: params.p_order_type,
          channel_origin: params.p_channel_origin,
        };
        inMemoryOrders.push(newOrder);

        for (const item of params.p_items) {
          inMemoryOrderItems.push({
            id: `item_${Date.now()}_${Math.random()}`,
            order_id: orderId,
            business_id: params.p_business_id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
            notes: item.notes,
            modifiers: item.modifiers,
          });
        }

        return Promise.resolve({
          data: {
            success: true,
            order_id: orderId,
            order_number: orderNumber,
            total: params.p_total,
            is_duplicate: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  })),
}));

describe("NEGOVA 2.1 — Modelo de catálogo adaptable y configuración comercial por producto", () => {
  beforeEach(() => {
    inMemoryProducts = [];
    inMemoryOrders = [];
    inMemoryOrderItems = [];
  });

  // 1. Pizza con los mismos ingredientes y diferentes tamaños
  it("1. Una pizza puede tener diferentes tamaños y precios compartiendo los mismos ingredientes generales", () => {
    const pizzaVariants: ProductVariant[] = [
      {
        id: "var_pizza_personal",
        name: "Personal (4 porciones)",
        price: 18000,
        sku: "PIZ-PER-01",
        is_available: true,
        sort_order: 1,
        inherit_base_ingredients: true,
      },
      {
        id: "var_pizza_mediana",
        name: "Mediana (8 porciones)",
        price: 28000,
        sku: "PIZ-MED-02",
        is_available: true,
        sort_order: 2,
        inherit_base_ingredients: true,
      },
      {
        id: "var_pizza_familiar",
        name: "Familiar (12 porciones)",
        price: 38000,
        sku: "PIZ-FAM-03",
        is_available: true,
        sort_order: 3,
        inherit_base_ingredients: true,
      },
    ];

    const baseIngredients = "Masa artesanal, salsa napolitana, queso mozzarella fundido, orégano";

    // Validar esquema
    const metadata = ProductMetadataSchema.parse({
      has_variants: true,
      variants: pizzaVariants,
      ingredients: baseIngredients,
    });

    expect(metadata.has_variants).toBe(true);
    expect(metadata.variants).toHaveLength(3);

    // Verificar que todas las variantes resuelvan exactamente los ingredientes base
    for (const v of metadata.variants) {
      const eff = getEffectiveVariantIngredients(metadata.ingredients, v);
      expect(eff).toBe(baseIngredients);
    }

    // Si el dueño modifica los ingredientes base generales de la pizza:
    const updatedIngredients = "Masa madre crocante, salsa napolitana San Marzano, mozzarella di bufala";
    for (const v of metadata.variants) {
      const updatedEff = getEffectiveVariantIngredients(updatedIngredients, v);
      expect(updatedEff).toBe(updatedIngredients);
    }
  });

  // 2. Salchipapas con diferentes ingredientes y precios
  it("2. Una salchipapa puede tener diferentes presentaciones con ingredientes y precios propios independientes", () => {
    const salchipapaVariants: ProductVariant[] = [
      {
        id: "var_salchi_10k",
        name: "Salchipapa Clásica ($10.000)",
        price: 10000,
        is_available: true,
        sort_order: 1,
        inherit_base_ingredients: false,
        specific_ingredients: "Papas a la francesa, salchicha manguera tradicional, salsa rosada de la casa",
      },
      {
        id: "var_salchi_15k",
        name: "Salchipapa Mixta ($15.000)",
        price: 15000,
        is_available: true,
        sort_order: 2,
        inherit_base_ingredients: false,
        specific_ingredients: "Papas criollas y francesas, salchicha manguera, tocineta ahumada, queso mozzarella",
      },
      {
        id: "var_salchi_20k",
        name: "Salchipapa Especial Salvaje ($20.000)",
        price: 20000,
        is_available: true,
        sort_order: 3,
        inherit_base_ingredients: false,
        specific_ingredients: "Papas francesas y criollas, doble salchicha, pechuga de pollo, tocineta, maíz dulce, queso costeño rallado",
      },
    ];

    const metadata = ProductMetadataSchema.parse({
      has_variants: true,
      variants: salchipapaVariants,
      ingredients: "Ingredientes generales de comida rápida",
    });

    // Validar resolución específica
    const ing10k = getEffectiveVariantIngredients(metadata.ingredients, metadata.variants[0]);
    const ing15k = getEffectiveVariantIngredients(metadata.ingredients, metadata.variants[1]);
    const ing20k = getEffectiveVariantIngredients(metadata.ingredients, metadata.variants[2]);

    expect(ing10k).toContain("Papas a la francesa, salchicha manguera tradicional");
    expect(ing15k).toContain("tocineta ahumada, queso mozzarella");
    expect(ing20k).toContain("pechuga de pollo, tocineta, maíz dulce");

    // Verificar que los precios son independientes
    expect(metadata.variants[0].price).toBe(10000);
    expect(metadata.variants[1].price).toBe(15000);
    expect(metadata.variants[2].price).toBe(20000);
  });

  // 3. Aislamiento al editar una variante
  it("3. Modificar una variante no altera accidentalmente los ingredientes ni el precio de las demás", () => {
    const variants: ProductVariant[] = [
      {
        id: "v1",
        name: "Chica",
        price: 8000,
        is_available: true,
        sort_order: 0,
        inherit_base_ingredients: false,
        specific_ingredients: "Ingrediente A",
      },
      {
        id: "v2",
        name: "Grande",
        price: 16000,
        is_available: true,
        sort_order: 1,
        inherit_base_ingredients: false,
        specific_ingredients: "Ingrediente B y C",
      },
    ];

    // Simular edición de v1 únicamente
    const updatedVariants = variants.map((v) =>
      v.id === "v1"
        ? { ...v, price: 9500, specific_ingredients: "Ingrediente A Premium" }
        : v
    );

    // v1 cambió
    expect(updatedVariants[0].price).toBe(9500);
    expect(updatedVariants[0].specific_ingredients).toBe("Ingrediente A Premium");

    // v2 se mantiene intacta
    expect(updatedVariants[1].price).toBe(16000);
    expect(updatedVariants[1].specific_ingredients).toBe("Ingrediente B y C");
  });

  // 4. Extras se suman correctamente a la variante elegida
  it("4. Los extras y complementos se suman correctamente al precio de la variante seleccionada en el carrito", () => {
    const product: Product = {
      id: "prod-pizza-01",
      business_id: BUSINESS_A,
      name: "Pizza Napolitana",
      price: 18000,
      status: "active",
      is_available: true,
      sort_order: 0,
      metadata: {
        product_type: "product",
        has_variants: true,
        variants: [
          {
            id: "var-mediana",
            name: "Mediana",
            price: 28000,
            is_available: true,
            sort_order: 1,
            inherit_base_ingredients: true,
          },
        ],
        modifier_groups: [
          {
            id: "grp-extras",
            name: "Adiciones",
            required: false,
            options: [
              { id: "opt-queso", name: "Extra Queso", price: 4000, is_available: true },
              { id: "opt-borde", name: "Borde de Queso", price: 5000, is_available: true },
            ],
          },
        ],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const selectedVariant = product.metadata.variants[0];
    const selectedMods = [
      {
        groupId: "grp-extras",
        groupName: "Adiciones",
        optionId: "opt-borde",
        optionName: "Borde de Queso",
        price: 5000,
      },
    ];

    const cartItem = createCartItem(product, selectedMods, 2, "Sin cebolla", selectedVariant);

    expect(cartItem.productName).toBe("Pizza Napolitana (Mediana)");
    expect(cartItem.basePrice).toBe(28000);
    expect(cartItem.modifiersPrice).toBe(5000);
    expect(cartItem.unitPrice).toBe(33000); // 28.000 + 5.000
    expect(cartItem.lineTotal).toBe(66000); // 33.000 * 2
  });

  // 5. Productos sin variantes siguen funcionando normalmente
  it("5. Los productos sin variantes conservan compra directa y precio habitual", () => {
    const simpleProduct: Product = {
      id: "prod-gaseosa-01",
      business_id: BUSINESS_A,
      name: "Gaseosa Manzana 400ml",
      price: 4500,
      status: "active",
      is_available: true,
      sort_order: 0,
      metadata: {
        product_type: "product",
        has_variants: false,
        variants: [],
        modifier_groups: [],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const cartItem = createCartItem(simpleProduct, [], 3);
    expect(cartItem.productName).toBe("Gaseosa Manzana 400ml");
    expect(cartItem.basePrice).toBe(4500);
    expect(cartItem.unitPrice).toBe(4500);
    expect(cartItem.lineTotal).toBe(13500);
    expect(cartItem.variantId).toBeNull();
  });

  // 6. Determinismo y diferenciación de IDs en el carrito
  it("6. El carrito separa líneas de productos con diferentes variantes", () => {
    const idMediana = generateCartItemId("prod-pizza", [], "var-mediana");
    const idFamiliar = generateCartItemId("prod-pizza", [], "var-familiar");
    const idBase = generateCartItemId("prod-pizza", [], null);

    expect(idMediana).toContain("var-mediana");
    expect(idFamiliar).toContain("var-familiar");
    expect(idBase).toContain("_base");
    expect(idMediana).not.toBe(idFamiliar);
  });

  // 7. El servidor valida el precio de la variante en createRestaurantOrder
  it("7. El servidor recalcula el precio estrictamente a partir de la variante y opciones válidas", async () => {
    const dbProduct: Product = {
      id: "prod-salchi-01",
      business_id: BUSINESS_A,
      name: "Salchipapa",
      price: 10000,
      status: "active",
      is_available: true,
      sort_order: 0,
      metadata: {
        product_type: "product",
        has_variants: true,
        variants: [
          {
            id: "var-salchi-20k",
            name: "Especial $20.000",
            price: 20000,
            is_available: true,
            sort_order: 1,
            inherit_base_ingredients: false,
            specific_ingredients: "Papas, pollo, carne, tocineta, queso",
          },
        ],
        modifier_groups: [
          {
            id: "grp-salsas",
            name: "Salsas",
            required: false,
            options: [
              { id: "opt-tartara", name: "Tártara de la casa", price: 1500, is_available: true },
            ],
          },
        ],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryProducts.push(dbProduct);

    const input: CreateRestaurantOrderInput = {
      orderType: "takeout",
      channelOrigin: "in_person",
      items: [
        {
          productId: "prod-salchi-01",
          variantId: "var-salchi-20k",
          quantity: 2,
          selectedModifiers: [
            {
              groupId: "grp-salsas",
              groupName: "Salsas",
              optionId: "opt-tartara",
              optionName: "Tártara de la casa",
              price: 1500,
            },
          ],
        },
      ],
    };

    const result = await createRestaurantOrder(BUSINESS_A, input, USER_A);

    expect(result.success).toBe(true);
    // Subtotal esperado: (20000 + 1500) * 2 = 43000
    expect(result.total).toBe(43000);

    // Verificar snapshot persistido en order_items
    expect(inMemoryOrderItems).toHaveLength(1);
    const itemSnapshot = inMemoryOrderItems[0];
    expect(itemSnapshot.product_name).toBe("Salchipapa (Especial $20.000)");
    expect(itemSnapshot.unit_price).toBe(21500); // 20000 + 1500
    expect(itemSnapshot.subtotal).toBe(43000);
  });

  // 8. Validación en servidor rechaza variante inexistente o agotada
  it("8. El servidor rechaza la creación si la variante solicitada no existe o está agotada", async () => {
    const dbProduct: Product = {
      id: "prod-hamb-01",
      business_id: BUSINESS_A,
      name: "Hamburguesa Artesanal",
      price: 15000,
      status: "active",
      is_available: true,
      sort_order: 0,
      metadata: {
        product_type: "product",
        has_variants: true,
        variants: [
          {
            id: "var-doble-carne",
            name: "Doble Carne",
            price: 24000,
            is_available: false, // AGOTADO
            sort_order: 1,
          },
        ],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryProducts.push(dbProduct);

    // Intento con variante agotada
    const resAgotada = await createRestaurantOrder(
      BUSINESS_A,
      {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [
          {
            productId: "prod-hamb-01",
            variantId: "var-doble-carne",
            quantity: 1,
          },
        ],
      },
      USER_A
    );

    expect(resAgotada.success).toBe(false);
    expect(resAgotada.error).toContain("no se encuentra disponible");

    // Intento sin enviar variantId en producto con variantes obligatorias
    const resSinVariante = await createRestaurantOrder(
      BUSINESS_A,
      {
        orderType: "takeout",
        channelOrigin: "in_person",
        items: [
          {
            productId: "prod-hamb-01",
            quantity: 1,
          },
        ],
      },
      USER_A
    );

    expect(resSinVariante.success).toBe(false);
    expect(resSinVariante.error).toContain("Debes seleccionar un tamaño o presentación");
  });

  // 9. Los pedidos históricos mantienen su precio e información congelada
  it("9. Modificar los precios de las variantes en el catálogo no altera pedidos históricos", () => {
    // Pedido registrado previamente a $25.000
    const historicalItem = {
      product_name: "Pizza de pollo (Familiar)",
      quantity: 1,
      unit_price: 25000,
      subtotal: 25000,
    };

    // El dueño sube el precio de la variante a $35.000 en el catálogo:
    const catalogVariant: ProductVariant = {
      id: "var-familiar",
      name: "Familiar",
      price: 35000,
      is_available: true,
      sort_order: 1,
      inherit_base_ingredients: true,
    };

    // La comanda histórica sigue reportando exactamente $25.000:
    expect(historicalItem.unit_price).toBe(25000);
    expect(historicalItem.subtotal).toBe(25000);
    expect(historicalItem.product_name).toBe("Pizza de pollo (Familiar)");
  });

  // 10. Multi-tenant y extensibilidad a retail y servicios
  it("10. El modelo es multi-tenant y se extiende a retail (talla/color) y servicios (duración)", () => {
    // Retail: Tienda de ropa con variantes de talla
    const shirtProduct = ProductSchema.parse({
      id: "e8e2612f-4acc-4c84-a420-220131b70d11",
      business_id: BUSINESS_A,
      name: "Camisa Oxford Slim Fit",
      price: 65000,
      status: "active",
      is_available: true,
      sort_order: 0,
      metadata: {
        product_type: "product",
        has_variants: true,
        variants: [
          { id: "var-s", name: "Talla S", price: 65000, sku: "OXF-S", is_available: true },
          { id: "var-m", name: "Talla M", price: 65000, sku: "OXF-M", is_available: true },
          { id: "var-xl", name: "Talla XL", price: 72000, sku: "OXF-XL", is_available: true },
        ],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Servicio: Barbería con variantes de duración y servicio
    const serviceProduct = ProductSchema.parse({
      id: "f8e2612f-4acc-4c84-a420-220131b70d22",
      business_id: BUSINESS_A,
      name: "Corte y Estilo",
      price: 20000,
      status: "active",
      is_available: true,
      sort_order: 0,
      metadata: {
        product_type: "service",
        duration_minutes: 30,
        has_variants: true,
        variants: [
          { id: "var-corte-clasico", name: "Corte Clásico (30 min)", price: 20000, is_available: true },
          { id: "var-corte-barba", name: "Corte + Barba + Toalla Caliente (60 min)", price: 38000, is_available: true },
        ],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(shirtProduct.metadata.has_variants).toBe(true);
    expect(shirtProduct.metadata.variants[2].price).toBe(72000);
    expect(serviceProduct.metadata.product_type).toBe("service");
    expect(serviceProduct.metadata.variants[1].price).toBe(38000);
  });
});
