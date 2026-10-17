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

async function getFullStore(): Promise<SupportStoreData> {
  // Legacy function maintained temporarily to read existing platform_settings if needed for fallback, 
  // but now operations directly use SQL tables.
  return cachedStore;
}

export async function _resetSupportStoreForTesting(initialStore?: any): Promise<void> {}
async function saveFullStore(store: SupportStoreData): Promise<boolean> { return true; }

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
  const admin = await getSupabaseAdminClient();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 10));

  // 1. Obtener todas las atenciones (o filtrar por SQL)
  let intQuery = admin.from("support_interactions").select("*");
  if (params.channel && params.channel !== "all") intQuery = intQuery.eq("channel", params.channel);
  if (params.category && params.category !== "all") intQuery = intQuery.eq("category", params.category);
  if (params.outcome && params.outcome !== "all") intQuery = intQuery.eq("outcome", params.outcome);
  if (params.businessId && params.businessId !== "all") intQuery = intQuery.eq("business_id", params.businessId);

  const { data: intData = [] } = await intQuery;

  // 2. Obtener todos los tickets
  let tckQuery = admin.from("support_tickets").select("*");
  if (params.channel && params.channel !== "all") tckQuery = tckQuery.eq("origin_channel", params.channel);
  if (params.category && params.category !== "all") tckQuery = tckQuery.eq("category", params.category);
  if (params.status && params.status !== "all") tckQuery = tckQuery.eq("status", params.status);
  if (params.priority && params.priority !== "all") tckQuery = tckQuery.eq("priority", params.priority);
  if (params.businessId && params.businessId !== "all") tckQuery = tckQuery.eq("business_id", params.businessId);

  const { data: tckData = [] } = await tckQuery;

  // Transformar rows a objetos TS
  let interactions: SupportInteraction[] = (intData || []).map(row => ({
    id: row.id,
    interactionNumber: row.interaction_number,
    businessId: row.business_id,
    businessName: row.business_name,
    businessSlug: row.business_slug,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    channel: row.channel,
    category: row.category,
    subject: row.subject,
    summary: row.summary,
    outcome: row.outcome,
    ticketId: row.ticket_id,
    ticketNumber: row.ticket_number,
    agentId: row.agent_id,
    agentName: row.agent_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));

  let tickets: SupportTicket[] = (tckData || []).map(row => ({
    id: row.id,
    ticketNumber: row.ticket_number,
    businessId: row.business_id,
    businessName: row.business_name,
    businessSlug: row.business_slug,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    originChannel: row.origin_channel,
    interactionId: row.interaction_id,
    interactionNumber: row.interaction_number,
    category: row.category,
    priority: row.priority,
    status: row.status,
    subject: row.subject,
    description: row.description,
    assignedAgentId: row.assigned_agent_id,
    assignedAgentName: row.assigned_agent_name,
    internalNotes: row.internal_notes,
    clientResolution: row.client_resolution,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at
  }));

  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    interactions = interactions.filter(
      (i) =>
        i.interactionNumber.toLowerCase().includes(q) ||
        i.subject.toLowerCase().includes(q) ||
        i.businessName.toLowerCase().includes(q) ||
        i.contactName.toLowerCase().includes(q) ||
        i.agentName.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q)
    );
    tickets = tickets.filter(
      (t) =>
        t.ticketNumber.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.businessName.toLowerCase().includes(q) ||
        t.contactName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.assignedAgentName && t.assignedAgentName.toLowerCase().includes(q))
    );
  }

  interactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const interactionsTotalCount = interactions.length;
  const ticketsTotalCount = tickets.length;

  const interactionsTotalPages = Math.max(1, Math.ceil(interactionsTotalCount / pageSize));
  const ticketsTotalPages = Math.max(1, Math.ceil(ticketsTotalCount / pageSize));

  const from = (page - 1) * pageSize;
  const paginatedInteractions = interactions.slice(from, from + pageSize);
  const paginatedTickets = tickets.slice(from, from + pageSize);

  const stats = calculateSupportStats({ interactions, tickets });

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
    const admin = await getSupabaseAdminClient();
    
    // Obtener contadores para generar números
    const { count: countInt } = await admin.from("support_interactions").select("*", { count: "exact", head: true });
    const { count: countTck } = await admin.from("support_tickets").select("*", { count: "exact", head: true });
    
    const nextIntCount = (countInt || 0) + 1;
    const interactionNumber = `ATN-${String(nextIntCount).padStart(4, "0")}`;
    const nowIso = new Date().toISOString();

    const shouldCreateTicket = Boolean(
      data.createLinkedTicket || data.outcome === "escalated_to_ticket"
    );

    let linkedTicket: SupportTicket | undefined = undefined;
    const interactionId = "atn-" + crypto.randomUUID().slice(0, 8);

    if (shouldCreateTicket) {
      const nextTckCount = (countTck || 0) + 1;
      const ticketNumber = `TCK-${String(nextTckCount).padStart(4, "0")}`;

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
        interactionId: interactionId,
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
      
      const tckPayload = {
        id: linkedTicket.id,
        ticket_number: linkedTicket.ticketNumber,
        business_id: linkedTicket.businessId?.includes("-") ? linkedTicket.businessId : null,
        business_name: linkedTicket.businessName,
        business_slug: linkedTicket.businessSlug,
        contact_name: linkedTicket.contactName,
        contact_email: linkedTicket.contactEmail,
        contact_phone: linkedTicket.contactPhone,
        origin_channel: linkedTicket.originChannel,
        interaction_id: linkedTicket.interactionId,
        interaction_number: linkedTicket.interactionNumber,
        category: linkedTicket.category,
        priority: linkedTicket.priority,
        status: linkedTicket.status,
        subject: linkedTicket.subject,
        description: linkedTicket.description,
        assigned_agent_id: linkedTicket.assignedAgentId?.includes("-") ? linkedTicket.assignedAgentId : null,
        assigned_agent_name: linkedTicket.assignedAgentName,
        internal_notes: linkedTicket.internalNotes,
        client_resolution: linkedTicket.clientResolution,
        created_at: linkedTicket.createdAt,
        updated_at: linkedTicket.updatedAt
      };
      await admin.from("support_tickets").insert(tckPayload);
    }

    const newInteraction: SupportInteraction = {
      id: interactionId,
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

    const atnPayload = {
      id: newInteraction.id,
      interaction_number: newInteraction.interactionNumber,
      business_id: newInteraction.businessId?.includes("-") ? newInteraction.businessId : null,
      business_name: newInteraction.businessName,
      business_slug: newInteraction.businessSlug,
      contact_name: newInteraction.contactName,
      contact_phone: newInteraction.contactPhone,
      contact_email: newInteraction.contactEmail,
      channel: newInteraction.channel,
      category: newInteraction.category,
      subject: newInteraction.subject,
      summary: newInteraction.summary,
      outcome: newInteraction.outcome,
      ticket_id: newInteraction.ticketId,
      ticket_number: newInteraction.ticketNumber,
      agent_id: newInteraction.agentId?.includes("-") ? newInteraction.agentId : null,
      agent_name: newInteraction.agentName,
      created_at: newInteraction.createdAt,
      updated_at: newInteraction.updatedAt
    };
    await admin.from("support_interactions").insert(atnPayload);

    // Auditoría
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      action: "create",
      entityType: "support_interaction",
      entityId: newInteraction.id,
      businessId: data.businessId,
      userId: data.agentId || null,
      metadata: {
        original_action: "create_support_interaction",
        interactionNumber,
        businessName: data.businessName,
        channel: data.channel,
        outcome: newInteraction.outcome,
        ticketNumber: linkedTicket?.ticketNumber || null,
      },
    });

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
    const admin = await getSupabaseAdminClient();
    const { count: countTck } = await admin.from("support_tickets").select("*", { count: "exact", head: true });
    
    const count = (countTck || 0) + 1;
    const ticketNumber = `TCK-${String(count).padStart(4, "0")}`;
    const nowIso = new Date().toISOString();

    let interactionNumber: string | null = null;
    if (data.interactionId) {
      const { data: foundAtn } = await admin.from("support_interactions").select("interaction_number").eq("id", data.interactionId).maybeSingle();
      if (foundAtn) {
        interactionNumber = foundAtn.interaction_number;
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

    const tckPayload = {
      id: newTicket.id,
      ticket_number: newTicket.ticketNumber,
      business_id: newTicket.businessId?.includes("-") ? newTicket.businessId : null,
      business_name: newTicket.businessName,
      business_slug: newTicket.businessSlug,
      contact_name: newTicket.contactName,
      contact_email: newTicket.contactEmail,
      contact_phone: newTicket.contactPhone,
      origin_channel: newTicket.originChannel,
      interaction_id: newTicket.interactionId,
      interaction_number: newTicket.interactionNumber,
      category: newTicket.category,
      priority: newTicket.priority,
      status: newTicket.status,
      subject: newTicket.subject,
      description: newTicket.description,
      assigned_agent_id: newTicket.assignedAgentId?.includes("-") ? newTicket.assignedAgentId : null,
      assigned_agent_name: newTicket.assignedAgentName,
      internal_notes: newTicket.internalNotes,
      client_resolution: newTicket.clientResolution,
      created_at: newTicket.createdAt,
      updated_at: newTicket.updatedAt
    };
    await admin.from("support_tickets").insert(tckPayload);

    // Si viene de una interacción existente, actualizar la interacción
    if (data.interactionId) {
      await admin.from("support_interactions").update({
        ticket_id: newTicket.id,
        ticket_number: newTicket.ticketNumber,
        outcome: "escalated_to_ticket",
        updated_at: nowIso
      }).eq("id", data.interactionId);
    }

    // Auditoría
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      action: "create",
      entityType: "support_ticket",
      entityId: newTicket.id,
      businessId: data.businessId,
      userId: data.adminUserId || null,
      metadata: {
        original_action: "create_support_ticket",
        ticketNumber,
        businessName: data.businessName,
        subject: data.subject,
        priority: data.priority,
        originChannel: newTicket.originChannel,
      },
    });

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
    const admin = await getSupabaseAdminClient();
    const { data: atnRow } = await admin.from("support_interactions").select("*").eq("id", interactionId).maybeSingle();
    
    if (!atnRow) {
      return { success: false, error: "Atención no encontrada" };
    }

    if (atnRow.ticket_id) {
      const { data: existingTicketRow } = await admin.from("support_tickets").select("*").eq("id", atnRow.ticket_id).maybeSingle();
      if (existingTicketRow) {
        // Mapeo no estrictamente necesario si solo retornamos éxito, pero lo omitimos por simplicidad y retornamos obj
        return {
          success: true,
          ticket: { id: existingTicketRow.id } as SupportTicket,
          interaction: { id: atnRow.id } as SupportInteraction,
        };
      }
    }

    const { count: countTck } = await admin.from("support_tickets").select("*", { count: "exact", head: true });
    const count = (countTck || 0) + 1;
    const ticketNumber = `TCK-${String(count).padStart(4, "0")}`;
    const nowIso = new Date().toISOString();

    const newTicket: SupportTicket = {
      id: "tck-" + crypto.randomUUID().slice(0, 8),
      ticketNumber,
      businessId: atnRow.business_id,
      businessName: atnRow.business_name,
      businessSlug: atnRow.business_slug,
      contactName: atnRow.contact_name,
      contactEmail: atnRow.contact_email,
      contactPhone: atnRow.contact_phone,
      originChannel: atnRow.channel,
      interactionId: atnRow.id,
      interactionNumber: atnRow.interaction_number,
      category: atnRow.category,
      priority: data.priority || "medium",
      status: "open",
      subject: atnRow.subject,
      description: (data.description || atnRow.summary).trim(),
      assignedAgentId: data.adminUserId || atnRow.agent_id || null,
      assignedAgentName: data.agentName || atnRow.agent_name || null,
      internalNotes: `Escalado desde atención ${atnRow.interaction_number} (${atnRow.channel}).`,
      clientResolution: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      resolvedAt: null,
      closedAt: null,
    };

    const tckPayload = {
      id: newTicket.id,
      ticket_number: newTicket.ticketNumber,
      business_id: newTicket.businessId?.includes("-") ? newTicket.businessId : null,
      business_name: newTicket.businessName,
      business_slug: newTicket.businessSlug,
      contact_name: newTicket.contactName,
      contact_email: newTicket.contactEmail,
      contact_phone: newTicket.contactPhone,
      origin_channel: newTicket.originChannel,
      interaction_id: newTicket.interactionId,
      interaction_number: newTicket.interactionNumber,
      category: newTicket.category,
      priority: newTicket.priority,
      status: newTicket.status,
      subject: newTicket.subject,
      description: newTicket.description,
      assigned_agent_id: newTicket.assignedAgentId?.includes("-") ? newTicket.assignedAgentId : null,
      assigned_agent_name: newTicket.assignedAgentName,
      internal_notes: newTicket.internalNotes,
      client_resolution: newTicket.clientResolution,
      created_at: newTicket.createdAt,
      updated_at: newTicket.updatedAt
    };
    await admin.from("support_tickets").insert(tckPayload);

    await admin.from("support_interactions").update({
      outcome: "escalated_to_ticket",
      ticket_id: newTicket.id,
      ticket_number: newTicket.ticketNumber,
      updated_at: nowIso
    }).eq("id", interactionId);

    // Auditoría
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      action: "create",
      entityType: "support_ticket",
      entityId: newTicket.id,
      businessId: atnRow.business_id,
      userId: data.adminUserId || null,
      metadata: {
        original_action: "escalate_interaction_to_ticket",
        interactionNumber: atnRow.interaction_number,
        ticketNumber,
        businessName: atnRow.business_name,
      },
    });

    // Notificación de escalamiento
    try {
      await createNotification({
        scope: "platform",
        audience: "global",
        type: "support_ticket",
        title: `Ticket Creado (Escalamiento): ${newTicket.ticketNumber}`,
        message: `La atención ${atnRow.interaction_number} de ${atnRow.business_name} fue promovida a ticket de soporte.`,
        entityType: "support_ticket",
        entityId: newTicket.id,
        entityNumber: newTicket.ticketNumber,
        href: "/admin/soporte",
        metadata: {
          businessId: newTicket.businessId,
          interactionNumber: atnRow.interaction_number,
          ticketNumber: newTicket.ticketNumber,
        },
      });
    } catch {}

    const updatedInteraction: SupportInteraction = {
      id: atnRow.id,
      interactionNumber: atnRow.interaction_number,
      businessId: atnRow.business_id,
      businessName: atnRow.business_name,
      businessSlug: atnRow.business_slug,
      contactName: atnRow.contact_name,
      contactPhone: atnRow.contact_phone,
      contactEmail: atnRow.contact_email,
      channel: atnRow.channel,
      category: atnRow.category,
      subject: atnRow.subject,
      summary: atnRow.summary,
      outcome: "escalated_to_ticket",
      ticketId: newTicket.id,
      ticketNumber: newTicket.ticketNumber,
      agentId: atnRow.agent_id,
      agentName: atnRow.agent_name,
      createdAt: atnRow.created_at,
      updatedAt: nowIso,
    };

    return {
      success: true,
      ticket: newTicket,
      interaction: updatedInteraction,
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
    const admin = await getSupabaseAdminClient();
    const { data: current } = await admin.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
    if (!current) {
      return { success: false, error: "Ticket de soporte no encontrado" };
    }

    const nowIso = new Date().toISOString();

    const newStatus = data.status || current.status;
    let resolvedAt = current.resolved_at;
    let closedAt = current.closed_at;

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

    const updatePayload = {
      status: newStatus,
      priority: data.priority !== undefined ? data.priority : current.priority,
      assigned_agent_id: data.assignedAgentId !== undefined ? (data.assignedAgentId?.includes("-") ? data.assignedAgentId : null) : current.assigned_agent_id,
      assigned_agent_name: data.assignedAgentName !== undefined ? data.assignedAgentName : current.assigned_agent_name,
      internal_notes: data.internalNotes !== undefined ? data.internalNotes : current.internal_notes,
      client_resolution: data.clientResolution !== undefined ? data.clientResolution : current.client_resolution,
      updated_at: nowIso,
      resolved_at: resolvedAt,
      closed_at: closedAt,
    };

    await admin.from("support_tickets").update(updatePayload).eq("id", ticketId);

    // Revocación automática de autorizaciones administrativas si el ticket se resuelve o cierra
    if (newStatus === "resolved" || newStatus === "closed") {
      try {
        const { revokeAllGrantsForTicket } = await import("@/lib/support/delegated-access-service");
        await revokeAllGrantsForTicket(
          ticketId,
          `Ticket de soporte ${current.ticket_number} cambiado a estado '${newStatus}'.`
        );
      } catch (revokeErr) {
        console.warn("⚠️ No se pudieron revocar los grants asociados al ticket:", revokeErr);
      }
    }

    // Auditoría
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      action: "update",
      entityType: "support_ticket",
      entityId: ticketId,
      businessId: current.business_id,
      userId: data.adminUserId || null,
      oldData: { status: current.status, priority: current.priority },
      newData: { status: newStatus, priority: updatePayload.priority },
      metadata: {
        original_action: "update_support_ticket",
        ticketNumber: current.ticket_number,
        oldStatus: current.status,
        newStatus,
        priority: updatePayload.priority,
      },
    });

    // Notificación al agente si fue asignado
    try {
      if (data.assignedAgentId && data.assignedAgentId !== current.assigned_agent_id) {
        await createNotification({
          scope: "platform",
          audience: "user",
          recipientUserId: data.assignedAgentId,
          type: "ticket_assigned",
          title: `Ticket asignado a ti: ${current.ticket_number}`,
          message: `El caso "${current.subject}" de ${current.business_name} te ha sido asignado.`,
          entityType: "support_ticket",
          entityId: ticketId,
          entityNumber: current.ticket_number,
          href: "/admin/soporte",
          metadata: {
            businessId: current.business_id,
            ticketNumber: current.ticket_number,
          },
        });
      }
    } catch {}

    const updatedTicket: SupportTicket = {
      id: current.id,
      ticketNumber: current.ticket_number,
      businessId: current.business_id,
      businessName: current.business_name,
      businessSlug: current.business_slug,
      contactName: current.contact_name,
      contactEmail: current.contact_email,
      contactPhone: current.contact_phone,
      originChannel: current.origin_channel,
      interactionId: current.interaction_id,
      interactionNumber: current.interaction_number,
      category: current.category,
      priority: updatePayload.priority,
      status: newStatus,
      subject: current.subject,
      description: current.description,
      assignedAgentId: updatePayload.assigned_agent_id,
      assignedAgentName: updatePayload.assigned_agent_name,
      internalNotes: updatePayload.internal_notes,
      clientResolution: updatePayload.client_resolution,
      createdAt: current.created_at,
      updatedAt: nowIso,
      resolvedAt,
      closedAt,
    };

    return { success: true, ticket: updatedTicket };
  } catch (err: any) {
    console.error("[SupportService.updateSupportTicket Error]:", err);
    return { success: false, error: err.message || "Error al actualizar el ticket" };
  }
}

