import { createClient } from "@/lib/supabase/server";
import { checkPlanLimit } from "@/lib/subscriptions/plan-limits-service";
import {
  Customer,
  CustomerAddress,
  CustomerSummaryItem,
  CustomerDetailView,
  CustomerFilterParams,
  CustomerDirectoryTab,
  CustomerGlobalKPIs,
  CreateCustomerInput,
  UpdateCustomerInput,
  AccountReceivable,
  AccountReceivableStatus,
  CustomerPayment,
  AccountsReceivableKPIs,
  CreateCreditSaleReceivableInput,
  RegisterCustomerPaymentInput,
} from "./types";

/**
 * Verifica si el rol del actor tiene autorización para otorgar o modificar el límite de crédito.
 * Regla de negocio [CLI-002]: Solo el owner/admin puede otorgar crédito (configurar credit_limit).
 */
export function canConfigureCustomerCredit(
  roleCode?: string | null,
  isOwner?: boolean
): boolean {
  if (isOwner === true) return true;
  if (!roleCode) return false;
  const normalized = roleCode.trim().toLowerCase();
  return ["owner", "business_admin", "admin", "super_admin"].includes(normalized);
}

/**
 * Normaliza un número telefónico para búsquedas ágiles y prevención de duplicados.
 * Remueve espacios, guiones, paréntesis y estandariza números colombianos (+57 300... -> 300...).
 */
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  // Si tiene código de país Colombia (57) y 12 dígitos, extraer los 10 dígitos locales
  if (cleaned.length === 12 && cleaned.startsWith("57")) {
    return cleaned.slice(2);
  }
  return cleaned;
}

async function getDbClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return await createClient();
}

/**
 * Consulta el listado paginado de clientes de un negocio con soporte de búsqueda,
 * filtrado por pestañas de directorio, ordenamiento y enriquecimiento con historial de compras.
 */
