import { z } from "zod";

export const SPOILAGE_DB_CAUSES = ["expired", "damaged", "spilled", "stolen", "other"] as const;
export type SpoilageDbCause = (typeof SPOILAGE_DB_CAUSES)[number];
export const SPOILAGE_CAUSES = SPOILAGE_DB_CAUSES;

export const SPOILAGE_UI_CAUSES = [
  "expired",
  "damaged",
  "decomposed",
  "spilled",
  "handling_error",
  "stolen",
  "other",
] as const;
export type SpoilageUiCause = (typeof SPOILAGE_UI_CAUSES)[number];
export type SpoilageCause = SpoilageUiCause;

export const SPOILAGE_ITEM_TYPES = ["product", "ingredient"] as const;
export type SpoilageItemType = (typeof SPOILAGE_ITEM_TYPES)[number];

export const SPOILAGE_CAUSE_LABELS: Record<SpoilageUiCause, string> = {
  expired: "Producto vencido",
  damaged: "Producto dañado",
  decomposed: "Descomposición",
  spilled: "Derrame o desperdicio",
  handling_error: "Error de manipulación",
  stolen: "Pérdida o faltante",
  other: "Otro motivo",
};

export const SPOILAGE_CAUSE_COLORS: Record<
  SpoilageUiCause,
  { bg: string; text: string; border: string }
> = {
  expired: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30",
  },
  damaged: {
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/30",
  },
  decomposed: {
    bg: "bg-orange-500/10 dark:bg-orange-500/20",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/30",
  },
  spilled: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
  },
  handling_error: {
    bg: "bg-red-500/10 dark:bg-red-500/20",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-500/30",
  },
  stolen: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
  },
  other: {
    bg: "bg-slate-500/10 dark:bg-slate-500/20",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-500/30",
  },
};

/**
 * Mapea la causa de UI a un valor admitido por la restricción CHECK de PostgreSQL:
 * ('expired', 'damaged', 'spilled', 'stolen', 'other')
 */
export function mapToDbCause(uiCause: SpoilageUiCause | string): SpoilageDbCause {
  switch (uiCause) {
    case "expired":
      return "expired";
    case "damaged":
      return "damaged";
    case "decomposed":
      return "damaged";
    case "spilled":
      return "spilled";
    case "handling_error":
      return "damaged";
    case "stolen":
      return "stolen";
    case "other":
    default:
      return "other";
  }
}

export const CreateSpoilageInputSchema = z
  .object({
    itemType: z.enum(SPOILAGE_ITEM_TYPES),
    itemId: z.string().trim().min(1, "ID de artículo inválido"),
    itemName: z.string().trim().min(1, "El nombre del ítem es obligatorio"),
    locationId: z.string().trim().min(1).optional().nullable(),
    cause: z.enum(SPOILAGE_UI_CAUSES),
    customReason: z.string().trim().max(100).optional().nullable(),
    unit: z.string().trim().optional().nullable(),
    quantity: z.coerce.number().positive("La cantidad mermada debe ser mayor a 0"),
    unitCost: z.coerce.number().min(0, "El costo unitario no puede ser negativo").default(0),
    notes: z.string().trim().max(500, "Las observaciones no pueden exceder 500 caracteres").optional().nullable(),
    date: z.string().optional(),
    idempotencyKey: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.cause === "other" && (!data.customReason || data.customReason.trim().length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: "Si seleccionas 'Otro motivo', debes especificar la descripción de la causa.",
      path: ["customReason"],
    }
  );

export type CreateSpoilageInput = z.infer<typeof CreateSpoilageInputSchema>;

export const UpdateSpoilageInputSchema = z
  .object({
    id: z.string().trim().min(1, "ID de merma inválido"),
    itemType: z.enum(SPOILAGE_ITEM_TYPES),
    itemId: z.string().trim().min(1, "ID de artículo inválido"),
    itemName: z.string().trim().min(1, "El nombre del ítem es obligatorio"),
    locationId: z.string().trim().min(1).optional().nullable(),
    cause: z.enum(SPOILAGE_UI_CAUSES),
    customReason: z.string().trim().max(100).optional().nullable(),
    unit: z.string().trim().optional().nullable(),
    quantity: z.coerce.number().positive("La cantidad mermada debe ser mayor a 0"),
    unitCost: z.coerce.number().min(0, "El costo unitario no puede ser negativo").default(0),
    notes: z.string().trim().max(500, "Las observaciones no pueden exceder 500 caracteres").optional().nullable(),
    date: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.cause === "other" && (!data.customReason || data.customReason.trim().length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: "Si seleccionas 'Otro motivo', debes especificar la descripción de la causa.",
      path: ["customReason"],
    }
  );

export type UpdateSpoilageInput = z.infer<typeof UpdateSpoilageInputSchema>;

export const CancelSpoilageInputSchema = z.object({
  id: z.string().trim().min(1, "ID de merma inválido"),
  reason: z.string().trim().min(3, "Debes especificar un motivo de anulación válido de al menos 3 caracteres"),
});

export type CancelSpoilageInput = z.infer<typeof CancelSpoilageInputSchema>;

export type SpoilageStatus = "active" | "cancelled";

export interface SpoilageRecord {
  id: string;
  businessId: string;
  locationId?: string | null;
  locationName?: string | null;
  itemType: SpoilageItemType;
  itemId: string;
  itemName: string;
  cause: SpoilageCause;
  customReason?: string | null;
  quantity: number;
  unit?: string | null;
  unitCost: number;
  totalCost: number;
  notes?: string | null;
  registeredBy?: string | null;
  registeredByName?: string | null;
  movementId?: string | null;
  previousStock?: number | null;
  resultingStock?: number | null;
  date: string;
  createdAt: string;
  status: SpoilageStatus;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelledByName?: string | null;
  cancellationReason?: string | null;
  updatedAt?: string | null;
}

export interface SpoilageKPIs {
  totalRecords: number;
  totalCost: number;
  totalQuantity: number;
  recentRecordsCount: number; // Últimos 30 días
  todayRecordsCount: number;  // Mermas Hoy
  todayCost: number;          // Valor Hoy ($)
  cancelledRecordsCount?: number;
  cancelledCost?: number;
}

export type SpoilageTimeFilter = "today" | "week" | "month" | "all";

export interface SpoilageFilterOptions {
  itemType?: SpoilageItemType | "all";
  cause?: SpoilageCause | "all";
  status?: SpoilageStatus | "all";
  search?: string;
  timeFilter?: SpoilageTimeFilter;
  startDate?: string;
  endDate?: string;
  limit?: number;
}
