/**
 * Tipos canónicos para el Módulo de Reportes y KPIs de Ventas [REP-001]
 * 
 * Regla de Oro Multi-tenant:
 * Todo reporte pertenece estrictamente a un `business_id` y aísla los datos contables.
 */

export type ReportsDatePreset = "today" | "yesterday" | "last_7_days" | "this_month" | "custom";

export interface ReportsDateRange {
  preset: ReportsDatePreset;
  startDate?: string; // Formato YYYY-MM-DD
  endDate?: string;   // Formato YYYY-MM-DD
}

export type SalesChannelType = "mostrador" | "mesa" | "domicilio" | "digital_menu";

export interface SalesChannelMeta {
  channel: SalesChannelType;
  label: string;
  totalAmount: number;
  transactionsCount: number;
  percentage: number;
}

export interface TopProductItem {
  productId?: string | null;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface DailySalesBarItem {
  date: string; // YYYY-MM-DD
  dayName: string; // ej: "Lun", "Mar", "Mié"
  formattedDate: string; // ej: "31 Oct"
  totalAmount: number;
  transactionsCount: number;
}

export interface TrendSalesLineItem {
  date: string; // YYYY-MM-DD
  dayName: string;
  formattedDate: string;
  totalAmount: number;
  accumulatedAmount: number;
  transactionsCount: number;
}

export interface SalesKpiSummary {
  // Ventas de hoy
  todaySalesAmount: number;
  todayTransactionsCount: number;

  // Ventas de la semana
  weekSalesAmount: number;
  weekTransactionsCount: number;

  // Ventas del mes
  monthSalesAmount: number;
  monthTransactionsCount: number;

  // Ventas del período seleccionado
  periodSalesAmount: number;
  periodTransactionsCount: number;

  // Ticket promedio del período seleccionado
  averageTicketAmount: number;

  // Canal líder
  topChannel: SalesChannelMeta | null;
}

export interface SalesDashboardData {
  kpis: SalesKpiSummary;
  channels: SalesChannelMeta[];
  topProducts: TopProductItem[];
  last7DaysDailySales: DailySalesBarItem[];
  last30DaysTrendSales: TrendSalesLineItem[];
  periodDailySales: DailySalesBarItem[];
  totalDocumentsAnalyzed: number;
  dateRange: ReportsDateRange;
  isEmpty: boolean;
}

// ==========================================
// Tipos para Reporte Detallado de Ventas con Exportación [REP-002]
// ==========================================

export interface SalesReportFilterParams {
  preset?: ReportsDatePreset;
  startDate?: string;
  endDate?: string;
  channel?: "all" | SalesChannelType;
  paymentMethod?: "all" | string;
  employeeId?: "all" | string;
  status?: "all" | "completed" | "cancelled";
  search?: string;
}

export interface SalesReportRow {
  id: string;
  documentNumber: string;
  issuedAt: string;
  formattedDate: string;
  customerName: string;
  channel: SalesChannelType;
  channelLabel: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  status: "completed" | "cancelled" | "pending";
  statusLabel: string;
  cancellationReason: string | null;
  employeeId: string | null;
  employeeName: string;
}

export interface SalesReportSummary {
  totalGross: number;        // Subtotal bruto
  totalTax: number;          // Total impuestos (IVA)
  totalDiscount: number;     // Total descuentos aplicados
  totalNet: number;          // Total neto cobrado
  transactionCount: number;  // Cantidad de transacciones
}

export interface SalesReportData {
  rows: SalesReportRow[];
  summary: SalesReportSummary;
  dateRange: ReportsDateRange;
  filterParams: SalesReportFilterParams;
  employees: Array<{ id: string; name: string }>;
  businessName: string;
}

export interface BusinessReportInfo {
  id: string;
  name: string;
  commercialName?: string | null;
  nit?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  currency?: string;
  logoUrl?: string | null;
}

// ==========================================
// Tipos para Reporte de Empleados [REP-003]
// ==========================================

export interface EmployeeReportFilterParams {
  preset?: ReportsDatePreset;
  startDate?: string;
  endDate?: string;
  locationId?: "all" | string;
  roleCode?: "all" | string;
  search?: string;
}

export interface EmployeeReportMetricItem {
  id: string; // user_id / employee_id
  userId: string;
  name: string;
  email: string | null;
  roleId: string | null;
  roleCode: string;
  roleName: string;
  avatarUrl: string | null;
  status: "active" | "inactive" | "invited";

  // Ventas realizadas
  salesCount: number; // Cantidad de transacciones de venta
  totalSalesAmount: number; // Monto total vendido ($ COP)
  averageTicketAmount: number; // Ticket promedio ($ COP)

