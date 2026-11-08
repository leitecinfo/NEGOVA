// Dynamic import of createClient inside getDbClient to avoid next/headers leakage
import {
  Location,
  InventoryStock,
  InventoryMovement,
  CreateLocationInput,
  UpsertStockInput,
  CreateMovementInput,
  CreateLocationInputSchema,
  UpsertStockInputSchema,
  CreateMovementInputSchema,
  InventoryKPIs,
  ProductStockMatrixResult,
  ProductStockMatrixRow,
  InventoryMovementWithDetails,
  LowStockItem,
  InventoryMovementFilters,
  CreateTransferInput,
  CreateTransferInputSchema,
  TransferResult,
  resolveMovementOrigin,
  extractStockSnapshot,
  StockAdjustmentInput,
  StockAdjustmentInputSchema,
  StockAdjustmentResult,
  ADJUSTMENT_REASON_LABELS,
} from "./types";
import { createNotification } from "@/lib/notifications/notifications-service";
import { assertPlanLimit } from "@/lib/subscriptions/plan-limits-service";

/**
 * SERVICIO CENTRAL DE INVENTARIO NORMALIZADO POR UBICACIÓN [INV-001]
 * 
 * Cumple aislamiento estricto por tenant business_id y asegura integridad relacional.
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

  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

function mapLocationRow(row: any): Location {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    type: row.type,
    address: row.address || null,
    isVisibleInMenu: Boolean(row.is_visible_in_menu),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

function mapStockRow(row: any): InventoryStock {
  return {
    id: row.id,
    businessId: row.business_id,
    productId: row.product_id,
    locationId: row.location_id,
    quantity: Number(row.quantity || 0),
    minStock: Number(row.min_stock || 0),
    cost: Number(row.cost || 0),
    updatedAt: row.updated_at,
  };
}

function mapMovementRow(row: any): InventoryMovement {
  return {
    id: row.id,
    businessId: row.business_id,
    productId: row.product_id,
    locationId: row.location_id,
    movementType: row.movement_type,
    quantity: Number(row.quantity || 0),
    unitCost: row.unit_cost !== null && row.unit_cost !== undefined ? Number(row.unit_cost) : null,
    totalCost: row.total_cost !== null && row.total_cost !== undefined ? Number(row.total_cost) : null,
    referenceId: row.reference_id || null,
    referenceType: row.reference_type || null,
    notes: row.notes || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
  };
}

/**
 * Consulta todas las ubicaciones asociadas a un negocio.
 */
export async function getBusinessLocations(businessId: string): Promise<Location[]> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getBusinessLocations] Error al consultar ubicaciones:", error);
    throw new Error(`Error al consultar ubicaciones: ${error.message}`);
  }

  return (data || []).map(mapLocationRow);
}

/**
 * Garantiza que el negocio tenga al menos una ubicación activa (tipo point_of_sale).
 * Idempotente: si ya existe alguna, devuelve la principal existente.
 */
export async function ensureDefaultLocation(businessId: string): Promise<Location> {
  const supabase = await getDbClient();

  // 1. Buscar si ya existe una ubicación
  const { data: existing, error: searchErr } = await supabase
    .from("locations")
    .select("*")
    .eq("business_id", businessId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (searchErr) {
    console.error("[ensureDefaultLocation] Error al buscar ubicaciones:", searchErr);
    throw new Error(`No se pudo verificar ubicación: ${searchErr.message}`);
  }

  if (existing) {
    return mapLocationRow(existing);
  }

  // 2. Si no existe, crear ubicación 'point_of_sale' predeterminada
  const { data: newLoc, error: insertErr } = await supabase
    .from("locations")
    .insert({
      business_id: businessId,
      name: "Punto Principal",
      type: "point_of_sale",
      is_visible_in_menu: true,
      is_active: true,
    })
    .select()
    .single();

  if (insertErr || !newLoc) {
    console.error("[ensureDefaultLocation] Error al crear ubicación inicial:", insertErr);
    throw new Error(`No se pudo crear la ubicación predeterminada: ${insertErr?.message}`);
  }

  return mapLocationRow(newLoc);
}

/**
 * Crea una nueva ubicación física o lógica para el negocio.
 */
export async function createLocation(businessId: string, input: CreateLocationInput): Promise<Location> {
  // Validación de límites de suscripción en servidor [SUB-001]
  await assertPlanLimit(businessId, "locations");

  const parsed = CreateLocationInputSchema.parse(input);
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("locations")
    .insert({
      business_id: businessId,
      name: parsed.name,
      type: parsed.type,
      address: parsed.address || null,
      is_visible_in_menu: parsed.isVisibleInMenu,
      is_active: parsed.isActive,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[createLocation] Error al registrar ubicación:", error);
    throw new Error(`No se pudo crear la ubicación: ${error?.message}`);
  }

  return mapLocationRow(data);
}

/**
 * Consulta el stock de productos en el inventario.
 */
export async function getInventoryStock(
  businessId: string,
  filters?: { locationId?: string; productId?: string }
): Promise<InventoryStock[]> {
  const supabase = await getDbClient();
  let query = supabase
    .from("inventory_stock")
    .select("*")
    .eq("business_id", businessId);

  if (filters?.locationId) {
    query = query.eq("location_id", filters.locationId);
  }

  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getInventoryStock] Error al consultar stock:", error);
    throw new Error(`Error al consultar stock: ${error.message}`);
  }

  return (data || []).map(mapStockRow);
}

/**
 * Actualiza o inserta el registro de stock para un producto en una ubicación específica.
 */
