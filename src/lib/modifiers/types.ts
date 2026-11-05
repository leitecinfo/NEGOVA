import { z } from "zod";

export type ModifierSelectionType = "single" | "multiple";
export type ModifierStatus = "active" | "inactive";
export type ModifierCommercialType = "additional" | "replacement" | "size";

export const ModifierOptionSchema = z.object({
  id: z.string().optional(),
  option_group_id: z.string().optional(),
  name: z.string().trim().min(1, "El nombre de la opción es requerido"),
  price: z.coerce
    .number()
    .min(0, "El precio adicional debe ser mayor o igual a 0")
    .finite("El precio debe ser un número válido")
    .default(0),
  status: z.enum(["active", "inactive"]).default("active"),
  sort_order: z.number().int().default(0),
});

export type ModifierOptionInput = z.infer<typeof ModifierOptionSchema>;

export interface ModifierOption {
  id: string;
  option_group_id: string;
  business_id?: string;
  name: string;
  price: number; // mapped from additional_price
  status: ModifierStatus;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export const BaseModifierGroupSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "El nombre del grupo es requerido"),
  description: z.string().trim().nullable().optional(),
  commercial_type: z
    .enum(["additional", "replacement", "size"])
    .default("additional"),
  required: z.boolean().default(false),
  selection_type: z.enum(["single", "multiple"]).default("multiple"),
  min_select: z.coerce.number().int().min(0, "El mínimo debe ser 0 o superior").default(0),
  max_select: z.coerce.number().int().min(1, "El máximo debe ser al menos 1").default(1),
  sort_order: z.number().int().default(0),
  status: z.enum(["active", "inactive"]).default("active"),
  product_ids: z.array(z.string().trim().min(1)).default([]),
  category_ids: z.array(z.string().trim().min(1)).default([]),
  options: z.array(ModifierOptionSchema).default([]),
});

export const ModifierGroupSchema = z
  .preprocess(
    (raw: any) => {
      if (raw && typeof raw === "object") {
        const copy = { ...raw };
        if (copy.selection_type === "single") {
          copy.max_select = 1;
          if (copy.required && (copy.min_select === undefined || copy.min_select === null || copy.min_select === 0)) {
            copy.min_select = 1;
          }
        } else if (copy.required && (copy.min_select === undefined || copy.min_select === null || copy.min_select === 0)) {
          copy.min_select = 1;
        }
        return copy;
      }
      return raw;
    },
    BaseModifierGroupSchema
  )
  .refine(
    (data) => {
      if (data.selection_type === "single") {
        return data.max_select === 1;
      }
      return data.min_select <= data.max_select;
    },
    {
      message: "La selección mínima no puede ser mayor que la máxima",
      path: ["min_select"],
    }
  )
  .refine(
    (data) => {
      if (data.required && data.selection_type === "single") {
        return data.min_select === 1 && data.max_select === 1;
      }
      if (data.required && data.selection_type === "multiple") {
        return data.min_select >= 1;
      }
      return true;
    },
    {
      message: "Un grupo obligatorio debe exigir al menos 1 selección",
      path: ["min_select"],
    }
  );

export type CreateModifierGroupInput = z.infer<typeof BaseModifierGroupSchema>;
export type UpdateModifierGroupInput = Partial<CreateModifierGroupInput>;

export interface ModifierGroup {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  commercial_type: ModifierCommercialType;
  required: boolean;
  selection_type: ModifierSelectionType;
  min_select: number;
  max_select: number;
  sort_order: number;
  status: ModifierStatus;
  options: ModifierOption[];
  applied_product_ids: string[];
  applied_category_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ModifierGroupKPIs {
  totalGroups: number;
  activeOptions: number;
  linkedProductsCount: number;
}
