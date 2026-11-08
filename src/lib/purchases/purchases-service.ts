import { createClient } from "@/lib/supabase/server";
import {
  Supplier,
  CreateSupplierInput,
  CreateSupplierInputSchema,
  UpdateSupplierInput,
  UpdateSupplierInputSchema,
  Purchase,
  PurchaseItem,
  CreatePurchaseInput,
  CreatePurchaseInputSchema,
  AccountsPayable,
  PurchaseKPIs,
  PurchaseFilters,
  PurchasePeriodPreset,
  PurchasePaymentStatus,
  AccountsPayableWithDetails,
  AccountPayablePayment,
  RegisterPaymentInput,
  RegisterPaymentInputSchema,
  AccountsPayableKPIs,
  AccountsPayableFilters,
} from "./types";
import {
  recordInventoryMovement,
  upsertInventoryStock,
  ensureDefaultLocation,
} from "@/lib/inventory/inventory-service";
import {
  getActiveCashSession,
  recordCashMovement,
} from "@/lib/cash/cash-service";
import {
  convertQuantity,
  getConversionFactor,
} from "@/lib/recipes/unit-conversion";

/**
 * Calcula el Costo Promedio Ponderado (CPP) al ingresar una compra de producto inventariable [PROV-004]:
 * nuevo_costo = (stock_actual * costo_actual + cantidad_comprada * costo_compra) / (stock_actual + cantidad_comprada)
 */
export function calculateWeightedAverageCost(
  currentStock: number,
  currentCost: number,
  purchasedQuantity: number,
  purchaseUnitCost: number
): number {
  const safeCurrentStock = Math.max(0, Number(currentStock) || 0);
  const safeCurrentCost = Math.max(0, Number(currentCost) || 0);
  const safePurchasedQty = Math.max(0, Number(purchasedQuantity) || 0);
  const safePurchaseCost = Math.max(0, Number(purchaseUnitCost) || 0);

  if (safePurchasedQty <= 0) {
    return Number(safeCurrentCost.toFixed(2));
  }

  if (safeCurrentStock <= 0) {
    return Number(safePurchaseCost.toFixed(2));
  }

  const totalValuation =
    safeCurrentStock * safeCurrentCost + safePurchasedQty * safePurchaseCost;
  const totalUnits = safeCurrentStock + safePurchasedQty;

  return Number((totalValuation / totalUnits).toFixed(2));
}

/**
 * Cliente de base de datos con privilegios para garantizar operaciones transaccionales seguras.
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

// ==============================================================================
// GESTIÓN DE PROVEEDORES (PROV-001)
// ==============================================================================

function mapSupplierRow(row: any): Supplier {
  return {
    id: String(row.id),
    businessId: String(row.business_id || row.businessId),
    name: row.name || "",
    contactName: row.contact_name ?? row.contactName ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    taxId: row.tax_id ?? row.taxId ?? null,
    paymentTermsDays: Number(row.payment_terms_days ?? row.paymentTermsDays ?? 0),
    notes: row.notes ?? null,
    status: row.status ?? "active",
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
  };
}

async function getSuppliersFromSettings(businessId: string): Promise<Supplier[]> {
  try {
    const supabase = await getDbClient();
    const { data, error } = await supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    if (error || !data) return [];
    const settings = (data.settings || {}) as any;
    const rawList = Array.isArray(settings.suppliers) ? settings.suppliers : [];
    return rawList
      .filter((s: any) => s.status !== "archived")
      .map(mapSupplierRow)
      .sort((a: Supplier, b: Supplier) => a.name.localeCompare(b.name));
  } catch (err) {
    console.warn("[getSuppliersFromSettings] Error:", err);
    return [];
  }
}

async function saveSuppliersToSettings(businessId: string, suppliers: Supplier[]): Promise<void> {
  const supabase = await getDbClient();
  const { data } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();

  const currentSettings = (data?.settings || {}) as any;
  const updatedSettings = {
    ...currentSettings,
    suppliers,
  };

  const { error } = await supabase
    .from("businesses")
    .update({ settings: updatedSettings })
    .eq("id", businessId);

  if (error) {
    console.error("[saveSuppliersToSettings] Error al persistir proveedores:", error);
    throw new Error(`Error al guardar proveedor: ${error.message}`);
  }
}

export function findDuplicateSupplier(
  existingSuppliers: Supplier[],
  name: string,
  taxId?: string | null,
  excludeId?: string
): Supplier | null {
  const cleanName = name.trim().toLowerCase();
  const cleanTaxId = taxId?.trim().toLowerCase();

  return (
    existingSuppliers.find((s) => {
      if (excludeId && s.id === excludeId) return false;
      if (s.status === "archived") return false;

      // Coincidencia por nombre idéntico (case-insensitive)
      if (s.name.trim().toLowerCase() === cleanName) return true;

      // Coincidencia por NIT o identificación si ambos están definidos
      if (cleanTaxId && s.taxId && s.taxId.trim().toLowerCase() === cleanTaxId) {
        return true;
      }

      return false;
    }) || null
  );
}

/**
 * Consulta la lista de proveedores del comercio.
 * Resiliente: si la tabla 'suppliers' no está en el schema cache de Supabase Cloud,
 * utiliza de forma transparente el almacén por negocio en businesses.settings.
 */
export async function getSuppliers(businessId: string): Promise<Supplier[]> {
  const supabase = await getDbClient();
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("business_id", businessId)
      .neq("status", "archived")
      .order("name", { ascending: true });

    if (error) {
      if (
        error.code === "PGRST205" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("does not exist")
      ) {
        return await getSuppliersFromSettings(businessId);
      }
      console.warn("[getSuppliers] Error en consulta a tabla, recurriendo a fallback:", error.message);
      return await getSuppliersFromSettings(businessId);
    }

    // Si la tabla devolvió filas, retornar; si está vacía, revisar si había registros en settings para migración fluida
    if (data && data.length > 0) {
      return data.map(mapSupplierRow);
    }
    const fromSettings = await getSuppliersFromSettings(businessId);
    return fromSettings.length > 0 ? fromSettings : [];
  } catch (err: any) {
    console.warn("[getSuppliers] Excepción capturada, fallback a settings:", err?.message);
    return await getSuppliersFromSettings(businessId);
  }
}

/**
 * Registra un nuevo proveedor en el negocio.
 * Valida unicidad (evita duplicados de nombre/NIT) y garantiza persistencia.
 */
export async function createSupplier(
  businessId: string,
  input: CreateSupplierInput
): Promise<Supplier> {
  const parsed = CreateSupplierInputSchema.parse(input);

  // 1. Validar que no exista un proveedor duplicado en este negocio
  const currentSuppliers = await getSuppliers(businessId);
  const duplicate = findDuplicateSupplier(currentSuppliers, parsed.name, parsed.taxId);
  if (duplicate) {
    throw new Error(
      `Ya existe un proveedor registrado con el nombre "${parsed.name}"${
        parsed.taxId ? " o esa identificación" : ""
      } en tu negocio.`
    );
  }

  const supabase = await getDbClient();
  const nowIso = new Date().toISOString();

  // 2. Intentar inserción en tabla 'suppliers'
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        business_id: businessId,
        name: parsed.name.trim(),
        contact_name: parsed.contactName?.trim() || null,
        phone: parsed.phone?.trim() || null,
        email: parsed.email?.trim() || null,
        address: parsed.address?.trim() || null,
        tax_id: parsed.taxId?.trim() || null,
        payment_terms_days: parsed.paymentTermsDays || 0,
        notes: parsed.notes?.trim() || null,
        status: "active",
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .maybeSingle();

    if (!error && data) {
      return mapSupplierRow(data);
    }

    if (
      error &&
      (error.code === "PGRST205" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("does not exist"))
    ) {
      // Proceder con fallback
    } else if (error) {
      console.warn("[createSupplier] Error en tabla suppliers, usando persistencia fallback:", error.message);
    }
  } catch (tableErr: any) {
    console.warn("[createSupplier] Excepción en tabla suppliers:", tableErr?.message);
  }

  // 3. Fallback: Persistir en businesses.settings.suppliers
  const newSupplier: Supplier = {
    id: crypto.randomUUID(),
    businessId,
    name: parsed.name.trim(),
    contactName: parsed.contactName?.trim() || null,
    phone: parsed.phone?.trim() || null,
    email: parsed.email?.trim() || null,
    address: parsed.address?.trim() || null,
    taxId: parsed.taxId?.trim() || null,
    paymentTermsDays: parsed.paymentTermsDays || 0,
    notes: parsed.notes?.trim() || null,
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const { data: bData } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .single();

  const settings = (bData?.settings || {}) as any;
  const rawSuppliers = Array.isArray(settings.suppliers) ? settings.suppliers : [];
  const updatedSuppliers = [newSupplier, ...rawSuppliers];

  await saveSuppliersToSettings(businessId, updatedSuppliers);
  return newSupplier;
}

