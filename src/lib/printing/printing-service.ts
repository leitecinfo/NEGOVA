/**
 * SERVICIO DE CONFIGURACIÓN DE IMPRESIÓN Y ESTACIONES DE TRABAJO [CONF-002]
 * 
 * Reglas de Arquitectura:
 * - Aislamiento multi-tenant estricto por `business_id`.
 * - Persistencia de configuración en `businesses.settings.printing`.
 * - Integración con `cash_registers` para vinculación de cajas.
 * - Soporte para plantillas de ticket comercial y comandas de cocina sin precios.
 */

// Dynamic import of createClient inside server methods to avoid pulling next/headers into client bundles
import {
  PrintingSettings,
  PrinterConfig,
  PrintingStation,
  TicketTemplateConfig,
  KitchenCommandTemplateConfig,
  CashDrawerConfig,
  AvailableCashRegister,
} from "./types";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";

export const DEFAULT_TICKET_TEMPLATE: TicketTemplateConfig = {
  showLogo: true,
  businessName: "Mi Negocio",
  taxId: "900.123.456-7",
  address: "Calle 10 # 40-20, Zona Centro",
  phone: "+57 300 123 4567",
  headerText: "Régimen Simple de Tributación — No responsable de IVA",
  footerText: "Comprobante de venta para control interno y soporte comercial.",
  thankYouNote: "¡Gracias por su compra! Esperamos atenderle nuevamente.",
  paperWidth: "80mm",
  showCustomerInfo: true,
  showWaiterInfo: true,
  showPaymentDetails: true,
  customLogoUrl: null,
};

export const DEFAULT_KITCHEN_COMMAND_TEMPLATE: KitchenCommandTemplateConfig = {
  format: "compact",
  showPrices: false, // CRITERIO CONF-002: La comanda de cocina no muestra precios
  highlightModifiers: true, // CRITERIO CONF-002: Modificadores resaltados
  groupItemsByCategory: true,
  fontSize: "md",
  showDinersCount: true,
  showWaiterName: true,
  showTableNumber: true,
  paperWidth: "80mm",
  headerTitle: "*** COMANDA DE COCINA ***",
};

export const DEFAULT_CASH_DRAWER: CashDrawerConfig = {
  autoOpenOnCashSale: true,
  openOnSaleEnd: true,
  drawerKickCode: "ESC p 0 25 250",
  targetPrinterId: null,
};

export const DEFAULT_PRINTING_SETTINGS: PrintingSettings = {
  printers: [],
  stations: [],
  ticketTemplate: DEFAULT_TICKET_TEMPLATE,
  kitchenCommandTemplate: DEFAULT_KITCHEN_COMMAND_TEMPLATE,
  cashDrawer: DEFAULT_CASH_DRAWER,
  printDriver: "browser",
};

/**
 * Consulta la configuración de impresión de un negocio, enriqueciéndola
 * con datos reales de la empresa (logo, nombre, nit, dirección).
 */
