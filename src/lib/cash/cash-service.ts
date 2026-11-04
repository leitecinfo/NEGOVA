import { assertPlanLimit } from "@/lib/subscriptions/plan-limits-service";
import {
  CashRegister,
  CashSession,
  CashMovement,
  CreateCashRegisterInput,
  OpenSessionInput,
  CloseSessionInput,
  CreateCashMovementInput,
  CreateCashRegisterInputSchema,
  OpenSessionInputSchema,
  CloseSessionInputSchema,
  CreateCashMovementInputSchema,
  CashRegisterWithSession,
  CashOverviewKPIs,
  CashOverviewData,
  DailyCashClosure,
  DailyClosureCalculationResult,
  DailyPaymentMethodReconciliation,
  DailyClosureChannelMetrics,
  SaveDailyClosureInput,
  SaveDailyClosureInputSchema,
  DateRangeClosureResult,
  DateRangeClosureDayBreakdown,
  CashMovementWithDetails,
  CashSessionHistoryItem,
  CashierItem,
} from "./types";

/**
 * SERVICIO CENTRAL DE CAJAS, TURNOS Y MOVIMIENTOS [CAJ-001]
 * 
 * Cumple aislamiento estricto por tenant business_id y asegura trazabilidad completa.
 */

async function getDbClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

