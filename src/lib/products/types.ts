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
  is_available: z.boolean().default(true),
  sort_order: z.number().default(0),
  inherit_base_ingredients: z.boolean().default(true),
  specific_ingredients: z.string().trim().nullable().optional(),
  specific_description: z.string().trim().nullable().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
});

export type ProductVariant = z.infer<typeof ProductVariantSchema>;

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

export const ProductMetadataSchema = z
  .object({
    product_type: z.enum(["product", "service"]).default("product"),
    sku: z.string().trim().nullable().optional(),
    barcode: z.string().trim().nullable().optional(),
    brand: z.string().trim().nullable().optional(),
    unit: z.string().trim().nullable().optional(),
    track_stock: z.boolean().default(false),
    stock_quantity: z.coerce.number().int().min(0).nullable().optional(),
    min_stock: z.coerce.number().int().min(0).nullable().optional(),
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

export const CategorySchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  name: z.string().trim().min(1, "El nombre es requerido"),
  description: z.string().nullable().optional(),
  sort_order: z.number().default(0),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
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
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  is_available: z.boolean().default(true),
  sort_order: z.number().default(0),
  metadata: ProductMetadataSchema.default(() => ProductMetadataSchema.parse({})),
  categories: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Product = z.infer<typeof ProductSchema>;

// DTOs for creation/updates
export const CreateCategorySchema = CategorySchema.omit({
  id: true,
  business_id: true,
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