/**
 * Actualiza los datos de un proveedor existente.
 */
export async function updateSupplier(
  businessId: string,
  supplierId: string,
  input: UpdateSupplierInput
): Promise<Supplier> {
  const parsed = UpdateSupplierInputSchema.parse(input);
  const currentSuppliers = await getSuppliers(businessId);
  const target = currentSuppliers.find((s) => s.id === supplierId);

  if (!target && parsed.status !== "archived") {
    throw new Error("El proveedor que intentas editar no existe en este negocio.");
  }

  // Si se modifica nombre o NIT, validar duplicados excluyendo el proveedor actual
  const checkName = parsed.name ?? target?.name;
  if (checkName) {
    const checkTaxId = parsed.taxId !== undefined ? parsed.taxId : target?.taxId;
    const duplicate = findDuplicateSupplier(currentSuppliers, checkName, checkTaxId, supplierId);
    if (duplicate) {
      throw new Error(
        `Ya existe otro proveedor registrado con el nombre "${checkName}" o esa identificación.`
      );
    }
  }

  const supabase = await getDbClient();
  const nowIso = new Date().toISOString();

  // Intentar actualización en tabla 'suppliers'
  try {
    const updatePayload: Record<string, any> = { updated_at: nowIso };
    if (parsed.name !== undefined) updatePayload.name = parsed.name.trim();
    if (parsed.contactName !== undefined) updatePayload.contact_name = parsed.contactName?.trim() || null;
    if (parsed.phone !== undefined) updatePayload.phone = parsed.phone?.trim() || null;
    if (parsed.email !== undefined) updatePayload.email = parsed.email?.trim() || null;
    if (parsed.address !== undefined) updatePayload.address = parsed.address?.trim() || null;
    if (parsed.taxId !== undefined) updatePayload.tax_id = parsed.taxId?.trim() || null;
    if (parsed.paymentTermsDays !== undefined) updatePayload.payment_terms_days = parsed.paymentTermsDays;
    if (parsed.notes !== undefined) updatePayload.notes = parsed.notes?.trim() || null;
    if (parsed.status !== undefined) updatePayload.status = parsed.status;

    const { data, error } = await supabase
      .from("suppliers")
      .update(updatePayload)
      .eq("id", supplierId)
      .eq("business_id", businessId)
      .select()
      .maybeSingle();

    if (!error && data) {
      return mapSupplierRow(data);
    }
  } catch (err: any) {
    console.warn("[updateSupplier] Excepción en tabla suppliers:", err?.message);
  }

  // Fallback: Actualizar en businesses.settings.suppliers
  const { data: bData } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .single();

  const settings = (bData?.settings || {}) as any;
  const rawSuppliers = Array.isArray(settings.suppliers) ? settings.suppliers : [];
  const idx = rawSuppliers.findIndex((s: any) => String(s.id) === String(supplierId));

  if (idx === -1) {
    throw new Error("No se encontró el proveedor a actualizar.");
  }

  const current = rawSuppliers[idx];
  const updatedItem: Supplier = {
    ...current,
    name: parsed.name !== undefined ? parsed.name.trim() : current.name,
    contactName: parsed.contactName !== undefined ? parsed.contactName?.trim() || null : current.contactName,
    phone: parsed.phone !== undefined ? parsed.phone?.trim() || null : current.phone,
    email: parsed.email !== undefined ? parsed.email?.trim() || null : current.email,
    address: parsed.address !== undefined ? parsed.address?.trim() || null : current.address,
    taxId: parsed.taxId !== undefined ? parsed.taxId?.trim() || null : current.taxId,
    paymentTermsDays: parsed.paymentTermsDays !== undefined ? parsed.paymentTermsDays : current.paymentTermsDays,
    notes: parsed.notes !== undefined ? parsed.notes?.trim() || null : current.notes,
    status: parsed.status !== undefined ? parsed.status : current.status,
    updatedAt: nowIso,
  };

  rawSuppliers[idx] = updatedItem;
  await saveSuppliersToSettings(businessId, rawSuppliers);
  return updatedItem;
}

/**
 * Activa o desactiva lógicamente un proveedor.
 * Garantiza que un proveedor desactivado conserve toda su relación con compras históricas
 * pero deje de aparecer para nuevas compras.
 */
export async function toggleSupplierStatus(
  businessId: string,
  supplierId: string,
  newStatus: "active" | "inactive"
): Promise<Supplier> {
  return await updateSupplier(businessId, supplierId, { status: newStatus });
}

/**
 * Archiva lógicamente un proveedor (borrado lógico no destructivo).
 */
export async function deleteSupplier(
  businessId: string,
  supplierId: string
): Promise<void> {
  try {
    await updateSupplier(businessId, supplierId, { status: "archived" });
  } catch (err: any) {
    if (err?.message?.includes("No se encontró el proveedor")) {
      return;
    }
    throw err;
  }
}

// ==============================================================================
// GESTIÓN DE COMPRAS Y KARDEX (PROV-002)
// ==============================================================================

