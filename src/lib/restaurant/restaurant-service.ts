import crypto from "crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import {
  RestaurantTable,
  RestaurantTableWithOrder,
  RestaurantTablesSummary,
  CreateTableInput,
  UpdateTableInput,
  RestaurantOrder,
  RestaurantOrderItem,
  CreateRestaurantOrderInput,
  RestaurantOrderFilterParams,
  RestaurantOrderWithDetails,
  RestaurantOrdersListResult,
  RestaurantOrdersSummary,
  VALID_ORDER_STATUS_TRANSITIONS,
} from "./types";
import { Product, ProductModifierGroup, ProductVariant, getEffectiveVariantIngredients } from "../products/types";

/**
 * Genera un hash criptográfico determinístico del contenido de un pedido
 * para detectar discrepancias cuando se reintenta o reutiliza una clave de idempotencia.
 */
export function computeOrderPayloadHash(input: CreateRestaurantOrderInput): string {
  const normalized = {
    orderType: input.orderType,
    channelOrigin: input.channelOrigin,
    tableId: input.tableId || null,
    customerName: input.customerName?.trim() || null,
    customerPhone: input.customerPhone?.trim() || null,
    deliveryAddress: input.deliveryAddress?.trim() || null,
    deliveryReference: input.deliveryReference?.trim() || null,
    notes: input.notes?.trim() || null,
    items: (input.items || [])
      .map((it) => ({
        productId: it.productId,
        variantId: it.variantId || null,
        quantity: Math.max(1, Math.floor(it.quantity || 1)),
        notes: it.notes?.trim() || null,
        modifiers: (it.selectedModifiers || [])
          .map((m) => ({
            groupId: m.groupId,
            optionId: m.optionId,
          }))
          .sort((a, b) => `${a.groupId}:${a.optionId}`.localeCompare(`${b.groupId}:${b.optionId}`)),
      }))
      .sort((a, b) => `${a.productId}:${a.variantId || ""}`.localeCompare(`${b.productId}:${b.variantId || ""}`)),
  };

  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/**
 * Obtener cliente Supabase para operaciones del servidor autorizadas.
 * Utiliza credenciales privilegiadas en el servidor tras la debida autorización RBAC.
 */
async function getDbClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return await createClient();
}

// ==========================================
// MESAS (restaurant_tables)
// ==========================================

/**
 * Consulta las mesas configuradas para un negocio.
 * Si la tabla aún no existe en base de datos o está vacía, retorna un arreglo vacío sin fallar.
 */
export async function getRestaurantTables(businessId: string): Promise<RestaurantTable[]> {
  try {
    const supabase = await getDbClient();
    const { data, error } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("business_id", businessId)
      .neq("status", "inactive")
      .order("sort_order", { ascending: true })
      .order("name_or_number", { ascending: true });

    if (error) {
      console.warn("[getRestaurantTables] Advertencia al consultar mesas:", error.message);
      return [];
    }

    return (data || []) as RestaurantTable[];
  } catch (err) {
    console.warn("[getRestaurantTables] Error de conexión:", err);
    return [];
  }
}

/**
 * Consulta las mesas del comercio junto con los datos del pedido activo asociado.
 * Permite calcular el tiempo de ocupación, total de la comanda y enlace al pedido.
 */
export async function getRestaurantTablesWithOrders(
  businessId: string
): Promise<RestaurantTableWithOrder[]> {
  try {
    const supabase = await getDbClient();
    const tables = await getRestaurantTables(businessId);

    if (tables.length === 0) {
      return [];
    }

    // Identificar mesas ocupadas con ID de pedido activo
    const activeOrderIds = tables
      .filter((t) => t.status === "occupied" && t.current_order_id)
      .map((t) => t.current_order_id as string);

    const ordersMap = new Map<string, any>();

    if (activeOrderIds.length > 0) {
      const { data: rawOrders, error } = await supabase
        .from("restaurant_orders")
        .select("id, order_number, customer_name, total, status, payment_status, created_at, notes, restaurant_order_items(quantity)")
        .in("id", activeOrderIds)
        .eq("business_id", businessId);

      if (!error && rawOrders) {
        for (const order of rawOrders) {
          const items = Array.isArray(order.restaurant_order_items) ? order.restaurant_order_items : [];
          const itemsCount = items.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0);

          ordersMap.set(order.id, {
            id: order.id,
            order_number: order.order_number,
            customer_name: order.customer_name || null,
            total: Number(order.total || 0),
            status: order.status,
            payment_status: order.payment_status || "pending",
            items_count: itemsCount,
            created_at: order.created_at,
            notes: order.notes || null,
          });
        }
      }
    }

    return tables.map((tbl) => {
      const activeOrder = tbl.current_order_id ? ordersMap.get(tbl.current_order_id) || null : null;
      return {
        ...tbl,
        activeOrder,
      };
    });
  } catch (err) {
    console.error("[getRestaurantTablesWithOrders] Error:", err);
    return [];
  }
}