export async function listBusinessCustomers(params: CustomerFilterParams): Promise<{
  customers: CustomerSummaryItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}> {
  const supabase = await getDbClient();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize || 10));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .eq("business_id", params.businessId);

  // Mapeo de Pestaña de Directorio o Filtro de Estado
  const directoryTab = params.directoryTab;
  if (directoryTab === "active") {
    query = query.eq("status", "active");
  } else if (directoryTab === "inactive") {
    query = query.eq("status", "inactive");
  } else if (directoryTab === "with_credit") {
    query = query.gt("credit_limit", 0);
  } else if (directoryTab === "receivable") {
    query = query.gt("credit_used", 0);
  } else if (directoryTab === "with_discount") {
    query = query.or("notes.ilike.%descuento%,notes.ilike.%dcto%,notes.ilike.%desc%");
  } else if (directoryTab === "all") {
    // Si la pestaña es "all", no filtrar por status por defecto a menos que se indique
    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }
  } else if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  } else {
    // Por defecto mostrar clientes activos si no hay directorio ni status configurado
    query = query.eq("status", "active");
  }

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    const cleanPhone = normalizePhoneNumber(term);
    if (cleanPhone.length >= 3) {
      query = query.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%,normalized_phone.ilike.%${cleanPhone}%,tax_id.ilike.%${term}%,email.ilike.%${term}%`
      );
    } else {
      query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,tax_id.ilike.%${term}%,email.ilike.%${term}%`);
    }
  }

  const creditTab = params.creditTab || "all";
  if (creditTab === "with_credit") {
    query = query.gt("credit_limit", 0);
  } else if (creditTab === "receivable") {
    query = query.gt("credit_used", 0);
  }

  // Si el filtro es "overdue" o se requiere ordenamiento por compras, se procesa en memoria
  const isOverdueTab = creditTab === "overdue" || directoryTab === "overdue";
  const requiresCustomSort =
    params.sortBy === "sales_desc" ||
    params.sortBy === "orders_desc" ||
    params.sortBy === "recent";

  if (!isOverdueTab && !requiresCustomSort) {
    if (params.sortBy === "name_asc") {
      query = query.order("full_name", { ascending: true }).range(from, to);
    } else if (params.sortBy === "name_desc") {
      query = query.order("full_name", { ascending: false }).range(from, to);
    } else {
      query = query.order("created_at", { ascending: false }).range(from, to);
    }
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("[listBusinessCustomers] Error consultando clientes:", error);
    return {
      customers: [],
      totalCount: 0,
      totalPages: 1,
      currentPage: 1,
      pageSize,
    };
  }

  const rawCustomers = data || [];
  const customerIds = rawCustomers.map((c) => c.id);

  // Obtener direcciones predeterminadas de los clientes listados
  let addressesMap: Record<string, string> = {};
  if (customerIds.length > 0) {
    const { data: addresses } = await supabase
      .from("customer_addresses")
      .select("customer_id, address_line, reference")
      .in("customer_id", customerIds)
      .eq("business_id", params.businessId)
      .eq("is_default", true);

    if (addresses) {
      addresses.forEach((addr) => {
        addressesMap[addr.customer_id] = addr.reference
          ? `${addr.address_line} (${addr.reference})`
          : addr.address_line;
      });
    }
  }

  // Consultar cuentas por cobrar vencidas o activas para enriquecer el listado [CLI-002]
  const overdueByCustomer: Record<string, number> = {};
  if (customerIds.length > 0) {
    try {
      const { data: arRows } = await supabase
        .from("accounts_receivable")
        .select("id, customer_id, balance, due_date, status")
        .eq("business_id", params.businessId)
        .in("customer_id", customerIds)
        .neq("status", "paid")
        .neq("status", "cancelled");

      const now = new Date();
      for (const r of arRows || []) {
        const bal = Number(r.balance || 0);
        if (bal <= 0) continue;
        const isPastDue = new Date(r.due_date) < now || r.status === "overdue";
        if (isPastDue) {
          overdueByCustomer[r.customer_id] = (overdueByCustomer[r.customer_id] || 0) + bal;
          if (r.status !== "overdue") {
            await supabase
              .from("accounts_receivable")
              .update({ status: "overdue", updated_at: now.toISOString() })
              .eq("id", r.id)
              .eq("business_id", params.businessId);
          }
        }
      }
    } catch {
      // Fallback defensivo si la tabla aún no existe en base remota
    }
  }

  // Enriquecer con compras reales acumuladas de cada cliente
  const phoneToCustomerId = new Map<string, string>();
  for (const c of rawCustomers) {
    if (c.phone) phoneToCustomerId.set(c.phone, c.id);
    if (c.normalized_phone) phoneToCustomerId.set(c.normalized_phone, c.id);
  }

  const customerSalesAgg: Record<
    string,
    { totalSpent: number; count: number; lastDate: string | null }
  > = {};
  customerIds.forEach((id) => {
    customerSalesAgg[id] = { totalSpent: 0, count: 0, lastDate: null };
  });

  if (customerIds.length > 0) {
    try {
      const { data: salesRows } = await supabase
        .from("business_sale_documents")
        .select("customer_id, customer_phone, total, issued_at, status")
        .eq("business_id", params.businessId)
        .in("status", ["completed", "paid"]);

      for (const s of salesRows || []) {
        let targetId: string | undefined = s.customer_id;
        if (!targetId && s.customer_phone) {
          targetId = phoneToCustomerId.get(s.customer_phone);
        }
        if (targetId && customerSalesAgg[targetId]) {
          const amt = Number(s.total || 0);
          customerSalesAgg[targetId].totalSpent += amt;
          customerSalesAgg[targetId].count += 1;
          const curDate = customerSalesAgg[targetId].lastDate;
          if (!curDate || new Date(s.issued_at) > new Date(curDate)) {
            customerSalesAgg[targetId].lastDate = s.issued_at;
          }
        }
      }
    } catch {
      // Fallback defensivo
    }

    try {
      const { data: ordersRows } = await supabase
        .from("restaurant_orders")
        .select("customer_id, customer_phone, total, created_at, status")
        .eq("business_id", params.businessId)
        .neq("status", "cancelled");

      for (const o of ordersRows || []) {
        let targetId: string | undefined = o.customer_id;
        if (!targetId && o.customer_phone) {
          targetId = phoneToCustomerId.get(o.customer_phone);
        }
        if (targetId && customerSalesAgg[targetId]) {
          // Solo sumamos pedidos si el cliente no tenía ventas registradas previas
          if (customerSalesAgg[targetId].count === 0) {
            const amt = Number(o.total || 0);
            customerSalesAgg[targetId].totalSpent += amt;
            customerSalesAgg[targetId].count += 1;
            const curDate = customerSalesAgg[targetId].lastDate;
            if (!curDate || new Date(o.created_at) > new Date(curDate)) {
              customerSalesAgg[targetId].lastDate = o.created_at;
            }
          }
        }
      }
    } catch {
      // Fallback defensivo
    }
  }

  let customers: CustomerSummaryItem[] = rawCustomers.map((c: any) => {
    const creditLimit = Number(c.credit_limit || 0);
    const creditUsed = Number(c.credit_used || 0);
    const creditAvailable = Math.max(0, Number((creditLimit - creditUsed).toFixed(2)));
    const overdueAmount = Number((overdueByCustomer[c.id] || 0).toFixed(2));
    const salesData = customerSalesAgg[c.id] || { totalSpent: 0, count: 0, lastDate: null };
    const averageTicket = salesData.count > 0 ? Math.round(salesData.totalSpent / salesData.count) : 0;

    return {
      id: c.id,
      businessId: c.business_id,
      fullName: c.full_name,
      phone: c.phone || null,
      email: c.email || null,
      taxId: c.tax_id || null,
      notes: c.notes || null,
      status: c.status,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      totalOrdersCount: salesData.count,
      totalSpentAmount: salesData.totalSpent,
      averageTicket,
      lastActivityDate: salesData.lastDate,
      primaryAddress: addressesMap[c.id] || null,
      creditLimit,
      creditUsed,
      creditAvailable,
      hasOverdueReceivables: overdueAmount > 0,
      overdueAmount,
      balanceAmount: 0,
    };
  });

  // Asignar ranking TOP según volumen de compras
  const buyersSorted = [...customers]
    .filter((c) => c.totalSpentAmount > 0)
    .sort((a, b) => b.totalSpentAmount - a.totalSpentAmount);
  const rankMap = new Map<string, number>();
  buyersSorted.forEach((c, idx) => {
    rankMap.set(c.id, idx + 1);
  });
  customers = customers.map((c) => ({
    ...c,
    topRank: rankMap.get(c.id) || null,
  }));

  if (isOverdueTab) {
    customers = customers.filter((c) => c.hasOverdueReceivables);
  }

  // Ordenamiento personalizado si fue solicitado
  if (params.sortBy === "sales_desc") {
    customers.sort((a, b) => b.totalSpentAmount - a.totalSpentAmount);
  } else if (params.sortBy === "orders_desc") {
    customers.sort((a, b) => b.totalOrdersCount - a.totalOrdersCount);
  } else if (params.sortBy === "name_asc") {
    customers.sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
  } else if (params.sortBy === "name_desc") {
    customers.sort((a, b) => b.fullName.localeCompare(a.fullName, "es"));
  } else if (params.sortBy === "recent") {
    customers.sort((a, b) => {
      const dateA = a.lastActivityDate || a.createdAt;
      const dateB = b.lastActivityDate || b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }

  if (isOverdueTab || requiresCustomSort) {
    const filteredCount = customers.length;
    const paginated = customers.slice(from, to + 1);
    return {
      customers: paginated,
      totalCount: filteredCount,
      totalPages: Math.ceil(filteredCount / pageSize) || 1,
      currentPage: page,
      pageSize,
    };
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return {
    customers,
    totalCount,
    totalPages,
    currentPage: page,
    pageSize,
  };
}

/**
 * Consulta las métricas globales consolidadas del Módulo de Clientes:
 * Fila Superior: Métricas de Adquisición y Ventas
 * Fila Inferior: Métricas de Cartera y Crédito
 */
export async function getCustomerGlobalKPIs(
  businessId: string
): Promise<CustomerGlobalKPIs> {
  const supabase = await getDbClient();
  try {
    const { data: allCustomers, error: custErr } = await supabase
      .from("customers")
      .select("id, phone, normalized_phone, status, credit_limit, credit_used")
      .eq("business_id", businessId);

    if (custErr || !allCustomers) {
      return {
        totalRegistered: 0,
        activeCount: 0,
        inactiveCount: 0,
        hasPurchasedCount: 0,
        neverPurchasedCount: 0,
        totalSalesAmount: 0,
        totalBalanceAmount: 0,
        withCreditCount: 0,
        totalReceivable: 0,
        debtCustomersCount: 0,
        overdueBalance: 0,
        overdueCustomersCount: 0,
      };
    }

    const totalRegistered = allCustomers.length;
    let activeCount = 0;
    let inactiveCount = 0;
    let withCreditCount = 0;
    const phoneToCustId = new Map<string, string>();
    const customerIdSet = new Set<string>();

    for (const c of allCustomers) {
      customerIdSet.add(c.id);
      if (c.status === "active") activeCount++;
      else inactiveCount++;
      if (Number(c.credit_limit || 0) > 0) withCreditCount++;
      if (c.phone) phoneToCustId.set(c.phone, c.id);
      if (c.normalized_phone) phoneToCustId.set(c.normalized_phone, c.id);
    }

    const buyersSet = new Set<string>();
    let totalSalesAmount = 0;

    try {
      const { data: sales } = await supabase
        .from("business_sale_documents")
        .select("customer_id, customer_phone, total, status")
        .eq("business_id", businessId)
        .in("status", ["completed", "paid"]);

      for (const s of sales || []) {
        let matchedId: string | undefined = s.customer_id;
        if (!matchedId && s.customer_phone) {
          matchedId = phoneToCustId.get(s.customer_phone);
        }
        if (matchedId && customerIdSet.has(matchedId)) {
          buyersSet.add(matchedId);
          totalSalesAmount += Number(s.total || 0);
        }
      }
    } catch {
      // Fallback
    }

    try {
      const { data: orders } = await supabase
        .from("restaurant_orders")
        .select("customer_id, customer_phone, total, status")
        .eq("business_id", businessId)
        .neq("status", "cancelled");

      for (const o of orders || []) {
        let matchedId: string | undefined = o.customer_id;
        if (!matchedId && o.customer_phone) {
          matchedId = phoneToCustId.get(o.customer_phone);
        }
        if (matchedId && customerIdSet.has(matchedId)) {
          if (!buyersSet.has(matchedId)) {
            buyersSet.add(matchedId);
            totalSalesAmount += Number(o.total || 0);
          }
        }
      }
    } catch {
      // Fallback
    }

    const hasPurchasedCount = buyersSet.size;
    const neverPurchasedCount = Math.max(0, totalRegistered - hasPurchasedCount);

    const creditKpis = await getAccountsReceivableKPIs(businessId);

    return {
      totalRegistered,
      activeCount,
      inactiveCount,
      hasPurchasedCount,
      neverPurchasedCount,
      totalSalesAmount: Math.round(totalSalesAmount),
      totalBalanceAmount: 0,
      withCreditCount: creditKpis.customersWithCreditCount || withCreditCount,
      totalReceivable: creditKpis.totalReceivable,
      debtCustomersCount: creditKpis.customersWithDebtCount,
      overdueBalance: creditKpis.overdueBalance,
      overdueCustomersCount: creditKpis.overdueCustomersCount,
    };
  } catch (err) {
    console.error("[getCustomerGlobalKPIs] Error calculando KPIs:", err);
    return {
      totalRegistered: 0,
      activeCount: 0,
      inactiveCount: 0,
      hasPurchasedCount: 0,
      neverPurchasedCount: 0,
      totalSalesAmount: 0,
      totalBalanceAmount: 0,
      withCreditCount: 0,
      totalReceivable: 0,
      debtCustomersCount: 0,
      overdueBalance: 0,
      overdueCustomersCount: 0,
    };
  }
}

/**
 * Obtiene el detalle completo de un cliente, sus direcciones e historial de pedidos y ventas.
 */
export async function getCustomerById(
  businessId: string,
  customerId: string
): Promise<CustomerDetailView | null> {
  const supabase = await getDbClient();

  const { data: customerRow, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !customerRow) {
    if (error) console.error("[getCustomerById] Error consultando cliente:", error);
    return null;
  }

  // 1. Obtener direcciones del cliente
  const { data: addressesRows } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", customerId)
    .eq("business_id", businessId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  const addresses: CustomerAddress[] = (addressesRows || []).map((a: any) => ({
    id: a.id,
    businessId: a.business_id,
    customerId: a.customer_id,
    addressLine: a.address_line,
    reference: a.reference || null,
    label: a.label || "Principal",
    isDefault: a.is_default,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  }));

  // 2. Obtener pedidos recientes asociados con fallback defensivo
  let recentOrders: Array<{
    id: string;
    orderNumber: number;
    orderType: "dine_in" | "takeout" | "delivery";
    status: string;
    total: number;
    createdAt: string;
    itemsSummary?: string;
  }> = [];

  try {
    let ordersQuery = supabase
      .from("restaurant_orders")
      .select("id, order_number, order_type, status, total, notes, created_at")
      .eq("business_id", businessId);

    if (customerRow.phone) {
      ordersQuery = ordersQuery.or(
        `customer_id.eq.${customerId},customer_phone.eq.${customerRow.phone}`
      );
    } else {
      ordersQuery = ordersQuery.eq("customer_id", customerId);
    }

    const { data: ordersData, error: ordersError } = await ordersQuery
      .order("created_at", { ascending: false })
      .limit(100);

    if (ordersError) {
      // Fallback defensivo si la columna customer_id aún no existe en la base remota
      if (ordersError.message?.includes("customer_id") && customerRow.phone) {
        const { data: fallbackData } = await supabase
          .from("restaurant_orders")
          .select("id, order_number, order_type, status, total, notes, created_at")
          .eq("business_id", businessId)
          .eq("customer_phone", customerRow.phone)
          .order("created_at", { ascending: false })
          .limit(100);

        if (fallbackData) {
          recentOrders = fallbackData.map((o: any) => ({
            id: o.id,
            orderNumber: o.order_number,
            orderType: o.order_type as "dine_in" | "takeout" | "delivery",
            status: o.status,
            total: Number(o.total || 0),
            createdAt: o.created_at,
            itemsSummary: o.notes || undefined,
          }));
        }
      }
    } else if (ordersData) {
      recentOrders = ordersData.map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        orderType: o.order_type as "dine_in" | "takeout" | "delivery",
        status: o.status,
        total: Number(o.total || 0),
        createdAt: o.created_at,
        itemsSummary: o.notes || undefined,
      }));
    }
  } catch (ordersErr) {
    console.warn("[getCustomerById] Aviso al consultar órdenes asociadas:", ordersErr);
  }

  // 3. Obtener comprobantes de venta válidos asociados (para cálculo seguro de ventas)
  let salesQuery = supabase
    .from("business_sale_documents")
    .select("id, document_number, total, payment_method, status, issued_at")
    .eq("business_id", businessId);

  if (customerRow.phone) {
    salesQuery = salesQuery.or(
      `customer_id.eq.${customerId},customer_phone.eq.${customerRow.phone}`
    );
  } else {
    salesQuery = salesQuery.eq("customer_id", customerId);
  }

  const { data: salesData } = await salesQuery
    .order("issued_at", { ascending: false })
    .limit(100);

  const recentSales = (salesData || []).map((s: any) => ({
    id: s.id,
    documentNumber: s.document_number,
    total: Number(s.total || 0),
    paymentMethod: s.payment_method,
    status: s.status,
    issuedAt: s.issued_at,
  }));

  // 4. Cálculo fiable de métricas:
  // Solo se suman ventas completadas o pagadas para NO duplicar importes de pedidos
  const validCompletedSales = recentSales.filter(
    (s) => s.status === "completed" || s.status === "paid"
  );
  let totalSpent = validCompletedSales.reduce((acc, s) => acc + s.total, 0);
  let totalSalesCount = validCompletedSales.length;

  // Si no hay comprobantes emitidos pero sí pedidos entregados o activos (no cancelados), reflejar dichos importes
  if (totalSpent === 0 && recentOrders.length > 0) {
    const validOrders = recentOrders.filter((o) => o.status !== "cancelled");
    totalSpent = validOrders.reduce((acc, o) => acc + o.total, 0);
    totalSalesCount = validOrders.length;
  }

  const averageTicket = totalSalesCount > 0 ? Math.round(totalSpent / totalSalesCount) : 0;

  // Fechas más recientes
  const lastOrderDate = recentOrders.length > 0 ? recentOrders[0].createdAt : null;
  const lastSaleDate = recentSales.length > 0 ? recentSales[0].issuedAt : null;
  let lastActivityDate: string | null = null;
  if (lastOrderDate && lastSaleDate) {
    lastActivityDate = new Date(lastOrderDate) > new Date(lastSaleDate) ? lastOrderDate : lastSaleDate;
  } else {
    lastActivityDate = lastOrderDate || lastSaleDate;
  }

  // 5. Consultar cuentas por cobrar y abonos del cliente [CLI-002]
  const { receivables, payments } = await getCustomerReceivables(businessId, customerId);

  const creditLimit = Number(customerRow.credit_limit || 0);
  const creditUsed = Number(customerRow.credit_used || 0);
  const creditAvailable = Math.max(0, Number((creditLimit - creditUsed).toFixed(2)));

  return {
    id: customerRow.id,
    businessId: customerRow.business_id,
    fullName: customerRow.full_name,
    phone: customerRow.phone || null,
    normalizedPhone: customerRow.normalized_phone || null,
    email: customerRow.email || null,
    taxId: customerRow.tax_id || null,
    notes: customerRow.notes || null,
    status: customerRow.status,
    creditLimit,
    creditUsed,
    creditAvailable,
    createdAt: customerRow.created_at,
    updatedAt: customerRow.updated_at,
    addresses,
    recentOrders,
    recentSales,
    receivables,
    payments,
    metrics: {
      totalOrders: recentOrders.length,
      totalSalesCount,
      totalSpent,
      averageTicket,
      lastOrderAt: lastActivityDate,
    },
  };
}

