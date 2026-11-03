import { z } from "zod";

export const SPOILAGE_CAUSES = ["expired", "damaged", "spilled", "stolen", "other"] as const;
export type SpoilageCause = (typeof SPOILAGE_CAUSES)[number];

export const SPOILAGE_ITEM_TYPES = ["product", "ingredient"] as const;
export type SpoilageItemType = (typeof SPOILAGE_ITEM_TYPES)[number];

export const SPOILAGE_CAUSE_LABELS: Record<SpoilageCause, string> = {
  expired: "Vencido / Caducado",
  damaged: "Dañado / Averiado",
  spilled: "Derramado / Caído",
  stolen: "Robado / Pérdida inexplicada",
  other: "Otro motivo",
};

export const SPOILAGE_CAUSE_COLORS: Record<SpoilageCause, { bg: string; text: string; border: string }> = {
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
  spilled: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
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

export const CreateSpoilageInputSchema = z.object({
  itemType: z.enum(SPOILAGE_ITEM_TYPES),
  itemId: z.string().min(1, "El ID del ítem es obligatorio"),
  itemName: z.string().min(1, "El nombre del ítem es obligatorio"),
  locationId: z.string().min(1, "El ID de ubicación es inválido").optional().nullable(),
  cause: z.enum(SPOILAGE_CAUSES),
  quantity: z.coerce
    .number()
    .positive("La cantidad mermada debe ser mayor a 0"),
  unitCost: z.coerce
    .number()
    .min(0, "El costo unitario no puede ser negativo")
    .default(0),
  notes: z.string().optional().nullable(),
  date: z.string().optional(),
});

export type CreateSpoilageInput = z.infer<typeof CreateSpoilageInputSchema>;

export interface SpoilageRecord {
  id: string;
  businessId: string;
  locationId?: string | null;
  locationName?: string | null;
  itemType: SpoilageItemType;
  itemId: string;
  itemName: string;
  cause: SpoilageCause;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes?: string | null;
  registeredBy?: string | null;
  date: string;
  createdAt: string;
}

export interface SpoilageKPIs {
  totalRecords: number;
  totalCost: number;
  totalQuantity: number;
  recentRecordsCount: number; // Últimos 30 días
  todayRecordsCount: number;  // Mermas Hoy
  todayCost: number;          // Valor Hoy ($)
}

export type SpoilageTimeFilter = "today" | "week" | "month" | "all";

export interface SpoilageFilterOptions {
  itemType?: SpoilageItemType | "all";
  cause?: SpoilageCause | "all";
  search?: string;
  timeFilter?: SpoilageTimeFilter;
  startDate?: string;
  endDate?: string;
  limit?: number;
}
