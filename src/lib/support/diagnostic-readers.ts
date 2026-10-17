import { createClient } from "@/lib/supabase/server";
import { validateActiveGrant, logAdminAccess, AdminGrantScope } from "./delegated-access-service";

async function getSupabaseAdminClient() {
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
 * Consulta diagnóstica de pedidos (scope: orders_read)
 */
export async function getDiagnosticOrders(params: {
  grantId: string;
  businessId: string;
  adminUserId: string;
  orderId?: string;
  limit?: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 1. Validar grant activo
    const validation = await validateActiveGrant({
      grantId: params.grantId,
      businessId: params.businessId,
      adminUserId: params.adminUserId,
      requiredScope: "orders_read",
      targetResourceId: params.orderId,
    });

    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // 2. Registrar auditoría forense OBLIGATORIA antes de leer
    await logAdminAccess({
      grantId: params.grantId,
      businessId: params.businessId,
      adminUserId: params.adminUserId,
      resourceName: "orders",
      accessedRecordId: params.orderId || "list",
      queryFilters: { limit: params.limit || 20, orderId: params.orderId },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // 3. Ejecutar consulta de solo lectura
    const admin = await getSupabaseAdminClient();
    let query = admin
      .from("restaurant_orders")
      .select("id, order_number, table_number, customer_name, status, total, created_at, restaurant_order_items(*)")
      .eq("business_id", params.businessId)
      .order("created_at", { ascending: false });

    if (params.orderId) {
      query = query.eq("id", params.orderId);
    } else {
      query = query.limit(params.limit || 20);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar pedidos para diagnóstico." };
  }
}

/**
 * Consulta diagnóstica de ventas y comprobantes (scope: sales_read)
 */
export async function getDiagnosticSales(params: {
  grantId: string;
  businessId: string;
  adminUserId: string;
  saleId?: string;
  limit?: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const validation = await validateActiveGrant({
      grantId: params.grantId,
      businessId: params.businessId,
      adminUserId: params.adminUserId,
      requiredScope: "sales_read",
      targetResourceId: params.saleId,
    });

    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    await logAdminAccess({
      grantId: params.grantId,
      businessId: params.businessId,
      adminUserId: params.adminUserId,
      resourceName: "sales",
      accessedRecordId: params.saleId || "list",
      queryFilters: { limit: params.limit || 20, saleId: params.saleId },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    const admin = await getSupabaseAdminClient();
    let query = admin
      .from("sales")
      .select("id, sale_number, customer_name, total_amount, payment_method, status, created_at, sale_items(*)")
      .eq("business_id", params.businessId)
      .order("created_at", { ascending: false });

    if (params.saleId) {
      query = query.eq("id", params.saleId);
    } else {
      query = query.limit(params.limit || 20);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar ventas para diagnóstico." };
  }
}

/**
 * Consulta diagnóstica de inventario y catálogo (scope: inventory_read)
 */
export async function getDiagnosticInventory(params: {
  grantId: string;
  businessId: string;
  adminUserId: string;
  productId?: string;
  limit?: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const validation = await validateActiveGrant({
      grantId: params.grantId,
      businessId: params.businessId,
      adminUserId: params.adminUserId,
      requiredScope: "inventory_read",
      targetResourceId: params.productId,
    });

    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    await logAdminAccess({
      grantId: params.grantId,
      businessId: params.businessId,
      adminUserId: params.adminUserId,
      resourceName: "inventory",
      accessedRecordId: params.productId || "list",
      queryFilters: { limit: params.limit || 50, productId: params.productId },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    const admin = await getSupabaseAdminClient();
    let query = admin
      .from("products")
      .select("id, name, sku, price, stock, category_id, is_active, created_at")
      .eq("business_id", params.businessId)
      .order("name", { ascending: true });

    if (params.productId) {
      query = query.eq("id", params.productId);
    } else {
      query = query.limit(params.limit || 50);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar inventario para diagnóstico." };
  }
}