/**
 * Busca clientes de forma rápida para el selector de pedidos / POS por nombre o teléfono.
 */
export async function searchCustomersForPos(
  businessId: string,
  term: string
): Promise<
  Array<{
    id: string;
    fullName: string;
    phone: string | null;
    addresses: string[];
    notes: string | null;
  }>
> {
  if (!term || term.trim().length < 2) return [];

  const supabase = await getDbClient();
  const cleanTerm = term.trim();
  const cleanPhone = normalizePhoneNumber(cleanTerm);

  let query = supabase
    .from("customers")
    .select("id, full_name, phone, notes, credit_limit, credit_used")
    .eq("business_id", businessId)
    .eq("status", "active");

  if (cleanPhone.length >= 3) {
    query = query.or(
      `full_name.ilike.%${cleanTerm}%,phone.ilike.%${cleanTerm}%,normalized_phone.ilike.%${cleanPhone}%`
    );
  } else {
    query = query.ilike("full_name", `%${cleanTerm}%`);
  }

  const { data: customers, error } = await query.limit(6);

  if (error || !customers || customers.length === 0) {
    return [];
  }

  const customerIds = customers.map((c) => c.id);
  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("customer_id, address_line, reference")
    .in("customer_id", customerIds)
    .eq("business_id", businessId)
    .order("is_default", { ascending: false });

  const addressesByCustomer: Record<string, string[]> = {};
  if (addresses) {
    addresses.forEach((addr) => {
      if (!addressesByCustomer[addr.customer_id]) {
        addressesByCustomer[addr.customer_id] = [];
      }
      const full = addr.reference ? `${addr.address_line} (${addr.reference})` : addr.address_line;
      addressesByCustomer[addr.customer_id].push(full);
    });
  }

  return customers.map((c) => {
    const limit = Number(c.credit_limit || 0);
    const used = Number(c.credit_used || 0);
    const available = Math.max(0, Number((limit - used).toFixed(2)));
    return {
      id: c.id,
      fullName: c.full_name,
      phone: c.phone || null,
      addresses: addressesByCustomer[c.id] || [],
      notes: c.notes || null,
      creditLimit: limit,
      creditUsed: used,
      creditAvailable: available,
      hasCredit: limit > 0,
    };
  });
}

