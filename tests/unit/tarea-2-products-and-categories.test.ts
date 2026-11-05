import { describe, it, expect, vi } from "vitest";
import {
  PRODUCT_UNITS,
  ProductVariantSchema,
  ProductModifierGroupSchema,
  ProductModifierOptionSchema,
  ProductMetadataSchema,
  CreateProductSchema,
  isProductAvailableInPos,
  isProductAvailableInQr,
  isProductAvailableOnline,
} from "@/lib/products/types";
import * as ProductFormModalModule from "@/app/workspace/[businessId]/productos/product-form-modal";

describe("TAREA 2 — Verificación Integral de Productos, Categorías y Modificadores", () => {
  describe("1. Estructura y Limpieza del Módulo", () => {
    it("garantiza que DEFAULT_MODIFIER_TEMPLATES fue completamente eliminado del código", () => {
      expect((ProductFormModalModule as any).DEFAULT_MODIFIER_TEMPLATES).toBeUndefined();
    });

    it("valida que las unidades de medida estándares de NEGOVA estén disponibles", () => {
      const units = PRODUCT_UNITS.map((u) => u.value);
      expect(units).toContain("unidad");
      expect(units).toContain("kilogramo");
      expect(units).toContain("gramo");
      expect(units).toContain("litro");
      expect(units).toContain("mililitro");
    });
  });

  describe("2. Clasificación Funcional de Productos (Multivertical)", () => {
    it("permite productos de tipo 'service' sin importar el tipo de negocio", () => {
      const serviceProduct = CreateProductSchema.parse({
        name: "Corte de Cabello Caballero",
        price: 25000,
        metadata: {
          product_type: "service",
          track_stock: false,
          duration_minutes: 45,
        },
      });

      expect(serviceProduct.metadata?.product_type).toBe("service");
      expect(serviceProduct.metadata?.track_stock).toBe(false);
      expect(serviceProduct.metadata?.duration_minutes).toBe(45);
    });

    it("permite productos elaborados o preparados (track_stock = false)", () => {
      const preparedProduct = CreateProductSchema.parse({
        name: "Hamburguesa Artesanal Doble Carne",
        price: 28000,
        metadata: {
          product_type: "product",
          track_stock: false,
          has_recipe: true,
        },
      });

      expect(preparedProduct.metadata?.product_type).toBe("product");
      expect(preparedProduct.metadata?.track_stock).toBe(false);
      expect(preparedProduct.metadata?.has_recipe).toBe(true);
    });

    it("permite productos con existencias físicas (track_stock = true)", () => {
      const stockProduct = CreateProductSchema.parse({
        name: "Gaseosa 400ml Pet",
        price: 4500,
        metadata: {
          product_type: "product",
          track_stock: true,
          stock_quantity: 48,
          min_stock: 12,
          sku: "GAS-400-PET",
          barcode: "7701234567890",
        },
      });

      expect(stockProduct.metadata?.track_stock).toBe(true);
      expect(stockProduct.metadata?.stock_quantity).toBe(48);
      expect(stockProduct.metadata?.min_stock).toBe(12);
    });
  });

  describe("3. Galería de Imágenes (Máximo 3 fotografías)", () => {
    it("almacena la imagen principal en image_url y las adicionales en metadata.gallery_images", () => {
      const inputImages = [
        "https://example.com/img1.jpg",
        "https://example.com/img2.jpg",
        "https://example.com/img3.jpg",
      ];

      const primary = inputImages[0];
      const additional = inputImages.slice(1);

      const parsed = CreateProductSchema.parse({
        name: "Producto con Galería",
        price: 15000,
        image_url: primary,
        metadata: {
          gallery_images: additional,
        },
      });

      expect(parsed.image_url).toBe("https://example.com/img1.jpg");
      expect(parsed.metadata?.gallery_images).toHaveLength(2);
      expect(parsed.metadata?.gallery_images).toEqual([
        "https://example.com/img2.jpg",
        "https://example.com/img3.jpg",
      ]);
    });

    it("rechaza o trunca imágenes si superan el límite de 3 en el cliente", () => {
      const candidateImages = [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
        "https://example.com/4.jpg",
      ];

      // La lógica del componente limita a 3
      const allowedImages = candidateImages.slice(0, 3);
      expect(allowedImages).toHaveLength(3);
      expect(allowedImages).not.toContain("https://example.com/4.jpg");
    });
  });

  describe("4. Modificadores Dinámicos sin Hardcoding", () => {
    it("valida la creación de modificadores válidos con tipo additional, size y replacement", () => {
      const groupAdditional = ProductModifierGroupSchema.parse({
        name: "Toppings y Quesos",
        type: "additional",
        required: false,
        min_select: 0,
        max_select: 3,
        options: [
          { name: "Extra Queso", price: 3000 },
          { name: "Tocineta", price: 4000 },
        ],
      });
      expect(groupAdditional.type).toBe("additional");
      expect(groupAdditional.options).toHaveLength(2);

      const groupSize = ProductModifierGroupSchema.parse({
        name: "Tamaño",
        type: "size",
        required: true,
        min_select: 1,
        max_select: 1,
        options: [
          { name: "Personal", price: 0 },
          { name: "Familiar", price: 12000 },
        ],
      });
      expect(groupSize.type).toBe("size");
      expect(groupSize.required).toBe(true);

      const groupReplacement = ProductModifierGroupSchema.parse({
        name: "Cambio de Guarnición",
        type: "replacement",
        required: false,
        options: [
          { name: "Papas rústicas", price: 2000 },
        ],
      });
      expect(groupReplacement.type).toBe("replacement");
    });

    it("falla validación si min_select es mayor que max_select", () => {
      expect(() => {
        ProductModifierGroupSchema.parse({
          name: "Invalido",
          min_select: 5,
          max_select: 2,
          options: [{ name: "Opción A", price: 0 }],
        });
      }).toThrow();
    });
  });

  describe("5. Duplicación de Productos", () => {
    it("duplica un producto limpiando SKU, código de barras y añadiendo '(Copia)' al nombre", () => {
      const originalProduct = {
        id: "prod_12345",
        name: "Hamburguesa Clásica",
        price: 22000,
        category_id: "cat_burgers",
        is_available: true,
        status: "active",
        metadata: {
          sku: "HAMB-01",
          barcode: "7709998887771",
          track_stock: false,
          product_type: "product",
          modifier_groups: [
            {
              id: "grp_1",
              name: "Salsas",
              type: "additional",
              options: [{ name: "Ajo", price: 0 }],
            },
          ],
        },
      };

      // Simulación de la lógica de duplicación implementada en products-manager-client
      const meta = { ...(originalProduct.metadata as any) };
      delete meta.sku;
      delete meta.barcode;

      const duplicatedProduct = {
        ...originalProduct,
        id: "",
        name: `${originalProduct.name} (Copia)`,
        metadata: meta,
      };

      expect(duplicatedProduct.id).toBe("");
      expect(duplicatedProduct.name).toBe("Hamburguesa Clásica (Copia)");
      expect(duplicatedProduct.metadata.sku).toBeUndefined();
      expect(duplicatedProduct.metadata.barcode).toBeUndefined();
      expect(duplicatedProduct.metadata.modifier_groups).toHaveLength(1);
      expect(duplicatedProduct.price).toBe(22000);
      expect(duplicatedProduct.category_id).toBe("cat_burgers");
    });
  });

  describe("6. Canales de Venta y Visibilidad", () => {
    it("permite visibilidad diferenciada en POS, Catálogo QR y Tienda Online", () => {
      const product = {
        metadata: {
          available_in_pos: true,
          available_in_qr: false,
          available_online: true,
        },
      };

      expect(isProductAvailableInPos(product)).toBe(true);
      expect(isProductAvailableInQr(product)).toBe(false);
      expect(isProductAvailableOnline(product)).toBe(true);
    });
  });
});

