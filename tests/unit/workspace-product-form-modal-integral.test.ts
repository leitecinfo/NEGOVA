import { describe, it, expect } from "vitest";
import {
  PRODUCT_UNITS,
  ProductUnit,
  ProductVariantSchema,
  ProductModifierGroupSchema,
  ProductModifierOptionSchema,
  ProductMetadataSchema,
  ProductSchema,
  CreateProductSchema,
  resolveProductChannels,
  isProductAvailableInPos,
  isProductAvailableInQr,
  isProductAvailableOnline,
} from "@/lib/products/types";
import * as ProductFormModalModule from "@/app/workspace/[businessId]/productos/product-form-modal";

describe("Modal Integral de Creación / Edición de Producto", () => {
  describe("1. Campos Base y Unidades de Medida", () => {
    it("incluye todas las unidades de medida requeridas en PRODUCT_UNITS", () => {
      const unitValues = PRODUCT_UNITS.map((u) => u.value);
      const expectedUnits: ProductUnit[] = [
        "unidad",
        "kilogramo",
        "gramo",
        "litro",
        "mililitro",
        "metro",
        "centimetro",
      ];

      for (const expected of expectedUnits) {
        expect(unitValues).toContain(expected);
      }
    });

    it("valida producto base con campos de identificación, SKU, código de barras y canales de venta", () => {
      const rawProduct = {
        name: "Camisa Lino Premium",
        description: "Camisa de manga larga en lino natural",
        price: 120000,
        category_id: "11111111-1111-4111-8111-111111111111",
        is_available: true,
        status: "active" as const,
        sort_order: 1,
        available_in_pos: true,
        available_in_qr: true,
        available_online: false,
        metadata: {
          product_type: "product" as const,
          sku: "CAM-LIN-001",
          barcode: "7701234567890",
          unit: "unidad",
          brand: "Moda Artesanal",
          track_stock: false,
        },
      };

      const parsed = CreateProductSchema.parse(rawProduct);
      expect(parsed.name).toBe("Camisa Lino Premium");
      expect(parsed.price).toBe(120000);
      expect(parsed.metadata?.sku).toBe("CAM-LIN-001");
      expect(parsed.metadata?.barcode).toBe("7701234567890");
      expect(parsed.metadata?.unit).toBe("unidad");

      const channels = resolveProductChannels(parsed);
      expect(channels.available_in_pos).toBe(true);
      expect(channels.available_in_qr).toBe(true);
      expect(channels.available_online).toBe(false);
    });
  });

  describe("2. Selector de Stock: Limitado vs Ilimitado", () => {
    it("configura stock ilimitado (bajo demanda o platos preparados) sin requerir inventario físico", () => {
      const metadata = ProductMetadataSchema.parse({
        product_type: "product",
        track_stock: false,
        stock_quantity: null,
        min_stock: null,
        max_stock: null,
      });

      expect(metadata.track_stock).toBe(false);
      expect(metadata.stock_quantity).toBeNull();
      expect(metadata.min_stock).toBeNull();
      expect(metadata.max_stock).toBeNull();
    });

    it("configura stock limitado con stock inicial, stock mínimo y stock máximo opcional", () => {
      const metadata = ProductMetadataSchema.parse({
        product_type: "product",
        track_stock: true,
        stock_quantity: 48,
        min_stock: 12,
        max_stock: 100,
        cost: 35000,
      });

      expect(metadata.track_stock).toBe(true);
      expect(metadata.stock_quantity).toBe(48);
      expect(metadata.min_stock).toBe(12);
      expect(metadata.max_stock).toBe(100);
      expect(metadata.cost).toBe(35000);
    });
  });

  describe("3. Casilla 'Tiene Variantes' y Sección Dinámica", () => {
    it("producto sin variantes almacena precio de venta, costo y niveles de stock base", () => {
      const metadata = ProductMetadataSchema.parse({
        product_type: "product",
        has_variants: false,
        variants: [],
        track_stock: true,
        stock_quantity: 25,
        min_stock: 5,
        max_stock: 50,
        cost: 15000,
      });

      expect(metadata.has_variants).toBe(false);
      expect(metadata.variants).toHaveLength(0);
      expect(metadata.stock_quantity).toBe(25);
      expect(metadata.cost).toBe(15000);
    });

    it("producto con variantes valida nombre, SKU, código de barras, costo, precio, stock e impuestos por variante", () => {
      const variantSmall = ProductVariantSchema.parse({
        id: "var_sm",
        name: "Pequeño / 250ml",
        price: 8000,
        sku: "JUG-SM-01",
        barcode: "7701112223334",
        cost: 3000,
        stock_quantity: 30,
        tax_percentage: 8,
        is_available: true,
      });

      const variantLarge = ProductVariantSchema.parse({
        id: "var_lg",
        name: "Familiar / 1000ml",
        price: 22000,
        sku: "JUG-LG-02",
        barcode: "7701112223335",
        cost: 8500,
        stock_quantity: 15,
        tax_percentage: 19,
        is_available: true,
      });

      expect(variantSmall.name).toBe("Pequeño / 250ml");
      expect(variantSmall.price).toBe(8000);
      expect(variantSmall.cost).toBe(3000);
      expect(variantSmall.barcode).toBe("7701112223334");
      expect(variantSmall.stock_quantity).toBe(30);
      expect(variantSmall.tax_percentage).toBe(8);

      expect(variantLarge.name).toBe("Familiar / 1000ml");
      expect(variantLarge.price).toBe(22000);
      expect(variantLarge.tax_percentage).toBe(19);

      const metadata = ProductMetadataSchema.parse({
        product_type: "product",
        has_variants: true,
        variants: [variantSmall, variantLarge],
      });

      expect(metadata.has_variants).toBe(true);
      expect(metadata.variants).toHaveLength(2);
      expect(metadata.variants[0].barcode).toBe("7701112223334");
      expect(metadata.variants[1].cost).toBe(8500);
    });

    it("rechaza variantes con precio negativo o nombre en blanco", () => {
      expect(() => {
        ProductVariantSchema.parse({
          name: "",
          price: 10000,
        });
      }).toThrow();

      expect(() => {
        ProductVariantSchema.parse({
          name: "Válido",
          price: -500,
        });
      }).toThrow();
    });
  });

  describe("4. Modificadores y Personalización (Adicional, Tamaño, Reemplazo)", () => {
    it("soporta los 3 tipos de modificadores: additional, size y replacement", () => {
      const additionalGroup = ProductModifierGroupSchema.parse({
        name: "Toppings y Quesos",
        type: "additional",
        required: false,
        min_select: 0,
        max_select: 4,
        options: [
          { name: "Extra Queso Mozzarella", price: 3500, is_available: true },
          { name: "Tocineta Crocante", price: 4000, is_available: true },
        ],
      });
      expect(additionalGroup.type).toBe("additional");
      expect(additionalGroup.required).toBe(false);
      expect(additionalGroup.max_select).toBe(4);

      const sizeGroup = ProductModifierGroupSchema.parse({
        name: "Tamaño de Bebida",
        type: "size",
        required: true,
        min_select: 1,
        max_select: 1,
        options: [
          { name: "Regular 350ml", price: 0, is_available: true },
          { name: "Grande 500ml", price: 2000, is_available: true },
        ],
      });
      expect(sizeGroup.type).toBe("size");
      expect(sizeGroup.required).toBe(true);
      expect(sizeGroup.options[1].price).toBe(2000);

      const replacementGroup = ProductModifierGroupSchema.parse({
        name: "Cambio de Guarnición",
        type: "replacement",
        required: false,
        min_select: 0,
        max_select: 1,
        options: [
          { name: "Papas francesas estándar", price: 0, is_available: true },
          { name: "Cambiar por aros de cebolla", price: 2500, is_available: true },
        ],
      });
      expect(replacementGroup.type).toBe("replacement");
      expect(replacementGroup.options[1].price).toBe(2500);
    });

    it("garantiza que no existan plantillas hardcodeadas predeterminadas (DEFAULT_MODIFIER_TEMPLATES eliminado)", () => {
      expect((ProductFormModalModule as any).DEFAULT_MODIFIER_TEMPLATES).toBeUndefined();
    });

    it("valida que min_select no sea superior a max_select", () => {
      expect(() => {
        ProductModifierGroupSchema.parse({
          name: "Invalido",
          required: true,
          min_select: 5,
          max_select: 2,
          options: [{ name: "Opt 1", price: 0 }],
        });
      }).toThrow();
    });
  });
});
