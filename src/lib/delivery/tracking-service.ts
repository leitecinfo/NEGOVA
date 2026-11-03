/**
 * SERVICIO PÚBLICO DE SEGUIMIENTO DE PEDIDOS A DOMICILIO [DOM-004]
 * 
 * Reglas de Arquitectura y Seguridad:
 * 1. Acceso Público Seguro: Acceso exclusivamente por código único de seguimiento tipo TRK-XXXXXX.
 * 2. Cero Exposición de Datos Sensibles: NUNCA expone el PIN de entrega, ni el PIN/teléfono/identificación
 *    del repartidor, ni credenciales internas.
 * 3. Sanitización de Notas: Los tags de notas internas como [PIN:1234:0] y [TRK:XXXXXX] se eliminan
 *    antes de retornar datos a la vista pública.
 * 4. Resiliencia Multi-Entorno: Búsqueda indexada por columna `tracking_code` con fallback automático
 *    a extracción desde notas para compatibilidad universal.
 */

import crypto from "crypto";
import { getDbClient } from "@/lib/restaurant/restaurant-service";

export type TrackingStep = "confirmed" | "preparing" | "in_transit" | "delivered" | "cancelled";

export interface TrackingStepInfo {
  step: "confirmed" | "preparing" | "in_transit" | "delivered";
  label: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

export interface PublicTrackingItem {
  id: string;
  productName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string | null;
  modifiers?: Array<{
    groupName?: string;
    optionName: string;
    price?: number;
  }>;
}

export interface PublicOrderTrackingDTO {
  trackingCode: string;
  orderId: string;
  orderNumber: number;
  orderType: "delivery";
  status: string;
  deliveryStatus: string;
  currentStep: TrackingStep;
  progressPercentage: number;
  steps: TrackingStepInfo[];
  createdAt: string;
  updatedAt: string;
  customerName: string | null;
  deliveryAddress: string | null;
  deliveryReference: string | null;
  notes: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  business: {
    id: string;
    name: string;
    logoUrl: string | null;
    phone: string | null;
    whatsapp: string | null;
  };
  items: PublicTrackingItem[];
}

/**
 * 1. Genera un código de seguimiento único tipo TRK-XXXXXX
 * Utiliza 6 caracteres alfanuméricos en mayúsculas no ambiguos (sin 0, 1, I, O).
 */
export function generateTrackingCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return `TRK-${code}`;
}

/**
 * 2. Valida el formato del código de seguimiento
 */
export function isValidTrackingCode(code?: string | null): boolean {
  if (!code || typeof code !== "string") return false;
  return /^TRK-[2-9A-HJ-NP-Z]{6}$/i.test(code.trim());
}

/**
 * 3. Extrae el código de seguimiento almacenado en notas si existe
 */
export function extractTrackingCode(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/\[TRK:([0-9A-Z\-]+)\]/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * 4. Sanitiza notas de pedido para el cliente público
 * Remueve [PIN:XXXX:0] y [TRK:XXXXXX] para no exponer datos sensibles.
 */
export function sanitizePublicNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const clean = notes
    .replace(/\[PIN:[0-9A-Z]{4,6}(?::\d+)?\]/gi, "")
    .replace(/\[TRK:[0-9A-Z\-]+\]/gi, "")
    .trim();
  return clean || null;
}

/**
 * 5. Determina los pasos de la barra de progreso y el estado actual
 * Pasos: Confirmado → Preparando → En camino → Entregado
 */
