"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  getBusinessSupportTickets,
  getBusinessSupportTicketById,
  getTicketMessages,
  addTicketMessage,
  createSupportTicket,
} from "@/lib/support/support-service";
import { SupportCategory, TicketPriority, SupportTicket } from "@/lib/support/types";

/**
 * Obtener listado de tickets del negocio activo con filtros opcionales
 */
export async function getWorkspaceTicketsAction(
  businessId: string,
  params: { status?: string; search?: string; category?: string } = {}
): Promise<{ success: boolean; tickets: SupportTicket[]; error?: string }> {
  try {
    const session = await requireWorkspaceSession(businessId, "none");
    const tickets = await getBusinessSupportTickets(session.businessId, params);
    return { success: true, tickets };
  } catch (err: any) {
    console.error("[getWorkspaceTicketsAction Error]:", err);
    return { success: false, tickets: [], error: err.message || "Error al obtener solicitudes de soporte" };
  }
}

/**
 * Obtener detalle de un ticket y su historial de mensajes
 */
export async function getWorkspaceTicketDetailAction(
  businessId: string,
  ticketId: string
): Promise<{
  success: boolean;
  ticket?: SupportTicket | null;
  messages?: Array<{
    id: string;
    senderRole: "client" | "agent" | "ai" | "system";
    senderName: string;
    content: string;
    createdAt: string;
  }>;
  error?: string;
}> {
  try {
    const session = await requireWorkspaceSession(businessId, "none");
    const ticket = await getBusinessSupportTicketById(session.businessId, ticketId);
    if (!ticket) {
      return { success: false, error: "Solicitud no encontrada o no pertenece a este comercio" };
    }

    const messages = await getTicketMessages(session.businessId, ticketId);
    return { success: true, ticket, messages };
  } catch (err: any) {
    console.error("[getWorkspaceTicketDetailAction Error]:", err);
    return { success: false, error: err.message || "Error al obtener el detalle de la solicitud" };
  }
}

/**
 * Crear una nueva solicitud formal de soporte desde el Workspace
 */
export async function createWorkspaceTicketAction(
  businessId: string,
  data: {
    subject: string;
    description: string;
    category: SupportCategory;
    priority?: TicketPriority;
  }
): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  try {
    const session = await requireWorkspaceSession(businessId, "none");

    if (!data.subject || !data.subject.trim()) {
      return { success: false, error: "El asunto de la solicitud es obligatorio" };
    }
    if (!data.description || !data.description.trim()) {
      return { success: false, error: "La descripción del problema o consulta es obligatoria" };
    }

    const result = await createSupportTicket({
      businessId: session.businessId,
      businessName: session.businessName,
      businessSlug: session.businessSlug || session.businessName.toLowerCase().replace(/\s+/g, "-"),
      contactName: session.userEmail.split("@")[0] || "Usuario Comercio",
      contactEmail: session.userEmail,
      originChannel: "in_app_chat",
      category: data.category || "general",
      priority: data.priority || "medium",
      subject: data.subject.trim(),
      description: data.description.trim(),
    });

    if (result.success && result.ticket) {
      try {
        revalidatePath(`/workspace/${businessId}/soporte`);
        revalidatePath(`/admin/soporte`);
      } catch {}
    }

    return result;
  } catch (err: any) {
    console.error("[createWorkspaceTicketAction Error]:", err);
    return { success: false, error: err.message || "Error al registrar la solicitud de soporte" };
  }
}

/**
 * Enviar un mensaje de seguimiento / respuesta a un ticket existente
 */
export async function sendWorkspaceTicketMessageAction(
  businessId: string,
  ticketId: string,
  content: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const session = await requireWorkspaceSession(businessId, "none");

    if (!content || !content.trim()) {
      return { success: false, error: "El mensaje no puede estar vacío" };
    }

    const result = await addTicketMessage({
      businessId: session.businessId,
      ticketId,
      senderRole: "client",
      senderId: session.userId,
      senderName: session.userEmail.split("@")[0] || "Usuario Comercio",
      content: content.trim(),
    });

    if (result.success) {
      try {
        revalidatePath(`/workspace/${businessId}/soporte`);
        revalidatePath(`/admin/soporte`);
      } catch {}
    }

    return result;
  } catch (err: any) {
    console.error("[sendWorkspaceTicketMessageAction Error]:", err);
    return { success: false, error: err.message || "Error al enviar el mensaje de soporte" };
  }
}
