import { createClient } from "@/lib/supabase/server";
import {
  CreateSpoilageInput,
  CreateSpoilageInputSchema,
  UpdateSpoilageInput,
  UpdateSpoilageInputSchema,
  CancelSpoilageInput,
  CancelSpoilageInputSchema,
  SpoilageFilterOptions,
  SpoilageKPIs,
  SpoilageRecord,
  SPOILAGE_CAUSE_LABELS,
  mapToDbCause,
} from "./types";
import {
  ensureDefaultLocation,
  upsertInventoryStock,
  getInventoryStock,
  checkAndTriggerLowStockNotification,
} from "@/lib/inventory/inventory-service";

/**
 * Cache en memoria para prevención de envíos duplicados / doble clic (idempotencia).
 * Expira entradas después de 15 segundos.
 */
const recentSpoilageSubmissions = new Map<string, number>();

function cleanRecentSubmissions() {
  const now = Date.now();
  for (const [key, timestamp] of recentSpoilageSubmissions.entries()) {
    if (now - timestamp > 15000) {
      recentSpoilageSubmissions.delete(key);
    }
  }
}

/**
 * Obtener cliente Supabase para operaciones del servidor autorizadas.
 */
export async function getDbClient() {
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
 * Mapea una fila cruda de la base de datos al tipo de dominio SpoilageRecord.
 */
function mapSpoilageRow(row: any): SpoilageRecord {
  const notesStr = row.notes || "";
  let customReason: string | null = null;
  if (notesStr.startsWith("Merma (Otro motivo - ")) {
    const endIdx = notesStr.indexOf("):");
    if (endIdx > 21) {
      customReason = notesStr.substring(21, endIdx);
    }
  }

  // Extraer snapshot de existencias si viene en las notas
  const prevMatch = notesStr.match(/Anterior:\s*(-?[\d.]+)/i);
  const resMatch = notesStr.match(/Resultante:\s*(-?[\d.]+)/i);

  // Detección resiliente de estado 'cancelled'
  const isCancelled =
    row.status === "cancelled" ||
    notesStr.startsWith("[ANULADA") ||
    notesStr.includes("— [ANULADA");

  let cancellationReason = row.cancellation_reason || null;
  if (!cancellationReason && isCancelled) {
    const cancelMatch = notesStr.match(/\[ANULADA(?::\s*([^\]]+))?\]/i);
    if (cancelMatch && cancelMatch[1]) {
      cancellationReason = cancelMatch[1].trim();
    }
  }

  return {
    id: row.id,
    businessId: row.business_id,
    locationId: row.location_id,
    locationName: row.locations?.name || null,
    itemType: row.item_type,
    itemId: row.item_id,
    itemName: row.item_name,
    cause: row.cause,
    customReason,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost || 0),
    totalCost: Number(row.total_cost || 0),
    notes: row.notes,
    registeredBy: row.registered_by,
    registeredByName: null,
    movementId: null,
    previousStock: prevMatch ? Number(prevMatch[1]) : null,
    resultingStock: resMatch ? Number(resMatch[1]) : null,
    date: row.date || row.created_at,
    createdAt: row.created_at,
    status: isCancelled ? "cancelled" : "active",
    cancelledAt: row.cancelled_at || null,
    cancelledBy: row.cancelled_by || null,
    cancelledByName: null,
    cancellationReason,
    updatedAt: row.updated_at || null,
  };
}

/**
 * Registra una merma de existencias con descuento único, atómico y trazable [TAREA-08].
 * 
 * Reglas de integridad estrictas:
 * 1. Valida que el artículo exista, pertenezca al negocio y no esté archivado.
 * 2. Valida que tenga control de stock activo. Excluye preparados y servicios.
 * 3. Valida que la cantidad sea > 0 y que el stock disponible sea suficiente (evita stock negativo).
 * 4. Aplica control de idempotencia para prevenir dobles registros por doble clic o reintentos de red.
 * 5. Ejecuta un ÚNICO descuento de existencias en inventory_stock.
 * 6. Registra un ÚNICO movimiento en inventory_movements con movement_type = 'spoilage' y reference_type = 'adjustment'.
 * 7. Guarda la trazabilidad con existencia anterior y resultante en el kardex y en spoilage_records.
 */