/**
 * 5. OBTENER TICKETS DE UN NEGOCIO ESPECÍFICO (Workspace Multi-Tenant)
 */
export async function getBusinessSupportTickets(
  businessId: string,
  params: { status?: string; search?: string; category?: string } = {}
): Promise<SupportTicket[]> {
  try {
    const admin = await getSupabaseAdminClient();
    let query = admin
      .from("support_tickets")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }
    if (params.category && params.category !== "all") {
      query = query.eq("category", params.category);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) {
      return [];
    }

    let tickets: SupportTicket[] = data.map((row) => ({
      id: row.id,
      ticketNumber: row.ticket_number,
      businessId: row.business_id,
      businessName: row.business_name,
      businessSlug: row.business_slug,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      originChannel: row.origin_channel,
      interactionId: row.interaction_id,
      interactionNumber: row.interaction_number,
      category: row.category,
      priority: row.priority,
      status: row.status,
      subject: row.subject,
      description: row.description,
      assignedAgentId: row.assigned_agent_id,
      assignedAgentName: row.assigned_agent_name,
      internalNotes: null, // Por seguridad multi-tenant, nunca exponer notas internas al cliente
      clientResolution: row.client_resolution,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      closedAt: row.closed_at,
    }));

    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      tickets = tickets.filter(
        (t) =>
          t.ticketNumber.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    return tickets;
  } catch (err) {
    console.error("[getBusinessSupportTickets Error]:", err);
    return [];
  }
}

