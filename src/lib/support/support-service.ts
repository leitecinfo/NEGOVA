/**
 * NEGOVA Support & Assistance Service (Mesa de Ayuda y Bitácora de Atenciones)
 * 
 * DEUDA TÉCNICA DOCUMENTADA:
 * Actualmente los registros de atención (ATN) y tickets de soporte (TCK) se persisten
 * en formato JSON dentro de `platform_settings` (clave: "platform:support_store").
 * En una etapa futura se migrará a tablas SQL dedicadas `public.support_interactions`,
 * `public.support_tickets` y `public.support_messages`.
 * 
 * Toda lectura, mutación y validación de soporte está centralizada exclusivamente en este servicio.
 */

import {
  SupportInteraction,
  SupportTicket,
  SupportFilterParams,
  SupportDashboardResult,
  SupportDashboardStats,
  SupportChannel,
  SupportCategory,
  InteractionOutcome,
  TicketStatus,
  TicketPriority,
} from "./types";
import { createNotification } from "@/lib/notifications/notifications-service";

const STORE_KEY = "platform:support_store";
const LEGACY_TICKETS_KEY = "platform:support_tickets";

interface SupportStoreData {
  interactions: SupportInteraction[];
  tickets: SupportTicket[];
}

async function getSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

let cachedStore: SupportStoreData = {
  interactions: [],
  tickets: [],
};

/**
 * Carga todo el almacén de soporte con compatibilidad hacia atrás
 */
async function getFullStore(): Promise<SupportStoreData> {
  try {
    const admin = await getSupabaseAdminClient();
    
    // 1. Intentar cargar el almacén consolidado moderno
    const { data, error } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", STORE_KEY)
      .maybeSingle();

    if (!error && data && data.value && typeof data.value === "object") {
      const val = data.value as Partial<SupportStoreData>;
      cachedStore = {
        interactions: Array.isArray(val.interactions) ? val.interactions : [],
        tickets: Array.isArray(val.tickets) ? val.tickets : [],
      };
      return cachedStore;
    }

    // 2. Fallback de migración: Si no existe el store nuevo pero existen tickets legados
    const { data: legacyData } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", LEGACY_TICKETS_KEY)
      .maybeSingle();

    if (legacyData && Array.isArray(legacyData.value)) {
      const legacyTickets = legacyData.value.map((t: any) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        businessId: t.businessId,
        businessName: t.businessName,
        businessSlug: t.businessSlug || "negocio",
        contactName: t.userName || "Contacto",
        contactEmail: t.userEmail || null,
        contactPhone: null,
        originChannel: "other" as SupportChannel,
        interactionId: null,
        interactionNumber: null,
        category: (t.category as SupportCategory) || "general",
        priority: (t.priority as TicketPriority) || "medium",
        status: (t.status as TicketStatus) || "open",
        subject: t.subject || "Sin asunto",
        description: t.description || "",
        assignedAgentId: t.assignedTo || null,
        assignedAgentName: null,
        internalNotes: t.resolutionNotes || null,
        clientResolution: null,
        createdAt: t.createdAt || new Date().toISOString(),
        updatedAt: t.updatedAt || new Date().toISOString(),
        resolvedAt: t.status === "resolved" ? t.updatedAt : null,
        closedAt: t.status === "closed" ? t.updatedAt : null,
      }));

      cachedStore = {
        interactions: [],
        tickets: legacyTickets,
      };
      // Persistir la nueva estructura automáticamente
      await saveFullStore(cachedStore);
      return cachedStore;
    }
  } catch (err) {
    console.error("[SupportService] Error al obtener almacén de soporte:", err);
  }

  return cachedStore;
}

/**
 * Función auxiliar para entornos de pruebas automatizadas
 */
export async function _resetSupportStoreForTesting(initialStore?: {
  interactions: SupportInteraction[];
  tickets: SupportTicket[];
}): Promise<void> {
  cachedStore = initialStore || { interactions: [], tickets: [] };
  await saveFullStore(cachedStore);
}

/**
 * Guarda todo el almacén en platform_settings
 */
