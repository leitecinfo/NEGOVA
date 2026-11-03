import { z } from "zod";

export const MEASUREMENT_UNIT_TYPES = ["weight", "volume", "length", "count"] as const;
export type MeasurementUnitType = (typeof MEASUREMENT_UNIT_TYPES)[number];

export const MEASUREMENT_UNIT_TYPE_LABELS: Record<MeasurementUnitType, string> = {
  weight: "Peso",
  volume: "Volumen",
  length: "Longitud",
  count: "Conteo / Unidades",
};

export const MEASUREMENT_UNIT_TYPE_ICONS: Record<MeasurementUnitType, string> = {
  weight: "Scale",
  volume: "Droplets",
  length: "Ruler",
  count: "Hash",
};

export interface MeasurementUnit {
  id: string;
  businessId: string;
  name: string;
  abbreviation: string;
  type: MeasurementUnitType;
  isBase: boolean;
  conversionFactor: number;
  baseUnitId?: string | null;
  baseUnitName?: string | null;
  baseUnitAbbreviation?: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CreateMeasurementUnitSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la unidad es requerido"),
  abbreviation: z.string().trim().min(1, "La abreviación es requerida").max(10, "Máximo 10 caracteres"),
  type: z.enum(["weight", "volume", "length", "count"]),
  isBase: z.boolean().optional().default(false),
  conversionFactor: z.coerce.number().positive("El factor de conversión debe ser mayor a 0").default(1.0),
  baseUnitId: z.string().uuid("Unidad base inválida").nullable().optional().or(z.literal("")),
});

export type CreateMeasurementUnitInput = z.infer<typeof CreateMeasurementUnitSchema>;

export const UpdateMeasurementUnitSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la unidad es requerido").optional(),
  abbreviation: z.string().trim().min(1, "La abreviación es requerida").max(10, "Máximo 10 caracteres").optional(),
  conversionFactor: z.coerce.number().positive("El factor de conversión debe ser mayor a 0").optional(),
  baseUnitId: z.string().uuid("Unidad base inválida").nullable().optional().or(z.literal("")),
});

export type UpdateMeasurementUnitInput = z.infer<typeof UpdateMeasurementUnitSchema>;