/**
 * Calcula indicadores consolidados de disponibilidad y ocupación de mesas.
 */
export async function getRestaurantTablesSummary(
  businessId: string
): Promise<RestaurantTablesSummary> {
  try {
    const tables = await getRestaurantTables(businessId);
    const total = tables.length;
    const available = tables.filter((t) => t.status === "available").length;
    const occupied = tables.filter((t) => t.status === "occupied").length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return {
      total,
      available,
      occupied,
      occupancyRate,
    };
  } catch (err) {
    console.error("[getRestaurantTablesSummary] Error:", err);
    return { total: 0, available: 0, occupied: 0, occupancyRate: 0 };
  }
}

/**
 * Crea una nueva mesa para el negocio asegurando aislamiento multi-tenant.
 */
export async function createRestaurantTable(
  businessId: string,
  input: CreateTableInput
): Promise<{ success: boolean; table?: RestaurantTable; error?: string }> {
  const supabase = await getDbClient();
  const cleanName = input.name_or_number?.trim();

  if (!cleanName) {
    return { success: false, error: "El nombre o número de la mesa es requerido." };
  }

  try {
    // Validar nombre duplicado dentro del mismo comercio
    const { data: existing } = await supabase
      .from("restaurant_tables")
      .select("id")
      .eq("business_id", businessId)
      .ilike("name_or_number", cleanName)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: `Ya existe una mesa con el nombre o número «${cleanName}» en este negocio.`,
      };
    }

    const { data: newTable, error } = await supabase
      .from("restaurant_tables")
      .insert({
        business_id: businessId,
        name_or_number: cleanName,
        capacity: input.capacity && input.capacity > 0 ? Math.floor(input.capacity) : 4,
        sort_order: input.sort_order !== undefined ? Number(input.sort_order) : 0,
        status: "available",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !newTable) {
      return {
        success: false,
        error: error?.message || "No fue posible registrar la mesa.",
      };
    }

    return { success: true, table: newTable as RestaurantTable };
  } catch (err: any) {
    console.error("[createRestaurantTable] Error:", err);
    return { success: false, error: err?.message || "Error al crear la mesa." };
  }
}

/**
 * Actualiza los datos administrativos de una mesa (nombre, capacidad, orden).
 * No permite alterar el estado operativo o comanda activa de forma arbitraria.
 */