/**
 * Crea un nuevo cliente validando unicidad de teléfono si se proporciona.
 */
export async function createCustomer(
  businessId: string,
  input: CreateCustomerInput
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  // Validación de límites de suscripción en servidor [SUB-001]
  const planLimit = await checkPlanLimit(businessId, "customers");
  if (!planLimit.allowed) {
    return { success: false, error: planLimit.error };
  }

  if (!input.fullName || !input.fullName.trim()) {
    return { success: false, error: "El nombre del cliente es obligatorio." };
  }

  const supabase = await getDbClient();
  const cleanPhoneStr = input.phone?.trim() || null;
  const rawNorm = cleanPhoneStr ? normalizePhoneNumber(cleanPhoneStr) : null;
  const finalNormalizedPhone = rawNorm && rawNorm.length >= 7 ? rawNorm : null;

  // Si tiene teléfono, validar si ya existe un cliente idéntico
  if (finalNormalizedPhone) {
    const { data: existingList } = await supabase
      .from("customers")
      .select("id, full_name, status")
      .eq("business_id", businessId)
      .eq("normalized_phone", finalNormalizedPhone);

    if (existingList && existingList.length > 0) {
      // 1. Si ya existe un cliente activo con el MISMO nombre exacto, prevenir duplicar la misma persona
      const exactDuplicate = existingList.find(
        (c) =>
          c.status === "active" &&
          c.full_name.trim().toLowerCase() === input.fullName.trim().toLowerCase()
      );
      if (exactDuplicate) {
        return {
          success: false,
          error: `Ya existe un cliente registrado con este nombre y teléfono: "${exactDuplicate.full_name}".`,
        };
      }

      // 2. Si existía pero estaba inactivo con el mismo nombre, reactivarlo sin duplicar
      const inactiveMatch = existingList.find(
        (c) =>
          c.status === "inactive" &&
          c.full_name.trim().toLowerCase() === input.fullName.trim().toLowerCase()
      );
      if (inactiveMatch) {
        return await updateCustomer(businessId, inactiveMatch.id, {
          status: "active",
          email: input.email || undefined,
          taxId: input.taxId || undefined,
          notes: input.notes || undefined,
        });
      }
      // 3. Si el nombre es diferente (ej. familiares o compañeros de oficina que comparten teléfono),
      // se permite crear el registro individual independiente para no bloquear el flujo.
    }
  }

  const insertPayload = {
    business_id: businessId,
    full_name: input.fullName.trim(),
    phone: cleanPhoneStr,
    normalized_phone: finalNormalizedPhone,
    email: input.email?.trim() ? input.email.trim().toLowerCase() : null,
    tax_id: input.taxId?.trim() ? input.taxId.trim() : null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    status: "active" as const,
  };

  const { data: newCustomer, error: insertError } = await supabase
    .from("customers")
    .insert(insertPayload)
    .select()
    .single();

  if (insertError) {
    console.error("[createCustomer] Error al insertar cliente:", insertError);
    return { success: false, error: "No se pudo registrar el cliente en el sistema." };
  }

  // Si se proporcionó dirección inicial, crearla automáticamente
  if (input.addressLine && input.addressLine.trim() && newCustomer) {
    await supabase.from("customer_addresses").insert({
      business_id: businessId,
      customer_id: newCustomer.id,
      address_line: input.addressLine.trim(),
      reference: input.addressReference ? input.addressReference.trim() : null,
      label: "Principal",
      is_default: true,
    });
  }

  return {
    success: true,
    customer: {
      id: newCustomer.id,
      businessId: newCustomer.business_id,
      fullName: newCustomer.full_name,
      phone: newCustomer.phone,
      normalizedPhone: newCustomer.normalized_phone,
      email: newCustomer.email,
      taxId: newCustomer.tax_id,
      notes: newCustomer.notes,
      status: newCustomer.status,
      creditLimit: Number(newCustomer.credit_limit || 0),
      creditUsed: Number(newCustomer.credit_used || 0),
      creditAvailable: Math.max(
        0,
        Number(newCustomer.credit_limit || 0) - Number(newCustomer.credit_used || 0)
      ),
      createdAt: newCustomer.created_at,
      updatedAt: newCustomer.updated_at,
    },
  };
}

