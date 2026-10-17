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
  notes?: string;
}

export interface PosOrderSummary {
  items: PosCartItem[];
  itemsCount: number; // Cantidad total de artículos individuales sumados
  linesCount: number; // Cantidad de líneas distintas en el pedido
  subtotal: number; // Suma de lineTotal de todos los items
  tax: number; // Impuesto (0 o porcentaje)
  discount: number; // Descuento global
  total: number; // subtotal - discount + tax
}

// ==============================================================================
// FUNCIONES PURAS DE CÁLCULO Y DETERMINACIÓN DE LÍNEAS
// ==============================================================================

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
 * Calcula el resumen totalizador del carrito de compras del POS.
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
  
  const safeDiscount = Math.max(0, Math.min(subtotal, discount || 0));
  const safeTax = Math.max(0, tax || 0);
  const total = Math.max(0, subtotal - safeDiscount + safeTax);

  return {
    items: safeItems,
    itemsCount,
    linesCount,
    subtotal: Math.round(subtotal),
    tax: Math.round(safeTax),
    discount: Math.round(safeDiscount),
    total: Math.round(total),
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

