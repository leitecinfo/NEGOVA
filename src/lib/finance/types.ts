export interface PlatformExpense {
  id: string;
  category: "infra" | "api_services" | "domain_hosting" | "commissions" | "operations" | "other";
  categoryLabel: string;
  concept: string;
  amount: number;
  currency: "COP";
  date: string;
  receiptReference?: string | null;
  notes?: string | null;
}

export interface PlatformFinancialSummary {
  // 1. Ingresos Recurrentes (SaaS)
  mrrCOP: number;
  arrCOP: number;
  activeSubscriptionsCount: number;
  trialSubscriptionsCount: number;

  // 2. Flujo de Caja Real (Entradas vs Salidas efectivas)
  totalRevenueCollectedCOP: number; // Dinero efectivamente recaudado de comprobantes cobrados
  totalExpensesPaidCOP: number;     // Gastos operativos registrados efectivamente pagados
  netCashFlowCOP: number;           // Flujo neto de caja = Recaudos - Gastos

  // 3. Movimientos consolidados
  recentMovements: Array<{
    id: string;
    type: "income" | "expense";
    concept: string;
    entityName?: string;
    amount: number;
    date: string;
    reference?: string;
  }>;
  expenses: PlatformExpense[];
}