async function saveFullStore(store: SupportStoreData): Promise<boolean> {
  cachedStore = store;
  try {
    const admin = await getSupabaseAdminClient();
    const { error } = await admin.from("platform_settings").upsert(
      {
        key: STORE_KEY,
        value: store,
        description: "Mesa de ayuda: Atenciones y tickets de soporte técnico",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    return !error;
  } catch (err) {
    console.error("[SupportService] Error al persistir almacén de soporte:", err);
    return false;
  }
}

/**
 * Calcula estadísticas consolidadas
 */
function calculateSupportStats(store: SupportStoreData): SupportDashboardStats {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const todayInteractions = store.interactions.filter((i) => {
    const d = new Date(i.createdAt).getTime();
    return d >= startOfToday;
  }).length;

  const resolvedImmediatelyCount = store.interactions.filter(
    (i) => i.outcome === "resolved_immediately"
  ).length;

  const escalatedInteractionsCount = store.interactions.filter(
    (i) => i.outcome === "escalated_to_ticket"
  ).length;

  const openTickets = store.tickets.filter((t) => t.status === "open").length;
  const inProgressTickets = store.tickets.filter((t) => t.status === "in_progress").length;
  const resolvedTickets = store.tickets.filter((t) => t.status === "resolved").length;
  const urgentTickets = store.tickets.filter(
    (t) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed"
  ).length;

  return {
    totalInteractions: store.interactions.length,
    todayInteractions,
    resolvedImmediatelyCount,
    escalatedInteractionsCount,
    totalTickets: store.tickets.length,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    urgentTickets,
  };
}

/**
 * Obtiene la vista del dashboard con filtros y paginación
 */
export async function getSupportDashboardData(params: SupportFilterParams = {}): Promise<SupportDashboardResult> {
  const store = await getFullStore();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 10));

  // 1. Filtrar Atenciones
  let filteredInteractions = [...store.interactions];

  if (params.channel && params.channel !== "all") {
    filteredInteractions = filteredInteractions.filter((i) => i.channel === params.channel);
  }
  if (params.category && params.category !== "all") {
    filteredInteractions = filteredInteractions.filter((i) => i.category === params.category);
  }
  if (params.outcome && params.outcome !== "all") {
    filteredInteractions = filteredInteractions.filter((i) => i.outcome === params.outcome);
  }
  if (params.businessId && params.businessId !== "all") {
    filteredInteractions = filteredInteractions.filter((i) => i.businessId === params.businessId);
  }
  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    filteredInteractions = filteredInteractions.filter(
      (i) =>
        i.interactionNumber.toLowerCase().includes(q) ||
        i.subject.toLowerCase().includes(q) ||
        i.businessName.toLowerCase().includes(q) ||
        i.contactName.toLowerCase().includes(q) ||
        i.agentName.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q)
    );
  }

  // Ordenar atenciones por fecha descendente
  filteredInteractions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // 2. Filtrar Tickets
  let filteredTickets = [...store.tickets];

  if (params.channel && params.channel !== "all") {
    filteredTickets = filteredTickets.filter((t) => t.originChannel === params.channel);
  }
  if (params.category && params.category !== "all") {
    filteredTickets = filteredTickets.filter((t) => t.category === params.category);
  }
  if (params.status && params.status !== "all") {
    filteredTickets = filteredTickets.filter((t) => t.status === params.status);
  }
  if (params.priority && params.priority !== "all") {
    filteredTickets = filteredTickets.filter((t) => t.priority === params.priority);
  }
  if (params.businessId && params.businessId !== "all") {
    filteredTickets = filteredTickets.filter((t) => t.businessId === params.businessId);
  }
  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    filteredTickets = filteredTickets.filter(
      (t) =>
        t.ticketNumber.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.businessName.toLowerCase().includes(q) ||
        t.contactName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.assignedAgentName && t.assignedAgentName.toLowerCase().includes(q))
    );
  }

  // Ordenar tickets por fecha descendente
  filteredTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Paginación
  const interactionsTotalCount = filteredInteractions.length;
  const ticketsTotalCount = filteredTickets.length;

  const interactionsTotalPages = Math.max(1, Math.ceil(interactionsTotalCount / pageSize));
  const ticketsTotalPages = Math.max(1, Math.ceil(ticketsTotalCount / pageSize));

  const from = (page - 1) * pageSize;
  const paginatedInteractions = filteredInteractions.slice(from, from + pageSize);
  const paginatedTickets = filteredTickets.slice(from, from + pageSize);

  const stats = calculateSupportStats(store);

  return {
    interactions: paginatedInteractions,
    tickets: paginatedTickets,
    interactionsTotalCount,
    ticketsTotalCount,
    page,
    pageSize,
    interactionsTotalPages,
    ticketsTotalPages,
    stats,
  };
}

