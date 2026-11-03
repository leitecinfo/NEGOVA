import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceGlobalSearchResult, WorkspaceSearchResultItem } from "./types";

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

function formatCOP(val: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
}

function getOrderStatusBadge(status?: string | null): string {
  if (!status) return "Comanda";
  const s = status.toLowerCase();
  switch (s) {
    case "received":
      return "Recibido";
    case "in_preparation":
      return "En Cocina";
    case "ready":
      return "Listo";
    case "delivered":
      return "Entregado";
    case "paid":
      return "Pagado";
    case "cancelled":
      return "Cancelado";
    default:
      return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

/**
 * [NAV-001] Búsqueda Global Multidimensional en Workspace
 * Consulta productos, clientes y comandas/pedidos recientes del comercio en <500ms.
 */
export async function searchWorkspaceEntities(
  businessId: string,
  rawQuery: string,
  limit: number = 6
): Promise<WorkspaceGlobalSearchResult> {
  const q = rawQuery?.trim() || "";
  const startTime = performance.now();

  if (!q || !businessId) {
    return {
      query: q,
      modules: [],
      products: [],
      customers: [],
      orders: [],
      totalResults: 0,
      durationMs: 0,
    };
  }

  const supabase = await getDbClient();

  // Preparar identificador numérico de orden si aplica
  const cleanDigits = q.replace(/[^0-9]/g, "");
  const numericOrderNumber = cleanDigits ? parseInt(cleanDigits, 10) : null;

  // Consultas concurrentes optimizadas
  const [productsRes, customersRes, ordersRes] = await Promise.all([
    // 1. Productos
    (async () => {
      try {
        return await supabase
          .from("products")
          .select("id, name, sku, price, is_available")
          .eq("business_id", businessId)
          .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
          .limit(limit);
      } catch (err: any) {
        console.warn("[searchWorkspaceEntities - products error]:", err);
        return { data: [], error: err };
      }
    })(),

    // 2. Clientes
    (async () => {
      try {
        return await supabase
          .from("customers")
          .select("id, full_name, document_number, phone, email")
          .eq("business_id", businessId)
          .or(`full_name.ilike.%${q}%,document_number.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(limit);
      } catch (err: any) {
        console.warn("[searchWorkspaceEntities - customers error]:", err);
        return { data: [], error: err };
      }
    })(),

    // 3. Pedidos / Comandas
    (async () => {
      try {
        let queryBuilder = supabase
          .from("restaurant_orders")
          .select("id, order_number, customer_name, total, status, created_at, order_type")
          .eq("business_id", businessId);

        if (numericOrderNumber !== null && !isNaN(numericOrderNumber)) {
          queryBuilder = queryBuilder.or(`customer_name.ilike.%${q}%,order_number.eq.${numericOrderNumber}`);
        } else {
          queryBuilder = queryBuilder.ilike("customer_name", `%${q}%`);
        }

        return await queryBuilder
          .order("created_at", { ascending: false })
          .limit(limit);
      } catch (err: any) {
        console.warn("[searchWorkspaceEntities - orders error]:", err);
        return { data: [], error: err };
      }
    })(),
  ]);

  const rawProducts = productsRes?.data || [];
  const rawCustomers = customersRes?.data || [];
  const rawOrders = ordersRes?.data || [];

  // Mapear Productos
  const products: WorkspaceSearchResultItem[] = rawProducts.map((p: any) => ({
    id: p.id,
    category: "product",
    title: p.name,
    subtitle: `SKU: ${p.sku || "N/A"} • ${formatCOP(Number(p.price || 0))}`,
    href: `/workspace/${businessId}/productos?search=${encodeURIComponent(p.name)}`,
    badge: p.is_available === false ? "Agotado" : "Disponible",
    meta: { price: p.price, sku: p.sku },
  }));

  // Mapear Clientes
  const customers: WorkspaceSearchResultItem[] = rawCustomers.map((c: any) => {
    const contactParts = [
      c.document_number ? `Doc: ${c.document_number}` : null,
      c.phone ? `Tel: ${c.phone}` : null,
      c.email || null,
    ].filter(Boolean);

    return {
      id: c.id,
      category: "customer",
      title: c.full_name,
      subtitle: contactParts.length > 0 ? contactParts.join(" • ") : "Cliente sin contacto registrado",
      href: `/workspace/${businessId}/clientes/${c.id}`,
      badge: "Cliente",
      meta: { documentNumber: c.document_number, phone: c.phone },
    };
  });

  // Mapear Pedidos
  const orders: WorkspaceSearchResultItem[] = rawOrders.map((o: any) => {
    const orderTitle = o.order_number ? `Pedido #${o.order_number}` : `Pedido ORD-${o.id.slice(0, 6).toUpperCase()}`;
    const customerInfo = o.customer_name?.trim() || "Consumidor Final";
    const totalFormatted = formatCOP(Number(o.total || 0));

    return {
      id: o.id,
      category: "order",
      title: orderTitle,
      subtitle: `${customerInfo} • ${totalFormatted}`,
      href: `/workspace/${businessId}/pedidos/${o.id}`,
      badge: getOrderStatusBadge(o.status),
      meta: { orderNumber: o.order_number, total: o.total, status: o.status },
    };
  });

  const durationMs = Math.round(performance.now() - startTime);

  return {
    query: q,
    modules: [],
    products,
    customers,
    orders,
    totalResults: products.length + customers.length + orders.length,
    durationMs,
  };
}
