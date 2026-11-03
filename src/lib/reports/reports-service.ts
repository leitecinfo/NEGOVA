import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  SalesDashboardData,
  ReportsDateRange,
  SalesKpiSummary,
  SalesChannelMeta,
  SalesChannelType,
  TopProductItem,
  DailySalesBarItem,
  TrendSalesLineItem,
  SalesReportFilterParams,
  SalesReportRow,
  SalesReportSummary,
  SalesReportData,
  EmployeeReportFilterParams,
  EmployeeReportMetricItem,
  EmployeeReportSummary,
  EmployeeReportData,
  InventoryReportFilterParams,
  InventoryReportData,
  InventoryStockReportRow,
  InventoryMovementReportRow,
  InventoryLowStockReportRow,
  InventoryReportSummary,
  InventoryStockStatus,
  ExpenseReportRow,
  ExpenseCategoryDistribution,
  ExpenseMonthlyBarItem,
  ExpenseReportSummary,
  PurchaseReportItemDetail,
  PurchaseReportRow,
  TopSupplierPurchaseItem,
  PurchaseReportSummary,
  ExpensesAndPurchasesFilterParams,
  ExpensesAndPurchasesReportData,
  DeliveryReportFilterParams,
  DeliveryDriverMetricItem,
  DeliveryZoneMetricItem,
  DeliveryReportOrderItem,
  DeliveryReportSummary,
  DeliveryReportData,
  HeatmapCell,
  DayPeakHourSummary,
  PeakHoursGlobalSummary,
  PeakHoursFilterParams,
  PeakHoursReportData,
  RecipeMarginStatus,
  RecipeProductCostItem,
  IngredientConsumptionItem,
  RecipeReportSummary,
  RecipeReportFilterParams,
  RecipeReportData,
} from "./types";

async function getDbClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return await createClient();
}

/**
 * Convierte una fecha a string 'YYYY-MM-DD' en la zona horaria dada (por defecto 'America/Bogota')
 */
export function getLocalDateString(date: Date | string | number, timeZone: string = "America/Bogota"): string {
  try {
    const d = typeof date === "object" ? date : new Date(date);
    return d.toLocaleDateString("en-CA", { timeZone }); // Formato ISO determinista YYYY-MM-DD
  } catch {
    const fallback = new Date(date);
    return fallback.toISOString().slice(0, 10);
  }
}

/**
 * Obtiene el nombre corto del día de la semana en español
 */
function getDayNameShort(dateStr: string, timeZone: string = "America/Bogota"): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const day = dateObj.toLocaleDateString("es-CO", { timeZone, weekday: "short" });
    return day.charAt(0).toUpperCase() + day.slice(1).replace(".", "");
  } catch {
    return "";
  }
}

/**
 * Formatea 'YYYY-MM-DD' a 'DD Mes' (ej: '31 Oct')
 */
function getFormattedDateShort(dateStr: string, timeZone: string = "America/Bogota"): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return dateObj.toLocaleDateString("es-CO", { timeZone, day: "numeric", month: "short" }).replace(".", "");
  } catch {
    return dateStr;
  }
}

/**
 * [REP-001] Consulta y consolida los KPIs y reportes analíticos de ventas
 * basados en `business_sale_documents` y sus comandas asociadas.
 */
export async function getSalesDashboardMetrics(
  businessId: string,
  dateRange: ReportsDateRange = { preset: "today" },
  businessTimezone: string = "America/Bogota"
): Promise<SalesDashboardData> {
  const supabase = await getDbClient();

  const now = new Date();
  const todayStr = getLocalDateString(now, businessTimezone);

  // Ayer
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterday, businessTimezone);

  // Inicio del mes (YYYY-MM-01)
  const [currentYear, currentMonth] = todayStr.split("-");
  const monthStartStr = `${currentYear}-${currentMonth}-01`;

  // Inicio de la semana (Lunes de la semana actual)
  const currentDayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = Lunes, 6 = Domingo
  const mondayThisWeek = new Date(now.getTime() - currentDayOfWeek * 24 * 60 * 60 * 1000);
  const weekStartStr = getLocalDateString(mondayThisWeek, businessTimezone);

  // Arreglos de fechas para últimos 7 días y últimos 30 días
  const last7DaysStrings: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    last7DaysStrings.push(getLocalDateString(d, businessTimezone));
  }

  const last30DaysStrings: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    last30DaysStrings.push(getLocalDateString(d, businessTimezone));
  }

  // 1. Consultar en paralelo:
  //    - business_sale_documents (todos los documentos no cancelados del comercio)
  //    - restaurant_orders (para vincular tipo de servicio y canal de origen)
  const [docsRes, ordersRes] = await Promise.all([
    supabase
      .from("business_sale_documents")
      .select("id, restaurant_order_id, document_number, total, subtotal, issued_at, items, status, created_at")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .neq("status", "annulled")
      .order("issued_at", { ascending: false }),
    supabase
      .from("restaurant_orders")
      .select("id, order_type, channel_origin")
      .eq("business_id", businessId),
  ]);

  const rawDocs = docsRes.data || [];
  const rawOrders = ordersRes.data || [];

  // Mapeo de pedidos para resolución instantánea de canal
  const ordersMap = new Map<string, { order_type?: string; channel_origin?: string }>();
  for (const ord of rawOrders) {
    ordersMap.set(ord.id, {
      order_type: ord.order_type,
      channel_origin: ord.channel_origin,
    });
  }

  // Helper para determinar canal del comprobante
  const resolveChannel = (row: any): SalesChannelType => {
    if (row.restaurant_order_id && ordersMap.has(row.restaurant_order_id)) {
      const ord = ordersMap.get(row.restaurant_order_id)!;
      if (ord.channel_origin === "digital_menu") return "digital_menu";
      if (ord.order_type === "delivery" || ord.channel_origin === "whatsapp") return "domicilio";
      if (ord.order_type === "dine_in") return "mesa";
      return "mostrador";
    }
    return "mostrador";
  };

  // Helper para evaluar si un documento cae dentro del rango seleccionado
  const isDocInDateRange = (docDateStr: string, range: ReportsDateRange): boolean => {
    switch (range.preset) {
      case "today":
        return docDateStr === todayStr;
      case "yesterday":
        return docDateStr === yesterdayStr;
      case "last_7_days":
        return last7DaysStrings.includes(docDateStr);
      case "this_month":
        return docDateStr >= monthStartStr && docDateStr <= todayStr;
      case "custom": {
        const start = range.startDate || monthStartStr;
        const end = range.endDate || todayStr;
        return docDateStr >= start && docDateStr <= end;
      }
      default:
        return docDateStr === todayStr;
    }
  };

  // Acumuladores de KPIs
  let todaySalesAmount = 0;
  let todayTransactionsCount = 0;

  let weekSalesAmount = 0;
  let weekTransactionsCount = 0;

  let monthSalesAmount = 0;
  let monthTransactionsCount = 0;

  let periodSalesAmount = 0;
  let periodTransactionsCount = 0;

  // Acumuladores para gráficos de 7 y 30 días
  const salesByDateMap7 = new Map<string, { totalAmount: number; transactionsCount: number }>();
  for (const dt of last7DaysStrings) {
    salesByDateMap7.set(dt, { totalAmount: 0, transactionsCount: 0 });
  }

  const salesByDateMap30 = new Map<string, { totalAmount: number; transactionsCount: number }>();
  for (const dt of last30DaysStrings) {
    salesByDateMap30.set(dt, { totalAmount: 0, transactionsCount: 0 });
  }

  // Acumuladores de canales para el periodo seleccionado
  const channelCounters: Record<SalesChannelType, { total: number; count: number }> = {
    mostrador: { total: 0, count: 0 },
    mesa: { total: 0, count: 0 },
    domicilio: { total: 0, count: 0 },
    digital_menu: { total: 0, count: 0 },
  };

  // Acumulador de productos más vendidos en el periodo seleccionado
  const productCounters = new Map<string, { productId?: string | null; name: string; quantity: number; revenue: number }>();

  // Procesamiento de documentos
  for (const doc of rawDocs) {
    const total = Number(doc.total || 0);
    const docDate = doc.issued_at || doc.created_at;
    const docDateStr = getLocalDateString(docDate, businessTimezone);

    // 1. Acumuladores globales para tarjetas
    if (docDateStr === todayStr) {
      todaySalesAmount += total;
      todayTransactionsCount += 1;
    }
    if (docDateStr >= weekStartStr && docDateStr <= todayStr) {
      weekSalesAmount += total;
      weekTransactionsCount += 1;
    }
    if (docDateStr >= monthStartStr && docDateStr <= todayStr) {
      monthSalesAmount += total;
      monthTransactionsCount += 1;
    }

    // 2. Gráfico 7 días
    if (salesByDateMap7.has(docDateStr)) {
      const entry7 = salesByDateMap7.get(docDateStr)!;
      entry7.totalAmount += total;
      entry7.transactionsCount += 1;
    }

    // 3. Gráfico 30 días
    if (salesByDateMap30.has(docDateStr)) {
      const entry30 = salesByDateMap30.get(docDateStr)!;
      entry30.totalAmount += total;
      entry30.transactionsCount += 1;
    }

    // 4. Periodo seleccionado por el usuario
    if (isDocInDateRange(docDateStr, dateRange)) {
      periodSalesAmount += total;
      periodTransactionsCount += 1;

      // Canal
      const channel = resolveChannel(doc);
      channelCounters[channel].total += total;
      channelCounters[channel].count += 1;

      // Productos
      const items = Array.isArray(doc.items) ? doc.items : [];
      for (const it of items) {
        const prodName = it.description || it.productName || it.name || "Artículo general";
        const qty = Number(it.quantity || 1);
        const itemRevenue = Number(it.total || (it.unitPrice ? it.unitPrice * qty : 0));
        const key = prodName.toLowerCase().trim();

        const prev = productCounters.get(key) || {
          productId: it.productId || it.id || null,
          name: prodName,
          quantity: 0,
          revenue: 0,
        };
        prev.quantity += qty;
        prev.revenue += itemRevenue;
        productCounters.set(key, prev);
      }
    }
  }

  // Ticket promedio del periodo
  const averageTicketAmount =
    periodTransactionsCount > 0 ? Math.round(periodSalesAmount / periodTransactionsCount) : 0;

  // Desglose de canales
  const channelLabels: Record<SalesChannelType, string> = {
    mostrador: "Mostrador / POS",
    mesa: "Mesa (Salón)",
    domicilio: "Domicilio / WhatsApp",
    digital_menu: "Menú Digital QR",
  };

  const channels: SalesChannelMeta[] = (Object.keys(channelCounters) as SalesChannelType[]).map((ch) => {
    const data = channelCounters[ch];
    const pct = periodSalesAmount > 0 ? Math.round((data.total / periodSalesAmount) * 100) : 0;
    return {
      channel: ch,
      label: channelLabels[ch],
      totalAmount: data.total,
      transactionsCount: data.count,
      percentage: pct,
    };
  });

  // Canal líder
  const sortedChannels = [...channels].sort((a, b) => b.totalAmount - a.totalAmount);
  const topChannel = sortedChannels[0] && sortedChannels[0].totalAmount > 0 ? sortedChannels[0] : null;

  // Top 5 productos
  const topProducts: TopProductItem[] = Array.from(productCounters.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((p) => ({
      productId: p.productId,
      productName: p.name,
      quantitySold: p.quantity,
      revenue: p.revenue,
    }));

  // Gráfico de barras últimos 7 días
  const last7DaysDailySales: DailySalesBarItem[] = last7DaysStrings.map((dateStr) => {
    const data = salesByDateMap7.get(dateStr) || { totalAmount: 0, transactionsCount: 0 };
    return {
      date: dateStr,
      dayName: getDayNameShort(dateStr, businessTimezone),
      formattedDate: getFormattedDateShort(dateStr, businessTimezone),
      totalAmount: data.totalAmount,
      transactionsCount: data.transactionsCount,
    };
  });

  // Gráfico de línea últimos 30 días con acumulado
  let runningTotal = 0;
  const last30DaysTrendSales: TrendSalesLineItem[] = last30DaysStrings.map((dateStr) => {
    const data = salesByDateMap30.get(dateStr) || { totalAmount: 0, transactionsCount: 0 };
    runningTotal += data.totalAmount;
    return {
      date: dateStr,
      dayName: getDayNameShort(dateStr, businessTimezone),
      formattedDate: getFormattedDateShort(dateStr, businessTimezone),
      totalAmount: data.totalAmount,
      accumulatedAmount: runningTotal,
      transactionsCount: data.transactionsCount,
    };
  });

  const kpis: SalesKpiSummary = {
    todaySalesAmount,
    todayTransactionsCount,
    weekSalesAmount,
    weekTransactionsCount,
    monthSalesAmount,
    monthTransactionsCount,
    periodSalesAmount,
    periodTransactionsCount,
    averageTicketAmount,
    topChannel,
  };

  const isEmpty = periodTransactionsCount === 0 && rawDocs.length === 0;

  return {
    kpis,
    channels,
    topProducts,
    last7DaysDailySales,
    last30DaysTrendSales,
    periodDailySales: last7DaysDailySales,
    totalDocumentsAnalyzed: rawDocs.length,
    dateRange,
    isEmpty,
  };
}

/**
 * Mapeo amigable para canal de venta en UI y reportes
 */
export function getChannelLabel(channel: SalesChannelType): string {
  switch (channel) {
    case "mostrador":
      return "Mostrador (POS)";
    case "mesa":
      return "Salón / Mesas";
    case "domicilio":
      return "Domicilio";
    case "digital_menu":
      return "Menú Digital QR";
    default:
      return "Mostrador";
  }
}

/**
 * Mapeo amigable para método de pago en UI y reportes
 */
export function getPaymentMethodLabel(method?: string | null): string {
  if (!method) return "No especificado";
  const m = method.toLowerCase().trim();
  switch (m) {
    case "cash":
    case "efectivo":
      return "Efectivo";
    case "card":
    case "tarjeta":
      return "Tarjeta";
    case "transfer":
    case "transferencia":
      return "Transferencia";
    case "credit":
    case "credito":
    case "a_credito":
      return "A Crédito";
    case "split":
    case "multiple":
    case "mixto":
      return "Pago Mixto";
    case "qr":
    case "nequi":
    case "daviplata":
      return "Digital / QR";
    default:
      return m.charAt(0).toUpperCase() + m.slice(1);
  }
}