export async function getPrintingSettings(businessId: string): Promise<{
  settings: PrintingSettings;
  cashRegisters: AvailableCashRegister[];
  businessMaster: {
    name: string;
    tradeName?: string;
    legalName?: string;
    taxId?: string;
    address?: string;
    city?: string;
    phone?: string;
    logoUrl?: string | null;
  };
}> {
  if (!businessId) {
    throw new Error("businessId es requerido para consultar la configuración de impresión.");
  }

  let adminClient: any;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    adminClient = await createClient();
  }

  // 1. Consultar registro del negocio maestro
  const { data: bizRow } = await adminClient
    .from("businesses")
    .select("id, name, logo_url, phone, address, city, settings")
    .eq("id", businessId)
    .maybeSingle();

  // 2. Consultar documento configurado para el negocio (NIT, razón social, etc.)
  let docConfig: any = null;
  try {
    docConfig = await getBusinessDocumentConfig(businessId);
  } catch {
    docConfig = null;
  }

  // 3. Consultar cajas registradoras del comercio
  const { data: registersData } = await adminClient
    .from("cash_registers")
    .select("id, name, is_active, location_id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  const cashRegisters: AvailableCashRegister[] = (registersData || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    isActive: r.is_active ?? true,
    locationId: r.location_id,
  }));

  const registerMap = new Map<string, string>();
  for (const reg of cashRegisters) {
    registerMap.set(reg.id, reg.name);
  }

  // 4. Datos maestros del negocio
  const businessMaster = {
    name: bizRow?.name || "Comercio NEGOVA",
    tradeName: docConfig?.tradeName || bizRow?.name || "Comercio NEGOVA",
    legalName: docConfig?.legalName || undefined,
    taxId: docConfig?.taxId || "900.000.000-1",
    address: docConfig?.address || bizRow?.address || "Dirección del establecimiento",
    city: docConfig?.city || bizRow?.city || "Colombia",
    phone: docConfig?.phone || bizRow?.phone || "+57 300 000 0000",
    logoUrl: docConfig?.logoUrl ?? bizRow?.logo_url ?? null,
  };

  // 5. Cargar configuración guardada en businesses.settings.printing
  const rawSettings = (bizRow?.settings as any)?.printing || {};

  // Ensamblar ticketTemplate predeterminado con datos reales del comercio
  const initialTicketTemplate: TicketTemplateConfig = {
    ...DEFAULT_TICKET_TEMPLATE,
    businessName: businessMaster.tradeName || businessMaster.name,
    tradeName: businessMaster.tradeName,
    legalName: businessMaster.legalName,
    taxId: businessMaster.taxId,
    address: businessMaster.address,
    phone: businessMaster.phone,
    customLogoUrl: businessMaster.logoUrl,
    headerText: docConfig?.headerText || DEFAULT_TICKET_TEMPLATE.headerText,
    footerText: docConfig?.footerText || DEFAULT_TICKET_TEMPLATE.footerText,
    thankYouNote: docConfig?.thankYouNote || DEFAULT_TICKET_TEMPLATE.thankYouNote,
    paperWidth: (docConfig?.paperWidth === "58mm" ? "58mm" : "80mm") as "80mm" | "58mm",
    ...(rawSettings.ticketTemplate || {}),
  };

  const initialKitchenTemplate: KitchenCommandTemplateConfig = {
    ...DEFAULT_KITCHEN_COMMAND_TEMPLATE,
    ...(rawSettings.kitchenCommandTemplate || {}),
    // Garantizar que la comanda mantenga los valores seguros
    showPrices: rawSettings.kitchenCommandTemplate?.showPrices ?? false,
    highlightModifiers: rawSettings.kitchenCommandTemplate?.highlightModifiers ?? true,
  };

  const initialCashDrawer: CashDrawerConfig = {
    ...DEFAULT_CASH_DRAWER,
    ...(rawSettings.cashDrawer || {}),
  };

  // Enriquecer estaciones con nombres de cajas actualizados
  const stations: PrintingStation[] = (rawSettings.stations || []).map((s: any) => ({
    ...s,
    cashRegisterName: s.cashRegisterId ? registerMap.get(s.cashRegisterId) || null : null,
  }));

  const settings: PrintingSettings = {
    printers: rawSettings.printers || [],
    stations: stations,
    ticketTemplate: initialTicketTemplate,
    kitchenCommandTemplate: initialKitchenTemplate,
    cashDrawer: initialCashDrawer,
    printDriver: rawSettings.printDriver === "qz_tray" ? "qz_tray" : "browser",
    updatedAt: rawSettings.updatedAt || undefined,
  };

  return {
    settings,
    cashRegisters,
    businessMaster,
  };
}

/**
 * Guarda la configuración de impresión y estaciones en `businesses.settings.printing`.
 */
export async function savePrintingSettings(
  businessId: string,
  updatedSettings: Partial<PrintingSettings>
): Promise<{ success: boolean; settings?: PrintingSettings; error?: string }> {
  if (!businessId) {
    return { success: false, error: "businessId es requerido para guardar la configuración." };
  }

  let adminClient: any;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    adminClient = await createClient();
  }

  // 1. Obtener settings actuales
  const { data: curBiz, error: fetchErr } = await adminClient
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();

  if (fetchErr) {
    return { success: false, error: `Error al consultar negocio: ${fetchErr.message}` };
  }

  const currentSettings = (curBiz?.settings as Record<string, unknown>) || {};
  const existingPrinting = (typeof currentSettings.printing === "object" && currentSettings.printing !== null)
    ? (currentSettings.printing as Record<string, unknown>)
    : {};

  const mergedPrinting: PrintingSettings = {
    printers: updatedSettings.printers ?? (existingPrinting.printers as any) ?? [],
    stations: updatedSettings.stations ?? (existingPrinting.stations as any) ?? [],
    ticketTemplate: {
      ...DEFAULT_TICKET_TEMPLATE,
      ...((existingPrinting.ticketTemplate as any) || {}),
      ...(updatedSettings.ticketTemplate || {}),
    },
    kitchenCommandTemplate: {
      ...DEFAULT_KITCHEN_COMMAND_TEMPLATE,
      ...((existingPrinting.kitchenCommandTemplate as any) || {}),
      ...(updatedSettings.kitchenCommandTemplate || {}),
    },
    cashDrawer: {
      ...DEFAULT_CASH_DRAWER,
      ...((existingPrinting.cashDrawer as any) || {}),
      ...(updatedSettings.cashDrawer || {}),
    },
    printDriver: updatedSettings.printDriver ?? (existingPrinting.printDriver as any) ?? "browser",
    updatedAt: new Date().toISOString(),
  };

  const newSettings = {
    ...currentSettings,
    printing: mergedPrinting,
  };

  const { error: updateErr } = await adminClient
    .from("businesses")
    .update({ settings: newSettings, updated_at: new Date().toISOString() })
    .eq("id", businessId);

  if (updateErr) {
    return { success: false, error: `No fue posible guardar la configuración de impresión: ${updateErr.message}` };
  }

  return { success: true, settings: mergedPrinting };
}

export * from "./mock-templates";

