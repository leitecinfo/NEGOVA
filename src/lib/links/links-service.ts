/**
 * NEGOVA — Servicio de Página de Enlaces (Bio Links / Linktree) [CONF-005]
 * 
 * Gestiona la configuración, persistencia en businesses.settings.links_page
 * y la entrega de enlaces públicos optimizados y filtrados.
 */

import { logAuditAction } from "@/lib/audit/audit-service";
import {
  BioLinkItem,
  BusinessLinksPageConfig,
  UpdateLinksPageInput,
} from "./types";

// Almacén en memoria para pruebas unitarias y resiliencia
export const memoryLinksConfigs = new Map<string, BusinessLinksPageConfig>();
export const memoryBusinesses = new Map<
  string,
  {
    id: string;
    name: string;
    slug: string;
    logo_url?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    description?: string | null;
    settings?: Record<string, any>;
  }
>();

function isTestEnvironment(): boolean {
  if (process.env.TEST_AGAINST_REAL_DB === "true") {
    return false;
  }
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

async function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

/**
 * Genera la lista de 5 enlaces predefinidos recomendados para cualquier comercio.
 */
export function getDefaultPredefinedLinks(biz: {
  id: string;
  name: string;
  slug?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
}): BioLinkItem[] {
  const slugTarget = biz.slug?.trim() || biz.id;
  const cleanPhone = (biz.phone || "").replace(/\D/g, "");
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith("57") ? cleanPhone : `57${cleanPhone}`}?text=${encodeURIComponent(`Hola ${biz.name}, los contacto desde su página de enlaces.`)}`
    : "https://wa.me/";

  const mapsQuery = encodeURIComponent(
    `${biz.name} ${biz.address || ""} ${biz.city || ""}`.trim()
  );
  const mapsUrl = biz.address
    ? `https://maps.google.com/?q=${mapsQuery}`
    : "https://maps.google.com";

  return [
    {
      id: "predefined-menu",
      title: "Ver menú digital",
      url: `/menu/${slugTarget}`,
      icon: "utensils",
      order: 1,
      isActive: true,
      isPredefined: true,
      predefinedType: "menu",
    },
    {
      id: "predefined-delivery",
      title: "Pedir domicilio",
      url: `/menu/${slugTarget}?tab=delivery`,
      icon: "shopping-bag",
      order: 2,
      isActive: true,
      isPredefined: true,
      predefinedType: "delivery",
    },
    {
      id: "predefined-whatsapp",
      title: "Escríbenos por WhatsApp",
      url: whatsappUrl,
      icon: "message-circle",
      order: 3,
      isActive: true,
      isPredefined: true,
      predefinedType: "whatsapp",
    },
    {
      id: "predefined-instagram",
      title: "Síguenos en Instagram",
      url: "https://instagram.com/",
      icon: "instagram",
      order: 4,
      isActive: true,
      isPredefined: true,
      predefinedType: "instagram",
    },
    {
      id: "predefined-maps",
      title: "Ubicación en Google Maps",
      url: mapsUrl,
      icon: "map-pin",
      order: 5,
      isActive: true,
      isPredefined: true,
      predefinedType: "maps",
    },
  ];
}

/**
 * Consulta la configuración de la página de enlaces de un comercio.
 * Si no existe, inicializa con valores por defecto y los 5 enlaces predefinidos.
 */