export async function updateRestaurantTable(
  businessId: string,
  tableId: string,
  input: UpdateTableInput
): Promise<{ success: boolean; table?: RestaurantTable; error?: string }> {
  const supabase = await getDbClient();

  try {
    // Verificar existencia y pertenencia multi-tenant
    const { data: currentTable, error: findErr } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("id", tableId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (findErr || !currentTable) {
      return { success: false, error: "Mesa no encontrada o no pertenece a este comercio." };
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name_or_number !== undefined) {
      const cleanName = input.name_or_number.trim();
      if (!cleanName) {
        return { success: false, error: "El nombre o número de mesa no puede estar vacío." };
      }

      if (cleanName.toLowerCase() !== currentTable.name_or_number.toLowerCase()) {
        const { data: existing } = await supabase
          .from("restaurant_tables")
          .select("id")
          .eq("business_id", businessId)
          .ilike("name_or_number", cleanName)
          .maybeSingle();

        if (existing) {
          return {
            success: false,
            error: `Ya existe otra mesa con el nombre «${cleanName}» en este negocio.`,
          };
        }
      }
      updates.name_or_number = cleanName;
    }

    if (input.capacity !== undefined) {
      updates.capacity = input.capacity > 0 ? Math.floor(input.capacity) : 4;
    }

    if (input.sort_order !== undefined) {
      updates.sort_order = Number(input.sort_order);
    }

    const { data: updated, error: updateErr } = await supabase
      .from("restaurant_tables")
      .update(updates)
      .eq("id", tableId)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (updateErr || !updated) {
      return { success: false, error: updateErr?.message || "No se pudo actualizar la mesa." };
    }

    return { success: true, table: updated as RestaurantTable };
  } catch (err: any) {
    console.error("[updateRestaurantTable] Error:", err);
    return { success: false, error: err?.message || "Error al actualizar la mesa." };
  }
}

/**
 * Elimina de forma segura una mesa física si y solo si no está ocupada ni posee pedidos históricos.
 */
export async function deleteRestaurantTable(
  businessId: string,
  tableId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();

  try {
    const { data: table, error: findErr } = await supabase
      .from("restaurant_tables")
      .select("id, status, current_order_id, name_or_number")
      .eq("id", tableId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (findErr || !table) {
      return { success: false, error: "Mesa no encontrada o no pertenece a este comercio." };
    }

    // 1. Validar que no esté actualmente ocupada
    if (table.status === "occupied" || table.current_order_id) {
      return {
        success: false,
        error: `No es posible eliminar la mesa «${table.name_or_number}» porque se encuentra actualmente ocupada.`,
      };
    }

    // 2. Validar que no tenga pedidos históricos asociados para preservar la integridad referencial
    const { count, error: countErr } = await supabase
      .from("restaurant_orders")
      .select("id", { count: "exact", head: true })
      .eq("table_id", tableId)
      .eq("business_id", businessId);

    if (!countErr && count && count > 0) {
      return {
        success: false,
        error: `No es posible eliminar la mesa «${table.name_or_number}» porque cuenta con ${count} comanda(s) históricas asociadas. Puedes renombrarla o conservarla disponible para mantener la auditoría del negocio.`,
      };
    }

    // 3. Eliminar físicamente solo si es una mesa limpia sin operaciones registradas
    const { error: delErr } = await supabase
      .from("restaurant_tables")
      .delete()
      .eq("id", tableId)
      .eq("business_id", businessId);

    if (delErr) {
      return { success: false, error: delErr.message || "No se pudo eliminar la mesa." };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[deleteRestaurantTable] Error:", err);
    return { success: false, error: err?.message || "Error al eliminar la mesa." };
  }
}

/**
 * Libera operativamente una mesa ocupada, validando el cierre del pedido asociado.
 * No permite liberar si el pedido sigue en cocina o pendiente de cobro.
 */
export async function releaseRestaurantTable(
  businessId: string,
  tableId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();

  try {
    const { data: table, error: findErr } = await supabase
      .from("restaurant_tables")
      .select("id, name_or_number, status, current_order_id")
      .eq("id", tableId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (findErr || !table) {
      return { success: false, error: "Mesa no encontrada o no pertenece a este comercio." };
    }

    // Idempotente si ya está disponible
    if (table.status === "available" && !table.current_order_id) {
      return { success: true };
    }

    // Si tiene comanda activa vinculada, auditar las reglas de cierre
    if (table.current_order_id) {
      const { data: order } = await supabase
        .from("restaurant_orders")
        .select("id, order_number, status, payment_status")
        .eq("id", table.current_order_id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (order) {
        // Pedido cancelado: siempre elegible para liberar mesa
        const isCancelled = order.status === "cancelled";
        // Pedido finalizado y pagado: listo para liberar mesa
        const isCompletedAndPaid = order.status === "delivered" && order.payment_status === "paid";

        if (!isCancelled && !isCompletedAndPaid) {
          if (order.status !== "delivered") {
            return {
              success: false,
              error: `No se puede liberar la mesa «${table.name_or_number}»: la comanda #${order.order_number} aún no ha sido entregada. Debes completarla o cancelarla antes de liberar la mesa.`,
            };
          }
          if (order.payment_status !== "paid") {
            return {
              success: false,
              error: `No se puede liberar la mesa «${table.name_or_number}»: la comanda #${order.order_number} tiene el pago pendiente. Registra el pago en Ventas o Caja antes de liberar la mesa.`,
            };
          }
        }
      }
    }

    // Actualizar mesa a disponible y remover comanda activa
    const { error: updateErr } = await supabase
      .from("restaurant_tables")
      .update({
        status: "available",
        current_order_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tableId)
      .eq("business_id", businessId);

    if (updateErr) {
      return { success: false, error: updateErr.message || "No fue posible liberar la mesa." };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[releaseRestaurantTable] Error:", err);
    return { success: false, error: err?.message || "Error al liberar la mesa." };
  }
}

// ==========================================
// PEDIDOS (restaurant_orders & restaurant_order_items)
// ==========================================

export interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: number;
  total?: number;
  error?: string;
}

/**
 * Registra de forma verdaderamente transaccional un pedido en la base de datos (Etapa 3).
 * Valida los productos, disponibilidad, complementos y recalcula los precios estrictamente en el servidor,
 * delegando la persistencia a una función PostgreSQL RPC atómica con idempotencia real.
 */
export async function createRestaurantOrder(
  businessId: string,
  input: CreateRestaurantOrderInput,
  userId?: string
): Promise<CreateOrderResult> {
  const supabase = await getDbClient();

  // 1. Validación de destino y canal
  if (!["dine_in", "takeout", "delivery"].includes(input.orderType)) {
    return { success: false, error: "Destino de pedido inválido. Debe ser Mesa, Para llevar o Domicilio." };
  }

  // Para consumo en mesa (dine_in), el canal de recepción siempre se resuelve a in_person
  const resolvedChannelOrigin = input.orderType === "dine_in" ? "in_person" : input.channelOrigin;

  if (!["in_person", "whatsapp"].includes(resolvedChannelOrigin)) {
    return { success: false, error: "Canal de entrada inválido. Debe ser Presencial o WhatsApp." };
  }

  if (input.orderType === "dine_in") {
    if (!input.tableId) {
      return { success: false, error: "Para consumo en mesa debes seleccionar una mesa." };
    }

    // Verificar que la mesa pertenezca al negocio autorizado y esté disponible
    const { data: tableData } = await supabase
      .from("restaurant_tables")
      .select("id, name_or_number, business_id, status")
      .eq("id", input.tableId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!tableData) {
      return { success: false, error: "La mesa seleccionada no pertenece a este negocio o no existe." };
    }

    if (tableData.status && tableData.status !== "available") {
      // Si se especificó idempotencyKey, la mesa podría estar ocupada legítimamente por este mismo pedido
      // (caso de reintento tras pérdida de conexión de red). Permitimos que la RPC atómica evalúe la idempotencia.
      if (!input.idempotencyKey) {
        return { success: false, error: "La mesa seleccionada ya se encuentra ocupada." };
      }
    }
  }

  if (input.orderType === "delivery") {
    if (!input.customerName?.trim()) {
      return { success: false, error: "Para pedidos a domicilio debes ingresar el nombre del destinatario." };
    }
    if (!input.deliveryAddress?.trim()) {
      return { success: false, error: "Para pedidos a domicilio debes ingresar la dirección de entrega." };
    }
  }

  // 3. Validación de líneas del pedido
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { success: false, error: "El pedido debe incluir al menos un producto." };
  }

  // 4. Obtener todos los productos involucrados desde la base de datos (Snapshot real)
  const productIds = Array.from(new Set(input.items.map((it) => it.productId)));
  const { data: dbProducts, error: prodError } = await supabase
    .from("products")
    .select("id, name, price, is_available, status, metadata, business_id")
    .eq("business_id", businessId)
    .in("id", productIds);

  if (prodError || !dbProducts) {
    console.error("[createRestaurantOrder] Error al consultar productos:", prodError);
    return { success: false, error: "Error al validar los productos del catálogo." };
  }

  const productMap = new Map<string, Product>();
  dbProducts.forEach((p) => productMap.set(p.id, p as Product));

  // 5. Recalcular importes, validar complementos y construir snapshots
  interface PreparedItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes?: string;
    modifiers: any[];
  }

  const preparedItems: PreparedItem[] = [];
  let calculatedSubtotal = 0;

  for (let idx = 0; idx < input.items.length; idx++) {
    const it = input.items[idx];
    const product = productMap.get(it.productId);

    if (!product) {
      return {
        success: false,
        error: `El producto en la línea ${idx + 1} no existe o no pertenece a este negocio.`,
      };
    }

    if (!product.is_available || product.status !== "active") {
      return {
        success: false,
        error: `El producto «${product.name}» ya no se encuentra disponible.`,
      };
    }

    const safeQty = Math.max(1, Math.floor(it.quantity || 1));

    // Validar variantes comerciales y resolver precio base
    const hasVariants = Boolean(
      (product.metadata as any)?.has_variants &&
      Array.isArray((product.metadata as any)?.variants) &&
      (product.metadata as any).variants.length > 0
    );
    const variants: ProductVariant[] = (product.metadata as any)?.variants || [];

    let selectedVariant: ProductVariant | null = null;
    let basePrice = Math.max(0, product.price || 0);
    let resolvedProductName = product.name;

    if (hasVariants) {
      if (!it.variantId) {
        return {
          success: false,
          error: `Debes seleccionar un tamaño o presentación para «${product.name}».`,
        };
      }

      selectedVariant = variants.find((v) => v.id === it.variantId) || null;
      if (!selectedVariant) {
        return {
          success: false,
          error: `La presentación seleccionada ya no existe para «${product.name}».`,
        };
      }

      if (selectedVariant.is_available === false) {
        return {
          success: false,
          error: `La presentación «${selectedVariant.name}» de «${product.name}» no se encuentra disponible.`,
        };
      }

      basePrice = Math.max(0, selectedVariant.price || 0);
      resolvedProductName = `${product.name} (${selectedVariant.name})`;
    } else if (it.variantId) {
      selectedVariant = variants.find((v) => v.id === it.variantId) || null;
      if (selectedVariant) {
        basePrice = Math.max(0, selectedVariant.price || 0);
        resolvedProductName = `${product.name} (${selectedVariant.name})`;
      }
    }

    // Validar modificadores contra los grupos configurados en metadata del producto
    const configuredGroups: ProductModifierGroup[] =
      (product.metadata as any)?.modifier_groups || [];
    const selectedMods = it.selectedModifiers || [];

    let modifiersExtraPrice = 0;
    const validatedModifiersSnapshot: any[] = [];

    // Validar cada modificador seleccionado
    for (const mod of selectedMods) {
      const group = configuredGroups.find((g) => (g.id || g.name) === mod.groupId);
      if (!group) {
        return {
          success: false,
          error: `El grupo de complementos «${mod.groupName}» no es válido para «${product.name}».`,
        };
      }

      const option = group.options.find((o) => (o.id || o.name) === mod.optionId);
      if (!option) {
        return {
          success: false,
          error: `La opción «${mod.optionName}» no existe en el grupo «${group.name}».`,
        };
      }

      if (!option.is_available) {
        return {
          success: false,
          error: `El complemento «${option.name}» de «${group.name}» se encuentra agotado.`,
        };
      }

      const realExtraPrice = Math.max(0, option.price || 0);
      modifiersExtraPrice += realExtraPrice;

      validatedModifiersSnapshot.push({
        groupId: group.id || group.name,
        groupName: group.name,
        optionId: option.id || option.name,
        optionName: option.name,
        price: realExtraPrice,
      });
    }

    // Validar obligatoriedad y límites de cada grupo configurado
    for (const group of configuredGroups) {
      const groupKey = group.id || group.name;
      const count = validatedModifiersSnapshot.filter((m) => m.groupId === groupKey).length;
      const minRequired = group.required ? Math.max(1, group.min_select || 1) : (group.min_select || 0);
      const maxAllowed = group.max_select ?? (group.required && !group.max_select ? 1 : Infinity);

      if (count < minRequired) {
        return {
          success: false,
          error: `Debes seleccionar al menos ${minRequired} opción(es) en «${group.name}» para «${product.name}».`,
        };
      }
      if (count > maxAllowed) {
        return {
          success: false,
          error: `Has superado el máximo de ${maxAllowed} opción(es) en «${group.name}» para «${product.name}».`,
        };
      }
    }

    const unitPrice = basePrice + modifiersExtraPrice;
    const lineSubtotal = unitPrice * safeQty;
    calculatedSubtotal += lineSubtotal;

    preparedItems.push({
      productId: product.id,
      productName: resolvedProductName,
      quantity: safeQty,
      unitPrice,
      subtotal: lineSubtotal,
      notes: it.notes?.trim() || undefined,
      modifiers: validatedModifiersSnapshot,
    });
  }

  const calculatedTotal = calculatedSubtotal; // En esta etapa delivery_fee es 0
  const payloadHash = computeOrderPayloadHash(input);

  // 6. Inserción verdaderamente transaccional vía PostgreSQL RPC
  // Garantiza atomicidad total sin requerir DELETE compensatorio, serializa ordenes por tenant
  // y detecta discrepancia de contenido ante reintentos de idempotencyKey.
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_restaurant_pos_order",
    {
      p_business_id: businessId,
      p_order_type: input.orderType,
      p_channel_origin: resolvedChannelOrigin,
      p_subtotal: calculatedSubtotal,
      p_delivery_fee: 0,
      p_total: calculatedTotal,
      p_items: preparedItems.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.subtotal,
        notes: item.notes || null,
        modifiers: item.modifiers,
      })),
      p_table_id: input.orderType === "dine_in" ? input.tableId : null,
      p_customer_name: ["delivery", "takeout"].includes(input.orderType) ? input.customerName?.trim() || null : null,
      p_customer_phone: ["delivery", "takeout"].includes(input.orderType) ? input.customerPhone?.trim() || null : null,
      p_delivery_address: input.orderType === "delivery" ? input.deliveryAddress?.trim() : null,
      p_delivery_reference: input.orderType === "delivery" ? input.deliveryReference?.trim() || null : null,
      p_notes: input.notes?.trim() || null,
      p_idempotency_key: input.idempotencyKey || null,
      p_idempotency_hash: payloadHash,
      p_user_id: userId || null,
    }
  );

  if (rpcError) {
    console.error("[createRestaurantOrder] Error RPC:", rpcError);

    // Mapeo de excepciones controladas de la función PostgreSQL
    if (rpcError.message?.includes("IDEMPOTENCY_PAYLOAD_MISMATCH")) {
      return {
        success: false,
        error: "La clave de idempotencia fue reutilizada con un contenido de pedido diferente. Inicia un nuevo pedido.",
      };
    }
    if (rpcError.message?.includes("TABLE_NOT_FOUND")) {
      return {
        success: false,
        error: "La mesa seleccionada no pertenece a este negocio o no existe.",
      };
    }
    if (rpcError.message?.includes("TABLE_NOT_AVAILABLE")) {
      return {
        success: false,
        error: "La mesa seleccionada ya se encuentra ocupada.",
      };
    }
    if (rpcError.message?.includes("TABLE_UPDATE_FAILED")) {
      return {
        success: false,
        error: "No se pudo actualizar el estado de la mesa seleccionada.",
      };
    }
    if (rpcError.message?.includes("TABLE_REQUIRED")) {
      return {
        success: false,
        error: "Para consumo en mesa debes seleccionar una mesa.",
      };
    }
    if (rpcError.message?.includes("CUSTOMER_NAME_REQUIRED")) {
      return {
        success: false,
        error: "Para pedidos a domicilio debes ingresar el nombre del destinatario.",
      };
    }
    if (rpcError.message?.includes("DELIVERY_ADDRESS_REQUIRED")) {
      return {
        success: false,
        error: "Para pedidos a domicilio debes ingresar la dirección de entrega.",
      };
    }

    if (rpcError.message?.includes("BUSINESS_UNAVAILABLE")) {
      return {
        success: false,
        error: "El negocio no se encuentra activo u operacional.",
      };
    }
    if (rpcError.message?.includes("UNAUTHORIZED")) {
      return {
        success: false,
        error: "No tienes autorización para operar en este comercio.",
      };
    }

    return {
      success: false,
      error: rpcError.message || "No se pudo registrar el pedido en la base de datos.",
    };
  }

  if (!rpcData || !rpcData.order_id) {
    return {
      success: false,
      error: "Respuesta inválida al registrar la comanda.",
    };
  }

  // Si el pedido es para mesa, reflejar la ocupación y el pedido activo en la mesa
  if (input.orderType === "dine_in" && input.tableId) {
    try {
      const tableQuery = supabase.from("restaurant_tables");
      if (typeof (tableQuery as any)?.update === "function") {
        await (tableQuery as any)
          .update({
            status: "occupied",
            current_order_id: rpcData.order_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.tableId)
          .eq("business_id", businessId);
      }
    } catch (tblErr) {
      console.warn("[createRestaurantOrder] Advertencia al actualizar estado de la mesa:", tblErr);
    }
  }

  return {
    success: true,
    orderId: rpcData.order_id,
    orderNumber: rpcData.order_number,
    total: Number(rpcData.total),
  };
}

/**
 * Consulta un pedido por su identificador asegurando aislamiento multi-tenant.
 */
export async function getRestaurantOrderById(businessId: string, orderId: string) {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("restaurant_orders")
    .select("*, restaurant_order_items(*)")
    .eq("id", orderId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Consulta el listado paginado y filtrado de pedidos de un comercio (multi-tenant).
 */
export async function getRestaurantOrdersList({
  businessId,
  search,
  status,
  paymentStatus,
  orderType,
  channelOrigin,
  startDate,
  endDate,
  page = 1,
  pageSize = 10,
}: RestaurantOrderFilterParams): Promise<RestaurantOrdersListResult> {
  const supabase = await getDbClient();
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(100, pageSize));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  try {
    let query = supabase
      .from("restaurant_orders")
      .select("*, restaurant_order_items(id, product_name, quantity, unit_price, subtotal, notes, modifiers)", {
        count: "exact",
      })
      .eq("business_id", businessId);

    // 1. Filtro de búsqueda textual (número de orden o nombre de cliente)
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      const numericSearch = cleanSearch.replace(/^#/, "");
      if (/^\d+$/.test(numericSearch)) {
        query = query.or(`order_number.eq.${numericSearch},customer_name.ilike.%${cleanSearch}%`);
      } else {
        query = query.ilike("customer_name", `%${cleanSearch}%`);
      }
    }

    // 2. Filtro de estado operativo
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // 3. Filtro de estado de pago
    if (paymentStatus && paymentStatus !== "all") {
      query = query.eq("payment_status", paymentStatus);
    }

    // 4. Filtro de destino / tipo de orden
    if (orderType && orderType !== "all") {
      query = query.eq("order_type", orderType);
    }

    // 5. Filtro de canal de origen
    if (channelOrigin && channelOrigin !== "all") {
      query = query.eq("channel_origin", channelOrigin);
    }

    // 6. Rango de fechas
    if (startDate) {
      query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
    }

    // 7. Orden cronológico descendente y paginación
    query = query.order("created_at", { ascending: false }).range(from, to);

    const [{ data: rawOrders, count, error }, tables] = await Promise.all([
      query,
      getRestaurantTables(businessId),
    ]);

    if (error) {
      console.error("[getRestaurantOrdersList] Error al consultar pedidos:", error);
      return {
        orders: [],
        totalCount: 0,
        totalPages: 1,
        currentPage: safePage,
        pageSize: safePageSize,
      };
    }

    const tableMap = new Map<string, string>();
    for (const tbl of tables) {
      tableMap.set(tbl.id, tbl.name_or_number);
    }

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));

    const orders: RestaurantOrderWithDetails[] = (rawOrders || []).map((row: any) => {
      const items = Array.isArray(row.restaurant_order_items) ? row.restaurant_order_items : [];
      const tableName = row.table_id ? tableMap.get(row.table_id) || "Mesa" : null;

      return {
        id: row.id,
        business_id: row.business_id,
        order_number: row.order_number,
        status: row.status,
        order_type: row.order_type,
        channel_origin: row.channel_origin,
        subtotal: Number(row.subtotal || 0),
        delivery_fee: Number(row.delivery_fee || 0),
        total: Number(row.total || 0),
        notes: row.notes || null,
        table_id: row.table_id || null,
        tableName,
        customer_name: row.customer_name || null,
        customer_phone: row.customer_phone || null,
        delivery_address: row.delivery_address || null,
        delivery_reference: row.delivery_reference || null,
        delivery_status: row.delivery_status || null,
        driver_name: row.driver_name || null,
        payment_status: row.payment_status || "pending",
        idempotency_key: row.idempotency_key || null,
        idempotency_hash: row.idempotency_hash || null,
        created_by: row.created_by || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        itemsCount: items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0),
        items,
      };
    });

    return {
      orders,
      totalCount,
      totalPages,
      currentPage: safePage,
      pageSize: safePageSize,
    };
  } catch (err) {
    console.error("[getRestaurantOrdersList] Excepción:", err);
    return {
      orders: [],
      totalCount: 0,
      totalPages: 1,
      currentPage: safePage,
      pageSize: safePageSize,
    };
  }
}