export async function createSpoilageRecord(
  businessId: string,
  input: CreateSpoilageInput,
  userId?: string | null
): Promise<SpoilageRecord & { spoilage: SpoilageRecord; movementId: string }> {
  cleanRecentSubmissions();
  const parsed = CreateSpoilageInputSchema.parse(input);

  // 1. Control de Idempotencia: evitar doble procesamiento por clics repetidos
  const idempotencyKey =
    parsed.idempotencyKey ||
    `${businessId}_${parsed.itemId}_${parsed.quantity}_${parsed.cause}_${Math.floor(Date.now() / 5000)}`;

  if (recentSpoilageSubmissions.has(idempotencyKey)) {
    throw new Error(
      "Esta merma ya se está procesando o fue enviada hace unos instantes. Espera un momento para evitar registros duplicados."
    );
  }
  recentSpoilageSubmissions.set(idempotencyKey, Date.now());

  const supabase = await getDbClient();

  // 2. Validar que el artículo exista, pertenezca al negocio y no esté archivado
  const { data: prodData, error: prodErr } = await supabase
    .from("products")
    .select("id, name, metadata, business_id, status")
    .eq("id", parsed.itemId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (prodErr || !prodData) {
    recentSpoilageSubmissions.delete(idempotencyKey);
    throw new Error("El artículo indicado no existe o no pertenece a este comercio.");
  }

  if (prodData.status === "archived") {
    recentSpoilageSubmissions.delete(idempotencyKey);
    throw new Error("No se pueden registrar mermas sobre artículos archivados.");
  }

  const meta = (prodData.metadata || {}) as Record<string, any>;

  // 3. Validar tipo de producto: preparados sin inventario físico y servicios están excluidos
  if (meta.product_type === "prepared") {
    recentSpoilageSubmissions.delete(idempotencyKey);
    throw new Error(
      "No es posible registrar mermas de productos preparados sin inventario físico terminado. Registra la pérdida sobre los ingredientes o insumos que realmente se desperdiciaron."
    );
  }

  if (meta.product_type === "service") {
    recentSpoilageSubmissions.delete(idempotencyKey);
    throw new Error("Los servicios no manejan existencias físicas ni admiten mermas.");
  }

  // 4. Validar que tenga control de existencias
  const hasStockControl =
    meta.track_stock === true ||
    meta.track_stock === "true" ||
    meta.product_type === "ingredient";

  if (!hasStockControl) {
    recentSpoilageSubmissions.delete(idempotencyKey);
    throw new Error(
      `El artículo «${prodData.name}» no tiene control de existencias activado. Solo se pueden registrar mermas de artículos con control de stock.`
    );
  }

  // 5. Resolver la única ubicación física operativa del negocio
  let targetLocationId = parsed.locationId;
  if (!targetLocationId) {
    const defaultLoc = await ensureDefaultLocation(businessId);
    targetLocationId = defaultLoc.id;
  }

  // 6. Consultar existencias actuales
  const stockList = await getInventoryStock(businessId, {
    productId: parsed.itemId,
    locationId: targetLocationId,
  });
  const currentStockRow = stockList && stockList.length > 0 ? stockList[0] : null;

  const currentStock = currentStockRow
    ? Number(currentStockRow.quantity || 0)
    : Number(meta.stock_quantity ?? 0);
  const minStock = currentStockRow
    ? Number(currentStockRow.minStock || 0)
    : Number(meta.min_stock ?? 0);
  const existingCost = currentStockRow && currentStockRow.cost > 0
    ? Number(currentStockRow.cost)
    : Number(meta.cost ?? 0);

  const unit = parsed.unit || meta.unit || (meta.product_type === "ingredient" ? "kg" : "un");

  // 7. Validar disponibilidad suficiente: NO permitir stock negativo
  if (parsed.quantity > currentStock) {
    recentSpoilageSubmissions.delete(idempotencyKey);
    throw new Error(
      `Existencias insuficientes para registrar la merma de «${prodData.name}». Stock disponible actual: ${currentStock} ${unit}, solicitado para merma: ${parsed.quantity} ${unit}.`
    );
  }

  const newStock = Math.max(0, currentStock - parsed.quantity);
  const unitCost = parsed.unitCost > 0 ? parsed.unitCost : existingCost;
  const totalCost = Number((parsed.quantity * unitCost).toFixed(2));

  // 8. Formatear motivo y notas de trazabilidad
  let causeLabel = SPOILAGE_CAUSE_LABELS[parsed.cause] || parsed.cause;
  if (parsed.cause === "other" && parsed.customReason) {
    causeLabel = `Otro motivo - ${parsed.customReason.trim()}`;
  }

  const auditDetail = `(Anterior: ${currentStock}, Dif: -${parsed.quantity}, Resultante: ${newStock})`;
  const notesFormatted = [
    `Merma (${causeLabel})`,
    parsed.notes?.trim() || null,
    auditDetail,
  ]
    .filter(Boolean)
    .join(" — ");

  const spoilageId = crypto.randomUUID();
  const movementId = crypto.randomUUID();
  const now = new Date().toISOString();
  const dbCause = mapToDbCause(parsed.cause);

  // 9. EJECUCIÓN ATÓMICA: Registrar Merma + Movimiento en Kardex + Descuento Único de Stock

  // Paso A: Insertar registro formal en spoilage_records
  const { data: spoilageRecordRow, error: spoilageInsertErr } = await supabase
    .from("spoilage_records")
    .insert({
      id: spoilageId,
      business_id: businessId,
      location_id: targetLocationId,
      item_type: parsed.itemType,
      item_id: parsed.itemId,
      item_name: prodData.name,
      cause: dbCause,
      quantity: parsed.quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      notes: notesFormatted,
      registered_by: userId || null,
      date: parsed.date || now,
      created_at: now,
    })
    .select("*, locations(name)")
    .single();

  if (spoilageInsertErr || !spoilageRecordRow) {
    recentSpoilageSubmissions.delete(idempotencyKey);
    console.error("[createSpoilageRecord] Error al insertar merma:", spoilageInsertErr);
    throw new Error(`Error al registrar la merma: ${spoilageInsertErr?.message || "No se pudo guardar."}`);
  }

  // Paso B: Actualizar existencias en inventory_stock (DESCUENTO ÚNICO)
  try {
    await upsertInventoryStock(businessId, {
      productId: parsed.itemId,
      locationId: targetLocationId,
      quantity: newStock,
      minStock,
      cost: unitCost,
    });
  } catch (stockUpdateErr: any) {
    // Reversión: Eliminar registro de merma si falló la actualización de stock
    await supabase.from("spoilage_records").delete().eq("id", spoilageId);
    recentSpoilageSubmissions.delete(idempotencyKey);
    console.error("[createSpoilageRecord] Falló descuento de stock, registro revertido:", stockUpdateErr);
    throw new Error(`Error al descontar stock por merma: ${stockUpdateErr.message}`);
  }

  // Paso C: Insertar movimiento inmutable en inventory_movements (Kardex)
  // NOTA: reference_type = 'adjustment' para cumplir la restricción CHECK de PostgreSQL
  const { error: movementInsertErr } = await supabase
    .from("inventory_movements")
    .insert({
      id: movementId,
      business_id: businessId,
      product_id: parsed.itemId,
      location_id: targetLocationId,
      movement_type: "spoilage",
      quantity: parsed.quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      reference_id: spoilageId,
      reference_type: "adjustment",
      notes: notesFormatted,
      created_by: userId || null,
      created_at: now,
    });

  if (movementInsertErr) {
    // Reversión: Restaurar stock anterior y eliminar registro de merma
    await upsertInventoryStock(businessId, {
      productId: parsed.itemId,
      locationId: targetLocationId,
      quantity: currentStock,
      minStock,
      cost: existingCost,
    });
    await supabase.from("spoilage_records").delete().eq("id", spoilageId);
    recentSpoilageSubmissions.delete(idempotencyKey);
    console.error("[createSpoilageRecord] Falló registro de movimiento kardex, operación revertida:", movementInsertErr);
    throw new Error(`Error al asentar movimiento de inventario: ${movementInsertErr.message}`);
  }

  // Paso D: Sincronizar metadata consolidada en products
  try {
    await supabase
      .from("products")
      .update({
        metadata: {
          ...meta,
          stock_quantity: newStock,
        },
        updated_at: now,
      })
      .eq("id", parsed.itemId)
      .eq("business_id", businessId);
  } catch (metaErr) {
    console.warn("[createSpoilageRecord] Advertencia al sincronizar metadata de producto:", metaErr);
  }

  // Paso E: Disparar alerta in-app si el stock resultante queda en o por debajo del mínimo configurado
  if (newStock <= minStock && minStock > 0) {
    await checkAndTriggerLowStockNotification(businessId, parsed.itemId, targetLocationId);
  }

  const resultSpoilage = mapSpoilageRow(spoilageRecordRow);
  resultSpoilage.unit = unit;
  resultSpoilage.movementId = movementId;
  resultSpoilage.previousStock = currentStock;
  resultSpoilage.resultingStock = newStock;

  const compositeResult = Object.assign(resultSpoilage, {
    spoilage: resultSpoilage,
    movementId,
  });

  return compositeResult as SpoilageRecord & { spoilage: SpoilageRecord; movementId: string };
}

/**
 * Consulta el listado de registros de mermas de un negocio aplicando filtros.
 * Enriquece cada registro con la unidad, el responsable y el movimiento asociado.
 */
export async function getSpoilageRecords(
  businessId: string,
  options: SpoilageFilterOptions = {}
): Promise<SpoilageRecord[]> {
  const supabase = await getDbClient();

  let query = supabase
    .from("spoilage_records")
    .select("*, locations(name)")
    .eq("business_id", businessId);

  if (options.itemType && options.itemType !== "all") {
    query = query.eq("item_type", options.itemType);
  }

  if (options.cause && options.cause !== "all") {
    const dbCause = mapToDbCause(options.cause);
    query = query.eq("cause", dbCause);
  }

  if (options.timeFilter && options.timeFilter !== "all") {
    const now = new Date();
    if (options.timeFilter === "today") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      query = query.gte("date", todayStart);
    } else if (options.timeFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte("date", weekAgo.toISOString());
    } else if (options.timeFilter === "month") {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      query = query.gte("date", monthAgo.toISOString());
    }
  } else if (options.startDate) {
    query = query.gte("date", options.startDate);
  }

  if (options.endDate) {
    const end = options.endDate.includes("T") ? options.endDate : `${options.endDate}T23:59:59.999Z`;
    query = query.lte("date", end);
  }

  if (options.search) {
    const s = options.search.trim();
    query = query.or(`item_name.ilike.%${s}%,notes.ilike.%${s}%`);
  }

  query = query.order("date", { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  } else {
    query = query.limit(200);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getSpoilageRecords] Error al listar mermas:", error);
    throw new Error(`Error al listar registros de mermas: ${error.message}`);
  }

  const rawRecords = data || [];
  if (rawRecords.length === 0) return [];

  // Enriquecer con nombres de usuario responsable y quien anuló
  const userIds = Array.from(
    new Set(rawRecords.flatMap((r: any) => [r.registered_by, r.cancelled_by]).filter(Boolean))
  );
  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    try {
      const { data: usersData } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", userIds);
      (usersData || []).forEach((u: any) => {
        userMap.set(u.id, u.name || u.email || "Usuario");
      });
    } catch {
      // Fallback silencioso
    }
  }

  // Enriquecer con unidades de medida desde products
  const itemIds = Array.from(new Set(rawRecords.map((r: any) => r.item_id).filter(Boolean)));
  const unitsMap = new Map<string, string>();
  if (itemIds.length > 0) {
    try {
      const { data: prods } = await supabase
        .from("products")
        .select("id, metadata")
        .in("id", itemIds);
      (prods || []).forEach((p: any) => {
        const meta = p.metadata || {};
        unitsMap.set(p.id, meta.unit || (meta.product_type === "ingredient" ? "kg" : "un"));
      });
    } catch {
      // Fallback silencioso
    }
  }

  // Enriquecer con ID de movimiento vinculado
  const spoilageIds = rawRecords.map((r: any) => r.id);
  const movementMap = new Map<string, string>();
  if (spoilageIds.length > 0) {
    try {
      const { data: movements } = await supabase
        .from("inventory_movements")
        .select("id, reference_id")
        .eq("business_id", businessId)
        .in("reference_id", spoilageIds);
      (movements || []).forEach((m: any) => {
        if (m.reference_id) movementMap.set(m.reference_id, m.id);
      });
    } catch {
      // Fallback silencioso
    }
  }

  const mapped = rawRecords.map((row: any) => {
    const item = mapSpoilageRow(row);
    item.registeredByName = row.registered_by ? userMap.get(row.registered_by) || "Usuario" : null;
    item.cancelledByName = row.cancelled_by ? userMap.get(row.cancelled_by) || "Usuario" : null;
    item.unit = unitsMap.get(row.item_id) || "un";
    item.movementId = movementMap.get(row.id) || null;
    return item;
  });

  if (options.status && options.status !== "all") {
    return mapped.filter((r) => r.status === options.status);
  }

  return mapped;
}