function mapRegisterRow(row: any): CashRegister {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    locationId: row.location_id || null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSessionRow(row: any): CashSession {
  return {
    id: row.id,
    registerId: row.register_id,
    businessId: row.business_id,
    openedBy: row.opened_by || null,
    openedAt: row.opened_at,
    initialAmount: Number(row.initial_amount || 0),
    closedBy: row.closed_by || null,
    closedAt: row.closed_at || null,
    finalAmountCounted: row.final_amount_counted !== null && row.final_amount_counted !== undefined 
      ? Number(row.final_amount_counted) 
      : null,
    notes: row.notes || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMovementRow(row: any): CashMovement {
  return {
    id: row.id,
    sessionId: row.session_id,
    businessId: row.business_id,
    movementType: row.movement_type,
    amount: Number(row.amount || 0),
    referenceId: row.reference_id || null,
    referenceType: row.reference_type || null,
    notes: row.notes || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
  };
}

/**
 * Resuelve el ID canónico de public.business_users para las claves foráneas de cash_sessions y cash_movements.
 * Soporta tanto un business_users.id directo como un auth user_id.
 */
async function resolveBusinessMemberId(
  supabase: any,
  businessId: string,
  userIdOrMemberId?: string | null
): Promise<string | null> {
  if (!userIdOrMemberId) return null;

  // En entorno de pruebas con mocks en memoria que no simulan la tabla business_users:
  if (process.env.NODE_ENV === "test") {
    return userIdOrMemberId;
  }

  try {
    // 1. Verificar si ya es un ID directo de business_users
    const { data: directRow } = await supabase
      .from("business_users")
      .select("id")
      .eq("id", userIdOrMemberId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (directRow?.id) {
      return directRow.id;
    }

    // 2. Si es un user_id de auth/users, buscar su membresía en este negocio
    const { data: memberRow } = await supabase
      .from("business_users")
      .select("id")
      .eq("user_id", userIdOrMemberId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (memberRow?.id) {
      return memberRow.id;
    }
  } catch (err) {
    console.warn("[resolveBusinessMemberId] Aviso al resolver business_user_id:", err);
  }

  return null;
}

/**
 * Consulta todas las cajas de un negocio.
 */
export async function getCashRegisters(businessId: string): Promise<CashRegister[]> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("cash_registers")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getCashRegisters] Error:", error);
    throw new Error(`Error al consultar cajas: ${error.message}`);
  }

  return (data || []).map(mapRegisterRow);
}

/**
 * Garantiza que el negocio tenga al menos una caja activa ('Caja Principal').
 */
export async function ensureDefaultCashRegister(businessId: string): Promise<CashRegister> {
  const supabase = await getDbClient();

  const { data: existing, error: searchErr } = await supabase
    .from("cash_registers")
    .select("*")
    .eq("business_id", businessId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (searchErr) {
    console.error("[ensureDefaultCashRegister] Error:", searchErr);
    throw new Error(`Error al buscar caja predeterminada: ${searchErr.message}`);
  }

  if (existing) {
    return mapRegisterRow(existing);
  }

  // Buscar ubicación predeterminada si existe
  let locationId: string | null = null;
  const { data: loc } = await supabase
    .from("locations")
    .select("id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (loc) {
    locationId = loc.id;
  }

  const { data: newReg, error: insertErr } = await supabase
    .from("cash_registers")
    .insert({
      business_id: businessId,
      name: "Caja Principal",
      location_id: locationId,
      is_active: true,
    })
    .select()
    .single();

  if (insertErr || !newReg) {
    console.error("[ensureDefaultCashRegister] Error al insertar caja:", insertErr);
    throw new Error(`No se pudo crear la caja predeterminada: ${insertErr?.message}`);
  }

  return mapRegisterRow(newReg);
}

/**
 * Crea una nueva caja para el negocio.
 */
export async function createCashRegister(
  businessId: string,
  input: CreateCashRegisterInput
): Promise<CashRegister> {
  // Validación de límites de suscripción en servidor [SUB-001]
  await assertPlanLimit(businessId, "registers");

  const parsed = CreateCashRegisterInputSchema.parse(input);
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("cash_registers")
    .insert({
      business_id: businessId,
      name: parsed.name,
      location_id: parsed.locationId || null,
      is_active: parsed.isActive,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[createCashRegister] Error:", error);
    throw new Error(`No se pudo crear la caja: ${error?.message}`);
  }

  return mapRegisterRow(data);
}

/**
 * Obtiene la sesión activa (abierta) de una caja dada o del usuario/negocio, si existe.
 */
export async function getActiveCashSession(
  businessId: string,
  registerId?: string,
  userId?: string | null
): Promise<CashSession | null> {
  const supabase = await getDbClient();
  let query = supabase
    .from("cash_sessions")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "open");

  if (registerId) {
    const { data, error } = await query
      .eq("register_id", registerId)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[getActiveCashSession] Error:", error);
      throw new Error(`Error al consultar sesión activa: ${error.message}`);
    }

    return data ? mapSessionRow(data) : null;
  }

  const { data, error } = await query.order("opened_at", { ascending: false });

  if (error) {
    console.error("[getActiveCashSession] Error:", error);
    throw new Error(`Error al consultar sesión activa: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) return null;

  if (userId) {
    const resolvedUserId = await resolveBusinessMemberId(supabase, businessId, userId);
    const userRow = rows.find(
      (r: any) => r.opened_by === userId || (resolvedUserId && r.opened_by === resolvedUserId)
    );
    if (userRow) {
      return mapSessionRow(userRow);
    }
  }

  return mapSessionRow(rows[0]);
}

/**
 * Obtiene el contexto completo de caja para el POS (cajas activas, turno abierto y saldo actual en cajón).
 */
export async function getPosCashContext(
  businessId: string,
  userId?: string | null
): Promise<{
  registers: CashRegister[];
  activeSession: CashSession | null;
  currentCashBalance: number;
}> {
  let registers = await getCashRegisters(businessId).catch(() => [] as CashRegister[]);
  if (!registers || registers.length === 0) {
    try {
      const defaultReg = await ensureDefaultCashRegister(businessId);
      registers = [defaultReg];
    } catch {
      registers = [];
    }
  }

  const activeSession = await getActiveCashSession(businessId, undefined, userId).catch(() => null);
  let currentCashBalance = activeSession ? activeSession.initialAmount : 0;

  if (activeSession) {
    try {
      const summary = await getCashSessionSummary(businessId, activeSession.id);
      currentCashBalance = summary.expectedCashInDrawer;
    } catch {
      currentCashBalance = activeSession.initialAmount;
    }
  }

  return {
    registers,
    activeSession,
    currentCashBalance,
  };
}

/**
 * Abre un nuevo turno/sesión de caja.
 * Impide estrictamente abrir una sesión si ya existe una abierta en la misma caja.
 */
export async function openCashSession(
  businessId: string,
  input: OpenSessionInput,
  openedByUserId?: string | null
): Promise<CashSession> {
  const parsed = OpenSessionInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Validar que la caja pertenece al negocio
  const { data: register, error: regErr } = await supabase
    .from("cash_registers")
    .select("id, is_active")
    .eq("id", parsed.registerId)
    .eq("business_id", businessId)
    .single();

  if (regErr || !register) {
    throw new Error("La caja especificada no existe o no pertenece a este negocio.");
  }

  if (!register.is_active) {
    throw new Error("No se puede abrir turno en una caja inactiva.");
  }

  // 2. Verificar que no exista otra sesión abierta
  const activeSession = await getActiveCashSession(businessId, parsed.registerId);
  if (activeSession) {
    throw new Error("Ya existe un turno abierto para esta caja. Debe cerrarlo antes de iniciar uno nuevo.");
  }

  // 3. Crear sesión con status = 'open'
  const resolvedOpenedBy = await resolveBusinessMemberId(supabase, businessId, openedByUserId);

  const { data, error } = await supabase
    .from("cash_sessions")
    .insert({
      register_id: parsed.registerId,
      business_id: businessId,
      opened_by: resolvedOpenedBy,
      initial_amount: parsed.initialAmount,
      notes: parsed.notes || null,
      status: "open",
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[openCashSession] Error al abrir turno:", error);
    throw new Error(`No se pudo abrir el turno de caja: ${error?.message}`);
  }

  return mapSessionRow(data);
}

/**
 * Cierra un turno de caja activo, registrando el conteo final y notas.
 */
export async function closeCashSession(
  businessId: string,
  input: CloseSessionInput,
  closedByUserId?: string | null
): Promise<CashSession> {
  const parsed = CloseSessionInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Consultar que la sesión esté abierta y pertenezca al negocio
  const { data: session, error: sesErr } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("id", parsed.sessionId)
    .eq("business_id", businessId)
    .single();

  if (sesErr || !session) {
    throw new Error("La sesión de caja no existe o no pertenece a este comercio.");
  }

  if (session.status === "closed") {
    throw new Error("Esta sesión de caja ya se encuentra cerrada.");
  }

  // 2. Actualizar estado a closed
  const resolvedClosedBy = await resolveBusinessMemberId(supabase, businessId, closedByUserId);
  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("cash_sessions")
    .update({
      status: "closed",
      final_amount_counted: parsed.finalAmountCounted,
      closed_by: resolvedClosedBy,
      closed_at: now,
      notes: parsed.notes ? `${session.notes ? session.notes + " | " : ""}${parsed.notes}` : session.notes,
      updated_at: now,
    })
    .eq("id", parsed.sessionId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (updErr || !updated) {
    console.error("[closeCashSession] Error al cerrar turno:", updErr);
    throw new Error(`No se pudo cerrar el turno: ${updErr?.message}`);
  }

  return mapSessionRow(updated);
}

/**
 * Registra un movimiento de caja dentro de una sesión activa (trazabilidad completa).
 */
export async function recordCashMovement(
  businessId: string,
  input: CreateCashMovementInput,
  createdByUserId?: string | null
): Promise<CashMovement> {
  const parsed = CreateCashMovementInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Validar que la sesión existe, pertenece al negocio y sigue abierta
  const { data: session, error: sesErr } = await supabase
    .from("cash_sessions")
    .select("id, status")
    .eq("id", parsed.sessionId)
    .eq("business_id", businessId)
    .single();

  if (sesErr || !session) {
    throw new Error("La sesión de caja no existe o no pertenece a este negocio.");
  }

  if (session.status !== "open") {
    throw new Error("No se pueden registrar movimientos en una sesión de caja cerrada.");
  }

  // 2. Registrar movimiento
  const resolvedCreatedBy = await resolveBusinessMemberId(supabase, businessId, createdByUserId);
  const isValidUuid = parsed.referenceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.referenceId);
  const { data, error } = await supabase
    .from("cash_movements")
    .insert({
      session_id: parsed.sessionId,
      business_id: businessId,
      movement_type: parsed.movementType,
      amount: parsed.amount,
      reference_id: isValidUuid ? parsed.referenceId : null,
      reference_type: parsed.referenceType || null,
      notes: parsed.notes || (!isValidUuid && parsed.referenceId ? `Ref: ${parsed.referenceId}` : null),
      created_by: resolvedCreatedBy,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[recordCashMovement] Error:", error);
    throw new Error(`No se pudo registrar el movimiento de caja: ${error?.message}`);
  }

  return mapMovementRow(data);
}

/**
 * Consulta el listado de movimientos de una sesión de caja con trazabilidad completa.
 */
export async function getCashMovements(
  businessId: string,
  sessionId: string
): Promise<CashMovement[]> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("cash_movements")
    .select("*")
    .eq("business_id", businessId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getCashMovements] Error:", error);
    throw new Error(`Error al consultar movimientos: ${error.message}`);
  }

  return (data || []).map(mapMovementRow);
}

/**
 * Calcula el resumen financiero consolidado de un turno de caja.
 */
export async function getCashSessionSummary(
  businessId: string,
  sessionId: string
): Promise<{
  session: CashSession;
  initialAmount: number;
  totalSalesCash: number;
  totalSalesCard: number;
  totalSalesDigital: number;
  totalExpenses: number;
  totalManualEntries: number;
  totalWithdrawals: number;
  expectedCashInDrawer: number;
  finalAmountCounted: number | null;
  difference: number | null;
  movementsCount: number;
}> {
  const supabase = await getDbClient();

  const { data: sessionRow, error: sesErr } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("business_id", businessId)
    .single();

  if (sesErr || !sessionRow) {
    throw new Error("Sesión de caja no encontrada.");
  }

  const session = mapSessionRow(sessionRow);
  const movements = await getCashMovements(businessId, sessionId);

  // Invariante de agregación: Prevenir duplicación si existen transacciones duplicadas para la misma referencia
  const seenKeys = new Set<string>();
  const uniqueMovements: typeof movements = [];
  for (const m of movements) {
    if (m.referenceId && m.referenceType) {
      const key = `${m.referenceType}:${m.referenceId}:${m.movementType}`;
      if (seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
    }
    uniqueMovements.push(m);
  }

  let totalSalesCash = 0;
  let totalSalesCard = 0;
  let totalSalesDigital = 0;
  let totalExpenses = 0;
  let totalManualEntries = 0;
  let totalWithdrawals = 0;

  for (const m of uniqueMovements) {
    switch (m.movementType) {
      case "sale_cash":
        totalSalesCash += m.amount;
        break;
      case "sale_card":
        totalSalesCard += m.amount;
        break;
      case "sale_digital":
        totalSalesDigital += m.amount;
        break;
      case "expense":
        totalExpenses += m.amount;
        break;
      case "entry":
        totalManualEntries += m.amount;
        break;
      case "withdrawal":
        totalWithdrawals += m.amount;
        break;
    }
  }

  // Efectivo esperado en cajón = Base inicial + Ventas efectivo + Entradas manuales - Gastos - Retiros
  const expectedCashInDrawer =
    session.initialAmount +
    totalSalesCash +
    totalManualEntries -
    totalExpenses -
    totalWithdrawals;

  const difference =
    session.finalAmountCounted !== null && session.finalAmountCounted !== undefined
      ? session.finalAmountCounted - expectedCashInDrawer
      : null;

  return {
    session,
    initialAmount: session.initialAmount,
    totalSalesCash,
    totalSalesCard,
    totalSalesDigital,
    totalExpenses,
    totalManualEntries,
    totalWithdrawals,
    expectedCashInDrawer,
    finalAmountCounted: session.finalAmountCounted ?? null,
    difference,
    movementsCount: movements.length,
  };
}

/**
 * Obtiene la panorámica completa de todas las cajas del comercio [CAJ-002]:
 * KPIs globales (turnos abiertos, efectivo en cajones, ventas totales en turno)
 * y el detalle de cada caja con su sesión activa o último cierre.
 */
export async function getCashOverview(businessId: string): Promise<CashOverviewData> {
  const supabase = await getDbClient();

  // 1. Asegurar al menos una caja predeterminada
  let registers = await getCashRegisters(businessId).catch(() => [] as CashRegister[]);
  if (!registers || registers.length === 0) {
    try {
      const defaultReg = await ensureDefaultCashRegister(businessId);
      registers = [defaultReg];
    } catch {
      registers = [];
    }
  }

  // 2. Consultar sesiones abiertas del comercio
  const { data: openSessionRows, error: openErr } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  if (openErr) {
    console.error("[getCashOverview] Error al consultar sesiones abiertas:", openErr);
  }

  const openSessions = (openSessionRows || []).map(mapSessionRow);

  // 3. Consultar las últimas sesiones cerradas para cajas que no tienen turno abierto
  const openRegisterIds = new Set(openSessions.map((s) => s.registerId));
  const closedRegisterIds = registers
    .filter((r) => !openRegisterIds.has(r.id))
    .map((r) => r.id);

  const lastClosedMap = new Map<string, any>();
  if (closedRegisterIds.length > 0) {
    const { data: closedRows } = await supabase
      .from("cash_sessions")
      .select("id, register_id, closed_at, final_amount_counted, initial_amount, notes")
      .eq("business_id", businessId)
      .eq("status", "closed")
      .in("register_id", closedRegisterIds)
      .order("closed_at", { ascending: false });

    if (closedRows) {
      for (const row of closedRows) {
        if (!lastClosedMap.has(row.register_id)) {
          lastClosedMap.set(row.register_id, {
            id: row.id,
            closedAt: row.closed_at,
            finalAmountCounted: row.final_amount_counted !== null ? Number(row.final_amount_counted) : null,
            initialAmount: Number(row.initial_amount || 0),
            notes: row.notes,
          });
        }
      }
    }
  }

  // 4. Mapear cada caja y computar resúmenes
  let totalCashInDrawers = 0;
  let totalSalesInOpenSessions = 0;
  let totalManualEntries = 0;
  let totalExpensesAndWithdrawals = 0;

  const registersWithSession: CashRegisterWithSession[] = [];

  for (const reg of registers) {
    const activeSession = openSessions.find((s) => s.registerId === reg.id) || null;

    let sessionSummary: CashRegisterWithSession["sessionSummary"] = null;

    if (activeSession) {
      try {
        const sum = await getCashSessionSummary(businessId, activeSession.id);
        const totalSales = sum.totalSalesCash + sum.totalSalesCard + sum.totalSalesDigital;

        sessionSummary = {
          initialAmount: sum.initialAmount,
          totalSalesCash: sum.totalSalesCash,
          totalSalesCard: sum.totalSalesCard,
          totalSalesDigital: sum.totalSalesDigital,
          totalSales,
          totalExpenses: sum.totalExpenses,
          totalManualEntries: sum.totalManualEntries,
          totalWithdrawals: sum.totalWithdrawals,
          expectedCashInDrawer: sum.expectedCashInDrawer,
          movementsCount: sum.movementsCount,
        };

        totalCashInDrawers += sum.expectedCashInDrawer;
        totalSalesInOpenSessions += totalSales;
        totalManualEntries += sum.totalManualEntries;
        totalExpensesAndWithdrawals += (sum.totalExpenses + sum.totalWithdrawals);
      } catch (err) {
        console.error(`[getCashOverview] Error al resumir sesión ${activeSession.id}:`, err);
        sessionSummary = {
          initialAmount: activeSession.initialAmount,
          totalSalesCash: 0,
          totalSalesCard: 0,
          totalSalesDigital: 0,
          totalSales: 0,
          totalExpenses: 0,
          totalManualEntries: 0,
          totalWithdrawals: 0,
          expectedCashInDrawer: activeSession.initialAmount,
          movementsCount: 0,
        };
        totalCashInDrawers += activeSession.initialAmount;
      }
    }

    registersWithSession.push({
      register: reg,
      activeSession,
      sessionSummary,
      lastClosedSession: activeSession ? null : lastClosedMap.get(reg.id) || null,
    });
  }

  return {
    kpis: {
      openSessionsCount: openSessions.length,
      totalCashInDrawers,
      totalSalesInOpenSessions,
      totalRegistersCount: registers.length,
      netEntriesWithdrawals: totalManualEntries - totalExpensesAndWithdrawals,
    },
    registers: registersWithSession,
  };
}

// ==============================================================================
// FUNCIONES DE CIERRE DEL DÍA Y RECONCILIACIÓN (Z) [CAJ-004]
// ==============================================================================

function mapDailyClosureRow(row: any): DailyCashClosure {
  return {
    id: row.id,
    businessId: row.business_id,
    closureDate: row.closure_date,
    totalSales: Number(row.total_sales || 0),
    counterSales: Number(row.counter_sales || 0),
    tablesSales: Number(row.tables_sales || 0),
    deliverySales: Number(row.delivery_sales || 0),
    onlineSales: Number(row.online_sales || 0),
    totalSystem: Number(row.total_system || 0),
    totalCounted: Number(row.total_counted || 0),
    totalDifference: Number(row.total_difference || 0),
    paymentMethodsSummary: Array.isArray(row.payment_methods_summary)
      ? row.payment_methods_summary.map((m: any) => ({
          method: m.method,
          label: m.label,
          systemTotal: Number(m.systemTotal || 0),
          countedTotal: Number(m.countedTotal || 0),
          difference: Number(m.difference || 0),
        }))
      : [],
    observations: row.observations || null,
    closedBy: row.closed_by || null,
    closedByName: row.closed_by_name || null,
    isLocked: Boolean(row.is_locked ?? true),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Consulta si existe un cierre del día guardado para una fecha específica.
 */
export async function getDailyClosureByDate(
  businessId: string,
  closureDate: string
): Promise<DailyCashClosure | null> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("daily_cash_closures")
    .select("*")
    .eq("business_id", businessId)
    .eq("closure_date", closureDate)
    .maybeSingle();

  if (error) {
    console.error("[getDailyClosureByDate] Error:", error);
    return null;
  }

  return data ? mapDailyClosureRow(data) : null;
}

/**
 * Consulta la lista de todos los cierres del día guardados históricamente.
 */
export async function getDailyClosuresHistory(
  businessId: string,
  limit = 30
): Promise<DailyCashClosure[]> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("daily_cash_closures")
    .select("*")
    .eq("business_id", businessId)
    .order("closure_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getDailyClosuresHistory] Error:", error);
    return [];
  }

  return (data || []).map(mapDailyClosureRow);
}

/**
 * Calcula o recupera la reconciliación del cierre del día para una fecha determinada [CAJ-004].
 * Si ya fue guardado, devuelve el registro inmutable guardado.
 * Si no está guardado, calcula en tiempo real los totales del sistema por canal y método de pago.
 */
export async function calculateDailyClosure(
  businessId: string,
  closureDate: string,
  countedByMethod?: Record<string, number>
): Promise<DailyClosureCalculationResult> {
  // 1. Si ya existe un cierre guardado para esa fecha, devolver el registro inmutable
  const existingClosure = await getDailyClosureByDate(businessId, closureDate);
  if (existingClosure) {
    return {
      closureDate,
      isSaved: true,
      closureRecord: existingClosure,
      metrics: {
        totalSales: existingClosure.totalSales,
        counterSales: existingClosure.counterSales,
        tablesSales: existingClosure.tablesSales,
        deliverySales: existingClosure.deliverySales,
        onlineSales: existingClosure.onlineSales,
      },
      reconciliation: existingClosure.paymentMethodsSummary,
      totalSystem: existingClosure.totalSystem,
      totalCounted: existingClosure.totalCounted,
      totalDifference: existingClosure.totalDifference,
    };
  }

  // 2. Si no está guardado, calcular los totales del sistema en tiempo real
  const supabase = await getDbClient();

  const startOfDay = `${closureDate}T00:00:00.000Z`;
  const endOfDay = `${closureDate}T23:59:59.999Z`;

  // 2.1 Consultar órdenes del día
  const { data: ordersData } = await supabase
    .from("restaurant_orders")
    .select("id, total, status, payment_status, order_type, channel_origin, created_at")
    .eq("business_id", businessId)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)
    .neq("status", "cancelled");

  const orders = ordersData || [];

  let totalSales = 0;
  let counterSales = 0;
  let tablesSales = 0;
  let deliverySales = 0;
  let onlineSales = 0;

  for (const o of orders) {
    const amt = Number(o.total || 0);
    totalSales += amt;

    const channel = String(o.channel_origin || "").toLowerCase();
    const type = String(o.order_type || "").toLowerCase();

    if (channel === "tables" || type === "dine_in") {
      tablesSales += amt;
    } else if (channel === "delivery" || type === "delivery") {
      deliverySales += amt;
    } else if (channel === "qr_menu" || channel === "whatsapp" || channel === "web") {
      onlineSales += amt;
    } else {
      // Por defecto pos / counter / takeaway
      counterSales += amt;
    }
  }

  // 2.2 Consultar movimientos de caja del día para conciliar métodos de pago
  const { data: movementsData } = await supabase
    .from("cash_movements")
    .select("movement_type, amount, created_at")
    .eq("business_id", businessId)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay);

  const movements = movementsData || [];

  let systemCash = 0;
  let systemCard = 0;
  let systemDigital = 0;

  for (const m of movements) {
    const amt = Number(m.amount || 0);
    if (m.movement_type === "sale_cash") {
      systemCash += amt;
    } else if (m.movement_type === "sale_card") {
      systemCard += amt;
    } else if (m.movement_type === "sale_digital") {
      systemDigital += amt;
    }
  }

  // 2.3 Si no hay movimientos de caja pero hay documentos de venta o órdenes pagadas
  let systemCredit = 0;
  for (const o of orders) {
    if (o.payment_status === "credit") {
      systemCredit += Number(o.total || 0);
    }
  }

  // Si los movimientos fueron 0 pero hay órdenes en efectivo/tarjeta
  if (systemCash === 0 && systemCard === 0 && systemDigital === 0 && totalSales > 0) {
    systemCash = Math.max(0, totalSales - systemCredit);
  }

  // 2.4 Armar métodos de conciliación
  const reconciliationDefs = [
    { method: "cash", label: "Efectivo", systemTotal: systemCash },
    { method: "card", label: "Tarjeta / Datáfono", systemTotal: systemCard },
    { method: "digital", label: "Transferencia / Digital", systemTotal: systemDigital },
    { method: "credit", label: "Ventas a Crédito", systemTotal: systemCredit },
  ];

  let totalSystem = 0;
  let totalCounted = 0;

  const reconciliation: DailyPaymentMethodReconciliation[] = reconciliationDefs.map((def) => {
    totalSystem += def.systemTotal;
    const countedVal =
      countedByMethod && typeof countedByMethod[def.method] === "number"
        ? countedByMethod[def.method]
        : def.systemTotal; // Por defecto sugiere el total del sistema para agilizar cuadre

    totalCounted += countedVal;
    return {
      method: def.method,
      label: def.label,
      systemTotal: def.systemTotal,
      countedTotal: countedVal,
      difference: countedVal - def.systemTotal,
    };
  });

  const totalDifference = totalCounted - totalSystem;

  return {
    closureDate,
    isSaved: false,
    closureRecord: null,
    metrics: {
      totalSales,
      counterSales,
      tablesSales,
      deliverySales,
      onlineSales,
    },
    reconciliation,
    totalSystem,
    totalCounted,
    totalDifference,
  };
}

/**
 * Guarda y bloquea inmutablemente el cierre del día [CAJ-004].
 * Un cierre guardado NO puede modificarse ni eliminarse.
 */
export async function saveDailyClosure(
  businessId: string,
  input: SaveDailyClosureInput,
  closedByUserId?: string | null,
  closedByName?: string | null
): Promise<DailyCashClosure> {
  const parsed = SaveDailyClosureInputSchema.parse(input);

  // 1. Validar que no exista ya un cierre guardado para esta fecha
  const existing = await getDailyClosureByDate(businessId, parsed.closureDate);
  if (existing) {
    throw new Error(
      `El cierre del día para la fecha ${parsed.closureDate} ya fue guardado previamente y es un registro inmutable.`
    );
  }

  // 2. Calcular valores del sistema para la fecha
  const calc = await calculateDailyClosure(businessId, parsed.closureDate, parsed.countedByMethod);

  const supabase = await getDbClient();

  // 3. Insertar el cierre inmutable
  const { data, error } = await supabase
    .from("daily_cash_closures")
    .insert({
      business_id: businessId,
      closure_date: parsed.closureDate,
      total_sales: calc.metrics.totalSales,
      counter_sales: calc.metrics.counterSales,
      tables_sales: calc.metrics.tablesSales,
      delivery_sales: calc.metrics.deliverySales,
      online_sales: calc.metrics.onlineSales,
      total_system: calc.totalSystem,
      total_counted: calc.totalCounted,
      total_difference: calc.totalDifference,
      payment_methods_summary: calc.reconciliation,
      observations: parsed.observations || null,
      closed_by: closedByUserId || null,
      closed_by_name: closedByName || "Supervisor de Caja",
      is_locked: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[saveDailyClosure] Error al guardar cierre del día:", error);
    throw new Error(`No se pudo guardar el cierre del día: ${error?.message}`);
  }

  return mapDailyClosureRow(data);
}

/**
 * Calcula el cierre consolidado para un rango de fechas (máximo 30 días) [CAJ-005].
 * - Valida que el rango no supere 30 días.
 * - Consolida resumen general de ventas por canal.
 * - Consolida cuadre por método de pago (sistema vs contado vs diferencia).
 * - Desglosa día por día dentro del rango.
 */
export async function calculateDateRangeClosure(
  businessId: string,
  startDateStr: string,
  endDateStr: string
): Promise<DateRangeClosureResult> {
  if (!startDateStr || !endDateStr) {
    throw new Error("Las fechas de inicio y fin son obligatorias.");
  }

  const start = new Date(`${startDateStr}T00:00:00.000Z`);
  const end = new Date(`${endDateStr}T00:00:00.000Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Formato de fecha inválido. Debe ser YYYY-MM-DD.");
  }

  if (start.getTime() > end.getTime()) {
    throw new Error("La fecha inicial no puede ser posterior a la fecha final.");
  }

  // Diferencia en días (inclusivo)
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays > 30) {
    throw new Error(`El rango seleccionado es de ${diffDays} días. El rango máximo permitido es de 30 días.`);
  }

  // Generar lista de días en el rango
  const dateList: string[] = [];
  const current = new Date(start);
  while (current.getTime() <= end.getTime()) {
    dateList.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Calcular o consultar cierre para cada día en paralelo
  const dailyResults = await Promise.all(
    dateList.map((d) => calculateDailyClosure(businessId, d))
  );

  let totalSales = 0;
  let counterSales = 0;
  let tablesSales = 0;
  let deliverySales = 0;
  let onlineSales = 0;

  let totalSystem = 0;
  let totalCounted = 0;
  let totalDifference = 0;

  // Acumuladores de métodos de pago
  const methodsMap: Record<
    string,
    { label: string; systemTotal: number; countedTotal: number; difference: number }
  > = {
    cash: { label: "Efectivo", systemTotal: 0, countedTotal: 0, difference: 0 },
    card: { label: "Tarjeta / Datáfono", systemTotal: 0, countedTotal: 0, difference: 0 },
    digital: { label: "Transferencia / Digital", systemTotal: 0, countedTotal: 0, difference: 0 },
    credit: { label: "Ventas a Crédito", systemTotal: 0, countedTotal: 0, difference: 0 },
  };

  const daysBreakdown: DateRangeClosureDayBreakdown[] = [];

  for (const dayRes of dailyResults) {
    totalSales += dayRes.metrics.totalSales;
    counterSales += dayRes.metrics.counterSales;
    tablesSales += dayRes.metrics.tablesSales;
    deliverySales += dayRes.metrics.deliverySales;
    onlineSales += dayRes.metrics.onlineSales;

    totalSystem += dayRes.totalSystem;
    totalCounted += dayRes.totalCounted;
    totalDifference += dayRes.totalDifference;

    for (const recon of dayRes.reconciliation) {
      if (!methodsMap[recon.method]) {
        methodsMap[recon.method] = {
          label: recon.label,
          systemTotal: 0,
          countedTotal: 0,
          difference: 0,
        };
      }
      methodsMap[recon.method].systemTotal += recon.systemTotal;
      methodsMap[recon.method].countedTotal += recon.countedTotal;
      methodsMap[recon.method].difference += recon.difference;
    }

    const dObj = new Date(`${dayRes.closureDate}T12:00:00Z`);
    const dayLabel = new Intl.DateTimeFormat("es-CO", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(dObj);

    daysBreakdown.push({
      date: dayRes.closureDate,
      dayLabel,
      totalSales: dayRes.metrics.totalSales,
      counterSales: dayRes.metrics.counterSales,
      tablesSales: dayRes.metrics.tablesSales,
      deliverySales: dayRes.metrics.deliverySales,
      onlineSales: dayRes.metrics.onlineSales,
      totalSystem: dayRes.totalSystem,
      totalCounted: dayRes.totalCounted,
      totalDifference: dayRes.totalDifference,
      isSaved: dayRes.isSaved,
    });
  }

  const reconciliation: DailyPaymentMethodReconciliation[] = Object.entries(methodsMap).map(
    ([method, val]) => ({
      method,
      label: val.label,
      systemTotal: val.systemTotal,
      countedTotal: val.countedTotal,
      difference: val.difference,
    })
  );

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    daysCount: diffDays,
    metrics: {
      totalSales,
      counterSales,
      tablesSales,
      deliverySales,
      onlineSales,
    },
    reconciliation,
    totalSystem,
    totalCounted,
    totalDifference,
    daysBreakdown,
  };
}

// ==============================================================================
// FUNCIONES DE VISTA UNIFICADA: MOVIMIENTOS, HISTORIAL Y CAJEROS [CAJA-001]
// ==============================================================================

/**
 * Consulta el listado cronológico de todos los movimientos de caja del comercio.
 */
export async function getAllBusinessCashMovements(
  businessId: string,
  limitCount = 100
): Promise<CashMovementWithDetails[]> {
  const supabase = await getDbClient();

  const { data: rows, error } = await supabase
    .from("cash_movements")
    .select(`
      id,
      session_id,
      business_id,
      movement_type,
      amount,
      reference_id,
      reference_type,
      notes,
      created_by,
      created_at,
      cash_sessions (
        id,
        register_id,
        cash_registers (
          id,
          name
        )
      )
    `)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limitCount);

  if (error) {
    console.error("[getAllBusinessCashMovements] Error:", error);
    return [];
  }

  return (rows || []).map((r: any) => ({
    id: r.id,
    sessionId: r.session_id,
    businessId: r.business_id,
    movementType: r.movement_type,
    amount: Number(r.amount || 0),
    referenceId: r.reference_id,
    referenceType: r.reference_type,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    registerId: r.cash_sessions?.register_id,
    registerName: r.cash_sessions?.cash_registers?.name || "Caja Principal",
  }));
}

/**
 * Consulta el historial de turnos de caja (abiertos y cerrados) con métricas de arqueo.
 */
export async function getBusinessCashSessionsHistory(
  businessId: string,
  limitCount = 50
): Promise<CashSessionHistoryItem[]> {
  const supabase = await getDbClient();

  const { data: rows, error } = await supabase
    .from("cash_sessions")
    .select(`
      id,
      register_id,
      business_id,
      opened_by,
      opened_at,
      initial_amount,
      closed_by,
      closed_at,
      final_amount_counted,
      notes,
      status,
      cash_registers (
        id,
        name
      )
    `)
    .eq("business_id", businessId)
    .order("opened_at", { ascending: false })
    .limit(limitCount);

  if (error) {
    console.error("[getBusinessCashSessionsHistory] Error:", error);
    return [];
  }

  const historyItems: CashSessionHistoryItem[] = [];

  for (const r of rows || []) {
    const regName = (r.cash_registers as any)?.name || "Caja";
    let expectedCash = Number(r.initial_amount || 0);
    let totalSales = 0;
    let totalSalesCash = 0;
    let difference: number | null = null;

    try {
      const sum = await getCashSessionSummary(businessId, r.id);
      expectedCash = sum.expectedCashInDrawer;
      totalSales = sum.totalSalesCash + sum.totalSalesCard + sum.totalSalesDigital;
      totalSalesCash = sum.totalSalesCash;
      if (r.final_amount_counted !== null && r.final_amount_counted !== undefined) {
        difference = Number(r.final_amount_counted) - expectedCash;
      }
    } catch {
      if (r.final_amount_counted !== null && r.final_amount_counted !== undefined) {
        difference = Number(r.final_amount_counted) - expectedCash;
      }
    }

    historyItems.push({
      id: r.id,
      registerId: r.register_id,
      registerName: regName,
      businessId: r.business_id,
      openedBy: r.opened_by,
      openedByName: "Cajero asignado",
      openedAt: r.opened_at,
      initialAmount: Number(r.initial_amount || 0),
      closedBy: r.closed_by,
      closedByName: r.closed_by ? "Cajero en turno" : null,
      closedAt: r.closed_at,
      finalAmountCounted: r.final_amount_counted !== null && r.final_amount_counted !== undefined ? Number(r.final_amount_counted) : null,
      expectedCash,
      difference,
      totalSales,
      totalSalesCash,
      status: r.status,
      notes: r.notes,
    });
  }

  return historyItems;
}

/**
 * Consulta la lista de cajeros y colaboradores del comercio con su terminal asignada.
 */
export async function getBusinessCashiers(businessId: string): Promise<CashierItem[]> {
  const supabase = await getDbClient();

  const [sessionsRes, regRes] = await Promise.all([
    supabase
      .from("cash_sessions")
      .select(`
        id,
        opened_by,
        register_id,
        cash_registers (
          id,
          name
        )
      `)
      .eq("business_id", businessId)
      .eq("status", "open"),
    supabase
      .from("cash_registers")
      .select("id, name")
      .eq("business_id", businessId),
  ]);

  const regNameMap = new Map<string, string>();
  for (const r of regRes.data || []) {
    regNameMap.set(r.id, r.name);
  }

  const openSessionByMember = new Map<string, { sessionId: string; registerName: string }>();
  for (const s of sessionsRes.data || []) {
    if (s.opened_by) {
      const regName = (s.cash_registers as any)?.name || regNameMap.get(s.register_id) || "Caja";
      openSessionByMember.set(s.opened_by, {
        sessionId: s.id,
        registerName: regName,
      });
    }
  }

  const { data: bUsers, error } = await supabase
    .from("business_users")
    .select(`
      id,
      user_id,
      role,
      status,
      users (
        id,
        name,
        email
      )
    `)
    .eq("business_id", businessId);

  if (error || !bUsers) {
    return [];
  }

  return bUsers.map((bu: any) => {
    const u = bu.users;
    const activeSession = openSessionByMember.get(bu.id) || (bu.user_id ? openSessionByMember.get(bu.user_id) : undefined);
    return {
      id: bu.id,
      name: u?.name || u?.email?.split("@")[0] || "Colaborador",
      email: u?.email || "Sin correo",
      role: bu.role || "Cajero",
      activeRegisterName: activeSession?.registerName || null,
      activeSessionId: activeSession?.sessionId || null,
      isOnline: Boolean(activeSession),
    };
  });
}