/**
 * Actualiza los datos de un cliente existente.
 */
export async function updateCustomer(
  businessId: string,
  customerId: string,
  input: UpdateCustomerInput
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  const supabase = await getDbClient();

  // Validar existencia previa
  const { data: existing, error: findError } = await supabase
    .from("customers")
    .select("id, business_id")
    .eq("id", customerId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (findError || !existing) {
    return { success: false, error: "El cliente no existe o no pertenece a este comercio." };
  }

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.fullName !== undefined) {
    if (!input.fullName.trim()) {
      return { success: false, error: "El nombre no puede estar vacío." };
    }
    updateData.full_name = input.fullName.trim();
  }

  if (input.phone !== undefined) {
    const norm = input.phone ? normalizePhoneNumber(input.phone) : null;
    if (norm && norm.length > 0) {
      // Verificar colisión con otro cliente
      const { data: collision } = await supabase
        .from("customers")
        .select("id, full_name")
        .eq("business_id", businessId)
        .eq("normalized_phone", norm)
        .neq("id", customerId)
        .eq("status", "active")
        .maybeSingle();

      if (collision) {
        return {
          success: false,
          error: `El teléfono ya pertenece a otro cliente ("${collision.full_name}").`,
        };
      }
    }
    updateData.phone = input.phone ? input.phone.trim() : null;
    updateData.normalized_phone = norm;
  }

  if (input.email !== undefined) {
    updateData.email = input.email ? input.email.trim().toLowerCase() : null;
  }
  if (input.taxId !== undefined) {
    updateData.tax_id = input.taxId ? input.taxId.trim() : null;
  }
  if (input.notes !== undefined) {
    updateData.notes = input.notes ? input.notes.trim() : null;
  }
  if (input.status !== undefined) {
    updateData.status = input.status;
  }

  const { data: updated, error: updateError } = await supabase
    .from("customers")
    .update(updateData)
    .eq("id", customerId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (updateError || !updated) {
    console.error("[updateCustomer] Error al actualizar cliente:", updateError);
    return { success: false, error: "No se pudieron guardar los cambios del cliente." };
  }

  return {
    success: true,
    customer: {
      id: updated.id,
      businessId: updated.business_id,
      fullName: updated.full_name,
      phone: updated.phone,
      normalizedPhone: updated.normalized_phone,
      email: updated.email,
      taxId: updated.tax_id,
      notes: updated.notes,
      status: updated.status,
      creditLimit: Number(updated.credit_limit || 0),
      creditUsed: Number(updated.credit_used || 0),
      creditAvailable: Math.max(
        0,
        Number(updated.credit_limit || 0) - Number(updated.credit_used || 0)
      ),
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  };
}

/**
 * Eliminación lógica (desactivación) de un cliente para mantener la integridad histórica de pedidos y ventas.
 */
export async function deleteCustomer(
  businessId: string,
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();

  const { error } = await supabase
    .from("customers")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", customerId)
    .eq("business_id", businessId);

  if (error) {
    console.error("[deleteCustomer] Error al desactivar cliente:", error);
    return { success: false, error: "No se pudo eliminar el cliente." };
  }

  return { success: true };
}

/**
 * Agrega una nueva dirección a un cliente.
 */
export async function addCustomerAddress(
  businessId: string,
  customerId: string,
  addressLine: string,
  reference?: string | null,
  label = "Principal",
  isDefault = false
): Promise<{ success: boolean; address?: CustomerAddress; error?: string }> {
  if (!addressLine || !addressLine.trim()) {
    return { success: false, error: "La dirección no puede estar vacía." };
  }

  const supabase = await getDbClient();

  // Validación estricta de aislamiento multi-tenant:
  // Comprobar que el cliente realmente pertenece al businessId antes de asociar direcciones
  const { data: customerRecord, error: customerErr } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (customerErr || !customerRecord) {
    return { success: false, error: "El cliente no pertenece a este comercio o no existe." };
  }

  // Si se marca como predeterminada, desmarcar las anteriores
  if (isDefault) {
    await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", customerId)
      .eq("business_id", businessId);
  }

  const { data, error } = await supabase
    .from("customer_addresses")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      address_line: addressLine.trim(),
      reference: reference ? reference.trim() : null,
      label: label.trim() || "Principal",
      is_default: isDefault,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[addCustomerAddress] Error agregando dirección:", error);
    return { success: false, error: "No se pudo agregar la dirección." };
  }

  return {
    success: true,
    address: {
      id: data.id,
      businessId: data.business_id,
      customerId: data.customer_id,
      addressLine: data.address_line,
      reference: data.reference,
      label: data.label,
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

/**
 * Elimina una dirección de un cliente.
 */
export async function deleteCustomerAddress(
  businessId: string,
  customerId: string,
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();

  const { error } = await supabase
    .from("customer_addresses")
    .delete()
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .eq("business_id", businessId);

  if (error) {
    console.error("[deleteCustomerAddress] Error eliminando dirección:", error);
    return { success: false, error: "No se pudo eliminar la dirección." };
  }

  return { success: true };
}

// ==============================================================================
// CRÉDITO A CLIENTES, CUENTAS POR COBRAR Y ABONOS [CLI-002]
// ==============================================================================

function mapCustomerPaymentRow(row: any): CustomerPayment {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    receivableId: row.receivable_id,
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || "cash",
    paymentDate: row.payment_date || row.created_at,
    reference: row.reference || null,
    notes: row.notes || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
  };
}

function mapAccountReceivableRow(
  row: any,
  payments: CustomerPayment[] = []
): AccountReceivable {
  const now = new Date();
  const due = new Date(row.due_date);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const balance = Number(row.balance || 0);
  const isOverdue = balance > 0 && diffMs < 0;
  const daysOverdue = isOverdue ? Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24))) : 0;
  const daysUntilDue = !isOverdue && balance > 0 ? Math.max(0, diffDays) : 0;

  let status: AccountReceivableStatus = row.status || "pending";
  if (balance === 0 && status !== "cancelled") {
    status = "paid";
  } else if (isOverdue && status !== "cancelled") {
    status = "overdue";
  }

  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    customerName: row.customers?.full_name || row.customers?.name || null,
    customerPhone: row.customers?.phone || null,
    orderId: row.order_id || null,
    saleDocumentId: row.sale_document_id || null,
    amount: Number(row.amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    balance,
    dueDate: row.due_date,
    status,
    isOverdue,
    daysOverdue,
    daysUntilDue,
    notes: row.notes || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    payments,
  };
}

