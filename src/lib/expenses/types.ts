export type ExpenseType = "operational" | "production";

export const PRODUCTION_CATEGORIES = [
  "Insumos Menores",
  "Materia Prima",
  "Ingredientes",
  "Insumos de Producción",
  "Envases y Empaques",
  "Otros Producción",
] as const;

export type ProductionCategory = (typeof PRODUCTION_CATEGORIES)[number];

export const OPERATIONAL_CATEGORIES = [
  "Arriendo",
  "Servicios Públicos",
  "Nómina y Honorarios",
  "Aseo y Limpieza",
  "Marketing y Publicidad",
  "Mantenimiento y Reparaciones",
  "Transporte y Envíos",
  "Papelería y Útiles",
  "Otros Operativos",
] as const;

export type OperationalCategory = (typeof OPERATIONAL_CATEGORIES)[number];

export const INCOME_TYPES = [
  "Aporte de capital",
  "Préstamo",
  "Venta extraordinaria (ej. aceite reciclado/chatarra)",
  "Devolución de proveedor",
  "Otro ingreso",
] as const;

export type IncomeType = (typeof INCOME_TYPES)[number];

export const INCOME_CATEGORIES = [
  "Aportes de Capital",
  "Préstamos y Créditos",
  "Venta Extraordinaria / Reciclaje",
  "Devoluciones de Proveedores",
  "Ventas Manuales / Extraordinarias",
  "Rendimientos Financieros",
  "Otros Ingresos",
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export type MovementFlow = "income" | "expense";

export interface UnifiedMovement {
  id: string;
  businessId: string;
  flow: MovementFlow;
  concept: string;
  amount: number;
  category: string;
  expenseType?: ExpenseType;
  incomeType?: string;
  description?: string | null;
  date: string;
  paymentMethod: string;
  receiptNumber?: string | null;
  thirdPartyName?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  productName?: string | null;
  cashRegisterName?: string | null;
  cajaBadge?: string | null;
  status: "completed" | "cancelled";
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface CreateMovementInput {
  flow: MovementFlow;
  concept: string;
  amount: number;
  category: string;
  expenseType?: ExpenseType;
  incomeType?: string;
  description?: string;
  date?: string;
  paymentMethod?: string;
  receiptNumber?: string;
  thirdPartyName?: string;
  supplierId?: string | null;
  productId?: string | null;
  unitCost?: number | null;
  quantity?: number | null;
  updateProductCost?: boolean;
  notes?: string;
  deductFromCashRegister?: boolean;
  cashRegisterId?: string | null;
  cashSessionId?: string | null;
}

export interface MovementKPIs {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  movementsCount: number;
  incomeCount: number;
  expensesCount: number;
}

export interface ExpenseItem {
  id: string;
  businessId: string;
  concept: string;
  amount: number;
  category: string;
  expenseType: ExpenseType;
  description?: string | null;
  expenseDate: string;
  paymentMethod: string;
  receiptNumber?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  productId?: string | null;
  productName?: string | null;
  unitCost?: number | null;
  quantity?: number | null;
  updateProductCost: boolean;
  status: "completed" | "cancelled";
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseInput {
  concept: string;
  amount: number;
  category: string;
  expenseType?: ExpenseType;
  description?: string;
  expenseDate?: string;
  paymentMethod?: string;
  receiptNumber?: string;
  supplierId?: string | null;
  productId?: string | null;
  unitCost?: number | null;
  quantity?: number | null;
  updateProductCost?: boolean;
  notes?: string;
  cashSessionId?: string | null;
  cashRegisterId?: string | null;
}

export interface FinancialReport {
  businessId: string;
  startDate?: string;
  endDate?: string;
  income: {
    totalSales: number;
    salesCount: number;
    totalTips?: number;
    totalDiscounts?: number;
  };
  expenses: {
    totalExpenses: number;
    operationalExpenses: number;
    productionExpenses: number;
    expensesCount: number;
  };
  netIncome: number; // Ingresos - Gastos = Resultado
  grossMarginAmount: number;
  grossMarginPercentage: number;
  netMarginPercentage: number;
  isProfitable: boolean;
}

export interface UpdateExpenseInput {
  concept?: string;
  amount?: number;
  category?: string;
  expenseType?: ExpenseType;
  description?: string;
  expenseDate?: string;
  paymentMethod?: string;
  receiptNumber?: string;
  supplierId?: string | null;
  productId?: string | null;
  unitCost?: number | null;
  quantity?: number | null;
  updateProductCost?: boolean;
  notes?: string;
}

export interface ExpenseFilterParams {
  businessId: string;
  expenseType?: ExpenseType | "all";
  category?: string | "all";
  paymentMethod?: string | "all";
  supplierId?: string | "all";
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface ExpenseCategoryBreakdown {
  category: string;
  expenseType: ExpenseType;
  amount: number;
  percentage: number;
  count: number;
}

export interface ExpensePaymentMethodBreakdown {
  method: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface ExpenseKPIs {
  totalExpenses: number;
  operationalExpenses: number;
  productionExpenses: number;
  totalSales: number;
  totalTips?: number;
  totalDiscounts?: number;
  grossMarginAmount: number;
  grossMarginPercentage: number;
  netMarginAmount: number;
  netMarginPercentage: number;
  expensesCount: number;
  categoryBreakdown: ExpenseCategoryBreakdown[];
  paymentMethodBreakdown: ExpensePaymentMethodBreakdown[];
}

