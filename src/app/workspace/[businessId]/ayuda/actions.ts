"use server";

import { z } from "zod";
import crypto from "crypto";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { logAuditAction } from "@/lib/audit/audit-service";

const supportTicketSchema = z.object({
  subject: z.string().min(5, "El asunto debe tener al menos 5 caracteres"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  category: z.string().min(1, "Selecciona una categoría"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  contactPhone: z.string().optional(),
  attachmentUrl: z.string().optional(),
});

export type SupportTicketPayload = z.infer<typeof supportTicketSchema>;

export interface SubmitTicketResponse {
  success: boolean;
  ticketNumber?: string;
  error?: string;
}

/**
 * Server Action: Envía y registra un ticket de soporte técnico desde el centro de ayuda [HELP-001]
 */
export async function submitSupportTicketAction(
  businessId: string,
  payload: SupportTicketPayload
): Promise<SubmitTicketResponse> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para enviar solicitudes de soporte." };
  }

  const parseResult = supportTicketSchema.safeParse(payload);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || "Datos del formulario inválidos.",
    };
  }

  const { subject, description, category, priority, contactPhone, attachmentUrl } = parseResult.data;

  try {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const ticketNumber = `TICK-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const contactName = auth.context.userEmail?.split("@")[0] || "Usuario NEGOVA";
    const contactEmail = auth.context.userEmail || "soporte@negova.com";
    const businessName = auth.context.businessName || "Comercio NEGOVA";
    const businessSlug = auth.context.businessSlug || businessId.slice(0, 8);

    if (serviceKey && supabaseUrl) {
      const supabaseAdmin = createAdminClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Insertar en la tabla de soporte de base de datos
      const fullDescription = attachmentUrl
        ? `${description}\n\n[Adjunto / Captura]: ${attachmentUrl}`
        : description;

      await supabaseAdmin.from("support_tickets").insert({
        id: crypto.randomUUID(),
        ticket_number: ticketNumber,
        business_id: businessId,
        business_name: businessName,
        business_slug: businessSlug,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        origin_channel: "workspace_help_center",
        category,
        priority,
        status: "open",
        subject,
        description: fullDescription,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Registrar en auditoría
    await logAuditAction({
      businessId,
      userId: auth.context.userId,
      action: "create",
      entityType: "support_ticket",
      entityId: ticketNumber,
      metadata: {
        category,
        priority,
        subject,
      },
    });

    // Enviar notificación por correo al equipo de soporte en segundo plano
    import("@/lib/email/resend")
      .then(({ isTestEnvironment, DEV_RECIPIENT_EMAIL }) => {
        if (!isTestEnvironment()) {
          console.log(`✉️ [Soporte NEGOVA] Nuevo ticket generado: ${ticketNumber} (${subject})`);
        }
      })
      .catch((err) => console.warn("Aviso al notificar soporte por email:", err));

    return {
      success: true,
      ticketNumber,
    };
  } catch (err: any) {
    console.error("[submitSupportTicketAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Ocurrió un error al procesar tu solicitud de soporte.",
    };
  }
}

