import { createClient } from "@/lib/supabase/server";
import {
  BusinessDigitalMenu,
  DigitalMenuPublicData,
  DEFAULT_DIGITAL_MENU_SETTINGS,
} from "./types";
import {
  uploadDigitalMenuFileStorage,
  deleteDigitalMenuFileStorage,
} from "@/lib/storage/supabase-storage";

async function getDbClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return await createClient();
}

/**
 * Obtiene o inicializa la configuración del menú digital para un comercio específico.
 */
export async function getOrCreateDigitalMenu(
  businessId: string
): Promise<BusinessDigitalMenu> {
  const supabase = await getDbClient();

  const { data: existingMenu, error: selectError } = await supabase
    .from("business_digital_menus")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (selectError) {
    console.error("[getOrCreateDigitalMenu] Error al consultar menú:", selectError);
    throw new Error("No se pudo consultar el menú digital del negocio.");
  }

  if (existingMenu) {
    return existingMenu as BusinessDigitalMenu;
  }

  // Si no existe, crear registro inicial con valores por defecto
  const initialPayload = {
    business_id: businessId,
    is_published: true,
    modality: "template" as const,
    template_id: "urbana" as const,
    custom_settings: DEFAULT_DIGITAL_MENU_SETTINGS,
    file_url: null,
    file_storage_path: null,
    file_type: null,
    file_name: null,
    file_size_bytes: null,
  };

  const { data: newMenu, error: insertError } = await supabase
    .from("business_digital_menus")
    .insert(initialPayload)
    .select()
    .single();

  if (insertError) {
    console.error("[getOrCreateDigitalMenu] Error al inicializar menú:", insertError);
    // En caso de conflicto concurrente, intentar leer de nuevo
    const { data: retryMenu } = await supabase
      .from("business_digital_menus")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();
    if (retryMenu) return retryMenu as BusinessDigitalMenu;
    throw new Error("No se pudo inicializar la configuración del menú digital.");
  }

  return newMenu as BusinessDigitalMenu;
}

/**
 * Guarda las preferencias de configuración del menú digital (modalidad, plantilla, personalización).
 */
export async function saveDigitalMenuConfig(
  businessId: string,
  payload: {
    modality?: "template" | "custom" | "file";
    template_id?: "urbana" | "elegante" | "comercial" | "visual";
    custom_settings?: Partial<typeof DEFAULT_DIGITAL_MENU_SETTINGS>;
    is_published?: boolean;
  }
): Promise<{ success: boolean; data?: BusinessDigitalMenu; error?: string }> {
  try {
    const supabase = await getDbClient();

    // Asegurar existencia
    const current = await getOrCreateDigitalMenu(businessId);

    const mergedSettings = payload.custom_settings
      ? { ...current.custom_settings, ...payload.custom_settings }
      : current.custom_settings;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (payload.modality !== undefined) updateData.modality = payload.modality;
    if (payload.template_id !== undefined) updateData.template_id = payload.template_id;
    if (payload.custom_settings !== undefined) updateData.custom_settings = mergedSettings;
    if (payload.is_published !== undefined) updateData.is_published = payload.is_published;

    const { data: updated, error } = await supabase
      .from("business_digital_menus")
      .update(updateData)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) {
      console.error("[saveDigitalMenuConfig] Error al actualizar:", error);
      return { success: false, error: "Error al guardar los cambios del menú." };
    }

    return { success: true, data: updated as BusinessDigitalMenu };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar menú digital." };
  }
}

/**
 * Sube un archivo propio (PDF o Imagen) para el menú digital.
 * Implementa la gestión eficiente y segura de almacenamiento:
 * 1. Valida tipo y tamaño (máx 10MB).
 * 2. Carga el nuevo archivo en negova-storage.
 * 3. Actualiza el registro en la base de datos.
 * 4. Si la actualización en BD es exitosa, elimina el archivo anterior en Storage.
 * 5. Si la BD falla, elimina el archivo recién subido para no dejar basura huérfana.
 */
