import { z } from "zod";

// ==========================================
// UNIDADES DE MEDIDA DE INGREDIENTES
// ==========================================

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

// ==========================================
// INGREDIENTES (INGREDIENTS) [REC-001]
// ==========================================

export interface Ingredient {
  id: string;
  businessId: string;
  name: string;
  unit: string;
  costPerUnit: number;
  stockQuantity: number;
  minStock: number;
  maxStock?: number | null;
  locationId?: string | null;
  locationName?: string | null;
  categoryId?: string | null;
  availableInPos: boolean;
  availableInQr: boolean;
  availableOnline: boolean;
  isAvailable: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CreateIngredientInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre del ingrediente es obligatorio"),
  unit: z.string().trim().min(1, "La unidad de medida es requerida").default("unidad"),
  costPerUnit: z.coerce.number().min(0, "El costo unitario no puede ser negativo").default(0),
  initialStock: z.coerce.number().min(0, "El stock inicial no puede ser negativo").default(0),
  minStock: z.coerce.number().min(0, "El stock mínimo no puede ser negativo").default(0),
  maxStock: z.coerce.number().min(0).nullable().optional(),
  locationId: z.string().uuid("ID de ubicación inválido").nullable().optional(),
  categoryId: z.string().uuid("ID de categoría inválido").nullable().optional(),
  availableInPos: z.boolean().default(false),
  availableInQr: z.boolean().default(false),
  availableOnline: z.boolean().default(false),
  notes: z.string().trim().nullable().optional(),
});

export type CreateIngredientInput = z.infer<typeof CreateIngredientInputSchema>;

export const UpdateIngredientInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre del ingrediente es obligatorio").optional(),
  unit: z.string().trim().min(1, "La unidad de medida es requerida").optional(),
  costPerUnit: z.coerce.number().min(0).optional(),
  minStock: z.coerce.number().min(0).optional(),
  maxStock: z.coerce.number().min(0).nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  availableInPos: z.boolean().optional(),
  availableInQr: z.boolean().optional(),
  availableOnline: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  notes: z.string().trim().nullable().optional(),
});

export type UpdateIngredientInput = z.infer<typeof UpdateIngredientInputSchema>;

export interface IngredientFilters {
  search?: string;
  stockStatus?: "all" | "low_stock" | "out_of_stock" | "in_stock";
  locationId?: string;
  unit?: string;
}

export interface IngredientKPIs {
  totalIngredients: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalCostValuation: number;
}

// ==========================================
// RECETAS Y ESCANDALLOS [REC-002]
// ==========================================

export type RecipeStatus = "active" | "inactive" | "archived";

export interface RecipeIngredientItemInput {
  ingredientId: string;
  quantity: number;
  unit: string;
  isOptional?: boolean;
  sortOrder?: number;
}

export const RecipeIngredientItemInputSchema = z.object({
  ingredientId: z.string().uuid("ID de ingrediente inválido"),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unit: z.string().trim().min(1, "La unidad es requerida"),
  isOptional: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const CreateRecipeInputSchema = z.object({
  productId: z.string().uuid("ID de producto inválido"),
  name: z.string().trim().min(1, "El nombre de la receta es obligatorio"),
  description: z.string().trim().nullable().optional(),
  portions: z.coerce.number().int().min(1, "Debe rendir al menos 1 porción").default(1),
  prepTimeMinutes: z.coerce.number().int().min(0, "El tiempo de preparación no puede ser negativo").nullable().optional(),
  locationId: z.string().uuid("ID de ubicación inválido").nullable().optional(),
  ingredients: z.array(RecipeIngredientItemInputSchema).min(1, "La receta debe contener al menos un ingrediente"),
});

export type CreateRecipeInput = z.infer<typeof CreateRecipeInputSchema>;

export const UpdateRecipeInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la receta es obligatorio").optional(),
  description: z.string().trim().nullable().optional(),
  portions: z.coerce.number().int().min(1, "Debe rendir al menos 1 porción").optional(),
  prepTimeMinutes: z.coerce.number().int().min(0).nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  ingredients: z.array(RecipeIngredientItemInputSchema).min(1, "La receta debe contener al menos un ingrediente").optional(),
});

export type UpdateRecipeInput = z.infer<typeof UpdateRecipeInputSchema>;

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  subtotalCost: number;
  isOptional: boolean;
  sortOrder: number;
  stockQuantity: number;
  requiredPerPortion?: number;
  availablePortions?: number;
  projectedRemainingStock?: number;
  createdAt?: string;
}

export interface LimitingIngredientInfo {
  ingredientId: string;
  name: string;
  currentStock: number;
  requiredPerPortion: number;
  unit: string;
  availablePortions: number;
  displayText?: string;
}

export interface RecipeAvailabilityResult {
  recipeId: string;
  productId: string;
  productName: string;
  portionsAvailable: number; // Truncado al entero según requerimiento (ej. 1)
  exactPortionsAvailable: number; // Rendimiento decimal real (ej. 1.5)
  isOutOfStock: boolean; // true si portionsAvailable === 0
  limitingIngredient: LimitingIngredientInfo | null;
  ingredients: Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    isOptional: boolean;
    currentStock: number;
    requiredPerPortion: number;
    availablePortions: number;
    projectedRemainingStock: number;
    isLimiting: boolean;
  }>;
}

export interface Recipe {
  id: string;
  businessId: string;
  productId: string;
  name: string;
  description: string | null;
  portions: number;
  prepTimeMinutes: number | null;
  locationId: string | null;
  status: RecipeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeWithDetails extends Recipe {
  productName: string;
  productPrice: number;
  productSku?: string | null;
  productCategory?: string | null;
  productImageUrl?: string | null;
  productStock?: number | null;
  locationName?: string | null;
  ingredients: RecipeIngredient[];
  totalCost: number;
  costPerPortion: number;
  marginPercentage: number;
  portionsAvailable: number;
  exactPortionsAvailable?: number;
  limitingIngredient?: LimitingIngredientInfo | null;
}

export interface RecipeFilters {
  search?: string;
  status?: RecipeStatus | "all";
  locationId?: string;
  productId?: string;
}