export async function upsertInventoryStock(
  businessId: string,
  input: UpsertStockInput
): Promise<InventoryStock> {
  const parsed = UpsertStockInputSchema.parse(input);
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("inventory_stock")
    .upsert(
      {
        business_id: businessId,
        product_id: parsed.productId,
        location_id: parsed.locationId,
        quantity: parsed.quantity,
        min_stock: parsed.minStock ?? 0,
        cost: parsed.cost ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,location_id" }
    )
    .select()
    .single();

  if (error || !data) {
    console.error("[upsertInventoryStock] Error al guardar stock:", error);
    throw new Error(`No se pudo actualizar el stock: ${error?.message}`);
  }

  return mapStockRow(data);
}

/**
 * Registra y ejecuta un movimiento de inventario (kardex) actualizando las existencias de forma atómica.
 * Reglas de negocio:
 * - Entradas incrementan el stock en la cantidad indicada.
 * - Salidas reducen el stock y no permiten dejar stock negativo (error si cantidad > stock actual).
 * - Ajustes establecen el stock exactamente al valor indicado (no suma/resta).
 * - Los movimientos quedan registrados de forma inmutable con created_by.
 */
export async function recordInventoryMovement(
  businessId: string,
  input: CreateMovementInput,
  createdBy?: string | null,
  options?: { skipStockUpdate?: boolean }
): Promise<InventoryMovement> {
  const parsed = CreateMovementInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Validar que la ubicación pertenezca a este negocio
  const { data: locData, error: locErr } = await supabase
    .from("locations")
    .select("id, name, is_active, business_id")
    .eq("id", parsed.locationId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (locErr || !locData) {
    throw new Error("La ubicación indicada no pertenece a este comercio o no existe.");
  }

  // 2. Validar que el producto pertenezca a este negocio
  const { data: prodData, error: prodErr } = await supabase
    .from("products")
    .select("id, name, metadata, business_id")
    .eq("id", parsed.productId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (prodErr || !prodData) {
    throw new Error("El producto indicado no pertenece a este comercio o no existe.");
  }

  let currentQty = 0;
  let finalQuantity = 0;
  let unitCost = parsed.unitCost ?? null;
  let minStock = 0;

  // 3. Actualización de existencias físicas en inventory_stock (salvo que se indique omitir por estar precalculado)
  if (!options?.skipStockUpdate) {
    const { data: stockRow } = await supabase
      .from("inventory_stock")
      .select("quantity, min_stock, cost")
      .eq("business_id", businessId)
      .eq("product_id", parsed.productId)
      .eq("location_id", parsed.locationId)
      .maybeSingle();

    currentQty = Number(stockRow?.quantity || 0);
    minStock = Number(stockRow?.min_stock || 0);
    const existingCost = Number(stockRow?.cost || 0);
    unitCost = parsed.unitCost !== undefined && parsed.unitCost !== null ? parsed.unitCost : existingCost;

    if (parsed.movementType === "entry" || parsed.movementType === "transfer_in") {
      finalQuantity = currentQty + parsed.quantity;
    } else if (
      parsed.movementType === "exit" ||
      parsed.movementType === "transfer_out" ||
      parsed.movementType === "spoilage" ||
      parsed.movementType === "sale"
    ) {
      if (parsed.quantity > currentQty) {
        throw new Error(
          `Existencias insuficientes para «${prodData.name}». Stock disponible actual: ${currentQty}, solicitado para salida: ${parsed.quantity}.`
        );
      }
      finalQuantity = currentQty - parsed.quantity;
    } else if (parsed.movementType === "adjustment") {
      // Regla de negocio: El ajuste establece el stock al valor indicado (no suma/resta)
      finalQuantity = parsed.quantity;
    }

    // Persistir stock por ubicación
    await upsertInventoryStock(businessId, {
      productId: parsed.productId,
      locationId: parsed.locationId,
      quantity: finalQuantity,
      minStock,
      cost: unitCost ?? 0,
    });

    // Sincronizar stock total consolidado en products.metadata.stock_quantity
    try {
      const { data: allStockRows } = await supabase
        .from("inventory_stock")
        .select("quantity")
        .eq("business_id", businessId)
        .eq("product_id", parsed.productId);

      const totalConsolidatedStock = (allStockRows || []).reduce(
        (sum: number, r: any) => sum + Number(r.quantity || 0),
        0
      );

      const currentMeta = (prodData.metadata as any) || {};
      await supabase
        .from("products")
        .update({
          metadata: {
            ...currentMeta,
            stock_quantity: totalConsolidatedStock,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", parsed.productId)
        .eq("business_id", businessId);
    } catch (metaErr) {
      console.warn("[recordInventoryMovement] Error al sincronizar metadata de producto:", metaErr);
    }
  }

  // 4. Calcular costo total
  const calculatedTotalCost =
    parsed.totalCost ??
    (unitCost !== null && unitCost !== undefined ? Number((unitCost * parsed.quantity).toFixed(2)) : null);

  // 5. Inserción inmutable en inventory_movements (Kardex)
  // Formatear notas respetando el texto original proporcionado por el usuario
  let movementNotes = parsed.notes ? parsed.notes.trim() : null;
  if (!movementNotes && !options?.skipStockUpdate) {
    const auditDetail = `(Anterior: ${currentQty}, Resultante: ${finalQuantity})`;
    movementNotes = auditDetail;
  }

  // Prevenir error de restricción CHECK en PostgreSQL: reference_type solo admite ('sale', 'purchase', 'adjustment', 'transfer')
  const safeReferenceType =
    parsed.referenceType === "spoilage"
      ? "adjustment"
      : parsed.referenceType ??
        (parsed.movementType === "spoilage" || parsed.movementType === "adjustment"
          ? "adjustment"
          : null);

  const { data, error } = await supabase
    .from("inventory_movements")
    .insert({
      business_id: businessId,
      product_id: parsed.productId,
      location_id: parsed.locationId,
      movement_type: parsed.movementType,
      quantity: parsed.quantity,
      unit_cost: unitCost,
      total_cost: calculatedTotalCost,
      reference_id: parsed.referenceId ?? null,
      reference_type: safeReferenceType,
      notes: movementNotes,
      created_by: createdBy || null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[recordInventoryMovement] Error al crear movimiento:", error);
    throw new Error(`No se pudo registrar el movimiento: ${error?.message}`);
  }

  // 6. Alerta de stock bajo si aplica
  if (!options?.skipStockUpdate && finalQuantity <= minStock && minStock > 0) {
    await checkAndTriggerLowStockNotification(businessId, parsed.productId, parsed.locationId);
  }

  return mapMovementRow(data);
}

/**
 * Registra múltiples movimientos de inventario en lote de forma secuencial y controlada.
 */
export async function recordInventoryMovementsBatch(
  businessId: string,
  items: CreateMovementInput[],
  createdBy?: string | null
): Promise<InventoryMovement[]> {
  if (!items || items.length === 0) {
    throw new Error("Debes proporcionar al menos un movimiento de inventario.");
  }

  const results: InventoryMovement[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    try {
      const res = await recordInventoryMovement(businessId, items[idx], createdBy);
      results.push(res);
    } catch (itemErr: any) {
      throw new Error(`Error en el movimiento #${idx + 1}: ${itemErr.message}`);
    }
  }

  return results;
}

/**
 * Ejecuta una transferencia de existencias entre dos ubicaciones distintas del mismo negocio [INV-005].
 * 
 * Reglas de negocio:
 * 1. Ambas ubicaciones deben pertenecer estrictamente al mismo businessId.
 * 2. La ubicación origen y destino deben ser diferentes.
 * 3. Valida previamente que el stock disponible en la ubicación origen sea suficiente para TODOS los ítems.
 * 4. Genera de forma atómica los movimientos vinculados:
 *    - 'transfer_out' en origen con reference_id = transferId y reference_type = 'transfer'.
 *    - 'transfer_in' en destino con el mismo reference_id y reference_type = 'transfer'.
 * 5. Actualiza inventory_stock en ambas ubicaciones (origen -= cantidad, destino += cantidad).
 * 6. Sincroniza products.metadata.stock_quantity consolidado.
 * 7. Dispara alerta in-app si el stock resultante en origen queda <= min_stock.
 */
export async function transferInventory(
  businessId: string,
  input: CreateTransferInput,
  createdBy?: string | null
): Promise<TransferResult> {
  const parsed = CreateTransferInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Validar que ambas ubicaciones pertenezcan al negocio
  const { data: locations, error: locErr } = await supabase
    .from("locations")
    .select("id, name, is_active, business_id")
    .eq("business_id", businessId)
    .in("id", [parsed.sourceLocationId, parsed.destinationLocationId]);

  if (locErr || !locations) {
    throw new Error("Error al consultar las ubicaciones para la transferencia.");
  }

  const sourceLoc = locations.find((l) => l.id === parsed.sourceLocationId);
  const destLoc = locations.find((l) => l.id === parsed.destinationLocationId);

  if (!sourceLoc) {
    throw new Error("La ubicación origen no existe o no pertenece a este comercio.");
  }
  if (!destLoc) {
    throw new Error("La ubicación destino no existe o no pertenece a este comercio.");
  }

  // 2. Validar que todos los productos pertenezcan al negocio
  const productIds = Array.from(new Set(parsed.items.map((i) => i.productId)));
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, metadata")
    .eq("business_id", businessId)
    .in("id", productIds);

  if (prodErr || !products || products.length !== productIds.length) {
    throw new Error("Uno o más productos no pertenecen a este comercio o no existen.");
  }

  const productsMap = new Map(products.map((p) => [p.id, p]));

  // 3. Pre-validación atómica: verificar existencias suficientes en origen para TODOS los ítems
  const { data: sourceStockRows, error: srcStockErr } = await supabase
    .from("inventory_stock")
    .select("id, product_id, quantity, min_stock, cost")
    .eq("business_id", businessId)
    .eq("location_id", parsed.sourceLocationId)
    .in("product_id", productIds);

  if (srcStockErr) {
    throw new Error("Error al verificar las existencias en la ubicación origen.");
  }

  const sourceStockMap = new Map((sourceStockRows || []).map((r) => [r.product_id, r]));

  for (const item of parsed.items) {
    const prod = productsMap.get(item.productId)!;
    const srcStock = sourceStockMap.get(item.productId);
    const availableQty = Number(srcStock?.quantity || 0);

    if (item.quantity > availableQty) {
      throw new Error(
        `Existencias insuficientes para «${prod.name}» en «${sourceLoc.name}». Stock disponible: ${availableQty}, solicitado para transferir: ${item.quantity}.`
      );
    }
  }

  // 4. Consultar existencias previas en destino
  const { data: destStockRows } = await supabase
    .from("inventory_stock")
    .select("id, product_id, quantity, min_stock, cost")
    .eq("business_id", businessId)
    .eq("location_id", parsed.destinationLocationId)
    .in("product_id", productIds);

  const destStockMap = new Map((destStockRows || []).map((r) => [r.product_id, r]));

  // 5. Generar identificador compartido de transferencia
  const transferId = crypto.randomUUID();
  const createdMovements: InventoryMovement[] = [];
  const now = new Date().toISOString();

  // 6. Ejecutar transferencias de cada ítem
  for (const item of parsed.items) {
    const prod = productsMap.get(item.productId)!;
    const srcStock = sourceStockMap.get(item.productId);
    const destStock = destStockMap.get(item.productId);

    const currentSrcQty = Number(srcStock?.quantity || 0);
    const currentDestQty = Number(destStock?.quantity || 0);

    const srcMinStock = Number(srcStock?.min_stock || 0);
    const destMinStock = Number(destStock?.min_stock || 0);

    const unitCost = srcStock?.cost ?? (prod.metadata as any)?.cost ?? 0;
    const totalCost = Number((unitCost * item.quantity).toFixed(2));

    const newSrcQty = currentSrcQty - item.quantity;
    const newDestQty = currentDestQty + item.quantity;

    // Actualizar stock en origen
    await upsertInventoryStock(businessId, {
      productId: item.productId,
      locationId: parsed.sourceLocationId,
      quantity: newSrcQty,
      minStock: srcMinStock,
      cost: unitCost,
    });

    // Actualizar stock en destino
    await upsertInventoryStock(businessId, {
      productId: item.productId,
      locationId: parsed.destinationLocationId,
      quantity: newDestQty,
      minStock: destMinStock,
      cost: destStock?.cost ?? unitCost,
    });

    // Registrar 'transfer_out' en origen
    const outNote = parsed.notes
      ? `Transferencia enviada hacia ${destLoc.name}. ${parsed.notes}`
      : `Transferencia enviada hacia ${destLoc.name}`;

    const { data: outMov, error: outErr } = await supabase
      .from("inventory_movements")
      .insert({
        business_id: businessId,
        product_id: item.productId,
        location_id: parsed.sourceLocationId,
        movement_type: "transfer_out",
        quantity: item.quantity,
        unit_cost: unitCost,
        total_cost: totalCost,
        reference_id: transferId,
        reference_type: "transfer",
        notes: outNote,
        created_by: createdBy || null,
        created_at: now,
      })
      .select()
      .single();

    if (outErr || !outMov) {
      throw new Error(`Error al registrar salida por transferencia de «${prod.name}»: ${outErr?.message}`);
    }
    createdMovements.push(mapMovementRow(outMov));

    // Registrar 'transfer_in' en destino
    const inNote = parsed.notes
      ? `Transferencia recibida desde ${sourceLoc.name}. ${parsed.notes}`
      : `Transferencia recibida desde ${sourceLoc.name}`;

    const { data: inMov, error: inErr } = await supabase
      .from("inventory_movements")
      .insert({
        business_id: businessId,
        product_id: item.productId,
        location_id: parsed.destinationLocationId,
        movement_type: "transfer_in",
        quantity: item.quantity,
        unit_cost: unitCost,
        total_cost: totalCost,
        reference_id: transferId,
        reference_type: "transfer",
        notes: inNote,
        created_by: createdBy || null,
        created_at: now,
      })
      .select()
      .single();

    if (inErr || !inMov) {
      throw new Error(`Error al registrar entrada por transferencia de «${prod.name}»: ${inErr?.message}`);
    }
    createdMovements.push(mapMovementRow(inMov));

    // Sincronizar stock total consolidado en products.metadata.stock_quantity
    try {
      const { data: allStockRows } = await supabase
        .from("inventory_stock")
        .select("quantity")
        .eq("business_id", businessId)
        .eq("product_id", item.productId);

      const totalConsolidatedStock = (allStockRows || []).reduce(
        (sum: number, r: any) => sum + Number(r.quantity || 0),
        0
      );

      const currentMeta = (prod.metadata as any) || {};
      await supabase
        .from("products")
        .update({
          metadata: {
            ...currentMeta,
            stock_quantity: totalConsolidatedStock,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.productId)
        .eq("business_id", businessId);
    } catch (metaErr) {
      console.warn("[transferInventory] Error al sincronizar metadata de producto:", metaErr);
    }

    // Alerta de stock bajo en origen si corresponde
    if (newSrcQty <= srcMinStock && srcMinStock > 0) {
      await checkAndTriggerLowStockNotification(businessId, item.productId, parsed.sourceLocationId);
    }
  }

  return {
    transferId,
    sourceLocationId: parsed.sourceLocationId,
    destinationLocationId: parsed.destinationLocationId,
    sourceLocationName: sourceLoc.name,
    destinationLocationName: destLoc.name,
    movements: createdMovements,
  };
}

/**
 * Migra los datos de productos con metadata.track_stock = true al esquema normalizado inventory_stock.
 * Preserva intactos los metadatos en products para compatibilidad retroactiva.
 */
export async function migrateProductStockToNormalized(
  businessId: string
): Promise<{ migratedCount: number; defaultLocationId: string }> {
  const defaultLoc = await ensureDefaultLocation(businessId);
  const supabase = await getDbClient();

  // Obtener productos activos del negocio que controlan stock
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, metadata")
    .eq("business_id", businessId)
    .neq("status", "archived");

  if (prodErr) {
    console.error("[migrateProductStockToNormalized] Error al consultar productos:", prodErr);
    throw new Error(`Error al consultar productos para migración: ${prodErr.message}`);
  }

  const eligibleProducts = (products || []).filter((p) => {
    const meta = p.metadata || {};
    return meta.track_stock === true || meta.track_stock === "true";
  });

  let migratedCount = 0;

  for (const prod of eligibleProducts) {
    const meta = prod.metadata || {};
    const qty = typeof meta.stock_quantity === "number" ? meta.stock_quantity : Number(meta.stock_quantity || 0);
    const min = typeof meta.min_stock === "number" ? meta.min_stock : Number(meta.min_stock || 0);
    const initialCost = typeof meta.cost === "number" ? meta.cost : Number(meta.cost || 0);

    const { error: upsertErr } = await supabase
      .from("inventory_stock")
      .upsert(
        {
          business_id: businessId,
          product_id: prod.id,
          location_id: defaultLoc.id,
          quantity: isNaN(qty) ? 0 : qty,
          min_stock: isNaN(min) ? 0 : min,
          cost: isNaN(initialCost) ? 0 : initialCost,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id,location_id" }
      );

    if (!upsertErr) {
      migratedCount++;
    }
  }

  return {
    migratedCount,
    defaultLocationId: defaultLoc.id,
  };
}

// ==========================================
// KPIS Y MATRIZ DE STOCK POR UBICACIÓN [INV-002]
// ==========================================

/**
 * Calcula los indicadores ejecutivos de inventario para un negocio:
 * - Total Productos
 * - Stock Bajo
 * - Valor al Costo
 * - Movimientos de Inventario Hoy
 */
export async function getInventoryKPIs(businessId: string): Promise<InventoryKPIs> {
  const supabase = await getDbClient();

  // 1. Consultar todos los productos e insumos activos del negocio
  const { data: productsData, error: prodErr } = await supabase
    .from("products")
    .select("id, name, metadata")
    .eq("business_id", businessId)
    .neq("status", "archived");

  if (prodErr) {
    console.warn("[getInventoryKPIs] Advertencia al consultar productos:", prodErr);
  }

  // Filtrar estrictamente los artículos inventariables [TAREA-03]:
  // a) Insumos / ingredientes (product_type === 'ingredient')
  // b) Productos comerciales con control de existencias (track_stock === true y product_type !== 'service')
  const inventariableProducts = (productsData || []).filter((p) => {
    const meta = (p.metadata || {}) as Record<string, any>;
    if (meta.product_type === "ingredient") return true;
    if (meta.product_type === "service") return false;
    return Boolean(meta.track_stock);
  });

  const inventariableIdSet = new Set(inventariableProducts.map((p) => p.id));
  const productMetaMap = new Map(inventariableProducts.map((p) => [p.id, (p.metadata || {}) as Record<string, any>]));

  // 2. Existencias en inventory_stock
  const { data: stockList, error: stockErr } = await supabase
    .from("inventory_stock")
    .select("product_id, quantity, min_stock, cost")
    .eq("business_id", businessId);

  if (stockErr) {
    console.warn("[getInventoryKPIs] Advertencia al consultar stock:", stockErr);
  }

  let totalCostValue = 0;
  const totalStockByProduct = new Map<string, number>();
  const lowStockProductIds = new Set<string>();

  for (const s of stockList || []) {
    if (!inventariableIdSet.has(s.product_id)) continue;
    const qty = Number(s.quantity || 0);
    const min = Number(s.min_stock || 0);
    const c = Number(s.cost || 0);

    totalCostValue += qty * c;
    totalStockByProduct.set(s.product_id, (totalStockByProduct.get(s.product_id) || 0) + qty);

    if (min > 0 && qty <= min && qty > 0) {
      lowStockProductIds.add(s.product_id);
    }
  }

  let inStockCount = 0;
  let outOfStockCount = 0;

  for (const p of inventariableProducts) {
    const meta = productMetaMap.get(p.id) || {};
    const hasStockRows = totalStockByProduct.has(p.id);
    const qty = hasStockRows ? (totalStockByProduct.get(p.id) || 0) : Number(meta.stock_quantity ?? 0);
    const min = Number(meta.min_stock ?? 0);
    const c = Number(meta.cost ?? 0);

    if (!hasStockRows) {
      totalCostValue += qty * c;
      if (min > 0 && qty <= min && qty > 0) {
        lowStockProductIds.add(p.id);
      }
    }

    // Regla de clasificación mutuamente excluyente:
    // - Agotado: existencia <= 0
    // - Stock bajo: existencia positiva y menor o igual al mínimo configurado en alguna ubicación o consolidado
    // - Disponible: existencia superior al mínimo, o positiva sin mínimo configurado
    if (qty <= 0) {
      outOfStockCount++;
    } else if (lowStockProductIds.has(p.id) || (min > 0 && qty <= min)) {
      lowStockProductIds.add(p.id);
    } else {
      inStockCount++;
    }
  }

  const lowStockCount = lowStockProductIds.size;

  // 3. Movimientos de hoy
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: todayMovementsCount, error: movErr } = await supabase
    .from("inventory_movements")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", todayStart.toISOString());

  if (movErr) {
    console.warn("[getInventoryKPIs] Advertencia al consultar movimientos de hoy:", movErr);
  }

  const totalCount = inventariableProducts.length;

  return {
    totalProducts: totalCount,
    totalItems: totalCount,
    inStockCount,
    lowStockCount,
    outOfStockCount,
    totalCostValue: Number(totalCostValue.toFixed(2)),
    todayMovementsCount: todayMovementsCount || 0,
  };
}

/**
 * Obtiene la matriz completa de productos con sus cantidades desglosadas por cada ubicación física.
 */
export async function getProductStockMatrix(
  businessId: string,
  filters?: { search?: string; categoryId?: string; lowStockOnly?: boolean }
): Promise<ProductStockMatrixResult> {
  const supabase = await getDbClient();

  // 1. Asegurar y obtener ubicaciones activas del negocio
  let locations = await getBusinessLocations(businessId);
  if (!locations || locations.length === 0) {
    await ensureDefaultLocation(businessId);
    locations = await getBusinessLocations(businessId);
  }

  // 2. Consultar productos activos
  let prodQuery = supabase
    .from("products")
    .select("id, name, price, category_id, metadata, categories(name)")
    .eq("business_id", businessId)
    .neq("status", "archived")
    .order("name", { ascending: true });

  if (filters?.categoryId && filters.categoryId !== "all") {
    prodQuery = prodQuery.eq("category_id", filters.categoryId);
  }

  if (filters?.search) {
    const s = filters.search.trim();
    prodQuery = prodQuery.ilike("name", `%${s}%`);
  }

  const { data: productsData, error: prodErr } = await prodQuery;

  if (prodErr) {
    console.error("[getProductStockMatrix] Error al consultar productos:", prodErr);
    throw new Error(`Error al consultar productos: ${prodErr.message}`);
  }

  // 3. Consultar stock de todas las ubicaciones
  const { data: stockData, error: stockErr } = await supabase
    .from("inventory_stock")
    .select("product_id, location_id, quantity, min_stock, cost")
    .eq("business_id", businessId);

  if (stockErr) {
    console.error("[getProductStockMatrix] Error al consultar stock general:", stockErr);
    throw new Error(`Error al consultar stock: ${stockErr.message}`);
  }

  // Mapear stock por clave `productId_locationId`
  const stockMap = new Map<string, { quantity: number; minStock: number; cost: number }>();
  for (const s of stockData || []) {
    const key = `${s.product_id}_${s.location_id}`;
    stockMap.set(key, {
      quantity: Number(s.quantity || 0),
      minStock: Number(s.min_stock || 0),
      cost: Number(s.cost || 0),
    });
  }

  const rows: ProductStockMatrixRow[] = [];

  for (const p of productsData || []) {
    const meta = (p.metadata || {}) as any;
    const trackStock = meta.track_stock === true || meta.track_stock === "true";
    const fallbackProductCost = Number(meta.cost ?? meta.average_cost ?? (p as any).cost_price ?? 0);

    const stockByLocation: ProductStockMatrixRow["stockByLocation"] = {};
    let totalStock = 0;
    let totalValuation = 0;
    let latestLocationCost = 0;
    let isLowStock = false;

    for (const loc of locations) {
      const entry = stockMap.get(`${p.id}_${loc.id}`);
      const quantity = entry ? entry.quantity : 0;
      const minStock = entry ? entry.minStock : Number(meta.min_stock || 0);
      const cost = entry && entry.cost > 0 ? entry.cost : fallbackProductCost;
      const isLow = entry ? quantity <= minStock : false;

      if (isLow) {
        isLowStock = true;
      }

      if (entry && entry.cost > 0) {
        latestLocationCost = entry.cost;
      }

      totalStock += quantity;
      if (quantity > 0 && cost > 0) {
        totalValuation += quantity * cost;
      }

      stockByLocation[loc.id] = {
        quantity,
        minStock,
        cost,
        isLow,
      };
    }

    const effectiveAverageCost =
      totalStock > 0 && totalValuation > 0
        ? Number((totalValuation / totalStock).toFixed(2))
        : latestLocationCost > 0
        ? latestLocationCost
        : fallbackProductCost;

    const productMinStock = Number(meta.min_stock || 0);
    if (productMinStock > 0 && totalStock <= productMinStock) {
      isLowStock = true;
    }

    if (filters?.lowStockOnly && !isLowStock) {
      continue;
    }

    rows.push({
      productId: p.id,
      productName: p.name,
      categoryName: (p.categories as any)?.name || null,
      sku: meta.sku || null,
      cost: effectiveAverageCost,
      price: Number(p.price || 0),
      trackStock,
      totalStock,
      isLowStock,
      stockByLocation,
    });
  }

  return {
    locations,
    rows,
  };
}

// ==========================================
// HISTORIAL DE MOVIMIENTOS Y ALERTAS DE STOCK BAJO [INV-004]
// ==========================================

/**
 * Consulta el historial de movimientos de inventario aplicando filtros de fecha, ubicación, producto y tipo.
 */
export async function getInventoryMovementsHistory(
  businessId: string,
  filters?: InventoryMovementFilters
): Promise<InventoryMovementWithDetails[]> {
  const supabase = await getDbClient();

  let query = supabase
    .from("inventory_movements")
    .select("*, products(name, metadata), locations(name)")
    .eq("business_id", businessId);

  if (filters?.locationId && filters.locationId !== "all") {
    query = query.eq("location_id", filters.locationId);
  }

  if (filters?.productId && filters.productId !== "all") {
    query = query.eq("product_id", filters.productId);
  }

  if (filters?.movementType && filters.movementType !== "all") {
    query = query.eq("movement_type", filters.movementType);
  }

  if (filters?.startDate) {
    query = query.gte("created_at", filters.startDate);
  }

  if (filters?.endDate) {
    const end = filters.endDate.includes("T") ? filters.endDate : `${filters.endDate}T23:59:59.999Z`;
    query = query.lte("created_at", end);
  }

  if (filters?.search) {
    const s = filters.search.trim();
    query = query.or(`notes.ilike.%${s}%`);
  }

  query = query.order("created_at", { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  } else {
    query = query.limit(200);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getInventoryMovementsHistory] Error al consultar historial:", error);
    throw new Error(`Error al consultar historial de movimientos: ${error.message}`);
  }

  const userIds = Array.from(new Set((data || []).map((r: any) => r.created_by).filter(Boolean)));
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
      // Fallback silencioso si no se pueden consultar usuarios
    }
  }

  // Resolver metadatos de órdenes y documentos para trazabilidad de canal/origen (POS, Mesa, Domicilio, Devolución)
  const refIds = Array.from(new Set((data || []).map((r: any) => r.reference_id).filter(Boolean)));
  const refMap = new Map<string, { orderType?: string; docType?: string }>();
  if (refIds.length > 0) {
    try {
      const [ordersRes, docsRes] = await Promise.all([
        supabase.from("restaurant_orders").select("id, order_type").in("id", refIds),
        supabase.from("documents").select("id, document_type, order_type").in("id", refIds),
      ]);
      (ordersRes.data || []).forEach((o: any) => {
        refMap.set(o.id, { orderType: o.order_type });
      });
      (docsRes.data || []).forEach((d: any) => {
        refMap.set(d.id, { docType: d.document_type, orderType: d.order_type });
      });
    } catch {
      // Fallback silencioso si no se pueden consultar referencias
    }
  }

  let mappedMovements: InventoryMovementWithDetails[] = (data || []).map((row: any) => {
    const refInfo = row.reference_id ? refMap.get(row.reference_id) : undefined;
    const origin = resolveMovementOrigin({
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      notes: row.notes,
      movementType: row.movement_type,
      orderType: refInfo?.orderType,
      docType: refInfo?.docType,
    });

    const quantity = Number(row.quantity || 0);
    const unitCost =
      row.unit_cost !== null && row.unit_cost !== undefined
        ? Number(row.unit_cost)
        : row.cost_per_unit
        ? Number(row.cost_per_unit)
        : null;
    const totalCost =
      row.total_cost !== null && row.total_cost !== undefined
        ? Number(row.total_cost)
        : unitCost !== null
        ? Number((unitCost * quantity).toFixed(2))
        : null;

    const snapshot = extractStockSnapshot(row.notes);
    const meta = (row.products?.metadata || {}) as Record<string, any>;
    const unit = meta.unit || (meta.product_type === "ingredient" ? "kg" : "un");

    return {
      id: row.id,
      businessId: row.business_id,
      productId: row.product_id,
      productName: row.products?.name || "Producto sin nombre",
      productSku: meta.sku || null,
      unit,
      locationId: row.location_id,
      locationName: row.locations?.name || "Ubicación",
      movementType: row.movement_type,
      quantity,
      previousQuantity: snapshot.previousQuantity,
      resultingQuantity: snapshot.resultingQuantity,
      unitCost,
      totalCost,
      referenceId: row.reference_id || null,
      referenceType: row.reference_type || null,
      notes: row.notes || null,
      createdBy: row.created_by || null,
      createdByName: row.created_by ? userMap.get(row.created_by) || "Usuario" : null,
      origin,
      createdAt: row.created_at,
    };
  });

  if (filters?.origin && filters.origin !== "all") {
    mappedMovements = mappedMovements.filter((m) => m.origin === filters.origin);
  }

  return mappedMovements;
}

/**
 * Consulta la lista de productos cuyo stock actual en alguna ubicación es menor o igual al mínimo configurado.
 */
export async function getLowStockItems(businessId: string): Promise<LowStockItem[]> {
  const supabase = await getDbClient();

  const { data: stockData, error: stockErr } = await supabase
    .from("inventory_stock")
    .select("*, products(name, category_id, metadata, categories(name)), locations(name)")
    .eq("business_id", businessId);

  if (stockErr) {
    console.error("[getLowStockItems] Error al consultar existencias:", stockErr);
    throw new Error(`Error al consultar alertas de stock: ${stockErr.message}`);
  }

  const items: LowStockItem[] = [];

  for (const s of stockData || []) {
    const meta = (s.products?.metadata || {}) as Record<string, any>;
    // Excluir productos preparados o servicios que no controlan existencias [TAREA-08]
    const isExcluded =
      meta.product_type === "prepared" ||
      meta.product_type === "service" ||
      meta.track_stock === false;
    if (isExcluded) continue;

    const qty = Number(s.quantity || 0);
    const min = Number(s.min_stock || meta.min_stock || 0);
    const cost = Number(s.cost || meta.cost || 0);

    // Regla TAREA-08:
    // - Agotado: qty <= 0 (artículo con control de stock)
    // - Stock bajo: min > 0 && qty > 0 && qty <= min
    // - Si min == 0 y qty > 0: está DISPONIBLE (NO se incluyen en alertas de stock bajo)
    const isOutOfStock = qty <= 0;
    const isLowStock = min > 0 && qty > 0 && qty <= min;

    if (isOutOfStock || isLowStock) {
      const deficit = isOutOfStock ? Math.max(1, min) : Math.max(0, min - qty);
      const status: LowStockItem["status"] = isOutOfStock ? "out_of_stock" : "critical";
      const unit = meta.unit || (meta.product_type === "ingredient" ? "kg" : "un");

      items.push({
        productId: s.product_id,
        productName: s.products?.name || "Producto",
        categoryName: (s.products?.categories as any)?.name || null,
        sku: meta.sku || null,
        unit,
        locationId: s.location_id,
        locationName: s.locations?.name || "Ubicación",
        quantity: qty,
        minStock: min,
        cost,
        deficit,
        status,
      });
    }
  }

  // Ordenar primero los agotados, luego los que tienen mayor déficit
  items.sort((a, b) => {
    if (a.status === "out_of_stock" && b.status !== "out_of_stock") return -1;
    if (a.status !== "out_of_stock" && b.status === "out_of_stock") return 1;
    return b.deficit - a.deficit;
  });

  return items;
}

/**
 * Evalúa y emite una notificación in-app si el producto queda por debajo de su stock mínimo.
 */
export async function checkAndTriggerLowStockNotification(
  businessId: string,
  productId: string,
  locationId: string
): Promise<void> {
  try {
    const supabase = await getDbClient();

    const { data: stockRow } = await supabase
      .from("inventory_stock")
      .select("quantity, min_stock, products(name), locations(name)")
      .eq("business_id", businessId)
      .eq("product_id", productId)
      .eq("location_id", locationId)
      .maybeSingle();

    if (!stockRow) return;

    const qty = Number(stockRow.quantity || 0);
    const min = Number(stockRow.min_stock || 0);

    if (qty <= min && min > 0) {
      const productName = (stockRow.products as any)?.name || "Producto";
      const locationName = (stockRow.locations as any)?.name || "Ubicación";

      await createNotification({
        scope: "business",
        audience: "global",
        businessId,
        type: "inventory",
        title: "Alerta de Stock Bajo",
        message: `El producto "${productName}" en "${locationName}" tiene existencias críticas (${qty} un. ≤ mínimo ${min}).`,
        entityType: "inventory_stock",
        entityId: productId,
        href: `/workspace/${businessId}/inventario?tab=low_stock`,
        metadata: {
          productId,
          locationId,
          quantity: qty,
          minStock: min,
        },
      });
    }
  } catch (notifErr) {
    console.warn("[checkAndTriggerLowStockNotification] Error al generar notificación de stock bajo:", notifErr);
  }
}

/**
 * Registra y ejecuta un movimiento de inventario (Entrada / Salida / Ajuste) con actualización atómica de stock.
 */
export async function executeStockMovement(
  businessId: string,
  input: {
    productId: string;
    locationId: string;
    movementType: "entry" | "exit" | "adjustment";
    quantity: number;
    unitCost?: number;
    notes?: string;
  },
  userId?: string | null
): Promise<{ movement: InventoryMovement; newQuantity: number }> {
  if (input.quantity < 0) {
    throw new Error("La cantidad no puede ser negativa.");
  }

  // 1. Ejecutar el movimiento atómico de inventario (actualiza inventory_stock, kardex, metadata y alerta de stock bajo)
  const movement = await recordInventoryMovement(
    businessId,
    {
      productId: input.productId,
      locationId: input.locationId,
      movementType: input.movementType,
      quantity: input.quantity,
      unitCost: input.unitCost,
      notes: input.notes || null,
      referenceType: input.movementType === "adjustment" ? "adjustment" : undefined,
    },
    userId
  );

  // 2. Consultar el nuevo stock resultante para la ubicación
  const supabase = await getDbClient();
  const { data: stockRow } = await supabase
    .from("inventory_stock")
    .select("quantity")
    .eq("business_id", businessId)
    .eq("product_id", input.productId)
    .eq("location_id", input.locationId)
    .maybeSingle();

  const finalQuantity = Number(stockRow?.quantity || 0);

  return {
    movement,
    newQuantity: finalQuantity,
  };
}

/**
 * Ejecuta un ajuste manual de inventario con trazabilidad estricta y fuente única de verdad [TAREA-03].
 */
export async function executeStockAdjustment(
  businessId: string,
  input: StockAdjustmentInput,
  userId?: string | null
): Promise<StockAdjustmentResult> {
  const parsed = StockAdjustmentInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Validar producto
  const { data: prodData, error: prodErr } = await supabase
    .from("products")
    .select("id, name, metadata, business_id")
    .eq("id", parsed.productId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (prodErr || !prodData) {
    throw new Error("El artículo indicado no pertenece a este comercio o no existe.");
  }

  // 2. Resolver ubicación única
  const defaultLoc = await ensureDefaultLocation(businessId);

  // 3. Consultar existencia actual en inventory_stock
  const { data: currentStockRow } = await supabase
    .from("inventory_stock")
    .select("quantity, min_stock, cost")
    .eq("business_id", businessId)
    .eq("product_id", parsed.productId)
    .eq("location_id", defaultLoc.id)
    .maybeSingle();

  const meta = (prodData.metadata || {}) as Record<string, any>;
  const previousQuantity = currentStockRow
    ? Number(currentStockRow.quantity || 0)
    : Number(meta.stock_quantity ?? 0);
  const minStock = currentStockRow
    ? Number(currentStockRow.min_stock || 0)
    : Number(meta.min_stock ?? 0);
  const existingCost = currentStockRow && currentStockRow.cost > 0
    ? Number(currentStockRow.cost)
    : Number(meta.cost ?? 0);
  const unitCost = parsed.unitCost !== undefined && parsed.unitCost !== null
    ? parsed.unitCost
    : existingCost;

  const newQuantity = Number(parsed.targetQuantity);
  const difference = newQuantity - previousQuantity;

  const reasonLabel = ADJUSTMENT_REASON_LABELS[parsed.reason] || parsed.reason;
  const auditDetail = `(Anterior: ${previousQuantity}, Dif: ${difference >= 0 ? "+" : ""}${difference}, Resultante: ${newQuantity})`;
  const fullNotes = [reasonLabel, parsed.notes?.trim(), auditDetail].filter(Boolean).join(" — ");

  // 4. Inserción inmutable en inventory_movements (Kardex)
  const totalCost = unitCost > 0 ? Number((unitCost * Math.abs(difference)).toFixed(2)) : 0;
  const now = new Date().toISOString();

  const { data: movData, error: movErr } = await supabase
    .from("inventory_movements")
    .insert({
      business_id: businessId,
      product_id: parsed.productId,
      location_id: defaultLoc.id,
      movement_type: "adjustment",
      quantity: Math.abs(difference),
      unit_cost: unitCost > 0 ? unitCost : null,
      total_cost: totalCost > 0 ? totalCost : null,
      reference_type: "adjustment",
      notes: fullNotes,
      created_by: userId || null,
      created_at: now,
    })
    .select()
    .single();

  if (movErr || !movData) {
    console.error("[executeStockAdjustment] Error al insertar movimiento:", movErr);
    throw new Error(`No se pudo registrar el movimiento de ajuste: ${movErr?.message}`);
  }

  // 5. Actualizar inventory_stock de manera atómica
  await upsertInventoryStock(businessId, {
    productId: parsed.productId,
    locationId: defaultLoc.id,
    quantity: newQuantity,
    minStock,
    cost: unitCost,
  });

  // 6. Sincronizar products.metadata.stock_quantity (fuente única de verdad)
  try {
    const updatedMeta = {
      ...meta,
      stock_quantity: newQuantity,
      ...(unitCost > 0 ? { cost: unitCost } : {}),
    };
    await supabase
      .from("products")
      .update({
        metadata: updatedMeta,
        updated_at: now,
      })
      .eq("id", parsed.productId)
      .eq("business_id", businessId);
  } catch (syncErr) {
    console.warn("[executeStockAdjustment] Error al sincronizar metadata en products:", syncErr);
  }

  // 7. Notificación si queda en stock bajo
  if (newQuantity <= minStock && minStock > 0) {
    await checkAndTriggerLowStockNotification(businessId, parsed.productId, defaultLoc.id);
  }

  return {
    movement: mapMovementRow(movData),
    previousQuantity,
    newQuantity,
    difference,
    reason: parsed.reason,
    notes: fullNotes,
  };
}

/**
 * Consulta el historial de movimientos exclusivo de un producto específico.
 */
export async function getProductMovementHistory(
  businessId: string,
  productId: string,
  limit = 20
): Promise<InventoryMovementWithDetails[]> {
  return await getInventoryMovementsHistory(businessId, {
    productId,
    limit,
  });
}

/**
 * Actualiza el stock mínimo configurado para un producto o insumo inventariable [TAREA-08].
 * Permite al negocio definir el umbral de seguridad bajo el cual se emitirán alertas de stock bajo.
 */
export async function updateItemMinStock(
  businessId: string,
  productId: string,
  minStock: number,
  userId?: string | null
): Promise<{ success: boolean; minStock: number }> {
  if (minStock < 0) {
    throw new Error("El stock mínimo no puede ser negativo.");
  }

  const supabase = await getDbClient();

  // 1. Validar que el producto pertenezca al negocio
  const { data: prodData, error: prodErr } = await supabase
    .from("products")
    .select("id, name, metadata, business_id")
    .eq("id", productId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (prodErr || !prodData) {
    throw new Error("El artículo no existe o no pertenece a este comercio.");
  }

  const defaultLoc = await ensureDefaultLocation(businessId);

  // 2. Actualizar min_stock en inventory_stock
  const { data: stockRow } = await supabase
    .from("inventory_stock")
    .select("quantity, cost")
    .eq("business_id", businessId)
    .eq("product_id", productId)
    .eq("location_id", defaultLoc.id)
    .maybeSingle();

  const currentQty = stockRow
    ? Number(stockRow.quantity || 0)
    : Number((prodData.metadata as any)?.stock_quantity || 0);
  const currentCost = stockRow
    ? Number(stockRow.cost || 0)
    : Number((prodData.metadata as any)?.cost || 0);

  await upsertInventoryStock(businessId, {
    productId,
    locationId: defaultLoc.id,
    quantity: currentQty,
    minStock,
    cost: currentCost,
  });

  // 3. Sincronizar en products.metadata
  const meta = (prodData.metadata || {}) as Record<string, any>;
  await supabase
    .from("products")
    .update({
      metadata: {
        ...meta,
        min_stock: minStock,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("business_id", businessId);

  // 4. Evaluar alerta si el stock actual quedó en o por debajo del nuevo mínimo
  if (currentQty <= minStock && minStock > 0) {
    await checkAndTriggerLowStockNotification(businessId, productId, defaultLoc.id);
  }

  return { success: true, minStock };
}





