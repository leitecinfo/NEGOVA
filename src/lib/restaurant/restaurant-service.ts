import crypto from "crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
// Dynamic import of createClient inside getDbClient to avoid next/headers leakage
import { logAuditAction } from "@/lib/audit/audit-service";
import {
  RestaurantRoom,
  CreateRestaurantRoomInput,
  CreateRestaurantRoomSchema,
  RestaurantRoomWithTables,
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
  ProcessOrderPaymentInput,
  PRESET_TABLE_DISCOUNTS,
  OrderFinancialBreakdown,
  TableSalesAndTipsReport,
  KdsTimeAlertConfig,
  DEFAULT_KDS_TIME_ALERTS,
  getKdsAlertLevel,
  OpenTicketDetails,
  OpenTicketsSummary,
  KdsOpenTicketsResponse,
} from "./types";
import { Product, ProductModifierGroup, ProductVariant, getEffectiveVariantIngredients } from "../products/types";
import { calculateItemTax } from "../pos/types";
import { extractDeliveryVerification } from "@/lib/delivery/delivery-service";

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
export async function getDbClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const { createClient } = await import("../supabase/server");
  return await createClient();
}

// ==========================================
// SALAS DE RESTAURANTE (restaurant_rooms) [MES-001]
// ==========================================

export async function getRestaurantRooms(businessId: string): Promise<RestaurantRoom[]> {
  try {
    const supabase = await getDbClient();
    const { data, error } = await supabase
      .from("restaurant_rooms")
      .select("*")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.warn("[getRestaurantRooms] Error:", error.message);
      return [];
    }

    return (data || []) as RestaurantRoom[];
  } catch (err) {
    console.warn("[getRestaurantRooms] Error de conexión:", err);
    return [];
  }
}

export async function getRestaurantRoomsWithTables(
  businessId: string
): Promise<RestaurantRoomWithTables[]> {
  try {
    const [rooms, tables] = await Promise.all([
      getRestaurantRooms(businessId),
      getRestaurantTables(businessId),
    ]);

    return rooms.map((room) => {
      const roomTables = tables.filter((t) => t.room_id === room.id);
      const available = roomTables.filter((t) => t.status === "available").length;
      const occupied = roomTables.filter((t) => t.status === "occupied").length;

      return {
        ...room,
        tablesCount: roomTables.length,
        availableTablesCount: available,
        occupiedTablesCount: occupied,
      };
    });
  } catch (err) {
    console.error("[getRestaurantRoomsWithTables] Error:", err);
    return [];
  }
}

export async function createRestaurantRoom(
  businessId: string,
  input: CreateRestaurantRoomInput
): Promise<{ success: boolean; room?: RestaurantRoom; error?: string }> {
  const parsed = CreateRestaurantRoomSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos de sala inválidos." };
  }

  const cleanName = parsed.data.name.trim();
  const supabase = await getDbClient();

  try {
    // Validar nombre único dentro del comercio
    const { data: existing } = await supabase
      .from("restaurant_rooms")
      .select("id")
      .eq("business_id", businessId)
      .ilike("name", cleanName)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: `Ya existe una sala con el nombre «${cleanName}» en este comercio.`,
      };
    }

    const { data: newRoom, error } = await supabase
      .from("restaurant_rooms")
      .insert({
        business_id: businessId,
        location_id: parsed.data.location_id || null,
        name: cleanName,
        description: parsed.data.description || null,
        status: parsed.data.status || "active",
        sort_order: parsed.data.sort_order || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !newRoom) {
      return {
        success: false,
        error: error?.message || "No fue posible registrar la sala.",
      };
    }

    return { success: true, room: newRoom as RestaurantRoom };
  } catch (err: any) {
    console.error("[createRestaurantRoom] Error:", err);
    return { success: false, error: err?.message || "Error al crear la sala." };
  }
}

export async function updateRestaurantRoom(
  businessId: string,
  roomId: string,
  input: { name?: string; description?: string; status?: "active" | "inactive" }
): Promise<{ success: boolean; room?: RestaurantRoom; error?: string }> {
  try {
    const supabase = await getDbClient();
    const payload: any = { updated_at: new Date().toISOString() };
    if (input.name) payload.name = input.name.trim();
    if (input.description !== undefined) payload.description = input.description ? input.description.trim() : null;
    if (input.status) payload.status = input.status;

    const { data: updated, error } = await supabase
      .from("restaurant_rooms")
      .update(payload)
      .eq("id", roomId)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (error || !updated) {
      return { success: false, error: error?.message || "No se pudo actualizar la sala." };
    }
    return { success: true, room: updated as RestaurantRoom };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar sala." };
  }
}

export async function deleteRestaurantRoom(
  businessId: string,
  roomId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getDbClient();

    // Validar si tiene mesas asignadas
    const { data: tables } = await supabase
      .from("restaurant_tables")
      .select("id")
      .eq("business_id", businessId)
      .eq("room_id", roomId);

    if (tables && tables.length > 0) {
      return {
        success: false,
        error: `No puedes eliminar esta sala porque tiene ${tables.length} mesas asignadas. Reasigna o elimina las mesas primero.`,
      };
    }

    const { error } = await supabase
      .from("restaurant_rooms")
      .delete()
      .eq("id", roomId)
      .eq("business_id", businessId);

    if (error) {
      return { success: false, error: error.message || "Error al eliminar sala." };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al eliminar sala." };
  }
}