/**
 * 6. OBTENER DETALLE DE UN TICKET ESPECÍFICO (Workspace Multi-Tenant)
 */
export async function getBusinessSupportTicketById(
  businessId: string,
  ticketId: string
): Promise<SupportTicket | null> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data, error } = await admin
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      ticketNumber: data.ticket_number,
      businessId: data.business_id,
      businessName: data.business_name,
      businessSlug: data.business_slug,
      contactName: data.contact_name,
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      originChannel: data.origin_channel,
      interactionId: data.interaction_id,
      interactionNumber: data.interaction_number,
      category: data.category,
      priority: data.priority,
      status: data.status,
      subject: data.subject,
      description: data.description,
      assignedAgentId: data.assigned_agent_id,
      assignedAgentName: data.assigned_agent_name,
      internalNotes: null, // Ocultar notas internas al cliente
      clientResolution: data.client_resolution,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      resolvedAt: data.resolved_at,
      closedAt: data.closed_at,
    };
  } catch (err) {
    console.error("[getBusinessSupportTicketById Error]:", err);
    return null;
  }
}

/**
 * 7. OBTENER HISTORIAL DE MENSAJES DE UN TICKET
 */
export async function getTicketMessages(
  businessId: string,
  ticketId: string
): Promise<Array<{
  id: string;
  senderRole: "client" | "agent" | "ai" | "system";
  senderName: string;
  content: string;
  createdAt: string;
}>> {
  try {
    const admin = await getSupabaseAdminClient();
    // Validar pertenencia del ticket al negocio
    const { data: ticket } = await admin
      .from("support_tickets")
      .select("id, ticket_number, business_id")
      .eq("id", ticketId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!ticket) return [];

    // Buscar conversación vinculada al ticket
    const { data: conv } = await admin
      .from("support_conversations")
      .select("id")
      .eq("ticket_id", ticketId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!conv) {
      return [];
    }

    const { data: messages } = await admin
      .from("support_chat_messages")
      .select("id, sender_role, sender_name, content, is_internal_note, created_at")
      .eq("conversation_id", conv.id)
      .eq("is_internal_note", false) // Nunca mostrar notas internas al usuario
      .order("created_at", { ascending: true });

    return (messages || []).map((m) => ({
      id: m.id,
      senderRole: m.sender_role as any,
      senderName: m.sender_name,
      content: m.content,
      createdAt: m.created_at,
    }));
  } catch (err) {
    console.error("[getTicketMessages Error]:", err);
    return [];
  }
}