/**
 * [REP-002] Consulta detallada de ventas con soporte para filtros multidimensionales,
 * cálculo estricto de totales para el resumen y auditoría de anulaciones.
 */
export async function getSalesReportData(
  businessId: string,
  filterParams: SalesReportFilterParams = {},
  businessTimezone: string = "America/Bogota"
): Promise<SalesReportData> {
  const supabase = await getDbClient();

  const now = new Date();
  const todayStr = getLocalDateString(now, businessTimezone);

  // Ayer
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterday, businessTimezone);

  // Inicio del mes (YYYY-MM-01)
  const [currentYear, currentMonth] = todayStr.split("-");
  const monthStartStr = `${currentYear}-${currentMonth}-01`;

  // Últimos 7 días
  const last7DaysStrings: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    last7DaysStrings.push(getLocalDateString(d, businessTimezone));
  }

  // 1. Consultar comprobantes comerciales, pedidos asociados, perfiles y datos del negocio
  const [docsRes, ordersRes, profilesRes, businessRes] = await Promise.all([
    supabase
      .from("business_sale_documents")
      .select("id, business_id, restaurant_order_id, document_number, total, subtotal, tax_total, discount_total, payment_method, customer_name, customer_id, items, status, notes, issued_at, created_at, created_by")
      .eq("business_id", businessId)
      .order("issued_at", { ascending: false }),
    supabase
      .from("restaurant_orders")
      .select("id, business_id, order_number, order_type, channel_origin, table_id, customer_name, created_by, notes, status, total, subtotal, tax_total, created_at")
      .eq("business_id", businessId),
    supabase
      .from("profiles")
      .select("id, full_name, email"),
    supabase
      .from("businesses")
      .select("id, name, commercial_name")
      .eq("id", businessId)
      .maybeSingle(),
  ]);

  const rawDocs = docsRes.data || [];
  const rawOrders = ordersRes.data || [];
  const rawProfiles = profilesRes.data || [];
  const businessName = businessRes.data?.commercial_name || businessRes.data?.name || "Comercio NEGOVA";

  // Mapeo de perfiles para nombres de empleados
  const profilesMap = new Map<string, string>();
  for (const prof of rawProfiles) {
    if (prof.id && prof.full_name) {
      profilesMap.set(prof.id, prof.full_name);
    }
  }

  // Mapeo de pedidos por ID
  const ordersMap = new Map<string, any>();
  for (const ord of rawOrders) {
    ordersMap.set(ord.id, ord);
  }

  // Conjunto de IDs de pedidos ya cubiertos por documentos
  const coveredOrderIds = new Set<string>();
  for (const doc of rawDocs) {
    if (doc.restaurant_order_id) {
      coveredOrderIds.add(doc.restaurant_order_id);
    }
  }

  // Resolver canal
  const resolveChannel = (doc: any, linkedOrder?: any): SalesChannelType => {
    const ord = linkedOrder || (doc.restaurant_order_id ? ordersMap.get(doc.restaurant_order_id) : null);
    if (ord) {
      if (ord.channel_origin === "digital_menu") return "digital_menu";
      if (ord.order_type === "delivery" || ord.channel_origin === "whatsapp") return "domicilio";
      if (ord.order_type === "dine_in") return "mesa";
      return "mostrador";
    }
    return "mostrador";
  };

  // Extraer motivo de cancelación
  const extractCancellationReason = (notes?: string | null): string | null => {
    if (!notes) return null;
    const match = notes.match(/Cancelaci[oó]n:\s*([^|]+)/i) || notes.match(/Motivo:\s*([^|]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return notes.trim();
  };

  // Construir registros unificados
  const allRows: SalesReportRow[] = [];

  // A. Desde `business_sale_documents`
  for (const doc of rawDocs) {
    const linkedOrder = doc.restaurant_order_id ? ordersMap.get(doc.restaurant_order_id) : null;
    const channel = resolveChannel(doc, linkedOrder);
    const docDate = doc.issued_at || doc.created_at;
    const dateObj = new Date(docDate);
    const docDateStr = getLocalDateString(docDate, businessTimezone);

    // Formatear fecha y hora
    let formattedDate = docDateStr;
    try {
      formattedDate = dateObj.toLocaleString("es-CO", {
        timeZone: businessTimezone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      formattedDate = docDateStr;
    }

    const isCancelled = doc.status === "cancelled" || doc.status === "annulled";
    const status: "completed" | "cancelled" | "pending" = isCancelled
      ? "cancelled"
      : doc.status === "pending"
      ? "pending"
      : "completed";

    const employeeId = doc.created_by || linkedOrder?.created_by || null;
    const employeeName = employeeId ? (profilesMap.get(employeeId) || "Colaborador") : "Sistema / POS";

    const total = Number(doc.total || 0);
    const taxTotal = Number(doc.tax_total || 0);
    const discountTotal = Number(doc.discount_total || 0);
    const subtotal = Number(doc.subtotal !== undefined && doc.subtotal !== null ? doc.subtotal : (total - taxTotal + discountTotal));

    const cancellationReason = isCancelled ? (extractCancellationReason(doc.notes) || extractCancellationReason(linkedOrder?.notes) || "Cancelación de venta") : null;

    allRows.push({
      id: doc.id,
      documentNumber: doc.document_number || `DOC-${doc.id.slice(0, 8).toUpperCase()}`,
      issuedAt: docDate,
      formattedDate,
      customerName: doc.customer_name?.trim() || linkedOrder?.customer_name?.trim() || "Consumidor Final",
      channel,
      channelLabel: getChannelLabel(channel),
      paymentMethod: doc.payment_method || "cash",
      paymentMethodLabel: getPaymentMethodLabel(doc.payment_method),
      subtotal,
      taxTotal,
      discountTotal,
      total,
      status,
      statusLabel: isCancelled ? "Anulada" : status === "pending" ? "Pendiente" : "Completada",
      cancellationReason,
      employeeId,
      employeeName,
    });
  }

  // B. Desde `restaurant_orders` que no posean comprobante emitido
  for (const ord of rawOrders) {
    if (coveredOrderIds.has(ord.id)) continue;
    // Considerar órdenes entregadas o canceladas
    if (!["delivered", "cancelled", "paid"].includes(ord.status)) continue;

    const channel = resolveChannel(ord, ord);
    const orderDate = ord.created_at;
    const dateObj = new Date(orderDate);
    const orderDateStr = getLocalDateString(orderDate, businessTimezone);

    let formattedDate = orderDateStr;
    try {
      formattedDate = dateObj.toLocaleString("es-CO", {
        timeZone: businessTimezone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      formattedDate = orderDateStr;
    }

    const isCancelled = ord.status === "cancelled";
    const status: "completed" | "cancelled" | "pending" = isCancelled ? "cancelled" : "completed";

    const employeeId = ord.created_by || null;
    const employeeName = employeeId ? (profilesMap.get(employeeId) || "Colaborador") : "Sistema / POS";

    const total = Number(ord.total || 0);
    const taxTotal = Number(ord.tax_total || 0);
    const subtotal = Number(ord.subtotal || total);
    const discountTotal = Math.max(0, subtotal + taxTotal - total);

    const cancellationReason = isCancelled ? (extractCancellationReason(ord.notes) || "Cancelación de comanda") : null;

    allRows.push({
      id: ord.id,
      documentNumber: ord.order_number ? `#${ord.order_number}` : `ORD-${ord.id.slice(0, 8).toUpperCase()}`,
      issuedAt: orderDate,
      formattedDate,
      customerName: ord.customer_name?.trim() || "Consumidor Final",
      channel,
      channelLabel: getChannelLabel(channel),
      paymentMethod: "cash",
      paymentMethodLabel: "Efectivo",
      subtotal,
      taxTotal,
      discountTotal,
      total,
      status,
      statusLabel: isCancelled ? "Anulada" : "Completada",
      cancellationReason,
      employeeId,
      employeeName,
    });
  }

  // Ordenar cronológicamente descendente
  allRows.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

  // Lista única de empleados detectados para el dropdown de filtros
  const employeesMap = new Map<string, string>();
  for (const row of allRows) {
    if (row.employeeId && row.employeeName) {
      employeesMap.set(row.employeeId, row.employeeName);
    }
  }
  const employees = Array.from(employeesMap.entries()).map(([id, name]) => ({ id, name }));

  // Helper para evaluar rango de fecha
  const effectivePreset = filterParams.preset || "this_month";
  const isRowInDateRange = (rowIso: string): boolean => {
    const rowDateStr = getLocalDateString(rowIso, businessTimezone);
    switch (effectivePreset) {
      case "today":
        return rowDateStr === todayStr;
      case "yesterday":
        return rowDateStr === yesterdayStr;
      case "last_7_days":
        return last7DaysStrings.includes(rowDateStr);
      case "this_month":
        return rowDateStr >= monthStartStr && rowDateStr <= todayStr;
      case "custom": {
        const start = filterParams.startDate || monthStartStr;
        const end = filterParams.endDate || todayStr;
        return rowDateStr >= start && rowDateStr <= end;
      }
      default:
        return rowDateStr >= monthStartStr && rowDateStr <= todayStr;
    }
  };

  // Filtrar filas según los criterios del usuario
  const filteredRows = allRows.filter((row) => {
    // 1. Filtro de fecha
    if (!isRowInDateRange(row.issuedAt)) return false;

    // 2. Filtro de canal
    if (filterParams.channel && filterParams.channel !== "all") {
      if (row.channel !== filterParams.channel) return false;
    }

    // 3. Filtro de método de pago
    if (filterParams.paymentMethod && filterParams.paymentMethod !== "all") {
      const pm = filterParams.paymentMethod.toLowerCase();
      if (row.paymentMethod.toLowerCase() !== pm && row.paymentMethodLabel.toLowerCase() !== pm) {
        return false;
      }
    }

    // 4. Filtro de empleado
    if (filterParams.employeeId && filterParams.employeeId !== "all") {
      if (row.employeeId !== filterParams.employeeId) return false;
    }

    // 5. Filtro de estado
    if (filterParams.status && filterParams.status !== "all") {
      if (filterParams.status === "completed") {
        if (row.status !== "completed") return false;
      } else if (filterParams.status === "cancelled") {
        if (row.status !== "cancelled") return false;
      }
    }

    // 6. Búsqueda de texto (número de documento o cliente)
    if (filterParams.search && filterParams.search.trim()) {
      const q = filterParams.search.trim().toLowerCase();
      const matchDoc = row.documentNumber.toLowerCase().includes(q);
      const matchCust = row.customerName.toLowerCase().includes(q);
      const matchMotive = row.cancellationReason?.toLowerCase().includes(q) || false;
      if (!matchDoc && !matchCust && !matchMotive) return false;
    }

    return true;
  });

  // Calcular el resumen inferior exactamente sobre las filas visibles filtradas
  const summary: SalesReportSummary = {
    totalGross: filteredRows.reduce((acc, r) => acc + r.subtotal, 0),
    totalTax: filteredRows.reduce((acc, r) => acc + r.taxTotal, 0),
    totalDiscount: filteredRows.reduce((acc, r) => acc + r.discountTotal, 0),
    totalNet: filteredRows.reduce((acc, r) => acc + r.total, 0),
    transactionCount: filteredRows.length,
  };

  const dateRange: ReportsDateRange = {
    preset: effectivePreset,
    startDate: filterParams.startDate,
    endDate: filterParams.endDate,
  };

  return {
    rows: filteredRows,
    summary,
    dateRange,
    filterParams,
    employees,
    businessName,
  };
}



/**
 * Helper para extraer monto de propina desde restaurant_orders
 */
function extractTipFromOrder(order: any): number {
  if (order.tip_amount !== undefined && order.tip_amount !== null) {
    const tip = Number(order.tip_amount);
    if (!isNaN(tip) && tip > 0) return tip;
  }
  const notes = String(order.notes || "");
  const match = notes.match(/Propina:\s*\+\$?([\d.,]+)/i);
  if (match && match[1]) {
    const parsed = Number(match[1].replace(/[.,]/g, ""));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

/**
 * [REP-003] Consulta y consolida las métricas del Reporte de Empleados.
 * 
 * Criterios de Aceptación:
 * 1. Se listan todos los empleados activos del negocio (business_users con status = 'active').
 * 2. Las ventas por empleado coinciden con la suma de business_sale_documents donde created_by = empleado.
 * 3. El ranking ordena de mayor a menor por monto vendido.
 * 4. Soporta filtros por rango de fecha, ubicación y rol.
 */
export async function getEmployeeReportData(
  businessId: string,
  filterParams: EmployeeReportFilterParams = {},
  businessTimezone: string = "America/Bogota"
): Promise<EmployeeReportData> {
  const supabase = await getDbClient();

  const now = new Date();
  const todayStr = getLocalDateString(now, businessTimezone);

  // Ayer
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterday, businessTimezone);

  // Inicio del mes (YYYY-MM-01)
  const [currentYear, currentMonth] = todayStr.split("-");
  const monthStartStr = `${currentYear}-${currentMonth}-01`;

  // Últimos 7 días
  const last7DaysStrings: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    last7DaysStrings.push(getLocalDateString(d, businessTimezone));
  }

  // 1. Consultas paralelas
  const [
    businessUsersRes,
    profilesRes,
    rolesRes,
    locationsRes,
    cashRegistersRes,
    cashSessionsRes,
    saleDocsRes,
    ordersRes,
    businessRes,
  ] = await Promise.all([
    supabase
      .from("business_users")
      .select("id, user_id, business_id, role_id, status, joined_at, roles(id, code, name)")
      .eq("business_id", businessId),
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url"),
    supabase
      .from("roles")
      .select("id, code, name"),
    supabase
      .from("locations")
      .select("id, name, type, is_active")
      .eq("business_id", businessId),
    supabase
      .from("cash_registers")
      .select("id, name, location_id, is_active")
      .eq("business_id", businessId),
    supabase
      .from("cash_sessions")
      .select("id, register_id, opened_by, opened_at, closed_by, closed_at, status")
      .eq("business_id", businessId),
    supabase
      .from("business_sale_documents")
      .select("id, business_id, restaurant_order_id, document_number, total, subtotal, status, issued_at, created_at, created_by")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .neq("status", "annulled"),
    supabase
      .from("restaurant_orders")
      .select("id, business_id, created_by, tip_amount, notes, status, created_at, total")
      .eq("business_id", businessId)
      .neq("status", "cancelled"),
    supabase
      .from("businesses")
      .select("id, name, commercial_name")
      .eq("id", businessId)
      .maybeSingle(),
  ]);

  const rawBusinessUsers = businessUsersRes.data || [];
  const rawProfiles = profilesRes.data || [];
  const rawRoles = rolesRes.data || [];
  const rawLocations = locationsRes.data || [];
  const rawRegisters = cashRegistersRes.data || [];
  const rawSessions = cashSessionsRes.data || [];
  const rawDocs = saleDocsRes.data || [];
  const rawOrders = ordersRes.data || [];
  const businessName = businessRes.data?.commercial_name || businessRes.data?.name || "Comercio NEGOVA";

  // Mapeos de búsqueda rápida
  const profilesMap = new Map<string, { full_name?: string | null; email?: string | null; avatar_url?: string | null }>();
  for (const prof of rawProfiles) {
    if (prof.id) {
      profilesMap.set(prof.id, prof);
    }
  }

  const rolesMap = new Map<string, { code: string; name: string }>();
  for (const r of rawRoles) {
    if (r.id) {
      rolesMap.set(r.id, { code: r.code, name: r.name });
    }
  }

  const locationsMap = new Map<string, string>();
  for (const loc of rawLocations) {
    if (loc.id) {
      locationsMap.set(loc.id, loc.name);
    }
  }

  const registersMap = new Map<string, { name: string; location_id?: string | null }>();
  for (const reg of rawRegisters) {
    if (reg.id) {
      registersMap.set(reg.id, { name: reg.name, location_id: reg.location_id });
    }
  }

  // Helper para verificar fecha dentro del período seleccionado
  const effectivePreset = filterParams.preset || "this_month";
  const isDateInPeriod = (dateVal: string | null | undefined): boolean => {
    if (!dateVal) return false;
    const dateStr = getLocalDateString(dateVal, businessTimezone);
    switch (effectivePreset) {
      case "today":
        return dateStr === todayStr;
      case "yesterday":
        return dateStr === yesterdayStr;
      case "last_7_days":
        return last7DaysStrings.includes(dateStr);
      case "this_month":
        return dateStr >= monthStartStr && dateStr <= todayStr;
      case "custom": {
        const start = filterParams.startDate || monthStartStr;
        const end = filterParams.endDate || todayStr;
        return dateStr >= start && dateStr <= end;
      }
      default:
        return dateStr >= monthStartStr && dateStr <= todayStr;
    }
  };

  // Filtrar comprobantes de venta válidos del período
  const periodDocs = rawDocs.filter((d) => isDateInPeriod(d.issued_at || d.created_at));

  // Filtrar sesiones de caja válidas del período
  const periodSessions = rawSessions.filter((s) => isDateInPeriod(s.opened_at));

  // Filtrar comandas válidas del período (para propinas)
  const periodOrders = rawOrders.filter((o) => isDateInPeriod(o.created_at));

  // Manejo de filtro de ubicación
  const isLocationFilterActive = Boolean(filterParams.locationId && filterParams.locationId !== "all");
  const targetLocationId = filterParams.locationId;
  const registersInLocation = new Set<string>();
  if (isLocationFilterActive) {
    for (const reg of rawRegisters) {
      if (reg.location_id === targetLocationId) {
        registersInLocation.add(reg.id);
      }
    }
  }

  // Sesiones de caja filtradas por ubicación si aplica
  const eligibleSessions = isLocationFilterActive
    ? periodSessions.filter((s) => registersInLocation.has(s.register_id))
    : periodSessions;

  // Criterio 1: Se listan todos los empleados activos del negocio
  const activeMemberships = rawBusinessUsers.filter((bu) => bu.status === "active");

  // También detectar si existen otros IDs de usuario que emitieron ventas para garantizar consistencia contable
  const userIdsWithSales = new Set(periodDocs.map((d) => d.created_by).filter(Boolean));

  // Diccionario consolidado de empleados
  const employeeItemsMap = new Map<string, EmployeeReportMetricItem>();

  // 1. Registrar todos los colaboradores activos de business_users
  for (const bu of activeMemberships) {
    const userId = bu.user_id;
    if (!userId) continue;

    const prof = profilesMap.get(userId);
    const roleMeta = (bu as any).roles || rolesMap.get(bu.role_id) || { code: "auxiliar", name: "Auxiliar" };
    const empName = prof?.full_name?.trim() || prof?.email?.split("@")[0] || "Colaborador";
    const empEmail = prof?.email || null;
    const empAvatar = prof?.avatar_url || null;

    employeeItemsMap.set(userId, {
      id: bu.id,
      userId,
      name: empName,
      email: empEmail,
      roleId: bu.role_id || null,
      roleCode: roleMeta.code || "auxiliar",
      roleName: roleMeta.name || "Auxiliar",
      avatarUrl: empAvatar,
      status: "active",
      salesCount: 0,
      totalSalesAmount: 0,
      averageTicketAmount: 0,
      shiftsCount: 0,
      totalHoursWorked: 0,
      totalTipsAmount: 0,
      locations: [],
      rank: 0,
      salesPercentage: 0,
    });
  }

  // 2. Si hay ventas de usuarios no listados en membresías activas (ej. administradores del sistema), agregarlos
  for (const uid of userIdsWithSales) {
    if (!employeeItemsMap.has(uid!)) {
      const prof = profilesMap.get(uid!);
      const empName = prof?.full_name?.trim() || prof?.email?.split("@")[0] || "Colaborador";
      employeeItemsMap.set(uid!, {
        id: `emp-ext-${uid}`,
        userId: uid!,
        name: empName,
        email: prof?.email || null,
        roleId: null,
        roleCode: "cajero",
        roleName: "Cajero / Operador",
        avatarUrl: prof?.avatar_url || null,
        status: "active",
        salesCount: 0,
        totalSalesAmount: 0,
        averageTicketAmount: 0,
        shiftsCount: 0,
        totalHoursWorked: 0,
        totalTipsAmount: 0,
        locations: [],
        rank: 0,
        salesPercentage: 0,
      });
    }
  }

  // 3. Imputar ventas: Criterio 2: "Las ventas por empleado coinciden con la suma de business_sale_documents donde created_by = empleado"
  for (const doc of periodDocs) {
    const creatorId = doc.created_by;
    if (creatorId && employeeItemsMap.has(creatorId)) {
      const emp = employeeItemsMap.get(creatorId)!;
      const docTotal = Number(doc.total || 0);
      emp.salesCount += 1;
      emp.totalSalesAmount += docTotal;
    }
  }

  // 4. Imputar turnos de caja y horas laboradas
  for (const session of eligibleSessions) {
    const openerId = session.opened_by;
    if (openerId && employeeItemsMap.has(openerId)) {
      const emp = employeeItemsMap.get(openerId)!;
      emp.shiftsCount += 1;

      // Calcular horas de la sesión
      try {
        const openedAt = new Date(session.opened_at).getTime();
        const closedAt = session.closed_at ? new Date(session.closed_at).getTime() : Date.now();
        const durationHours = Math.max(0, (closedAt - openedAt) / (1000 * 60 * 60));
        emp.totalHoursWorked += durationHours;
      } catch {
        // Ignorar fechas malformadas
      }

      // Asignar ubicación de la caja si existe
      const reg = registersMap.get(session.register_id);
      if (reg?.location_id && locationsMap.has(reg.location_id)) {
        const locName = locationsMap.get(reg.location_id)!;
        if (!emp.locations.includes(locName)) {
          emp.locations.push(locName);
        }
      }
    }
  }

  // 5. Imputar propinas recibidas
  for (const order of periodOrders) {
    const creatorId = order.created_by;
    if (creatorId && employeeItemsMap.has(creatorId)) {
      const emp = employeeItemsMap.get(creatorId)!;
      const tip = extractTipFromOrder(order);
      if (tip > 0) {
        emp.totalTipsAmount += tip;
      }
    }
  }

  // 6. Normalizar decimales y ticket promedio por empleado
  for (const emp of employeeItemsMap.values()) {
    emp.totalSalesAmount = Number(emp.totalSalesAmount.toFixed(2));
    emp.averageTicketAmount = emp.salesCount > 0 ? Number((emp.totalSalesAmount / emp.salesCount).toFixed(2)) : 0;
    emp.totalHoursWorked = Number(emp.totalHoursWorked.toFixed(1));
    emp.totalTipsAmount = Number(emp.totalTipsAmount.toFixed(2));
  }

  // 7. Aplicar filtros de rol, ubicación y búsqueda
  let filteredEmployees = Array.from(employeeItemsMap.values());

  // Filtro por rol
  if (filterParams.roleCode && filterParams.roleCode !== "all") {
    filteredEmployees = filteredEmployees.filter((emp) => emp.roleCode === filterParams.roleCode);
  }

  // Filtro por ubicación (si el empleado tiene turnos o ventas en dicha ubicación)
  if (isLocationFilterActive && targetLocationId) {
    const targetLocName = locationsMap.get(targetLocationId);
    if (targetLocName) {
      filteredEmployees = filteredEmployees.filter(
        (emp) => emp.locations.includes(targetLocName) || (emp.shiftsCount > 0 && emp.locations.length === 0)
      );
    }
  }

  // Filtro de búsqueda textual
  if (filterParams.search && filterParams.search.trim()) {
    const q = filterParams.search.trim().toLowerCase();
    filteredEmployees = filteredEmployees.filter(
      (emp) => emp.name.toLowerCase().includes(q) || (emp.email && emp.email.toLowerCase().includes(q))
    );
  }

  // 8. Criterio 3: "El ranking ordena de mayor a menor por monto vendido"
  filteredEmployees.sort((a, b) => {
    if (b.totalSalesAmount !== a.totalSalesAmount) {
      return b.totalSalesAmount - a.totalSalesAmount;
    }
    if (b.salesCount !== a.salesCount) {
      return b.salesCount - a.salesCount;
    }
    return a.name.localeCompare(b.name);
  });

  // Asignar posición de ranking y porcentaje de ventas
  const totalTeamSales = filteredEmployees.reduce((acc, emp) => acc + emp.totalSalesAmount, 0);

  filteredEmployees.forEach((emp, index) => {
    emp.rank = index + 1;
    emp.salesPercentage = totalTeamSales > 0 ? Number(((emp.totalSalesAmount / totalTeamSales) * 100).toFixed(1)) : 0;
  });

  // 9. Resumen consolidado del equipo
  const totalTeamSalesCount = filteredEmployees.reduce((acc, emp) => acc + emp.salesCount, 0);
  const averageTeamTicket = totalTeamSalesCount > 0 ? Number((totalTeamSales / totalTeamSalesCount).toFixed(2)) : 0;
  const totalShiftsWorked = filteredEmployees.reduce((acc, emp) => acc + emp.shiftsCount, 0);
  const totalHoursWorked = Number(filteredEmployees.reduce((acc, emp) => acc + emp.totalHoursWorked, 0).toFixed(1));
  const totalTipsAmount = Number(filteredEmployees.reduce((acc, emp) => acc + emp.totalTipsAmount, 0).toFixed(2));
  const topPerformer = filteredEmployees.find((emp) => emp.totalSalesAmount > 0) || filteredEmployees[0] || null;

  const summary: EmployeeReportSummary = {
    totalEmployees: filteredEmployees.length,
    activeEmployeesCount: filteredEmployees.filter((emp) => emp.status === "active").length,
    totalTeamSalesAmount: totalTeamSales,
    totalTeamSalesCount,
    averageTeamTicketAmount: averageTeamTicket,
    totalShiftsWorked,
    totalHoursWorked,
    totalTipsAmount,
    topPerformerName: topPerformer ? topPerformer.name : null,
    topPerformerSalesAmount: topPerformer ? topPerformer.totalSalesAmount : 0,
  };

  // 10. Listas de roles y ubicaciones disponibles para los filtros de UI
  const rolesSet = new Map<string, string>();
  for (const emp of employeeItemsMap.values()) {
    if (emp.roleCode && emp.roleName) {
      rolesSet.set(emp.roleCode, emp.roleName);
    }
  }
  for (const r of rawRoles) {
    if (r.code && r.name && !rolesSet.has(r.code)) {
      rolesSet.set(r.code, r.name);
    }
  }

  const availableRoles = [
    { code: "all", name: "Todos los roles" },
    ...Array.from(rolesSet.entries()).map(([code, name]) => ({ code, name })),
  ];

  const availableLocations = [
    { id: "all", name: "Todas las ubicaciones" },
    ...rawLocations.filter((l) => l.is_active).map((l) => ({ id: l.id, name: l.name })),
  ];

  const dateRange: ReportsDateRange = {
    preset: effectivePreset,
    startDate: filterParams.startDate,
    endDate: filterParams.endDate,
  };

  return {
    employees: filteredEmployees,
    summary,
    dateRange,
    filterParams,
    availableRoles,
    availableLocations,
    businessName,
  };
}



// ==========================================
// SERVICIO DE REPORTE DE INVENTARIO [REP-004]
// ==========================================

const INVENTORY_MOVEMENT_TYPE_LABELS: Record<string, string> = {
  entry: "Entrada de Stock",
  exit: "Salida de Stock",
  adjustment: "Ajuste de Inventario",
  transfer_in: "Transferencia (Entrada)",
  transfer_out: "Transferencia (Salida)",
  sale: "Venta",
  spoilage: "Merma / Pérdida",
};

/**
 * Formatea la referencia documental o motivo que generó el movimiento de inventario.
 * Criterio de aceptación: Los movimientos muestran referencia a la orden/compra/ajuste que los generó.
 */
function formatMovementReference(row: any): string {
  const refType = row.reference_type;
  const notes = (row.notes || "").trim();
  const refId = row.reference_id ? String(row.reference_id).slice(0, 8) : null;

  if (refType === "purchase") {
    return notes ? notes : (refId ? `Compra #${refId}` : "Compra Proveedor");
  }
  if (refType === "sale") {
    return notes ? notes : (refId ? `Venta #${refId}` : "Venta POS");
  }
  if (refType === "adjustment") {
    return notes ? `Ajuste: ${notes}` : (refId ? `Ajuste #${refId}` : "Ajuste de Stock");
  }
  if (refType === "transfer") {
    return notes ? `Transferencia: ${notes}` : (refId ? `Transf. #${refId}` : "Transferencia");
  }
  if (refType === "spoilage") {
    return notes ? `Merma: ${notes}` : (refId ? `Merma #${refId}` : "Merma / Pérdida");
  }

  // Fallback si no hay reference_type explícito pero hay notas
  if (notes) {
    return notes;
  }
  if (refId) {
    return `Ref. #${refId}`;
  }
  return "Directo / Operativo";
}

/**
 * [REP-004] Consulta y consolida el reporte exhaustivo de inventario:
 * existencias actuales, movimientos del período y alertas de stock bajo.
 */
export async function getInventoryReportData(
  businessId: string,
  filterParams: InventoryReportFilterParams = {},
  businessTimezone: string = "America/Bogota"
): Promise<InventoryReportData> {
  const supabase = await getDbClient();

  const now = new Date();
  const todayStr = getLocalDateString(now, businessTimezone);

  let startIso: string | undefined = undefined;
  let endIso: string | undefined = undefined;

  const effectivePreset = filterParams.preset || "this_month";

  switch (effectivePreset) {
    case "today": {
      startIso = `${todayStr}T00:00:00.000Z`;
      endIso = `${todayStr}T23:59:59.999Z`;
      break;
    }
    case "yesterday": {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = getLocalDateString(yesterday, businessTimezone);
      startIso = `${yesterdayStr}T00:00:00.000Z`;
      endIso = `${yesterdayStr}T23:59:59.999Z`;
      break;
    }
    case "last_7_days": {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const d7Str = getLocalDateString(d7, businessTimezone);
      startIso = `${d7Str}T00:00:00.000Z`;
      endIso = `${todayStr}T23:59:59.999Z`;
      break;
    }
    case "this_month": {
      const [year, month] = todayStr.split("-");
      startIso = `${year}-${month}-01T00:00:00.000Z`;
      endIso = `${todayStr}T23:59:59.999Z`;
      break;
    }
    case "custom": {
      if (filterParams.startDate) {
        startIso = `${filterParams.startDate}T00:00:00.000Z`;
      }
      if (filterParams.endDate) {
        endIso = `${filterParams.endDate}T23:59:59.999Z`;
      }
      break;
    }
  }

  // 1. Consultas paralelas
  const [
    stockRes,
    movementsRes,
    locationsRes,
    categoriesRes,
    profilesRes,
    businessRes,
  ] = await Promise.all([
    supabase
      .from("inventory_stock")
      .select("id, product_id, location_id, quantity, min_stock, cost, updated_at, products(id, name, sku, category_id, cost, price, is_active, metadata, categories(id, name)), locations(id, name, type, is_active)")
      .eq("business_id", businessId),
    supabase
      .from("inventory_movements")
      .select("id, product_id, location_id, movement_type, quantity, unit_cost, total_cost, reference_id, reference_type, notes, created_by, created_at, products(id, name, sku, metadata), locations(id, name)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase
      .from("locations")
      .select("id, name, type, is_active")
      .eq("business_id", businessId)
      .order("name", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name")
      .eq("business_id", businessId)
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, email"),
    supabase
      .from("businesses")
      .select("id, name, commercial_name")
      .eq("id", businessId)
      .maybeSingle(),
  ]);

  const rawStock = stockRes.data || [];
  const rawMovements = movementsRes.data || [];
  const rawLocations = locationsRes.data || [];
  const rawCategories = categoriesRes.data || [];
  const rawProfiles = profilesRes.data || [];
  const businessName = businessRes.data?.commercial_name || businessRes.data?.name || "Comercio";

  // Mapeo de usuarios por ID para enriquecer movimientos
  const userMap = new Map<string, string>();
  for (const p of rawProfiles) {
    userMap.set(p.id, p.full_name || p.email || "Usuario");
  }

  // 2. Procesar Existencias Actuales (inventory_stock)
  const stockRows: InventoryStockReportRow[] = [];
  const searchTerm = (filterParams.search || "").toLowerCase().trim();

  for (const s of rawStock) {
    const prod = s.products as any;
    const loc = s.locations as any;

    const prodId = s.product_id;
    const prodName = prod?.name || "Producto sin nombre";
    const prodSku = prod?.sku || prod?.metadata?.sku || null;
    const catId = prod?.category_id || null;
    const catName = prod?.categories?.name || "Sin categoría";

    const locId = s.location_id;
    const locName = loc?.name || "Ubicación";

    const quantity = Number(s.quantity || 0);
    const minStock = Number(s.min_stock || 0);
    const cost = Number(s.cost || prod?.cost || 0);
    const totalValue = quantity > 0 ? quantity * cost : 0;

    // Determinar estado de stock
    let status: InventoryStockStatus = "normal";
    let statusLabel = "Normal";

    if (quantity <= 0) {
      status = "out_of_stock";
      statusLabel = "Agotado";
    } else if (quantity <= minStock) {
      status = "low";
      statusLabel = "Stock Bajo";
    }

    // Filtros de existencias
    if (filterParams.locationId && filterParams.locationId !== "all" && locId !== filterParams.locationId) {
      continue;
    }
    if (filterParams.categoryId && filterParams.categoryId !== "all" && catId !== filterParams.categoryId) {
      continue;
    }
    if (filterParams.status && filterParams.status !== "all" && status !== filterParams.status) {
      continue;
    }
    if (searchTerm) {
      const matchName = prodName.toLowerCase().includes(searchTerm);
      const matchSku = prodSku ? prodSku.toLowerCase().includes(searchTerm) : false;
      const matchLoc = locName.toLowerCase().includes(searchTerm);
      const matchCat = catName.toLowerCase().includes(searchTerm);
      if (!matchName && !matchSku && !matchLoc && !matchCat) {
        continue;
      }
    }

    stockRows.push({
      id: s.id,
      productId: prodId,
      productName: prodName,
      productSku: prodSku,
      categoryId: catId,
      categoryName: catName,
      locationId: locId,
      locationName: locName,
      quantity,
      minStock,
      cost,
      totalValue,
      status,
      statusLabel,
    });
  }

  // Ordenar stock: primero agotados, luego bajos, luego normales
  stockRows.sort((a, b) => {
    const orderPriority: Record<InventoryStockStatus, number> = {
      out_of_stock: 0,
      low: 1,
      normal: 2,
    };
    if (orderPriority[a.status] !== orderPriority[b.status]) {
      return orderPriority[a.status] - orderPriority[b.status];
    }
    return a.productName.localeCompare(b.productName);
  });

  // 3. Procesar Productos con Stock Bajo / Agotados
  const lowStockRows: InventoryLowStockReportRow[] = [];
  for (const row of stockRows) {
    if (row.status === "out_of_stock" || row.status === "low") {
      const deficit = Math.max(0, row.minStock - row.quantity);
      const replenishmentCost = deficit * row.cost;

      lowStockRows.push({
        productId: row.productId,
        productName: row.productName,
        productSku: row.productSku,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        locationId: row.locationId,
        locationName: row.locationName,
        quantity: row.quantity,
        minStock: row.minStock,
        cost: row.cost,
        deficit,
        replenishmentCost,
        status: row.status,
        statusLabel: row.statusLabel,
      });
    }
  }

  // 4. Procesar Movimientos del Período
  const movementsRows: InventoryMovementReportRow[] = [];

  for (const m of rawMovements) {
    const prod = m.products as any;
    const loc = m.locations as any;

    const locId = m.location_id;
    const movementDate = m.created_at;

    // Filtro por fecha del período
    if (startIso && movementDate < startIso) {
      continue;
    }
    if (endIso && movementDate > endIso) {
      continue;
    }

    // Filtro por ubicación
    if (filterParams.locationId && filterParams.locationId !== "all" && locId !== filterParams.locationId) {
      continue;
    }

    // Filtro por tipo de movimiento
    if (filterParams.movementType && filterParams.movementType !== "all" && m.movement_type !== filterParams.movementType) {
      continue;
    }

    const prodName = prod?.name || "Producto sin nombre";
    const prodSku = prod?.sku || prod?.metadata?.sku || null;
    const locName = loc?.name || "Ubicación";

    // Filtro por búsqueda
    if (searchTerm) {
      const matchName = prodName.toLowerCase().includes(searchTerm);
      const matchSku = prodSku ? prodSku.toLowerCase().includes(searchTerm) : false;
      const matchLoc = locName.toLowerCase().includes(searchTerm);
      const matchNotes = (m.notes || "").toLowerCase().includes(searchTerm);
      if (!matchName && !matchSku && !matchLoc && !matchNotes) {
        continue;
      }
    }

    let formattedDate = m.created_at;
    try {
      formattedDate = new Date(m.created_at).toLocaleDateString("es-CO", {
        timeZone: businessTimezone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      formattedDate = m.created_at;
    }

    const movementType = m.movement_type;
    const movementTypeLabel = INVENTORY_MOVEMENT_TYPE_LABELS[movementType] || movementType;
    const referenceLabel = formatMovementReference(m);
    const createdByName = m.created_by ? userMap.get(m.created_by) || "Usuario" : "Sistema";

    movementsRows.push({
      id: m.id,
      createdAt: m.created_at,
      formattedDate,
      productId: m.product_id,
      productName: prodName,
      productSku: prodSku,
      locationId: locId,
      locationName: locName,
      movementType,
      movementTypeLabel,
      quantity: Number(m.quantity || 0),
      unitCost: m.unit_cost !== null && m.unit_cost !== undefined ? Number(m.unit_cost) : null,
      totalCost: m.total_cost !== null && m.total_cost !== undefined ? Number(m.total_cost) : null,
      referenceId: m.reference_id || null,
      referenceType: m.reference_type || null,
      referenceLabel,
      notes: m.notes || null,
      createdBy: m.created_by || null,
      createdByName,
    });
  }

  // 5. Calcular Resumen Global
  let totalInventoryValue = 0;
  let totalItemsCount = 0;
  let outOfStockCount = 0;
  let lowStockCount = 0;
  let normalStockCount = 0;

  for (const r of stockRows) {
    if (r.quantity > 0) {
      totalInventoryValue += r.quantity * r.cost;
      totalItemsCount += r.quantity;
    }
    if (r.status === "out_of_stock") {
      outOfStockCount++;
    } else if (r.status === "low") {
      lowStockCount++;
    } else {
      normalStockCount++;
    }
  }

  const summary: InventoryReportSummary = {
    totalInventoryValue: Math.round(totalInventoryValue),
    totalItemsCount: Math.round(totalItemsCount * 100) / 100,
    totalProductsCount: stockRows.length,
    outOfStockCount,
    lowStockCount,
    normalStockCount,
    totalMovementsCount: movementsRows.length,
  };

  const availableLocations = [
    { id: "all", name: "Todas las ubicaciones" },
    ...rawLocations.filter((l) => l.is_active).map((l) => ({ id: l.id, name: l.name })),
  ];

  const availableCategories = [
    { id: "all", name: "Todas las categorías" },
    ...rawCategories.map((c) => ({ id: c.id, name: c.name })),
  ];

  const dateRange: ReportsDateRange = {
    preset: effectivePreset,
    startDate: filterParams.startDate,
    endDate: filterParams.endDate,
  };

  return {
    stockRows,
    movementsRows,
    lowStockRows,
    summary,
    filterParams,
    dateRange,
    availableLocations,
    availableCategories,
    businessName,
  };
}



/**
 * Paleta de colores distintivos para el gráfico de torta de categorías de gastos
 */
const EXPENSE_CATEGORY_PALETTE = [
  "#ED500A", // Naranja Negova
  "#3B82F6", // Azul
  "#10B981", // Esmeralda / Verde
  "#F59E0B", // Ámbar
  "#8B5CF6", // Violeta
  "#EC4899", // Rosa
  "#06B6D4", // Cian
  "#6366F1", // Índigo
  "#14B8A6", // Teal
  "#F97316", // Naranja cálido
  "#84CC16", // Lima
  "#64748B", // Pizarra
];

function formatPaymentMethodLabel(method?: string | null): string {
  if (!method) return "Efectivo";
  const m = method.toLowerCase();
  if (m === "cash" || m === "efectivo") return "Efectivo";
  if (m === "card" || m === "tarjeta") return "Tarjeta";
  if (m === "transfer" || m === "transferencia") return "Transferencia";
  if (m === "credit" || m === "credito") return "Crédito Proveedor";
  if (m === "other" || m === "otro") return "Otro";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

/**
 * [REP-005] Servicio analítico central para Reporte de Gastos y Compras.
 * Agrupa y concilia registros de public.expenses, public.purchases,
 * public.purchase_items y public.accounts_payable para una supervisión
 * financiera y de adquisiciones precisa.
 */
export async function getExpensesAndPurchasesReportData(
  businessId: string,
  filterParams: ExpensesAndPurchasesFilterParams = {},
  businessTimezone: string = "America/Bogota"
): Promise<ExpensesAndPurchasesReportData> {
  const supabase = await getDbClient();

  const now = new Date();
  const todayStr = getLocalDateString(now, businessTimezone);

  // Ayer
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterday, businessTimezone);

  // Inicio de mes
  const [currY, currM] = todayStr.split("-");
  const monthStartStr = `${currY}-${currM}-01`;

  // 7 días atrás
  const last7DaysDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const last7DaysStr = getLocalDateString(last7DaysDate, businessTimezone);

  // 30 días atrás
  const last30DaysDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const last30DaysStr = getLocalDateString(last30DaysDate, businessTimezone);

  const effectivePreset = filterParams.preset || "this_month";

  let effectiveStartDate = monthStartStr;
  let effectiveEndDate = todayStr;

  if (effectivePreset === "today") {
    effectiveStartDate = todayStr;
    effectiveEndDate = todayStr;
  } else if (effectivePreset === "yesterday") {
    effectiveStartDate = yesterdayStr;
    effectiveEndDate = yesterdayStr;
  } else if (effectivePreset === "last_7_days") {
    effectiveStartDate = last7DaysStr;
    effectiveEndDate = todayStr;
  } else if (effectivePreset === "this_month") {
    effectiveStartDate = monthStartStr;
    effectiveEndDate = todayStr;
  } else if (effectivePreset === "custom") {
    if (filterParams.startDate) effectiveStartDate = filterParams.startDate;
    if (filterParams.endDate) effectiveEndDate = filterParams.endDate;
  }

  // 1. Consultar tablas en paralelo
  const [
    expensesRes,
    purchasesRes,
    purchaseItemsRes,
    suppliersRes,
    apRes,
    businessRes,
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, business_id, concept, amount, category, expense_type, description, expense_date, payment_method, receipt_number, supplier_id, status, notes, created_by, created_at")
      .eq("business_id", businessId)
      .order("expense_date", { ascending: false }),
    supabase
      .from("purchases")
      .select("id, business_id, purchase_number, supplier_id, invoice_number, purchase_date, subtotal, tax_amount, total, payment_type, payment_method, status, notes, created_by, created_at")
      .eq("business_id", businessId)
      .order("purchase_date", { ascending: false }),
    supabase
      .from("purchase_items")
      .select("id, purchase_id, business_id, product_id, item_name, quantity, unit_cost, total_cost")
      .eq("business_id", businessId),
    supabase
      .from("suppliers")
      .select("id, name, tax_id, contact_name, phone, email")
      .eq("business_id", businessId)
      .order("name", { ascending: true }),
    supabase
      .from("accounts_payable")
      .select("id, business_id, purchase_id, supplier_id, total_amount, paid_amount, balance, due_date, status")
      .eq("business_id", businessId),
    supabase
      .from("businesses")
      .select("id, name, commercial_name")
      .eq("id", businessId)
      .maybeSingle(),
  ]);

  const rawExpenses = expensesRes.data || [];
  const rawPurchases = purchasesRes.data || [];
  const rawPurchaseItems = purchaseItemsRes.data || [];
  const rawSuppliers = suppliersRes.data || [];
  const rawAP = apRes.data || [];
  const businessName =
    businessRes.data?.commercial_name || businessRes.data?.name || "Comercio NEGOVA";

  // Mapeos auxiliares
  const suppliersMap = new Map<string, { id: string; name: string; taxId?: string | null }>();
  for (const s of rawSuppliers) {
    suppliersMap.set(s.id, {
      id: s.id,
      name: s.name,
      taxId: s.tax_id || null,
    });
  }

  // Mapeo de items por compra
  const itemsByPurchaseMap = new Map<string, PurchaseReportItemDetail[]>();
  for (const item of rawPurchaseItems) {
    if (!item.purchase_id) continue;
    const existing = itemsByPurchaseMap.get(item.purchase_id) || [];
    existing.push({
      id: item.id,
      productName: item.item_name || "Insumo / Producto",
      quantity: Number(item.quantity || 1),
      unitCost: Number(item.unit_cost || 0),
      totalCost: Number(item.total_cost || 0),
    });
    itemsByPurchaseMap.set(item.purchase_id, existing);
  }

  // -------------------------------------------------------------
  // A. PROCESAMIENTO DE GASTOS OPERATIVOS Y DE PRODUCCIÓN
  // -------------------------------------------------------------
  const allExpenseRows: ExpenseReportRow[] = [];
  const distinctCategoriesSet = new Set<string>();

  for (const exp of rawExpenses) {
    const expDateRaw = exp.expense_date || exp.created_at;
    const expDateStr = getLocalDateString(expDateRaw, businessTimezone);
    const dateObj = new Date(expDateRaw);

    let formattedDate = expDateStr;
    try {
      formattedDate = dateObj.toLocaleString("es-CO", {
        timeZone: businessTimezone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      formattedDate = expDateStr;
    }

    const supplier = exp.supplier_id ? suppliersMap.get(exp.supplier_id) : null;
    const categoryName = exp.category || "Otros Operativos";
    distinctCategoriesSet.add(categoryName);

    const isCancelled = exp.status === "cancelled";
    const status: "completed" | "cancelled" = isCancelled ? "cancelled" : "completed";
    const statusLabel = isCancelled ? "Anulado" : "Completado";

    allExpenseRows.push({
      id: exp.id,
      expenseDate: expDateRaw,
      formattedDate,
      category: categoryName,
      concept: exp.concept || "Gasto operativo",
      description: exp.description || exp.notes || null,
      amount: Number(exp.amount || 0),
      paymentMethod: exp.payment_method || "efectivo",
      paymentMethodLabel: formatPaymentMethodLabel(exp.payment_method),
      supplierId: exp.supplier_id || null,
      supplierName: supplier?.name || "Sin proveedor asignado",
      receiptNumber: exp.receipt_number || null,
      expenseType: exp.expense_type === "production" ? "production" : "operational",
      status,
      statusLabel,
    });
  }

  // Filtrado de gastos para el período seleccionado
  const filteredExpenseRows = allExpenseRows.filter((row) => {
    const rowDateStr = getLocalDateString(row.expenseDate, businessTimezone);

    // Filtro por fecha
    if (effectiveStartDate && rowDateStr < effectiveStartDate) return false;
    if (effectiveEndDate && rowDateStr > effectiveEndDate) return false;

    // Filtro por categoría
    if (filterParams.category && filterParams.category !== "all") {
      if (row.category.toLowerCase() !== filterParams.category.toLowerCase()) return false;
    }

    // Filtro por proveedor
    if (filterParams.supplierId && filterParams.supplierId !== "all") {
      if (row.supplierId !== filterParams.supplierId) return false;
    }

    // Filtro por estado
    if (filterParams.status && filterParams.status !== "all") {
      if (row.status !== filterParams.status) return false;
    }

    // Filtro de búsqueda libre
    if (filterParams.search && filterParams.search.trim()) {
      const q = filterParams.search.toLowerCase().trim();
      const matchConcept = row.concept.toLowerCase().includes(q);
      const matchDesc = row.description?.toLowerCase().includes(q);
      const matchCat = row.category.toLowerCase().includes(q);
      const matchSupplier = row.supplierName.toLowerCase().includes(q);
      const matchReceipt = row.receiptNumber?.toLowerCase().includes(q);
      if (!matchConcept && !matchDesc && !matchCat && !matchSupplier && !matchReceipt) {
        return false;
      }
    }

    return true;
  });

  // Gastos completados/activos del período para métricas financieras (excluye anulados)
  const activeExpenseRows = filteredExpenseRows.filter((r) => r.status === "completed");
  const totalExpenses = activeExpenseRows.reduce((sum, r) => sum + r.amount, 0);

  // Días del período para el promedio diario
  let daysCount = 1;
  try {
    const s = new Date(effectiveStartDate);
    const e = new Date(effectiveEndDate);
    const diffMs = Math.abs(e.getTime() - s.getTime());
    daysCount = Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)) + 1);
  } catch {
    daysCount = 1;
  }
  const dailyAverage = totalExpenses > 0 ? Math.round(totalExpenses / daysCount) : 0;

  // Distribución por categoría con suma estricta del 100%
  const categoryTotalsMap = new Map<string, { amount: number; count: number }>();
  for (const row of activeExpenseRows) {
    const curr = categoryTotalsMap.get(row.category) || { amount: 0, count: 0 };
    curr.amount += row.amount;
    curr.count += 1;
    categoryTotalsMap.set(row.category, curr);
  }

  const categoryDistribution: ExpenseCategoryDistribution[] = [];
  let colorIdx = 0;
  let runningPctSum = 0;

  const sortedCategories = Array.from(categoryTotalsMap.entries()).sort(
    (a, b) => b[1].amount - a[1].amount
  );

  for (let i = 0; i < sortedCategories.length; i++) {
    const [catName, stats] = sortedCategories[i];
    const isLast = i === sortedCategories.length - 1;

    let pct = 0;
    if (totalExpenses > 0) {
      if (isLast) {
        // La última categoría absorbe los residuos de redondeo para garantizar exactamente 100.0%
        pct = Math.round((100 - runningPctSum) * 10) / 10;
      } else {
        pct = Math.round((stats.amount / totalExpenses) * 1000) / 10;
        runningPctSum += pct;
      }
    }

    categoryDistribution.push({
      category: catName,
      amount: stats.amount,
      percentage: Math.max(0, pct),
      count: stats.count,
      color: EXPENSE_CATEGORY_PALETTE[colorIdx % EXPENSE_CATEGORY_PALETTE.length],
    });
    colorIdx++;
  }

  // Categoría principal
  const mainCategory =
    categoryDistribution.length > 0 && totalExpenses > 0
      ? {
          category: categoryDistribution[0].category,
          amount: categoryDistribution[0].amount,
          percentage: categoryDistribution[0].percentage,
        }
      : null;

  // Gráfico de barras: últimos 6 meses cronológicos
  const last6MonthsMonthly: ExpenseMonthlyBarItem[] = [];
  const monthNamesEs = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mYear = d.getFullYear();
    const mMonth = d.getMonth() + 1;
    const monthKey = `${mYear}-${String(mMonth).padStart(2, "0")}`;
    const label = `${monthNamesEs[mMonth - 1]} ${mYear}`;

    // Filtrar todos los gastos completados que coincidan con este mes
    const monthExpenses = allExpenseRows.filter((r) => {
      if (r.status === "cancelled") return false;
      const dStr = getLocalDateString(r.expenseDate, businessTimezone);
      return dStr.startsWith(monthKey);
    });

    const mTotal = monthExpenses.reduce((sum, r) => sum + r.amount, 0);

    last6MonthsMonthly.push({
      monthKey,
      label,
      totalAmount: mTotal,
      expensesCount: monthExpenses.length,
    });
  }

  const expensesSummary: ExpenseReportSummary = {
    totalExpenses,
    dailyAverage,
    mainCategory,
    transactionsCount: filteredExpenseRows.length,
  };

  // -------------------------------------------------------------
  // B. PROCESAMIENTO DE COMPRAS Y CUENTAS POR PAGAR
  // -------------------------------------------------------------
  const allPurchaseRows: PurchaseReportRow[] = [];

  for (const pur of rawPurchases) {
    const purDateRaw = pur.purchase_date || pur.created_at;
    const purDateStr = getLocalDateString(purDateRaw, businessTimezone);
    const dateObj = new Date(purDateRaw);

    let formattedDate = purDateStr;
    try {
      formattedDate = dateObj.toLocaleString("es-CO", {
        timeZone: businessTimezone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      formattedDate = purDateStr;
    }

    const supplier = pur.supplier_id ? suppliersMap.get(pur.supplier_id) : null;
    const items = itemsByPurchaseMap.get(pur.id) || [];

    const itemsSummary =
      items.length > 0
        ? items
            .map((it) => `${it.productName} (${it.quantity})`)
            .join(" • ")
        : "Sin productos detallados";

    const isConfirmed = pur.status === "confirmed" || pur.status === "completed";
    const status: "confirmed" | "cancelled" = isConfirmed ? "confirmed" : "cancelled";
    const statusLabel = isConfirmed ? "Confirmada" : "Anulada";

    allPurchaseRows.push({
      id: pur.id,
      purchaseNumber: pur.purchase_number || "COMP-S/N",
      invoiceNumber: pur.invoice_number || null,
      purchaseDate: purDateRaw,
      formattedDate,
      supplierId: pur.supplier_id || null,
      supplierName: supplier?.name || "Proveedor no registrado",
      supplierTaxId: supplier?.taxId || null,
      subtotal: Number(pur.subtotal || 0),
      taxAmount: Number(pur.tax_amount || 0),
      total: Number(pur.total || 0),
      paymentType: pur.payment_type === "credit" ? "credit" : "cash",
      paymentMethod: pur.payment_method || "cash",
      status,
      statusLabel,
      items,
      itemsSummary,
      itemsCount: items.length,
    });
  }

  // Filtrado de compras
  const filteredPurchaseRows = allPurchaseRows.filter((row) => {
    const rowDateStr = getLocalDateString(row.purchaseDate, businessTimezone);

    // Filtro por fecha
    if (effectiveStartDate && rowDateStr < effectiveStartDate) return false;
    if (effectiveEndDate && rowDateStr > effectiveEndDate) return false;

    // Filtro por proveedor
    if (filterParams.supplierId && filterParams.supplierId !== "all") {
      if (row.supplierId !== filterParams.supplierId) return false;
    }

    // Filtro por estado
    if (filterParams.status && filterParams.status !== "all") {
      if (row.status !== filterParams.status) return false;
    }

    // Filtro de búsqueda libre
    if (filterParams.search && filterParams.search.trim()) {
      const q = filterParams.search.toLowerCase().trim();
      const matchNum = row.purchaseNumber.toLowerCase().includes(q);
      const matchInv = row.invoiceNumber?.toLowerCase().includes(q);
      const matchSupplier = row.supplierName.toLowerCase().includes(q);
      const matchItems = row.itemsSummary.toLowerCase().includes(q);
      if (!matchNum && !matchInv && !matchSupplier && !matchItems) {
        return false;
      }
    }

    return true;
  });

  // Compras confirmadas para totales (Criterio 2)
  const confirmedPurchaseRows = filteredPurchaseRows.filter((r) => r.status === "confirmed");
  const totalPurchases = confirmedPurchaseRows.reduce((sum, r) => sum + r.total, 0);

  // Cuentas por pagar pendientes
  const pendingAPList = rawAP.filter(
    (ap) =>
      ap.status === "pending" ||
      ap.status === "partially_paid" ||
      ap.status === "overdue"
  );
  const pendingAccountsPayableAmount = pendingAPList.reduce(
    (sum, ap) => sum + Number(ap.balance || 0),
    0
  );

  // Top 5 proveedores por monto de compras confirmadas
  const supplierPurchaseTotalsMap = new Map<
    string,
    { supplierName: string; taxId: string | null; totalAmount: number; count: number }
  >();

  for (const pur of confirmedPurchaseRows) {
    const key = pur.supplierId || pur.supplierName;
    const curr = supplierPurchaseTotalsMap.get(key) || {
      supplierName: pur.supplierName,
      taxId: pur.supplierTaxId,
      totalAmount: 0,
      count: 0,
    };
    curr.totalAmount += pur.total;
    curr.count += 1;
    supplierPurchaseTotalsMap.set(key, curr);
  }

  const topSuppliers: TopSupplierPurchaseItem[] = Array.from(
    supplierPurchaseTotalsMap.entries()
  )
    .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
    .slice(0, 5)
    .map(([supplierKey, s]) => ({
      supplierId: supplierKey.startsWith("COMP-") || supplierKey.length < 10 ? null : supplierKey,
      supplierName: s.supplierName,
      taxId: s.taxId,
      totalAmount: s.totalAmount,
      purchasesCount: s.count,
      percentage:
        totalPurchases > 0
          ? Math.round((s.totalAmount / totalPurchases) * 1000) / 10
          : 0,
    }));

  const purchasesSummary: PurchaseReportSummary = {
    totalPurchases,
    confirmedPurchasesCount: confirmedPurchaseRows.length,
    pendingAccountsPayableAmount,
    pendingAccountsPayableCount: pendingAPList.length,
  };

  // Listados para selectores de filtros
  const availableCategories = [
    "all",
    ...Array.from(distinctCategoriesSet).sort((a, b) => a.localeCompare(b)),
  ];

  const availableSuppliers = [
    { id: "all", name: "Todos los proveedores" },
    ...rawSuppliers.map((s) => ({ id: s.id, name: s.name, taxId: s.tax_id })),
  ];

  const dateRange: ReportsDateRange = {
    preset: effectivePreset,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
  };

  return {
    expenses: {
      rows: filteredExpenseRows,
      summary: expensesSummary,
      categoryDistribution,
      last6MonthsMonthly,
    },
    purchases: {
      rows: filteredPurchaseRows,
      summary: purchasesSummary,
      topSuppliers,
    },
    filterParams,
    dateRange,
    availableCategories,
    availableSuppliers,
    businessName,
  };
}



/**
 * Consulta y consolida las métricas de domicilios, tiempos de entrega,
 * desempeño por repartidor y análisis por zona geográfica [REP-007].
 *
 * Criterios de Aceptación:
 * 1. Los conteos de entregas coinciden con los registros de delivery_orders / restaurant_orders.
 * 2. El tiempo promedio se calcula correctamente en minutos (aceptación/creación -> entrega).
 * 3. Los repartidores se ordenan por entregas completadas descendente.
 * 4. El reporte funciona aunque no haya zonas configuradas (DOM-001 opcional).
 */
export async function getDeliveryReportData(
  businessId: string,
  filterParams: DeliveryReportFilterParams = {},
  businessTimezone: string = "America/Bogota"
): Promise<DeliveryReportData> {
  const supabase = await getDbClient();

  const now = new Date();
  const todayStr = getLocalDateString(now, businessTimezone);

  // Ayer
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterday, businessTimezone);

  // Inicio de mes
  const [currentYear, currentMonth] = todayStr.split("-");
  const monthStartStr = `${currentYear}-${currentMonth}-01`;

  // 7 días atrás
  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo, businessTimezone);

  // Resolver rango de fechas según preset
  const effectivePreset = filterParams.preset || "this_month";
  let effectiveStartDate = monthStartStr;
  let effectiveEndDate = todayStr;

  if (effectivePreset === "today") {
    effectiveStartDate = todayStr;
    effectiveEndDate = todayStr;
  } else if (effectivePreset === "yesterday") {
    effectiveStartDate = yesterdayStr;
    effectiveEndDate = yesterdayStr;
  } else if (effectivePreset === "last_7_days") {
    effectiveStartDate = sevenDaysAgoStr;
    effectiveEndDate = todayStr;
  } else if (effectivePreset === "this_month") {
    effectiveStartDate = monthStartStr;
    effectiveEndDate = todayStr;
  } else if (effectivePreset === "custom") {
    effectiveStartDate = filterParams.startDate || monthStartStr;
    effectiveEndDate = filterParams.endDate || todayStr;
  }

  // 1. Consultar negocio para obtener nombre y configuración de repartidores
  let businessName = "Mi Negocio";
  let operationalDriversList: Array<{ name: string; phone?: string | null }> = [];

  try {
    const { data: bizData } = await supabase
      .from("businesses")
      .select("name, settings")
      .eq("id", businessId)
      .maybeSingle();

    if (bizData?.name) {
      businessName = bizData.name;
    }
    if (bizData && (bizData.settings as any)?.delivery_drivers) {
      operationalDriversList = ((bizData.settings as any).delivery_drivers || []).map((d: any) => ({
        name: d.name,
        phone: d.phone || null,
      }));
    }
  } catch (err) {
    console.warn("[getDeliveryReportData] No se pudo consultar configuración del negocio:", err);
  }

  // 2. Consultar zonas de entrega (DOM-001) con fallback seguro
  let rawZones: Array<{
    id: string;
    name: string;
    tariff: number;
    color?: string;
  }> = [];

  try {
    const { data: zonesData, error: zonesErr } = await supabase
      .from("delivery_zones")
      .select("id, name, tariff, color, status")
      .eq("business_id", businessId);

    if (!zonesErr && Array.isArray(zonesData)) {
      rawZones = zonesData.map((z: any) => ({
        id: z.id,
        name: z.name,
        tariff: Number(z.tariff || 0),
        color: z.color || "#ED500A",
      }));
    }
  } catch {
    // Si la tabla no existe o DOM-001 no ha sido migrado, continúa sin zonas
    rawZones = [];
  }

  const zonesMap = new Map<string, { id: string; name: string; tariff: number; color?: string }>();
  rawZones.forEach((z) => zonesMap.set(z.id, z));

  // 3. Consultar pedidos a domicilio de restaurant_orders
  let rawOrders: any[] = [];
  try {
    const { data: ordersData, error: ordersErr } = await supabase
      .from("restaurant_orders")
      .select(`
        id,
        order_number,
        order_type,
        customer_name,
        customer_phone,
        delivery_address,
        delivery_zone_id,
        driver_name,
        delivery_status,
        status,
        total,
        subtotal,
        metadata,
        created_at,
        updated_at,
        delivered_at
      `)
      .eq("business_id", businessId)
      .or("order_type.eq.delivery,delivery_status.not.is.null")
      .order("created_at", { ascending: false });

    if (!ordersErr && Array.isArray(ordersData)) {
      rawOrders = ordersData;
    }
  } catch (err) {
    console.warn("[getDeliveryReportData] Error al consultar pedidos de entrega:", err);
  }

  // Conjuntos para filtros disponibles
  const availableDriversSet = new Set<string>();
  operationalDriversList.forEach((d) => availableDriversSet.add(d.name));

  const availableZonesList: Array<{ id: string; name: string }> = [
    { id: "all", name: "Todas las zonas" },
    ...rawZones.map((z) => ({ id: z.id, name: z.name })),
  ];

  // 4. Procesar y filtrar cada orden
  const filteredOrders: DeliveryReportOrderItem[] = [];

  for (const o of rawOrders) {
    const orderCreatedAt = o.created_at ? new Date(o.created_at) : new Date();
    const orderDateStr = getLocalDateString(orderCreatedAt, businessTimezone);

    // Filtro por fecha
    if (orderDateStr < effectiveStartDate || orderDateStr > effectiveEndDate) {
      continue;
    }

    const driverName = (o.driver_name || (o.metadata as any)?.driver_name || "").trim() || "Sin Asignar";
    if (driverName !== "Sin Asignar") {
      availableDriversSet.add(driverName);
    }

    // Filtro por repartidor
    if (filterParams.driverName && filterParams.driverName !== "all") {
      if (driverName.toLowerCase() !== filterParams.driverName.toLowerCase()) {
        continue;
      }
    }

    // Zona de entrega
    const zoneId = o.delivery_zone_id || (o.metadata as any)?.delivery_zone_id || null;
    const zoneInfo = zoneId ? zonesMap.get(zoneId) : null;
    const zoneName = zoneInfo?.name || (o.metadata as any)?.delivery_zone_name || (zoneId ? "Zona personalizada" : "Sin Zona Asignada");

    // Filtro por zona
    if (filterParams.zoneId && filterParams.zoneId !== "all") {
      if (zoneId !== filterParams.zoneId && zoneName !== filterParams.zoneId) {
        continue;
      }
    }

    // Normalizar estado
    const rawDeliveryStatus = (o.delivery_status || o.status || "pending").toLowerCase();
    let statusCategory = "pending";
    let statusLabel = "Pendiente";

    if (rawDeliveryStatus === "delivered" || rawDeliveryStatus === "entregado" || o.status === "delivered") {
      statusCategory = "delivered";
      statusLabel = "Entregado";
    } else if (rawDeliveryStatus === "delivering" || rawDeliveryStatus === "on_route" || rawDeliveryStatus === "en_camino") {
      statusCategory = "delivering";
      statusLabel = "En Camino";
    } else if (rawDeliveryStatus === "cancelled" || rawDeliveryStatus === "cancelado" || o.status === "cancelled") {
      statusCategory = "cancelled";
      statusLabel = "Cancelado";
    } else if (rawDeliveryStatus === "rejected" || rawDeliveryStatus === "rechazado" || rawDeliveryStatus === "failed") {
      statusCategory = "rejected";
      statusLabel = "Rechazado";
    } else if (rawDeliveryStatus === "assigned" || rawDeliveryStatus === "asignado") {
      statusCategory = "assigned";
      statusLabel = "Asignado";
    }

    // Filtro por estado
    if (filterParams.status && filterParams.status !== "all") {
      if (statusCategory !== filterParams.status) {
        continue;
      }
    }

    // Filtro por búsqueda de texto
    if (filterParams.search && filterParams.search.trim()) {
      const q = filterParams.search.trim().toLowerCase();
      const numMatch = String(o.order_number || "").includes(q);
      const custMatch = (o.customer_name || "").toLowerCase().includes(q);
      const phoneMatch = (o.customer_phone || "").toLowerCase().includes(q);
      const addrMatch = (o.delivery_address || "").toLowerCase().includes(q);
      const driverMatch = driverName.toLowerCase().includes(q);
      const zoneMatch = zoneName.toLowerCase().includes(q);

      if (!numMatch && !custMatch && !phoneMatch && !addrMatch && !driverMatch && !zoneMatch) {
        continue;
      }
    }

    // Cálculo de duración en minutos
    let deliveryDurationMinutes = 0;
    const createdTimestamp = new Date(o.created_at).getTime();
    const deliveredTimestamp = o.delivered_at
      ? new Date(o.delivered_at).getTime()
      : statusCategory === "delivered" && o.updated_at
      ? new Date(o.updated_at).getTime()
      : null;

    if (deliveredTimestamp && deliveredTimestamp >= createdTimestamp) {
      deliveryDurationMinutes = Math.max(1, Math.round((deliveredTimestamp - createdTimestamp) / 60000));
    } else if ((o.metadata as any)?.delivery_duration_min) {
      deliveryDurationMinutes = Number((o.metadata as any).delivery_duration_min);
    } else if (zoneInfo?.tariff && zoneInfo?.tariff > 0) {
      deliveryDurationMinutes = 25; // fallback razonable
    }

    const deliveryFee = Number(
      (o.metadata as any)?.delivery_fee ??
      (o.metadata as any)?.delivery_tariff ??
      zoneInfo?.tariff ??
      0
    );

    const rating = (o.metadata as any)?.delivery_rating || (o.metadata as any)?.rating || null;

    filteredOrders.push({
      id: o.id,
      orderNumber: o.order_number || 0,
      customerName: o.customer_name || "Cliente General",
      customerPhone: o.customer_phone || null,
      deliveryAddress: o.delivery_address || "Dirección no especificada",
      zoneId,
      zoneName,
      driverName,
      status: statusCategory,
      statusLabel,
      subtotal: Number(o.subtotal || 0),
      deliveryFee,
      total: Number(o.total || 0),
      createdAt: o.created_at,
      formattedCreatedAt: `${orderDateStr} ${orderCreatedAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`,
      deliveredAt: o.delivered_at || null,
      formattedDeliveredAt: o.delivered_at
        ? new Date(o.delivered_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
        : null,
      deliveryDurationMinutes,
      rating: rating ? Number(rating) : null,
    });
  }

  // 5. Agrupación y métricas por Repartidor
  const driverGroupsMap = new Map<
    string,
    {
      driverName: string;
      driverPhone?: string | null;
      totalAssigned: number;
      completedDeliveries: number;
      cancelledDeliveries: number;
      rejectedDeliveries: number;
      durations: number[];
      ratings: number[];
      totalAmountCollected: number;
      totalTariffsCollected: number;
    }
  >();

  filteredOrders.forEach((o) => {
    const dName = o.driverName;
    if (!driverGroupsMap.has(dName)) {
      const foundPhone = operationalDriversList.find(
        (od) => od.name.toLowerCase() === dName.toLowerCase()
      )?.phone;

      driverGroupsMap.set(dName, {
        driverName: dName,
        driverPhone: foundPhone || null,
        totalAssigned: 0,
        completedDeliveries: 0,
        cancelledDeliveries: 0,
        rejectedDeliveries: 0,
        durations: [],
        ratings: [],
        totalAmountCollected: 0,
        totalTariffsCollected: 0,
      });
    }

    const item = driverGroupsMap.get(dName)!;
    item.totalAssigned += 1;
    item.totalAmountCollected += o.total;
    item.totalTariffsCollected += o.deliveryFee;

    if (o.status === "delivered") {
      item.completedDeliveries += 1;
      if (o.deliveryDurationMinutes > 0) {
        item.durations.push(o.deliveryDurationMinutes);
      }
    } else if (o.status === "cancelled") {
      item.cancelledDeliveries += 1;
    } else if (o.status === "rejected") {
      item.rejectedDeliveries += 1;
    }

    if (o.rating && o.rating > 0) {
      item.ratings.push(o.rating);
    }
  });

  const drivers: DeliveryDriverMetricItem[] = Array.from(driverGroupsMap.values()).map((g) => {
    const avgTime =
      g.durations.length > 0
        ? Math.round(g.durations.reduce((sum, d) => sum + d, 0) / g.durations.length)
        : 0;

    const avgRating =
      g.ratings.length > 0
        ? Number((g.ratings.reduce((sum, r) => sum + r, 0) / g.ratings.length).toFixed(1))
        : 5.0;

    const completionRate =
      g.totalAssigned > 0 ? Math.round((g.completedDeliveries / g.totalAssigned) * 100) : 0;

    return {
      driverName: g.driverName,
      driverPhone: g.driverPhone,
      totalAssigned: g.totalAssigned,
      completedDeliveries: g.completedDeliveries,
      cancelledDeliveries: g.cancelledDeliveries,
      rejectedDeliveries: g.rejectedDeliveries,
      averageDeliveryTimeMinutes: avgTime,
      completionRate,
      averageRating: avgRating,
      totalAmountCollected: g.totalAmountCollected,
      totalTariffsCollected: g.totalTariffsCollected,
    };
  });

  // CRITERIO DE ACEPTACIÓN ESTRICTO:
  // "Los repartidores se ordenan por entregas completadas descendente"
  drivers.sort((a, b) => {
    if (b.completedDeliveries !== a.completedDeliveries) {
      return b.completedDeliveries - a.completedDeliveries;
    }
    return b.totalAssigned - a.totalAssigned;
  });

  // 6. Agrupación y métricas por Zona Geográfica
  const zoneGroupsMap = new Map<
    string,
    {
      zoneId: string;
      zoneName: string;
      tariff: number;
      totalOrders: number;
      completedOrders: number;
      totalAmount: number;
      durations: number[];
      color?: string;
    }
  >();

  filteredOrders.forEach((o) => {
    const zKey = o.zoneId || o.zoneName;
    if (!zoneGroupsMap.has(zKey)) {
      const zInfo = o.zoneId ? zonesMap.get(o.zoneId) : null;
      zoneGroupsMap.set(zKey, {
        zoneId: o.zoneId || "unassigned",
        zoneName: o.zoneName,
        tariff: zInfo?.tariff || o.deliveryFee || 0,
        totalOrders: 0,
        completedOrders: 0,
        totalAmount: 0,
        durations: [],
        color: zInfo?.color || "#ED500A",
      });
    }

    const item = zoneGroupsMap.get(zKey)!;
    item.totalOrders += 1;
    item.totalAmount += o.total;

    if (o.status === "delivered") {
      item.completedOrders += 1;
      if (o.deliveryDurationMinutes > 0) {
        item.durations.push(o.deliveryDurationMinutes);
      }
    }
  });

  const zones: DeliveryZoneMetricItem[] = Array.from(zoneGroupsMap.values()).map((z) => {
    const avgTime =
      z.durations.length > 0
        ? Math.round(z.durations.reduce((sum, d) => sum + d, 0) / z.durations.length)
        : 0;

    return {
      zoneId: z.zoneId,
      zoneName: z.zoneName,
      tariff: z.tariff,
      totalOrders: z.totalOrders,
      completedOrders: z.completedOrders,
      totalAmount: z.totalAmount,
      averageDeliveryTimeMinutes: avgTime,
      color: z.color,
    };
  });

  zones.sort((a, b) => b.totalOrders - a.totalOrders);

  // 7. Consolidación de Totales y KPIs
  const totalDeliveries = filteredOrders.length;
  const successfulDeliveries = filteredOrders.filter((o) => o.status === "delivered").length;
  const cancelledDeliveries = filteredOrders.filter((o) => o.status === "cancelled").length;
  const rejectedDeliveries = filteredOrders.filter((o) => o.status === "rejected").length;
  const successRate = totalDeliveries > 0 ? Math.round((successfulDeliveries / totalDeliveries) * 100) : 0;

  const completedDurations = filteredOrders
    .filter((o) => o.status === "delivered" && o.deliveryDurationMinutes > 0)
    .map((o) => o.deliveryDurationMinutes);

  const averageDeliveryTimeMinutes =
    completedDurations.length > 0
      ? Math.round(completedDurations.reduce((sum, d) => sum + d, 0) / completedDurations.length)
      : 0;

  const totalRevenue = filteredOrders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + o.total, 0);

  const totalTariffs = filteredOrders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + o.deliveryFee, 0);

  const topDriver =
    drivers.length > 0 && drivers[0].completedDeliveries > 0
      ? {
          driverName: drivers[0].driverName,
          completedCount: drivers[0].completedDeliveries,
        }
      : null;

  const topZone =
    zones.length > 0 && zones[0].totalOrders > 0
      ? {
          zoneName: zones[0].zoneName,
          ordersCount: zones[0].totalOrders,
        }
      : null;

  const summary: DeliveryReportSummary = {
    totalDeliveries,
    successfulDeliveries,
    cancelledDeliveries,
    rejectedDeliveries,
    successRate,
    averageDeliveryTimeMinutes,
    totalRevenue,
    totalTariffs,
    topDriver,
    topZone,
  };

  const availableDrivers = ["all", ...Array.from(availableDriversSet).sort((a, b) => a.localeCompare(b))];

  const dateRange: ReportsDateRange = {
    preset: effectivePreset,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
  };

  return {
    summary,
    drivers,
    zones,
    orders: filteredOrders,
    filterParams,
    dateRange,
    availableDrivers,
    availableZones: availableZonesList,
    businessName,
  };
}



/**
 * =============================================================================
 * [REP-006] Análisis de Horas Pico y Mapa de Calor (Heatmap)
 * =============================================================================
 */

const PEAK_HOURS_DAYS_CONFIG = [
  { index: 0, name: "Lunes", short: "Lun" },
  { index: 1, name: "Martes", short: "Mar" },
  { index: 2, name: "Miércoles", short: "Mié" },
  { index: 3, name: "Jueves", short: "Jue" },
  { index: 4, name: "Viernes", short: "Vie" },
  { index: 5, name: "Sábado", short: "Sáb" },
  { index: 6, name: "Domingo", short: "Dom" },
];

const PEAK_HOURS_CONFIG = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6; // 6:00 a 23:00 (18 horas)
  let label = "";
  if (h === 12) label = "12 PM";
  else if (h > 12) label = `${h - 12} PM`;
  else label = `${h} AM`;
  return { hour: h, label };
});

export async function getPeakHoursReportData(
  businessId: string,
  filterParams: PeakHoursFilterParams = {},
  businessTimezone: string = "America/Bogota"
): Promise<PeakHoursReportData> {
  const supabase = await getDbClient();

  const now = new Date();
  const todayStr = getLocalDateString(now, businessTimezone);

  // Determinar rango de fechas
  const effectivePreset = filterParams.preset || "last_30_days";
  let effectiveStartDate = "";
  let effectiveEndDate = todayStr;

  switch (effectivePreset) {
    case "today":
      effectiveStartDate = todayStr;
      effectiveEndDate = todayStr;
      break;
    case "yesterday": {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      effectiveStartDate = getLocalDateString(y, businessTimezone);
      effectiveEndDate = effectiveStartDate;
      break;
    }
    case "last_7_days": {
      const d7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      effectiveStartDate = getLocalDateString(d7, businessTimezone);
      break;
    }
    case "this_month": {
      const [curYear, curMonth] = todayStr.split("-");
      effectiveStartDate = `${curYear}-${curMonth}-01`;
      break;
    }
    case "last_90_days": {
      const d90 = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
      effectiveStartDate = getLocalDateString(d90, businessTimezone);
      break;
    }
    case "custom": {
      effectiveStartDate = filterParams.startDate || todayStr;
      effectiveEndDate = filterParams.endDate || todayStr;
      break;
    }
    case "last_30_days":
    default: {
      const d30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      effectiveStartDate = getLocalDateString(d30, businessTimezone);
      break;
    }
  }

  // 1. Consultas concurrentes en paralelo
  const [docsRes, ordersRes, businessRes] = await Promise.all([
    supabase
      .from("business_sale_documents")
      .select("id, restaurant_order_id, document_number, total, subtotal, issued_at, status, created_at")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .neq("status", "annulled")
      .order("issued_at", { ascending: false }),
    supabase
      .from("restaurant_orders")
      .select("id, order_type, channel_origin")
      .eq("business_id", businessId),
    supabase
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .maybeSingle(),
  ]);

  const rawDocs = docsRes.data || [];
  const rawOrders = ordersRes.data || [];
  const businessName = businessRes.data?.name || "Comercio";

  // Mapeo de pedidos para resolución instantánea de canal
  const ordersMap = new Map<string, { order_type?: string; channel_origin?: string }>();
  for (const ord of rawOrders) {
    ordersMap.set(ord.id, {
      order_type: ord.order_type,
      channel_origin: ord.channel_origin,
    });
  }

  const resolveChannel = (row: any): SalesChannelType => {
    if (row.restaurant_order_id && ordersMap.has(row.restaurant_order_id)) {
      const ord = ordersMap.get(row.restaurant_order_id)!;
      if (ord.channel_origin === "digital_menu") return "digital_menu";
      if (ord.order_type === "delivery" || ord.channel_origin === "whatsapp") return "domicilio";
      if (ord.order_type === "dine_in") return "mesa";
      return "mostrador";
    }
    return "mostrador";
  };

  // 2. Inicializar matriz de 7 días x 18 horas (126 celdas)
  const heatmapMatrix: HeatmapCell[][] = PEAK_HOURS_DAYS_CONFIG.map((day) =>
    PEAK_HOURS_CONFIG.map((h) => ({
      dayIndex: day.index,
      dayName: day.name,
      dayShort: day.short,
      hour: h.hour,
      hourLabel: h.label,
      salesCount: 0,
      totalAmount: 0,
      averageTicket: 0,
      countIntensity: 0,
      amountIntensity: 0,
    }))
  );

  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  const selectedChannel = filterParams.channel || "all";

  // 3. Filtrar y agregar cada venta en la matriz correspondiente
  for (const doc of rawDocs) {
    const rawDate = doc.issued_at || doc.created_at;
    if (!rawDate) continue;

    const docDateStr = getLocalDateString(rawDate, businessTimezone);
    if (docDateStr < effectiveStartDate || docDateStr > effectiveEndDate) {
      continue;
    }

    const channel = resolveChannel(doc);
    if (selectedChannel !== "all" && channel !== selectedChannel) {
      continue;
    }

    const docDate = new Date(rawDate);
    const weekdayShort = new Intl.DateTimeFormat("en-US", {
      timeZone: businessTimezone,
      weekday: "short",
    }).format(docDate);

    const dayIndex = weekdayMap[weekdayShort];
    if (dayIndex === undefined) continue;

    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: businessTimezone,
      hourCycle: "h23",
      hour: "numeric",
    }).format(docDate);
    const hour = Number(hourStr) % 24;

    // Horas cubiertas: 6 AM a 11 PM (23:00)
    if (hour >= 6 && hour <= 23) {
      const hourIndex = hour - 6;
      const cell = heatmapMatrix[dayIndex][hourIndex];
      cell.salesCount += 1;
      cell.totalAmount += Number(doc.total || 0);
    }
  }

  // 4. Calcular intensidades y métricas agregadas
  const cellsFlat = heatmapMatrix.flat();
  let maxSalesCount = 0;
  let maxTotalAmount = 0;

  for (const cell of cellsFlat) {
    if (cell.salesCount > 0) {
      cell.averageTicket = Math.round(cell.totalAmount / cell.salesCount);
    }
    if (cell.salesCount > maxSalesCount) {
      maxSalesCount = cell.salesCount;
    }
    if (cell.totalAmount > maxTotalAmount) {
      maxTotalAmount = cell.totalAmount;
    }
  }

  for (const cell of cellsFlat) {
    cell.countIntensity = maxSalesCount > 0 ? Number((cell.salesCount / maxSalesCount).toFixed(4)) : 0;
    cell.amountIntensity = maxTotalAmount > 0 ? Number((cell.totalAmount / maxTotalAmount).toFixed(4)) : 0;
  }

  // 5. Calcular resúmenes por día de la semana
  const daySummaries: DayPeakHourSummary[] = heatmapMatrix.map((dayRow, dayIdx) => {
    const dayConfig = PEAK_HOURS_DAYS_CONFIG[dayIdx];
    let totalDaySalesCount = 0;
    let totalDayAmount = 0;
    let peakCell: HeatmapCell = dayRow[0];

    for (const cell of dayRow) {
      totalDaySalesCount += cell.salesCount;
      totalDayAmount += cell.totalAmount;

      if (
        cell.salesCount > peakCell.salesCount ||
        (cell.salesCount === peakCell.salesCount && cell.totalAmount > peakCell.totalAmount)
      ) {
        peakCell = cell;
      }
    }

    return {
      dayIndex: dayConfig.index,
      dayName: dayConfig.name,
      dayShort: dayConfig.short,
      peakHour: peakCell.hour,
      peakHourLabel: peakCell.hourLabel,
      peakSalesCount: peakCell.salesCount,
      peakTotalAmount: peakCell.totalAmount,
      totalDaySalesCount,
      totalDayAmount,
    };
  });

  // 6. Resumen Global
  let globalPeakCell: HeatmapCell = cellsFlat[0];
  let totalPeriodSalesCount = 0;
  let totalPeriodAmount = 0;

  for (const cell of cellsFlat) {
    totalPeriodSalesCount += cell.salesCount;
    totalPeriodAmount += cell.totalAmount;

    if (
      cell.salesCount > globalPeakCell.salesCount ||
      (cell.salesCount === globalPeakCell.salesCount && cell.totalAmount > globalPeakCell.totalAmount)
    ) {
      globalPeakCell = cell;
    }
  }

  let busiestDay = daySummaries[0];
  for (const daySum of daySummaries) {
    if (
      daySum.totalDaySalesCount > busiestDay.totalDaySalesCount ||
      (daySum.totalDaySalesCount === busiestDay.totalDaySalesCount && daySum.totalDayAmount > busiestDay.totalDayAmount)
    ) {
      busiestDay = daySum;
    }
  }

  const hasData = totalPeriodSalesCount > 0;
  const totalActiveSlots = 7 * 18; // 126
  const averageHourlySalesCount = hasData ? Number((totalPeriodSalesCount / totalActiveSlots).toFixed(1)) : 0;
  const averageHourlyAmount = hasData ? Math.round(totalPeriodAmount / totalActiveSlots) : 0;

  const globalSummary: PeakHoursGlobalSummary = {
    globalPeakHour: globalPeakCell.hour,
    globalPeakHourLabel: globalPeakCell.hourLabel,
    globalPeakDayIndex: globalPeakCell.dayIndex,
    globalPeakDayName: globalPeakCell.dayName,
    globalPeakSalesCount: globalPeakCell.salesCount,
    globalPeakAmount: globalPeakCell.totalAmount,
    busiestDayOfWeek: busiestDay.dayName,
    busiestDayIndex: busiestDay.dayIndex,
    busiestDaySalesCount: busiestDay.totalDaySalesCount,
    busiestDayAmount: busiestDay.totalDayAmount,
    totalPeriodSalesCount,
    totalPeriodAmount,
    averageHourlySalesCount,
    averageHourlyAmount,
    hasData,
  };

  return {
    heatmapMatrix,
    cellsFlat,
    daySummaries,
    globalSummary,
    filterParams: {
      ...filterParams,
      preset: effectivePreset,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      channel: selectedChannel,
    },
    businessName,
  };
}



// ==========================================
// [REP-008] REPORTE DE RECETAS, ESCANDALLOS Y COSTOS
// ==========================================

export async function getRecipeReportData(
  businessId: string,
  filterParams: RecipeReportFilterParams = {},
  businessTimezone: string = "America/Bogota"
): Promise<RecipeReportData> {
  const supabase = await getDbClient();

  // 1. Fechas y Rango del Período
  const now = new Date();
  const todayStr = getLocalDateString(now, businessTimezone);

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterday, businessTimezone);

  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo, businessTimezone);

  const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoStr = getLocalDateString(thirtyDaysAgo, businessTimezone);

  const [currentYear, currentMonth] = todayStr.split("-");
  const monthStartStr = `${currentYear}-${currentMonth}-01`;

  const effectivePreset = filterParams.preset || "this_month";
  let effectiveStartDate = monthStartStr;
  let effectiveEndDate = todayStr;

  if (effectivePreset === "today") {
    effectiveStartDate = todayStr;
    effectiveEndDate = todayStr;
  } else if (effectivePreset === "yesterday") {
    effectiveStartDate = yesterdayStr;
    effectiveEndDate = yesterdayStr;
  } else if (effectivePreset === "last_7_days") {
    effectiveStartDate = sevenDaysAgoStr;
    effectiveEndDate = todayStr;
  } else if (effectivePreset === "last_30_days") {
    effectiveStartDate = thirtyDaysAgoStr;
    effectiveEndDate = todayStr;
  } else if (effectivePreset === "this_month") {
    effectiveStartDate = monthStartStr;
    effectiveEndDate = todayStr;
  } else if (effectivePreset === "custom") {
    effectiveStartDate = filterParams.startDate || monthStartStr;
    effectiveEndDate = filterParams.endDate || todayStr;
  }

  // Calcular cantidad de días del período analizado
  const startD = new Date(effectiveStartDate);
  const endD = new Date(effectiveEndDate);
  const diffTime = Math.max(0, endD.getTime() - startD.getTime());
  const daysCount = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

  // 2. Consultar Negocio (Nombre y Moneda)
  let businessName = "Mi Negocio";
  let currency = "COP";

  try {
    const { data: bizData } = await supabase
      .from("businesses")
      .select("name, currency")
      .eq("id", businessId)
      .maybeSingle();

    if (bizData?.name) businessName = bizData.name;
    if (bizData?.currency) currency = bizData.currency;
  } catch (bizErr) {
    console.warn("[getRecipeReportData] Error al consultar datos del comercio:", bizErr);
  }

  // 3. Consultar Recetas e Ingredientes del Comercio (con sus escandallos completos)
  const { getRecipes, getIngredients } = await import("@/lib/recipes/recipe-service");
  const [recipesWithDetails, allIngredients, categoriesRes] = await Promise.all([
    getRecipes(businessId, { status: "active" }).catch(() => []),
    getIngredients(businessId).catch(() => []),
    supabase.from("categories").select("id, name").eq("business_id", businessId).order("name"),
  ]);

  const categories = (categoriesRes.data || []) as Array<{ id: string; name: string }>;
  const categoryMap = new Map<string, string>();
  categories.forEach((c) => categoryMap.set(c.id, c.name));

  // Mapa de productos para enriquecer con categoría
  const productIds = recipesWithDetails.map((r) => r.productId);
  const productCategoryMap = new Map<string, { categoryId: string | null; categoryName: string }>();

  if (productIds.length > 0) {
    try {
      const { data: prodsData } = await supabase
        .from("products")
        .select("id, category_id")
        .in("id", productIds);

      (prodsData || []).forEach((p: any) => {
        const catName = p.category_id ? categoryMap.get(p.category_id) || "Sin categoría" : "Sin categoría";
        productCategoryMap.set(p.id, {
          categoryId: p.category_id || null,
          categoryName: catName,
        });
      });
    } catch (pErr) {
      console.warn("[getRecipeReportData] Error al consultar categorías de productos:", pErr);
    }
  }

  // 4. Calcular Costos por Producto (Escandallos y Márgenes) [Criterios 1, 2 y 3]
  const productCosts: RecipeProductCostItem[] = [];

  for (const recipe of recipesWithDetails) {
    const catInfo = productCategoryMap.get(recipe.productId) || {
      categoryId: null,
      categoryName: "Sin categoría",
    };

    // Filtro por categoría si se especificó
    if (filterParams.categoryId && filterParams.categoryId !== "all") {
      if (catInfo.categoryId !== filterParams.categoryId) {
        continue;
      }
    }

    const portions = Math.max(1, Number(recipe.portions || 1));

    // Criterio 1: Suma de (cantidad_ingrediente × costo_ingrediente) para cada producto
    let totalRecipeCost = 0;
    const ingredients = recipe.ingredients || [];
    for (const ing of ingredients) {
      const ingCost = Number(ing.unitCost || 0);
      const ingQty = Number(ing.quantity || 0);
      totalRecipeCost += ingQty * ingCost;
    }

    // Costo unitario de la receta por porción/producto
    const recipeCost = Number((totalRecipeCost / portions).toFixed(2));
    const salePrice = Number(recipe.productPrice || 0);

    // Criterio 2: Margen bruto ($) y Margen bruto (%)
    const grossMarginAmount = Number((salePrice - recipeCost).toFixed(2));
    const grossMarginPercentage =
      salePrice > 0
        ? Number((((salePrice - recipeCost) / salePrice) * 100).toFixed(2))
        : recipeCost > 0
        ? -100
        : 0;

    // Criterio 3: Clasificación de alertas de margen (<30% o negativo)
    let marginStatus: RecipeMarginStatus = "healthy";
    if (grossMarginPercentage < 0) {
      marginStatus = "critical";
    } else if (grossMarginPercentage < 30) {
      marginStatus = "warning";
    }

    // Filtro opcional por margen
    if (filterParams.marginFilter && filterParams.marginFilter !== "all") {
      if (filterParams.marginFilter === "low_margin" && (grossMarginPercentage < 0 || grossMarginPercentage >= 30)) {
        continue;
      }
      if (filterParams.marginFilter === "negative_margin" && grossMarginPercentage >= 0) {
        continue;
      }
      if (filterParams.marginFilter === "healthy_margin" && grossMarginPercentage < 30) {
        continue;
      }
    }

    // Filtro por término de búsqueda
    if (filterParams.search && filterParams.search.trim()) {
      const q = filterParams.search.trim().toLowerCase();
      const matchProd = recipe.productName?.toLowerCase().includes(q);
      const matchRec = recipe.name?.toLowerCase().includes(q);
      if (!matchProd && !matchRec) {
        continue;
      }
    }

    productCosts.push({
      productId: recipe.productId,
      productName: recipe.productName || recipe.name,
      categoryId: catInfo.categoryId,
      categoryName: catInfo.categoryName,
      recipeId: recipe.id,
      recipeName: recipe.name,
      portions,
      recipeCost,
      salePrice,
      grossMarginAmount,
      grossMarginPercentage,
      marginStatus,
      ingredientsCount: ingredients.length,
    });
  }

  // Ordenar por margen bruto ascendente (los menos rentables primero)
  productCosts.sort((a, b) => a.grossMarginPercentage - b.grossMarginPercentage);

  // 5. Consultar Ventas del Período para calcular Consumo Real de Ingredientes [Criterio 4]
  const soldUnitsByProductId = new Map<string, number>();
  const soldUnitsByProductName = new Map<string, number>();

  try {
    // Consultar documentos de venta del período
    const { data: salesDocs } = await supabase
      .from("business_sale_documents")
      .select("items, issued_at, status")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("issued_at", `${effectiveStartDate}T00:00:00`)
      .lte("issued_at", `${effectiveEndDate}T23:59:59`);

    (salesDocs || []).forEach((doc: any) => {
      const items = Array.isArray(doc.items) ? doc.items : [];
      items.forEach((it: any) => {
        const pId = it.productId || it.product_id || it.id;
        const pName = (it.description || it.productName || it.product_name || it.name || "").toLowerCase().trim();
        const qty = Number(it.quantity || 1);

        if (pId) {
          soldUnitsByProductId.set(pId, (soldUnitsByProductId.get(pId) || 0) + qty);
        }
        if (pName) {
          soldUnitsByProductName.set(pName, (soldUnitsByProductName.get(pName) || 0) + qty);
        }
      });
    });

    // Consultar órdenes de restaurante del período para cobertura total
    const { data: ordersData } = await supabase
      .from("restaurant_orders")
      .select("id, restaurant_order_items(product_id, product_name, quantity)")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("created_at", `${effectiveStartDate}T00:00:00`)
      .lte("created_at", `${effectiveEndDate}T23:59:59`);

    (ordersData || []).forEach((order: any) => {
      const oItems = Array.isArray(order.restaurant_order_items) ? order.restaurant_order_items : [];
      oItems.forEach((it: any) => {
        const pId = it.product_id;
        const pName = (it.product_name || "").toLowerCase().trim();
        const qty = Number(it.quantity || 1);

        // Si no se contabilizó previamente en documentos de venta, acumular
        if (pId && !soldUnitsByProductId.has(pId)) {
          soldUnitsByProductId.set(pId, qty);
        }
        if (pName && !soldUnitsByProductName.has(pName)) {
          soldUnitsByProductName.set(pName, qty);
        }
      });
    });
  } catch (salesErr) {
    console.warn("[getRecipeReportData] Error al consultar ventas para consumo:", salesErr);
  }

  // Criterio 4: Calcular el consumo del período multiplicando cantidad_ingrediente × unidades vendidas
  const ingredientConsumptionMap = new Map<
    string,
    {
      ingredientId: string;
      ingredientName: string;
      unit: string;
      costPerUnit: number;
      currentStock: number;
      periodConsumption: number;
    }
  >();

  // Inicializar todos los ingredientes registrados
  allIngredients.forEach((ing) => {
    ingredientConsumptionMap.set(ing.id, {
      ingredientId: ing.id,
      ingredientName: ing.name,
      unit: ing.unit,
      costPerUnit: Number(ing.costPerUnit || 0),
      currentStock: Number(ing.stockQuantity || 0),
      periodConsumption: 0,
    });
  });

  // Recorrer las recetas y computar el consumo a partir de las ventas de cada producto
  for (const recipe of recipesWithDetails) {
    const pId = recipe.productId;
    const pName = (recipe.productName || recipe.name || "").toLowerCase().trim();

    const unitsSold = soldUnitsByProductId.get(pId) || soldUnitsByProductName.get(pName) || 0;
    if (unitsSold <= 0) continue;

    const portions = Math.max(1, Number(recipe.portions || 1));
    const ingredients = recipe.ingredients || [];

    for (const ri of ingredients) {
      const ingId = ri.ingredientId;
      const ingQtyPerPortion = Number(ri.quantity || 0) / portions;
      const consumedAmount = unitsSold * ingQtyPerPortion;

      if (ingredientConsumptionMap.has(ingId)) {
        const entry = ingredientConsumptionMap.get(ingId)!;
        entry.periodConsumption += consumedAmount;
      } else {
        ingredientConsumptionMap.set(ingId, {
          ingredientId: ingId,
          ingredientName: ri.ingredientName || "Ingrediente",
          unit: ri.unit || "unidad",
          costPerUnit: Number(ri.unitCost || 0),
          currentStock: Number(ri.stockQuantity || 0),
          periodConsumption: consumedAmount,
        });
      }
    }
  }

  // 6. Proyección de Agotamiento y Ritmo Diario de Consumo
  const ingredientConsumptions: IngredientConsumptionItem[] = [];

  for (const entry of Array.from(ingredientConsumptionMap.values())) {
    const periodConsumption = Number(entry.periodConsumption.toFixed(3));
    const totalCostConsumed = Number((periodConsumption * entry.costPerUnit).toFixed(2));
    const dailyBurnRate = Number((periodConsumption / daysCount).toFixed(3));

    let daysUntilDepleted: number | null = null;
    let depletionAlert: "depleted" | "critical" | "warning" | "stable" | "no_consumption" = "no_consumption";

    if (entry.currentStock <= 0 && periodConsumption > 0) {
      daysUntilDepleted = 0;
      depletionAlert = "depleted";
    } else if (dailyBurnRate > 0) {
      daysUntilDepleted = entry.currentStock > 0 ? Math.floor(entry.currentStock / dailyBurnRate) : 0;
      if (daysUntilDepleted <= 3) {
        depletionAlert = "critical";
      } else if (daysUntilDepleted <= 7) {
        depletionAlert = "warning";
      } else {
        depletionAlert = "stable";
      }
    } else {
      depletionAlert = entry.currentStock <= 0 ? "depleted" : "no_consumption";
    }

    ingredientConsumptions.push({
      ingredientId: entry.ingredientId,
      ingredientName: entry.ingredientName,
      unit: entry.unit,
      costPerUnit: entry.costPerUnit,
      currentStock: entry.currentStock,
      periodConsumption,
      totalCostConsumed,
      dailyBurnRate,
      daysUntilDepleted,
      depletionAlert,
    });
  }

  // Ordenar consumos por costo total consumido descendente
  ingredientConsumptions.sort((a, b) => b.totalCostConsumed - a.totalCostConsumed);

  // Ingredientes que se agotarán primero (Ranking de riesgo de agotamiento)
  const depletionRanking = ingredientConsumptions
    .filter((ing) => ing.daysUntilDepleted !== null || ing.depletionAlert === "depleted")
    .sort((a, b) => {
      const daysA = a.daysUntilDepleted !== null ? a.daysUntilDepleted : 9999;
      const daysB = b.daysUntilDepleted !== null ? b.daysUntilDepleted : 9999;
      return daysA - daysB;
    });

  // 7. Resumen Ejecutivo de KPIs
  const totalRecipes = recipesWithDetails.length;
  const productsWithCriticalMarginCount = productCosts.filter(
    (p) => p.marginStatus === "warning" || p.marginStatus === "critical"
  ).length;
  const productsWithNegativeMarginCount = productCosts.filter(
    (p) => p.marginStatus === "critical"
  ).length;

  const totalMarginSum = productCosts.reduce((acc, p) => acc + p.grossMarginPercentage, 0);
  const averageGrossMarginPercentage =
    productCosts.length > 0 ? Number((totalMarginSum / productCosts.length).toFixed(1)) : 0;

  const totalIngredientCostConsumed = Number(
    ingredientConsumptions.reduce((acc, ing) => acc + ing.totalCostConsumed, 0).toFixed(2)
  );

  const ingredientsAtDepletionRiskCount = ingredientConsumptions.filter(
    (ing) => ing.depletionAlert === "depleted" || ing.depletionAlert === "critical" || ing.depletionAlert === "warning"
  ).length;

  const summary: RecipeReportSummary = {
    totalRecipes,
    averageGrossMarginPercentage,
    productsWithCriticalMarginCount,
    productsWithNegativeMarginCount,
    totalIngredientCostConsumed,
    ingredientsAtDepletionRiskCount,
  };

  return {
    summary,
    productCosts,
    ingredientConsumptions,
    depletionRanking,
    categories,
    filterParams: {
      ...filterParams,
      preset: effectivePreset,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
    },
    dateRange: {
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      daysCount,
    },
    businessName,
    currency,
  };
}





