"use server";

import { createRestaurantOrder } from "@/lib/restaurant/restaurant-service";
import { validateTableQrAccess } from "@/lib/restaurant/restaurant-service";
import { CreateRestaurantOrderInput } from "@/lib/restaurant/types";
import { getBusinessPaymentMethods } from "@/lib/payments/payment-methods-service";
import { PAYMENT_METHOD_CODES, PAYMENT_METHODS_CATALOG } from "@/lib/payments/payment-methods-catalog";
import { PaymentMethodCode } from "@/lib/payments/types";

export interface CreatePublicOrderInput {
  businessId: string;
  orderType: "dine_in" | "takeout" | "delivery";
  tableId?: string | null;
  tableToken?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryReference?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  items: Array<{
    productId: string;
    variantId?: string | null;
    variantName?: string | null;
    quantity: number;
    notes?: string;
    selectedModifiers?: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
      price: number;
    }>;
  }>;
}

import {
  getBusinessOrderWhatsAppConfig,
  buildWhatsAppOrderLink,
  formatOrderSummaryMessage,
  OrderItemSummary,
} from "@/lib/whatsapp/order-whatsapp-service";
import { getRestaurantOrderById } from "@/lib/restaurant/restaurant-service";

export interface CreatePublicOrderResponse {
  success: boolean;
  orderId?: string;
  orderNumber?: number;
  total?: number;
  orderType?: "dine_in" | "takeout" | "delivery";
  whatsappUrl?: string | null;
  hasBusinessWhatsapp?: boolean;
  error?: string;
}

/**
 * Server Action Pública: Crea un pedido originado desde el Menú Digital o QR sin requerir inicio de sesión.
 * - Determina y valida la modalidad estrictamente en el servidor, sin confiar ciegamente en datos del navegador.
 * - Si es "dine_in", valida criptográficamente que el QR corresponda a la mesa activa del negocio y no haya sido manipulado.
 * - Si es "takeout", exige customerName y customerPhone, anulando cualquier asignación indebida de mesa o domicilio.
 * - Si es "delivery", exige customerName, customerPhone y deliveryAddress, anulando asignación de mesa.
 * - Preserva channelOrigin como 'digital_menu' de forma inmutable.
 */