function mapPurchaseRow(row: any): Purchase {
  const meta = (row.metadata as Record<string, any>) || {};
  const ap = Array.isArray(row.accounts_payable)
    ? row.accounts_payable[0]
    : row.accounts_payable;
  const isCredit = row.payment_type === "credit";
  const isCancelled = row.status === "cancelled";

  let paidAmount = 0;
  let balance = 0;
  let paymentStatus: PurchasePaymentStatus = "paid";

  const totalAmount = Number(row.total || 0);

  if (isCancelled) {
    paymentStatus = "cancelled";
    paidAmount = Number(meta.paid_amount ?? (isCredit ? (ap?.paid_amount ?? ap?.paidAmount ?? 0) : totalAmount));
    balance = 0;
  } else if (!isCredit) {
    paidAmount = totalAmount;
    balance = 0;
    paymentStatus = "paid";
  } else {
    // Es a crédito
    const apPaid = ap ? Number(ap.paid_amount ?? ap.paidAmount ?? 0) : Number(meta.paid_amount || 0);
    const apBalance = ap ? Number(ap.balance ?? (totalAmount - apPaid)) : Number(meta.balance ?? totalAmount);

    paidAmount = Number(apPaid.toFixed(2));
    balance = Number(Math.max(0, apBalance).toFixed(2));

    if (balance <= 0 || ap?.status === "paid") {
      paymentStatus = "paid";
    } else if (paidAmount > 0 || ap?.status === "partially_paid" || ap?.status === "partial") {
      paymentStatus = "partially_paid";
    } else {
      paymentStatus = "pending";
    }
  }

  const itemsArray = Array.isArray(row.purchase_items) ? row.purchase_items : [];

  return {
    id: row.id,
    businessId: row.business_id,
    purchaseNumber: row.purchase_number,
    supplierId: row.supplier_id ?? null,
    supplierName: row.suppliers?.name ?? meta.supplier_name ?? null,
    supplierTaxId: row.suppliers?.tax_id ?? meta.supplier_tax_id ?? null,
    invoiceNumber: row.invoice_number ?? null,
    documentType: meta.document_type || row.document_type || "factura",
    purchaseDate: row.purchase_date,
    dueDate: ap?.due_date || meta.due_date || row.due_date || null,
    subtotal: Number(row.subtotal || 0),
    discountAmount: Number(meta.discount_amount || row.discount_amount || 0),
    taxAmount: Number(row.tax_amount || 0),
    retentionAmount: Number(meta.retention_amount || row.retention_amount || 0),
    total: totalAmount,
    paidAmount,
    balance,
    paymentType: row.payment_type || "cash",
    paymentMethod: row.payment_method || "cash",
    paymentStatus,
    status: row.status || "confirmed",
    itemsCount: itemsArray.length || Number(meta.items_count || 0),
    notes: row.notes ?? null,
    deductFromCashRegister: Boolean(
      row.deduct_from_cash_register ??
      meta.deduct_from_cash_register ??
      (row.payment_type === "cash" && row.payment_method === "cash")
    ),
    cashRegisterName:
      row.cash_register_name ??
      meta.cash_register_name ??
      (row.payment_type === "cash" && row.payment_method === "cash" ? "Caja Principal" : null),
    createdBy: row.created_by ?? null,
    cancellationReason: meta.cancellation_reason || null,
    cancelledAt: meta.cancelled_at || null,
    cancelledBy: meta.cancelled_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: itemsArray.map((it: any): PurchaseItem => ({
      id: it.id,
      purchaseId: it.purchase_id,
      businessId: it.business_id,
      productId: it.product_id ?? null,
      itemName: it.item_name,
      quantity: Number(it.quantity || 0),
      unitCost: Number(it.unit_cost || 0),
      totalCost: Number(it.total_cost || 0),
      locationId: it.location_id ?? null,
      locationName: it.location_name || it.locations?.name || null,
      isInventoryItem: Boolean(it.is_inventory_item),
      itemCategory: it.item_category || it.itemCategory || undefined,
      purchaseUnit: it.purchase_unit || it.metadata?.purchase_unit || null,
      inventoryUnit: it.inventory_unit || it.metadata?.inventory_unit || null,
      conversionFactor: Number(it.conversion_factor || it.metadata?.conversion_factor || 1),
      inventoryQuantity: Number(it.inventory_quantity || it.metadata?.inventory_quantity || it.quantity || 0),
      discount: Number(it.discount || it.metadata?.discount || 0),
      createdAt: it.created_at,
    })),
    accountPayable: ap
      ? {
          id: ap.id,
          businessId: ap.business_id,
          purchaseId: ap.purchase_id,
          supplierId: ap.supplier_id ?? null,
          totalAmount: Number(ap.total_amount || 0),
          paidAmount: Number(ap.paid_amount || 0),
          balance: Number(ap.balance || 0),
          dueDate: ap.due_date,
          status: ap.status,
          notes: ap.notes ?? null,
          createdAt: ap.created_at,
          updatedAt: ap.updated_at,
        }
      : null,
    impactSummary: row.impact_summary || meta.impact_summary || null,
  };
}

/**
 * Genera el siguiente código correlativo de compra por negocio (COMP-XXXXX).
 */