/**
 * 1. REGISTRAR ATENCIÓN RÁPIDA (ATN-XXXX)
 * Flujo optimizado para completarse en ~15 segundos.
 * Si se marca como escalamiento a ticket, crea y vincula el ticket inmediatamente.
 */
export async function createSupportInteraction(data: {
  businessId: string;
  businessName: string;
  businessSlug: string;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  channel: SupportChannel;
  category: SupportCategory;
  subject: string;
  summary: string;
  outcome?: InteractionOutcome;
  agentId: string;
  agentName: string;
  createLinkedTicket?: boolean;
  ticketPriority?: TicketPriority;
  ticketDescription?: string;
}): Promise<{
  success: boolean;
  interaction?: SupportInteraction;
  ticket?: SupportTicket;
  error?: string;
}> {
  try {
    const store = await getFullStore();
    const count = store.interactions.length + 1;
    const interactionNumber = `ATN-${String(count).padStart(4, "0")}`;
    const nowIso = new Date().toISOString();

    const shouldCreateTicket = Boolean(
      data.createLinkedTicket || data.outcome === "escalated_to_ticket"
    );

    let linkedTicket: SupportTicket | undefined = undefined;

    if (shouldCreateTicket) {
      const ticketCount = store.tickets.length + 1;
      const ticketNumber = `TCK-${String(ticketCount).padStart(4, "0")}`;

      linkedTicket = {
        id: "tck-" + crypto.randomUUID().slice(0, 8),
        ticketNumber,
        businessId: data.businessId,
        businessName: data.businessName,
        businessSlug: data.businessSlug,
        contactName: data.contactName,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        originChannel: data.channel,
        interactionId: null, // Se asigna justo abajo
        interactionNumber: interactionNumber,
        category: data.category,
        priority: data.ticketPriority || "medium",
        status: "open",
        subject: data.subject.trim(),
        description: (data.ticketDescription || data.summary).trim(),
        assignedAgentId: data.agentId || null,
        assignedAgentName: data.agentName || null,
        internalNotes: `Originado automáticamente desde la atención ${interactionNumber} (${data.channel}).`,
        clientResolution: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        resolvedAt: null,
        closedAt: null,
      };
    }

    const newInteraction: SupportInteraction = {
      id: "atn-" + crypto.randomUUID().slice(0, 8),
      interactionNumber,
      businessId: data.businessId,
      businessName: data.businessName,
      businessSlug: data.businessSlug,
      contactName: data.contactName.trim(),
      contactPhone: data.contactPhone || null,
      contactEmail: data.contactEmail || null,
      channel: data.channel,
      category: data.category,
      subject: data.subject.trim(),
      summary: data.summary.trim(),
      outcome: shouldCreateTicket ? "escalated_to_ticket" : data.outcome || "resolved_immediately",
      ticketId: linkedTicket ? linkedTicket.id : null,
      ticketNumber: linkedTicket ? linkedTicket.ticketNumber : null,
      agentId: data.agentId,
      agentName: data.agentName,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (linkedTicket) {
      linkedTicket.interactionId = newInteraction.id;
      store.tickets.unshift(linkedTicket);
    }

    store.interactions.unshift(newInteraction);
    await saveFullStore(store);

    // Auditoría
    try {
      const admin = await getSupabaseAdminClient();
      await admin.from("audit_logs").insert({
        action: "create_support_interaction",
        entity_type: "support_interaction",
        entity_id: newInteraction.id,
        user_id: data.agentId || null,
        metadata: {
          interactionNumber,
          businessName: data.businessName,
          channel: data.channel,
          outcome: newInteraction.outcome,
          ticketNumber: linkedTicket?.ticketNumber || null,
        },
      });
    } catch {}

    // Notificaciones de Plataforma (Scope: platform, Audience: global)
    try {
      await createNotification({
        scope: "platform",
        audience: "global",
        type: "support_interaction",
        title: `Nueva Atención: ${newInteraction.interactionNumber}`,
        message: `${newInteraction.contactName} (${newInteraction.businessName}) contactó por ${newInteraction.channel}: "${newInteraction.subject}".`,
        entityType: "support_interaction",
        entityId: newInteraction.id,
        entityNumber: newInteraction.interactionNumber,
        href: "/admin/soporte",
        metadata: {
          businessId: newInteraction.businessId,
          businessName: newInteraction.businessName,
          channel: newInteraction.channel,
          outcome: newInteraction.outcome,
        },
      });

      if (linkedTicket) {
        await createNotification({
          scope: "platform",
          audience: "global",
          type: "support_ticket",
          title: `Nuevo Ticket: ${linkedTicket.ticketNumber}`,
          message: `${linkedTicket.businessName} reportó: "${linkedTicket.subject}" (${linkedTicket.priority.toUpperCase()}).`,
          entityType: "support_ticket",
          entityId: linkedTicket.id,
          entityNumber: linkedTicket.ticketNumber,
          href: "/admin/soporte",
          metadata: {
            businessId: linkedTicket.businessId,
            businessName: linkedTicket.businessName,
            priority: linkedTicket.priority,
            originChannel: linkedTicket.originChannel,
          },
        });
      }
    } catch {}

    return {
      success: true,
      interaction: newInteraction,
      ticket: linkedTicket,
    };
  } catch (err: any) {
    console.error("[SupportService.createSupportInteraction Error]:", err);
    return { success: false, error: err.message || "Error al registrar la atención" };
  }
}

/**
 * 2. CREAR TICKET DIRECTO (TCK-XXXX)
 * Para casos que requieren seguimiento formal desde el inicio.
 */
export async function createSupportTicket(data: {
  businessId: string;
  businessName: string;
  businessSlug: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  originChannel?: SupportChannel;
  interactionId?: string | null;
  category: SupportCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  internalNotes?: string | null;
  clientResolution?: string | null;
  adminUserId?: string;
}): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  try {
    const store = await getFullStore();
    const count = store.tickets.length + 1;
    const ticketNumber = `TCK-${String(count).padStart(4, "0")}`;
    const nowIso = new Date().toISOString();

    let interactionNumber: string | null = null;
    if (data.interactionId) {
      const foundAtn = store.interactions.find((i) => i.id === data.interactionId);
      if (foundAtn) {
        interactionNumber = foundAtn.interactionNumber;
      }
    }

    const newTicket: SupportTicket = {
      id: "tck-" + crypto.randomUUID().slice(0, 8),
      ticketNumber,
      businessId: data.businessId,
      businessName: data.businessName,
      businessSlug: data.businessSlug,
      contactName: data.contactName.trim(),
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      originChannel: data.originChannel || "other",
      interactionId: data.interactionId || null,
      interactionNumber,
      category: data.category,
      priority: data.priority,
      status: "open",
      subject: data.subject.trim(),
      description: data.description.trim(),
      assignedAgentId: data.assignedAgentId || null,
      assignedAgentName: data.assignedAgentName || null,
      internalNotes: data.internalNotes ? data.internalNotes.trim() : null,
      clientResolution: data.clientResolution ? data.clientResolution.trim() : null,
      createdAt: nowIso,
      updatedAt: nowIso,
      resolvedAt: null,
      closedAt: null,
    };

    // Si viene de una interacción existente, actualizar la interacción
    if (data.interactionId) {
      const atnIdx = store.interactions.findIndex((i) => i.id === data.interactionId);
      if (atnIdx !== -1) {
        store.interactions[atnIdx] = {
          ...store.interactions[atnIdx],
          ticketId: newTicket.id,
          ticketNumber: newTicket.ticketNumber,
          outcome: "escalated_to_ticket",
          updatedAt: nowIso,
        };
      }
    }

    store.tickets.unshift(newTicket);
    await saveFullStore(store);

    // Auditoría
    try {
      const admin = await getSupabaseAdminClient();
      await admin.from("audit_logs").insert({
        action: "create_support_ticket",
        entity_type: "support_ticket",
        entity_id: newTicket.id,
        user_id: data.adminUserId || null,
        metadata: {
          ticketNumber,
          businessName: data.businessName,
          subject: data.subject,
          priority: data.priority,
          originChannel: newTicket.originChannel,
        },
      });
    } catch {}

    // Notificaciones de Plataforma (Scope: platform, Audience: global/user)
    try {
      await createNotification({
        scope: "platform",
        audience: "global",
        type: "support_ticket",
        title: `Nuevo Ticket: ${newTicket.ticketNumber}`,
        message: `${newTicket.businessName} reportó: "${newTicket.subject}" (${newTicket.priority.toUpperCase()}).`,
        entityType: "support_ticket",
        entityId: newTicket.id,
        entityNumber: newTicket.ticketNumber,
        href: "/admin/soporte",
        metadata: {
          businessId: newTicket.businessId,
          businessName: newTicket.businessName,
          priority: newTicket.priority,
          originChannel: newTicket.originChannel,
        },
      });

      if (newTicket.assignedAgentId) {
        await createNotification({
          scope: "platform",
          audience: "user",
          recipientUserId: newTicket.assignedAgentId,
          type: "ticket_assigned",
          title: `Ticket asignado a ti: ${newTicket.ticketNumber}`,
          message: `El caso "${newTicket.subject}" de ${newTicket.businessName} te ha sido asignado.`,
          entityType: "support_ticket",
          entityId: newTicket.id,
          entityNumber: newTicket.ticketNumber,
          href: "/admin/soporte",
          metadata: {
            businessId: newTicket.businessId,
            ticketNumber: newTicket.ticketNumber,
          },
        });
      }
    } catch {}

    return { success: true, ticket: newTicket };
  } catch (err: any) {
    console.error("[SupportService.createSupportTicket Error]:", err);
    return { success: false, error: err.message || "Error al crear el ticket de soporte" };
  }
}