export async function createPublicMenuOrderAction(
  input: CreatePublicOrderInput
): Promise<CreatePublicOrderResponse> {
  try {
    if (!input.businessId) {
      return { success: false, error: "Identificador de negocio ausente." };
    }

    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      return { success: false, error: "El pedido debe contener al menos un producto." };
    }

    // 1. Determinación y validación estricta de la modalidad en el servidor
    let validatedOrderType: "dine_in" | "takeout" | "delivery";

    if (input.orderType === "dine_in") {
      if (!input.tableId || !input.tableToken?.trim()) {
        return {
          success: false,
          error: "Para consumo en mesa debes escanear el código QR correspondiente a tu mesa.",
        };
      }

      // Validar el token seguro del QR en el servidor mediante HMAC de service role
      const qrValidation = await validateTableQrAccess(
        input.businessId,
        input.tableId,
        input.tableToken.trim()
      );

      if (!qrValidation.valid || !qrValidation.table) {
        return {
          success: false,
          error: qrValidation.error || "El código QR de la mesa es inválido o ha caducado.",
        };
      }

      validatedOrderType = "dine_in";
    } else if (input.orderType === "takeout") {
      if (!input.customerName?.trim()) {
        return { success: false, error: "Por favor ingresa tu nombre para identificar el pedido." };
      }
      if (!input.customerPhone?.trim()) {
        return { success: false, error: "Por favor ingresa tu número de teléfono de contacto." };
      }

      validatedOrderType = "takeout";
    } else if (input.orderType === "delivery") {
      if (!input.customerName?.trim()) {
        return { success: false, error: "Por favor ingresa el nombre de quien recibe el pedido." };
      }
      if (!input.customerPhone?.trim()) {
        return { success: false, error: "Por favor ingresa tu teléfono celular de contacto." };
      }
      if (!input.deliveryAddress?.trim()) {
        return { success: false, error: "Por favor ingresa la dirección de entrega de tu domicilio." };
      }

      validatedOrderType = "delivery";
    } else {
      return { success: false, error: "Modalidad de consumo no válida." };
    }

    // Validación estricta del método de pago en el servidor
    let paymentLabel: string | null = null;
    if (input.paymentMethod) {
      const pCode = input.paymentMethod.trim().toLowerCase();
      if (pCode === "cash") {
        paymentLabel = "Efectivo";
      } else if (pCode === "transfer") {
        paymentLabel = "Transferencia";
      } else if (PAYMENT_METHOD_CODES.includes(pCode as PaymentMethodCode)) {
        // Validar que el método pertenezca al catálogo y esté habilitado y configurado en este negocio
        const bizMethods = await getBusinessPaymentMethods(input.businessId);
        const configuredMethod = bizMethods[pCode as PaymentMethodCode];
        if (!configuredMethod || !configuredMethod.isEnabled || !configuredMethod.isConfigured) {
          return {
            success: false,
            error: `El método de pago ${PAYMENT_METHODS_CATALOG[pCode as PaymentMethodCode]?.name || pCode} no se encuentra activo o configurado en este comercio.`,
          };
        }
        paymentLabel = PAYMENT_METHODS_CATALOG[pCode as PaymentMethodCode]?.name || pCode;
      } else {
        return {
          success: false,
          error: "Método de pago no reconocido en el catálogo. Solo se admite efectivo o transferencia de las entidades habilitadas.",
        };
      }
    }

    const baseNotes = input.notes?.trim() || null;
    const finalNotesWithPayment = paymentLabel
      ? baseNotes
        ? `${baseNotes} | Método de pago propuesto: ${paymentLabel}`
        : `Método de pago propuesto: ${paymentLabel}`
      : baseNotes;

    // 2. Mapear a DTO confiable para restaurant-service blindando campos según la modalidad validada
    const orderInput: CreateRestaurantOrderInput = {
      orderType: validatedOrderType,
      channelOrigin: "digital_menu",
      tableId: validatedOrderType === "dine_in" ? input.tableId : null,
      customerName: validatedOrderType === "dine_in" ? null : input.customerName?.trim() || null,
      customerPhone: validatedOrderType === "dine_in" ? null : input.customerPhone?.trim() || null,
      deliveryAddress: validatedOrderType === "delivery" ? input.deliveryAddress?.trim() : null,
      deliveryReference: validatedOrderType === "delivery" ? input.deliveryReference?.trim() || null : null,
      notes: finalNotesWithPayment,
      idempotencyKey: input.idempotencyKey || null,
      items: input.items.map((it) => ({
        productId: it.productId,
        variantId: it.variantId || null,
        variantName: it.variantName || null,
        quantity: it.quantity,
        notes: it.notes || undefined,
        selectedModifiers: it.selectedModifiers || undefined,
      })),
    };

    // 3. Crear pedido en el servicio (recalcula precios en BD, atomicidad y prevención de duplicados)
    const result = await createRestaurantOrder(input.businessId, orderInput);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // 4. Resolver configuración de WhatsApp del negocio asegurando aislamiento multi-tenant
    const bizWhatsApp = await getBusinessOrderWhatsAppConfig(input.businessId);

    // REGLA: Los pedidos de mesa (dine_in) no se envían a WhatsApp del negocio; se gestionan internamente en NEGOVA.
    if (validatedOrderType === "dine_in") {
      return {
        success: true,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        total: result.total,
        orderType: validatedOrderType,
        whatsappUrl: null,
        hasBusinessWhatsapp: bizWhatsApp.isConfigured,
      };
    }

    // Modalidades Recogida (takeout) y Domicilio (delivery):
    let whatsappUrl: string | null = null;

    if (bizWhatsApp.isConfigured && bizWhatsApp.whatsappNumber) {
      try {
        const confirmedOrderId = result.orderId!;
        const confirmedOrderNumber = result.orderNumber || 0;

        // Consultar el pedido real persistido con sus items y totales validados del servidor
        const savedOrder = await getRestaurantOrderById(input.businessId, confirmedOrderId);

        const orderItems: OrderItemSummary[] =
          savedOrder && Array.isArray((savedOrder as any).restaurant_order_items) && (savedOrder as any).restaurant_order_items.length > 0
            ? (savedOrder as any).restaurant_order_items.map((it: any) => ({
                name: it.product_name,
                variantName: it.variant_name || null,
                quantity: it.quantity,
                unitPrice: Number(it.unit_price || 0),
                subtotal: Number(it.subtotal || 0),
                notes: it.notes || null,
                selectedModifiers: it.selected_modifiers || undefined,
              }))
            : input.items.map((it) => ({
                name: `Producto`,
                variantName: it.variantName || null,
                quantity: it.quantity,
                unitPrice: 0,
                subtotal: 0,
                notes: it.notes || null,
                selectedModifiers: it.selectedModifiers?.map((m) => ({
                  optionName: m.optionName,
                  price: m.price,
                })),
              }));

        const summaryText = formatOrderSummaryMessage({
          orderNumber: confirmedOrderNumber,
          businessName: bizWhatsApp.businessName,
          orderType: validatedOrderType,
          customerName: input.customerName || null,
          customerPhone: input.customerPhone || null,
          deliveryAddress: input.deliveryAddress || null,
          deliveryReference: input.deliveryReference || null,
          paymentMethodLabel: paymentLabel,
          notes: input.notes || null,
          subtotal: savedOrder ? Number(savedOrder.subtotal || 0) : Number(result.total || 0),
          deliveryFee: savedOrder ? Number((savedOrder as any).delivery_fee || 0) : 0,
          total: Number(result.total || 0),
          items: orderItems,
        });

        const waLink = buildWhatsAppOrderLink(bizWhatsApp.whatsappNumber, summaryText);
        whatsappUrl = waLink.url;
      } catch (waErr) {
        console.warn("[createPublicMenuOrderAction] Advertencia no bloqueante al construir enlace de WhatsApp:", waErr);
      }
    }

    return {
      success: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      total: result.total,
      orderType: validatedOrderType,
      whatsappUrl,
      hasBusinessWhatsapp: bizWhatsApp.isConfigured,
    };
  } catch (err: any) {
    console.error("[createPublicMenuOrderAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Ocurrió un error inesperado al procesar tu pedido. Intenta nuevamente.",
    };
  }
}