/**
 * Calcula los indicadores clave (KPIs) del módulo de mermas para el negocio.
 * Excluye mermas anuladas del costo total perdido para mantener cifras reales.
 */
export async function getSpoilageKPIs(businessId: string): Promise<SpoilageKPIs> {
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("spoilage_records")
    .select("quantity, total_cost, date, created_at, notes, status")
    .eq("business_id", businessId);

  if (error) {
    console.error("[getSpoilageKPIs] Error al calcular KPIs:", error);
    throw new Error(`Error al calcular estadísticas de mermas: ${error.message}`);
  }

  const records = data || [];
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, "0");
  const localDay = String(now.getDate()).padStart(2, "0");
  const todayLocal = `${localYear}-${localMonth}-${localDay}`;

  let totalCost = 0;
  let totalQuantity = 0;
  let recentRecordsCount = 0;
  let todayRecordsCount = 0;
  let todayCost = 0;
  let cancelledRecordsCount = 0;
  let cancelledCost = 0;

  for (const r of records) {
    const isCancelled =
      r.status === "cancelled" ||
      (r.notes || "").startsWith("[ANULADA") ||
      (r.notes || "").includes("— [ANULADA");

    const cost = Number(r.total_cost || 0);
    const qty = Number(r.quantity || 0);

    if (isCancelled) {
      cancelledRecordsCount++;
      cancelledCost += cost;
      continue; // No acumular en pérdidas operativas vigentes
    }

    totalCost += cost;
    totalQuantity += qty;

    const rDateStr = r.date || r.created_at;
    const rDate = new Date(rDateStr);

    if (rDate >= thirtyDaysAgo) {
      recentRecordsCount++;
    }

    if (rDateStr && rDateStr.startsWith(todayLocal)) {
      todayRecordsCount++;
      todayCost += cost;
    }
  }

  return {
    totalRecords: records.length - cancelledRecordsCount,
    totalCost: Number(totalCost.toFixed(2)),
    totalQuantity: Number(totalQuantity.toFixed(2)),
    recentRecordsCount,
    todayRecordsCount,
    todayCost: Number(todayCost.toFixed(2)),
    cancelledRecordsCount,
    cancelledCost: Number(cancelledCost.toFixed(2)),
  };
}