/**
 * 3. ESCALAR ATENCIÓN EXISTENTE A TICKET (ATN -> TCK)
 */
export async function escalateInteractionToTicket(
  interactionId: string,
  data: {
    priority?: TicketPriority;
    description?: string;
    adminUserId?: string;
    agentName?: string;
  }
): Promise<{ success: boolean; ticket?: SupportTicket; interaction?: SupportInteraction; error?: string }> {
  try {
    const store = await getFullStore();
    const atnIdx = store.interactions.findIndex((i) => i.id === interactionId);
    if (atnIdx === -1) {
      return { success: false, error: "Atención no encontrada" };
    }

    const atn = store.interactions[atnIdx];
    if (atn.ticketId) {
      const existingTicket = store.tickets.find((t) => t.id === atn.ticketId);
      if (existingTicket) {
        return {
          success: true,
          ticket: existingTicket,
          interaction: atn,
        };
      }
    }

    const count = store.tickets.length + 1;
    const ticketNumber = `TCK-${String(count).padStart(4, "0")}`;
    const nowIso = new Date().toISOString();

    const newTicket: SupportTicket = {
      id: "tck-" + crypto.randomUUID().slice(0, 8),
      ticketNumber,
      businessId: atn.businessId,
      businessName: atn.businessName,
      businessSlug: atn.businessSlug,
      contactName: atn.contactName,
      contactEmail: atn.contactEmail,
      contactPhone: atn.contactPhone,
      originChannel: atn.channel,
      interactionId: atn.id,
      interactionNumber: atn.interactionNumber,
      category: atn.category,
      priority: data.priority || "medium",
      status: "open",
      subject: atn.subject,
      description: (data.description || atn.summary).trim(),
      assignedAgentId: data.adminUserId || atn.agentId || null,
      assignedAgentName: data.agentName || atn.agentName || null,
      internalNotes: `Escalado desde atención ${atn.interactionNumber} (${atn.channel}).`,
      clientResolution: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      resolvedAt: null,
      closedAt: null,
    };

    store.interactions[atnIdx] = {
      ...atn,
      outcome: "escalated_to_ticket",
      ticketId: newTicket.id,
      ticketNumber: newTicket.ticketNumber,
      updatedAt: nowIso,
    };

    store.tickets.unshift(newTicket);
    await saveFullStore(store);

    // Auditoría
    try {
      const admin = await getSupabaseAdminClient();
      await admin.from("audit_logs").insert({
        action: "escalate_interaction_to_ticket",
        entity_type: "support_ticket",
        entity_id: newTicket.id,
        user_id: data.adminUserId || null,
        metadata: {
          interactionNumber: atn.interactionNumber,
          ticketNumber,
          businessName: atn.businessName,
        },
      });
    } catch {}

    // Notificación de escalamiento
    try {
      await createNotification({
        scope: "platform",
        audience: "global",
        type: "support_ticket",
        title: `Ticket Creado (Escalamiento): ${newTicket.ticketNumber}`,
        message: `La atención ${atn.interactionNumber} de ${atn.businessName} fue promovida a ticket de soporte.`,
        entityType: "support_ticket",
        entityId: newTicket.id,
        entityNumber: newTicket.ticketNumber,
        href: "/admin/soporte",
        metadata: {
          businessId: newTicket.businessId,
          interactionNumber: atn.interactionNumber,
          ticketNumber: newTicket.ticketNumber,
        },
      });
    } catch {}

    return {
      success: true,
      ticket: newTicket,
      interaction: store.interactions[atnIdx],
    };
  } catch (err: any) {
    console.error("[SupportService.escalateInteractionToTicket Error]:", err);
    return { success: false, error: err.message || "Error al escalar atención a ticket" };
  }
}

