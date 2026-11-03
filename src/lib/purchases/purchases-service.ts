import { createClient } from "@/lib/supabase/server";
import {
  Supplier,
  CreateSupplierInput,
  CreateSupplierInputSchema,
  Purchase,
  PurchaseItem,
  CreatePurchaseInput,
  CreatePurchaseInputSchema,
  AccountsPayable,
  PurchaseKPIs,
  PurchaseFilters,
  PurchasePeriodPreset,
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
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    contactName: row.contact_name ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    taxId: row.tax_id ?? null,
    paymentTermsDays: Number(row.payment_terms_days ?? 0),
    notes: row.notes ?? null,
    status: row.status ?? "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Consulta la lista de proveedores del comercio.
 */
export async function getSuppliers(businessId: string): Promise<Supplier[]> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("business_id", businessId)
    .neq("status", "archived")
    .order("name", { ascending: true });

  if (error) {
    console.error("[getSuppliers] Error al obtener proveedores:", error);
    throw new Error(`Error al consultar proveedores: ${error.message}`);
  }

  return (data || []).map(mapSupplierRow);
}

/**
 * Registra un nuevo proveedor (soporta creación rápida inline).
 */
export async function createSupplier(
  businessId: string,
  input: CreateSupplierInput
): Promise<Supplier> {
  const parsed = CreateSupplierInputSchema.parse(input);
  const supabase = await getDbClient();

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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[createSupplier] Error al insertar proveedor:", error);
    throw new Error(`No se pudo crear el proveedor: ${error?.message || "Desconocido"}`);
  }

  return mapSupplierRow(data);
}

// ==============================================================================
// GESTIÓN DE COMPRAS Y KARDEX (PROV-002)
// ==============================================================================

