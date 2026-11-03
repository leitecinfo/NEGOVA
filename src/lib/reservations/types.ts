import { z } from "zod";

export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "seated",
  "cancelled",
  "no_show",
  "completed",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_ORIGINS = [
  "direct",
  "phone",
  "web",
  "whatsapp",
  "walk_in",
] as const;

export type ReservationOrigin = (typeof RESERVATION_ORIGINS)[number];

export interface Reservation {
  id: string;
  business_id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  party_size: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss or HH:mm
  room_id: string | null;
  table_id: string | null;
  status: ReservationStatus;
  origin: ReservationOrigin;
  special_requests: string | null;
  allergies: string | null;
  notes: string | null;
  min_spend: number;
  deposit_amount: number;
  created_at: string;
  updated_at: string;
}

export interface ReservationWithDetails extends Reservation {
  room_name?: string | null;
  table_name_or_number?: string | null;
  table_capacity?: number | null;
}

export const CreateReservationSchema = z.object({
  customer_name: z.string().trim().min(1, "El nombre del cliente es obligatorio"),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email("Email inválido").nullable().optional().or(z.literal("")),
  party_size: z.coerce.number().int().min(1, "Al menos 1 persona requerida"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha debe ser YYYY-MM-DD"),
  time: z.string().min(1, "La hora es requerida"),
  room_id: z.string().uuid("Sala inválida").nullable().optional().or(z.literal("")),
  table_id: z.string().uuid("Mesa inválida").nullable().optional().or(z.literal("")),
  status: z.enum(RESERVATION_STATUSES).optional().default("confirmed"),
  origin: z.enum(RESERVATION_ORIGINS).optional().default("direct"),
  special_requests: z.string().trim().nullable().optional(),
  allergies: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  min_spend: z.coerce.number().min(0).optional().default(0),
  deposit_amount: z.coerce.number().min(0).optional().default(0),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const UpdateReservationSchema = CreateReservationSchema.partial();
export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;

export interface AssignReservationTableInput {
  reservationId: string;
  tableId: string | null;
  roomId?: string | null;
}

export interface ReservationMetrics {
  todayCount: number;
  next7DaysCount: number;
  walkInsCount: number;
  occupancyRate: number; // Porcentaje 0 - 100
  totalGuestsToday: number;
  confirmedTodayCount: number;
  checkedInTodayCount: number;
  seatedTodayCount: number;
}

export const RESERVATION_STATUS_META: Record<
  ReservationStatus,
  { label: string; badgeClass: string; borderClass: string }
> = {
  pending: {
    label: "Pendiente",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    borderClass: "border-l-amber-500",
  },
  confirmed: {
    label: "Confirmada",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    borderClass: "border-l-blue-500",
  },
  checked_in: {
    label: "Check-in",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    borderClass: "border-l-emerald-500",
  },
  seated: {
    label: "En Mesa",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    borderClass: "border-l-purple-500",
  },
  completed: {
    label: "Completada",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    borderClass: "border-l-slate-500",
  },
  cancelled: {
    label: "Cancelada",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    borderClass: "border-l-rose-500",
  },
  no_show: {
    label: "No Asistió",
    badgeClass: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
    borderClass: "border-l-zinc-500",
  },
};

export const RESERVATION_ORIGIN_META: Record<
  ReservationOrigin,
  { label: string; iconName: string }
> = {
  direct: { label: "Directo", iconName: "Store" },
  phone: { label: "Teléfono", iconName: "Phone" },
  whatsapp: { label: "WhatsApp", iconName: "MessageSquare" },
  web: { label: "Web / QR", iconName: "Globe" },
  walk_in: { label: "Walk-in", iconName: "Footprints" },
};