export async function generateNextPurchaseNumber(businessId: string): Promise<string> {
  const supabase = await getDbClient();

  try {
    const { data, error } = await supabase.rpc("get_next_purchase_number", {
      p_business_id: businessId,
    });
    if (!error && data) {
      return data as string;
    }
  } catch (rpcErr) {
    console.warn("[generateNextPurchaseNumber] RPC get_next_purchase_number fallo, usando fallback:", rpcErr);
  }

  // Fallback seguro: consultar compras existentes y generar siguiente número
  const { data: purchases } = await supabase
    .from("purchases")
    .select("purchase_number")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  let maxNum = 0;
  if (purchases && purchases.length > 0) {
    for (const p of purchases) {
      const match = p.purchase_number?.match(/^COMP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `COMP-${String(nextNum).padStart(5, "0")}`;
}

/**
 * Registra una nueva compra a proveedor con actualización atómica de existencias,
 * recálculo de costo promedio y generación de cuenta por pagar si es a crédito.
 */
export async function createPurchase(
  businessId: string,
  input: CreatePurchaseInput,
  userId?: string | null
): Promise<Purchase> {
  const parsed = CreatePurchaseInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Validar proveedor si fue especificado
  let supplier: Supplier | null = null;
  if (parsed.supplierId) {
    try {
      const { data: sData } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", parsed.supplierId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (sData) {
        supplier = mapSupplierRow(sData);
      }
    } catch (sErr) {
      console.warn("[createPurchase] No se pudo cargar proveedor:", sErr);
    }
  }

  // 2. Calcular subtotales, descuentos y validar artículos
  let grossSubtotal = 0;
  const itemsToInsert: any[] = [];

  for (const item of parsed.items) {
    const itemDiscount = Math.max(0, Number(item.discount || 0));
    const lineGross = Number((item.quantity * item.unitCost).toFixed(2));
    const lineNet = Math.max(0, lineGross - itemDiscount);
    grossSubtotal += lineNet;

    itemsToInsert.push({
      productId: item.productId || null,
      itemName: item.itemName.trim(),
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: lineNet,
      discount: itemDiscount,
      locationId: item.locationId || null,
      isInventoryItem: item.isInventoryItem,
      itemCategory: item.itemCategory,
      purchaseUnit: item.purchaseUnit || null,
      inventoryUnit: item.inventoryUnit || null,
      conversionFactor: item.conversionFactor || 1,
    });
  }

  const globalDiscount = Math.max(0, Number(parsed.discountAmount || 0));
  const subtotal = Number(Math.max(0, grossSubtotal - globalDiscount).toFixed(2));
  const taxAmount = Number(((subtotal * (parsed.taxPercentage || 0)) / 100).toFixed(2));
  const retentionAmount = Number(((subtotal * (parsed.retentionPercentage || 0)) / 100).toFixed(2));
  const total = Number(Math.max(0, subtotal + taxAmount - retentionAmount).toFixed(2));

  // 3. Generar número de compra correlativo (COMP-XXXXX)
  const purchaseNumber = await generateNextPurchaseNumber(businessId);
  const purchaseDate = parsed.purchaseDate || new Date().toISOString();

  // 4. Calcular pagos iniciales y saldo pendiente
  let paidAmount = 0;
  let balance = 0;
  let paymentStatus: PurchasePaymentStatus = "paid";
  let dueDate: string | null = null;

  if (parsed.paymentType === "cash") {
    paidAmount = total;
    balance = 0;
    paymentStatus = "paid";
  } else {
    // Crédito o Pago Parcial
    const initialPay = Math.min(total, Math.max(0, Number(parsed.initialPaymentAmount || 0)));
    paidAmount = Number(initialPay.toFixed(2));
    balance = Number(Math.max(0, total - initialPay).toFixed(2));
    paymentStatus = balance <= 0 ? "paid" : (paidAmount > 0 ? "partially_paid" : "pending");

    dueDate = parsed.dueDate || null;
    if (!dueDate) {
      const termsDays = supplier?.paymentTermsDays || 30;
      const targetDate = new Date(purchaseDate);
      targetDate.setDate(targetDate.getDate() + termsDays);
      dueDate = targetDate.toISOString();
    }
  }

  // 5. Insertar cabecera de la compra
  const initialMetadata: Record<string, any> = {
    document_type: parsed.documentType || "factura",
    discount_amount: globalDiscount,
    retention_amount: retentionAmount,
    paid_amount: paidAmount,
    balance: balance,
    payment_status: paymentStatus,
    due_date: dueDate,
    supplier_name: supplier?.name || null,
    supplier_tax_id: supplier?.taxId || null,
    items_count: itemsToInsert.length,
  };

  const { data: purchaseData, error: purchaseErr } = await supabase
    .from("purchases")
    .insert({
      business_id: businessId,
      purchase_number: purchaseNumber,
      supplier_id: parsed.supplierId || null,
      invoice_number: parsed.invoiceNumber?.trim() || null,
      purchase_date: purchaseDate,
      subtotal,
      tax_amount: taxAmount,
      total,
      payment_type: parsed.paymentType,
      payment_method: parsed.paymentMethod,
      status: "confirmed",
      notes: parsed.notes?.trim() || null,
      created_by: userId || null,
      metadata: initialMetadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (purchaseErr || !purchaseData) {
    console.error("[createPurchase] Error al registrar cabecera de compra:", purchaseErr);
    throw new Error(`Error al registrar la compra: ${purchaseErr?.message}`);
  }

  const purchaseId = purchaseData.id;

  // 6. Insertar ítems de la compra
  const itemsPayload = itemsToInsert.map((it) => ({
    purchase_id: purchaseId,
    business_id: businessId,
    product_id: it.productId,
    item_name: it.itemName,
    quantity: it.quantity,
    unit_cost: it.unitCost,
    total_cost: it.totalCost,
    location_id: it.locationId,
    is_inventory_item: it.isInventoryItem,
    item_category: it.itemCategory || (it.isInventoryItem ? "ingredient" : "free"),
    created_at: new Date().toISOString(),
  }));

  const { data: insertedItems, error: itemsErr } = await supabase
    .from("purchase_items")
    .insert(itemsPayload)
    .select();

  if (itemsErr) {
    console.error("[createPurchase] Error al insertar ítems de compra:", itemsErr);
    throw new Error(`Error al registrar ítems de la compra: ${itemsErr.message}`);
  }

  // 7. Procesar afectación de inventario con conversión de unidades y costo promedio ponderado
  const inventoryImpacts: Array<{
    productId?: string | null;
    itemName: string;
    itemCategory: "ingredient" | "resale" | "free";
    quantityAdded: number;
    previousStock: number;
    newStock: number;
    previousCost: number;
    newAverageCost: number;
    unit: string;
    locationName?: string | null;
  }> = [];

  for (const item of itemsToInsert) {
    if (item.isInventoryItem && item.productId) {
      try {
        let targetLocationId = item.locationId;
        if (!targetLocationId) {
          const defaultLoc = await ensureDefaultLocation(businessId);
          targetLocationId = defaultLoc.id;
        }

        let locationName = "Bodega Principal";
        try {
          const { data: locData } = await supabase
            .from("locations")
            .select("name")
            .eq("id", targetLocationId)
            .eq("business_id", businessId)
            .maybeSingle();
          if (locData?.name) {
            locationName = locData.name;
          }
        } catch {
          // Continuar con nombre por defecto
        }

        const { data: currentStockRow } = await supabase
          .from("inventory_stock")
          .select("quantity, cost, min_stock")
          .eq("business_id", businessId)
          .eq("product_id", item.productId)
          .eq("location_id", targetLocationId)
          .maybeSingle();

        const { data: prodData } = await supabase
          .from("products")
          .select("metadata, cost_price, available_in_pos")
          .eq("id", item.productId)
          .eq("business_id", businessId)
          .maybeSingle();

        const prodMeta = ((prodData?.metadata as Record<string, any>) || {});

        // Validación: Prohibir compra directa de preparados y servicios
        if (prodMeta.product_type === "prepared" || prodMeta.has_recipe || prodMeta.is_recipe) {
          throw new Error(
            `El artículo "${item.itemName}" es un producto elaborado con receta. No ingresa como inventario físico terminado; debes abastecer sus materias primas e insumos.`
          );
        }
        if (prodMeta.product_type === "service" || prodMeta.is_service) {
          throw new Error(`El artículo "${item.itemName}" es un servicio sin control de existencias físicas.`);
        }

        // Conversión de unidades entre compra e inventario
        const purchaseUnit = item.purchaseUnit || prodMeta.unit || "unidad";
        const inventoryUnit = prodMeta.unit || item.inventoryUnit || "unidad";

        let normalizedQuantity = item.quantity;
        let normalizedUnitCost = item.unitCost;

        if (purchaseUnit.toLowerCase() !== inventoryUnit.toLowerCase()) {
          const conv = convertQuantity(item.quantity, purchaseUnit, inventoryUnit);
          if (!conv.isCompatible) {
            throw new Error(
              `Unidades incompatibles para "${item.itemName}": compra en "${purchaseUnit}" pero la unidad base en inventario es "${inventoryUnit}".`
            );
          }
          normalizedQuantity = conv.convertedQuantity;
          normalizedUnitCost = conv.factor > 0 ? Number((item.unitCost / conv.factor).toFixed(4)) : item.unitCost;
        }

        const currentQty = Number(currentStockRow?.quantity || 0);
        const rawStockCost = Number(currentStockRow?.cost || 0);
        const currentCost =
          rawStockCost > 0
            ? rawStockCost
            : Number(prodMeta.cost ?? prodData?.cost_price ?? 0);
        const minStock = Number(currentStockRow?.min_stock ?? prodMeta.min_stock ?? 0);

        // Fórmula de Costo Promedio Ponderado [PROV-004]:
        const newAverageCost = calculateWeightedAverageCost(
          currentQty,
          currentCost,
          normalizedQuantity,
          normalizedUnitCost
        );

        const isIngredient =
          item.itemCategory === "ingredient" ||
          prodMeta.product_type === "ingredient" ||
          prodMeta.material_type === "ingredient" ||
          prodMeta.material_type === "supply";

        const isResale =
          item.itemCategory === "resale" ||
          prodMeta.product_type === "product";

        // Registrar movimiento de kardex tipo "entry"
        const movementNotes = `Compra ${purchaseNumber}${parsed.invoiceNumber ? ` - Fac. ${parsed.invoiceNumber}` : ""}${
          purchaseUnit !== inventoryUnit
            ? ` (${item.quantity} ${purchaseUnit} = ${normalizedQuantity} ${inventoryUnit})`
            : ""
        }`;

        await recordInventoryMovement(
          businessId,
          {
            productId: item.productId,
            locationId: targetLocationId,
            movementType: "entry",
            quantity: normalizedQuantity,
            unitCost: normalizedUnitCost,
            totalCost: item.totalCost,
            referenceType: "purchase",
            referenceId: purchaseId,
            notes: movementNotes,
          },
          userId
        );

        // Actualizar el costo promedio recalculado en inventory_stock.cost
        await upsertInventoryStock(businessId, {
          productId: item.productId,
          locationId: targetLocationId,
          quantity: currentQty + normalizedQuantity,
          minStock,
          cost: newAverageCost,
        });

        // Sincronizar en products.metadata
        if (prodData) {
          const updatedMeta: Record<string, any> = {
            ...prodMeta,
            cost: newAverageCost,
            average_cost: newAverageCost,
            stock_quantity: currentQty + normalizedQuantity,
          };

          const updateProductPayload: Record<string, any> = {
            metadata: updatedMeta,
            updated_at: new Date().toISOString(),
          };

          if (isResale) {
            updatedMeta.available_in_pos = true;
            updateProductPayload.available_in_pos = true;
          }

          await supabase
            .from("products")
            .update(updateProductPayload)
            .eq("id", item.productId)
            .eq("business_id", businessId);
        }

        inventoryImpacts.push({
          productId: item.productId,
          itemName: item.itemName,
          itemCategory: isIngredient ? "ingredient" : isResale ? "resale" : "ingredient",
          quantityAdded: normalizedQuantity,
          previousStock: currentQty,
          newStock: currentQty + normalizedQuantity,
          previousCost: currentCost,
          newAverageCost,
          unit: inventoryUnit,
          locationName,
        });
      } catch (invErr) {
        console.error(`[createPurchase] Error al actualizar inventario del producto ${item.productId}:`, invErr);
        throw invErr;
      }
    } else {
      inventoryImpacts.push({
        productId: null,
        itemName: item.itemName,
        itemCategory: "free",
        quantityAdded: item.quantity,
        previousStock: 0,
        newStock: 0,
        previousCost: item.unitCost,
        newAverageCost: item.unitCost,
        unit: "unidad",
        locationName: null,
      });
    }
  }

  // 8. Si la compra es a crédito o tiene saldo pendiente, registrar Cuenta por Pagar (accounts_payable)
  let createdAccountPayable: AccountsPayable | null = null;
  if (parsed.paymentType === "credit" || balance > 0) {
    const { data: apData, error: apErr } = await supabase
      .from("accounts_payable")
      .insert({
        business_id: businessId,
        purchase_id: purchaseId,
        supplier_id: parsed.supplierId || null,
        amount: total,
        total_amount: total,
        paid_amount: paidAmount,
        balance: balance,
        due_date: dueDate || purchaseDate,
        status: paymentStatus,
        notes: `Crédito por compra ${purchaseNumber}${paidAmount > 0 ? ` (Abono inicial ${paidAmount})` : ""}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (apErr) {
      console.error("[createPurchase] Error al crear cuenta por pagar:", apErr);
    } else if (apData) {
      createdAccountPayable = {
        id: apData.id,
        businessId: apData.business_id,
        purchaseId: apData.purchase_id,
        supplierId: apData.supplier_id,
        supplierName: supplier?.name,
        purchaseNumber,
        totalAmount: Number(apData.total_amount),
        paidAmount: Number(apData.paid_amount),
        balance: Number(apData.balance),
        dueDate: apData.due_date,
        status: apData.status,
        notes: apData.notes,
        createdAt: apData.created_at,
        updatedAt: apData.updated_at,
      };

      // Si hubo abono inicial en una compra a crédito, registrar el movimiento de pago
      if (paidAmount > 0) {
        try {
          await supabase.from("account_payable_payments").insert({
            business_id: businessId,
            account_payable_id: apData.id,
            amount: paidAmount,
            payment_method: parsed.initialPaymentMethod || parsed.paymentMethod,
            payment_date: purchaseDate,
            reference: "Abono inicial en registro de compra",
            notes: `Pago inicial factura ${purchaseNumber}`,
            created_by: userId || null,
            created_at: new Date().toISOString(),
          });
        } catch (payErr) {
          console.warn("[createPurchase] No se pudo insertar en account_payable_payments:", payErr);
        }
      }
    }
  }

  // 9. Integración con Caja: deducir automáticamente del efectivo de la caja activa
  let cashImpactDeducted = false;
  let cashImpactRegisterName: string | null = null;
  let cashImpactSessionId: string | null = null;

  const effectiveCashAmount =
    parsed.paymentType === "cash" && parsed.paymentMethod === "cash"
      ? total
      : parsed.paymentType === "credit" &&
        (parsed.initialPaymentMethod || parsed.paymentMethod) === "cash"
      ? paidAmount
      : 0;

  if (parsed.deductFromCashRegister && effectiveCashAmount > 0) {
    try {
      const activeSession = await getActiveCashSession(businessId, undefined, userId).catch(() => null);
      if (activeSession && activeSession.status === "open") {
        cashImpactSessionId = activeSession.id;

        const { data: regData } = await supabase
          .from("cash_registers")
          .select("name")
          .eq("id", activeSession.registerId)
          .maybeSingle();

        cashImpactRegisterName = regData?.name || "Caja Principal";

        // Registrar egreso en cash_movements para el arqueo del turno
        await recordCashMovement(
          businessId,
          {
            sessionId: activeSession.id,
            movementType: "expense",
            amount: effectiveCashAmount,
            referenceId: purchaseId,
            referenceType: "purchase",
            notes: `Pago compra ${purchaseNumber}${supplier ? ` - Prov: ${supplier.name}` : ""}${
              parsed.paymentType === "credit" ? " (Abono inicial)" : ""
            }`,
          },
          userId
        );

        cashImpactDeducted = true;
      }
    } catch (cashErr) {
      console.error("[createPurchase] Error al registrar movimiento de caja:", cashErr);
    }
  }

  const impactSummary = {
    inventoryImpacts,
    cashImpact: {
      deducted: cashImpactDeducted,
      amount: cashImpactDeducted ? effectiveCashAmount : 0,
      cashRegisterName: cashImpactRegisterName,
      sessionId: cashImpactSessionId,
    },
  };

  // Guardar metadata enriquecida en la compra
  const finalMetadata = {
    ...initialMetadata,
    deduct_from_cash_register: cashImpactDeducted,
    cash_register_name: cashImpactRegisterName,
    impact_summary: impactSummary,
  };

  try {
    await supabase
      .from("purchases")
      .update({
        cash_register_name: cashImpactRegisterName,
        deduct_from_cash_register: cashImpactDeducted,
        metadata: finalMetadata,
      })
      .eq("id", purchaseId);
  } catch (mErr) {
    console.warn("[createPurchase] Advertencia al actualizar metadata de compra:", mErr);
  }

  return {
    ...mapPurchaseRow({
      ...purchaseData,
      deduct_from_cash_register: cashImpactDeducted,
      cash_register_name: cashImpactRegisterName,
      suppliers: supplier ? { id: supplier.id, name: supplier.name, tax_id: supplier.taxId } : null,
      purchase_items: insertedItems || [],
      accounts_payable: createdAccountPayable ? [createdAccountPayable] : [],
      metadata: finalMetadata,
    }),
    impactSummary,
  };
}

/**
 * Calcula el rango de fechas ISO para los periodos de compras:
 * Hoy, Ayer, Últimos 7 días, Esta semana, Este mes, Mes anterior, Todo el historial o personalizado.
 */
export function getDateRangeForPeriod(
  period: PurchasePeriodPreset = "all",
  startDate?: string,
  endDate?: string,
  refDate: Date = new Date()
): { from?: string; to?: string } {
  const now = refDate;

  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (period === "yesterday") {
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
    const end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (period === "7d") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to: now.toISOString() };
  }

  if (period === "this_week") {
    // Lunes como inicio de semana
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
    return { from: monday.toISOString(), to: now.toISOString() };
  }

  if (period === "30d") {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to: now.toISOString() };
  }

  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { from: start.toISOString(), to: now.toISOString() };
  }

  if (period === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (period === "custom" || startDate || endDate) {
    const from = startDate ? new Date(`${startDate}T00:00:00.000Z`).toISOString() : undefined;
    const to = endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined;
    return { from, to };
  }

  return {};
}

/**
 * Consulta las compras registradas con filtros por periodo, proveedor, método de pago, estado de pago y estado de compra.
 */
export async function getPurchases(
  businessId: string,
  filters: PurchaseFilters = {}
): Promise<Purchase[]> {
  const supabase = await getDbClient();

  try {
    let query = supabase
      .from("purchases")
      .select(
        `
        *,
        suppliers(id, name, tax_id),
        purchase_items(*),
        accounts_payable(*)
      `
      )
      .eq("business_id", businessId);

    // Filtro por proveedor
    if (filters.supplierId && filters.supplierId !== "all") {
      query = query.eq("supplier_id", filters.supplierId);
    }

    // Filtro por tipo de pago (contado / crédito)
    if (filters.paymentType && filters.paymentType !== "all") {
      query = query.eq("payment_type", filters.paymentType);
    }

    // Filtro por medio de pago
    if (filters.paymentMethod && filters.paymentMethod !== "all") {
      query = query.eq("payment_method", filters.paymentMethod);
    }

    // Filtro por estado de compra (confirmed / cancelled) si se especifica a nivel SQL
    if (filters.purchaseStatus && filters.purchaseStatus !== "all") {
      query = query.eq("status", filters.purchaseStatus);
    }

    // Filtro por periodo y rango de fechas
    const { from, to } = getDateRangeForPeriod(
      filters.period || "all",
      filters.startDate,
      filters.endDate
    );
    if (from) {
      query = query.gte("purchase_date", from);
    }
    if (to) {
      query = query.lte("purchase_date", to);
    }

    // Orden descendente por fecha de compra
    query = query.order("purchase_date", { ascending: false });

    const { data, error } = await query;
    if (error) {
      // Manejo resiliente si las tablas de compras aún no están desplegadas en el cache remoto
      if (
        error.code === "PGRST205" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("does not exist")
      ) {
        console.warn("[getPurchases] Tabla purchases no disponible en schema cache:", error.message);
        return [];
      }
      console.error("[getPurchases] Error al listar compras:", error);
      throw new Error(`Error al consultar compras: ${error.message}`);
    }

    let list = (data || []).map(mapPurchaseRow);

    // Filtrado por estado de pago (paid / partially_paid / pending / cancelled)
    if (filters.paymentStatus && filters.paymentStatus !== "all") {
      list = list.filter((p) => p.paymentStatus === filters.paymentStatus);
    }

    // Filtrado por pestañas heredadas de estado
    const now = new Date();
    if (filters.statusTab && filters.statusTab !== "all") {
      if (filters.statusTab === "cash") {
        list = list.filter((p) => p.paymentType === "cash");
      } else if (filters.statusTab === "credit") {
        list = list.filter((p) => p.paymentType === "credit");
      } else if (filters.statusTab === "pending") {
        list = list.filter((p) => p.balance > 0 && p.status !== "cancelled");
      } else if (filters.statusTab === "overdue") {
        const nowDateStr = now.toISOString();
        list = list.filter(
          (p) =>
            p.balance > 0 &&
            p.status !== "cancelled" &&
            p.dueDate &&
            p.dueDate < nowDateStr
        );
      }
    }

    // Búsqueda de texto (código de compra, número de factura, proveedor, notas o nombres de artículos)
    if (filters.search && filters.search.trim().length > 0) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter((p) => {
        const matchesMain =
          p.purchaseNumber.toLowerCase().includes(q) ||
          (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
          (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q));

        if (matchesMain) return true;

        // Buscar en artículos
        return (p.items || []).some((item) =>
          item.itemName.toLowerCase().includes(q)
        );
      });
    }

    return list;
  } catch (err: any) {
    if (
      err?.code === "PGRST205" ||
      err?.message?.includes("schema cache") ||
      err?.message?.includes("does not exist")
    ) {
      return [];
    }
    throw err;
  }
}

/**
 * Consulta una compra individual por ID con todos sus detalles.
 */
export async function getPurchaseById(
  businessId: string,
  purchaseId: string
): Promise<Purchase | null> {
  const supabase = await getDbClient();

  try {
    const { data, error } = await supabase
      .from("purchases")
      .select(
        `
        *,
        suppliers(id, name, tax_id),
        purchase_items(*),
        accounts_payable(
          *,
          account_payable_payments(*)
        )
      `
      )
      .eq("id", purchaseId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return mapPurchaseRow(data);
  } catch (err) {
    console.warn("[getPurchaseById] Error al consultar compra por ID:", err);
    return null;
  }
}

/**
 * Calcula los KPIs financieros y operativos de compras para el negocio,
 * respetando el período y los filtros aplicados cuando correspondan.
 */
export async function getPurchaseKPIs(
  businessId: string,
  filters: PurchaseFilters = {}
): Promise<PurchaseKPIs> {
  // Para KPIs del período, consultamos las compras bajo los mismos filtros de fecha/proveedor
  const periodPurchases = await getPurchases(businessId, {
    period: filters.period || "all",
    startDate: filters.startDate,
    endDate: filters.endDate,
    supplierId: filters.supplierId,
  });

  let totalPurchased = 0;
  let totalPaid = 0;
  let totalPendingBalance = 0;
  let paidPurchasesCount = 0;
  let pendingPurchasesCount = 0;
  let totalCash = 0;
  let totalCredit = 0;
  const uniqueSuppliers = new Set<string>();

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayIso = endOfToday.toISOString();
  let dueTodayOrOverdue = 0;

  for (const p of periodPurchases) {
    if (p.status === "cancelled") continue;

    const total = Number(p.total || 0);
    const paid = Number(p.paidAmount || 0);
    const bal = Number(p.balance || 0);

    totalPurchased += total;
    totalPaid += paid;
    totalPendingBalance += bal;

    if (p.paymentStatus === "paid") {
      paidPurchasesCount++;
    } else if (bal > 0) {
      pendingPurchasesCount++;
    }

    if (p.paymentType === "cash") {
      totalCash += total;
    } else if (p.paymentType === "credit") {
      totalCredit += total;
    }

    if (p.supplierId) {
      uniqueSuppliers.add(p.supplierId);
    }

    if (bal > 0 && p.dueDate && p.dueDate <= endOfTodayIso) {
      dueTodayOrOverdue += bal;
    }
  }

  return {
    totalPurchased: Number(totalPurchased.toFixed(2)),
    totalPaid: Number(totalPaid.toFixed(2)),
    totalPendingBalance: Number(totalPendingBalance.toFixed(2)),
    paidPurchasesCount,
    pendingPurchasesCount,
    uniqueSuppliersCount: uniqueSuppliers.size,
    totalCash: Number(totalCash.toFixed(2)),
    totalCredit: Number(totalCredit.toFixed(2)),
    dueTodayOrOverdue: Number(dueTodayOrOverdue.toFixed(2)),
    totalPurchasesCount: periodPurchases.filter((p) => p.status !== "cancelled").length,
  };
}

/**
 * Anula una compra registrada y revierte sus afectaciones contables y de existencias.
 * Si tiene pagos posteriores registrados a la cuenta por pagar, se impide la anulación.
 */
export async function cancelPurchase(
  businessId: string,
  purchaseId: string,
  userId?: string | null,
  reason?: string
): Promise<void> {
  const supabase = await getDbClient();

  // 1. Obtener la compra y sus ítems
  const { data: purchase, error: pErr } = await supabase
    .from("purchases")
    .select(`*, purchase_items(*), accounts_payable(*, account_payable_payments(*))`)
    .eq("id", purchaseId)
    .eq("business_id", businessId)
    .single();

  if (pErr || !purchase) {
    throw new Error("La compra no existe o no pertenece a este comercio.");
  }

  if (purchase.status === "cancelled") {
    throw new Error("La compra ya se encuentra anulada.");
  }

  // 2. Validar si existen pagos posteriores registrados en accounts_payable
  const ap = Array.isArray(purchase.accounts_payable)
    ? purchase.accounts_payable[0]
    : purchase.accounts_payable;

  if (ap) {
    const payments = Array.isArray(ap.account_payable_payments)
      ? ap.account_payable_payments
      : [];

    // Si hay abonos posteriores al registro inicial, prohibir anulación
    const nonInitialPayments = payments.filter(
      (pm: any) => !pm.reference?.includes("Abono inicial en registro de compra")
    );

    if (nonInitialPayments.length > 0) {
      throw new Error(
        "No es posible anular esta compra porque ya cuenta con abonos registrados a la cuenta por pagar. Debes anular o revertir los abonos primero."
      );
    }
  }

  const cancellationTimestamp = new Date().toISOString();
  const currentMeta = (purchase.metadata as Record<string, any>) || {};
  const updatedMeta = {
    ...currentMeta,
    cancelled_at: cancellationTimestamp,
    cancelled_by: userId || null,
    cancellation_reason: reason?.trim() || "Anulación manual de compra",
    payment_status: "cancelled",
  };

  // 3. Marcar compra como cancelada
  await supabase
    .from("purchases")
    .update({
      status: "cancelled",
      metadata: updatedMeta,
      updated_at: cancellationTimestamp,
    })
    .eq("id", purchaseId)
    .eq("business_id", businessId);

  // 4. Cancelar cuenta por pagar asociada si existe
  if (ap) {
    await supabase
      .from("accounts_payable")
      .update({
        status: "cancelled",
        balance: 0,
        updated_at: cancellationTimestamp,
      })
      .eq("id", ap.id)
      .eq("business_id", businessId);
  }

  // 5. Revertir existencias de ítems inventariables (movimiento inverso 'exit')
  if (Array.isArray(purchase.purchase_items)) {
    for (const item of purchase.purchase_items) {
      if (item.is_inventory_item && item.product_id && item.location_id) {
        try {
          const qty = Number(item.conversion_factor || 1) > 0 && item.inventory_quantity
            ? Number(item.inventory_quantity)
            : Number(item.quantity);

          await recordInventoryMovement(
            businessId,
            {
              productId: item.product_id,
              locationId: item.location_id,
              movementType: "exit",
              quantity: qty,
              unitCost: Number(item.unit_cost),
              referenceType: "purchase",
              referenceId: purchaseId,
              notes: `Anulación de compra ${purchase.purchase_number}${reason ? `: ${reason}` : ""}`,
            },
            userId
          );

          // Restablecer existencias en inventory_stock
          const { data: stockRow } = await supabase
            .from("inventory_stock")
            .select("quantity, min_stock, cost")
            .eq("business_id", businessId)
            .eq("product_id", item.product_id)
            .eq("location_id", item.location_id)
            .maybeSingle();

          if (stockRow) {
            const currentStockQty = Number(stockRow.quantity || 0);
            const newStockQty = Math.max(0, currentStockQty - qty);
            await upsertInventoryStock(businessId, {
              productId: item.product_id,
              locationId: item.location_id,
              quantity: newStockQty,
              minStock: Number(stockRow.min_stock || 0),
              cost: Number(stockRow.cost || item.unit_cost),
            });
          }
        } catch (revErr) {
          console.warn(`[cancelPurchase] No se pudo revertir stock para producto ${item.product_id}:`, revErr);
        }
      }
    }
  }

  // 6. Si hubo egreso de caja activa, reintegrar el dinero en la caja activa
  const wasDeducted = Boolean(
    purchase.deduct_from_cash_register ??
    currentMeta.deduct_from_cash_register ??
    (purchase.payment_type === "cash" && purchase.payment_method === "cash")
  );

  const amountToRefund = Number(currentMeta.paid_amount ?? purchase.total ?? 0);

  if (wasDeducted && amountToRefund > 0) {
    try {
      const activeSession = await getActiveCashSession(businessId, undefined, userId).catch(() => null);
      if (activeSession && activeSession.status === "open") {
        await recordCashMovement(
          businessId,
          {
            sessionId: activeSession.id,
            movementType: "entry",
            amount: amountToRefund,
            referenceId: purchaseId,
            referenceType: "purchase",
            notes: `Reintegro por anulación de compra ${purchase.purchase_number}`,
          },
          userId
        );
      }
    } catch (cashErr) {
      console.warn("[cancelPurchase] Error al registrar reintegro en caja:", cashErr);
    }
  }
}

// ==============================================================================
// GESTIÓN DE CUENTAS POR PAGAR Y ABONOS A PROVEEDOR (PROV-003)
// ==============================================================================

/**
 * Consulta las cuentas por pagar a proveedores con enriquecimiento de datos,
 * cálculo de días restantes/vencidos y actualización automática del estado 'overdue'.
 */
export async function getAccountsPayable(
  businessId: string,
  filters?: AccountsPayableFilters
): Promise<AccountsPayableWithDetails[]> {
  const supabase = await getDbClient();

  // Consulta base con joins
  const { data: apRows, error } = await supabase
    .from("accounts_payable")
    .select(`
      *,
      suppliers(id, name, contact_name, phone, tax_id),
      purchases(id, purchase_number, invoice_number),
      account_payable_payments(*)
    `)
    .eq("business_id", businessId)
    .order("due_date", { ascending: true });

  if (error) {
    if (
      error.code === "PGRST205" ||
      error.message?.includes("schema cache") ||
      error.message?.includes("does not exist")
    ) {
      console.warn("[getAccountsPayable] Tabla accounts_payable no disponible en schema cache:", error.message);
      return [];
    }
    console.error("[getAccountsPayable] Error al consultar cuentas por pagar:", error);
    return [];
  }

  const now = new Date();
  const accountsToUpdateOverdue: string[] = [];

  let result: AccountsPayableWithDetails[] = (apRows || []).map((row: any) => {
    const dueDate = new Date(row.due_date);
    const balance = Number(row.balance || 0);
    const totalAmount = Number(row.total_amount ?? row.amount ?? 0);
    const paidAmount = Number(row.paid_amount || 0);

    const isUnpaid = balance > 0 && row.status !== "paid" && row.status !== "cancelled";
    const isOverdue = isUnpaid && dueDate < now;

    // Diferencia en días (positivo = días restantes, negativo = días de retraso)
    const diffTime = dueDate.getTime() - now.getTime();
    const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status = row.status;
    if (isOverdue && status !== "overdue") {
      status = "overdue";
      accountsToUpdateOverdue.push(row.id);
    }

    const payments: AccountPayablePayment[] = Array.isArray(row.account_payable_payments)
      ? row.account_payable_payments.map((p: any) => ({
          id: p.id,
          businessId: p.business_id,
          accountPayableId: p.account_payable_id,
          amount: Number(p.amount || 0),
          paymentMethod: p.payment_method,
          paymentDate: p.payment_date,
          reference: p.reference ?? null,
          notes: p.notes ?? null,
          createdBy: p.created_by ?? null,
          createdAt: p.created_at,
        }))
      : [];

    return {
      id: row.id,
      businessId: row.business_id,
      purchaseId: row.purchase_id,
      supplierId: row.supplier_id ?? null,
      supplierName: row.suppliers?.name ?? null,
      supplierContact: row.suppliers?.contact_name ?? null,
      supplierPhone: row.suppliers?.phone ?? null,
      supplierTaxId: row.suppliers?.tax_id ?? null,
      purchaseNumber: row.purchases?.purchase_number ?? null,
      purchaseInvoiceNumber: row.purchases?.invoice_number ?? null,
      amount: totalAmount,
      totalAmount,
      paidAmount,
      balance,
      dueDate: row.due_date,
      status,
      notes: row.notes ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      payments,
      isOverdue,
      daysUntilDue,
    };
  });

  // Actualizar en base de datos de fondo las cuentas que hayan vencido automáticamente
  if (accountsToUpdateOverdue.length > 0) {
    try {
      await supabase
        .from("accounts_payable")
        .update({ status: "overdue", updated_at: now.toISOString() })
        .eq("business_id", businessId)
        .in("id", accountsToUpdateOverdue);
    } catch (updErr) {
      console.warn("[getAccountsPayable] Error al actualizar estado overdue:", updErr);
    }
  }

  // Filtros aplicados en memoria para mayor flexibilidad
  if (filters?.status && filters.status !== "all") {
    if (filters.status === "pending") {
      result = result.filter((a) => a.status === "pending");
    } else if (filters.status === "partial") {
      result = result.filter((a) => a.status === "partial" || a.status === "partially_paid");
    } else if (filters.status === "paid") {
      result = result.filter((a) => a.status === "paid");
    } else if (filters.status === "overdue") {
      result = result.filter((a) => a.status === "overdue" || a.isOverdue);
    }
  }

  if (filters?.supplierId && filters.supplierId !== "all") {
    result = result.filter((a) => a.supplierId === filters.supplierId);
  }

  if (filters?.dueDateRange && filters.dueDateRange !== "all") {
    const todayStr = now.toISOString().slice(0, 10);
    const next7d = new Date(now);
    next7d.setDate(next7d.getDate() + 7);
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (filters.dueDateRange === "today") {
      result = result.filter((a) => a.dueDate.slice(0, 10) === todayStr);
    } else if (filters.dueDateRange === "next_7d") {
      result = result.filter((a) => {
        const d = new Date(a.dueDate);
        return d >= now && d <= next7d;
      });
    } else if (filters.dueDateRange === "this_month") {
      result = result.filter((a) => {
        const d = new Date(a.dueDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    } else if (filters.dueDateRange === "overdue") {
      result = result.filter((a) => a.isOverdue);
    }
  }

  if (filters?.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(
      (a) =>
        (a.supplierName && a.supplierName.toLowerCase().includes(q)) ||
        (a.purchaseNumber && a.purchaseNumber.toLowerCase().includes(q)) ||
        (a.purchaseInvoiceNumber && a.purchaseInvoiceNumber.toLowerCase().includes(q)) ||
        (a.notes && a.notes.toLowerCase().includes(q))
    );
  }

  return result;
}

/**
 * Indicadores ejecutivos de Cuentas por Pagar:
 * - totalBalance: saldo total adeudado
 * - overdueBalance: saldo vencido
 * - upcomingBalance: saldo por vencer en los próximos 7 días
 * - pendingAccountsCount: número de cuentas con saldo pendiente
 * - overdueAccountsCount: número de cuentas en estado vencido
 */
export async function getAccountsPayableKPIs(businessId: string): Promise<AccountsPayableKPIs> {
  const supabase = await getDbClient();

  const { data: rows, error } = await supabase
    .from("accounts_payable")
    .select("balance, due_date, status")
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    .neq("status", "paid");

  if (error) {
    if (
      error.code === "PGRST205" ||
      error.message?.includes("schema cache") ||
      error.message?.includes("does not exist")
    ) {
      return {
        totalBalance: 0,
        overdueBalance: 0,
        upcomingBalance: 0,
        pendingAccountsCount: 0,
        overdueAccountsCount: 0,
      };
    }
    console.error("[getAccountsPayableKPIs] Error al consultar métricas:", error);
    return {
      totalBalance: 0,
      overdueBalance: 0,
      upcomingBalance: 0,
      pendingAccountsCount: 0,
      overdueAccountsCount: 0,
    };
  }

  const now = new Date();
  const next7Days = new Date(now);
  next7Days.setDate(next7Days.getDate() + 7);

  let totalBalance = 0;
  let overdueBalance = 0;
  let upcomingBalance = 0;
  let pendingAccountsCount = 0;
  let overdueAccountsCount = 0;

  for (const r of rows || []) {
    const bal = Number(r.balance || 0);
    if (bal <= 0) continue;

    totalBalance += bal;
    pendingAccountsCount++;

    const dDate = new Date(r.due_date);
    if (dDate < now) {
      overdueBalance += bal;
      overdueAccountsCount++;
    } else if (dDate <= next7Days) {
      upcomingBalance += bal;
    }
  }

  return {
    totalBalance: Number(totalBalance.toFixed(2)),
    overdueBalance: Number(overdueBalance.toFixed(2)),
    upcomingBalance: Number(upcomingBalance.toFixed(2)),
    pendingAccountsCount,
    overdueAccountsCount,
  };
}

/**
 * Registra un abono parcial o liquidación total a una Cuenta por Pagar [PROV-003].
 * 
 * Reglas de negocio:
 * 1. La cuenta debe pertenecer estrictamente al businessId indicado.
 * 2. La cuenta no puede estar previamente pagada ni cancelada.
 * 3. El monto abonado no puede superar el saldo pendiente actual.
 * 4. Si el saldo resultante llega a 0, la cuenta pasa automáticamente a estado 'paid'.
 * 5. Si queda saldo remanente > 0, la cuenta pasa a estado 'partial' (o 'partially_paid').
 * 6. Registra el detalle del pago en account_payable_payments.
 */
export async function registerAccountPayablePayment(
  businessId: string,
  input: RegisterPaymentInput,
  userId?: string | null
): Promise<{ payment: AccountPayablePayment; updatedAccount: AccountsPayable }> {
  const parsed = RegisterPaymentInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Consultar la cuenta por pagar
  const { data: account, error: accErr } = await supabase
    .from("accounts_payable")
    .select("*")
    .eq("id", parsed.accountPayableId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (accErr || !account) {
    throw new Error("La cuenta por pagar no existe o no pertenece a este comercio.");
  }

  if (account.status === "cancelled") {
    throw new Error("No se pueden registrar pagos a una cuenta por pagar cancelada.");
  }

  const currentBalance = Number(account.balance || 0);
  const currentPaid = Number(account.paid_amount || 0);

  if (currentBalance <= 0 || account.status === "paid") {
    throw new Error("Esta cuenta por pagar ya se encuentra liquidada en su totalidad.");
  }

  if (parsed.amount > currentBalance) {
    throw new Error(
      `El monto a abonar ($${parsed.amount.toLocaleString("es-CO")}) no puede superar el saldo pendiente actual ($${currentBalance.toLocaleString("es-CO")}).`
    );
  }

  const newPaidAmount = Number((currentPaid + parsed.amount).toFixed(2));
  const newBalance = Number(Math.max(0, currentBalance - parsed.amount).toFixed(2));
  const newStatus = newBalance <= 0 ? "paid" : "partial";
  const now = new Date().toISOString();

  // 2. Insertar pago en account_payable_payments
  const { data: paymentRow, error: payErr } = await supabase
    .from("account_payable_payments")
    .insert({
      business_id: businessId,
      account_payable_id: parsed.accountPayableId,
      amount: parsed.amount,
      payment_method: parsed.paymentMethod,
      payment_date: parsed.paymentDate || now,
      reference: parsed.reference || null,
      notes: parsed.notes || null,
      created_by: userId || null,
      created_at: now,
    })
    .select()
    .single();

  if (payErr || !paymentRow) {
    console.error("[registerAccountPayablePayment] Error al insertar abono:", payErr);
    throw new Error(`Error al registrar el abono: ${payErr?.message}`);
  }

  // 3. Actualizar cuenta por pagar
  const { data: updatedAccountRow, error: updErr } = await supabase
    .from("accounts_payable")
    .update({
      paid_amount: newPaidAmount,
      balance: newBalance,
      status: newStatus,
      updated_at: now,
    })
    .eq("id", parsed.accountPayableId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (updErr || !updatedAccountRow) {
    console.error("[registerAccountPayablePayment] Error al actualizar cuenta:", updErr);
    throw new Error(`Error al actualizar saldo de la cuenta por pagar: ${updErr?.message}`);
  }

  const payment: AccountPayablePayment = {
    id: paymentRow.id,
    businessId: paymentRow.business_id,
    accountPayableId: paymentRow.account_payable_id,
    amount: Number(paymentRow.amount),
    paymentMethod: paymentRow.payment_method,
    paymentDate: paymentRow.payment_date,
    reference: paymentRow.reference ?? null,
    notes: paymentRow.notes ?? null,
    createdBy: paymentRow.created_by ?? null,
    createdAt: paymentRow.created_at,
  };

  const updatedAccount: AccountsPayable = {
    id: updatedAccountRow.id,
    businessId: updatedAccountRow.business_id,
    purchaseId: updatedAccountRow.purchase_id,
    supplierId: updatedAccountRow.supplier_id,
    amount: Number(updatedAccountRow.amount ?? updatedAccountRow.total_amount),
    totalAmount: Number(updatedAccountRow.total_amount),
    paidAmount: Number(updatedAccountRow.paid_amount),
    balance: Number(updatedAccountRow.balance),
    dueDate: updatedAccountRow.due_date,
    status: updatedAccountRow.status,
    notes: updatedAccountRow.notes ?? null,
    createdAt: updatedAccountRow.created_at,
    updatedAt: updatedAccountRow.updated_at,
  };

  return { payment, updatedAccount };
}

/**
 * Consulta el detalle completo de una Cuenta por Pagar con todos sus abonos registrados.
 */
export async function getAccountPayableDetails(
  businessId: string,
  accountPayableId: string
): Promise<AccountsPayableWithDetails> {
  const supabase = await getDbClient();

  const { data: row, error } = await supabase
    .from("accounts_payable")
    .select(`
      *,
      suppliers(id, name, contact_name, phone, tax_id),
      purchases(id, purchase_number, invoice_number),
      account_payable_payments(*)
    `)
    .eq("id", accountPayableId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !row) {
    throw new Error("La cuenta por pagar no existe o no pertenece a este comercio.");
  }

  const now = new Date();
  const dueDate = new Date(row.due_date);
  const balance = Number(row.balance || 0);
  const totalAmount = Number(row.total_amount ?? row.amount ?? 0);
  const paidAmount = Number(row.paid_amount || 0);

  const isUnpaid = balance > 0 && row.status !== "paid" && row.status !== "cancelled";
  const isOverdue = isUnpaid && dueDate < now;
  const diffTime = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const payments: AccountPayablePayment[] = Array.isArray(row.account_payable_payments)
    ? row.account_payable_payments
        .map((p: any) => ({
          id: p.id,
          businessId: p.business_id,
          accountPayableId: p.account_payable_id,
          amount: Number(p.amount || 0),
          paymentMethod: p.payment_method,
          paymentDate: p.payment_date,
          reference: p.reference ?? null,
          notes: p.notes ?? null,
          createdBy: p.created_by ?? null,
          createdAt: p.created_at,
        }))
        .sort((a: AccountPayablePayment, b: AccountPayablePayment) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
    : [];

  return {
    id: row.id,
    businessId: row.business_id,
    purchaseId: row.purchase_id,
    supplierId: row.supplier_id ?? null,
    supplierName: row.suppliers?.name ?? null,
    supplierContact: row.suppliers?.contact_name ?? null,
    supplierPhone: row.suppliers?.phone ?? null,
    supplierTaxId: row.suppliers?.tax_id ?? null,
    purchaseNumber: row.purchases?.purchase_number ?? null,
    purchaseInvoiceNumber: row.purchases?.invoice_number ?? null,
    amount: totalAmount,
    totalAmount,
    paidAmount,
    balance,
    dueDate: row.due_date,
    status: row.status,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payments,
    isOverdue,
    daysUntilDue,
  };
}

