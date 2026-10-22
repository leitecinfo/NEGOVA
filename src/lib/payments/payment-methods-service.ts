import { createClient } from "@supabase/supabase-js";
import {
  PaymentMethodCode,
  BusinessPaymentMethodConfig,
  PublicPaymentMethodDTO,
} from "./types";
import {
  PAYMENT_METHOD_CODES,
  PAYMENT_METHODS_CATALOG,
  getDefaultMethodConfig,
  isPaymentMethodComplete,
  toPublicPaymentMethodDTO,
} from "./payment-methods-catalog";
import {
  NEGOVA_STORAGE_BUCKET,
  STORAGE_PATHS,
  ensureNegovaBucket,
} from "../storage/supabase-storage";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Credenciales de Supabase no configuradas en las variables de entorno.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Obtiene la configuración completa de todos los métodos de pago para un comercio.
 * Retorna todos los métodos del catálogo inicial con su estado actual (configurado o pendiente).
 */
export async function getBusinessPaymentMethods(
  businessId: string
): Promise<Record<PaymentMethodCode, BusinessPaymentMethodConfig>> {
  if (!businessId) {
    throw new Error("Identificador de comercio requerido.");
  }

  const supabase = getAdminClient();

  // 1. Consultar tabla business_payment_methods y settings del negocio
  const [dbMethodsRes, bizRes] = await Promise.all([
    supabase
      .from("business_payment_methods")
      .select("*")
      .eq("business_id", businessId),
    supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle(),
  ]);

  const rawDbMethods = dbMethodsRes.data || [];
  const settingsMethods = (bizRes.data?.settings as any)?.payment_methods as
    | Record<string, Partial<BusinessPaymentMethodConfig>>
    | undefined;

  // Construir mapa inicial con defaults del catálogo
  const result: Record<PaymentMethodCode, BusinessPaymentMethodConfig> = {} as any;

  for (const code of PAYMENT_METHOD_CODES) {
    result[code] = getDefaultMethodConfig(code);
  }

  // 2. Hidratar desde la tabla relacional (o fallback de settings)
  // Mapear filas por código
  const dbMap = new Map<string, any>();
  for (const row of rawDbMethods) {
    const configObj = row.configuration || {};
    const code = configObj.code || (PAYMENT_METHOD_CODES.includes(row.method) ? row.method : null);
    if (code) {
      dbMap.set(code, { row, configObj });
    }
  }

  for (const code of PAYMENT_METHOD_CODES) {
    if (code === "cash") {
      result.cash.isEnabled = true;
      result.cash.isConfigured = true;
      continue;
    }

    const fromDb = dbMap.get(code);
    const fromSettings = settingsMethods?.[code];

    if (fromDb) {
      const { row, configObj } = fromDb;
      const complete = isPaymentMethodComplete(code, {
        destinationValue: configObj.destination_value || configObj.destinationValue,
        destinationType: configObj.destination_type || configObj.destinationType,
        breBKeyType: configObj.bre_b_key_type || configObj.breBKeyType,
      });

      result[code] = {
        code,
        name: row.name || PAYMENT_METHODS_CATALOG[code].name,
        isEnabled: row.enabled && complete,
        isConfigured: complete,
        accountHolder: configObj.account_holder || configObj.accountHolder || null,
        destinationType: configObj.destination_type || configObj.destinationType || PAYMENT_METHODS_CATALOG[code].defaultDestinationType,
        destinationValue: configObj.destination_value || configObj.destinationValue || null,
        instructions: configObj.instructions || null,
        breBKeyType: configObj.bre_b_key_type || configObj.breBKeyType || (code === "bre_b" ? "phone" : null),
        qrUrl: configObj.qr_url || configObj.qrUrl || null,
        qrStoragePath: configObj.qr_storage_path || configObj.qrStoragePath || null,
        updatedAt: row.updated_at,
      };
    } else if (fromSettings) {
      const complete = isPaymentMethodComplete(code, fromSettings);
      result[code] = {
        ...getDefaultMethodConfig(code),
        ...fromSettings,
        code,
        isEnabled: Boolean(fromSettings.isEnabled && complete),
        isConfigured: complete,
      };
    }
  }

  return result;
}

/**
 * Guarda o actualiza los datos de cobro de una entidad específica para un negocio.
 * Garantiza validación de campos obligatorios antes de permitir la activación.
 */
