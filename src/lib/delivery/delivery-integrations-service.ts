import { getDbClient } from "@/lib/restaurant/restaurant-service";
import { logAuditAction } from "@/lib/audit/audit-service";
import {
  DeliveryProvider,
  DeliveryProviderConfig,
  DeliveryProviderCredentials,
  DeliveryIntegrationsState,
  FinancialComparisonItem,
  IntegrationStepItem,
  SimulatedOrderPayload,
} from "./integration-types";
import {
  getAppBaseUrl,
  generateWebhookUrl,
  getDefaultProviderConfig,
  calculateFinancialComparison,
  getIntegrationGuideSteps,
} from "./delivery-integrations-utils";

export {
  getAppBaseUrl,
  generateWebhookUrl,
  getDefaultProviderConfig,
  calculateFinancialComparison,
  getIntegrationGuideSteps,
};

/**
 * Consulta la configuración de integraciones de delivery almacenada en businesses.settings.delivery_integrations
 */
export async function getDeliveryIntegrationsConfig(
  businessId: string
): Promise<DeliveryIntegrationsState> {
  const supabase = await getDbClient();
  const { data: biz, error } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();

  const defaultRappi = getDefaultProviderConfig(businessId, "rappi");
  const defaultJusto = getDefaultProviderConfig(businessId, "justo");

  if (error || !biz) {
    return {
      rappi: defaultRappi,
      justo: defaultJusto,
    };
  }

  const saved = (biz.settings as any)?.delivery_integrations || {};

  const rappiConfig: DeliveryProviderConfig = {
    ...defaultRappi,
    ...(saved.rappi || {}),
    provider: "rappi",
    webhookUrl: generateWebhookUrl(businessId, "rappi"),
    credentials: {
      ...defaultRappi.credentials,
      ...(saved.rappi?.credentials || {}),
    },
  };

  const justoConfig: DeliveryProviderConfig = {
    ...defaultJusto,
    ...(saved.justo || {}),
    provider: "justo",
    webhookUrl: generateWebhookUrl(businessId, "justo"),
    credentials: {
      ...defaultJusto.credentials,
      ...(saved.justo?.credentials || {}),
    },
  };

  return {
    rappi: rappiConfig,
    justo: justoConfig,
  };
}

/**
 * Guarda o actualiza las credenciales y estado de integración de un proveedor
 */