export async function getBusinessLinksPageConfig(
  businessId: string
): Promise<BusinessLinksPageConfig> {
  // Si está en memoria (entorno de pruebas)
  if (memoryLinksConfigs.has(businessId)) {
    return memoryLinksConfigs.get(businessId)!;
  }

  let bizData: any = null;

  if (isTestEnvironment()) {
    bizData = memoryBusinesses.get(businessId) || null;
  } else {
    try {
      const supabase = await getSupabaseAdmin();
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, slug, logo_url, phone, address, city, settings")
        .eq("id", businessId)
        .maybeSingle();

      if (!error && data) {
        bizData = data;
      }
    } catch (err) {
      console.warn("[getBusinessLinksPageConfig] Error consultando negocio:", err);
    }
  }

  if (!bizData) {
    bizData = {
      id: businessId,
      name: "Mi Negocio",
      slug: businessId,
    };
  }

  const rawSettings = (bizData.settings as Record<string, any>) || {};
  const linksPageSettings = rawSettings.links_page as Partial<BusinessLinksPageConfig> | undefined;

  const defaultLinks = getDefaultPredefinedLinks({
    id: bizData.id,
    name: bizData.name,
    slug: bizData.slug,
    phone: bizData.phone,
    address: bizData.address,
    city: bizData.city,
  });

  const config: BusinessLinksPageConfig = {
    businessId: bizData.id,
    businessName: linksPageSettings?.businessName || bizData.name || "Mi Negocio",
    slug: linksPageSettings?.slug || bizData.slug || bizData.id,
    logoUrl: linksPageSettings?.logoUrl !== undefined ? linksPageSettings.logoUrl : bizData.logo_url || null,
    description: linksPageSettings?.description || "¡Bienvenidos a nuestro espacio digital! Explora nuestros enlaces oficiales:",
    theme: linksPageSettings?.theme || "slate",
    customPrimaryColor: linksPageSettings?.customPrimaryColor || null,
    links: linksPageSettings?.links && Array.isArray(linksPageSettings.links) && linksPageSettings.links.length > 0
      ? linksPageSettings.links
      : defaultLinks,
    showPoweredBy: linksPageSettings?.showPoweredBy !== false,
    socialLinks: linksPageSettings?.socialLinks || {
      whatsapp: bizData.phone ? `https://wa.me/${bizData.phone.replace(/\D/g, "")}` : "",
      instagram: "",
      facebook: "",
      website: "",
    },
    updatedAt: linksPageSettings?.updatedAt || new Date().toISOString(),
  };

  memoryLinksConfigs.set(businessId, config);
  return config;
}

/**
 * Guarda o actualiza la configuración de la página de enlaces del comercio.
 */
export async function saveBusinessLinksPageConfig(
  businessId: string,
  input: UpdateLinksPageInput,
  actorUserId?: string
): Promise<{ success: boolean; config?: BusinessLinksPageConfig; error?: string }> {
  if (!businessId) {
    return { success: false, error: "Identificador de negocio requerido." };
  }

  const currentConfig = await getBusinessLinksPageConfig(businessId);

  // Normalizar slug si viene en el input
  let finalSlug = currentConfig.slug;
  if (input.slug !== undefined) {
    const rawSlug = input.slug.trim().toLowerCase();
    const cleanSlug = rawSlug
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!cleanSlug) {
      return { success: false, error: "El slug del enlace no puede estar vacío." };
    }
    finalSlug = cleanSlug;
  }

  // Verificar unicidad de slug en otros negocios si cambió
  if (finalSlug !== currentConfig.slug) {
    if (!isTestEnvironment()) {
      try {
        const supabase = await getSupabaseAdmin();
        const { data: existingBiz } = await supabase
          .from("businesses")
          .select("id")
          .eq("slug", finalSlug)
          .neq("id", businessId)
          .maybeSingle();

        if (existingBiz) {
          return { success: false, error: `El slug "${finalSlug}" ya está en uso por otro comercio.` };
        }
      } catch (err) {
        console.warn("[saveBusinessLinksPageConfig] Aviso validando slug:", err);
      }
    } else {
      // Validar en memoria
      for (const [otherId, otherBiz] of memoryBusinesses.entries()) {
        if (otherId !== businessId && otherBiz.slug === finalSlug) {
          return { success: false, error: `El slug "${finalSlug}" ya está en uso por otro comercio.` };
        }
      }
    }
  }

  // Asegurar que los links tengan IDs y órdenes válidos
  const formattedLinks: BioLinkItem[] = (input.links !== undefined ? input.links : currentConfig.links).map(
    (l, idx) => ({
      ...l,
      id: l.id || `link-${idx + 1}-${Date.now()}`,
      order: typeof l.order === "number" ? l.order : idx + 1,
      isActive: l.isActive !== false,
      title: (l.title || "Enlace").trim(),
      url: (l.url || "#").trim(),
      icon: l.icon || "link",
    })
  );

  const updatedConfig: BusinessLinksPageConfig = {
    businessId,
    businessName: input.businessName?.trim() || currentConfig.businessName,
    slug: finalSlug,
    logoUrl: input.logoUrl !== undefined ? input.logoUrl : currentConfig.logoUrl,
    description: input.description !== undefined ? input.description?.trim() : currentConfig.description,
    theme: input.theme || currentConfig.theme,
    customPrimaryColor: input.customPrimaryColor !== undefined ? input.customPrimaryColor : currentConfig.customPrimaryColor,
    links: formattedLinks,
    showPoweredBy: input.showPoweredBy !== undefined ? input.showPoweredBy : currentConfig.showPoweredBy,
    socialLinks: input.socialLinks || currentConfig.socialLinks,
    updatedAt: new Date().toISOString(),
  };

  // Persistir en base de datos
  if (!isTestEnvironment()) {
    try {
      const supabase = await getSupabaseAdmin();

      // Consultar settings actuales
      const { data: curBiz } = await supabase
        .from("businesses")
        .select("settings")
        .eq("id", businessId)
        .maybeSingle();

      const existingSettings = (curBiz?.settings as Record<string, any>) || {};
      const newSettings = {
        ...existingSettings,
        links_page: updatedConfig,
      };

      const updatePayload: Record<string, any> = {
        settings: newSettings,
        updated_at: new Date().toISOString(),
      };

      // Si el slug cambió, actualizar también en la columna slug de businesses
      if (finalSlug !== currentConfig.slug) {
        updatePayload.slug = finalSlug;
      }

      await supabase.from("businesses").update(updatePayload).eq("id", businessId);
    } catch (err: any) {
      console.error("[saveBusinessLinksPageConfig] Error guardando en BD:", err);
      return { success: false, error: err?.message || "Error al persistir la configuración." };
    }
  } else {
    // Modo test: sincronizar memoria
    const biz = memoryBusinesses.get(businessId);
    if (biz) {
      biz.slug = finalSlug;
      biz.settings = { ...(biz.settings || {}), links_page: updatedConfig };
      memoryBusinesses.set(businessId, biz);
    }
  }

  memoryLinksConfigs.set(businessId, updatedConfig);

  if (actorUserId) {
    await logAuditAction({
      businessId,
      userId: actorUserId,
      action: "update",
      entityType: "business_links_page",
      entityId: businessId,
      newData: {
        linksCount: updatedConfig.links.length,
        slug: updatedConfig.slug,
        theme: updatedConfig.theme,
      },
    });
  }

  return { success: true, config: updatedConfig };
}