export function calculateTrackingProgress(
  orderStatus: string,
  deliveryStatus?: string | null
): {
  currentStep: TrackingStep;
  progressPercentage: number;
  steps: TrackingStepInfo[];
} {
  const st = (orderStatus || "").toLowerCase();
  const dst = (deliveryStatus || "").toLowerCase();

  // Caso especial: Pedido cancelado
  if (st === "cancelled") {
    return {
      currentStep: "cancelled",
      progressPercentage: 0,
      steps: [
        {
          step: "confirmed",
          label: "Confirmado",
          description: "Pedido recibido en el sistema",
          isCompleted: false,
          isCurrent: false,
        },
        {
          step: "preparing",
          label: "Preparando",
          description: "En cocina o empaque",
          isCompleted: false,
          isCurrent: false,
        },
        {
          step: "in_transit",
          label: "En camino",
          description: "Repartidor en ruta hacia tu dirección",
          isCompleted: false,
          isCurrent: false,
        },
        {
          step: "delivered",
          label: "Entregado",
          description: "Entrega completada exitosamente",
          isCompleted: false,
          isCurrent: false,
        },
      ],
    };
  }

  // Lógica de avance según estados
  const isDelivered = st === "delivered" || dst === "delivered";
  const isInTransit = !isDelivered && (dst === "in_transit" || st === "ready");
  const isPreparing =
    !isDelivered &&
    !isInTransit &&
    (st === "in_preparation" || st === "preparing" || dst === "assigned");
  const isConfirmed = !isDelivered && !isInTransit && !isPreparing;

  let currentStep: TrackingStep = "confirmed";
  let progressPercentage = 25;

  if (isDelivered) {
    currentStep = "delivered";
    progressPercentage = 100;
  } else if (isInTransit) {
    currentStep = "in_transit";
    progressPercentage = 75;
  } else if (isPreparing) {
    currentStep = "preparing";
    progressPercentage = 50;
  } else {
    currentStep = "confirmed";
    progressPercentage = 25;
  }

  const steps: TrackingStepInfo[] = [
    {
      step: "confirmed",
      label: "Confirmado",
      description: "Hemos recibido tu pedido correctamente",
      isCompleted: true,
      isCurrent: currentStep === "confirmed",
    },
    {
      step: "preparing",
      label: "Preparando",
      description: "El restaurante está cocinando tus platos",
      isCompleted: isPreparing || isInTransit || isDelivered,
      isCurrent: currentStep === "preparing",
    },
    {
      step: "in_transit",
      label: "En camino",
      description: "Tu pedido va en camino con el repartidor",
      isCompleted: isInTransit || isDelivered,
      isCurrent: currentStep === "in_transit",
    },
    {
      step: "delivered",
      label: "Entregado",
      description: "¡Disfruta tu comida!",
      isCompleted: isDelivered,
      isCurrent: currentStep === "delivered",
    },
  ];

  return {
    currentStep,
    progressPercentage,
    steps,
  };
}

/**
 * 6. Consulta pública del seguimiento de un pedido por código único (TRK-XXXXXX)
 * Retorna null si no existe. No requiere sesión de usuario.
 */
export async function getPublicOrderTracking(
  trackingCode: string
): Promise<PublicOrderTrackingDTO | null> {
  const cleanCode = (trackingCode || "").trim().toUpperCase();
  if (!cleanCode) return null;

  try {
    const supabase = await getDbClient();

    // 1. Intentar consulta directa por columna tracking_code
    let order: any = null;
    const { data: directData, error: directErr } = await supabase
      .from("restaurant_orders")
      .select("*, restaurant_order_items(*)")
      .eq("tracking_code", cleanCode)
      .maybeSingle();

    if (!directErr && directData) {
      order = directData;
    } else {
      // 2. Fallback: búsqueda en notas [TRK:cleanCode]
      const { data: fallbackData } = await supabase
        .from("restaurant_orders")
        .select("*, restaurant_order_items(*)")
        .ilike("notes", `%[TRK:${cleanCode}]%`)
        .maybeSingle();

      if (fallbackData) {
        order = fallbackData;
      }
    }

    if (!order) {
      return null;
    }

    // 2. Consultar datos públicos del comercio (logo, nombre, teléfonos de contacto)
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, logo_url, phone, whatsapp, currency")
      .eq("id", order.business_id)
      .maybeSingle();

    const progress = calculateTrackingProgress(order.status, order.delivery_status);

    // 3. Mapear items de manera segura
    const rawItems: any[] = order.restaurant_order_items || [];
    const items: PublicTrackingItem[] = rawItems.map((it) => ({
      id: it.id,
      productName: it.product_name,
      variantName: it.variant_name || null,
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unit_price || 0),
      subtotal: Number(it.subtotal || 0),
      notes: it.notes || null,
      modifiers: Array.isArray(it.modifiers) ? it.modifiers : undefined,
    }));

    return {
      trackingCode: cleanCode,
      orderId: order.id,
      orderNumber: Number(order.order_number),
      orderType: "delivery",
      status: order.status,
      deliveryStatus: order.delivery_status || "pending",
      currentStep: progress.currentStep,
      progressPercentage: progress.progressPercentage,
      steps: progress.steps,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      customerName: order.customer_name || null,
      deliveryAddress: order.delivery_address || null,
      deliveryReference: order.delivery_reference || null,
      notes: sanitizePublicNotes(order.notes),
      subtotal: Number(order.subtotal || 0),
      deliveryFee: Number(order.delivery_fee || 0),
      total: Number(order.total || 0),
      currency: business?.currency || "COP",
      business: {
        id: order.business_id,
        name: business?.name || "Restaurante",
        logoUrl: business?.logo_url || null,
        phone: business?.phone || null,
        whatsapp: business?.whatsapp || null,
      },
      items,
    };
  } catch (err) {
    console.error("[getPublicOrderTracking] Error al consultar pedido:", err);
    return null;
  }
}