export async function saveDeliveryIntegrationCredentials(
  businessId: string,
  provider: DeliveryProvider,
  credentials: DeliveryProviderCredentials,
  enabled: boolean,
  autoAcceptOrders: boolean,
  actorId?: string
): Promise<{ success: boolean; config?: DeliveryProviderConfig; error?: string }> {
  const supabase = await getDbClient();

  const { data: currentBiz, error: fetchErr } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .single();

  if (fetchErr || !currentBiz) {
    return { success: false, error: "Comercio no encontrado para guardar credenciales de integración." };
  }

  const currentSettings = (currentBiz.settings || {}) as Record<string, any>;
  const currentIntegrations = currentSettings.delivery_integrations || {};
  const previousProvider = currentIntegrations[provider] || getDefaultProviderConfig(businessId, provider);

  // Determinar estatus según credenciales
  let status: "not_configured" | "active" | "testing" | "disabled" = "not_configured";
  const hasKeys =
    provider === "rappi"
      ? Boolean(credentials.appId && credentials.clientSecret)
      : Boolean(credentials.apiKey);

  if (!enabled) {
    status = hasKeys ? "disabled" : "not_configured";
  } else if (hasKeys) {
    status = credentials.environment === "sandbox" ? "testing" : "active";
  }

  const updatedProviderConfig: DeliveryProviderConfig = {
    ...previousProvider,
    provider,
    enabled,
    status,
    autoAcceptOrders,
    credentials: {
      ...previousProvider.credentials,
      ...credentials,
    },
    webhookUrl: generateWebhookUrl(businessId, provider),
    updatedAt: new Date().toISOString(),
  };

  const updatedSettings = {
    ...currentSettings,
    delivery_integrations: {
      ...currentIntegrations,
      [provider]: updatedProviderConfig,
    },
  };

  const { error: saveErr } = await supabase
    .from("businesses")
    .update({
      settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (saveErr) {
    return { success: false, error: "No se pudo guardar la configuración de integración: " + saveErr.message };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "update_delivery_integration",
    entityType: "business_settings",
    entityId: businessId,
    description: `Actualizadas credenciales de integración para ${provider.toUpperCase()} (Estado: ${status}, Entorno: ${credentials.environment})`,
    metadata: {
      provider,
      status,
      enabled,
      environment: credentials.environment,
    },
  });

  return { success: true, config: updatedProviderConfig };
}

/**
 * Ingesta una orden de delivery entrante desde un webhook externo o simulación
 */
export async function ingestExternalDeliveryOrder(
  businessId: string,
  payload: SimulatedOrderPayload,
  actorId?: string
): Promise<{ success: boolean; orderId?: string; orderNumber?: number; error?: string }> {
  const supabase = await getDbClient();

  // 1. Obtener consecutivo siguiente de orden para el negocio
  const { data: maxOrder } = await supabase
    .from("restaurant_orders")
    .select("order_number")
    .eq("business_id", businessId)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrderNumber = (maxOrder?.order_number || 0) + 1;

  // 2. Insertar orden en restaurant_orders
  const orderInsertData = {
    business_id: businessId,
    order_number: nextOrderNumber,
    order_type: "delivery",
    channel_origin: payload.provider,
    subtotal: payload.subtotal,
    delivery_fee: payload.deliveryFee,
    total: payload.total,
    notes: `[EXT-${payload.provider.toUpperCase()}] ID: ${payload.externalOrderId}. ${payload.deliveryNotes || ""}`.trim(),
    customer_name: payload.customerName,
    customer_phone: payload.customerPhone,
    delivery_address: payload.deliveryAddress,
    delivery_reference: "Integración " + payload.provider.toUpperCase(),
    delivery_status: "pending",
    status: "received",
    payment_status: "paid",
  };

  const { data: newOrder, error: orderErr } = await supabase
    .from("restaurant_orders")
    .insert(orderInsertData)
    .select("id, order_number")
    .single();

  if (orderErr || !newOrder) {
    return {
      success: false,
      error: "Error al registrar pedido de " + payload.provider + ": " + (orderErr?.message || "Desconocido"),
    };
  }

  // 3. Insertar items del pedido
  if (payload.items && payload.items.length > 0) {
    const itemsToInsert = payload.items.map((it) => ({
      business_id: businessId,
      order_id: newOrder.id,
      product_name: it.name,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      subtotal: it.subtotal,
      notes: "Sincronizado desde " + payload.provider.toUpperCase(),
      modifiers: [],
    }));

    const { error: itemsErr } = await supabase
      .from("restaurant_order_items")
      .insert(itemsToInsert);

    if (itemsErr) {
      console.warn("[ingestExternalDeliveryOrder] Error al insertar ítems:", itemsErr.message);
    }
  }

  // 4. Actualizar lastSyncAt en businesses.settings.delivery_integrations[provider]
  try {
    const { data: biz } = await supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .single();

    if (biz?.settings) {
      const currentIntegrations = biz.settings.delivery_integrations || {};
      const currentProv = currentIntegrations[payload.provider] || {};
      const updatedProv = {
        ...currentProv,
        lastSyncAt: new Date().toISOString(),
      };
      await supabase
        .from("businesses")
        .update({
          settings: {
            ...biz.settings,
            delivery_integrations: {
              ...currentIntegrations,
              [payload.provider]: updatedProv,
            },
          },
        })
        .eq("id", businessId);
    }
  } catch {}

  // 5. Auditoría
  await logAuditAction({
    businessId,
    userId: actorId,
    action: "ingest_delivery_order",
    entityType: "restaurant_order",
    entityId: newOrder.id,
    description: `Pedido #${newOrder.order_number} sincronizado desde ${payload.provider.toUpperCase()} (Total: $${payload.total})`,
    metadata: {
      provider: payload.provider,
      orderNumber: newOrder.order_number,
      total: payload.total,
      externalId: payload.externalOrderId,
    },
  });

  return {
    success: true,
    orderId: newOrder.id,
    orderNumber: newOrder.order_number,
  };
}

/**
 * Simula un pedido de prueba entrante para validar la integración
 */
export async function simulateDeliveryWebhook(
  businessId: string,
  provider: DeliveryProvider,
  actorId?: string
): Promise<{ success: boolean; orderId?: string; orderNumber?: number; error?: string }> {
  const simulatedId = "SIM-" + Math.floor(100000 + Math.random() * 900000);

  const payload: SimulatedOrderPayload = {
    provider,
    externalOrderId: simulatedId,
    customerName: provider === "rappi" ? "Usuario Rappi (Simulado #284)" : "Laura Morales (Justo Web)",
    customerPhone: provider === "rappi" ? "+573000000000" : "+573114567890",
    deliveryAddress: "Carrera 7 # 71-21, Torre A, Apto 502",
    deliveryNotes: "Dejar en portería. Pedido de prueba generado desde NEGOVA [DOM-005].",
    items: [
      {
        name: "Combo Burger Artesanal Especial",
        quantity: 2,
        unitPrice: 18000,
        subtotal: 36000,
      },
      {
        name: "Papas Rústicas con Queso Cheddar",
        quantity: 1,
        unitPrice: 8000,
        subtotal: 8000,
      },
    ],
    subtotal: 44000,
    deliveryFee: 6000,
    total: 50000,
  };

  return ingestExternalDeliveryOrder(businessId, payload, actorId);
}