/**
 * Actualiza una merma existente recalculando el impacto sobre las existencias físicas y el Kardex.
 * 
 * Reglas de integridad:
 * 1. Valida que el registro pertenezca al negocio y NO esté anulado.
 * 2. Si no cambia el artículo:
 *    Calcula el stock base (actual + cantidad anterior).
 *    Valida que el nuevo valor no supere el stock base (evita stock negativo).
 *    Aplica la diferencia exacta: stockResultante = stockActual - (nuevaCantidad - cantidadAnterior).
 * 3. Si cambia el artículo:
 *    Restaura la cantidad anterior en el artículo original.
 *    Verifica que el nuevo artículo tenga stock suficiente y descuenta la nueva cantidad.
 * 4. Actualiza el registro en spoilage_records y el movimiento en inventory_movements.
 * 5. Sincroniza metadata en products.
 */
export async function updateSpoilageRecord(
  businessId: string,
  input: UpdateSpoilageInput,
  userId?: string | null
): Promise<SpoilageRecord> {
  const parsed = UpdateSpoilageInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Obtener la merma actual
  const { data: currentSpoilage, error: fetchErr } = await supabase
    .from("spoilage_records")
    .select("*, locations(name)")
    .eq("id", parsed.id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (fetchErr || !currentSpoilage) {
    throw new Error("La merma que intentas editar no existe o no pertenece a este comercio.");
  }

  const currentStatus =
    currentSpoilage.status ||
    (currentSpoilage.notes?.includes("[ANULADA]") ? "cancelled" : "active");
  if (currentStatus === "cancelled") {
    throw new Error("No es posible editar una merma que ya ha sido anulada.");
  }

  const oldItemId = currentSpoilage.item_id;
  const oldQuantity = Number(currentSpoilage.quantity);
  const oldUnitCost = Number(currentSpoilage.unit_cost || 0);
  const targetLocationId = parsed.locationId || currentSpoilage.location_id;
  const now = new Date().toISOString();

  // 2. Obtener producto nuevo / destino
  const { data: newProd, error: newProdErr } = await supabase
    .from("products")
    .select("id, name, metadata, business_id, status")
    .eq("id", parsed.itemId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (newProdErr || !newProd) {
    throw new Error("El artículo seleccionado no existe o no pertenece a este comercio.");
  }

  if (newProd.status === "archived") {
    throw new Error("No se pueden asociar mermas a artículos archivados.");
  }

  const newMeta = (newProd.metadata || {}) as Record<string, any>;
  if (newMeta.product_type === "prepared" || newMeta.product_type === "service") {
    throw new Error("No se pueden registrar mermas sobre productos preparados o servicios.");
  }

  const isSameItem = oldItemId === parsed.itemId;

  if (isSameItem) {
    // Mismo artículo: calcular diferencia neta
    const stockRows = await getInventoryStock(businessId, {
      productId: parsed.itemId,
      locationId: targetLocationId,
    });
    const currentStock =
      stockRows && stockRows.length > 0
        ? Number(stockRows[0].quantity)
        : Number(newMeta.stock_quantity ?? 0);
    const minStock =
      stockRows && stockRows.length > 0
        ? Number(stockRows[0].minStock ?? 0)
        : Number(newMeta.min_stock ?? 0);

    // Stock base disponible si se revirtiera la merma previa
    const baseStock = currentStock + oldQuantity;
    if (parsed.quantity > baseStock) {
      const unit = parsed.unit || newMeta.unit || "un";
      throw new Error(
        `Existencias insuficientes para «${newProd.name}». Stock disponible actual: ${currentStock} ${unit} (máximo editable: ${baseStock} ${unit}).`
      );
    }

    const difference = parsed.quantity - oldQuantity; // Si > 0 se pierde más, si < 0 se recupera stock
    const newStock = currentStock - difference;
    const unitCost = parsed.unitCost > 0 ? parsed.unitCost : oldUnitCost;
    const totalCost = Number((parsed.quantity * unitCost).toFixed(2));

    // Actualizar inventory_stock (descuento/reversión neta exacta)
    await upsertInventoryStock(businessId, {
      productId: parsed.itemId,
      locationId: targetLocationId,
      quantity: newStock,
      minStock,
      cost: unitCost,
    });

    // Formatear notas
    let causeLabel = SPOILAGE_CAUSE_LABELS[parsed.cause] || parsed.cause;
    if (parsed.cause === "other" && parsed.customReason) {
      causeLabel = `Otro motivo - ${parsed.customReason.trim()}`;
    }
    const auditDetail = `(Anterior: ${currentStock}, Dif: ${
      difference > 0 ? `-${difference}` : `+${Math.abs(difference)}`
    }, Resultante: ${newStock})`;
    const notesFormatted = [
      `Merma (${causeLabel})`,
      parsed.notes?.trim() || null,
      auditDetail,
      `[Editado: ${new Date().toLocaleDateString("es-CO")}]`,
    ]
      .filter(Boolean)
      .join(" — ");

    const dbCause = mapToDbCause(parsed.cause);

    const updatePayload: any = {
      location_id: targetLocationId,
      item_type: parsed.itemType,
      item_name: newProd.name,
      cause: dbCause,
      quantity: parsed.quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      notes: notesFormatted,
      date: parsed.date || currentSpoilage.date,
      updated_at: now,
    };

    const { error: updErr } = await supabase
      .from("spoilage_records")
      .update(updatePayload)
      .eq("id", parsed.id)
      .eq("business_id", businessId);

    if (updErr) {
      delete updatePayload.updated_at;
      await supabase
        .from("spoilage_records")
        .update(updatePayload)
        .eq("id", parsed.id)
        .eq("business_id", businessId);
    }

    // Actualizar movimiento de Kardex asociado
    await supabase
      .from("inventory_movements")
      .update({
        quantity: parsed.quantity,
        unit_cost: unitCost,
        total_cost: totalCost,
        notes: notesFormatted,
      })
      .eq("reference_id", parsed.id)
      .eq("movement_type", "spoilage")
      .eq("business_id", businessId);

    // Sincronizar metadata en products
    await supabase
      .from("products")
      .update({
        metadata: {
          ...newMeta,
          stock_quantity: newStock,
        },
        updated_at: now,
      })
      .eq("id", parsed.itemId)
      .eq("business_id", businessId);

    const updatedRow = {
      ...currentSpoilage,
      ...updatePayload,
      item_id: parsed.itemId,
    };
    const res = mapSpoilageRow(updatedRow);
    res.previousStock = currentStock;
    res.resultingStock = newStock;
    res.unit = parsed.unit || newMeta.unit || "un";
    return res;
  } else {
    // Cambio de artículo:
    // 1. Revertir existencias en artículo antiguo (oldItemId)
    const oldStockRows = await getInventoryStock(businessId, {
      productId: oldItemId,
      locationId: currentSpoilage.location_id,
    });
    const oldCurrentStock =
      oldStockRows && oldStockRows.length > 0 ? Number(oldStockRows[0].quantity) : 0;
    const oldMinStock =
      oldStockRows && oldStockRows.length > 0 ? Number(oldStockRows[0].minStock ?? 0) : 0;
    const oldRestoredStock = oldCurrentStock + oldQuantity;

    await upsertInventoryStock(businessId, {
      productId: oldItemId,
      locationId: currentSpoilage.location_id,
      quantity: oldRestoredStock,
      minStock: oldMinStock,
      cost: oldUnitCost,
    });

    // 2. Descontar en artículo nuevo (parsed.itemId)
    const newStockRows = await getInventoryStock(businessId, {
      productId: parsed.itemId,
      locationId: targetLocationId,
    });
    const newCurrentStock =
      newStockRows && newStockRows.length > 0
        ? Number(newStockRows[0].quantity)
        : Number(newMeta.stock_quantity ?? 0);
    const newMinStock =
      newStockRows && newStockRows.length > 0
        ? Number(newStockRows[0].minStock ?? 0)
        : Number(newMeta.min_stock ?? 0);
    const unit = parsed.unit || newMeta.unit || "un";

    if (parsed.quantity > newCurrentStock) {
      // Revertir restitución en oldItem si el nuevo no tiene stock suficiente
      await upsertInventoryStock(businessId, {
        productId: oldItemId,
        locationId: currentSpoilage.location_id,
        quantity: oldCurrentStock,
        minStock: oldMinStock,
        cost: oldUnitCost,
      });
      throw new Error(
        `Existencias insuficientes para «${newProd.name}». Stock disponible: ${newCurrentStock} ${unit}, solicitado: ${parsed.quantity} ${unit}.`
      );
    }

    const newResultingStock = newCurrentStock - parsed.quantity;
    const unitCost = parsed.unitCost > 0 ? parsed.unitCost : Number(newMeta.cost ?? 0);
    const totalCost = Number((parsed.quantity * unitCost).toFixed(2));

    await upsertInventoryStock(businessId, {
      productId: parsed.itemId,
      locationId: targetLocationId,
      quantity: newResultingStock,
      minStock: newMinStock,
      cost: unitCost,
    });

    // 3. Formatear notas y actualizar registro
    let causeLabel = SPOILAGE_CAUSE_LABELS[parsed.cause] || parsed.cause;
    if (parsed.cause === "other" && parsed.customReason) {
      causeLabel = `Otro motivo - ${parsed.customReason.trim()}`;
    }
    const auditDetail = `(Artículo cambiado de ${currentSpoilage.item_name} a ${newProd.name}. Stock resultante: ${newResultingStock})`;
    const notesFormatted = [
      `Merma (${causeLabel})`,
      parsed.notes?.trim() || null,
      auditDetail,
      `[Editado: ${new Date().toLocaleDateString("es-CO")}]`,
    ]
      .filter(Boolean)
      .join(" — ");

    const dbCause = mapToDbCause(parsed.cause);

    const updatePayload: any = {
      location_id: targetLocationId,
      item_type: parsed.itemType,
      item_id: parsed.itemId,
      item_name: newProd.name,
      cause: dbCause,
      quantity: parsed.quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      notes: notesFormatted,
      date: parsed.date || currentSpoilage.date,
      updated_at: now,
    };

    const { error: updErr } = await supabase
      .from("spoilage_records")
      .update(updatePayload)
      .eq("id", parsed.id)
      .eq("business_id", businessId);

    if (updErr) {
      delete updatePayload.updated_at;
      await supabase
        .from("spoilage_records")
        .update(updatePayload)
        .eq("id", parsed.id)
        .eq("business_id", businessId);
    }

    // Actualizar movimiento de Kardex asociado
    await supabase
      .from("inventory_movements")
      .update({
        product_id: parsed.itemId,
        quantity: parsed.quantity,
        unit_cost: unitCost,
        total_cost: totalCost,
        notes: notesFormatted,
      })
      .eq("reference_id", parsed.id)
      .eq("movement_type", "spoilage")
      .eq("business_id", businessId);

    // Sincronizar metadata en products para ambos ítems
    await supabase
      .from("products")
      .update({
        metadata: { ...newMeta, stock_quantity: newResultingStock },
        updated_at: now,
      })
      .eq("id", parsed.itemId);

    const { data: oldProd } = await supabase
      .from("products")
      .select("metadata")
      .eq("id", oldItemId)
      .single();
    if (oldProd) {
      await supabase
        .from("products")
        .update({
          metadata: { ...(oldProd.metadata || {}), stock_quantity: oldRestoredStock },
          updated_at: now,
        })
        .eq("id", oldItemId);
    }

    const updatedRow = { ...currentSpoilage, ...updatePayload };
    const res = mapSpoilageRow(updatedRow);
    res.previousStock = newCurrentStock;
    res.resultingStock = newResultingStock;
    res.unit = unit;
    return res;
  }
}

/**
 * Anula una merma registrada, revirtiendo el descuento de existencias en el inventario.
 * 
 * Reglas de integridad:
 * 1. Valida que la merma exista y pertenezca al negocio.
 * 2. Verifica que no haya sido anulada previamente (evita doble reversión).
 * 3. Restaura exactamente la cantidad perdida al stock de inventory_stock.
 * 4. Inserta un movimiento compensatorio en inventory_movements (Kardex) tipo 'adjustment' con motivo.
 * 5. Marca el registro en spoilage_records como 'cancelled' con fecha, usuario y razón.
 * 6. Preserva la trazabilidad completa sin eliminar físicamente el registro.
 */
export async function cancelSpoilageRecord(
  businessId: string,
  input: CancelSpoilageInput,
  userId?: string | null
): Promise<SpoilageRecord> {
  const parsed = CancelSpoilageInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Obtener registro de merma
  const { data: currentSpoilage, error: fetchErr } = await supabase
    .from("spoilage_records")
    .select("*, locations(name)")
    .eq("id", parsed.id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (fetchErr || !currentSpoilage) {
    throw new Error("La merma que intentas anular no existe o no pertenece a este comercio.");
  }

  const isAlreadyCancelled =
    currentSpoilage.status === "cancelled" ||
    (currentSpoilage.notes || "").startsWith("[ANULADA") ||
    (currentSpoilage.notes || "").includes("— [ANULADA");

  if (isAlreadyCancelled) {
    throw new Error("Esta merma ya ha sido anulada previamente. No es posible anularla dos veces.");
  }

  const quantityToRestore = Number(currentSpoilage.quantity);
  const targetLocationId = currentSpoilage.location_id;
  const now = new Date().toISOString();

  // 2. Consultar existencias actuales para restaurar
  const stockRows = await getInventoryStock(businessId, {
    productId: currentSpoilage.item_id,
    locationId: targetLocationId,
  });
  const currentStock =
    stockRows && stockRows.length > 0 ? Number(stockRows[0].quantity) : 0;
  const minStock =
    stockRows && stockRows.length > 0 ? Number(stockRows[0].minStock ?? 0) : 0;
  const unitCost = Number(currentSpoilage.unit_cost || 0);

  const restoredStock = currentStock + quantityToRestore;

  // 3. Revertir existencias en inventory_stock (SUMA de vuelta lo mermado)
  await upsertInventoryStock(businessId, {
    productId: currentSpoilage.item_id,
    locationId: targetLocationId,
    quantity: restoredStock,
    minStock,
    cost: unitCost,
  });

  // 4. Asentar movimiento de reversión en Kardex
  const cancellationMovementId = crypto.randomUUID();
  const cancellationNotes = `[ANULACIÓN DE MERMA] Motivo: ${parsed.reason.trim()} — (Restitución de +${quantityToRestore} a stock anterior ${currentStock} → ${restoredStock})`;

  await supabase.from("inventory_movements").insert({
    id: cancellationMovementId,
    business_id: businessId,
    product_id: currentSpoilage.item_id,
    location_id: targetLocationId,
    movement_type: "adjustment",
    quantity: quantityToRestore,
    unit_cost: unitCost,
    total_cost: Number((quantityToRestore * unitCost).toFixed(2)),
    reference_id: currentSpoilage.id,
    reference_type: "adjustment",
    notes: cancellationNotes,
    created_by: userId || null,
    created_at: now,
  });

  // 5. Actualizar registro en spoilage_records
  const updatedNotes = `[ANULADA: ${parsed.reason.trim()}] — ${currentSpoilage.notes || ""}`;
  let updateErr: any = null;

  try {
    const { error: fullUpdateErr } = await supabase
      .from("spoilage_records")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancelled_by: userId || null,
        cancellation_reason: parsed.reason.trim(),
        notes: updatedNotes,
        updated_at: now,
      })
      .eq("id", currentSpoilage.id)
      .eq("business_id", businessId);

    updateErr = fullUpdateErr;
  } catch (err: any) {
    updateErr = err;
  }

  // Fallback si las columnas nuevas no están aplicadas en la base de datos remota
  if (updateErr) {
    await supabase
      .from("spoilage_records")
      .update({
        notes: updatedNotes,
      })
      .eq("id", currentSpoilage.id)
      .eq("business_id", businessId);
  }

  // 6. Sincronizar metadata en products
  try {
    const { data: prod } = await supabase
      .from("products")
      .select("metadata")
      .eq("id", currentSpoilage.item_id)
      .single();
    if (prod) {
      await supabase
        .from("products")
        .update({
          metadata: {
            ...(prod.metadata || {}),
            stock_quantity: restoredStock,
          },
          updated_at: now,
        })
        .eq("id", currentSpoilage.item_id);
    }
  } catch (metaErr) {
    console.warn("[cancelSpoilageRecord] Error al sincronizar metadata de producto:", metaErr);
  }

  const cancelledRecord = mapSpoilageRow({
    ...currentSpoilage,
    status: "cancelled",
    cancelled_at: now,
    cancelled_by: userId || null,
    cancellation_reason: parsed.reason.trim(),
    notes: updatedNotes,
  });

  cancelledRecord.previousStock = currentStock;
  cancelledRecord.resultingStock = restoredStock;
  return cancelledRecord;
}
