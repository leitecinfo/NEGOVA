"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getCashRegisters,
  ensureDefaultCashRegister,
  createCashRegister,
  getActiveCashSession,
  openCashSession,
  closeCashSession,
  recordCashMovement,
  getCashMovements,
  getCashSessionSummary,
  getCashOverview,
  calculateDailyClosure,
  saveDailyClosure,
  getDailyClosureByDate,
  getDailyClosuresHistory,
  calculateDateRangeClosure,
  getAllBusinessCashMovements,
  getBusinessCashSessionsHistory,
  getBusinessCashiers,
} from "@/lib/cash/cash-service";
import {
  generateDailyClosurePdf,
  generateDateRangeClosurePdf,
} from "@/lib/cash/daily-closure-pdf";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import type {
  CreateCashRegisterInput,
  OpenSessionInput,
  CloseSessionInput,
  CreateCashMovementInput,
  SaveDailyClosureInput,
} from "@/lib/cash/types";
import { revalidatePath } from "next/cache";

/**
 * Consulta las cajas registradoras del comercio.
 * Permiso requerido: cash.view
 */
export async function getCashRegistersAction(businessId: string) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver cajas.", data: [] };
  }

  try {
    const registers = await getCashRegisters(businessId);
    return { success: true, data: registers };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar cajas registradoras.", data: [] };
  }
}

/**
 * Crea una nueva caja registradora en el negocio.
 * Permiso requerido: cash.manage (exclusivo de administradores / Dueño)
 */
export async function createCashRegisterAction(
  businessId: string,
  input: CreateCashRegisterInput
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para crear cajas." };
  }

  try {
    const register = await createCashRegister(businessId, input);
    revalidatePath(`/workspace/${businessId}/cajas`);
    revalidatePath(`/workspace/${businessId}/caja`);
    return { success: true, data: register };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al crear la caja registradora." };
  }
}

/**
 * Obtiene la sesión o turno activo de una caja registradora (o del negocio si no se especifica caja).
 * Permiso requerido: cash.view
 */
export async function getActiveCashSessionAction(
  businessId: string,
  registerId?: string
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver la sesión activa.", data: null };
  }

  try {
    const session = await getActiveCashSession(businessId, registerId, auth.context.userId);
    return { success: true, data: session };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar la sesión activa.", data: null };
  }
}

/**
 * Abre un turno de caja con fondo inicial.
 * Permiso requerido: cash.open
 */
export async function openCashSessionAction(
  businessId: string,
  input: OpenSessionInput
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.open");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para abrir turno de caja." };
  }

  try {
    const effectiveUserId = auth.context.businessUserId || auth.context.userId;
    const session = await openCashSession(businessId, input, effectiveUserId);
    revalidatePath(`/workspace/${businessId}/cajas`);
    revalidatePath(`/workspace/${businessId}/caja`);
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/workspace/${businessId}/ventas/nueva`);
    return { success: true, data: session };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al abrir el turno de caja." };
  }
}

/**
 * Cierra un turno de caja y registra arqueo final.
 * Permiso requerido: cash.close
 */
export async function closeCashSessionAction(
  businessId: string,
  input: CloseSessionInput
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.close");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para cerrar turno de caja." };
  }

  try {
    const effectiveUserId = auth.context.businessUserId || auth.context.userId;
    const session = await closeCashSession(businessId, input, effectiveUserId);
    revalidatePath(`/workspace/${businessId}/cajas`);
    revalidatePath(`/workspace/${businessId}/caja`);
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/workspace/${businessId}/ventas/nueva`);
    return { success: true, data: session };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al cerrar el turno de caja." };
  }
}

/**
 * Registra un movimiento de efectivo en el turno abierto.
 * Permiso requerido: cash.move
 */
