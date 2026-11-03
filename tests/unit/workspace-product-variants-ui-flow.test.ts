import { describe, it, expect, vi } from "vitest";
import {
  ProductVariantSchema,
  ProductMetadataSchema,
  Product,
  ProductVariant,
} from "@/lib/products/types";
import {
  createCartItem,
  calculateCartSummary,
  PosCartItem,
  PosSelectedModifier,
} from "@/lib/pos/types";
import {
  RestaurantOrderItemSchema,
  CreateRestaurantOrderInput,
} from "@/lib/restaurant/types";
import { createRestaurantOrder } from "@/lib/restaurant/restaurant-service";

describe("CAT-002: Gestión de Variantes y Flujo POS / restaurant_order_items", () => {
  const dummyBusinessId = "b1111111-1111-1111-1111-111111111111";

  describe("1. Formulario de Producto: Creación, Edición y Validación de Variantes", () => {
    it("valida y serializa variantes correctamente con nombre, precio, SKU y disponibilidad", () => {
      const variant1: ProductVariant = {
        id: "var_1",
        name: "Personal",
        price: 15000,
        sku: "BUR-PERS-01",
        is_available: true,
        sort_order: 0,
        inherit_base_ingredients: true,
      };

      const variant2: ProductVariant = {
        id: "var_2",
        name: "Familiar",
        price: 28000,
        sku: "BUR-FAM-02",
        is_available: false,
        sort_order: 1,
        inherit_base_ingredients: false,
        specific_ingredients: "Doble carne, triple queso, papas familiares",
      };

      const parsedVariant1 = ProductVariantSchema.parse(variant1);
      expect(parsedVariant1.name).toBe("Personal");
      expect(parsedVariant1.price).toBe(15000);
      expect(parsedVariant1.sku).toBe("BUR-PERS-01");
      expect(parsedVariant1.is_available).toBe(true);

      const parsedVariant2 = ProductVariantSchema.parse(variant2);
      expect(parsedVariant2.name).toBe("Familiar");
      expect(parsedVariant2.price).toBe(28000);
      expect(parsedVariant2.sku).toBe("BUR-FAM-02");
      expect(parsedVariant2.is_available).toBe(false);

      const metadata = ProductMetadataSchema.parse({
        product_type: "product",
        has_variants: true,
        variants: [parsedVariant1, parsedVariant2],
      });

      expect(metadata.has_variants).toBe(true);
      expect(metadata.variants).toHaveLength(2);
      expect(metadata.variants[0].sku).toBe("BUR-PERS-01");
      expect(metadata.variants[1].sku).toBe("BUR-FAM-02");
    });

    it("rechaza variantes con nombre vacío o precio negativo", () => {
      expect(() => {
        ProductVariantSchema.parse({
          id: "var_invalid_1",
          name: "",
          price: 10000,
          is_available: true,
        });
      }).toThrow();

      expect(() => {
        ProductVariantSchema.parse({
          id: "var_invalid_2",
          name: "Válido",
          price: -500,
          is_available: true,
        });
      }).toThrow();
    });

    it("permite eliminar y modificar variantes en la lista reactiva", () => {
      let variants: ProductVariant[] = [
        { id: "v1", name: "Pequeña", price: 8000, is_available: true },
        { id: "v2", name: "Mediana", price: 12000, is_available: true },
        { id: "v3", name: "Grande", price: 16000, is_available: true },
      ];

      // Modificar variante
      variants = variants.map((v) => (v.id === "v2" ? { ...v, price: 13000, sku: "MED-01" } : v));
      expect(variants.find((v) => v.id === "v2")?.price).toBe(13000);
      expect(variants.find((v) => v.id === "v2")?.sku).toBe("MED-01");

      // Eliminar variante
      variants = variants.filter((v) => v.id !== "v1");
      expect(variants).toHaveLength(2);
      expect(variants.some((v) => v.id === "v1")).toBe(false);
    });
  });

  describe("2. Selección de Variante en POS y Construcción del Carrito", () => {
    const productWithVariants: Product = {
      id: "p1111111-1111-1111-1111-111111111111",
      business_id: dummyBusinessId,
      name: "Pizza Artesanal",
      description: "Deliciosa pizza en horno de leña",
      price: 20000,
      category_id: null,
      is_available: true,
      status: "active",
      sort_order: 1,
      image_url: null,
      metadata: {
        has_variants: true,
        variants: [
          { id: "var_personal", name: "Personal (4 porciones)", price: 18000, is_available: true },
          { id: "var_mediana", name: "Mediana (8 porciones)", price: 28000, is_available: true },
          { id: "var_familiar", name: "Familiar (12 porciones)", price: 38000, is_available: false },
        ],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("construye un ítem de carrito con nombre compuesto y precio de la variante seleccionada", () => {
      const selectedVariant = (productWithVariants.metadata as any).variants[1]; // Mediana
      const cartItem = createCartItem(productWithVariants, [], 2, "Bien tostada", selectedVariant);

      expect(cartItem.productId).toBe(productWithVariants.id);
      expect(cartItem.variantId).toBe("var_mediana");
      expect(cartItem.variantName).toBe("Mediana (8 porciones)");
      expect(cartItem.productName).toBe("Pizza Artesanal (Mediana (8 porciones))");
      expect(cartItem.unitPrice).toBe(28000);
      expect(cartItem.quantity).toBe(2);
      expect(cartItem.lineTotal).toBe(56000);
      expect(cartItem.notes).toBe("Bien tostada");
    });

    it("separa líneas de carrito cuando se agregan diferentes variantes del mismo producto", () => {
      const varPersonal = (productWithVariants.metadata as any).variants[0];
      const varMediana = (productWithVariants.metadata as any).variants[1];

      const item1 = createCartItem(productWithVariants, [], 1, undefined, varPersonal);
      const item2 = createCartItem(productWithVariants, [], 1, undefined, varMediana);

      expect(item1.id).not.toBe(item2.id);
      expect(item1.variantId).toBe("var_personal");
      expect(item2.variantId).toBe("var_mediana");
      expect(item1.unitPrice).toBe(18000);
      expect(item2.unitPrice).toBe(28000);

      const summary = calculateCartSummary([item1, item2]);
      expect(summary.itemsCount).toBe(2);
      expect(summary.total).toBe(46000);
    });

    it("detecta que un producto tiene variantes para exigir la apertura del modal en POS", () => {
      const rawVariants = Array.isArray((productWithVariants.metadata as any)?.variants)
        ? (productWithVariants.metadata as any).variants
        : [];
      const hasVariants = Boolean(
        ((productWithVariants.metadata as any)?.has_variants || rawVariants.length > 0) &&
        rawVariants.length > 0
      );

      expect(hasVariants).toBe(true);

      const productWithoutVariants: Product = {
        ...productWithVariants,
        id: "p2222222-2222-2222-2222-222222222222",
        metadata: { has_variants: false, variants: [] },
      };

      const rawVariants2 = (productWithoutVariants.metadata as any)?.variants || [];
      const hasVariants2 = Boolean(
        ((productWithoutVariants.metadata as any)?.has_variants || rawVariants2.length > 0) &&
        rawVariants2.length > 0
      );

      expect(hasVariants2).toBe(false);
    });
  });

  describe("3. Persistencia de Variante en restaurant_order_items y RPC", () => {
    it("el esquema RestaurantOrderItemSchema acepta y valida variant_id y variant_name", () => {
      const orderItemData = {
        id: "11111111-1111-4111-8111-111111111111",
        business_id: "22222222-2222-4222-8222-222222222222",
        order_id: "33333333-3333-4333-8333-333333333333",
        product_id: "44444444-4444-4444-8444-444444444444",
        product_name: "Pizza Artesanal (Mediana (8 porciones))",
        variant_id: "var_mediana",
        variant_name: "Mediana (8 porciones)",
        quantity: 2,
        unit_price: 28000,
        subtotal: 56000,
        notes: "Sin orégano",
        modifiers: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const parsed = RestaurantOrderItemSchema.parse(orderItemData);
      expect(parsed.variant_id).toBe("var_mediana");
      expect(parsed.variant_name).toBe("Mediana (8 porciones)");
      expect(parsed.unit_price).toBe(28000);
      expect(parsed.subtotal).toBe(56000);
    });

    it("createRestaurantOrder valida la variante obligatoria y la transmite a la RPC", async () => {
      const dummyProduct: Product = {
        id: "55555555-5555-4555-8555-555555555555",
        business_id: dummyBusinessId,
        name: "Combo Hamburguesa",
        price: 20000,
        category_id: null,
        is_available: true,
        status: "active",
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          has_variants: true,
          variants: [
            { id: "v_simple", name: "Sencilla", price: 18000, is_available: true },
            { id: "v_doble", name: "Doble Carne", price: 24000, is_available: true },
          ],
        },
      };

      // Mock de Supabase Client para probar el flujo de createRestaurantOrder
      let passedRpcParams: any = null;

      const mockSupabase: any = {
        from: vi.fn((table: string) => {
          if (table === "products") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({
                data: [dummyProduct],
                error: null,
              }),
            };
          }
          if (table === "businesses") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { settings: {} },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
        rpc: vi.fn(async (funcName: string, params: any) => {
          passedRpcParams = params;
          return {
            data: {
              success: true,
              order_id: "o9999999-9999-9999-9999-999999999999",
              order_number: 42,
              total: 24000,
              is_duplicate: false,
            },
            error: null,
          };
        }),
      };

      // Intentar ordenar producto con variantes sin especificar variantId -> debe rechazar
      const invalidInput: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        customerName: "Carlos Pérez",
        items: [
          {
            productId: dummyProduct.id,
            // variantId omitido a propósito
            quantity: 1,
          },
        ],
      };

      const failResult = await createRestaurantOrder(dummyBusinessId, invalidInput, undefined, mockSupabase);
      expect(failResult.success).toBe(false);
      expect(failResult.error).toContain("Debes seleccionar un tamaño o presentación");

      // Ordenar con variante válida seleccionada -> debe proceder y transmitir variant_id a la RPC
      const validInput: CreateRestaurantOrderInput = {
        orderType: "takeout",
        channelOrigin: "in_person",
        customerName: "Carlos Pérez",
        items: [
          {
            productId: dummyProduct.id,
            variantId: "v_doble",
            variantName: "Doble Carne",
            quantity: 1,
          },
        ],
      };

      const okResult = await createRestaurantOrder(dummyBusinessId, validInput, undefined, mockSupabase);
      expect(okResult.success).toBe(true);
      expect(okResult.orderNumber).toBe(42);

      // Verificar que los parámetros pasados al RPC contienen variant_id y variant_name en p_items
      expect(passedRpcParams).not.toBeNull();
      expect(passedRpcParams.p_items).toHaveLength(1);
      const rpcItem = passedRpcParams.p_items[0];
      expect(rpcItem.product_id).toBe(dummyProduct.id);
      expect(rpcItem.variant_id).toBe("v_doble");
      expect(rpcItem.variant_name).toBe("Doble Carne");
      expect(rpcItem.unit_price).toBe(24000);
      expect(rpcItem.subtotal).toBe(24000);
      expect(rpcItem.product_name).toBe("Combo Hamburguesa (Doble Carne)");
    });
  });
});