/**
 * Consulta el conteo consolidado de pedidos por estado operativo en el negocio.
 */
export async function getRestaurantOrdersSummary(businessId: string): Promise<RestaurantOrdersSummary> {
  const supabase = await getDbClient();
  try {
    const { data, error } = await supabase
      .from("restaurant_orders")
      .select("status")
      .eq("business_id", businessId);

    if (error || !data) {
      return { total: 0, received: 0, inPreparation: 0, ready: 0, delivered: 0, cancelled: 0 };
    }

    const summary: RestaurantOrdersSummary = {
      total: data.length,
      received: 0,
      inPreparation: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const order of data) {
      if (order.status === "received") summary.received++;
      else if (order.status === "in_preparation") summary.inPreparation++;
      else if (order.status === "ready") summary.ready++;
      else if (order.status === "delivered") summary.delivered++;
      else if (order.status === "cancelled") summary.cancelled++;
    }

    return summary;
  } catch (err) {
    console.warn("[getRestaurantOrdersSummary] Error:", err);
    return { total: 0, received: 0, inPreparation: 0, ready: 0, delivered: 0, cancelled: 0 };
  }
}

/**
 * Consulta un pedido con todo su detalle, productos, mesa y estado para la pantalla de detalle.
 */
export async function getRestaurantOrderWithDetails(
  businessId: string,
  orderId: string
): Promise<RestaurantOrderWithDetails | null> {
  const supabase = await getDbClient();
  try {
    const [{ data: order, error }, tables] = await Promise.all([
      supabase
        .from("restaurant_orders")
        .select("*, restaurant_order_items(*)")
        .eq("id", orderId)
        .eq("business_id", businessId)
        .maybeSingle(),
      getRestaurantTables(businessId),
    ]);

    if (error || !order) {
      return null;
    }

    const tableMap = new Map<string, string>();
    for (const tbl of tables) {
      tableMap.set(tbl.id, tbl.name_or_number);
    }

    const items = Array.isArray(order.restaurant_order_items) ? order.restaurant_order_items : [];
    const tableName = order.table_id ? tableMap.get(order.table_id) || "Mesa" : null;

    return {
      id: order.id,
      business_id: order.business_id,
      order_number: order.order_number,
      status: order.status,
      order_type: order.order_type,
      channel_origin: order.channel_origin,
      subtotal: Number(order.subtotal || 0),
      delivery_fee: Number(order.delivery_fee || 0),
      total: Number(order.total || 0),
      notes: order.notes || null,
      table_id: order.table_id || null,
      tableName,
      customer_name: order.customer_name || null,
      customer_phone: order.customer_phone || null,
      delivery_address: order.delivery_address || null,
      delivery_reference: order.delivery_reference || null,
      delivery_status: order.delivery_status || null,
      driver_name: order.driver_name || null,
      payment_status: order.payment_status || "pending",
      idempotency_key: order.idempotency_key || null,
      idempotency_hash: order.idempotency_hash || null,
      created_by: order.created_by || null,
      created_at: order.created_at,
      updated_at: order.updated_at,
      itemsCount: items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0),
      items,
    };
  } catch (err) {
    console.error("[getRestaurantOrderWithDetails] Error:", err);
    return null;
  }
}

