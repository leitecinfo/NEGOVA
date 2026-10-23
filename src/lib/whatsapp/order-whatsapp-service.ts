/**
 * SERVICIO CANÓNICO DE WHATSAPP PARA PEDIDOS DEL MENÚ DIGITAL (NEGOVA) - SERVIDOR
 * 
 * Funciones de consulta a base de datos y resolución de credenciales multi-tenant.
 * Este archivo se ejecuta exclusivamente en el Servidor (Server Actions y Server Components).
 */

import { createClient } from "@/lib/supabase/server";
import {
  normalizeWhatsAppNumber,
  formatOrderSummaryMessage,
  buildWhatsAppOrderLink,
  type NormalizedWhatsAppResult,
  type OrderItemSummary,
  type WhatsAppOrderSummaryData,
} from "./order-whatsapp-format";

export {
  normalizeWhatsAppNumber,
  formatOrderSummaryMessage,
  buildWhatsAppOrderLink,
  type NormalizedWhatsAppResult,
  type OrderItemSummary,
  type WhatsAppOrderSummaryData,
};

/**
 * Consulta la configuración de WhatsApp del negocio asegurando el aislamiento multi-tenant.
 * Prioridad de resolución:
 * 1. business_document_configs.whatsapp
 * 2. businesses.settings.whatsapp
 * 3. businesses.phone
 */
export async function getBusinessOrderWhatsAppConfig(businessId: string): Promise<{
  businessName: string;
  whatsappNumber: string | null;
  normalizedNumber: string | null;
  formattedDisplay: string | null;
  isConfigured: boolean;
}> {
  let adminClient: any;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    adminClient = createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } else {
    adminClient = await createClient();
  }

  // 1. Consultar datos del negocio
  const { data: business } = await adminClient
    .from("businesses")
    .select("name, phone, settings")
    .eq("id", businessId)
    .maybeSingle();

  const businessName = business?.name || "Comercio";

  // 2. Consultar configuración de documentos donde se almacena el WhatsApp de atención
  const { data: docConfig } = await adminClient
    .from("business_document_configs")
    .select("whatsapp, phone")
    .eq("business_id", businessId)
    .maybeSingle();

  const rawPhone =
    docConfig?.whatsapp ||
    (business?.settings as any)?.whatsapp ||
    docConfig?.phone ||
    business?.phone ||
    null;

  const norm = normalizeWhatsAppNumber(rawPhone);

  return {
    businessName,
    whatsappNumber: rawPhone,
    normalizedNumber: norm.normalized,
    formattedDisplay: norm.formattedDisplay,
    isConfigured: norm.isValid,
  };
}