/**
 * Consulta la página pública de enlaces por su slug o ID de negocio.
 * Filtra automáticamente los enlaces inactivos y retorna los enlaces ordenados.
 */
export async function getPublicLinksPageBySlug(
  slugOrId: string
): Promise<BusinessLinksPageConfig | null> {
  const cleanSlugOrId = slugOrId.trim();
  if (!cleanSlugOrId) return null;

  let businessId: string | null = null;

  // 1. Verificar si existe en memoria
  if (isTestEnvironment()) {
    for (const [id, config] of memoryLinksConfigs.entries()) {
      if (config.slug === cleanSlugOrId || id === cleanSlugOrId) {
        businessId = id;
        break;
      }
    }

    if (!businessId) {
      for (const [id, biz] of memoryBusinesses.entries()) {
        if (biz.slug === cleanSlugOrId || id === cleanSlugOrId) {
          businessId = id;
          break;
        }
      }
    }
  } else {
    try {
      const supabase = await getSupabaseAdmin();
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        cleanSlugOrId
      );

      let query = supabase.from("businesses").select("id").eq("status", "active");

      if (isUuid) {
        query = query.eq("id", cleanSlugOrId);
      } else {
        query = query.eq("slug", cleanSlugOrId);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        businessId = data.id;
      }
    } catch (err) {
      console.warn("[getPublicLinksPageBySlug] Error:", err);
    }
  }

  if (!businessId) {
    return null;
  }

  const fullConfig = await getBusinessLinksPageConfig(businessId);

  // FILTRADO ESTRICTO: Solo enlaces activos, ordenados por orden ascendente
  const activeLinks = fullConfig.links
    .filter((l) => l.isActive === true)
    .sort((a, b) => a.order - b.order);

  return {
    ...fullConfig,
    links: activeLinks,
  };
}