export async function getRestaurantTableTransfersHistory(
  businessId: string
): Promise<Array<{
  id: string;
  sourceTableName: string;
  targetTableName: string;
  orderNumber?: number;
  userName?: string;
  transferredAt: string;
  notes?: string;
}>> {
  try {
    const supabase = await getDbClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, metadata, created_at, user_id")
      .eq("business_id", businessId)
      .eq("action", "update")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    const transfers: Array<{
      id: string;
      sourceTableName: string;
      targetTableName: string;
      orderNumber?: number;
      userName?: string;
      transferredAt: string;
      notes?: string;
    }> = [];

    for (const row of data) {
      const meta = row.metadata as any;
      if (meta?.original_action === "transfer_restaurant_table") {
        transfers.push({
          id: row.id,
          sourceTableName: meta.source_table_name || "Mesa origen",
          targetTableName: meta.target_table_name || "Mesa destino",
          orderNumber: meta.order_number,
          transferredAt: row.created_at,
          notes: meta.notes,
        });
      }
    }

    return transfers;
  } catch {
    return [];
  }
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

    // Consultar salas para enriquecer el nombre de la sala
    const rooms = await getRestaurantRooms(businessId).catch(() => [] as RestaurantRoom[]);
    const roomsMap = new Map<string, string>(rooms.map((r) => [r.id, r.name]));

    return tables.map((tbl) => {
      const activeOrder = tbl.current_order_id ? ordersMap.get(tbl.current_order_id) || null : null;
      return {
        ...tbl,
        activeOrder,
        roomName: tbl.room_id ? roomsMap.get(tbl.room_id) || null : null,
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
        room_id: input.room_id || null,
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

    if (input.room_id !== undefined) {
      updates.room_id = input.room_id || null;
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

    // Consultar todos los pedidos asociados a esta mesa que no estén cancelados
    const { data: activeOrders, error: ordersErr } = await supabase
      .from("restaurant_orders")
      .select("id, order_number, status, payment_status")
      .eq("table_id", tableId)
      .eq("business_id", businessId)
      .neq("status", "cancelled");

    if (ordersErr) {
      console.error("[releaseRestaurantTable] Error querying table orders:", ordersErr);
      return { success: false, error: "Error al verificar las comandas de la mesa." };
    }

    if (activeOrders && activeOrders.length > 0) {
      // 1. Validar que ninguna comanda esté aún en cocina o preparación
      const undelivered = activeOrders.find((o) => o.status !== "delivered");
      if (undelivered) {
        const statusLabels: Record<string, string> = {
          received: "recibida",
          in_preparation: "en preparación",
          ready: "lista para entrega",
        };
        const statusLabel = statusLabels[undelivered.status] || undelivered.status;
        return {
          success: false,
          error: `No se puede liberar la mesa «${table.name_or_number}»: la comanda #${undelivered.order_number} aún no ha sido entregada (está ${statusLabel}). Debes completarla o cancelarla antes de liberar la mesa.`,
        };
      }

      // 2. Validar que ninguna comanda tenga cobro pendiente
      const unpaid = activeOrders.find((o) => o.payment_status !== "paid");
      if (unpaid) {
        return {
          success: false,
          error: `No se puede liberar la mesa «${table.name_or_number}»: la comanda #${unpaid.order_number} tiene el pago pendiente. Registra el pago en Ventas o Caja antes de liberar la mesa.`,
        };
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

/**
 * [MES-002] Traslada el pedido activo de una mesa ocupada (`sourceTableId`) a una mesa libre (`targetTableId`).
 * - Mueve `current_order_id` a la mesa destino y marca la mesa destino como `occupied`.
 * - Libera la mesa origen (`status = 'available'`, `current_order_id = null`).
 * - Actualiza `table_id` en el pedido (`restaurant_orders`) conservando intactos todos sus ítems y estado.
 * - Registra la operación en `audit_logs`.
 */
export async function transferRestaurantTable(
  businessId: string,
  sourceTableId: string,
  targetTableId: string,
  options?: {
    userId?: string | null;
    notes?: string | null;
  }
): Promise<{
  success: boolean;
  sourceTable?: RestaurantTable;
  targetTable?: RestaurantTable;
  order?: RestaurantOrderWithDetails | null;
  error?: string;
}> {
  if (!sourceTableId || !targetTableId) {
    return {
      success: false,
      error: "Debe seleccionar la mesa de origen y la mesa de destino.",
    };
  }

  if (sourceTableId === targetTableId) {
    return {
      success: false,
      error: "La mesa de destino debe ser distinta a la mesa de origen.",
    };
  }

  const supabase = await getDbClient();
  const nowIso = new Date().toISOString();

  try {
    // 1. Consultar mesa de origen y mesa de destino validando aislamiento multi-tenant
    const [{ data: sourceTable, error: srcErr }, { data: targetTable, error: tgtErr }] =
      await Promise.all([
        supabase
          .from("restaurant_tables")
          .select("*")
          .eq("id", sourceTableId)
          .eq("business_id", businessId)
          .maybeSingle(),
        supabase
          .from("restaurant_tables")
          .select("*")
          .eq("id", targetTableId)
          .eq("business_id", businessId)
          .maybeSingle(),
      ]);

    if (srcErr || !sourceTable) {
      return {
        success: false,
        error: "La mesa de origen no existe o no pertenece a este comercio.",
      };
    }

    if (tgtErr || !targetTable) {
      return {
        success: false,
        error: "La mesa de destino no existe o no pertenece a este comercio.",
      };
    }

    // 2. Validar que la mesa de origen esté ocupada y tenga un pedido activo
    let activeOrderId: string | null = sourceTable.current_order_id || null;
    if (!activeOrderId) {
      const { data: fallbackOrders } = await supabase
        .from("restaurant_orders")
        .select("id, status")
        .eq("table_id", sourceTableId)
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .neq("status", "delivered")
        .order("created_at", { ascending: false })
        .limit(1);

      if (fallbackOrders && fallbackOrders.length > 0) {
        activeOrderId = fallbackOrders[0].id;
      }
    }

    if (sourceTable.status !== "occupied" || !activeOrderId) {
      return {
        success: false,
        error: `La mesa de origen «${sourceTable.name_or_number}» no está ocupada o no tiene un pedido activo para trasladar.`,
      };
    }

    // 3. Validar que la mesa de destino esté libre
    if (targetTable.status !== "available" || targetTable.current_order_id) {
      return {
        success: false,
        error: `La mesa de destino «${targetTable.name_or_number}» no se encuentra libre.`,
      };
    }

    // 4. Actualizar table_id en el pedido activo (conservando intactos todos sus ítems y estado)
    const { data: orderData, error: orderUpdateErr } = await supabase
      .from("restaurant_orders")
      .update({
        table_id: targetTableId,
        updated_at: nowIso,
      })
      .eq("id", activeOrderId)
      .eq("business_id", businessId)
      .select("*, restaurant_order_items(*)")
      .single();

    if (orderUpdateErr || !orderData) {
      return {
        success: false,
        error: orderUpdateErr?.message || "No fue posible actualizar la mesa del pedido activo.",
      };
    }

    // También trasladar cualquier otra comanda activa en curso vinculada a la mesa de origen
    try {
      await supabase
        .from("restaurant_orders")
        .update({
          table_id: targetTableId,
          updated_at: nowIso,
        })
        .eq("table_id", sourceTableId)
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .neq("status", "delivered");
    } catch {
      // Continuar
    }

    // 5. Liberar la mesa de origen y ocupar la mesa de destino con el current_order_id
    const { data: updatedSource, error: updateSrcErr } = await supabase
      .from("restaurant_tables")
      .update({
        status: "available",
        current_order_id: null,
        updated_at: nowIso,
      })
      .eq("id", sourceTableId)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (updateSrcErr || !updatedSource) {
      return {
        success: false,
        error: updateSrcErr?.message || "No fue posible liberar la mesa de origen.",
      };
    }

    const { data: updatedTarget, error: updateTgtErr } = await supabase
      .from("restaurant_tables")
      .update({
        status: "occupied",
        current_order_id: activeOrderId,
        updated_at: nowIso,
      })
      .eq("id", targetTableId)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (updateTgtErr || !updatedTarget) {
      return {
        success: false,
        error: updateTgtErr?.message || "No fue posible ocupar la mesa de destino.",
      };
    }

    // 6. Registrar en audit_logs
    const cleanNotes = options?.notes?.trim() || null;
    try {
      await supabase.from("audit_logs").insert({
        business_id: businessId,
        user_id: options?.userId || null,
        action: "table.transfer",
        entity: "restaurant_table",
        entity_type: "restaurant_table",
        entity_id: sourceTableId,
        details: {
          source_table_id: sourceTableId,
          source_table_name: sourceTable.name_or_number,
          target_table_id: targetTableId,
          target_table_name: targetTable.name_or_number,
          order_id: activeOrderId,
          order_number: orderData.order_number,
          notes: cleanNotes,
          transferred_at: nowIso,
        },
        metadata: {
          original_action: "transfer_restaurant_table",
          source_table_id: sourceTableId,
          source_table_name: sourceTable.name_or_number,
          target_table_id: targetTableId,
          target_table_name: targetTable.name_or_number,
          order_id: activeOrderId,
          order_number: orderData.order_number,
          notes: cleanNotes,
          transferred_at: nowIso,
        },
        created_at: nowIso,
      });
    } catch (auditErr) {
      console.warn("[transferRestaurantTable] Aviso al insertar en audit_logs:", auditErr);
    }

    try {
      await logAuditAction({
        businessId,
        userId: options?.userId || undefined,
        action: "update",
        entityType: "restaurant_table",
        entityId: sourceTableId,
        oldData: {
          table_id: sourceTableId,
          table_name: sourceTable.name_or_number,
          current_order_id: activeOrderId,
        },
        newData: {
          table_id: targetTableId,
          table_name: targetTable.name_or_number,
          current_order_id: activeOrderId,
        },
        metadata: {
          original_action: "transfer_restaurant_table",
          source_table_id: sourceTableId,
          source_table_name: sourceTable.name_or_number,
          target_table_id: targetTableId,
          target_table_name: targetTable.name_or_number,
          order_id: activeOrderId,
          order_number: orderData.order_number,
          notes: cleanNotes,
        },
      });
    } catch {
      // No bloqueante
    }

    const refreshedOrder = await getRestaurantOrderWithDetails(businessId, activeOrderId);

    return {
      success: true,
      sourceTable: updatedSource as RestaurantTable,
      targetTable: updatedTarget as RestaurantTable,
      order: refreshedOrder,
    };
  } catch (err: any) {
    console.error("[transferRestaurantTable] Error:", err);
    return {
      success: false,
      error: err?.message || "Error inesperado al trasladar la mesa.",
    };
  }
}

/**
 * Regenera el código QR de una mesa incrementando su versión de revocación.
 */
export async function regenerateTableQr(
  businessId: string,
  tableId: string
): Promise<{ success: boolean; newVersion?: number; error?: string }> {
  const supabase = await getDbClient();
  try {
    const { data: table, error: findErr } = await supabase
      .from("restaurant_tables")
      .select("id, qr_version, qr_is_active")
      .eq("id", tableId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (findErr || !table) {
      return { success: false, error: "Mesa no encontrada." };
    }

    const nextVersion = ((table as any).qr_version || 1) + 1;

    // Intentamos actualizar qr_version y activar qr_is_active
    const { error: updateErr } = await supabase
      .from("restaurant_tables")
      .update({
        qr_version: nextVersion,
        qr_is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tableId)
      .eq("business_id", businessId);

    if (updateErr) {
      // Si la columna aún no existiera en una BD no migrada, no bloqueamos el flujo
      console.warn("[regenerateTableQr] Actualización de qr_version falló (posible columna pendiente):", updateErr.message);
      return { success: true, newVersion: nextVersion };
    }

    return { success: true, newVersion: nextVersion };
  } catch (err: any) {
    console.error("[regenerateTableQr] Error:", err);
    return { success: false, error: err?.message || "Error al regenerar código QR." };
  }
}

/**
 * Activa o desactiva el acceso por código QR a una mesa específica.
 */
export async function toggleTableQrActive(
  businessId: string,
  tableId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();
  try {
    const { error } = await supabase
      .from("restaurant_tables")
      .update({
        qr_is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tableId)
      .eq("business_id", businessId);

    if (error) {
      console.warn("[toggleTableQrActive] Error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[toggleTableQrActive] Error:", err);
    return { success: false, error: err?.message || "Error al alternar estado del QR." };
  }
}

/**
 * Valida de forma estricta en el servidor que un token de QR pertenezca al negocio,
 * corresponda a una mesa existente, activa y con la versión de rotación válida.
 */
export async function validateTableQrAccess(
  businessId: string,
  tableId: string,
  token: string
): Promise<{
  valid: boolean;
  table?: {
    id: string;
    name_or_number: string;
    status: string;
    capacity: number | null;
  };
  error?: string;
}> {
  if (!businessId || !tableId || !token) {
    return { valid: false, error: "Parámetros de mesa o token incompletos." };
  }

  try {
    const supabase = await getDbClient();
    const { data: table, error: findErr } = await supabase
      .from("restaurant_tables")
      .select("id, business_id, name_or_number, status, capacity")
      .eq("id", tableId)
      .eq("business_id", businessId)
      .maybeSingle();

    console.log('[DEBUG DB TABLE QUERY]', { tableId, businessId, table, findErr });

    if (findErr || !table) {
      return { valid: false, error: "La mesa no pertenece a este comercio o no existe." };
    }

    if ((table as any).status === "inactive") {
      return { valid: false, error: "La mesa se encuentra inactiva." };
    }

    if ((table as any).qr_is_active === false) {
      return { valid: false, error: "El acceso por código QR está deshabilitado para esta mesa." };
    }

    const { verifyTableQrToken } = await import("./table-qr-service");
    const currentVersion = (table as any).qr_version || 1;
    const isTokenValid = verifyTableQrToken(businessId, tableId, token, currentVersion);

    if (!isTokenValid) {
      return { valid: false, error: "Código QR inválido, caducado o revocado. Solicita un nuevo código al personal." };
    }

    return {
      valid: true,
      table: {
        id: table.id,
        name_or_number: table.name_or_number,
        status: table.status,
        capacity: table.capacity,
      },
    };
  } catch (err: any) {
    console.error("[validateTableQrAccess] Error:", err);
    return { valid: false, error: "Error al validar acceso de mesa." };
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
  deliveryPin?: string | null;
  trackingCode?: string | null;
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
  userId?: string,
  supabaseClient?: any
): Promise<CreateOrderResult> {
  const supabase = supabaseClient || (await getDbClient());

  // 1. Validación de destino y canal
  if (!["dine_in", "takeout", "delivery"].includes(input.orderType)) {
    return { success: false, error: "Destino de pedido inválido. Debe ser Mesa, Para llevar o Domicilio." };
  }

  // Resolver canal de origen preservando digital_menu y whatsapp según corresponda
  const resolvedChannelOrigin = input.channelOrigin === "digital_menu"
    ? "digital_menu"
    : (input.channelOrigin === "whatsapp" && input.orderType !== "dine_in"
        ? "whatsapp"
        : (input.orderType === "dine_in" ? "in_person" : (input.channelOrigin || "in_person")));

  if (!["in_person", "whatsapp", "digital_menu"].includes(resolvedChannelOrigin)) {
    return { success: false, error: "Canal de entrada inválido. Debe ser Presencial, WhatsApp o Menú Digital." };
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
  dbProducts.forEach((p: any) => productMap.set(p.id, p as Product));

  // 5. Recalcular importes, validar complementos y construir snapshots
  interface PreparedItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes?: string;
    modifiers: any[];
    variantId?: string | null;
    variantName?: string | null;
    taxPercentage: number;
    taxIncludedInPrice: boolean;
    taxAmount: number;
  }

  const preparedItems: PreparedItem[] = [];
  let calculatedSubtotal = 0;
  let calculatedAdditionalTax = 0;
  let calculatedTotalTax = 0;

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

    // Validar existencias únicamente si el producto tiene control de inventario activado
    const trackStock = Boolean((product.metadata as any)?.track_stock);
    const availableStock = typeof (product.metadata as any)?.stock_quantity === "number"
      ? (product.metadata as any).stock_quantity
      : null;

    if (trackStock && availableStock !== null && safeQty > availableStock) {
      return {
        success: false,
        error: `Existencias insuficientes para «${product.name}». Disponibles: ${availableStock}, solicitadas: ${safeQty}.`,
      };
    }

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

    // Calcular impuestos por producto (IVA / Impoconsumo)
    const taxPercentage = typeof it.taxPercentage === "number"
      ? it.taxPercentage
      : Number((product.metadata as any)?.tax_percentage ?? (product as any).tax_percentage ?? 0);
    const taxIncludedInPrice = typeof it.taxIncludedInPrice === "boolean"
      ? it.taxIncludedInPrice
      : ((product.metadata as any)?.tax_included_in_price ?? (product as any).tax_included_in_price ?? true);

    const { taxAmount } = calculateItemTax(lineSubtotal, taxPercentage, taxIncludedInPrice);

    if (taxPercentage > 0) {
      if (!taxIncludedInPrice) {
        calculatedAdditionalTax += taxAmount;
      }
      calculatedTotalTax += taxAmount;
    }

    preparedItems.push({
      productId: product.id,
      productName: resolvedProductName,
      quantity: safeQty,
      unitPrice,
      subtotal: lineSubtotal,
      notes: it.notes?.trim() || undefined,
      modifiers: validatedModifiersSnapshot,
      variantId: selectedVariant?.id || it.variantId || null,
      variantName: selectedVariant?.name || it.variantName || null,
      taxPercentage,
      taxIncludedInPrice,
      taxAmount,
    });
  }

  // Resolver tarifa de domicilio si aplica y está configurada
  let calculatedDeliveryFee = 0;
  if (input.orderType === "delivery") {
    try {
      // 1. Priorizar configuración oficial en businesses.settings.delivery [DOM-002]
      const { data: bizData } = await supabase
        .from("businesses")
        .select("settings")
        .eq("id", businessId)
        .maybeSingle();

      const rawDelivery = (bizData?.settings as any)?.delivery;
      const { normalizeDeliveryBusinessConfig, calculateDeliveryFeeForOrder } = await import("@/lib/delivery/types");
      const deliveryConfig = normalizeDeliveryBusinessConfig(rawDelivery);

      if (typeof input.deliveryFee === "number" && !isNaN(input.deliveryFee) && input.deliveryFee >= 0) {
        calculatedDeliveryFee = input.deliveryFee;
      } else {
        const feeResult = calculateDeliveryFeeForOrder(deliveryConfig, calculatedSubtotal);
        calculatedDeliveryFee = feeResult.customerDeliveryFee;
      }
    } catch (feeErr) {
      console.warn("[createRestaurantOrder] No fue posible consultar deliveryFee configurado:", feeErr);
      if (typeof input.deliveryFee === "number" && !isNaN(input.deliveryFee)) {
        calculatedDeliveryFee = input.deliveryFee;
      }
    }
  }

  const calculatedTotal = calculatedSubtotal + calculatedDeliveryFee + calculatedAdditionalTax;
  const payloadHash = computeOrderPayloadHash(input);

  // Generar código de verificación aleatorio para pedidos a domicilio (PIN criptográfico de 4 dígitos exactos, permite ceros iniciales)
  // y código de seguimiento único tipo TRK-XXXXXX para consulta pública del cliente [DOM-004]
  let finalNotes = input.notes?.trim() || null;
  let generatedDeliveryPin: string | null = null;
  let generatedTrackingCode: string | null = null;
  if (input.orderType === "delivery") {
    const crypto = await import("crypto");
    const pinNumber = crypto.randomInt(0, 10000);
    generatedDeliveryPin = pinNumber.toString().padStart(4, "0");

    const { generateTrackingCode } = await import("@/lib/delivery/tracking-service");
    generatedTrackingCode = generateTrackingCode();

    const pinTag = `[PIN:${generatedDeliveryPin}:0]`;
    const trkTag = `[TRK:${generatedTrackingCode}]`;
    const driverTag = input.driverName?.trim() ? `[DOMICILIARIO:${input.driverName.trim()}]` : "";
    
    finalNotes = [finalNotes, pinTag, trkTag, driverTag].filter(Boolean).join(" ");
  } else if (input.waiterName?.trim()) {
    const waiterTag = `[CAMARERO:${input.waiterName.trim()}]`;
    finalNotes = finalNotes ? `${finalNotes} ${waiterTag}` : waiterTag;
  }

  // 6. Inserción verdaderamente transaccional vía PostgreSQL RPC
  // Garantiza atomicidad total sin requerir DELETE compensatorio, serializa ordenes por tenant
  // y detecta discrepancia de contenido ante reintentos de idempotencyKey.
  let rpcData: any;
  let rpcError: any;

  const rpcResult = await supabase.rpc(
    "create_restaurant_pos_order",
    {
      p_business_id: businessId,
      p_order_type: input.orderType,
      p_channel_origin: resolvedChannelOrigin,
      p_subtotal: calculatedSubtotal,
      p_delivery_fee: calculatedDeliveryFee,
      p_tax_total: calculatedTotalTax,
      p_total: calculatedTotal,
      p_items: preparedItems.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.subtotal,
        notes: item.notes || null,
        modifiers: item.modifiers,
        variant_id: item.variantId || null,
        variant_name: item.variantName || null,
        tax_percentage: item.taxPercentage,
        tax_included_in_price: item.taxIncludedInPrice,
        tax_amount: item.taxAmount,
      })),
      p_table_id: input.orderType === "dine_in" ? input.tableId : null,
      p_customer_name: ["delivery", "takeout"].includes(input.orderType)
        ? input.customerName?.trim() || (input.orderType === "delivery" ? "Cliente Domicilio" : null)
        : null,
      p_customer_phone: ["delivery", "takeout"].includes(input.orderType) ? input.customerPhone?.trim() || null : null,
      p_delivery_address: input.orderType === "delivery" ? input.deliveryAddress?.trim() : null,
      p_delivery_reference: input.orderType === "delivery" ? input.deliveryReference?.trim() || null : null,
      p_notes: finalNotes,
      p_idempotency_key: input.idempotencyKey || null,
      p_idempotency_hash: payloadHash,
      p_user_id: userId || null,
    }
  );
  rpcData = rpcResult.data;
  rpcError = rpcResult.error;

  // Fallback defensivo: si la base de datos remota/local no tiene aún la migración con 'digital_menu',
  // reintentar de forma transparente con 'whatsapp' (o 'in_person' para consumo en mesa).
  if (rpcError && rpcError.message?.includes("INVALID_CHANNEL") && resolvedChannelOrigin === "digital_menu") {
    const fallbackChannel = input.orderType === "dine_in" ? "in_person" : "whatsapp";
    const retryResult = await supabase.rpc(
      "create_restaurant_pos_order",
      {
        p_business_id: businessId,
        p_order_type: input.orderType,
        p_channel_origin: fallbackChannel,
        p_subtotal: calculatedSubtotal,
        p_delivery_fee: calculatedDeliveryFee,
        p_tax_total: calculatedTotalTax,
        p_total: calculatedTotal,
        p_items: preparedItems.map((item) => ({
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
          notes: item.notes || null,
          modifiers: item.modifiers,
          variant_id: item.variantId || null,
          variant_name: item.variantName || null,
          tax_percentage: item.taxPercentage,
          tax_included_in_price: item.taxIncludedInPrice,
          tax_amount: item.taxAmount,
        })),
        p_table_id: input.orderType === "dine_in" ? input.tableId : null,
        p_customer_name: ["delivery", "takeout"].includes(input.orderType)
          ? input.customerName?.trim() || (input.orderType === "delivery" ? "Cliente Domicilio" : null)
          : null,
        p_customer_phone: ["delivery", "takeout"].includes(input.orderType) ? input.customerPhone?.trim() || null : null,
        p_delivery_address: input.orderType === "delivery" ? input.deliveryAddress?.trim() : null,
        p_delivery_reference: input.orderType === "delivery" ? input.deliveryReference?.trim() || null : null,
        p_notes: finalNotes,
        p_idempotency_key: input.idempotencyKey || null,
        p_idempotency_hash: payloadHash,
        p_user_id: userId || null,
      }
    );
    rpcData = retryResult.data;
    rpcError = retryResult.error;
  }

  // Fallback defensivo: si la firma en el schema cache de PostgREST no incluye 'p_tax_total' (versión de 16 parámetros)
  if (
    rpcError &&
    (rpcError.message?.includes("schema cache") || rpcError.code === "PGRST202") &&
    rpcError.message?.includes("create_restaurant_pos_order")
  ) {
    console.warn("[createRestaurantOrder] Reintentando RPC con firma heredada de 16 parámetros (sin p_tax_total)...");
    const legacyRetry = await supabase.rpc(
      "create_restaurant_pos_order",
      {
        p_business_id: businessId,
        p_order_type: input.orderType,
        p_channel_origin: resolvedChannelOrigin === "digital_menu" ? "whatsapp" : resolvedChannelOrigin,
        p_subtotal: calculatedSubtotal,
        p_delivery_fee: calculatedDeliveryFee,
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
        p_customer_name: ["delivery", "takeout"].includes(input.orderType)
          ? input.customerName?.trim() || (input.orderType === "delivery" ? "Cliente Domicilio" : null)
          : null,
        p_customer_phone: ["delivery", "takeout"].includes(input.orderType) ? input.customerPhone?.trim() || null : null,
        p_delivery_address: input.orderType === "delivery" ? input.deliveryAddress?.trim() : null,
        p_delivery_reference: input.orderType === "delivery" ? input.deliveryReference?.trim() || null : null,
        p_notes: finalNotes,
        p_idempotency_key: input.idempotencyKey || null,
        p_idempotency_hash: payloadHash,
        p_user_id: userId || null,
      }
    );
    if (!legacyRetry.error) {
      rpcData = legacyRetry.data;
      rpcError = null;
    }
  }

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

    if (rpcError.message?.includes("Existencias insuficientes para")) {
      const match = rpcError.message.match(/Existencias insuficientes para[^\n\r]+/);
      return {
        success: false,
        error: match ? match[0] : rpcError.message,
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

  // Garantizar que la orden tenga estado inicial 'received' en caso de que la RPC haya insertado 'pending'
  try {
    const orderQuery = supabase.from("restaurant_orders");
    if (typeof (orderQuery as any)?.update === "function") {
      await (orderQuery as any)
        .update({
          status: "received",
          updated_at: new Date().toISOString(),
        })
        .eq("id", rpcData.order_id)
        .eq("status", "pending")
        .eq("business_id", businessId);
    }
  } catch (statErr) {
    console.warn("[createRestaurantOrder] Advertencia al normalizar status a received:", statErr);
  }

  // [STOCK-001]: El descuento de existencias (tanto en public.inventory_stock como en
  // public.products.metadata) se ejecuta de forma transaccional y atómica dentro de la RPC
  // PostgreSQL 'create_restaurant_pos_order', garantizando que nunca quede un pedido sin
  // descuento de inventario ni descuento sin pedido por caídas de red intermedias.

  // Si el pedido es a domicilio, inicializar delivery_status (o assigned si tiene conductor) y persistir tracking_code [DOM-004]
  if (input.orderType === "delivery") {
    try {
      const orderQuery = supabase.from("restaurant_orders");
      if (typeof (orderQuery as any)?.update === "function") {
        await (orderQuery as any)
          .update({
            delivery_status: input.driverName?.trim() ? "assigned" : "pending",
            driver_name: input.driverName?.trim() || null,
            delivery_zone_id: input.deliveryZoneId || null,
            tracking_code: generatedTrackingCode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rpcData.order_id)
          .eq("business_id", businessId);
      }
    } catch (dErr) {
      console.warn("[createRestaurantOrder] Advertencia al inicializar delivery_status:", dErr);
    }
  } else if (input.orderType === "dine_in" && input.waiterName?.trim()) {
    try {
      const orderQuery = supabase.from("restaurant_orders");
      if (typeof (orderQuery as any)?.update === "function") {
        await (orderQuery as any)
          .update({
            driver_name: input.waiterName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", rpcData.order_id)
          .eq("business_id", businessId);
      }
    } catch (wErr) {
      console.warn("[createRestaurantOrder] Advertencia al asociar camarero en comanda:", wErr);
    }
  }

  // Si se especificó un cliente registrado, vincular customer_id al pedido [POS-003]
  if (input.customerId) {
    try {
      const orderQuery = supabase.from("restaurant_orders");
      if (typeof (orderQuery as any)?.update === "function") {
        await (orderQuery as any)
          .update({
            customer_id: input.customerId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rpcData.order_id)
          .eq("business_id", businessId);
      }
    } catch (cErr) {
      console.warn("[createRestaurantOrder] Advertencia al vincular customer_id:", cErr);
    }
  }

  // Preparar y encolar notificación asíncrona hacia el WhatsApp del negocio (sin bloquear la creación)
  // REGLA CRÍTICA: Solo para modalidades "takeout" (Recogida) y "delivery" (Domicilio).
  // Los pedidos "dine_in" (En mesa) se gestionan exclusivamente en el panel interno de Pedidos y Cocina de NEGOVA.
  if (input.orderType !== "dine_in") {
    try {
      const { enqueueOrderWhatsAppNotification } = await import("@/lib/whatsapp/order-notifications");
      await enqueueOrderWhatsAppNotification(supabase, businessId, {
        orderId: rpcData.order_id,
        orderNumber: rpcData.order_number,
        total: Number(rpcData.total),
        orderType: input.orderType,
        channelOrigin: resolvedChannelOrigin,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveryAddress: input.deliveryAddress,
        deliveryReference: input.deliveryReference,
        notes: input.notes,
        items: preparedItems.map((p) => ({
          productName: p.productName,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          subtotal: p.subtotal,
        })),
      });
    } catch (notifErr) {
      console.warn("[createRestaurantOrder] Advertencia al preparar notificación WhatsApp:", notifErr);
    }
  }

  // Registrar notificación persistente in-app para el comercio
  try {
    const { createOrderNotification } = await import("@/lib/notifications/notifications-service");
    await createOrderNotification({
      businessId,
      orderId: rpcData.order_id,
      orderNumber: rpcData.order_number,
      orderType: input.orderType,
      customerName: input.customerName || null,
      total: Number(rpcData.total),
    });
  } catch (inAppErr) {
    console.warn("[createRestaurantOrder] Advertencia al generar notificación in-app:", inAppErr);
  }

  return {
    success: true,
    orderId: rpcData.order_id,
    orderNumber: rpcData.order_number,
    total: Number(rpcData.total),
    deliveryPin: generatedDeliveryPin,
    trackingCode: generatedTrackingCode,
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
      .select("*, restaurant_order_items(id, product_name, quantity, unit_price, subtotal, notes, modifiers, variant_id, variant_name)", {
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
      const verification = extractDeliveryVerification(row.notes);

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
        notes: verification.cleanNotes,
        table_id: row.table_id || null,
        tableName,
        customer_name: row.customer_name || null,
        customer_phone: row.customer_phone || null,
        delivery_address: row.delivery_address || null,
        delivery_reference: row.delivery_reference || null,
        delivery_status: row.delivery_status || null,
        driver_name: row.driver_name || null,
        delivery_verification_code: verification.code,
        delivery_verification_attempts: verification.attempts,
        payment_status: row.payment_status || "pending",
        idempotency_key: row.idempotency_key || null,
        idempotency_hash: row.idempotency_hash || null,
        created_by: row.created_by || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        itemsCount: items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0),
        items,
        deliveryVerificationCode: verification.code,
        deliveryVerificationAttempts: verification.attempts,
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
      if (order.status === "received" || order.status === "pending") summary.received++;
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
    const { data: order, error } = await supabase
      .from("restaurant_orders")
      .select("*, restaurant_order_items(*)")
      .eq("id", orderId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error || !order) {
      return null;
    }

    let tableName: string | null = null;
    if (order.table_id) {
      const { data: tableData } = await supabase
        .from("restaurant_tables")
        .select("name_or_number")
        .eq("id", order.table_id)
        .eq("business_id", businessId)
        .maybeSingle();
      tableName = tableData?.name_or_number || "Mesa";
    }

    const items = Array.isArray(order.restaurant_order_items) ? order.restaurant_order_items : [];
    const verification = extractDeliveryVerification(order.notes);

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
      notes: verification.cleanNotes,
      table_id: order.table_id || null,
      tableName,
      customer_id: order.customer_id || null,
      customer_name: order.customer_name || null,
      customer_phone: order.customer_phone || null,
      delivery_address: order.delivery_address || null,
      delivery_reference: order.delivery_reference || null,
      delivery_status: order.delivery_status || null,
      driver_name: order.driver_name || null,
      delivery_verification_code: verification.code,
      delivery_verification_attempts: verification.attempts,
      payment_status: order.payment_status || "pending",
      idempotency_key: order.idempotency_key || null,
      idempotency_hash: order.idempotency_hash || null,
      created_by: order.created_by || null,
      created_at: order.created_at,
      updated_at: order.updated_at,
      itemsCount: items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0),
      items,
      deliveryVerificationCode: verification.code,
      deliveryVerificationAttempts: verification.attempts,
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
  userId?: string,
  reason?: string
): Promise<{ success: boolean; error?: string; order?: RestaurantOrderWithDetails }> {
  const supabase = await getDbClient();

  // 1. Obtener pedido actual validando aislamiento multi-tenant
  const currentOrder = await getRestaurantOrderWithDetails(businessId, orderId);
  if (!currentOrder) {
    return { success: false, error: "Pedido no encontrado o no pertenece a este comercio." };
  }

  // Si ya tiene el estado solicitado, retornar éxito idempotente
  if (currentOrder.status === newStatus) {
    if (newStatus === "delivered" || newStatus === "cancelled") {
      await syncTableOccupancyAfterOrderChange(supabase, businessId, orderId, currentOrder.table_id);
    }
    return { success: true, order: currentOrder };
  }

  // 2. Validar que la transición esté expresamente permitida
  const allowedTransitions = VALID_ORDER_STATUS_TRANSITIONS[currentOrder.status] || [];
  if (!allowedTransitions.includes(newStatus)) {
    const statusLabels: Record<string, string> = {
      pending: "Recibido",
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

  // 4. Liberación / sincronización automática de mesas asociadas al pedido
  await syncTableOccupancyAfterOrderChange(supabase, businessId, orderId, currentOrder.table_id);

  // Si el pedido pasa a cancelado, cancelar automáticamente el documento de venta vinculado
  if (newStatus === "cancelled") {
    try {
      const fromBsd = supabase.from("business_sale_documents");
      if (fromBsd && typeof fromBsd.select === "function") {
        const { data: linkedDoc } = await fromBsd
          .select("id, status, notes")
          .eq("business_id", businessId)
          .eq("restaurant_order_id", orderId)
          .maybeSingle();

        if (linkedDoc && linkedDoc.status !== "cancelled" && linkedDoc.status !== "annulled") {
          const reasonText = reason?.trim();
          const updatedNotes = reasonText
            ? linkedDoc.notes
              ? `${linkedDoc.notes} | Cancelación: ${reasonText}`
              : `Cancelación: ${reasonText}`
            : linkedDoc.notes;

          await fromBsd
            .update({
              status: "cancelled",
              notes: updatedNotes,
              updated_at: new Date().toISOString(),
            })
            .eq("id", linkedDoc.id)
            .eq("business_id", businessId);
        }
      }
    } catch (docErr) {
      console.warn("[updateRestaurantOrderStatus] Aviso al cancelar documento de venta vinculado:", docErr);
    }
  }

  const refreshed = await getRestaurantOrderWithDetails(businessId, orderId);
  return {
    success: true,
    order: refreshed || undefined,
  };
}

/**
 * Sincroniza y actualiza la ocupación de las mesas asociadas a un pedido
 * tras una transición de estado operativo (ej. al entregarse o cancelarse).
 * 
 * Reglas de negocio e invariantes:
 * 1. Identifica todas las mesas involucradas (table_id directo y cualquier mesa con current_order_id = orderId).
 * 2. Para cada mesa, consulta sus pedidos activos (aquellos con status != 'delivered' y status != 'cancelled').
 * 3. Si no quedan pedidos activos, la mesa se libera automáticamente (status = 'available', current_order_id = null).
 * 4. Si aún existen pedidos activos, la mesa se conserva ocupada (status = 'occupied') y current_order_id
 *    se enlaza al pedido activo prioritario (el más antiguo).
 * 5. No modifica payment_status ni genera transacciones o asientos financieros.
 * 6. Es 100% idempotente y tolera pedidos sin mesa (takeout/delivery).
 */
export async function syncTableOccupancyAfterOrderChange(
  supabase: any,
  businessId: string,
  orderId: string,
  directTableId?: string | null
): Promise<void> {
  try {
    const tableIdsToEvaluate = new Set<string>();

    if (directTableId) {
      tableIdsToEvaluate.add(directTableId);
    }

    // Identificar cualquier mesa cuyo current_order_id apunte a este pedido
    const tblQuery = supabase?.from?.("restaurant_tables");
    if (tblQuery && typeof tblQuery.select === "function") {
      const { data: linkedTables } = await tblQuery
        .select("id")
        .eq("current_order_id", orderId)
        .eq("business_id", businessId);

      if (linkedTables && Array.isArray(linkedTables)) {
        for (const tbl of linkedTables) {
          if (tbl?.id) tableIdsToEvaluate.add(tbl.id);
        }
      }
    }

    if (tableIdsToEvaluate.size === 0) {
      return; // Pedido sin mesa asociada (ej. takeout o delivery)
    }

    const nowIso = new Date().toISOString();

    for (const tableId of tableIdsToEvaluate) {
      // Consultar todas las comandas de esta mesa para este comercio
      const ordersQuery = supabase.from("restaurant_orders");
      const { data: tableOrders, error: ordersErr } = await ordersQuery
        .select("id, status, payment_status, created_at, order_number")
        .eq("table_id", tableId)
        .eq("business_id", businessId);

      if (ordersErr) {
        console.warn(`[syncTableOccupancyAfterOrderChange] Error al verificar comandas de mesa ${tableId}:`, ordersErr);
        continue;
      }

      // Filtrar comandas activas que aún requieren mantener ocupada la mesa:
      // Aquellas no entregadas ni canceladas (ej. 'received', 'in_preparation', 'ready')
      const activeOrders = (tableOrders || []).filter(
        (o: any) => o.status !== "delivered" && o.status !== "cancelled"
      );

      if (activeOrders.length === 0) {
        // No quedan pedidos activos: LIBERAR LA MESA AUTOMÁTICAMENTE
        if (typeof tblQuery?.update === "function") {
          await tblQuery
            .update({
              status: "available",
              current_order_id: null,
              updated_at: nowIso,
            })
            .eq("id", tableId)
            .eq("business_id", businessId);
        }
      } else {
        // Quedan otras comandas activas en la misma mesa: CONSERVAR OCUPADA
        // Ordenar por created_at para vincular el pedido activo más antiguo
        activeOrders.sort((a: any, b: any) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateA - dateB;
        });
        const nextActive = activeOrders[0];

        if (typeof tblQuery?.update === "function") {
          await tblQuery
            .update({
              status: "occupied",
              current_order_id: nextActive.id,
              updated_at: nowIso,
            })
            .eq("id", tableId)
            .eq("business_id", businessId);
        }
      }
    }
  } catch (err) {
    console.warn("[syncTableOccupancyAfterOrderChange] Error al sincronizar ocupación de mesa:", err);
  }
}

/**
 * Cancela operativamente un pedido registrando el cambio de estado de forma segura.
 * Sincroniza automáticamente la mesa asociada mediante syncTableOccupancyAfterOrderChange.
 */
export async function cancelRestaurantOrder(
  businessId: string,
  orderId: string,
  reason?: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();
  const currentOrder = await getRestaurantOrderWithDetails(businessId, orderId);
  if (!currentOrder) {
    return { success: false, error: "Pedido no encontrado o no pertenece a este comercio." };
  }

  const res = await updateRestaurantOrderStatus(businessId, orderId, "cancelled", userId, reason);
  if (!res.success) {
    return { success: false, error: res.error };
  }

  // Cancelar también el documento de venta comercial vinculado si existe
  try {
    const fromBsd = supabase.from("business_sale_documents");
    if (fromBsd && typeof fromBsd.select === "function") {
      const { data: linkedDoc } = await fromBsd
        .select("id, status, notes")
        .eq("business_id", businessId)
        .eq("restaurant_order_id", orderId)
        .maybeSingle();

      if (linkedDoc && linkedDoc.status !== "cancelled" && linkedDoc.status !== "annulled") {
        const reasonText = reason?.trim();
        const updatedNotes = reasonText
          ? linkedDoc.notes
            ? `${linkedDoc.notes} | Cancelación: ${reasonText}`
            : `Cancelación: ${reasonText}`
          : linkedDoc.notes;

        await fromBsd
          .update({
            status: "cancelled",
            notes: updatedNotes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDoc.id)
          .eq("business_id", businessId);
      }
    }
  } catch (docCancelErr) {
    console.warn("[cancelRestaurantOrder] Aviso al sincronizar cancelación de documento:", docCancelErr);
  }

  // Asegurar sincronización de mesas vinculadas
  await syncTableOccupancyAfterOrderChange(supabase, businessId, orderId, currentOrder.table_id);

  return { success: true };
}

/**
 * Registra el pago real de un pedido operativo (actualiza payment_status a 'paid').
 * Emite / vincula automáticamente el documento comercial unificado en `business_sale_documents`
 * con correlativo secuencial determinista e idempotencia estricta.
 */
export async function registerRestaurantOrderPayment(
  businessId: string,
  orderId: string,
  paymentInput?: string | ProcessOrderPaymentInput,
  userId?: string
): Promise<{
  success: boolean;
  error?: string;
  order?: RestaurantOrderWithDetails;
  document?: any;
  summary?: {
    subtotal: number;
    discountAmount: number;
    netSaleTotal: number;
    tipAmount: number;
    totalCollected: number;
  };
}> {
  const supabase = await getDbClient();
  const currentOrder = await getRestaurantOrderWithDetails(businessId, orderId);
  if (!currentOrder) {
    return { success: false, error: "Pedido no encontrado o no pertenece a este comercio." };
  }
  if (currentOrder.status === "cancelled") {
    return { success: false, error: "No se puede registrar pago para un pedido cancelado." };
  }

  // Normalizar entrada de pago [POS-002 & MES-003]
  const paymentData: ProcessOrderPaymentInput =
    typeof paymentInput === "string"
      ? { paymentMethod: paymentInput }
      : (paymentInput || { paymentMethod: "cash" });

  const primaryMethod = paymentData.paymentMethod || (paymentData.splitPayments?.[0]?.method) || "cash";

  // Calcular descuento y monto neto [POS-002 & MES-003]
  const originalSubtotal = Number(currentOrder.subtotal || currentOrder.total || 0);
  const taxTotal = Number(currentOrder.tax_total || 0);
  const deliveryFee = Number(currentOrder.delivery_fee || 0);

  let discountAmount = 0;
  let discountReason = paymentData.discount?.reason;

  if (paymentData.loyaltyDiscountAmount && paymentData.loyaltyDiscountAmount > 0) {
    discountAmount += Number(paymentData.loyaltyDiscountAmount);
    discountReason = discountReason
      ? `${discountReason} + Puntos Fidelización`
      : "Puntos Fidelización";
  }

  if (paymentData.discount) {
    if (paymentData.discount.presetId) {
      const preset = PRESET_TABLE_DISCOUNTS.find((p) => p.id === paymentData.discount?.presetId);
      if (preset) {
        if (!discountReason) discountReason = preset.reason;
        if (!paymentData.discount.amount && (!paymentData.discount.value || paymentData.discount.value <= 0)) {
          paymentData.discount.value = preset.percentage;
          paymentData.discount.type = "percentage";
        }
      }
    }

    if (paymentData.discount.amount && paymentData.discount.amount > 0) {
      discountAmount = Math.min(originalSubtotal, Number(paymentData.discount.amount));
    } else if (paymentData.discount.type === "percentage" && paymentData.discount.value > 0) {
      const pct = Math.min(100, Number(paymentData.discount.value));
      discountAmount = Math.round(originalSubtotal * (pct / 100));
    } else if (paymentData.discount.type === "fixed" && paymentData.discount.value > 0) {
      discountAmount = Math.min(originalSubtotal, Number(paymentData.discount.value));
    }
  }

  // El descuento reduce el total antes del pago
  const netSaleTotal = Math.max(0, originalSubtotal - discountAmount + taxTotal + deliveryFee);

  // Calcular propina separada de la venta neta [POS-002 & MES-003]
  let tipAmount = 0;
  if (paymentData.tip) {
    if (paymentData.tip.amount && paymentData.tip.amount > 0) {
      tipAmount = Number(paymentData.tip.amount);
    } else if (paymentData.tip.percentage && paymentData.tip.percentage > 0) {
      tipAmount = Math.round(netSaleTotal * (Number(paymentData.tip.percentage) / 100));
    }
  }

  // Construir desglose en notas
  const noteParts: string[] = [];
  if (currentOrder.notes) noteParts.push(currentOrder.notes);
  if (discountAmount > 0) {
    noteParts.push(`Descuento: -$${discountAmount}${discountReason ? ` (${discountReason})` : ""}`);
  }
  if (paymentData.loyaltyPointsRedeemed && paymentData.loyaltyPointsRedeemed > 0) {
    noteParts.push(`Puntos Redimidos: ${paymentData.loyaltyPointsRedeemed} (-$${paymentData.loyaltyDiscountAmount || 0})`);
  }
  if (tipAmount > 0) {
    noteParts.push(
      `Propina: +$${tipAmount}${paymentData.tip?.percentage ? ` (${paymentData.tip.percentage}%)` : ""}`
    );
  }
  if (paymentData.isSplit && paymentData.splitPayments && paymentData.splitPayments.length > 0) {
    const splitDesc = paymentData.splitPayments.map((p) => `${p.method}: $${p.amount}`).join(" + ");
    noteParts.push(`Pago dividido: ${splitDesc}`);
  }
  if (paymentData.cashChange && paymentData.cashChange > 0) {
    noteParts.push(`Cambio efectivo: $${paymentData.cashChange}`);
  }
  const consolidatedNotes = noteParts.filter(Boolean).join(" | ");

  // Verificar si ya existe documento de venta emitido para este pedido
  const { data: existingDoc } = await supabase
    .from("business_sale_documents")
    .select("*")
    .eq("business_id", businessId)
    .eq("restaurant_order_id", orderId)
    .maybeSingle();

  // Idempotencia: si ya está pagado o a crédito y ya tiene documento de venta emitido, no duplicar
  if ((currentOrder.payment_status === "paid" || currentOrder.payment_status === "credit") && existingDoc) {
    if (paymentData.closeTableOrder) {
      await supabase
        .from("restaurant_orders")
        .update({ status: "delivered", updated_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("business_id", businessId);
      await syncTableOccupancyAfterOrderChange(supabase, businessId, orderId, currentOrder.table_id);
    }
    const refreshedIdemp = await getRestaurantOrderWithDetails(businessId, orderId);
    return {
      success: true,
      order: refreshedIdemp || currentOrder,
      document: existingDoc,
      summary: {
        subtotal: originalSubtotal,
        discountAmount,
        netSaleTotal,
        tipAmount,
        totalCollected: netSaleTotal + tipAmount,
      },
    };
  }

  // [POS-003] Validación de venta a crédito
  const isCreditSale =
    primaryMethod.toLowerCase() === "credit" ||
    primaryMethod.toLowerCase() === "a_credito" ||
    primaryMethod.toLowerCase() === "a crédito";

  let targetCustomer: any = null;

  if (isCreditSale) {
    let targetCustomerId = paymentData.customerId || currentOrder.customer_id;

    if (!targetCustomerId && currentOrder.customer_phone) {
      const { data: matchedCust } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", businessId)
        .eq("phone", currentOrder.customer_phone)
        .maybeSingle();
      if (matchedCust) {
        targetCustomerId = matchedCust.id;
        targetCustomer = matchedCust;
      }
    }

    if (!targetCustomerId) {
      return {
        success: false,
        error: "Para registrar una venta a crédito debes seleccionar un cliente registrado con crédito habilitado.",
      };
    }

    if (!targetCustomer) {
      const { data: cust, error: custErr } = await supabase
        .from("customers")
        .select("*")
        .eq("id", targetCustomerId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (custErr || !cust) {
        return {
          success: false,
          error: "El cliente seleccionado no existe o no pertenece a este comercio.",
        };
      }
      targetCustomer = cust;
    }

    const creditLimit = Number(targetCustomer.credit_limit || 0);
    const creditUsed = Number(targetCustomer.credit_used || 0);
    const availableCredit = Math.max(0, Number((creditLimit - creditUsed).toFixed(2)));

    // Criterio 1: Al seleccionar "A crédito" con cliente sin crédito -> error
    if (creditLimit <= 0) {
      return {
        success: false,
        error: `El cliente «${targetCustomer.full_name}» no tiene cupo de crédito autorizado.`,
      };
    }

    // Criterio 2: Al superar el límite -> error con saldo disponible
    if (netSaleTotal > availableCredit) {
      return {
        success: false,
        error: `Cupo de crédito insuficiente. Disponible: $${availableCredit.toLocaleString("es-CO")}, solicitado: $${netSaleTotal.toLocaleString("es-CO")}.`,
      };
    }
  }

  // 1. Actualizar estado del pedido restaurant_orders
  const newPaymentStatus = isCreditSale ? "credit" : "paid";
  const orderUpdatePayload: Record<string, any> = {
    payment_status: newPaymentStatus,
    customer_id: targetCustomer?.id || currentOrder.customer_id || null,
    total: netSaleTotal,
    notes: consolidatedNotes || null,
    updated_at: new Date().toISOString(),
  };

  if (paymentData.closeTableOrder) {
    orderUpdatePayload.status = "delivered";
  }

  const { error: updateErr } = await supabase
    .from("restaurant_orders")
    .update(orderUpdatePayload)
    .eq("id", orderId)
    .eq("business_id", businessId);

  if (updateErr) {
    return { success: false, error: updateErr.message || "Error al registrar el pago del pedido." };
  }

  // [MES-003] Si es cierre de orden de mesa, liberar automáticamente la mesa asociada
  if (paymentData.closeTableOrder) {
    await syncTableOccupancyAfterOrderChange(supabase, businessId, orderId, currentOrder.table_id);
    if (currentOrder.table_id) {
      const tblRef = supabase.from("restaurant_tables");
      if (tblRef && typeof tblRef.update === "function") {
        await tblRef
          .update({
            status: "available",
            current_order_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentOrder.table_id)
          .eq("business_id", businessId);
      }
    }
  }

  // 2. Crear o vincular documento de venta unificado en business_sale_documents
  let saleDoc = existingDoc;
  if (!saleDoc) {
    try {
      const { createBusinessSaleDocument } = await import("@/lib/documents/document-service");

      const rawOrderItems = currentOrder.items || (currentOrder as any).restaurant_order_items || [];
      const mappedItems = rawOrderItems.map((it: any) => {
        let desc = it.product_name || (it as any).productName;
        if (it.notes) desc += ` (${it.notes})`;
        return {
          id: it.id,
          productId: it.product_id || undefined,
          description: desc,
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unit_price || 0),
          discount: 0,
          total: Number(it.subtotal || 0),
        };
      });

      if (Number(currentOrder.delivery_fee || 0) > 0) {
        mappedItems.push({
          id: `fee-${currentOrder.id}`,
          description: "Costo de Domicilio / Envío",
          quantity: 1,
          unitPrice: Number(currentOrder.delivery_fee),
          discount: 0,
          total: Number(currentOrder.delivery_fee),
        });
      }

      if (mappedItems.length === 0 && Number(netSaleTotal) > 0) {
        mappedItems.push({
          id: `item-${currentOrder.id}`,
          description: `Consumo Comanda #${currentOrder.order_number}`,
          quantity: 1,
          unitPrice: Number(netSaleTotal),
          discount: 0,
          total: Number(netSaleTotal),
        });
      }

      const validMethod =
        isCreditSale
          ? "credit"
          : paymentData.isSplit
          ? "other"
          : primaryMethod === "card" || primaryMethod === "credit"
          ? "card"
          : primaryMethod === "transfer"
          ? "transfer"
          : primaryMethod === "other"
          ? "other"
          : "cash";

      const docRes = await createBusinessSaleDocument(businessId, {
        customerName: targetCustomer?.full_name || currentOrder.customer_name?.trim() || "Consumidor Final",
        customerId: targetCustomer?.id || currentOrder.customer_id || null,
        customerPhone: targetCustomer?.phone || currentOrder.customer_phone?.trim() || null,
        customerAddress: currentOrder.delivery_address?.trim() || null,
        documentType: "order",
        items: mappedItems,
        discountTotal: discountAmount,
        total: netSaleTotal,
        paymentMethod: validMethod as any,
        status: isCreditSale ? "pending" : "paid",
        notes: consolidatedNotes || null,
        restaurantOrderId: orderId,
        userId: userId || null,
      });

      if (docRes.success && docRes.document) {
        saleDoc = docRes.document;
      }
    } catch (docErr) {
      console.error("[registerRestaurantOrderPayment] Error creando documento de venta unificado:", docErr);
    }
  }

  // 2.1 [POS-003] Si es venta a crédito: Crear cuenta por cobrar en accounts_receivable e incrementar credit_used
  if (isCreditSale && targetCustomer) {
    try {
      let dueDateIso = paymentData.creditDueDate;
      if (!dueDateIso) {
        const dueDays = typeof paymentData.creditDueDays === "number" && paymentData.creditDueDays > 0 ? paymentData.creditDueDays : 30;
        const target = new Date();
        target.setDate(target.getDate() + dueDays);
        dueDateIso = target.toISOString();
      }

      const nowIso = new Date().toISOString();
      const { error: arErr } = await supabase
        .from("accounts_receivable")
        .insert({
          business_id: businessId,
          customer_id: targetCustomer.id,
          order_id: orderId,
          sale_document_id: saleDoc?.id || null,
          amount: netSaleTotal,
          paid_amount: 0,
          balance: netSaleTotal,
          due_date: dueDateIso,
          status: "pending",
          notes: `Venta a crédito POS - Pedido #${currentOrder.order_number}`,
          created_by: userId || null,
          created_at: nowIso,
          updated_at: nowIso,
        });

      if (arErr) {
        console.error("[registerRestaurantOrderPayment] Error creando cuenta por cobrar:", arErr);
      }

      // Incrementar credit_used del cliente
      const currentUsed = Number(targetCustomer.credit_used || 0);
      const newCreditUsed = Number((currentUsed + netSaleTotal).toFixed(2));
      await supabase
        .from("customers")
        .update({
          credit_used: newCreditUsed,
          updated_at: nowIso,
        })
        .eq("id", targetCustomer.id)
        .eq("business_id", businessId);
    } catch (arEx) {
      console.error("[registerRestaurantOrderPayment] Excepción gestionando crédito:", arEx);
    }
  }

  // 2.2 [FID-001] Gestión de Puntos de Fidelización (acumulación y redención)
  try {
    let loyaltyCustomer = targetCustomer;
    const effectiveCustomerId = paymentData.customerId || currentOrder.customer_id;
    if (!loyaltyCustomer && effectiveCustomerId) {
      const { data: cust } = await supabase
        .from("customers")
        .select("id, full_name, phone")
        .eq("id", effectiveCustomerId)
        .eq("business_id", businessId)
        .maybeSingle();
      loyaltyCustomer = cust;
    }

    if (loyaltyCustomer?.id) {
      const {
        getLoyaltyProgramConfig,
        redeemLoyaltyPoints,
        calculatePointsEarned,
        accumulateLoyaltyPoints,
      } = await import("@/lib/loyalty/loyalty-service");

      const loyaltyCfg = await getLoyaltyProgramConfig(businessId);

      // Redención de puntos si se aplicaron al pago
      if (paymentData.loyaltyPointsRedeemed && paymentData.loyaltyPointsRedeemed > 0) {
        await redeemLoyaltyPoints(
          businessId,
          loyaltyCustomer.id,
          paymentData.loyaltyPointsRedeemed,
          orderId,
          "order",
          `Redención en Pedido #${currentOrder.order_number}`,
          userId
        );
      }

      // Acumulación de puntos por el valor neto de la compra
      if (loyaltyCfg.enabled && netSaleTotal > 0) {
        const pointsEarned = calculatePointsEarned(netSaleTotal, loyaltyCfg);
        if (pointsEarned > 0) {
          await accumulateLoyaltyPoints(
            businessId,
            loyaltyCustomer.id,
            pointsEarned,
            orderId,
            "order",
            `Puntos por compra Pedido #${currentOrder.order_number} ($${netSaleTotal.toLocaleString("es-CO")})`,
            userId
          );
        }
      }
    }
  } catch (loyaltyEx) {
    console.warn("[registerRestaurantOrderPayment] Error en puntos de fidelización:", loyaltyEx);
  }

  // 3. Registrar cash_movements por cada método de pago [POS-001 & POS-002 & MES-003]
  // [POS-003] REGLA ESTRICTA: La venta a crédito NO suma al efectivo del turno.
  try {
    const { getActiveCashSession, recordCashMovement } = await import("@/lib/cash/cash-service");
    const activeSession = await getActiveCashSession(businessId);
    if (activeSession) {
      const paymentsToRecord =
        paymentData.isSplit && paymentData.splitPayments && paymentData.splitPayments.length > 0
          ? paymentData.splitPayments
          : [{ method: primaryMethod, amount: netSaleTotal + tipAmount }];

      for (const p of paymentsToRecord) {
        const amt = Number(p.amount);
        if (amt > 0) {
          const mLower = (p.method || "").toLowerCase();
          // Criterio 3: La venta a crédito NO genera movimiento de caja de efectivo
          if (mLower === "credit" || mLower === "a_credito" || mLower === "a crédito") {
            continue;
          }

          let mType: "sale_cash" | "sale_card" | "sale_digital" = "sale_digital";
          if (mLower === "cash" || mLower === "efectivo") {
            mType = "sale_cash";
          } else if (mLower === "card" || mLower === "tarjeta" || mLower === "datafono") {
            mType = "sale_card";
          }

          await recordCashMovement(
            businessId,
            {
              sessionId: activeSession.id,
              movementType: mType,
              amount: amt,
              referenceId: orderId,
              referenceType: "order",
              notes: `Cobro Pedido #${currentOrder.order_number} [${p.method.toUpperCase()}]`,
            },
            userId
          );
        }
      }
    }
  } catch (cashErr) {
    console.error("[registerRestaurantOrderPayment] Error registrando movimientos de caja:", cashErr);
  }

  // 4. Registrar auditoría de la transacción financiera
  try {
    await logAuditAction({
      businessId,
      userId: userId || null,
      action: "payment_registered",
      entityType: "restaurant_order",
      entityId: orderId,
      metadata: {
        orderNumber: currentOrder.order_number,
        total: netSaleTotal,
        discountAmount,
        tipAmount,
        isSplit: Boolean(paymentData.isSplit),
        paymentMethod: primaryMethod,
        splitPayments: paymentData.splitPayments || null,
        saleDocumentId: saleDoc?.id || null,
        saleDocumentNumber: saleDoc?.documentNumber || saleDoc?.document_number || null,
      },
    });
  } catch (auditErr) {
    console.warn("[registerRestaurantOrderPayment] Error registrando auditoría:", auditErr);
  }

  const refreshed = await getRestaurantOrderWithDetails(businessId, orderId);
  return {
    success: true,
    order: refreshed || undefined,
    document: saleDoc || undefined,
    summary: {
      subtotal: originalSubtotal,
      discountAmount,
      netSaleTotal,
      tipAmount,
      totalCollected: netSaleTotal + tipAmount,
    },
  };
}

/**
 * [MES-003] Completa el cobro de una mesa (descuentos preestablecidos o personalizados,
 * propina voluntaria 5%, 10%, 15% o personalizada, pago único o mixto).
 * Al confirmar:
 * - El pedido queda en estado `delivered` + `paid` (o `credit`).
 * - La mesa queda automáticamente libre (`status = 'available'`, `current_order_id = null`).
 * - La propina se registra separada de la venta neta en los reportes.
 */
export async function closeTableOrderWithPayment(
  businessId: string,
  tableId: string,
  paymentInput: string | ProcessOrderPaymentInput,
  userId?: string
): Promise<{
  success: boolean;
  error?: string;
  table?: RestaurantTable;
  order?: RestaurantOrderWithDetails;
  document?: any;
  summary?: {
    subtotal: number;
    discountAmount: number;
    netSaleTotal: number;
    tipAmount: number;
    totalCollected: number;
  };
}> {
  if (!tableId) {
    return { success: false, error: "Debes seleccionar una mesa para cobrar." };
  }

  const supabase = await getDbClient();

  try {
    // 1. Consultar la mesa validando aislamiento multi-tenant
    const { data: table, error: tblErr } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("id", tableId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (tblErr || !table) {
      return { success: false, error: "Mesa no encontrada o no pertenece a este comercio." };
    }

    // 2. Identificar la comanda activa de la mesa
    let targetOrderId: string | null = table.current_order_id || null;

    if (!targetOrderId) {
      const { data: tableOrders } = await supabase
        .from("restaurant_orders")
        .select("id, status, payment_status, created_at")
        .eq("table_id", tableId)
        .eq("business_id", businessId);

      const openOrder = (tableOrders || []).find(
        (o: any) => o.status !== "cancelled" && (o.payment_status !== "paid" || o.status !== "delivered")
      );
      if (openOrder) {
        targetOrderId = openOrder.id;
      }
    }

    if (!targetOrderId) {
      return {
        success: false,
        error: `La mesa «${table.name_or_number}» no tiene una orden activa pendiente de cobro.`,
      };
    }

    // 3. Normalizar input y activar closeTableOrder = true
    const normalizedInput: ProcessOrderPaymentInput =
      typeof paymentInput === "string"
        ? { paymentMethod: paymentInput, closeTableOrder: true }
        : { ...paymentInput, closeTableOrder: true };

    // 4. Validar cobertura en pago mixto/dividido si aplica
    if (
      normalizedInput.isSplit &&
      (!normalizedInput.splitPayments || normalizedInput.splitPayments.length === 0)
    ) {
      return {
        success: false,
        error: "Debes especificar al menos un método de pago para el pago dividido.",
      };
    }

    const payRes = await registerRestaurantOrderPayment(
      businessId,
      targetOrderId,
      normalizedInput,
      userId
    );

    if (!payRes.success) {
      return { success: false, error: payRes.error };
    }

    // 5. Garantizar que la mesa quede liberada en restaurant_tables
    const nowIso = new Date().toISOString();
    const tblRef = supabase.from("restaurant_tables");
    if (tblRef && typeof tblRef.update === "function") {
      await tblRef
        .update({
          status: "available",
          current_order_id: null,
          updated_at: nowIso,
        })
        .eq("id", tableId)
        .eq("business_id", businessId);
    }

    const { data: refreshedTable } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("id", tableId)
      .eq("business_id", businessId)
      .maybeSingle();

    const finalTable: RestaurantTable = (refreshedTable as RestaurantTable) || {
      ...table,
      status: "available",
      current_order_id: null,
      updated_at: nowIso,
    };

    return {
      success: true,
      table: finalTable,
      order: payRes.order,
      document: payRes.document,
      summary: payRes.summary,
    };
  } catch (err: any) {
    console.error("[closeTableOrderWithPayment] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al procesar el cobro y cierre de la mesa.",
    };
  }
}

/**
 * [MES-003] Extrae el desglose financiero (descuento, propina separada, venta neta y total recaudado)
 * de un pedido o documento comercial.
 */
export function extractOrderFinancialBreakdown(order: any): OrderFinancialBreakdown {
  const subtotal = Number(order.subtotal || order.total || 0);
  const netSaleTotal = Number(order.total || 0);
  const notes = String(order.notes || "");

  // Extraer descuento
  let discountAmount = Number(order.discount_total || order.discountTotal || 0);
  let discountReason: string | null = null;
  const discountMatch = notes.match(/Descuento:\s*-\$?([\d.,]+)(?:\s*\(([^)]+)\))?/i);
  if (discountMatch) {
    if (!discountAmount) {
      discountAmount = Number(discountMatch[1].replace(/[.,]/g, "")) || 0;
    }
    if (discountMatch[2]) {
      discountReason = discountMatch[2].trim();
    }
  } else if (!discountAmount && subtotal > netSaleTotal) {
    discountAmount = subtotal - netSaleTotal;
  }

  // Extraer propina (registrada separada de la venta neta)
  let tipAmount = Number(order.tip_amount || order.tipAmount || 0);
  let tipPercentage: number | null = null;
  const tipMatch = notes.match(/Propina:\s*\+\$?([\d.,]+)(?:\s*\(([\d.]+)%\))?/i);
  if (tipMatch) {
    if (!tipAmount) {
      tipAmount = Number(tipMatch[1].replace(/[.,]/g, "")) || 0;
    }
    if (tipMatch[2]) {
      tipPercentage = Number(tipMatch[2]) || null;
    }
  }

  const isSplit = /Pago dividido:/i.test(notes);

  return {
    orderId: order.id,
    orderNumber: Number(order.order_number || 0),
    tableId: order.table_id || null,
    subtotal,
    discountAmount,
    discountReason,
    netSaleTotal,
    tipAmount,
    tipPercentage,
    totalCollected: netSaleTotal + tipAmount,
    isSplit,
    paymentStatus: order.payment_status || order.status || "pending",
    status: order.status || "received",
    createdAt: order.created_at || order.issued_at || new Date().toISOString(),
  };
}

/**
 * [MES-003] Genera el reporte de ventas y propinas separadas para el negocio.
 * Garantiza que `totalNetSales` contenga únicamente la venta neta y `totalTips`
 * contenga las propinas separadas para liquidación de personal y reportes contables.
 */
export async function getTableSalesAndTipsReport(
  businessId: string,
  startDate?: string,
  endDate?: string
): Promise<TableSalesAndTipsReport> {
  const supabase = await getDbClient();

  let query = supabase
    .from("restaurant_orders")
    .select("*")
    .eq("business_id", businessId);

  if (startDate && typeof query.gte === "function") {
    query = query.gte("created_at", startDate);
  }
  if (endDate && typeof query.lte === "function") {
    query = query.lte("created_at", endDate);
  }

  const { data: rawOrders } = await query;
  const validOrders = (rawOrders || []).filter(
    (o: any) =>
      o.status !== "cancelled" &&
      (o.payment_status === "paid" || o.payment_status === "credit")
  );

  let totalNetSales = 0;
  let totalTips = 0;
  let totalDiscounts = 0;
  let ordersWithTipCount = 0;
  let ordersWithDiscountCount = 0;
  const breakdowns: OrderFinancialBreakdown[] = [];

  for (const ord of validOrders) {
    const bd = extractOrderFinancialBreakdown(ord);
    totalNetSales += bd.netSaleTotal;
    totalTips += bd.tipAmount;
    totalDiscounts += bd.discountAmount;
    if (bd.tipAmount > 0) ordersWithTipCount += 1;
    if (bd.discountAmount > 0) ordersWithDiscountCount += 1;
    breakdowns.push(bd);
  }

  return {
    totalNetSales: Number(totalNetSales.toFixed(2)),
    totalTips: Number(totalTips.toFixed(2)),
    totalDiscounts: Number(totalDiscounts.toFixed(2)),
    totalCollected: Number((totalNetSales + totalTips).toFixed(2)),
    ordersCount: breakdowns.length,
    ordersWithTipCount,
    ordersWithDiscountCount,
    orders: breakdowns,
  };
}

/**
 * Consulta pedidos activos para el Monitor de Cocina (KDS) [KDS-001].
 * Retorna pedidos en estados: received, in_preparation, ready, y los más recientes delivered.
 * Ordena los pedidos activos por created_at ASC (FIFO de preparación).
 */
export async function getKdsOrders(
  businessId: string,
  limitDelivered: number = 30
): Promise<RestaurantOrderWithDetails[]> {
  const supabase = await getDbClient();

  try {
    // 1. Consultar pedidos activos y mesas en paralelo
    const [activeRes, deliveredRes, tables] = await Promise.all([
      // Pedidos activos (FIFO: más antiguos primero para atención en cocina)
      supabase
        .from("restaurant_orders")
        .select("*, restaurant_order_items(id, product_name, quantity, unit_price, subtotal, notes, modifiers, variant_id, variant_name)")
        .eq("business_id", businessId)
        .in("status", ["received", "in_preparation", "ready", "pending"])
        .order("created_at", { ascending: true }),

      // Pedidos entregados recientes (LIFO: más recientes primero)
      supabase
        .from("restaurant_orders")
        .select("*, restaurant_order_items(id, product_name, quantity, unit_price, subtotal, notes, modifiers, variant_id, variant_name)")
        .eq("business_id", businessId)
        .eq("status", "delivered")
        .order("updated_at", { ascending: false })
        .limit(limitDelivered),

      getRestaurantTables(businessId),
    ]);

    const rawActive = activeRes.data || [];
    const rawDelivered = deliveredRes.data || [];

    const tableMap = new Map<string, string>();
    for (const tbl of tables) {
      tableMap.set(tbl.id, tbl.name_or_number);
    }

    const formatOrder = (row: any): RestaurantOrderWithDetails => {
      const items = Array.isArray(row.restaurant_order_items) ? row.restaurant_order_items : [];
      const tableName = row.table_id ? tableMap.get(row.table_id) || "Mesa" : null;
      const verification = extractDeliveryVerification(row.notes);

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
        notes: verification.cleanNotes,
        table_id: row.table_id || null,
        tableName,
        customer_name: row.customer_name || null,
        customer_phone: row.customer_phone || null,
        delivery_address: row.delivery_address || null,
        delivery_reference: row.delivery_reference || null,
        delivery_status: row.delivery_status || null,
        driver_name: row.driver_name || null,
        delivery_verification_code: verification.code,
        delivery_verification_attempts: verification.attempts,
        payment_status: row.payment_status || "pending",
        idempotency_key: row.idempotency_key || null,
        idempotency_hash: row.idempotency_hash || null,
        created_by: row.created_by || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        itemsCount: items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0),
        items,
        deliveryVerificationCode: verification.code,
        deliveryVerificationAttempts: verification.attempts,
      };
    };

    const activeOrders = rawActive.map(formatOrder);
    const deliveredOrders = rawDelivered.map(formatOrder);

    // Combinar: activos primero (FIFO), seguidos de entregados recientes
    return [...activeOrders, ...deliveredOrders];
  } catch (err) {
    console.error("[getKdsOrders] Error consultando órdenes para KDS:", err);
    return [];
  }
}

/**
 * [KDS-002] Consulta la configuración de umbrales de alerta de tiempo para el monitor de cocina (KDS).
 * Prioriza `businesses.settings.kds_alerts`, y si no está configurada, retorna los umbrales predeterminados (15 min / 30 min).
 */
export async function getKdsAlertConfig(businessId: string): Promise<KdsTimeAlertConfig> {
  try {
    const supabase = await getDbClient();
    const { data, error } = await supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    if (!error && data?.settings && typeof data.settings === "object") {
      const cfg = (data.settings as Record<string, any>).kds_alerts;
      if (cfg && typeof cfg === "object") {
        const warningMinutes = Number(cfg.warningMinutes);
        const criticalMinutes = Number(cfg.criticalMinutes);
        if (warningMinutes > 0 && criticalMinutes > warningMinutes) {
          return { warningMinutes, criticalMinutes };
        }
      }
    }
  } catch (err) {
    console.warn("[getKdsAlertConfig] Error al consultar configuración KDS:", err);
  }
  return DEFAULT_KDS_TIME_ALERTS;
}

/**
 * [KDS-002] Actualiza y persiste la configuración de umbrales de alerta de tiempo de preparación para KDS.
 * Valida que los valores sean positivos y que `criticalMinutes > warningMinutes`.
 */
export async function saveKdsAlertConfig(
  businessId: string,
  config: KdsTimeAlertConfig
): Promise<{ success: boolean; config?: KdsTimeAlertConfig; error?: string }> {
  const warningMinutes = Math.max(1, Math.floor(Number(config?.warningMinutes) || 15));
  const criticalMinutes = Math.max(warningMinutes + 1, Math.floor(Number(config?.criticalMinutes) || 30));

  if (criticalMinutes <= warningMinutes) {
    return {
      success: false,
      error: "El umbral de alerta crítica (roja) debe ser estrictamente mayor al umbral de advertencia (amarilla).",
    };
  }

  try {
    const supabase = await getDbClient();
    const { data: biz, error: fetchErr } = await supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .single();

    if (fetchErr || !biz) {
      return { success: false, error: "Negocio no encontrado." };
    }

    const currentSettings = (biz.settings && typeof biz.settings === "object" ? biz.settings : {}) as Record<string, any>;
    const updatedSettings = {
      ...currentSettings,
      kds_alerts: {
        warningMinutes,
        criticalMinutes,
        updated_at: new Date().toISOString(),
      },
    };

    const { error: updateErr } = await supabase
      .from("businesses")
      .update({ settings: updatedSettings })
      .eq("id", businessId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return {
      success: true,
      config: { warningMinutes, criticalMinutes },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al guardar configuración de alertas KDS.",
    };
  }
}

/**
 * [KDS-003] Consulta y enriquece los tickets abiertos (no cobrados) del restaurante.
 * Filtra órdenes donde:
 *   - business_id === businessId
 *   - status !== 'cancelled'
 *   - payment_status !== 'paid'
 * Calcula KPIs consolidados:
 *   - En esta vista: total tickets y valor acumulado en COP.
 *   - Demorados: tickets que superan warningMinutes y su valor en COP.
 *   - Críticos: tickets que superan criticalMinutes y su valor en COP.
 * Enriquece cada ticket con:
 *   - Info de canal (POS, QR, Domicilio, WhatsApp)
 *   - Servicio (En mesa, Para llevar, Domicilio)
 *   - Mesa y Sala ("Mesa 4 · Salón Principal")
 *   - Cliente (nombre y teléfono)
 *   - Comensales (número de comensales o capacidad)
 *   - Cajero / creador (nombre del usuario o canal origen)
 *   - Tiempo transcurrido y nivel de alerta (normal, warning, critical)
 */
export async function getKdsOpenTickets(
  businessId: string
): Promise<KdsOpenTicketsResponse> {
  const supabase = await getDbClient();
  const alertConfig = await getKdsAlertConfig(businessId);

  try {
    // 1. Consultar en paralelo órdenes abiertas, mesas y salas
    const [ordersRes, tables, rooms] = await Promise.all([
      supabase
        .from("restaurant_orders")
        .select("*, restaurant_order_items(id, product_name, quantity, unit_price, subtotal, notes, modifiers, variant_id, variant_name)")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .neq("payment_status", "paid")
        .order("created_at", { ascending: true }),
      getRestaurantTables(businessId),
      getRestaurantRooms(businessId),
    ]);

    const rawOrders = ordersRes.data || [];

    // Mapeo de salas
    const roomsMap = new Map<string, string>();
    for (const rm of rooms) {
      roomsMap.set(rm.id, rm.name);
    }

    // Mapeo de mesas
    const tableMap = new Map<string, { name: string; roomId?: string | null; capacity?: number | null }>();
    for (const tbl of tables) {
      tableMap.set(tbl.id, {
        name: tbl.name_or_number,
        roomId: tbl.room_id || null,
        capacity: tbl.capacity || null,
      });
    }

    // Consultar nombres de cajeros / creadores a partir de `created_by`
    const userIds = Array.from(
      new Set(rawOrders.map((o: any) => o.created_by).filter((id: any): id is string => Boolean(id)))
    );
    const cashierMap = new Map<string, string>();
    if (userIds.length > 0) {
      try {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        if (profiles) {
          for (const p of profiles) {
            if (p.full_name) cashierMap.set(p.id, p.full_name);
          }
        }
      } catch (profErr) {
        console.warn("[getKdsOpenTickets] No se pudieron cargar perfiles:", profErr);
      }
    }

    // Parseador auxiliar de comensales desde notas
    const extractDiners = (notes?: string | null, tableCapacity?: number | null): number => {
      if (notes) {
        const match = notes.match(/(\d+)\s*(?:personas?|comensales?)/i);
        if (match && match[1]) {
          const parsed = parseInt(match[1], 10);
          if (parsed > 0) return parsed;
        }
      }
      if (tableCapacity && tableCapacity > 0) return tableCapacity;
      return 1;
    };

    let totalAmount = 0;
    let delayedCount = 0;
    let delayedAmount = 0;
    let criticalCount = 0;
    let criticalAmount = 0;

    const tickets: OpenTicketDetails[] = rawOrders.map((row: any) => {
      const items = Array.isArray(row.restaurant_order_items) ? row.restaurant_order_items : [];
      const tblInfo = row.table_id ? tableMap.get(row.table_id) : null;
      const tableName = tblInfo ? tblInfo.name : null;
      const roomName = tblInfo?.roomId ? roomsMap.get(tblInfo.roomId) || null : null;
      const verification = extractDeliveryVerification(row.notes);

      // Tiempo transcurrido y alerta [KDS-002]
      const { level, elapsedMinutes, elapsedFormatted } = getKdsAlertLevel(
        row.created_at,
        alertConfig
      );

      // Cajero
      let cashierName: string | null = null;
      if (row.created_by && cashierMap.has(row.created_by)) {
        cashierName = cashierMap.get(row.created_by)!;
      } else if (row.channel_origin === "digital_menu") {
        cashierName = "Menú QR (Auto-pedido)";
      } else if (row.channel_origin === "whatsapp") {
        cashierName = "Pedido Online / WhatsApp";
      } else {
        cashierName = "Caja Principal";
      }

      const total = Number(row.total || 0);
      const dinersCount = extractDiners(verification.cleanNotes, tblInfo?.capacity);

      // Acumular KPIs
      totalAmount += total;
      if (level === "critical") {
        criticalCount++;
        criticalAmount += total;
      } else if (level === "warning") {
        delayedCount++;
        delayedAmount += total;
      }

      return {
        id: row.id,
        business_id: row.business_id,
        order_number: row.order_number,
        status: row.status,
        order_type: row.order_type,
        channel_origin: row.channel_origin,
        subtotal: Number(row.subtotal || 0),
        delivery_fee: Number(row.delivery_fee || 0),
        total,
        notes: verification.cleanNotes,
        table_id: row.table_id || null,
        tableName,
        roomName,
        customer_name: row.customer_name || null,
        customer_phone: row.customer_phone || null,
        delivery_address: row.delivery_address || null,
        delivery_reference: row.delivery_reference || null,
        delivery_status: row.delivery_status || null,
        driver_name: row.driver_name || null,
        delivery_verification_code: verification.code,
        delivery_verification_attempts: verification.attempts,
        payment_status: row.payment_status || "pending",
        idempotency_key: row.idempotency_key || null,
        idempotency_hash: row.idempotency_hash || null,
        created_by: row.created_by || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        itemsCount: items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0),
        items,
        cashierName,
        dinersCount,
        elapsedMinutes,
        alertLevel: level,
        formattedElapsed: elapsedFormatted,
      };
    });

    const summary: OpenTicketsSummary = {
      totalCount: tickets.length,
      totalAmount,
      delayedCount,
      delayedAmount,
      criticalCount,
      criticalAmount,
    };

    return { tickets, summary, alertConfig };
  } catch (err) {
    console.error("[getKdsOpenTickets] Error consultando tickets abiertos:", err);
    return {
      tickets: [],
      summary: {
        totalCount: 0,
        totalAmount: 0,
        delayedCount: 0,
        delayedAmount: 0,
        criticalCount: 0,
        criticalAmount: 0,
      },
      alertConfig,
    };
  }
}





