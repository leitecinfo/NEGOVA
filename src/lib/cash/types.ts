import { z } from "zod";

// ==========================================
// CAJAS (CASH REGISTERS)
// ==========================================

export interface CashRegister {
  id: string;
  businessId: string;
  name: string;
  locationId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CreateCashRegisterInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la caja es obligatorio"),
  locationId: z.string().uuid("ID de ubicación inválido").nullable().optional(),
  isActive: z.boolean().default(true),
});

export type CreateCashRegisterInput = z.infer<typeof CreateCashRegisterInputSchema>;

// ==========================================
// SESIONES / TURNOS DE CAJA (CASH SESSIONS)
// ==========================================

export const CashSessionStatusSchema = z.enum(["open", "closed"]);
export type CashSessionStatus = z.infer<typeof CashSessionStatusSchema>;

export interface CashSession {
  id: string;
  registerId: string;
  businessId: string;
  openedBy?: string | null;
  openedAt: string;
  initialAmount: number;
  closedBy?: string | null;
  closedAt?: string | null;
  finalAmountCounted?: number | null;
  notes?: string | null;
  status: CashSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export const OpenSessionInputSchema = z.object({
  registerId: z.string().uuid("ID de caja inválido"),
  initialAmount: z.coerce.number().min(0, "La base inicial no puede ser negativa").default(0),
  notes: z.string().trim().nullable().optional(),
});

export type OpenSessionInput = z.infer<typeof OpenSessionInputSchema>;

export const CloseSessionInputSchema = z.object({
  sessionId: z.string().uuid("ID de sesión inválido"),
  finalAmountCounted: z.coerce.number().min(0, "El monto final contado no puede ser negativo"),
  notes: z.string().trim().nullable().optional(),
});

export type CloseSessionInput = z.infer<typeof CloseSessionInputSchema>;

// ==========================================
// MOVIMIENTOS DE CAJA (CASH MOVEMENTS)
// ==========================================

export const CashMovementTypeSchema = z.enum([
  "sale_cash",
  "sale_card",
  "sale_digital",
  "expense",
  "entry",
  "withdrawal",
]);

export type CashMovementType = z.infer<typeof CashMovementTypeSchema>;

export const CASH_MOVEMENT_TYPE_LABELS: Record<CashMovementType, string> = {
  sale_cash: "Venta en Efectivo",
  sale_card: "Venta con Tarjeta",
  sale_digital: "Venta Digital / Transferencia",
  expense: "Gasto de Caja",
  entry: "Ingreso / Aporte Manual",
  withdrawal: "Retiro de Efectivo",
};

export interface CashMovement {
  id: string;
  sessionId: string;
  businessId: string;
  movementType: CashMovementType;
  amount: number;
  referenceId?: string | null;
  referenceType?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export const CreateCashMovementInputSchema = z.object({
  sessionId: z.string().uuid("ID de sesión inválido"),
  movementType: CashMovementTypeSchema,
  amount: z.coerce.number().positive("El monto debe ser superior a 0"),
  referenceId: z.string().trim().min(1, "ID de referencia inválido").nullable().optional(),
  referenceType: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export type CreateCashMovementInput = z.infer<typeof CreateCashMovementInputSchema>;

// ==========================================
// OVERVIEW Y RESUMEN DE CAJAS [CAJ-002]
// ==========================================

export interface CashRegisterWithSession {
  register: CashRegister;
  activeSession: CashSession | null;
  sessionSummary: {
    initialAmount: number;
    totalSalesCash: number;
    totalSalesCard: number;
    totalSalesDigital: number;
    totalSales: number;
    totalExpenses: number;
    totalManualEntries: number;
    totalWithdrawals: number;
    expectedCashInDrawer: number;
    movementsCount: number;
  } | null;
  lastClosedSession?: {
    id: string;
    closedAt: string | null;
    finalAmountCounted: number | null;
    initialAmount: number;
    notes?: string | null;
  } | null;
}

export interface CashOverviewKPIs {
  openSessionsCount: number;
  totalCashInDrawers: number;
  totalSalesInOpenSessions: number;
  totalRegistersCount: number;
  netEntriesWithdrawals?: number;
}

export interface CashOverviewData {
  kpis: CashOverviewKPIs;
  registers: CashRegisterWithSession[];
}

// ==========================================
// CIERRE DEL DÍA Y RECONCILIACIÓN [CAJ-004]
// ==========================================

export interface DailyPaymentMethodReconciliation {
  method: string;
  label: string;
  systemTotal: number;
  countedTotal: number;
  difference: number;
}

export interface DailyClosureChannelMetrics {
  totalSales: number;
  counterSales: number;
  tablesSales: number;
  deliverySales: number;
  onlineSales: number;
}

export interface DailyCashClosure {
  id: string;
  businessId: string;
  closureDate: string; // YYYY-MM-DD
  totalSales: number;
  counterSales: number;
  tablesSales: number;
  deliverySales: number;
  onlineSales: number;
  totalSystem: number;
  totalCounted: number;
  totalDifference: number;
  paymentMethodsSummary: DailyPaymentMethodReconciliation[];
  observations?: string | null;
  closedBy?: string | null;
  closedByName?: string | null;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export const SaveDailyClosureInputSchema = z.object({
  closureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)"),
  countedByMethod: z.record(z.string(), z.coerce.number().min(0, "El monto no puede ser negativo")),
  observations: z.string().trim().nullable().optional(),
});

export type SaveDailyClosureInput = z.infer<typeof SaveDailyClosureInputSchema>;

export interface DailyClosureCalculationResult {
  closureDate: string;
  isSaved: boolean;
  closureRecord: DailyCashClosure | null;
  metrics: DailyClosureChannelMetrics;
  reconciliation: DailyPaymentMethodReconciliation[];
  totalSystem: number;
  totalCounted: number;
  totalDifference: number;
}

// ==========================================
// CIERRE CONSOLIDADO POR RANGO DE FECHAS [CAJ-005]
// ==========================================

export interface DateRangeClosureDayBreakdown {
  date: string; // YYYY-MM-DD
  dayLabel: string; // ej: "Lun, 24 Oct"
  totalSales: number;
  counterSales: number;
  tablesSales: number;
  deliverySales: number;
  onlineSales: number;
  totalSystem: number;
  totalCounted: number;
  totalDifference: number;
  isSaved: boolean;
}

export interface DateRangeClosureResult {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  metrics: DailyClosureChannelMetrics;
  reconciliation: DailyPaymentMethodReconciliation[];
  totalSystem: number;
  totalCounted: number;
  totalDifference: number;
  daysBreakdown: DateRangeClosureDayBreakdown[];
}

// ==========================================
// VISTA UNIFICADA Y PESTAÑAS [CAJA-001]
// ==========================================

export interface CashMovementWithDetails extends CashMovement {
  registerName?: string;
  registerId?: string;
  createdByName?: string;
}

export interface CashSessionHistoryItem {
  id: string;
  registerId: string;
  registerName: string;
  businessId: string;
  openedBy?: string | null;
  openedByName?: string | null;
  openedAt: string;
  initialAmount: number;
  closedBy?: string | null;
  closedByName?: string | null;
  closedAt?: string | null;
  finalAmountCounted?: number | null;
  expectedCash?: number;
  difference?: number | null;
  totalSales?: number;
  totalSalesCash?: number;
  status: CashSessionStatus;
  notes?: string | null;
}

export interface CashierItem {
  id: string;
  name: string;
  email: string;
  role: string;
  activeRegisterName?: string | null;
  activeSessionId?: string | null;
  isOnline?: boolean;
}