export async function saveBusinessPaymentMethod(
  businessId: string,
  methodCode: PaymentMethodCode,
  input: {
    isEnabled?: boolean;
    accountHolder?: string | null;
    destinationType?: any;
    destinationValue?: string | null;
    instructions?: string | null;
    breBKeyType?: any;
    qrUrl?: string | null;
    qrStoragePath?: string | null;
  }
): Promise<{ success: boolean; error?: string; config?: BusinessPaymentMethodConfig }> {
  if (!businessId) {
    return { success: false, error: "Identificador de negocio ausente." };
  }

  if (!PAYMENT_METHOD_CODES.includes(methodCode)) {
    return { success: false, error: `Código de método no permitido: ${methodCode}` };
  }

  if (methodCode === "cash") {
    return {
      success: true,
      config: getDefaultMethodConfig("cash"),
    };
  }

  const supabase = getAdminClient();
  const meta = PAYMENT_METHODS_CATALOG[methodCode];

  // 1. Obtener estado previo
  const currentMethods = await getBusinessPaymentMethods(businessId);
  const existing = currentMethods[methodCode] || getDefaultMethodConfig(methodCode);

  const updatedConfig: BusinessPaymentMethodConfig = {
    ...existing,
    name: meta.name,
    accountHolder: input.accountHolder !== undefined ? (input.accountHolder?.trim() || null) : existing.accountHolder,
    destinationType: input.destinationType !== undefined ? input.destinationType : existing.destinationType,
    destinationValue: input.destinationValue !== undefined ? (input.destinationValue?.trim() || null) : existing.destinationValue,
    instructions: input.instructions !== undefined ? (input.instructions?.trim() || null) : existing.instructions,
    breBKeyType: methodCode === "bre_b" ? (input.breBKeyType !== undefined ? input.breBKeyType : existing.breBKeyType) : null,
    qrUrl: input.qrUrl !== undefined ? input.qrUrl : existing.qrUrl,
    qrStoragePath: input.qrStoragePath !== undefined ? input.qrStoragePath : existing.qrStoragePath,
    updatedAt: new Date().toISOString(),
  };

  // 2. Validar si está completo
  const isComplete = isPaymentMethodComplete(methodCode, updatedConfig);
  updatedConfig.isConfigured = isComplete;

  // Si se intenta activar pero faltan datos obligatorios, rechazar o mantener desactivado
  if (input.isEnabled !== undefined) {
    if (input.isEnabled && !isComplete) {
      return {
        success: false,
        error: `No es posible activar ${meta.name} sin completar antes sus datos de cobro obligatorios.`,
      };
    }
    updatedConfig.isEnabled = isComplete ? input.isEnabled : false;
  } else {
    // Si no se pasó isEnabled explícito, mantener el existente solo si sigue estando completo
    updatedConfig.isEnabled = existing.isEnabled && isComplete;
  }

  // 3. Persistir en la tabla business_payment_methods
  // Buscar si ya existe la fila para este negocio y código
  const { data: existingRows } = await supabase
    .from("business_payment_methods")
    .select("id, configuration")
    .eq("business_id", businessId);

  const matchedRow = existingRows?.find(
    (r) => (r.configuration as any)?.code === methodCode
  );

  const configurationPayload = {
    code: methodCode,
    name: meta.name,
    account_holder: updatedConfig.accountHolder,
    destination_type: updatedConfig.destinationType,
    destination_value: updatedConfig.destinationValue,
    instructions: updatedConfig.instructions,
    bre_b_key_type: updatedConfig.breBKeyType,
    qr_url: updatedConfig.qrUrl,
    qr_storage_path: updatedConfig.qrStoragePath,
    is_configured: updatedConfig.isConfigured,
  };

  if (matchedRow) {
    const { error: updateErr } = await supabase
      .from("business_payment_methods")
      .update({
        name: meta.name,
        enabled: updatedConfig.isEnabled,
        configuration: configurationPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchedRow.id)
      .eq("business_id", businessId);

    if (updateErr) {
      console.error("[saveBusinessPaymentMethod] Error actualizando BD:", updateErr);
      return { success: false, error: updateErr.message || "Error al actualizar método de pago." };
    }
  } else {
    const { error: insertErr } = await supabase
      .from("business_payment_methods")
      .insert({
        business_id: businessId,
        name: meta.name,
        method: "transfer",
        enabled: updatedConfig.isEnabled,
        configuration: configurationPayload,
      });

    if (insertErr) {
      console.error("[saveBusinessPaymentMethod] Error insertando BD:", insertErr);
      return { success: false, error: insertErr.message || "Error al registrar método de pago." };
    }
  }

  // 4. Sincronizar en businesses.settings.payment_methods para lecturas ultrarrápidas
  try {
    const allMethods = {
      ...currentMethods,
      [methodCode]: updatedConfig,
    };
    const { data: currentBiz } = await supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    const bizSettings = (currentBiz?.settings as any) || {};
    await supabase
      .from("businesses")
      .update({
        settings: {
          ...bizSettings,
          payment_methods: allMethods,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);
  } catch (syncErr) {
    console.warn("[saveBusinessPaymentMethod] Advertencia al sincronizar settings:", syncErr);
  }

  return { success: true, config: updatedConfig };
}

/**
 * Sube una imagen de QR para una entidad de cobro (por ejemplo, Bre-B)
 * y actualiza el registro con la URL pública correspondiente.
 */
export async function uploadPaymentMethodQr(
  businessId: string,
  methodCode: PaymentMethodCode,
  file: File | Blob
): Promise<{ success: boolean; url?: string; storagePath?: string; error?: string }> {
  if (!businessId || !methodCode) {
    return { success: false, error: "Parámetros incompletos." };
  }

  const supabase = getAdminClient();
  await ensureNegovaBucket(supabase);

  // Validar tamaño (máximo 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "La imagen de QR no debe superar los 5MB." };
  }

  // Limpiar archivo anterior si existía para evitar huérfanos
  const currentMethods = await getBusinessPaymentMethods(businessId);
  const existing = currentMethods[methodCode];
  if (existing?.qrStoragePath) {
    try {
      await supabase.storage.from(NEGOVA_STORAGE_BUCKET).remove([existing.qrStoragePath]);
    } catch {
      // Ignorar fallo al remover
    }
  }

  const fileExt = (file as any).name?.split(".").pop() || "png";
  const filename = `${methodCode}_qr_${Date.now()}.${fileExt}`;
  const storagePath = STORAGE_PATHS.businessPaymentQrFile(businessId, filename);

  const { error: uploadError } = await supabase.storage
    .from(NEGOVA_STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "image/png",
      upsert: true,
    });

  if (uploadError) {
    console.error("[uploadPaymentMethodQr] Error en Storage:", uploadError);
    return { success: false, error: "No se pudo subir la imagen del QR." };
  }

  const { data: publicUrlData } = supabase.storage
    .from(NEGOVA_STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = publicUrlData?.publicUrl || "";

  // Guardar en la configuración del método
  await saveBusinessPaymentMethod(businessId, methodCode, {
    qrUrl: publicUrl,
    qrStoragePath: storagePath,
  });

  return {
    success: true,
    url: publicUrl,
    storagePath,
  };
}

/**
 * Elimina la imagen de QR de una entidad y actualiza su configuración.
 */
export async function deletePaymentMethodQr(
  businessId: string,
  methodCode: PaymentMethodCode
): Promise<{ success: boolean; error?: string }> {
  if (!businessId || !methodCode) {
    return { success: false, error: "Parámetros incompletos." };
  }

  const supabase = getAdminClient();
  const currentMethods = await getBusinessPaymentMethods(businessId);
  const existing = currentMethods[methodCode];

  if (existing?.qrStoragePath) {
    try {
      await supabase.storage.from(NEGOVA_STORAGE_BUCKET).remove([existing.qrStoragePath]);
    } catch (removeErr) {
      console.warn("[deletePaymentMethodQr] Advertencia al remover archivo:", removeErr);
    }
  }

  await saveBusinessPaymentMethod(businessId, methodCode, {
    qrUrl: null,
    qrStoragePath: null,
  });

  return { success: true };
}

/**
 * Obtiene los métodos de pago públicos activos y configurados para el Menú Digital o POS.
 * Efectivo siempre está incluido.
 * Las entidades de transferencia solo se incluyen si están 'enabled' Y 'isConfigured'.
 */
export async function getPublicBusinessPaymentMethods(
  businessId: string
): Promise<PublicPaymentMethodDTO[]> {
  try {
    const methodsMap = await getBusinessPaymentMethods(businessId);

    const publicList: PublicPaymentMethodDTO[] = [];

    // 1. Efectivo siempre disponible
    publicList.push(toPublicPaymentMethodDTO(methodsMap.cash));

    // 2. Transferencias activas y completas
    for (const code of PAYMENT_METHOD_CODES) {
      if (code === "cash") continue;
      const m = methodsMap[code];
      if (m && m.isEnabled && m.isConfigured) {
        publicList.push(toPublicPaymentMethodDTO(m));
      }
    }

    return publicList;
  } catch (err) {
    console.error("[getPublicBusinessPaymentMethods] Error:", err);
    // Retornar al menos Efectivo ante cualquier eventualidad
    return [toPublicPaymentMethodDTO(getDefaultMethodConfig("cash"))];
  }
}