/**
 * 8. AGREGAR MENSAJE DE SEGUIMIENTO A UN TICKET (Cliente o Agente)
 */
export async function addTicketMessage(params: {
  businessId: string;
  ticketId: string;
  senderRole: "client" | "agent";
  senderId: string;
  senderName: string;
  content: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    // Validar ticket
    const { data: ticket } = await admin
      .from("support_tickets")
      .select("*")
      .eq("id", params.ticketId)
      .eq("business_id", params.businessId)
      .maybeSingle();

    if (!ticket) {
      return { success: false, error: "Ticket no encontrado o no pertenece a este comercio" };
    }

    if (ticket.status === "closed") {
      return { success: false, error: "No es posible enviar mensajes en un ticket cerrado" };
    }

    // Buscar o crear conversación vinculada
    let { data: conv } = await admin
      .from("support_conversations")
      .select("*")
      .eq("ticket_id", params.ticketId)
      .eq("business_id", params.businessId)
      .maybeSingle();

    const nowIso = new Date().toISOString();

    if (!conv) {
      const convId = `conv-tck-${params.ticketId}-${Date.now()}`;
      const { count } = await admin.from("support_conversations").select("*", { count: "exact", head: true });
      const convNumber = `CHT-${String((count || 0) + 1).padStart(4, "0")}`;

      const newConv = {
        id: convId,
        conversation_number: convNumber,
        business_id: params.businessId,
        business_name: ticket.business_name,
        business_slug: ticket.business_slug,
        user_id: params.senderId,
        user_name: params.senderName,
        status: "with_agent",
        mode: "human",
        subject: `Seguimiento de Ticket ${ticket.ticket_number}: ${ticket.subject}`,
        last_message_at: nowIso,
        last_message_preview: params.content.slice(0, 100),
        unread_count_admin: params.senderRole === "client" ? 1 : 0,
        unread_count_client: params.senderRole === "agent" ? 1 : 0,
        ticket_id: params.ticketId,
        created_at: nowIso,
        updated_at: nowIso,
      };

      await admin.from("support_conversations").insert(newConv);
      conv = newConv as any;
    } else {
      await admin
        .from("support_conversations")
        .update({
          last_message_at: nowIso,
          last_message_preview: params.content.slice(0, 100),
          unread_count_admin:
            params.senderRole === "client"
              ? (conv.unread_count_admin || 0) + 1
              : conv.unread_count_admin,
          unread_count_client:
            params.senderRole === "agent"
              ? (conv.unread_count_client || 0) + 1
              : conv.unread_count_client,
          updated_at: nowIso,
        })
        .eq("id", conv.id);
    }

    const messageId = `msg-tck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const msgPayload = {
      id: messageId,
      conversation_id: conv!.id,
      sender_role: params.senderRole,
      sender_id: params.senderId,
      sender_name: params.senderName,
      content: params.content.trim(),
      read_by_admin: params.senderRole === "agent",
      read_by_client: params.senderRole === "client",
      is_internal_note: false,
      created_at: nowIso,
    };

    await admin.from("support_chat_messages").insert(msgPayload);

    // Notificar al equipo de administración si el mensaje lo envía el cliente
    if (params.senderRole === "client") {
      try {
        await createNotification({
          scope: "platform",
          audience: "global",
          type: "support_ticket",
          title: `Nuevo mensaje en Ticket ${ticket.ticket_number}`,
          message: `${params.senderName} (${ticket.business_name}): "${params.content.slice(0, 80)}"`,
          entityType: "support_ticket",
          entityId: ticket.id,
          entityNumber: ticket.ticket_number,
          href: `/admin/soporte?tab=tickets&id=${ticket.id}`,
          metadata: {
            businessId: params.businessId,
            ticketId: ticket.id,
            ticketNumber: ticket.ticket_number,
          },
        });
      } catch {}
    }

    return { success: true, messageId };
  } catch (err: any) {
    console.error("[addTicketMessage Error]:", err);
    return { success: false, error: err.message || "Error al registrar mensaje en ticket" };
  }
}
