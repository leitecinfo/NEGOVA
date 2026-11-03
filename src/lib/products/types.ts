import { z } from "zod";

// ==========================================
// MODIFICADORES Y COMPLEMENTOS GASTRONÓMICOS
// ==========================================

export const ProductModifierOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "El nombre de la opción es requerido"),
  price: z.coerce.number().min(0, "El precio adicional no puede ser negativo").finite("El precio adicional debe ser un número válido"),
  is_available: z.boolean().default(true),
});

export type ProductModifierOption = z.infer<typeof ProductModifierOptionSchema>;

export const ProductModifierGroupSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "El nombre del grupo es requerido"),
    type: z.enum(["additional", "size", "replacement"]).default("additional").optional(),
    required: z.boolean().default(false),
    min_select: z.coerce.number().int().min(0, "La cantidad mínima debe ser 0 o superior").optional(),
    max_select: z.coerce.number().int().min(1, "La cantidad máxima debe ser al menos 1").optional(),
    options: z.array(ProductModifierOptionSchema).default([]),
  })
  .refine(
    (group) => {
      if (group.min_select !== undefined && group.max_select !== undefined) {
        return group.min_select <= group.max_select;
      }
      return true;
    },
    {
      message: "La cantidad mínima no puede ser mayor que la cantidad máxima",
      path: ["min_select"],
    }
  );

export type ProductModifierGroup = z.infer<typeof ProductModifierGroupSchema>;

// ==========================================
// VARIANTES Y TAMAÑOS COMERCIALES
// ==========================================

export const ProductVariantSchema = z.object({
  id: z.string().default(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)),
  name: z.string().trim().min(1, "El nombre de la variante es requerido"),
  price: z.coerce.number().min(0, "El precio de la variante no puede ser negativo").finite("El precio debe ser un número válido"),
  sku: z.string().trim().nullable().optional(),
  barcode: z.string().trim().nullable().optional(),
  cost: z.coerce.number().min(0).nullable().optional(),
  stock_quantity: z.coerce.number().int().min(0).nullable().optional(),
  tax_percentage: z.coerce.number().min(0).max(100).nullable().optional(),
  is_available: z.boolean().default(true),
  sort_order: z.number().default(0),
  inherit_base_ingredients: z.boolean().default(true),
  specific_ingredients: z.string().trim().nullable().optional(),
  specific_description: z.string().trim().nullable().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
});

export type ProductVariant = z.infer<typeof ProductVariantSchema>;

export const PRODUCT_UNITS = [
  { value: "unidad", label: "Unidad (un)", abbreviation: "un" },
  { value: "kilogramo", label: "Kilogramo (kg)", abbreviation: "kg" },
  { value: "gramo", label: "Gramo (g)", abbreviation: "g" },
  { value: "litro", label: "Litro (l)", abbreviation: "l" },
  { value: "mililitro", label: "Mililitro (ml)", abbreviation: "ml" },
  { value: "metro", label: "Metro (m)", abbreviation: "m" },
  { value: "centimetro", label: "Centímetro (cm)", abbreviation: "cm" },
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number]["value"];

/**
 * Resuelve los ingredientes efectivos para una variante:
 * - Si hereda ingredientes (o no hay variante), utiliza los ingredientes del producto base.
 * - Si no hereda, utiliza sus ingredientes específicos configurados.
 */
export function getEffectiveVariantIngredients(
  baseIngredients?: string | null,
  variant?: ProductVariant | null
): string {
  if (!variant) return (baseIngredients || "").trim();
  if (variant.inherit_base_ingredients) {
    return (baseIngredients || "").trim();
  }
  return (variant.specific_ingredients || "").trim();
}

export const INGREDIENT_UNITS = [
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "g", label: "Gramos (g)" },
  { value: "lt", label: "Litros (lt)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "oz", label: "Onzas (oz)" },
  { value: "lb", label: "Libras (lb)" },
  { value: "unidad", label: "Unidades (un)" },
  { value: "porcion", label: "Porciones (porc)" },
] as const;

export type IngredientUnit = (typeof INGREDIENT_UNITS)[number]["value"];

export const ProductMetadataSchema = z
  .object({
    product_type: z.enum(["product", "service", "ingredient"]).default("product"),
    sku: z.string().trim().nullable().optional(),
    barcode: z.string().trim().nullable().optional(),
    brand: z.string().trim().nullable().optional(),
    unit: z.string().trim().nullable().optional(),
    cost: z.coerce.number().min(0).nullable().optional(),
    tax_percentage: z.coerce.number().min(0).max(100).default(0).optional(),
    tax_included_in_price: z.boolean().default(true).optional(),
    available_in_pos: z.boolean().default(true).optional(),
    available_in_qr: z.boolean().default(true).optional(),
    available_online: z.boolean().default(true).optional(),
    track_stock: z.boolean().default(false),
    stock_quantity: z.coerce.number().int().min(0).nullable().optional(),
    min_stock: z.coerce.number().int().min(0).nullable().optional(),
    max_stock: z.coerce.number().min(0).nullable().optional(),
    duration_minutes: z.coerce.number().int().min(0).nullable().optional(),
    allergens: z.array(z.string()).default([]),
    ingredients: z.string().trim().nullable().optional(),
    gallery_images: z.array(z.string()).default([]),
    has_variants: z.boolean().default(false),
    variants: z.array(ProductVariantSchema).default([]),
    modifier_groups: z.array(ProductModifierGroupSchema).default([]),
  })
  .passthrough();

