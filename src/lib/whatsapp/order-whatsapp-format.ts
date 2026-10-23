/**
 * FORMATEO Y NORMALIZACIÓN DE WHATSAPP PARA PEDIDOS (NEGOVA)
 * 
 * Módulo puro y universal (Isomorphic):
 * Seguro para ejecutarse tanto en Client Components como en Server Components.
 * CERO dependencias de Node.js, `next/headers` o Supabase.
 */

export interface NormalizedWhatsAppResult {
  isValid: boolean;
  normalized: string | null;
  formattedDisplay: string | null;
  error?: string;
}

export interface OrderItemSummary {
  name: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string | null;
  selectedModifiers?: Array<{
    groupName?: string;
    optionName: string;
    price?: number;
  }>;
}

export interface WhatsAppOrderSummaryData {
  orderNumber: number;
  businessName: string;
  orderType: "dine_in" | "takeout" | "delivery";
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryReference?: string | null;
  paymentMethodLabel?: string | null;
  notes?: string | null;
  subtotal: number;
  deliveryFee?: number;
  total: number;
  currency?: string;
  items: OrderItemSummary[];
}

/**
 * Normaliza y valida un número telefónico para WhatsApp.
 * - Elimina caracteres no numéricos.
 * - Soporta números colombianos locales (10 dígitos empezando en 3 -> antepone 57).
 * - Soporta números internacionales E.164 (entre 10 y 15 dígitos).
 */
export function normalizeWhatsAppNumber(rawPhone?: string | null): NormalizedWhatsAppResult {
  if (!rawPhone || typeof rawPhone !== "string") {
    return {
      isValid: false,
      normalized: null,
      formattedDisplay: null,
      error: "Número no especificado.",
    };
  }

  // Eliminar todo lo que no sea dígito
  let digits = rawPhone.replace(/\D/g, "");

  // Si tiene ceros a la izquierda innecesarios (ej. 0057...), removerlos
  digits = digits.replace(/^0+/, "");

  if (!digits || digits.length < 7) {
    return {
      isValid: false,
      normalized: null,
      formattedDisplay: null,
      error: "Número de teléfono demasiado corto.",
    };
  }

  // Caso Colombia: 10 dígitos iniciando con 3 (ej. 3114567890 -> 573114567890)
  if (digits.length === 10 && digits.startsWith("3")) {
    digits = `57${digits}`;
  }

  // Validar longitud internacional estándar E.164 (entre 10 y 15 dígitos)
  if (digits.length < 10 || digits.length > 15) {
    return {
      isValid: false,
      normalized: null,
      formattedDisplay: null,
      error: "El número no cumple con el estándar internacional de WhatsApp (10 a 15 dígitos con indicativo).",
    };
  }

  // Formateo visual amigable para UI
  let formattedDisplay = `+${digits}`;
  if (digits.startsWith("57") && digits.length === 12) {
    // +57 3XX XXX XXXX
    formattedDisplay = `+57 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }

  return {
    isValid: true,
    normalized: digits,
    formattedDisplay,
  };
}

/**
 * Formatea valores en moneda COP por defecto.
 * Remueve espacios no rompibles (NBSP) para renderizado uniforme en cualquier SO.
 */
export function formatCurrency(amount: number, currency = "COP"): string {
  try {
    const formatted = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency || "COP",
      maximumFractionDigits: 0,
    }).format(amount);
    return formatted.replace(/[\u00A0\s]+/g, "");
  } catch {
    return `$${amount.toLocaleString("es-CO")}`;
  }
}

/**
 * Confecciona el mensaje legible de WhatsApp con el resumen verificado del pedido.
 */
export function formatOrderSummaryMessage(data: WhatsAppOrderSummaryData): string {
  const curr = data.currency || "COP";
  const lines: string[] = [];

  // 1. Encabezado
  lines.push(`*¡NUEVO PEDIDO #${data.orderNumber} DESDE EL MENÚ DIGITAL!*`);
  lines.push(`*Comercio:* ${data.businessName}`);
  lines.push("");

  // 2. Modalidad y datos de contacto
  if (data.orderType === "delivery") {
    lines.push(`*Modalidad:* Domicilio 🛵`);
    if (data.customerName) lines.push(`*Cliente:* ${data.customerName}`);
    if (data.customerPhone) lines.push(`*Teléfono:* ${data.customerPhone}`);
    if (data.deliveryAddress) lines.push(`*Dirección de entrega:* ${data.deliveryAddress}`);
    if (data.deliveryReference) lines.push(`*Puntos de referencia:* ${data.deliveryReference}`);
  } else if (data.orderType === "takeout") {
    lines.push(`*Modalidad:* Recogida en el local 🛍️`);
    if (data.customerName) lines.push(`*Cliente:* ${data.customerName}`);
    if (data.customerPhone) lines.push(`*Teléfono:* ${data.customerPhone}`);
  } else {
    lines.push(`*Modalidad:* Consumo en mesa 🍽️`);
  }

  lines.push("");

  // 3. Detalle de productos
  lines.push(`*DETALLE DE PRODUCTOS:*`);
  data.items.forEach((item) => {
    const variantSuffix = item.variantName ? ` (${item.variantName})` : "";
    lines.push(
      `• ${item.quantity}x ${item.name}${variantSuffix} — ${formatCurrency(item.unitPrice, curr)} c/u (Subt: ${formatCurrency(item.subtotal, curr)})`
    );

    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      const modText = item.selectedModifiers
        .map((m) => (m.price && m.price > 0 ? `${m.optionName} (+${formatCurrency(m.price, curr)})` : m.optionName))
        .join(", ");
      lines.push(`  └ *Complementos:* ${modText}`);
    }

    if (item.notes && item.notes.trim()) {
      lines.push(`  └ *Nota:* ${item.notes.trim()}`);
    }
  });

  lines.push("");

  // 4. Totales financieros
  lines.push(`*RESUMEN DE CUENTA:*`);
  lines.push(`*Subtotal productos:* ${formatCurrency(data.subtotal, curr)}`);

  if (data.orderType === "delivery" && typeof data.deliveryFee === "number" && data.deliveryFee > 0) {
    lines.push(`*Costo de domicilio:* ${formatCurrency(data.deliveryFee, curr)}`);
  }

  lines.push(`*TOTAL:* ${formatCurrency(data.total, curr)}`);

  // 5. Método de pago
  if (data.paymentMethodLabel) {
    lines.push(`*Método de pago propuesto:* ${data.paymentMethodLabel}`);
  }

  // 6. Observaciones generales del cliente
  if (data.notes && data.notes.trim()) {
    lines.push(`*Observaciones:* ${data.notes.trim()}`);
  }

  lines.push("");
  lines.push(`_Pedido registrado en NEGOVA. Por favor confirma la recepción de este mensaje._`);

  return lines.join("\n");
}

/**
 * Construye el enlace de WhatsApp (https://wa.me/NUMERO?text=...) validando el número.
 * Retorna null si el número no está configurado o no es válido.
 */
export function buildWhatsAppOrderLink(
  rawPhone: string | null | undefined,
  message: string
): { url: string | null; isValid: boolean; normalizedNumber: string | null } {
  const norm = normalizeWhatsAppNumber(rawPhone);
  if (!norm.isValid || !norm.normalized) {
    return {
      url: null,
      isValid: false,
      normalizedNumber: null,
    };
  }

  const encodedText = encodeURIComponent(message);
  return {
    url: `https://wa.me/${norm.normalized}?text=${encodedText}`,
    isValid: true,
    normalizedNumber: norm.normalized,
  };
}