/**
 * Actualiza el estado operativo de un pedido aplicando la máquina de estados válida.
 */
export async function updateRestaurantOrderStatus(
  businessId: string,
  orderId: string,
  newStatus: string,
  userId?: string
): Promise<{ success: boolean; error?: string; order?: RestaurantOrderWithDetails }> {
  const supabase = await getDbClient();

  // 1. Obtener pedido actual validando aislamiento multi-tenant
  const currentOrder = await getRestaurantOrderWithDetails(businessId, orderId);
  if (!currentOrder) {
    return { success: false, error: "Pedido no encontrado o no pertenece a este comercio." };
  }

  // Si ya tiene el estado solicitado, retornar éxito idempotente
  if (currentOrder.status === newStatus) {
    return { success: true, order: currentOrder };
  }

  // 2. Validar que la transición esté expresamente permitida
  const allowedTransitions = VALID_ORDER_STATUS_TRANSITIONS[currentOrder.status] || [];
  if (!allowedTransitions.includes(newStatus)) {
    const statusLabels: Record<string, string> = {
      received: "Recibido",
      in_preparation: "En preparación",
      ready: "Listo",
      delivered: "Entregado",
      cancelled: "Cancelado",
    };
    return {
      success: false,
      error: `Transición no permitida: un pedido en estado '${statusLabels[currentOrder.status] || currentOrder.status}' no puede cambiar a '${statusLabels[newStatus] || newStatus}'.`,
    };
  }

  // 3. Persistir actualización de estado en PostgreSQL
  const { data: updated, error: updateErr } = await supabase
    .from("restaurant_orders")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("business_id", businessId)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return {
      success: false,
      error: updateErr?.message || "No fue posible actualizar el estado del pedido.",
    };
  }

  const refreshed = await getRestaurantOrderWithDetails(businessId, orderId);
  return {
    success: true,
    order: refreshed || undefined,
  };
}

/**
 * Cancela operativamente un pedido registrando el cambio de estado de forma segura.
 */
export async function cancelRestaurantOrder(
  businessId: string,
  orderId: string,
  reason?: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  const res = await updateRestaurantOrderStatus(businessId, orderId, "cancelled", userId);
  return { success: res.success, error: res.error };
}