export async function recordCashMovementAction(
  businessId: string,
  input: CreateCashMovementInput
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.move");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar movimientos de caja." };
  }

  try {
    const effectiveUserId = auth.context.businessUserId || auth.context.userId;
    const movement = await recordCashMovement(businessId, input, effectiveUserId);
    revalidatePath(`/workspace/${businessId}/cajas`);
    revalidatePath(`/workspace/${businessId}/caja`);
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/workspace/${businessId}/ventas/nueva`);
    return { success: true, data: movement };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al registrar el movimiento de caja." };
  }
}

/**
 * Consulta los movimientos de efectivo de una sesión de caja.
 * Permiso requerido: cash.view
 */
export async function getCashMovementsAction(
  businessId: string,
  sessionId: string
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar movimientos de caja.", data: [] };
  }

  try {
    const movements = await getCashMovements(businessId, sessionId);
    return { success: true, data: movements };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar movimientos de caja.", data: [] };
  }
}

/**
 * Obtiene el resumen consolidado de balance de una sesión de caja.
 * Permiso requerido: cash.view
 */
export async function getCashSessionSummaryAction(
  businessId: string,
  sessionId: string
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar el resumen de caja.", data: null };
  }

  try {
    const summary = await getCashSessionSummary(businessId, sessionId);
    return { success: true, data: summary };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al obtener resumen de sesión de caja.", data: null };
  }
}

/**
 * Obtiene la panorámica completa de todas las cajas del comercio (KPIs + estado de turnos).
 * Permiso requerido: cash.view
 */
export async function getCashOverviewAction(businessId: string) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para ver cajas.",
      data: {
        kpis: { openSessionsCount: 0, totalCashInDrawers: 0, totalSalesInOpenSessions: 0, totalRegistersCount: 0 },
        registers: [],
      },
    };
  }

  try {
    const data = await getCashOverview(businessId);
    return { success: true, data };
  } catch (err: any) {
    console.error("[getCashOverviewAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al consultar la panorámica de cajas.",
      data: {
        kpis: { openSessionsCount: 0, totalCashInDrawers: 0, totalSalesInOpenSessions: 0, totalRegistersCount: 0 },
        registers: [],
      },
    };
  }
}

/**
 * Consulta o calcula la reconciliación del cierre del día para una fecha determinada [CAJ-004].
 * Permiso requerido: cash.view
 */
export async function calculateDailyClosureAction(
  businessId: string,
  closureDate: string,
  countedByMethod?: Record<string, number>
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver el cierre del día.", data: null };
  }

  try {
    const calculation = await calculateDailyClosure(businessId, closureDate, countedByMethod);
    return { success: true, data: calculation };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al calcular el cierre del día.", data: null };
  }
}

/**
 * Guarda y bloquea inmutablemente el cierre del día [CAJ-004].
 * Permiso requerido: cash.close
 */
export async function saveDailyClosureAction(
  businessId: string,
  input: SaveDailyClosureInput
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.close");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para guardar el cierre del día." };
  }

  try {
    const closure = await saveDailyClosure(
      businessId,
      input,
      auth.context.userId,
      auth.context.userEmail || "Supervisor de Caja"
    );

    revalidatePath(`/workspace/${businessId}/caja`);
    revalidatePath(`/workspace/${businessId}/cajas`);
    return { success: true, data: closure };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al guardar el cierre del día." };
  }
}

/**
 * Exporta el Cierre del Día como comprobante formal en PDF [CAJ-004].
 * Permiso requerido: cash.view
 */
export async function exportDailyClosurePdfAction(
  businessId: string,
  closureDate: string,
  countedByMethod?: Record<string, number>,
  observations?: string
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para exportar el cierre del día." };
  }

  try {
    const [calc, config] = await Promise.all([
      calculateDailyClosure(businessId, closureDate, countedByMethod),
      getBusinessDocumentConfig(businessId).catch(() => null),
    ]);

    const closureRecord =
      calc.closureRecord || {
        id: `prev-${Date.now()}`,
        businessId,
        closureDate,
        totalSales: calc.metrics.totalSales,
        counterSales: calc.metrics.counterSales,
        tablesSales: calc.metrics.tablesSales,
        deliverySales: calc.metrics.deliverySales,
        onlineSales: calc.metrics.onlineSales,
        totalSystem: calc.totalSystem,
        totalCounted: calc.totalCounted,
        totalDifference: calc.totalDifference,
        paymentMethodsSummary: calc.reconciliation,
        observations: observations || null,
        closedBy: auth.context.userId,
        closedByName: auth.context.userEmail || "Supervisor Autorizado",
        isLocked: calc.isSaved,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

    const pdfResult = generateDailyClosurePdf({
      businessName: config?.tradeName || config?.legalName || "Mi Negocio",
      businessNit: config?.taxId || null,
      businessAddress: config?.address || null,
      businessPhone: config?.phone || null,
      closure: closureRecord,
    });

    return {
      success: true,
      base64: pdfResult.base64,
      filename: pdfResult.filename,
    };
  } catch (err: any) {
    console.error("[exportDailyClosurePdfAction] Error:", err);
    return { success: false, error: err?.message || "Error al generar el PDF del cierre del día." };
  }
}

/**
 * Consulta el historial de cierres del día guardados.
 * Permiso requerido: cash.view
 */
export async function getDailyClosuresHistoryAction(businessId: string) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar historial.", data: [] };
  }

  try {
    const history = await getDailyClosuresHistory(businessId);
    return { success: true, data: history };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar historial.", data: [] };
  }
}

/**
 * Calcula el cierre consolidado para un rango de fechas (máximo 30 días) [CAJ-005].
 * Permiso requerido: cash.view
 */
export async function calculateDateRangeClosureAction(
  businessId: string,
  startDateStr: string,
  endDateStr: string
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar el cierre por rango.", data: null };
  }

  try {
    const data = await calculateDateRangeClosure(businessId, startDateStr, endDateStr);
    return { success: true, data };
  } catch (err: any) {
    console.error("[calculateDateRangeClosureAction] Error:", err);
    return { success: false, error: err?.message || "Error al calcular el cierre por rango de fechas.", data: null };
  }
}

/**
 * Genera y descarga el PDF oficial del cierre consolidado por rango de fechas [CAJ-005].
 * Permiso requerido: cash.view
 */
export async function exportDateRangeClosurePdfAction(
  businessId: string,
  startDateStr: string,
  endDateStr: string
) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para exportar el cierre por rango." };
  }

  try {
    const [rangeResult, config] = await Promise.all([
      calculateDateRangeClosure(businessId, startDateStr, endDateStr),
      getBusinessDocumentConfig(businessId).catch(() => null),
    ]);

    const pdfResult = generateDateRangeClosurePdf({
      businessName: config?.tradeName || config?.legalName || "Mi Negocio",
      businessNit: config?.taxId || null,
      businessAddress: config?.address || null,
      businessPhone: config?.phone || null,
      rangeClosure: rangeResult,
    });

    return {
      success: true,
      base64: pdfResult.base64,
      filename: pdfResult.filename,
    };
  } catch (err: any) {
    console.error("[exportDateRangeClosurePdfAction] Error:", err);
    return { success: false, error: err?.message || "Error al exportar el PDF del cierre por rango." };
  }
}

/**
 * Consulta todos los movimientos de caja cronológicos para la pestaña 'Movimientos' [CAJA-001].
 */
export async function getAllCashMovementsAction(businessId: string, limitCount = 100) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar movimientos.", data: [] };
  }

  try {
    const movements = await getAllBusinessCashMovements(businessId, limitCount);
    return { success: true, data: movements };
  } catch (err: any) {
    console.error("[getAllCashMovementsAction] Error:", err);
    return { success: false, error: err?.message || "Error al consultar movimientos de caja.", data: [] };
  }
}

/**
 * Consulta el historial de turnos de caja para la pestaña 'Historial de turnos' [CAJA-001].
 */
export async function getCashSessionsHistoryAction(businessId: string, limitCount = 50) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar historial de turnos.", data: [] };
  }

  try {
    const history = await getBusinessCashSessionsHistory(businessId, limitCount);
    return { success: true, data: history };
  } catch (err: any) {
    console.error("[getCashSessionsHistoryAction] Error:", err);
    return { success: false, error: err?.message || "Error al consultar historial de turnos.", data: [] };
  }
}

/**
 * Consulta el listado de cajeros y colaboradores para la pestaña 'Cajeros' [CAJA-001].
 */
export async function getCashiersListAction(businessId: string) {
  const auth = await verifyWorkspaceAction(businessId, "cash.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar cajeros.", data: [] };
  }

  try {
    const cashiers = await getBusinessCashiers(businessId);
    return { success: true, data: cashiers };
  } catch (err: any) {
    console.error("[getCashiersListAction] Error:", err);
    return { success: false, error: err?.message || "Error al consultar cajeros.", data: [] };
  }
}

