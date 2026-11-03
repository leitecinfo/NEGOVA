import { Product, ProductModifierGroup, ProductModifierOption, ProductVariant, getEffectiveVariantIngredients } from "../products/types";

// ==============================================================================
// NEGOVA POS — TIPOS Y MODELOS DEL PEDIDO TEMPORAL (CARRITO)
// ==============================================================================

export interface PosSelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number; // Precio adicional en COP (0 para gratuitas)
}

export interface PosCartItem {
  id: string; // Identificador único determinístico de la combinación
  productId: string;
  productName: string;
  productImage?: string | null;
  basePrice: number; // Precio unitario base o de variante en COP
  variantId?: string | null;
  variantName?: string | null;
  variantIngredients?: string | null;
  quantity: number; // Cantidad seleccionada (>= 1)
  selectedModifiers: PosSelectedModifier[];
  modifiersPrice: number; // Suma de precios adicionales de los modificadores
  unitPrice: number; // basePrice + modifiersPrice
  lineTotal: number; // unitPrice * quantity
  taxPercentage?: number; // Tarifa de IVA / Impuesto (ej. 0, 5, 8, 19)
  taxIncludedInPrice?: boolean; // ¿El precio ya incluye el impuesto?
  taxAmount?: number; // Monto de impuesto de esta línea en COP
  netSubtotal?: number; // Base gravable de la línea (excluyendo IVA)
  notes?: string;
  isCustom?: boolean;
  discountAmount?: number;
}

export interface PosOrderTaxBreakdown {
  percentage: number;
  base: number;
  taxAmount: number;
  included: boolean;
}

export interface PosOrderSummary {
  items: PosCartItem[];
  itemsCount: number; // Cantidad total de artículos individuales sumados
  linesCount: number; // Cantidad de líneas distintas en el pedido
  subtotal: number; // Suma de lineTotal de todos los items
  netSubtotal: number; // Base gravable neta total (sin IVA)
  includedTax: number; // Total IVA ya incluido en los precios
  additionalTax: number; // Total IVA adicional a cobrar
  tax: number; // Impuesto total liquidado (includedTax + additionalTax)
  discount: number; // Descuento global
  total: number; // Total a cobrar (subtotal - discount + additionalTax)
  taxesBreakdown: PosOrderTaxBreakdown[]; // Desglose por tarifas para tickets y facturación
}

// ==============================================================================
// FUNCIONES PURAS DE CÁLCULO Y DETERMINACIÓN DE LÍNEAS
// ==============================================================================

/**
 * Calcula la base gravable y el impuesto para una línea según su tarifa y condición de inclusión en precio.
 * Estándar fiscal:
 * - Si taxIncludedInPrice es true: netSubtotal = round(lineTotal / (1 + rate / 100)), taxAmount = lineTotal - netSubtotal
 * - Si taxIncludedInPrice es false: netSubtotal = lineTotal, taxAmount = round(lineTotal * (rate / 100))
 */
export function calculateItemTax(
  lineTotal: number,
  taxPercentage: number = 0,
  taxIncludedInPrice: boolean = true
): { netSubtotal: number; taxAmount: number } {
  const safeTotal = Math.max(0, lineTotal || 0);
  const safeRate = Math.max(0, taxPercentage || 0);

  if (safeRate <= 0) {
    return { netSubtotal: safeTotal, taxAmount: 0 };
  }

  if (taxIncludedInPrice) {
    const netSubtotal = Math.round(safeTotal / (1 + safeRate / 100));
    const taxAmount = safeTotal - netSubtotal;
    return { netSubtotal, taxAmount };
  } else {
    const taxAmount = Math.round(safeTotal * (safeRate / 100));
    return { netSubtotal: safeTotal, taxAmount };
  }
}

/**
 * Genera un identificador único y determinístico para una línea del carrito.
 * Si dos adiciones tienen el mismo producto, misma variante y exactamente los mismos modificadores,
 * compartirán el mismo ID para permitir incrementar la cantidad.
 */
