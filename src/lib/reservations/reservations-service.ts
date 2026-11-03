import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import {
  Reservation,
  ReservationWithDetails,
  CreateReservationInput,
  CreateReservationSchema,
  UpdateReservationInput,
  UpdateReservationSchema,
  AssignReservationTableInput,
  ReservationStatus,
  ReservationMetrics,
} from "./types";

async function getSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return await createClient();
}

/**
 * Consulta la lista de reservas para un negocio con filtros opcionales.
 */
export async function getReservations(
  businessId: string,
  filters?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    roomId?: string;
    tableId?: string;
    search?: string;
  }
): Promise<ReservationWithDetails[]> {
  const supabase = await getSupabase();

  let query = supabase
    .from("reservations")
    .select(
      `
      *,
      restaurant_rooms:room_id (name),
      restaurant_tables:table_id (name_or_number, capacity)
    `
    )
    .eq("business_id", businessId)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (filters?.date) {
    query = query.eq("date", filters.date);
  }
  if (filters?.startDate) {
    query = query.gte("date", filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte("date", filters.endDate);
  }
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.roomId && filters.roomId !== "all") {
    query = query.eq("room_id", filters.roomId);
  }
  if (filters?.tableId && filters.tableId !== "all") {
    query = query.eq("table_id", filters.tableId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Error al consultar reservas: ${error.message}`);
  }

  let list: ReservationWithDetails[] = (data || []).map((row: any) => ({
    id: row.id,
    business_id: row.business_id,
    customer_name: row.customer_name,
    phone: row.phone,
    email: row.email,
    party_size: row.party_size,
    date: row.date,
    time: typeof row.time === "string" ? row.time.slice(0, 5) : row.time,
    room_id: row.room_id,
    table_id: row.table_id,
    status: row.status,
    origin: row.origin,
    special_requests: row.special_requests,
    allergies: row.allergies,
    notes: row.notes,
    min_spend: Number(row.min_spend || 0),
    deposit_amount: Number(row.deposit_amount || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    room_name: row.restaurant_rooms?.name || null,
    table_name_or_number: row.restaurant_tables?.name_or_number || null,
    table_capacity: row.restaurant_tables?.capacity || null,
  }));

  if (filters?.search && filters.search.trim()) {
    const s = filters.search.trim().toLowerCase();
    list = list.filter(
      (r) =>
        r.customer_name.toLowerCase().includes(s) ||
        (r.phone && r.phone.toLowerCase().includes(s)) ||
        (r.email && r.email.toLowerCase().includes(s)) ||
        (r.notes && r.notes.toLowerCase().includes(s)) ||
        (r.room_name && r.room_name.toLowerCase().includes(s)) ||
        (r.table_name_or_number && r.table_name_or_number.toLowerCase().includes(s))
    );
  }

  return list;
}

/**
 * Consulta una reserva específica por su ID.
 */
export async function getReservationById(
  businessId: string,
  reservationId: string
): Promise<ReservationWithDetails | null> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      *,
      restaurant_rooms:room_id (name),
      restaurant_tables:table_id (name_or_number, capacity)
    `
    )
    .eq("business_id", businessId)
    .eq("id", reservationId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    business_id: data.business_id,
    customer_name: data.customer_name,
    phone: data.phone,
    email: data.email,
    party_size: data.party_size,
    date: data.date,
    time: typeof data.time === "string" ? data.time.slice(0, 5) : data.time,
    room_id: data.room_id,
    table_id: data.table_id,
    status: data.status,
    origin: data.origin,
    special_requests: data.special_requests,
    allergies: data.allergies,
    notes: data.notes,
    min_spend: Number(data.min_spend || 0),
    deposit_amount: Number(data.deposit_amount || 0),
    created_at: data.created_at,
    updated_at: data.updated_at,
    room_name: data.restaurant_rooms?.name || null,
    table_name_or_number: data.restaurant_tables?.name_or_number || null,
    table_capacity: data.restaurant_tables?.capacity || null,
  };
}

/**
 * Crea una nueva reserva en el sistema.
 */
export async function createReservation(
  businessId: string,
  rawInput: CreateReservationInput
): Promise<ReservationWithDetails> {
  const validated = CreateReservationSchema.parse(rawInput);
  const supabase = await getSupabase();

  let roomId = validated.room_id || null;
  const tableId = validated.table_id || null;

  // Si se seleccionó una mesa y no una sala, deducir la sala de la mesa
  if (tableId && !roomId) {
    const { data: tableData } = await supabase
      .from("restaurant_tables")
      .select("room_id")
      .eq("business_id", businessId)
      .eq("id", tableId)
      .maybeSingle();

    if (tableData?.room_id) {
      roomId = tableData.room_id;
    }
  }

  // Normalizar hora para formato time (HH:mm:00)
  let timeNormalized = validated.time.trim();
  if (timeNormalized.length === 5) {
    timeNormalized += ":00";
  }

  const insertPayload = {
    business_id: businessId,
    customer_name: validated.customer_name.trim(),
    phone: validated.phone?.trim() || null,
    email: validated.email?.trim() || null,
    party_size: validated.party_size,
    date: validated.date,
    time: timeNormalized,
    room_id: roomId,
    table_id: tableId,
    status: validated.status || "confirmed",
    origin: validated.origin || "direct",
    special_requests: validated.special_requests?.trim() || null,
    allergies: validated.allergies?.trim() || null,
    notes: validated.notes?.trim() || null,
    min_spend: validated.min_spend || 0,
    deposit_amount: validated.deposit_amount || 0,
  };

  const { data, error } = await supabase
    .from("reservations")
    .insert(insertPayload)
    .select(
      `
      *,
      restaurant_rooms:room_id (name),
      restaurant_tables:table_id (name_or_number, capacity)
    `
    )
    .single();

  if (error || !data) {
    throw new Error(`No se pudo crear la reserva: ${error?.message || "Error desconocido"}`);
  }

  return {
    id: data.id,
    business_id: data.business_id,
    customer_name: data.customer_name,
    phone: data.phone,
    email: data.email,
    party_size: data.party_size,
    date: data.date,
    time: typeof data.time === "string" ? data.time.slice(0, 5) : data.time,
    room_id: data.room_id,
    table_id: data.table_id,
    status: data.status,
    origin: data.origin,
    special_requests: data.special_requests,
    allergies: data.allergies,
    notes: data.notes,
    min_spend: Number(data.min_spend || 0),
    deposit_amount: Number(data.deposit_amount || 0),
    created_at: data.created_at,
    updated_at: data.updated_at,
    room_name: data.restaurant_rooms?.name || null,
    table_name_or_number: data.restaurant_tables?.name_or_number || null,
    table_capacity: data.restaurant_tables?.capacity || null,
  };
}

/**
 * Actualiza los datos de una reserva existente.
 */
export async function updateReservation(
  businessId: string,
  reservationId: string,
  rawInput: UpdateReservationInput
): Promise<ReservationWithDetails> {
  const validated = UpdateReservationSchema.parse(rawInput);
  const supabase = await getSupabase();

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (validated.customer_name !== undefined) updatePayload.customer_name = validated.customer_name.trim();
  if (validated.phone !== undefined) updatePayload.phone = validated.phone?.trim() || null;
  if (validated.email !== undefined) updatePayload.email = validated.email?.trim() || null;
  if (validated.party_size !== undefined) updatePayload.party_size = validated.party_size;
  if (validated.date !== undefined) updatePayload.date = validated.date;
  if (validated.time !== undefined) {
    let t = validated.time.trim();
    if (t.length === 5) t += ":00";
    updatePayload.time = t;
  }
  if (validated.room_id !== undefined) updatePayload.room_id = validated.room_id || null;
  if (validated.table_id !== undefined) updatePayload.table_id = validated.table_id || null;
  if (validated.status !== undefined) updatePayload.status = validated.status;
  if (validated.origin !== undefined) updatePayload.origin = validated.origin;
  if (validated.special_requests !== undefined) updatePayload.special_requests = validated.special_requests?.trim() || null;
  if (validated.allergies !== undefined) updatePayload.allergies = validated.allergies?.trim() || null;
  if (validated.notes !== undefined) updatePayload.notes = validated.notes?.trim() || null;
  if (validated.min_spend !== undefined) updatePayload.min_spend = validated.min_spend;
  if (validated.deposit_amount !== undefined) updatePayload.deposit_amount = validated.deposit_amount;

  const { data, error } = await supabase
    .from("reservations")
    .update(updatePayload)
    .eq("business_id", businessId)
    .eq("id", reservationId)
    .select(
      `
      *,
      restaurant_rooms:room_id (name),
      restaurant_tables:table_id (name_or_number, capacity)
    `
    )
    .single();

  if (error || !data) {
    throw new Error(`Error al actualizar reserva: ${error?.message || "Reserva no encontrada"}`);
  }

  return {
    id: data.id,
    business_id: data.business_id,
    customer_name: data.customer_name,
    phone: data.phone,
    email: data.email,
    party_size: data.party_size,
    date: data.date,
    time: typeof data.time === "string" ? data.time.slice(0, 5) : data.time,
    room_id: data.room_id,
    table_id: data.table_id,
    status: data.status,
    origin: data.origin,
    special_requests: data.special_requests,
    allergies: data.allergies,
    notes: data.notes,
    min_spend: Number(data.min_spend || 0),
    deposit_amount: Number(data.deposit_amount || 0),
    created_at: data.created_at,
    updated_at: data.updated_at,
    room_name: data.restaurant_rooms?.name || null,
    table_name_or_number: data.restaurant_tables?.name_or_number || null,
    table_capacity: data.restaurant_tables?.capacity || null,
  };
}

/**
 * Asigna o desasigna una mesa a una reserva.
 */
export async function assignReservationTable(
  businessId: string,
  input: AssignReservationTableInput
): Promise<ReservationWithDetails> {
  const supabase = await getSupabase();

  let roomId = input.roomId || null;
  const tableId = input.tableId || null;

  if (tableId && !roomId) {
    const { data: tableData } = await supabase
      .from("restaurant_tables")
      .select("room_id")
      .eq("business_id", businessId)
      .eq("id", tableId)
      .maybeSingle();

    if (tableData?.room_id) {
      roomId = tableData.room_id;
    }
  }

  const { data, error } = await supabase
    .from("reservations")
    .update({
      table_id: tableId,
      ...(roomId ? { room_id: roomId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("id", input.reservationId)
    .select(
      `
      *,
      restaurant_rooms:room_id (name),
      restaurant_tables:table_id (name_or_number, capacity)
    `
    )
    .single();

  if (error || !data) {
    throw new Error(`Error al asignar mesa: ${error?.message || "Reserva no encontrada"}`);
  }

  return {
    id: data.id,
    business_id: data.business_id,
    customer_name: data.customer_name,
    phone: data.phone,
    email: data.email,
    party_size: data.party_size,
    date: data.date,
    time: typeof data.time === "string" ? data.time.slice(0, 5) : data.time,
    room_id: data.room_id,
    table_id: data.table_id,
    status: data.status,
    origin: data.origin,
    special_requests: data.special_requests,
    allergies: data.allergies,
    notes: data.notes,
    min_spend: Number(data.min_spend || 0),
    deposit_amount: Number(data.deposit_amount || 0),
    created_at: data.created_at,
    updated_at: data.updated_at,
    room_name: data.restaurant_rooms?.name || null,
    table_name_or_number: data.restaurant_tables?.name_or_number || null,
    table_capacity: data.restaurant_tables?.capacity || null,
  };
}

/**
 * Cambia el estado de una reserva (ej: checked_in al llegar, seated al sentar, cancelled, etc.).
 */
export async function updateReservationStatus(
  businessId: string,
  reservationId: string,
  status: ReservationStatus,
  tableId?: string | null
): Promise<ReservationWithDetails> {
  const supabase = await getSupabase();

  const updateFields: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (tableId !== undefined) {
    updateFields.table_id = tableId;
  }

  const { data, error } = await supabase
    .from("reservations")
    .update(updateFields)
    .eq("business_id", businessId)
    .eq("id", reservationId)
    .select(
      `
      *,
      restaurant_rooms:room_id (name),
      restaurant_tables:table_id (name_or_number, capacity)
    `
    )
    .single();

  if (error || !data) {
    throw new Error(`Error al actualizar estado de la reserva: ${error?.message || "Reserva no encontrada"}`);
  }

  return {
    id: data.id,
    business_id: data.business_id,
    customer_name: data.customer_name,
    phone: data.phone,
    email: data.email,
    party_size: data.party_size,
    date: data.date,
    time: typeof data.time === "string" ? data.time.slice(0, 5) : data.time,
    room_id: data.room_id,
    table_id: data.table_id,
    status: data.status,
    origin: data.origin,
    special_requests: data.special_requests,
    allergies: data.allergies,
    notes: data.notes,
    min_spend: Number(data.min_spend || 0),
    deposit_amount: Number(data.deposit_amount || 0),
    created_at: data.created_at,
    updated_at: data.updated_at,
    room_name: data.restaurant_rooms?.name || null,
    table_name_or_number: data.restaurant_tables?.name_or_number || null,
    table_capacity: data.restaurant_tables?.capacity || null,
  };
}

/**
 * Elimina una reserva del sistema.
 */
export async function deleteReservation(
  businessId: string,
  reservationId: string
): Promise<boolean> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from("reservations")
    .delete()
    .eq("business_id", businessId)
    .eq("id", reservationId);

  if (error) {
    throw new Error(`Error al eliminar reserva: ${error.message}`);
  }

  return true;
}

/**
 * Calcula los indicadores y KPIs de reservas para un día determinado:
 * - Reservas Hoy
 * - Próximos 7 Días
 * - Walk-ins
 * - Ocupación (%)
 */
export async function getReservationMetrics(
  businessId: string,
  targetDate?: string
): Promise<ReservationMetrics> {
  const supabase = await getSupabase();

  // Fecha base en formato YYYY-MM-DD
  const today = targetDate || new Date().toISOString().split("T")[0];

  // Calcular fecha a 7 días
  const baseDateObj = new Date(today + "T00:00:00");
  const next7DaysObj = new Date(baseDateObj);
  next7DaysObj.setDate(next7DaysObj.getDate() + 7);
  const next7DaysStr = next7DaysObj.toISOString().split("T")[0];

  // 1. Obtener reservas del rango (hoy a 7 días)
  const { data: rangeReservations } = await supabase
    .from("reservations")
    .select("id, date, status, origin, party_size, table_id")
    .eq("business_id", businessId)
    .gte("date", today)
    .lte("date", next7DaysStr)
    .neq("status", "cancelled");

  // 2. Obtener capacidad y cantidad de mesas del negocio para calcular tasa de ocupación
  const { data: tablesData } = await supabase
    .from("restaurant_tables")
    .select("id, capacity")
    .eq("business_id", businessId);

  const totalTables = tablesData?.length || 0;
  const totalCapacity = (tablesData || []).reduce((acc: number, t: any) => acc + (t.capacity || 4), 0);

  const reservationsList = rangeReservations || [];

  const todayReservations = reservationsList.filter((r: any) => r.date === today);
  const todayCount = todayReservations.length;
  const next7DaysCount = reservationsList.length;

  const walkInsCount = todayReservations.filter((r: any) => r.origin === "walk_in").length;
  const confirmedTodayCount = todayReservations.filter((r: any) => r.status === "confirmed").length;
  const checkedInTodayCount = todayReservations.filter((r: any) => r.status === "checked_in").length;
  const seatedTodayCount = todayReservations.filter((r: any) => r.status === "seated").length;

  const totalGuestsToday = todayReservations.reduce((sum: number, r: any) => sum + (Number(r.party_size) || 0), 0);

  // Ocupación: basada en proporción de mesas reservadas para hoy vs total de mesas
  const reservedTablesToday = new Set(todayReservations.map((r: any) => r.table_id).filter(Boolean)).size;
  let occupancyRate = 0;
  if (totalTables > 0) {
    occupancyRate = Math.min(100, Math.round((reservedTablesToday / totalTables) * 100));
  } else if (totalCapacity > 0) {
    occupancyRate = Math.min(100, Math.round((totalGuestsToday / totalCapacity) * 100));
  } else if (todayCount > 0) {
    occupancyRate = Math.min(100, todayCount * 15);
  }

  return {
    todayCount,
    next7DaysCount,
    walkInsCount,
    occupancyRate,
    totalGuestsToday,
    confirmedTodayCount,
    checkedInTodayCount,
    seatedTodayCount,
  };
}