function mapPurchaseRow(row: any): Purchase {
  return {
    id: row.id,
    businessId: row.business_id,
    purchaseNumber: row.purchase_number,
    supplierId: row.supplier_id ?? null,
    supplierName: row.suppliers?.name ?? null,
    invoiceNumber: row.invoice_number ?? null,
    purchaseDate: row.purchase_date,
    subtotal: Number(row.subtotal || 0),
    taxAmount: Number(row.tax_amount || 0),
    total: Number(row.total || 0),
    paymentType: row.payment_type || "cash",
    paymentMethod: row.payment_method || "cash",
    status: row.status || "confirmed",
    notes: row.notes ?? null,
    deductFromCashRegister: Boolean(
      row.deduct_from_cash_register ??
      row.metadata?.deduct_from_cash_register ??
      (row.payment_type === "cash" && row.payment_method === "cash")
    ),
    cashRegisterName:
      row.cash_register_name ??
      row.metadata?.cash_register_name ??
      (row.payment_type === "cash" && row.payment_method === "cash" ? "Caja Principal" : null),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: Array.isArray(row.purchase_items)
      ? row.purchase_items.map((it: any): PurchaseItem => ({
          id: it.id,
          purchaseId: it.purchase_id,
          businessId: it.business_id,
          productId: it.product_id ?? null,
          itemName: it.item_name,
          quantity: Number(it.quantity || 0),
          unitCost: Number(it.unit_cost || 0),
          totalCost: Number(it.total_cost || 0),
          locationId: it.location_id ?? null,
          isInventoryItem: Boolean(it.is_inventory_item),
          itemCategory: it.item_category || it.itemCategory || undefined,
          createdAt: it.created_at,
        }))
      : [],
    accountPayable: row.accounts_payable && row.accounts_payable[0]
      ? {
          id: row.accounts_payable[0].id,
          businessId: row.accounts_payable[0].business_id,
          purchaseId: row.accounts_payable[0].purchase_id,
          supplierId: row.accounts_payable[0].supplier_id ?? null,
          totalAmount: Number(row.accounts_payable[0].total_amount || 0),
          paidAmount: Number(row.accounts_payable[0].paid_amount || 0),
          balance: Number(row.accounts_payable[0].balance || 0),
          dueDate: row.accounts_payable[0].due_date,
          status: row.accounts_payable[0].status,
          notes: row.accounts_payable[0].notes ?? null,
          createdAt: row.accounts_payable[0].created_at,
          updatedAt: row.accounts_payable[0].updated_at,
        }
      : null,
    impactSummary: row.impact_summary || row.metadata?.impact_summary || null,
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
    const { data: sData } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", parsed.supplierId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (sData) {
      supplier = mapSupplierRow(sData);
    }
  }

  // 2. Calcular subtotales e impuestos
  let subtotal = 0;
  const itemsToInsert: any[] = [];

  for (const item of parsed.items) {
    const itemTotal = Number((item.quantity * item.unitCost).toFixed(2));
    subtotal += itemTotal;
    itemsToInsert.push({
      productId: item.productId || null,
      itemName: item.itemName.trim(),
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: itemTotal,
      locationId: item.locationId || null,
      isInventoryItem: item.isInventoryItem,
      itemCategory: item.itemCategory,
    });
  }

  subtotal = Number(subtotal.toFixed(2));
  const taxAmount = Number(((subtotal * (parsed.taxPercentage || 0)) / 100).toFixed(2));
  const retentionAmount = Number(((subtotal * (parsed.retentionPercentage || 0)) / 100).toFixed(2));
  const total = Number(Math.max(0, subtotal + taxAmount - retentionAmount).toFixed(2));

  // 3. Generar número de compra correlativo (COMP-XXXXX)
  const purchaseNumber = await generateNextPurchaseNumber(businessId);
  const purchaseDate = parsed.purchaseDate || new Date().toISOString();

  // 4. Insertar cabecera de la compra
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

  // 5. Insertar ítems de la compra
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

  // 6. Procesar afectación de inventario y costo promedio ponderado (PROV-004)
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

        // Consultar nombre de ubicación para trazabilidad explicativa con aislamiento de tenant
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
          // Continuar con nombre por defecto si no se puede consultar ubicación
        }

        // Consultar existencias y costo actual para el recálculo promedio ponderado
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
        const currentQty = Number(currentStockRow?.quantity || 0);
        const rawStockCost = Number(currentStockRow?.cost || 0);
        const currentCost =
          rawStockCost > 0
            ? rawStockCost
            : Number(prodMeta.cost ?? prodData?.cost_price ?? 0);
        const minStock = Number(currentStockRow?.min_stock ?? prodMeta.min_stock ?? 0);

        // Fórmula de Costo Promedio Ponderado [PROV-004]:
        // nuevo_costo = ((stock_actual * costo_anterior) + (cant_comprada * costo_nuevo)) / (stock_actual + cant_comprada)
        const newAverageCost = calculateWeightedAverageCost(
          currentQty,
          currentCost,
          item.quantity,
          item.unitCost
        );

        // Determinar categoría del ítem: Insumo/Ingrediente vs Bebida/Reventa Directa
        const isIngredient =
          item.itemCategory === "ingredient" ||
          prodMeta.product_type === "ingredient";

        const isResale =
          item.itemCategory === "resale" ||
          prodMeta.product_type === "product";

        // Registrar movimiento de kardex tipo "entry"
        await recordInventoryMovement(
          businessId,
          {
            productId: item.productId,
            locationId: targetLocationId,
            movementType: "entry",
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            referenceType: "purchase",
            referenceId: purchaseId,
            notes: `Compra ${purchaseNumber}${parsed.invoiceNumber ? ` - Fac. ${parsed.invoiceNumber}` : ""}`,
          },
          userId
        );

        // Actualizar el costo promedio recalculado en inventory_stock.cost
        await upsertInventoryStock(businessId, {
          productId: item.productId,
          locationId: targetLocationId,
          quantity: currentQty + item.quantity,
          minStock,
          cost: newAverageCost,
        });

        // Sincronizar en products.metadata
        if (prodData) {
          const updatedMeta: Record<string, any> = {
            ...prodMeta,
            cost: newAverageCost,
            average_cost: newAverageCost,
            stock_quantity: currentQty + item.quantity,
          };

          const updateProductPayload: Record<string, any> = {
            metadata: updatedMeta,
            updated_at: new Date().toISOString(),
          };

          // Si es Bebida / Reventa Directa: Aumenta existencia en catálogo POS y actualiza costo
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
          quantityAdded: item.quantity,
          previousStock: currentQty,
          newStock: currentQty + item.quantity,
          previousCost: currentCost,
          newAverageCost,
          unit: prodMeta.unit || "unidad",
          locationName,
        });
      } catch (invErr) {
        console.error(`[createPurchase] Error al actualizar inventario del producto ${item.productId}:`, invErr);
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

  // 7. Si la compra es a crédito, registrar automáticamente Cuenta por Pagar (accounts_payable)
  let createdAccountPayable: AccountsPayable | null = null;
  if (parsed.paymentType === "credit") {
    let dueDate = parsed.dueDate;
    if (!dueDate) {
      const termsDays = supplier?.paymentTermsDays || 30;
      const targetDate = new Date(purchaseDate);
      targetDate.setDate(targetDate.getDate() + termsDays);
      dueDate = targetDate.toISOString();
    }

    const { data: apData, error: apErr } = await supabase
      .from("accounts_payable")
      .insert({
        business_id: businessId,
        purchase_id: purchaseId,
        supplier_id: parsed.supplierId || null,
        amount: total,
        total_amount: total,
        paid_amount: 0,
        balance: total,
        due_date: dueDate,
        status: "pending",
        notes: `Crédito por compra ${purchaseNumber}`,
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
    }
  }

  // 8. Integración con Caja: deducir automáticamente del efectivo de la caja activa
  let cashImpactDeducted = false;
  let cashImpactRegisterName: string | null = null;
  let cashImpactSessionId: string | null = null;

  if (parsed.deductFromCashRegister && parsed.paymentType === "cash") {
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
            amount: total,
            referenceId: purchaseId,
            referenceType: "purchase",
            notes: `Pago compra ${purchaseNumber}${supplier ? ` - Prov: ${supplier.name}` : ""}`,
          },
          userId
        );

        // Registrar también en cash_transactions vinculado al turno activo
        try {
          await supabase.from("cash_transactions").insert({
            business_id: businessId,
            session_id: activeSession.id,
            type: "expense",
            amount: total,
            reference_id: purchaseId,
            reference_type: "purchase",
            notes: `Egreso automático por compra ${purchaseNumber}`,
            created_at: new Date().toISOString(),
          });
        } catch {
          // Ignorar si cash_transactions es un alias de vista
        }

        cashImpactDeducted = true;

        // Actualizar datos de caja en la compra
        await supabase
          .from("purchases")
          .update({
            cash_register_name: cashImpactRegisterName,
            deduct_from_cash_register: true,
          })
          .eq("id", purchaseId);
      }
    } catch (cashErr) {
      console.error("[createPurchase] Error al registrar movimiento de caja:", cashErr);
    }
  }

  const impactSummary = {
    inventoryImpacts,
    cashImpact: {
      deducted: cashImpactDeducted,
      amount: cashImpactDeducted ? total : 0,
      cashRegisterName: cashImpactRegisterName,
      sessionId: cashImpactSessionId,
    },
  };

  // Guardar impactSummary en metadata de la compra si el cliente soporta update
  try {
    const tableQuery = supabase.from("purchases");
    if (typeof tableQuery?.update === "function") {
      await tableQuery
        .update({
          metadata: {
            deduct_from_cash_register: cashImpactDeducted,
            cash_register_name: cashImpactRegisterName,
            impact_summary: impactSummary,
          },
        })
        .eq("id", purchaseId);
    }
  } catch (mErr) {
    console.warn("[createPurchase] Advertencia al guardar impact_summary en metadata:", mErr);
  }

  return {
    ...mapPurchaseRow({
      ...purchaseData,
      deduct_from_cash_register: cashImpactDeducted,
      cash_register_name: cashImpactRegisterName,
      suppliers: supplier ? { id: supplier.id, name: supplier.name } : null,
      purchase_items: insertedItems || [],
      accounts_payable: createdAccountPayable ? [createdAccountPayable] : [],
      metadata: {
        deduct_from_cash_register: cashImpactDeducted,
        cash_register_name: cashImpactRegisterName,
        impact_summary: impactSummary,
      },
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
 * Consulta las compras registradas con filtros por periodo, proveedor, método de pago y estado.
 */
export async function getPurchases(
  businessId: string,
  filters: PurchaseFilters = {}
): Promise<Purchase[]> {
  const supabase = await getDbClient();

  let query = supabase
    .from("purchases")
    .select(
      `
      *,
      suppliers(id, name),
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

  // Orden descendente por fecha
  query = query.order("purchase_date", { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error("[getPurchases] Error al listar compras:", error);
    throw new Error(`Error al consultar compras: ${error.message}`);
  }

  let list = (data || []).map(mapPurchaseRow);

  // Filtrado adicional en memoria para pestañas de estado complejas
  const now = new Date();
  if (filters.statusTab && filters.statusTab !== "all") {
    if (filters.statusTab === "cash") {
      list = list.filter((p) => p.paymentType === "cash");
    } else if (filters.statusTab === "credit") {
      list = list.filter((p) => p.paymentType === "credit");
    } else if (filters.statusTab === "pending") {
      list = list.filter((p) => p.accountPayable && p.accountPayable.balance > 0);
    } else if (filters.statusTab === "overdue") {
      const nowDateStr = now.toISOString();
      list = list.filter(
        (p) =>
          p.accountPayable &&
          p.accountPayable.balance > 0 &&
          p.accountPayable.dueDate < nowDateStr
      );
    }
  }

  // Búsqueda de texto (código de compra, número de factura, proveedor o notas)
  if (filters.search && filters.search.trim().length > 0) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.purchaseNumber.toLowerCase().includes(q) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
        (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q))
    );
  }

  return list;
}

/**
 * Calcula los KPIs financieros y operativos de compras para el negocio.
 */
export async function getPurchaseKPIs(businessId: string): Promise<PurchaseKPIs> {
  const supabase = await getDbClient();

  const [purchasesRes, apRes] = await Promise.all([
    supabase
      .from("purchases")
      .select("total, payment_type, status, supplier_id")
      .eq("business_id", businessId)
      .eq("status", "confirmed"),
    supabase
      .from("accounts_payable")
      .select("balance, due_date, status")
      .eq("business_id", businessId)
      .neq("status", "paid")
      .neq("status", "cancelled"),
  ]);

  const purchases = purchasesRes.data || [];
  const accounts = apRes.data || [];

  let totalPurchased = 0;
  let totalCash = 0;
  let totalCredit = 0;
  const uniqueSuppliers = new Set<string>();

  for (const p of purchases) {
    const amount = Number(p.total || 0);
    totalPurchased += amount;
    if (p.payment_type === "cash") {
      totalCash += amount;
    } else if (p.payment_type === "credit") {
      totalCredit += amount;
    }
    if (p.supplier_id) {
      uniqueSuppliers.add(p.supplier_id);
    }
  }

  // Cuentas por pagar hoy o vencidas
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayIso = endOfToday.toISOString();

  let dueTodayOrOverdue = 0;
  for (const a of accounts) {
    const bal = Number(a.balance || 0);
    if (bal > 0 && a.due_date <= endOfTodayIso) {
      dueTodayOrOverdue += bal;
    }
  }

  return {
    totalPurchased: Number(totalPurchased.toFixed(2)),
    uniqueSuppliersCount: uniqueSuppliers.size,
    totalCash: Number(totalCash.toFixed(2)),
    totalCredit: Number(totalCredit.toFixed(2)),
    dueTodayOrOverdue: Number(dueTodayOrOverdue.toFixed(2)),
    totalPurchasesCount: purchases.length,
  };
}

/**
 * Anula una compra registrada y revierte sus afectaciones contables y de existencias.
 */
export async function cancelPurchase(
  businessId: string,
  purchaseId: string,
  userId?: string | null
): Promise<void> {
  const supabase = await getDbClient();

  // 1. Obtener la compra y sus ítems
  const { data: purchase, error: pErr } = await supabase
    .from("purchases")
    .select(`*, purchase_items(*)`)
    .eq("id", purchaseId)
    .eq("business_id", businessId)
    .single();

  if (pErr || !purchase) {
    throw new Error("La compra no existe o no pertenece a este comercio.");
  }

  if (purchase.status === "cancelled") {
    throw new Error("La compra ya se encuentra anulada.");
  }

  // 2. Marcar compra como cancelada
  await supabase
    .from("purchases")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", purchaseId)
    .eq("business_id", businessId);

  // 3. Cancelar cuenta por pagar asociada si existe
  await supabase
    .from("accounts_payable")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("purchase_id", purchaseId)
    .eq("business_id", businessId);

  // 4. Revertir existencias de ítems inventariables
  if (Array.isArray(purchase.purchase_items)) {
    for (const item of purchase.purchase_items) {
      if (item.is_inventory_item && item.product_id && item.location_id) {
        try {
          await recordInventoryMovement(
            businessId,
            {
              productId: item.product_id,
              locationId: item.location_id,
              movementType: "exit",
              quantity: Number(item.quantity),
              unitCost: Number(item.unit_cost),
              referenceType: "purchase",
              referenceId: purchaseId,
              notes: `Anulación de compra ${purchase.purchase_number}`,
            },
            userId
          );
        } catch (revErr) {
          console.warn(`[cancelPurchase] No se pudo revertir stock para producto ${item.product_id}:`, revErr);
        }
      }
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
    console.error("[getAccountsPayable] Error al consultar cuentas por pagar:", error);
    throw new Error(`Error al consultar cuentas por pagar: ${error.message}`);
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
    console.error("[getAccountsPayableKPIs] Error al consultar métricas:", error);
    throw new Error(`Error al consultar métricas de cuentas por pagar: ${error.message}`);
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