export function generateCartItemId(
  productId: string,
  selectedModifiers: PosSelectedModifier[] = [],
  variantId?: string | null
): string {
  const varPart = variantId ? `_var_${variantId}` : "_base";

  if (!selectedModifiers || selectedModifiers.length === 0) {
    return `item_${productId}${varPart}`;
  }

  // Ordenar modificadores por groupId y optionId para consistencia de firma
  const signature = [...selectedModifiers]
    .sort((a, b) => {
      const gComp = a.groupId.localeCompare(b.groupId);
      return gComp !== 0 ? gComp : a.optionId.localeCompare(b.optionId);
    })
    .map((m) => `${m.groupId}:${m.optionId}`)
    .join("|");

  return `item_${productId}${varPart}_${signature}`;
}

/**
 * Calcula el resumen totalizador del carrito de compras del POS con soporte para impuestos desagregados.
 */
export function calculateCartSummary(
  items: PosCartItem[],
  discount: number = 0,
  tax: number = 0
): PosOrderSummary {
  const safeItems = items || [];
  const itemsCount = safeItems.reduce((acc, item) => acc + (item.quantity || 0), 0);
  const linesCount = safeItems.length;
  const subtotal = safeItems.reduce((acc, item) => acc + (item.lineTotal || 0), 0);
  
  let includedTax = 0;
  let additionalTax = 0;
  let netSubtotal = 0;

  const breakdownMap = new Map<string, { percentage: number; base: number; taxAmount: number; included: boolean }>();

  for (const item of safeItems) {
    const rate = Math.max(0, item.taxPercentage || 0);
    const included = item.taxIncludedInPrice !== false;
    
    // Usar valores cacheados en el item o recalcularlos
    let itemNet = item.netSubtotal;
    let itemTax = item.taxAmount;

    if (itemNet === undefined || itemTax === undefined) {
      const calc = calculateItemTax(item.lineTotal, rate, included);
      itemNet = calc.netSubtotal;
      itemTax = calc.taxAmount;
    }

    if (rate > 0) {
      if (included) {
        includedTax += itemTax;
        netSubtotal += itemNet;
      } else {
        additionalTax += itemTax;
        netSubtotal += itemNet;
      }

      const key = `${rate}_${included ? "inc" : "exc"}`;
      const existing = breakdownMap.get(key) || { percentage: rate, base: 0, taxAmount: 0, included };
      existing.base += itemNet;
      existing.taxAmount += itemTax;
      breakdownMap.set(key, existing);
    } else {
      netSubtotal += item.lineTotal;
    }
  }

  // Si se envió un impuesto adicional manual/global
  const safeTax = Math.max(0, tax || 0);
  additionalTax += safeTax;

  const safeDiscount = Math.max(0, Math.min(subtotal, discount || 0));
  const total = Math.max(0, subtotal - safeDiscount + additionalTax);

  const taxesBreakdown: PosOrderTaxBreakdown[] = Array.from(breakdownMap.values()).map((b) => ({
    percentage: b.percentage,
    base: Math.round(b.base),
    taxAmount: Math.round(b.taxAmount),
    included: b.included,
  }));

  return {
    items: safeItems,
    itemsCount,
    linesCount,
    subtotal: Math.round(subtotal),
    netSubtotal: Math.round(netSubtotal),
    includedTax: Math.round(includedTax),
    additionalTax: Math.round(additionalTax),
    tax: Math.round(includedTax + additionalTax),
    discount: Math.round(safeDiscount),
    total: Math.round(total),
    taxesBreakdown,
  };
}

/**
 * Construye una línea del carrito validando los precios y multiplicadores.
 * Respeta el precio y nombre de la variante si ha sido seleccionada.
 */