/**
 * Configura el límite de crédito (cupo máximo) de un cliente.
 * Regla de negocio [CLI-002]: Solo el owner/admin puede otorgar crédito (configurar credit_limit).
 */
export async function setCustomerCreditLimit(
  businessId: string,
  customerId: string,
  creditLimit: number,
  actor?: { roleCode?: string | null; isOwner?: boolean }
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  if (!canConfigureCustomerCredit(actor?.roleCode, actor?.isOwner)) {
    return {
      success: false,
      error: "Solo el dueño o administrador del negocio puede otorgar o modificar el cupo de crédito.",
    };
  }

  if (typeof creditLimit !== "number" || isNaN(creditLimit) || creditLimit < 0) {
    return {
      success: false,
      error: "El límite de crédito debe ser un valor numérico mayor o igual a 0.",
    };
  }

  const supabase = await getDbClient();

  const { data: existing, error: findErr } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (findErr || !existing) {
    return {
      success: false,
      error: "El cliente no existe o no pertenece a este comercio.",
    };
  }

  const normalizedLimit = Number(creditLimit.toFixed(2));
  const currentUsed = Number(existing.credit_used || 0);

  const { data: updated, error: updateErr } = await supabase
    .from("customers")
    .update({
      credit_limit: normalizedLimit,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (updateErr || !updated) {
    console.error("[setCustomerCreditLimit] Error actualizando cupo:", updateErr);
    return {
      success: false,
      error: "No se pudo actualizar el límite de crédito del cliente.",
    };
  }

  const updatedLimit = Number(updated.credit_limit ?? normalizedLimit);
  const updatedUsed = Number(updated.credit_used ?? currentUsed);

  return {
    success: true,
    customer: {
      id: updated.id,
      businessId: updated.business_id,
      fullName: updated.full_name,
      phone: updated.phone,
      normalizedPhone: updated.normalized_phone,
      email: updated.email,
      taxId: updated.tax_id,
      notes: updated.notes,
      status: updated.status,
      creditLimit: updatedLimit,
      creditUsed: updatedUsed,
      creditAvailable: Math.max(0, Number((updatedLimit - updatedUsed).toFixed(2))),
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  };
}

/**
 * Registra una venta a crédito generando una cuenta por cobrar (accounts_receivable)
 * e incrementando credit_used del cliente.
 * Regla de negocio [CLI-002]: Una venta a crédito NO puede superar credit_limit - credit_used.
 */
export async function createCreditSaleReceivable(
  businessId: string,
  input: CreateCreditSaleReceivableInput,
  userId?: string | null
): Promise<{
  success: boolean;
  receivable?: AccountReceivable;
  creditLimit?: number;
  creditUsed?: number;
  creditAvailable?: number;
  error?: string;
}> {
  const amount = Number(input.amount || 0);
  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      error: "El monto de la venta a crédito debe ser mayor a 0.",
    };
  }

  const supabase = await getDbClient();

  // 1. Consultar cliente y validar cupo disponible
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("*")
    .eq("id", input.customerId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (custErr || !customer) {
    return {
      success: false,
      error: "El cliente no existe o no pertenece a este comercio.",
    };
  }

  const creditLimit = Number(customer.credit_limit || 0);
  const creditUsed = Number(customer.credit_used || 0);
  const availableCredit = Math.max(0, Number((creditLimit - creditUsed).toFixed(2)));

  if (creditLimit <= 0) {
    return {
      success: false,
      error: `El cliente «${customer.full_name}» no tiene cupo de crédito autorizado.`,
    };
  }

  if (amount > availableCredit) {
    return {
      success: false,
      error: `Cupo de crédito insuficiente. Disponible: $${availableCredit.toLocaleString("es-CO")}, solicitado: $${amount.toLocaleString("es-CO")}.`,
    };
  }

  // 2. Determinar fecha de vencimiento y estado inicial
  let dueDateIso = input.dueDate;
  if (!dueDateIso) {
    const dueDays = typeof input.dueDays === "number" && input.dueDays > 0 ? input.dueDays : 30;
    const target = new Date();
    target.setDate(target.getDate() + dueDays);
    dueDateIso = target.toISOString();
  }

  const now = new Date();
  const isAlreadyOverdue = new Date(dueDateIso) < now;
  const initialStatus: AccountReceivableStatus = isAlreadyOverdue ? "overdue" : "pending";
  const cleanAmount = Number(amount.toFixed(2));

  // 3. Crear cuenta por cobrar en accounts_receivable
  const { data: receivableRow, error: arErr } = await supabase
    .from("accounts_receivable")
    .insert({
      business_id: businessId,
      customer_id: input.customerId,
      order_id: input.orderId || null,
      sale_document_id: input.saleDocumentId || null,
      amount: cleanAmount,
      paid_amount: 0,
      balance: cleanAmount,
      due_date: dueDateIso,
      status: initialStatus,
      notes: input.notes?.trim() || null,
      created_by: userId || null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select()
    .single();

  if (arErr || !receivableRow) {
    console.error("[createCreditSaleReceivable] Error creando cuenta por cobrar:", arErr);
    return {
      success: false,
      error: "No se pudo registrar la cuenta por cobrar.",
    };
  }

  // 4. Incrementar credit_used en customers
  const newCreditUsed = Number((creditUsed + cleanAmount).toFixed(2));
  const newCreditAvailable = Math.max(0, Number((creditLimit - newCreditUsed).toFixed(2)));

  await supabase
    .from("customers")
    .update({
      credit_used: newCreditUsed,
      updated_at: now.toISOString(),
    })
    .eq("id", input.customerId)
    .eq("business_id", businessId);

  return {
    success: true,
    receivable: mapAccountReceivableRow({
      ...receivableRow,
      customers: { full_name: customer.full_name, phone: customer.phone },
    }),
    creditLimit,
    creditUsed: newCreditUsed,
    creditAvailable: newCreditAvailable,
  };
}

/**
 * Registra un abono o pago total de un cliente sobre una cuenta por cobrar (customer_payments),
 * reduciendo el saldo de la cuenta y liberando el cupo utilizado (credit_used).
 */
export async function registerCustomerPayment(
  businessId: string,
  input: RegisterCustomerPaymentInput,
  userId?: string | null
): Promise<{
  success: boolean;
  payment?: CustomerPayment;
  receivable?: AccountReceivable;
  creditUsed?: number;
  creditAvailable?: number;
  error?: string;
}> {
  const amount = Number(input.amount || 0);
  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      error: "El monto del abono debe ser mayor a 0.",
    };
  }

  const supabase = await getDbClient();

  // 1. Obtener la cuenta por cobrar y verificar pertenencia al negocio
  const { data: arRow, error: arErr } = await supabase
    .from("accounts_receivable")
    .select("*")
    .eq("id", input.receivableId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (arErr || !arRow) {
    return {
      success: false,
      error: "La cuenta por cobrar no existe o no pertenece a este comercio.",
    };
  }

  if (arRow.status === "paid") {
    return {
      success: false,
      error: "Esta cuenta por cobrar ya se encuentra pagada en su totalidad.",
    };
  }

  if (arRow.status === "cancelled") {
    return {
      success: false,
      error: "No se pueden registrar abonos sobre una cuenta anulada.",
    };
  }

  const currentBalance = Number(arRow.balance || 0);
  const currentPaid = Number(arRow.paid_amount || 0);
  const cleanAmount = Number(amount.toFixed(2));

  if (cleanAmount > currentBalance) {
    return {
      success: false,
      error: `El abono ($${cleanAmount.toLocaleString("es-CO")}) no puede superar el saldo pendiente de la cuenta ($${currentBalance.toLocaleString("es-CO")}).`,
    };
  }

  const now = new Date();
  const paymentDateIso = input.paymentDate || now.toISOString();

  // 2. Insertar registro de abono en customer_payments
  const { data: paymentRow, error: payErr } = await supabase
    .from("customer_payments")
    .insert({
      business_id: businessId,
      customer_id: arRow.customer_id,
      receivable_id: arRow.id,
      amount: cleanAmount,
      payment_method: input.paymentMethod || "cash",
      payment_date: paymentDateIso,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: userId || null,
      created_at: now.toISOString(),
    })
    .select()
    .single();

  if (payErr || !paymentRow) {
    console.error("[registerCustomerPayment] Error insertando pago:", payErr);
    return {
      success: false,
      error: "No se pudo registrar el abono del cliente.",
    };
  }

  // 3. Actualizar saldo y estado en accounts_receivable
  const newPaidAmount = Number((currentPaid + cleanAmount).toFixed(2));
  const newBalance = Number(Math.max(0, currentBalance - cleanAmount).toFixed(2));
  const isPastDue = new Date(arRow.due_date) < now;
  const newStatus: AccountReceivableStatus =
    newBalance === 0 ? "paid" : isPastDue ? "overdue" : "partial";

  const { data: updatedArRow, error: updArErr } = await supabase
    .from("accounts_receivable")
    .update({
      paid_amount: newPaidAmount,
      balance: newBalance,
      status: newStatus,
      updated_at: now.toISOString(),
    })
    .eq("id", arRow.id)
    .eq("business_id", businessId)
    .select()
    .single();

  if (updArErr) {
    console.error("[registerCustomerPayment] Error actualizando cuenta por cobrar:", updArErr);
  }

  // 4. Reducir credit_used en customers
  const { data: customer } = await supabase
    .from("customers")
    .select("id, credit_limit, credit_used")
    .eq("id", arRow.customer_id)
    .eq("business_id", businessId)
    .maybeSingle();

  let newCreditUsed = 0;
  let newCreditAvailable = 0;
  if (customer) {
    const prevUsed = Number(customer.credit_used || 0);
    const limit = Number(customer.credit_limit || 0);
    newCreditUsed = Number(Math.max(0, prevUsed - cleanAmount).toFixed(2));
    newCreditAvailable = Math.max(0, Number((limit - newCreditUsed).toFixed(2)));

    await supabase
      .from("customers")
      .update({
        credit_used: newCreditUsed,
        updated_at: now.toISOString(),
      })
      .eq("id", customer.id)
      .eq("business_id", businessId);
  }

  const finalAr = updatedArRow || {
    ...arRow,
    paid_amount: newPaidAmount,
    balance: newBalance,
    status: newStatus,
    updated_at: now.toISOString(),
  };

  return {
    success: true,
    payment: mapCustomerPaymentRow(paymentRow),
    receivable: mapAccountReceivableRow(finalAr),
    creditUsed: newCreditUsed,
    creditAvailable: newCreditAvailable,
  };
}

/**
 * Consulta las cuentas por cobrar y el historial de abonos de un cliente específico,
 * marcando automáticamente como 'overdue' las cuentas vencidas con saldo pendiente.
 */
export async function getCustomerReceivables(
  businessId: string,
  customerId: string
): Promise<{
  receivables: AccountReceivable[];
  payments: CustomerPayment[];
}> {
  const supabase = await getDbClient();

  try {
    const [arRes, payRes] = await Promise.all([
      supabase
        .from("accounts_receivable")
        .select("*")
        .eq("business_id", businessId)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_payments")
        .select("*")
        .eq("business_id", businessId)
        .eq("customer_id", customerId)
        .order("payment_date", { ascending: false }),
    ]);

    const rawAr = arRes.data || [];
    const rawPay = payRes.data || [];

    const payments = rawPay.map(mapCustomerPaymentRow);
    const paymentsByReceivable = new Map<string, CustomerPayment[]>();
    for (const p of payments) {
      const list = paymentsByReceivable.get(p.receivableId) || [];
      list.push(p);
      paymentsByReceivable.set(p.receivableId, list);
    }

    const now = new Date();
    const receivables: AccountReceivable[] = [];

    for (const row of rawAr) {
      const bal = Number(row.balance || 0);
      const isPastDue = bal > 0 && new Date(row.due_date) < now;

      // Marcar automáticamente como 'overdue' si está vencida y tenía estado pending/partial
      if (isPastDue && (row.status === "pending" || row.status === "partial")) {
        row.status = "overdue";
        await supabase
          .from("accounts_receivable")
          .update({ status: "overdue", updated_at: now.toISOString() })
          .eq("id", row.id)
          .eq("business_id", businessId);
      }

      receivables.push(
        mapAccountReceivableRow(row, paymentsByReceivable.get(row.id) || [])
      );
    }

    return { receivables, payments };
  } catch {
    return { receivables: [], payments: [] };
  }
}

/**
 * Calcula los KPIs ejecutivos de Cartera (Cuentas por Cobrar vs Pagado y Antigüedad de saldos) [CLI-002].
 */
export async function getAccountsReceivableKPIs(
  businessId: string
): Promise<AccountsReceivableKPIs> {
  const supabase = await getDbClient();

  try {
    const [custRes, arRes] = await Promise.all([
      supabase
        .from("customers")
        .select("id, credit_limit, credit_used, status")
        .eq("business_id", businessId)
        .neq("status", "inactive"),
      supabase
        .from("accounts_receivable")
        .select("id, customer_id, amount, paid_amount, balance, due_date, status")
        .eq("business_id", businessId)
        .neq("status", "cancelled"),
    ]);

    const customers = custRes.data || [];
    const receivables = arRes.data || [];

    let totalCreditGranted = 0;
    let customersWithCreditCount = 0;
    let customersWithDebtCount = 0;

    for (const c of customers) {
      const limit = Number(c.credit_limit || 0);
      const used = Number(c.credit_used || 0);
      if (limit > 0) {
        totalCreditGranted += limit;
        customersWithCreditCount++;
      }
      if (used > 0) {
        customersWithDebtCount++;
      }
    }

    let totalReceivable = 0;
    let totalCollected = 0;
    let overdueBalance = 0;
    const overdueCustomerIds = new Set<string>();

    const agingBuckets = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      daysOver60: 0,
    };

    const now = new Date();

    for (const r of receivables) {
      const paid = Number(r.paid_amount || 0);
      const bal = Number(r.balance || 0);
      totalCollected += paid;

      if (bal > 0 && r.status !== "paid") {
        totalReceivable += bal;

        const due = new Date(r.due_date);
        const diffMs = now.getTime() - due.getTime();
        const isPastDue = diffMs > 0;

        if (isPastDue) {
          const daysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          overdueBalance += bal;
          overdueCustomerIds.add(r.customer_id);

          if (r.status === "pending" || r.status === "partial") {
            await supabase
              .from("accounts_receivable")
              .update({ status: "overdue", updated_at: now.toISOString() })
              .eq("id", r.id)
              .eq("business_id", businessId);
          }

          if (daysOverdue <= 30) {
            agingBuckets.days1to30 = Number((agingBuckets.days1to30 + bal).toFixed(2));
          } else if (daysOverdue <= 60) {
            agingBuckets.days31to60 = Number((agingBuckets.days31to60 + bal).toFixed(2));
          } else {
            agingBuckets.daysOver60 = Number((agingBuckets.daysOver60 + bal).toFixed(2));
          }
        } else {
          agingBuckets.current = Number((agingBuckets.current + bal).toFixed(2));
        }
      }
    }

    const totalExposure = totalCollected + totalReceivable;
    const collectionRate = totalExposure > 0
      ? Number(((totalCollected / totalExposure) * 100).toFixed(1))
      : 100;
    const portfolioHealthRate = totalReceivable > 0
      ? Number((((totalReceivable - overdueBalance) / totalReceivable) * 100).toFixed(1))
      : 100;

    return {
      totalCreditGranted: Number(totalCreditGranted.toFixed(2)),
      totalReceivable: Number(totalReceivable.toFixed(2)),
      totalCollected: Number(totalCollected.toFixed(2)),
      overdueBalance: Number(overdueBalance.toFixed(2)),
      customersWithCreditCount,
      customersWithDebtCount,
      overdueCustomersCount: overdueCustomerIds.size,
      agingBuckets,
      collectionRate,
      portfolioHealthRate,
    };
  } catch (err) {
    console.warn("[getAccountsReceivableKPIs] Error calculando KPIs de cartera:", err);
    return {
      totalCreditGranted: 0,
      totalReceivable: 0,
      totalCollected: 0,
      overdueBalance: 0,
      customersWithCreditCount: 0,
      customersWithDebtCount: 0,
      overdueCustomersCount: 0,
      agingBuckets: {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        daysOver60: 0,
      },
      collectionRate: 100,
      portfolioHealthRate: 100,
    };
  }
}

/**
 * [CLI-003] Consulta todas las cuentas por cobrar del negocio para la gestión de cartera,
 * ordenadas por fecha de vencimiento (próximos cobros primero) y enriquecidas con datos del cliente.
 */
export async function getBusinessAccountsReceivable(
  businessId: string,
  filters?: {
    status?: AccountReceivableStatus | "all" | "active";
    customerId?: string;
    search?: string;
    limit?: number;
  }
): Promise<AccountReceivable[]> {
  const supabase = await getDbClient();

  try {
    let query = supabase
      .from("accounts_receivable")
      .select("*, customers(id, full_name, phone)")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .order("due_date", { ascending: true });

    if (filters?.customerId) {
      query = query.eq("customer_id", filters.customerId);
    }

    if (filters?.status && filters.status !== "all") {
      if (filters.status === "active") {
        query = query.neq("status", "paid");
      } else {
        query = query.eq("status", filters.status);
      }
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data: rows, error } = await query;
    if (error || !rows) {
      return [];
    }

    const now = new Date();
    const mapped: AccountReceivable[] = [];

    for (const row of rows) {
      const bal = Number(row.balance || 0);
      const isPastDue = bal > 0 && new Date(row.due_date) < now;

      // Auto-actualizar estado a 'overdue' si ya venció
      if (isPastDue && (row.status === "pending" || row.status === "partial")) {
        row.status = "overdue";
        await supabase
          .from("accounts_receivable")
          .update({ status: "overdue", updated_at: now.toISOString() })
          .eq("id", row.id)
          .eq("business_id", businessId);
      }

      mapped.push(mapAccountReceivableRow(row));
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      return mapped.filter(
        (ar) =>
          (ar.customerName && ar.customerName.toLowerCase().includes(q)) ||
          (ar.customerPhone && ar.customerPhone.includes(q)) ||
          (ar.orderId && ar.orderId.toLowerCase().includes(q)) ||
          (ar.notes && ar.notes.toLowerCase().includes(q))
      );
    }

    return mapped;
  } catch (err) {
    console.warn("[getBusinessAccountsReceivable] Error consultando cuentas por cobrar:", err);
    return [];
  }
}

/**
 * [CLI-003] Consulta los clientes que más deben (Top Deudores) para la salud de cartera.
 */
export async function getTopDebtors(
  businessId: string,
  limit: number = 5
): Promise<Array<{
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  overdueAmount: number;
  hasOverdue: boolean;
}>> {
  const supabase = await getDbClient();

  try {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, full_name, phone, credit_limit, credit_used")
      .eq("business_id", businessId)
      .gt("credit_used", 0)
      .order("credit_used", { ascending: false })
      .limit(limit);

    if (!customers || customers.length === 0) {
      return [];
    }

    // Obtener cuentas vencidas de estos clientes
    const now = new Date();
    const customerIds = customers.map((c) => c.id);
    const { data: overdueReceivables } = await supabase
      .from("accounts_receivable")
      .select("customer_id, balance, due_date")
      .eq("business_id", businessId)
      .in("customer_id", customerIds)
      .gt("balance", 0)
      .lt("due_date", now.toISOString());

    const overdueByCustomer = new Map<string, number>();
    for (const r of overdueReceivables || []) {
      const prev = overdueByCustomer.get(r.customer_id) || 0;
      overdueByCustomer.set(r.customer_id, prev + Number(r.balance || 0));
    }

    return customers.map((c) => {
      const limit = Number(c.credit_limit || 0);
      const used = Number(c.credit_used || 0);
      const overdue = Number((overdueByCustomer.get(c.id) || 0).toFixed(2));

      return {
        customerId: c.id,
        customerName: c.full_name || "Cliente sin nombre",
        customerPhone: c.phone || null,
        creditLimit: limit,
        creditUsed: used,
        creditAvailable: Math.max(0, limit - used),
        overdueAmount: overdue,
        hasOverdue: overdue > 0,
      };
    });
  } catch (err) {
    console.warn("[getTopDebtors] Error:", err);
    return [];
  }
}