  // Turnos y tiempo trabajado
  shiftsCount: number; // Cantidad de sesiones de caja
  totalHoursWorked: number; // Horas totales laboradas

  // Propinas
  totalTipsAmount: number; // Propinas recibidas / registradas

  // Ubicaciones
  locations: string[]; // Ubicaciones detectadas

  // Ranking
  rank: number; // Puesto en el ranking de ventas (1 = mayor monto)
  salesPercentage: number; // % respecto al total vendido del equipo
}

export interface EmployeeReportSummary {
  totalEmployees: number;
  activeEmployeesCount: number;
  totalTeamSalesAmount: number;
  totalTeamSalesCount: number;
  averageTeamTicketAmount: number;
  totalShiftsWorked: number;
  totalHoursWorked: number;
  totalTipsAmount: number;
  topPerformerName: string | null;
  topPerformerSalesAmount: number;
}

export interface EmployeeReportData {
  employees: EmployeeReportMetricItem[];
  summary: EmployeeReportSummary;
  dateRange: ReportsDateRange;
  filterParams: EmployeeReportFilterParams;
  availableRoles: Array<{ code: string; name: string }>;
  availableLocations: Array<{ id: string; name: string }>;
  businessName: string;
}

// ==========================================
// Tipos para Reporte de Inventario [REP-004]
// ==========================================

export type InventoryStockStatus = "normal" | "low" | "out_of_stock";

export interface InventoryStockReportRow {
  id: string; // inventory_stock.id
  productId: string;
  productName: string;
  productSku: string | null;
  categoryId: string | null;
  categoryName: string;
  locationId: string;
  locationName: string;
  quantity: number;
  minStock: number;
  cost: number;
  totalValue: number; // quantity * cost
  status: InventoryStockStatus;
  statusLabel: string; // "Normal" | "Stock Bajo" | "Agotado"
}

export interface InventoryMovementReportRow {
  id: string; // inventory_movements.id
  createdAt: string;
  formattedDate: string;
  productId: string;
  productName: string;
  productSku: string | null;
  locationId: string;
  locationName: string;
  movementType: string;
  movementTypeLabel: string;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
  referenceId: string | null;
  referenceType: string | null;
  referenceLabel: string;
  notes: string | null;
  createdBy: string | null;
  createdByName: string;
}

export interface InventoryLowStockReportRow {
  productId: string;
  productName: string;
  productSku: string | null;
  categoryId: string | null;
  categoryName: string;
  locationId: string;
  locationName: string;
  quantity: number;
  minStock: number;
  cost: number;
  deficit: number; // max(0, minStock - quantity)
  replenishmentCost: number; // deficit * cost
  status: "low" | "out_of_stock";
  statusLabel: string; // "Stock Bajo" | "Agotado"
}

export interface InventoryReportSummary {
  totalInventoryValue: number; // Σ(quantity * cost)
  totalItemsCount: number; // Σ(quantity)
  totalProductsCount: number; // número de registros de stock monitoreados
  outOfStockCount: number; // quantity <= 0
  lowStockCount: number; // 0 < quantity <= minStock
  normalStockCount: number; // quantity > minStock
  totalMovementsCount: number; // cantidad de movimientos registrados en el período
}

export interface InventoryReportFilterParams {
  locationId?: "all" | string;
  categoryId?: "all" | string;
  preset?: ReportsDatePreset;
  startDate?: string;
  endDate?: string;
  movementType?: "all" | string;
  search?: string;
  status?: "all" | InventoryStockStatus;
}

export interface InventoryReportData {
  stockRows: InventoryStockReportRow[];
  movementsRows: InventoryMovementReportRow[];
  lowStockRows: InventoryLowStockReportRow[];
  summary: InventoryReportSummary;
  filterParams: InventoryReportFilterParams;
  dateRange: ReportsDateRange;
  availableLocations: Array<{ id: string; name: string }>;
  availableCategories: Array<{ id: string; name: string }>;
  businessName: string;
}

// ==========================================
// Tipos para Reportes de Gastos y Compras [REP-005]
// ==========================================

export interface ExpenseReportRow {
  id: string;
  expenseDate: string;
  formattedDate: string;
  category: string;
  concept: string;
  description: string | null;
  amount: number;
  paymentMethod: string;
  paymentMethodLabel: string;
  supplierId: string | null;
  supplierName: string;
  receiptNumber: string | null;
  expenseType: "operational" | "production";
  status: "completed" | "cancelled";
  statusLabel: string;
}

export interface ExpenseCategoryDistribution {
  category: string;
  amount: number;
  percentage: number; // Suma 100%
  count: number;
  color: string;
}

export interface ExpenseMonthlyBarItem {
  monthKey: string; // YYYY-MM
  label: string; // "May 2026", "Jun 2026", etc.
  totalAmount: number;
  expensesCount: number;
}

export interface ExpenseReportSummary {
  totalExpenses: number;
  dailyAverage: number;
  mainCategory: {
    category: string;
    amount: number;
    percentage: number;
  } | null;
  transactionsCount: number;
}

export interface PurchaseReportItemDetail {
  id: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseReportRow {
  id: string;
  purchaseNumber: string;
  invoiceNumber: string | null;
  purchaseDate: string;
  formattedDate: string;
  supplierId: string | null;
  supplierName: string;
  supplierTaxId: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  paymentType: "cash" | "credit";
  paymentMethod: string;
  status: "confirmed" | "cancelled";
  statusLabel: string;
  items: PurchaseReportItemDetail[];
  itemsSummary: string;
  itemsCount: number;
}

export interface TopSupplierPurchaseItem {
  supplierId: string | null;
  supplierName: string;
  taxId: string | null;
  totalAmount: number;
  purchasesCount: number;
  percentage: number;
}

export interface PurchaseReportSummary {
  totalPurchases: number;
  confirmedPurchasesCount: number;
  pendingAccountsPayableAmount: number;
  pendingAccountsPayableCount: number;
}

export interface ExpensesAndPurchasesFilterParams {
  preset?: ReportsDatePreset;
  startDate?: string;
  endDate?: string;
  category?: "all" | string;
  supplierId?: "all" | string;
  status?: "all" | "completed" | "cancelled" | "confirmed";
  search?: string;
}

export interface ExpensesAndPurchasesReportData {
  expenses: {
    rows: ExpenseReportRow[];
    summary: ExpenseReportSummary;
    categoryDistribution: ExpenseCategoryDistribution[];
    last6MonthsMonthly: ExpenseMonthlyBarItem[];
  };
  purchases: {
    rows: PurchaseReportRow[];
    summary: PurchaseReportSummary;
    topSuppliers: TopSupplierPurchaseItem[];
  };
  filterParams: ExpensesAndPurchasesFilterParams;
  dateRange: ReportsDateRange;
  availableCategories: string[];
  availableSuppliers: Array<{ id: string; name: string; taxId?: string | null }>;
  businessName: string;
}

// ==========================================
// Tipos para Reporte de Domicilios y Entregas [REP-007]
// ==========================================

export interface DeliveryReportFilterParams {
  preset?: ReportsDatePreset;
  startDate?: string;
  endDate?: string;
  driverName?: "all" | string;
  zoneId?: "all" | string;
  status?: "all" | "delivered" | "delivering" | "cancelled" | "rejected";
  search?: string;
}

export interface DeliveryDriverMetricItem {
  driverName: string;
  driverPhone?: string | null;
  totalAssigned: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  rejectedDeliveries: number;
  averageDeliveryTimeMinutes: number;
  completionRate: number; // Porcentaje 0 - 100
  averageRating: number; // 1.0 - 5.0
  totalAmountCollected: number;
  totalTariffsCollected: number;
}

export interface DeliveryZoneMetricItem {
  zoneId: string;
  zoneName: string;
  tariff: number;
  totalOrders: number;
  completedOrders: number;
  totalAmount: number;
  averageDeliveryTimeMinutes: number;
  color?: string;
}

export interface DeliveryReportOrderItem {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone?: string | null;
  deliveryAddress: string;
  zoneId?: string | null;
  zoneName: string;
  driverName: string;
  status: string; // "delivered", "delivering", "cancelled", "rejected", "pending"
  statusLabel: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  formattedCreatedAt: string;
  deliveredAt?: string | null;
  formattedDeliveredAt?: string | null;
  deliveryDurationMinutes: number; // minutos transcurridos
  rating?: number | null;
}

export interface DeliveryReportSummary {
  totalDeliveries: number;
  successfulDeliveries: number;
  cancelledDeliveries: number;
  rejectedDeliveries: number;
  successRate: number; // Porcentaje de éxito
  averageDeliveryTimeMinutes: number;
  totalRevenue: number;
  totalTariffs: number;
  topDriver: {
    driverName: string;
    completedCount: number;
  } | null;
  topZone: {
    zoneName: string;
    ordersCount: number;
  } | null;
}

export interface DeliveryReportData {
  summary: DeliveryReportSummary;
  drivers: DeliveryDriverMetricItem[];
  zones: DeliveryZoneMetricItem[];
  orders: DeliveryReportOrderItem[];
  filterParams: DeliveryReportFilterParams;
  dateRange: ReportsDateRange;
  availableDrivers: string[];
  availableZones: Array<{ id: string; name: string }>;
  businessName: string;
}

/**
 * =============================================================================
 * [REP-006] Análisis de Horas Pico y Mapa de Calor (Heatmap)
 * =============================================================================
 */

export type PeakHoursMetricMode = "transactions" | "amount";

export interface HeatmapCell {
  dayIndex: number; // 0 = Lunes, 1 = Martes, ..., 6 = Domingo
  dayName: string; // ej: "Lunes", "Martes"
  dayShort: string; // ej: "Lun", "Mar"
  hour: number; // 6 .. 23 (18 horas continuas de 6AM a 12AM)
  hourLabel: string; // ej: "6 AM", "12 PM", "8 PM"
  salesCount: number; // Cantidad de transacciones registradas
  totalAmount: number; // Monto facturado total en COP
  averageTicket: number; // Ticket promedio de esa hora y día
  countIntensity: number; // 0.0 - 1.0 relativo al máximo de transacciones
  amountIntensity: number; // 0.0 - 1.0 relativo al máximo de facturación
}

export interface DayPeakHourSummary {
  dayIndex: number;
  dayName: string;
  dayShort: string;
  peakHour: number;
  peakHourLabel: string;
  peakSalesCount: number;
  peakTotalAmount: number;
  totalDaySalesCount: number;
  totalDayAmount: number;
}

export interface PeakHoursGlobalSummary {
  globalPeakHour: number;
  globalPeakHourLabel: string;
  globalPeakDayIndex: number;
  globalPeakDayName: string;
  globalPeakSalesCount: number;
  globalPeakAmount: number;
  busiestDayOfWeek: string;
  busiestDayIndex: number;
  busiestDaySalesCount: number;
  busiestDayAmount: number;
  totalPeriodSalesCount: number;
  totalPeriodAmount: number;
  averageHourlySalesCount: number;
  averageHourlyAmount: number;
  hasData: boolean;
}

export interface PeakHoursFilterParams {
  preset?: "today" | "yesterday" | "last_7_days" | "last_30_days" | "this_month" | "last_90_days" | "custom";
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  channel?: SalesChannelType | "all";
}

export interface PeakHoursReportData {
  heatmapMatrix: HeatmapCell[][]; // 7 días x 18 horas
  cellsFlat: HeatmapCell[]; // 126 celdas
  daySummaries: DayPeakHourSummary[]; // 7 resúmenes
  globalSummary: PeakHoursGlobalSummary;
  filterParams: PeakHoursFilterParams;
  businessName: string;
}

// ==========================================
// REPORTE DE RECETAS Y COSTOS [REP-008]
// ==========================================

export type RecipeMarginStatus = "critical" | "warning" | "healthy";

export interface RecipeProductCostItem {
  productId: string;
  productName: string;
  categoryName: string;
  categoryId: string | null;
  recipeId: string;
  recipeName: string;
  portions: number;
  recipeCost: number; // Suma de (cantidad_ingrediente × costo_ingrediente) / portions
  salePrice: number;
  grossMarginAmount: number; // salePrice - recipeCost
  grossMarginPercentage: number; // (salePrice - recipeCost) / salePrice * 100
  marginStatus: RecipeMarginStatus; // < 0 o < 30%
  ingredientsCount: number;
}

export interface IngredientConsumptionItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  costPerUnit: number;
  currentStock: number;
  periodConsumption: number; // (unidades_vendidas × cantidad_en_receta / portions)
  totalCostConsumed: number; // periodConsumption × costPerUnit
  dailyBurnRate: number; // periodConsumption / días_del_período
  daysUntilDepleted: number | null; // currentStock / dailyBurnRate (null si no hay consumo)
  depletionAlert: "depleted" | "critical" | "warning" | "stable" | "no_consumption";
}

export interface RecipeReportSummary {
  totalRecipes: number;
  averageGrossMarginPercentage: number;
  productsWithCriticalMarginCount: number; // margin < 30%
  productsWithNegativeMarginCount: number; // margin < 0
  totalIngredientCostConsumed: number;
  ingredientsAtDepletionRiskCount: number; // Se agotarán en <= 7 días
}

export interface RecipeReportFilterParams {
  preset?: ReportsDatePreset | "last_30_days";
  startDate?: string;
  endDate?: string;
  categoryId?: string | "all";
  marginFilter?: "all" | "low_margin" | "negative_margin" | "healthy_margin";
  search?: string;
}

export interface RecipeReportData {
  summary: RecipeReportSummary;
  productCosts: RecipeProductCostItem[];
  ingredientConsumptions: IngredientConsumptionItem[];
  depletionRanking: IngredientConsumptionItem[];
  categories: Array<{ id: string; name: string }>;
  filterParams: RecipeReportFilterParams;
  dateRange: { startDate: string; endDate: string; daysCount: number };
  businessName: string;
  currency: string;
}





