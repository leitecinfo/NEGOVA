import { createClient } from "@/lib/supabase/server";
import {
  CreateSpoilageInput,
  CreateSpoilageInputSchema,
  SpoilageFilterOptions,
  SpoilageKPIs,
  SpoilageRecord,
  SPOILAGE_CAUSE_LABELS,
} from "./types";
import {
  ensureDefaultLocation,
  upsertInventoryStock,
  recordInventoryMovement,
  getInventoryStock,
} from "@/lib/inventory/inventory-service";

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
  return {
    id: row.id,
    businessId: row.business_id,
    locationId: row.location_id,
    locationName: row.locations?.name || null,
    itemType: row.item_type,
    itemId: row.item_id,
    itemName: row.item_name,
    cause: row.cause,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost || 0),
    totalCost: Number(row.total_cost || 0),
    notes: row.notes,
    registeredBy: row.registered_by,
    date: row.date || row.created_at,
    createdAt: row.created_at,
  };
}

/**
 * Registra una merma o pérdida de producto o ingrediente.
 * Descuenta automáticamente el stock de inventario y genera el registro en kardex.
 */
export async function createSpoilageRecord(
  businessId: string,
  input: CreateSpoilageInput,
  userId?: string | null
): Promise<SpoilageRecord> {
  const parsed = CreateSpoilageInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Resolver ubicación de inventario
  let targetLocationId = parsed.locationId;
  if (!targetLocationId) {
    const defaultLoc = await ensureDefaultLocation(businessId);
    targetLocationId = defaultLoc.id;
  }

  // 2. Pre-validación de existencias y reglas de negocio para productos e ingredientes [MER-001]
  let prodToUpdate: any = null;
  let unitCost = parsed.unitCost;
  let currentQty = 0;
  let minStock = 0;
  let cost = parsed.unitCost;

  if (parsed.itemType === "product" || parsed.itemType === "ingredient") {
    const { data: prod, error: prodErr } = await supabase
      .from("products")
      .select("id, name, metadata")
      .eq("id", parsed.itemId)
      .eq("business_id", businessId)
      .single();

    if (prodErr || !prod) {
      throw new Error("El artículo indicado para la merma no existe o no pertenece a este comercio.");
    }

    prodToUpdate = prod;
    const meta = (prod.metadata || {}) as any;

    // Regla de Negocio: No se registran mermas sobre productos preparados o sin control de existencias físicas
    if (meta.product_type === "prepared" || meta.track_stock === false) {
      throw new Error(
        `No se pueden registrar mermas sobre unidades terminadas de «${prod.name}» ya que es un producto preparado o sin control de existencias físicas.`
      );
    }

    // Consultar existencias disponibles en la ubicación
    const stockList = await getInventoryStock(businessId, {
      productId: parsed.itemId,
      locationId: targetLocationId,
    });

    if (stockList && stockList.length > 0) {
      currentQty = Number(stockList[0].quantity || 0);
      minStock = Number(stockList[0].minStock || 0);
      cost = Number(stockList[0].cost || parsed.unitCost);
      if (stockList[0].cost && stockList[0].cost > 0 && (!unitCost || unitCost === 0)) {
        unitCost = Number(stockList[0].cost);
      }
    } else {
      currentQty = Number(meta.stock_quantity || 0);
      minStock = Number(meta.min_stock || 0);
      cost = Number(meta.cost ?? meta.cost_per_unit ?? parsed.unitCost);
      if (meta.cost && (!unitCost || unitCost === 0)) {
        unitCost = Number(meta.cost);
      }
    }

    if (parsed.quantity > currentQty) {
      throw new Error(
        `Existencias insuficientes para «${prod.name}». Stock disponible actual: ${currentQty}, solicitado para merma: ${parsed.quantity}.`
      );
    }
  }

  // 3. Calcular costo total de la merma
  const totalCost = Number((parsed.quantity * unitCost).toFixed(2));

  // 4. Insertar el registro en spoilage_records
  const { data: recordData, error: recordError } = await supabase
    .from("spoilage_records")
    .insert({
      business_id: businessId,
      location_id: targetLocationId,
      item_type: parsed.itemType,
      item_id: parsed.itemId,
      item_name: parsed.itemName,
      cause: parsed.cause,
      quantity: parsed.quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      notes: parsed.notes || null,
      registered_by: userId || null,
      date: parsed.date || new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    .select("*, locations(name)")
    .single();

  if (recordError || !recordData) {
    console.error("[createSpoilageRecord] Error al insertar merma:", recordError);
    throw new Error(`Error al registrar la merma: ${recordError?.message || "No se pudo guardar."}`);
  }

  const createdSpoilage = mapSpoilageRow(recordData);

  // 5. Descontar de existencias físicas y registrar en Kardex de forma atómica
  if (prodToUpdate) {
    const meta = (prodToUpdate.metadata || {}) as any;
    const newQty = Math.max(0, currentQty - parsed.quantity);

    // a. Actualizar inventory_stock normalizado
    await upsertInventoryStock(businessId, {
      productId: parsed.itemId,
      locationId: targetLocationId,
      quantity: newQty,
      minStock,
      cost,
    });

    // b. Actualizar metadata del producto/ingrediente para backward compatibility
    await supabase
      .from("products")
      .update({
        metadata: {
          ...meta,
          stock_quantity: newQty,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.itemId)
      .eq("business_id", businessId);

    // c. Registrar movimiento de inventario tipo 'spoilage' en Kardex
    const causeLabel = SPOILAGE_CAUSE_LABELS[parsed.cause] || parsed.cause;
    const notesFormatted = parsed.notes
      ? `Merma (${causeLabel}): ${parsed.notes}`
      : `Merma registrada (${causeLabel})`;

    await recordInventoryMovement(
      businessId,
      {
        productId: parsed.itemId,
        locationId: targetLocationId,
        movementType: "spoilage",
        quantity: parsed.quantity,
        unitCost,
        totalCost,
        referenceId: createdSpoilage.id,
        referenceType: "adjustment",
        notes: notesFormatted,
      },
      userId,
      { skipStockUpdate: true }
    );
  }

  return createdSpoilage;
}

/**
 * Consulta el listado de registros de mermas de un negocio aplicando filtros.
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
    query = query.eq("cause", options.cause);
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
    query = query.lte("date", options.endDate);
  }

  if (options.search) {
    const s = options.search.trim();
    query = query.or(`item_name.ilike.%${s}%,notes.ilike.%${s}%`);
  }

  query = query.order("date", { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getSpoilageRecords] Error al listar mermas:", error);
    throw new Error(`Error al listar registros de mermas: ${error.message}`);
  }

  return (data || []).map(mapSpoilageRow);
}

/**
 * Calcula los indicadores clave (KPIs) del módulo de mermas para el negocio.
 */
export async function getSpoilageKPIs(businessId: string): Promise<SpoilageKPIs> {
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("spoilage_records")
    .select("quantity, total_cost, date, created_at")
    .eq("business_id", businessId);

  if (error) {
    console.error("[getSpoilageKPIs] Error al calcular KPIs:", error);
    throw new Error(`Error al calcular estadísticas de mermas: ${error.message}`);
  }

  const records = data || [];
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const todayIso = now.toISOString().split("T")[0];
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, "0");
  const localDay = String(now.getDate()).padStart(2, "0");
  const todayLocal = `${localYear}-${localMonth}-${localDay}`;

  let totalCost = 0;
  let totalQuantity = 0;
  let recentRecordsCount = 0;
  let todayRecordsCount = 0;
  let todayCost = 0;

  for (const r of records) {
    const cost = Number(r.total_cost || 0);
    const qty = Number(r.quantity || 0);
    totalCost += cost;
    totalQuantity += qty;

    const recordDate = new Date(r.date || r.created_at);
    if (recordDate >= thirtyDaysAgo) {
      recentRecordsCount++;
    }

    const rDateStr = (r.date || r.created_at || "").split("T")[0];
    if (rDateStr === todayIso || rDateStr === todayLocal) {
      todayRecordsCount++;
      todayCost += cost;
    }
  }

  return {
    totalRecords: records.length,
    totalCost: Number(totalCost.toFixed(2)),
    totalQuantity: Number(totalQuantity.toFixed(2)),
    recentRecordsCount,
    todayRecordsCount,
    todayCost: Number(todayCost.toFixed(2)),
  };
}