/**
 * 4. ACTUALIZAR ESTADO, PRIORIDAD Y NOTAS DE TICKET
 */
export async function updateSupportTicket(
  ticketId: string,
  data: {
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedAgentId?: string | null;
    assignedAgentName?: string | null;
    internalNotes?: string | null;
    clientResolution?: string | null;
    adminUserId?: string;
  }
): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  try {
    const store = await getFullStore();
    const idx = store.tickets.findIndex((t) => t.id === ticketId);
    if (idx === -1) {
      return { success: false, error: "Ticket de soporte no encontrado" };
    }

    const current = store.tickets[idx];
    const nowIso = new Date().toISOString();

    const newStatus = data.status || current.status;
    let resolvedAt = current.resolvedAt;
    let closedAt = current.closedAt;

    if (newStatus === "resolved" && current.status !== "resolved") {
      resolvedAt = nowIso;
    } else if (newStatus !== "resolved" && newStatus !== "closed") {
      resolvedAt = null;
    }

    if (newStatus === "closed" && current.status !== "closed") {
      closedAt = nowIso;
    } else if (newStatus !== "closed") {
      closedAt = null;
    }

    store.tickets[idx] = {
      ...current,
      status: newStatus,
      priority: data.priority !== undefined ? data.priority : current.priority,
      assignedAgentId: data.assignedAgentId !== undefined ? data.assignedAgentId : current.assignedAgentId,
      assignedAgentName: data.assignedAgentName !== undefined ? data.assignedAgentName : current.assignedAgentName,
      internalNotes: data.internalNotes !== undefined ? data.internalNotes : current.internalNotes,
      clientResolution: data.clientResolution !== undefined ? data.clientResolution : current.clientResolution,
      updatedAt: nowIso,
      resolvedAt,
      closedAt,
    };

    await saveFullStore(store);

    // Auditoría
    try {
      const admin = await getSupabaseAdminClient();
      await admin.from("audit_logs").insert({
        action: "update_support_ticket",
        entity_type: "support_ticket",
        entity_id: ticketId,
        user_id: data.adminUserId || null,
        metadata: {
          ticketNumber: current.ticketNumber,
          oldStatus: current.status,
          newStatus,
          priority: store.tickets[idx].priority,
        },
      });
    } catch {}

    // Notificación al agente si fue asignado
    try {
      if (data.assignedAgentId && data.assignedAgentId !== current.assignedAgentId) {
        await createNotification({
          scope: "platform",
          audience: "user",
          recipientUserId: data.assignedAgentId,
          type: "ticket_assigned",
          title: `Ticket asignado a ti: ${current.ticketNumber}`,
          message: `El caso "${current.subject}" de ${current.businessName} te ha sido asignado.`,
          entityType: "support_ticket",
          entityId: ticketId,
          entityNumber: current.ticketNumber,
          href: "/admin/soporte",
          metadata: {
            businessId: current.businessId,
            ticketNumber: current.ticketNumber,
          },
        });
      }
    } catch {}

    return { success: true, ticket: store.tickets[idx] };
  } catch (err: any) {
    console.error("[SupportService.updateSupportTicket Error]:", err);
    return { success: false, error: err.message || "Error al actualizar el ticket" };
  }
}
