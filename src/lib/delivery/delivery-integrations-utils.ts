import {
  DeliveryProvider,
  DeliveryProviderConfig,
  FinancialComparisonItem,
  IntegrationStepItem,
} from "./integration-types";

/**
 * Retorna la URL base de la aplicación para webhooks
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  return "https://app.negova.com";
}

/**
 * Genera la URL de Webhook pública para un proveedor y negocio específico
 */
export function generateWebhookUrl(businessId: string, provider: DeliveryProvider): string {
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/api/integrations/delivery/webhook/${provider}?businessId=${encodeURIComponent(businessId)}`;
}

/**
 * Configuración por defecto para un proveedor de delivery
 */
export function getDefaultProviderConfig(businessId: string, provider: DeliveryProvider): DeliveryProviderConfig {
  return {
    provider,
    enabled: false,
    status: "not_configured",
    commissionPercent: provider === "rappi" ? 20 : 10,
    autoAcceptOrders: true,
    credentials: {
      environment: "sandbox",
    },
    webhookUrl: generateWebhookUrl(businessId, provider),
    lastSyncAt: null,
    updatedAt: null,
  };
}

/**
 * Calcula el análisis financiero comparativo de canales de entrega
 * Permite simular el impacto en rentabilidad según ticket promedio y costo de ingredientes (COGS)
 */
export function calculateFinancialComparison(
  sampleTicket = 50000,
  cogsRate = 0.35
): FinancialComparisonItem[] {
  const ticket = Math.max(1000, sampleTicket);
  const cogsPct = Math.min(Math.max(cogsRate, 0.1), 0.8);
  const cogsAmount = Math.round(ticket * cogsPct);

  // 1. NEGOVA Domicilio Directo (0% comisión)
  const negovaNet = ticket - cogsAmount;
  const negovaMargin = (negovaNet / ticket) * 100;

  // 2. Justo (10% comisión + IVA 19% sobre la comisión)
  const justoCommissionRate = 0.1;
  const justoCommissionAmount = Math.round(ticket * justoCommissionRate);
  const justoCommissionVat = Math.round(justoCommissionAmount * 0.19);
  const justoNet = ticket - cogsAmount - (justoCommissionAmount + justoCommissionVat);
  const justoMargin = (justoNet / ticket) * 100;

  // 3. Rappi (20% comisión + IVA 19% sobre la comisión)
  const rappiCommissionRate = 0.2;
  const rappiCommissionAmount = Math.round(ticket * rappiCommissionRate);
  const rappiCommissionVat = Math.round(rappiCommissionAmount * 0.19);
  const rappiNet = ticket - cogsAmount - (rappiCommissionAmount + rappiCommissionVat);
  const rappiMargin = (rappiNet / ticket) * 100;

  return [
    {
      channel: "negova_direct",
      label: "NEGOVA Domicilio Propio",
      badge: "Recomendado (Máxima Rentabilidad)",
      commissionRate: 0,
      sampleTicket: ticket,
      cogsRate: cogsPct,
      cogsAmount,
      commissionAmount: 0,
      commissionVat: 0,
      netProfit: negovaNet,
      netMarginPercent: Number(negovaMargin.toFixed(1)),
      customerDataOwnership: "100% Negocio (Teléfono, historial y CRM)",
      settlementDays: "Inmediato (Directo a tu cuenta / efectivo)",
      posIntegrationLevel: "Nativo en tiempo real (0 desfase)",
    },
    {
      channel: "justo",
      label: "Justo (DTC White-label)",
      badge: "E-commerce Propio",
      commissionRate: justoCommissionRate,
      sampleTicket: ticket,
      cogsRate: cogsPct,
      cogsAmount,
      commissionAmount: justoCommissionAmount,
      commissionVat: justoCommissionVat,
      netProfit: justoNet,
      netMarginPercent: Number(justoMargin.toFixed(1)),
      customerDataOwnership: "100% Negocio (Base de datos exportable)",
      settlementDays: "Semanal (7 - 10 días)",
      posIntegrationLevel: "Webhook directo a comandas",
    },
    {
      channel: "rappi",
      label: "Rappi Marketplace",
      badge: "Agregador de Tráfico",
      commissionRate: rappiCommissionRate,
      sampleTicket: ticket,
      cogsRate: cogsPct,
      cogsAmount,
      commissionAmount: rappiCommissionAmount,
      commissionVat: rappiCommissionVat,
      netProfit: rappiNet,
      netMarginPercent: Number(rappiMargin.toFixed(1)),
      customerDataOwnership: "0% Plataforma (Datos de cliente anonimizados)",
      settlementDays: "Quincenal / Mensual (15 - 30 días)",
      posIntegrationLevel: "API Partner / Webhook",
    },
  ];
}

/**
 * Devuelve los pasos estructurados de la guía paso a paso para el proveedor
 */
export function getIntegrationGuideSteps(provider: DeliveryProvider): IntegrationStepItem[] {
  if (provider === "rappi") {
    return [
      {
        id: "step-1",
        title: "Paso 1: Registro en Rappi Partners Developer",
        description:
          "Crea o accede a tu cuenta de restaurante en el portal Rappi Partners (partners.rappi.com) y solicita acceso a la API de Restaurantes e Integraciones POS.",
        requirement: "Cuenta activa de comercio y credenciales de acceso a Rappi Partners.",
        docLink: "https://developers.rappi.com",
      },
      {
        id: "step-2",
        title: "Paso 2: Generar credenciales OAuth 2.0 (Client ID y Client Secret)",
        description:
          "Dentro de la sección de Integraciones Técnicas de Rappi, genera una nueva aplicación y copia tu Client ID (App ID), Client Secret y Store ID asignado.",
        requirement: "App ID y Client Secret válidos provistos por el equipo técnico de Rappi.",
      },
      {
        id: "step-3",
        title: "Paso 3: Configurar URL de Webhook en Rappi",
        description:
          "Copia la URL única de Webhook provista abajo para este negocio y pégala en los ajustes de Webhooks de Rappi para los eventos 'orders.created' y 'orders.status_changed'.",
        requirement: "URL de Webhook con validación HTTPS configurada en Rappi.",
      },
      {
        id: "step-4",
        title: "Paso 4: Guardar credenciales y probar conexión",
        description:
          "Pega tus credenciales en el formulario de abajo, activa el toggle y haz clic en 'Simular Pedido de Prueba' para confirmar que el flujo entra a comandas.",
        requirement: "Formulario guardado exitosamente en NEGOVA.",
      },
      {
        id: "step-5",
        title: "Paso 5: Pase a Producción y Cocina Unificada",
        description:
          "Una vez validado el pedido de prueba, cambia el entorno a Producción. Todos los pedidos de Rappi se consolidarán automáticamente con los pedidos en mesa y delivery propio.",
        requirement: "Entorno cambiado a Producción en la configuración.",
      },
    ];
  }

  return [
    {
      id: "step-1",
      title: "Paso 1: Acceso a Consola de Justo",
      description:
        "Ingresa a tu consola de administración de Justo (admin.getjusto.com) con credenciales de administrador de la marca.",
      requirement: "Permisos de Administrador en el panel de Justo.",
      docLink: "https://developers.getjusto.com",
    },
    {
      id: "step-2",
      title: "Paso 2: Crear API Key de Integración POS",
      description:
        "Ve a Configuración > Desarrolladores / API Keys y genera un token con permisos de lectura y recepción de órdenes para tu sucursal.",
      requirement: "API Key y Store ID de tu sucursal en Justo.",
    },
    {
      id: "step-3",
      title: "Paso 3: Suscribir Webhook de Justo",
      description:
        "Registra la URL de Webhook generada por NEGOVA en la consola de Justo para el webhook 'order_created'. Opcionalmente define un Webhook Secret si requieres verificación de firma HMAC.",
      requirement: "URL de Webhook guardada en Justo.",
    },
    {
      id: "step-4",
      title: "Paso 4: Guardar credenciales y Simular Pedido",
      description:
        "Ingresa tu API Key y Store ID en NEGOVA. Utiliza el botón de simulación para verificar que la comanda se cree y aparezca en la lista de despachos.",
      requirement: "Validación de recepción de webhook de prueba en NEGOVA.",
    },
    {
      id: "step-5",
      title: "Paso 5: Habilitar Operación en Vivo",
      description:
        "Activa la casilla 'Habilitar Sincronización Automática'. Tus clientes compran en tu tienda Justo y la orden se despacha desde el POS de NEGOVA.",
      requirement: "Integración habilitada y activa.",
    },
  ];
}