export function createCartItem(
  product: Product,
  selectedModifiers: PosSelectedModifier[] = [],
  quantity: number = 1,
  notes?: string,
  variant?: ProductVariant | null
): PosCartItem {
  const safeQuantity = Math.max(1, Math.floor(quantity || 1));
  const basePrice = variant ? Math.max(0, variant.price || 0) : Math.max(0, product.price || 0);
  
  const modifiersPrice = (selectedModifiers || []).reduce(
    (sum, mod) => sum + Math.max(0, mod.price || 0),
    0
  );

  const unitPrice = basePrice + modifiersPrice;
  const lineTotal = unitPrice * safeQuantity;
  const id = generateCartItemId(product.id, selectedModifiers, variant?.id);

  const effectiveIngredients = variant
    ? getEffectiveVariantIngredients(product.metadata?.ingredients, variant)
    : (product.metadata?.ingredients || null);

  const taxPercentage = Number(product.metadata?.tax_percentage ?? (product as any).tax_percentage ?? 0);
  const taxIncludedInPrice = product.metadata?.tax_included_in_price ?? (product as any).tax_included_in_price ?? true;
  const { netSubtotal, taxAmount } = calculateItemTax(lineTotal, taxPercentage, taxIncludedInPrice);

  return {
    id,
    productId: product.id,
    productName: variant ? `${product.name} (${variant.name})` : product.name,
    productImage: product.image_url,
    basePrice,
    variantId: variant?.id || null,
    variantName: variant?.name || null,
    variantIngredients: effectiveIngredients || null,
    quantity: safeQuantity,
    selectedModifiers,
    modifiersPrice,
    unitPrice,
    lineTotal,
    taxPercentage,
    taxIncludedInPrice,
    taxAmount,
    netSubtotal,
    notes: notes?.trim() || undefined,
  };
}

/**
 * Valida si las opciones seleccionadas para un grupo de modificadores
 * cumplen con las reglas de obligatoriedad, mínimo y máximo.
 */
export function validateModifierGroupSelection(
  group: ProductModifierGroup,
  selectedOptionIds: string[]
): { isValid: boolean; error?: string } {
  const count = (selectedOptionIds || []).length;
  const minRequired = group.required ? Math.max(1, group.min_select || 1) : (group.min_select || 0);
  const maxAllowed = group.max_select ?? (group.required && !group.max_select ? 1 : Infinity);

  if (count < minRequired) {
    if (minRequired === 1 && group.required) {
      return {
        isValid: false,
        error: `Debes seleccionar al menos una opción en «${group.name}».`,
      };
    }
    return {
      isValid: false,
      error: `Debes seleccionar al menos ${minRequired} opciones en «${group.name}» (has seleccionado ${count}).`,
    };
  }

  if (count > maxAllowed) {
    return {
      isValid: false,
      error: `Puedes seleccionar como máximo ${maxAllowed} opciones en «${group.name}» (has seleccionado ${count}).`,
    };
  }

  return { isValid: true };
}

/**
 * Valida todas las selecciones de modificadores de un producto.
 */
export function validateAllModifierGroups(
  groups: ProductModifierGroup[] = [],
  selectionsByGroupId: Record<string, string[]> = {}
): { isValid: boolean; error?: string } {
  for (const group of groups) {
    const groupId = group.id || group.name;
    const selectedIds = selectionsByGroupId[groupId] || [];
    const check = validateModifierGroupSelection(group, selectedIds);
    if (!check.isValid) {
      return check;
    }
  }

  return { isValid: true };
}

/**
 * Formateador de moneda colombiana estándar (COP) para el POS
 */
export function formatCOP(val: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val || 0);
}

/**
 * Formatea un número entero con separador de miles usando puntos (es-CO: 20000 -> 20.000).
 * Si el valor es vacío o nulo, retorna string vacío.
 */
export function formatNumberWithDots(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (str === "") return "";
  const numeric = typeof value === "number" ? value : parseInt(str.replace(/\D/g, ""), 10);
  if (isNaN(numeric)) return "";
  if (numeric === 0) return "0";
  return numeric.toLocaleString("es-CO");
}

/**
 * Parsea un string con puntos separadores de miles de vuelta a un número entero limpio.
 */
export function parseNumberFromDots(value: string | null | undefined): number {
  if (!value) return 0;
  const clean = String(value).replace(/\D/g, "");
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}