export type ProductMetadata = z.infer<typeof ProductMetadataSchema>;

// ==========================================
// CATEGORÍAS
// ==========================================

export const STANDARD_TAX_RATES = [
  { value: 0, label: "0% (Exento)", description: "Bienes y servicios excluidos o exentos" },
  { value: 5, label: "5% (Especial)", description: "Tarifa reducida especial" },
  { value: 8, label: "8% (Impoconsumo)", description: "Impuesto Nacional al Consumo (Gastronomía)" },
  { value: 19, label: "19% (IVA General)", description: "Tarifa general de IVA" },
] as const;

export const CategorySchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  parent_category_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, "El nombre es requerido"),
  description: z.string().nullable().optional(),
  default_tax_rate: z.coerce.number().min(0).max(100).nullable().optional(),
  sort_order: z.number().default(0),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  parent: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Category = z.infer<typeof CategorySchema>;

// ==========================================
// PRODUCTOS
// ==========================================

export const ProductSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, "El nombre es requerido"),
  description: z.string().nullable().optional(),
  image_url: z
    .string()
    .trim()
    .url("Debe ser una URL válida")
    .or(z.literal(""))
    .nullable()
    .optional(),
  price: z.coerce.number().min(0, "El precio no puede ser negativo").finite("El precio debe ser un número válido"),
  tax_percentage: z.coerce.number().min(0).max(100).nullable().optional(),
  tax_included_in_price: z.boolean().nullable().optional(),
  available_in_pos: z.boolean().default(true).optional(),
  available_in_qr: z.boolean().default(true).optional(),
  available_online: z.boolean().default(true).optional(),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  is_available: z.boolean().default(true),
  sort_order: z.number().default(0),
  metadata: ProductMetadataSchema.default(() => ProductMetadataSchema.parse({})),
  categories: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Product = z.infer<typeof ProductSchema>;

export type SalesChannel = "pos" | "qr" | "online";

/**
 * Determina si un producto está habilitado en el canal POS (Punto de Venta).
 * Verifica primero la columna de nivel superior `available_in_pos` y luego `metadata.available_in_pos`.
 * Por defecto es `true`.
 */
export function isProductAvailableInPos(
  product?: Partial<Product> | Record<string, any> | null
): boolean {
  if (!product) return false;
  if (typeof product.available_in_pos === "boolean") {
    return product.available_in_pos;
  }
  const meta = (product.metadata as Record<string, any>) || {};
  if (typeof meta.available_in_pos === "boolean") {
    return meta.available_in_pos;
  }
  if (meta.product_type === "ingredient") {
    return false;
  }
  return true;
}

/**
 * Determina si un producto está habilitado en el canal Menú QR Público.
 * Verifica primero `available_in_qr`, luego `metadata.available_in_qr` y por compatibilidad `metadata.show_in_qr_menu`.
 * Por defecto es `true` (para ingredientes por defecto es `false`).
 */
export function isProductAvailableInQr(
  product?: Partial<Product> | Record<string, any> | null
): boolean {
  if (!product) return false;
  if (typeof product.available_in_qr === "boolean") {
    return product.available_in_qr;
  }
  const meta = (product.metadata as Record<string, any>) || {};
  if (typeof meta.available_in_qr === "boolean") {
    return meta.available_in_qr;
  }
  if (typeof meta.show_in_qr_menu === "boolean") {
    return meta.show_in_qr_menu;
  }
  if (meta.product_type === "ingredient") {
    return false;
  }
  return true;
}

/**
 * Determina si un producto está habilitado en el canal Tienda Online.
 * Verifica primero `available_online` y luego `metadata.available_online`.
 * Por defecto es `true` (para ingredientes por defecto es `false`).
 */
export function isProductAvailableOnline(
  product?: Partial<Product> | Record<string, any> | null
): boolean {
  if (!product) return false;
  if (typeof product.available_online === "boolean") {
    return product.available_online;
  }
  const meta = (product.metadata as Record<string, any>) || {};
  if (typeof meta.available_online === "boolean") {
    return meta.available_online;
  }
  if (meta.product_type === "ingredient") {
    return false;
  }
  return true;
}

/**
 * Resuelve el estado consolidado de los tres canales de venta para un producto.
 */
export function resolveProductChannels(product?: Partial<Product> | Record<string, any> | null): {
  available_in_pos: boolean;
  available_in_qr: boolean;
  available_online: boolean;
} {
  return {
    available_in_pos: isProductAvailableInPos(product),
    available_in_qr: isProductAvailableInQr(product),
    available_online: isProductAvailableOnline(product),
  };
}

// DTOs for creation/updates
export const CreateCategorySchema = CategorySchema.omit({
  id: true,
  business_id: true,
  parent: true,
  created_at: true,
  updated_at: true,
});
export type CreateCategoryDTO = z.input<typeof CreateCategorySchema>;

export const CreateProductSchema = ProductSchema.omit({
  id: true,
  business_id: true,
  created_at: true,
  updated_at: true,
});
export type CreateProductDTO = z.input<typeof CreateProductSchema>;