export async function uploadDigitalMenuFileSafe(
  businessId: string,
  file: File
): Promise<{ success: boolean; data?: BusinessDigitalMenu; error?: string }> {
  const supabase = await getDbClient();

  try {
    const currentMenu = await getOrCreateDigitalMenu(businessId);
    const oldStoragePath = currentMenu.file_storage_path;

    // 1. Cargar nuevo archivo en Storage (sin eliminar aún el anterior)
    const uploadRes = await uploadDigitalMenuFileStorage(supabase, businessId, file, null);

    if (uploadRes.error || !uploadRes.url || !uploadRes.storagePath) {
      return {
        success: false,
        error: uploadRes.error || "No se pudo subir el archivo al almacenamiento.",
      };
    }

    // 2. Actualizar registro en base de datos
    const { data: updatedMenu, error: dbError } = await supabase
      .from("business_digital_menus")
      .update({
        file_url: uploadRes.url,
        file_storage_path: uploadRes.storagePath,
        file_type: uploadRes.fileType,
        file_name: uploadRes.fileName,
        file_size_bytes: uploadRes.fileSizeBytes,
        modality: "file",
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .select()
      .single();

    if (dbError) {
      console.error("[uploadDigitalMenuFileSafe] Error al actualizar BD, revirtiendo archivo nuevo:", dbError);
      // Revertir: eliminar el archivo recién subido
      await deleteDigitalMenuFileStorage(supabase, businessId, uploadRes.storagePath);
      return {
        success: false,
        error: "Error al asociar el archivo con el menú. Se conservó el estado anterior.",
      };
    }

    // 3. Confirmado el éxito en la BD, eliminar físicamente el archivo anterior de Storage
    if (oldStoragePath && oldStoragePath !== uploadRes.storagePath) {
      await deleteDigitalMenuFileStorage(supabase, businessId, oldStoragePath);
    }

    return {
      success: true,
      data: updatedMenu as BusinessDigitalMenu,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error inesperado al procesar el archivo del menú.",
    };
  }
}

/**
 * Elimina el archivo propio actual del menú digital de manera segura,
 * liberando el almacenamiento en Supabase Storage y limpiando la BD.
 */
export async function removeDigitalMenuFileSafe(
  businessId: string
): Promise<{ success: boolean; data?: BusinessDigitalMenu; error?: string }> {
  const supabase = await getDbClient();

  try {
    const currentMenu = await getOrCreateDigitalMenu(businessId);
    const oldStoragePath = currentMenu.file_storage_path;

    // 1. Eliminar físicamente de Storage
    if (oldStoragePath) {
      await deleteDigitalMenuFileStorage(supabase, businessId, oldStoragePath);
    }

    // 2. Actualizar BD: limpiar referencias y si estaba en 'file', regresar a 'template'
    const nextModality = currentMenu.modality === "file" ? "template" : currentMenu.modality;

    const { data: updatedMenu, error: dbError } = await supabase
      .from("business_digital_menus")
      .update({
        file_url: null,
        file_storage_path: null,
        file_type: null,
        file_name: null,
        file_size_bytes: null,
        modality: nextModality,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .select()
      .single();

    if (dbError) {
      console.error("[removeDigitalMenuFileSafe] Error en BD:", dbError);
      return { success: false, error: "No se pudo actualizar el menú tras retirar el archivo." };
    }

    return {
      success: true,
      data: updatedMenu as BusinessDigitalMenu,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al retirar el archivo del menú.",
    };
  }
}

/**
 * Alterna el estado de publicación del menú digital.
 */
export async function togglePublishDigitalMenu(
  businessId: string,
  isPublished: boolean
): Promise<{ success: boolean; data?: BusinessDigitalMenu; error?: string }> {
  return saveDigitalMenuConfig(businessId, { is_published: isPublished });
}

/**
 * Consulta de acceso público para comensales y clientes finales (/menu/[slugOrId]).
 * Recupera datos reales del negocio, configuración del menú, categorías activas y productos disponibles.
 */
export async function getPublicDigitalMenu(
  slugOrId: string
): Promise<DigitalMenuPublicData | null> {
  const supabase = await getDbClient();

  // 1. Resolver el negocio por slug o por UUID
  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    slugOrId
  );

  let bizQuery = supabase
    .from("businesses")
    .select("id, name, slug, logo_url, phone, email, address, city, currency, status, settings")
    .eq("status", "active");

  if (isUuid) {
    bizQuery = bizQuery.eq("id", slugOrId);
  } else {
    bizQuery = bizQuery.eq("slug", slugOrId);
  }

  const { data: business, error: bizError } = await bizQuery.maybeSingle();

  if (bizError || !business) {
    return null;
  }

  // 2. Obtener configuración del menú digital
  const { data: menu, error: menuError } = await supabase
    .from("business_digital_menus")
    .select("*")
    .eq("business_id", business.id)
    .maybeSingle();

  // Si no tiene registro aún, proveer el default
  const effectiveMenu: BusinessDigitalMenu = menu || {
    id: "default",
    business_id: business.id,
    is_published: true,
    modality: "template",
    template_id: "urbana",
    custom_settings: DEFAULT_DIGITAL_MENU_SETTINGS,
    file_url: null,
    file_storage_path: null,
    file_type: null,
    file_name: null,
    file_size_bytes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 3. Extraer datos de contacto extendidos (WhatsApp, etc. desde settings si existen)
  const settingsObj = (business.settings as any) || {};
  const whatsapp = settingsObj.whatsapp || business.phone;
  const instagram = settingsObj.instagram || null;
  const schedule = settingsObj.schedule || null;

  const publicBusiness = {
    id: business.id,
    name: business.name,
    slug: business.slug,
    logo_url: business.logo_url,
    phone: business.phone,
    email: business.email,
    address: business.address,
    city: business.city,
    currency: business.currency || "COP",
    whatsapp,
    instagram,
    schedule,
  };

  // Si la modalidad es archivo ('file'), no necesitamos cargar todo el catálogo de productos
  if (effectiveMenu.modality === "file" && effectiveMenu.file_url) {
    return {
      business: publicBusiness,
      menu: effectiveMenu,
      categories: [],
      products: [],
    };
  }

  // 4. Si la modalidad es plantilla o personalizada, cargar categorías y productos reales
  const [categoriesRes, productsRes] = await Promise.all([
    supabase
      .from("categories")
      .select("id, business_id, name, description, sort_order, status, created_at, updated_at")
      .eq("business_id", business.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),

    supabase
      .from("products")
      .select("id, business_id, category_id, name, description, image_url, price, status, is_available, sort_order, metadata, created_at, updated_at")
      .eq("business_id", business.id)
      .eq("status", "active")
      .eq("is_available", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  return {
    business: publicBusiness,
    menu: effectiveMenu,
    categories: (categoriesRes.data || []) as any,
    products: (productsRes.data || []) as any,
  };
}
