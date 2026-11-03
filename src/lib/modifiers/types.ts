import { z } from "zod";

export type ModifierSelectionType = "single" | "multiple";
export type ModifierStatus = "active" | "inactive";

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

export const ModifierGroupSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "El nombre del grupo es requerido"),
    required: z.boolean().default(false),
    selection_type: z.enum(["single", "multiple"]).default("multiple"),
    min_select: z.coerce.number().int().min(0, "El mínimo debe ser 0 o superior").default(0),
    max_select: z.coerce.number().int().min(1, "El máximo debe ser al menos 1").default(1),
    sort_order: z.number().int().default(0),
    status: z.enum(["active", "inactive"]).default("active"),
    product_ids: z.array(z.string().trim().min(1)).default([]),
    category_ids: z.array(z.string().trim().min(1)).default([]),
    options: z.array(ModifierOptionSchema).default([]),
  })
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
  );

export type CreateModifierGroupInput = z.input<typeof ModifierGroupSchema>;
export type UpdateModifierGroupInput = Partial<CreateModifierGroupInput>;

export interface ModifierGroup {
  id: string;
  business_id: string;
  name: string;
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
