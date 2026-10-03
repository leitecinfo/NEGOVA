import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSupportDashboardData,
  createSupportInteraction,
  createSupportTicket,
  escalateInteractionToTicket,
  updateSupportTicket,
  _resetSupportStoreForTesting,
} from "../../src/lib/support/support-service";

// Mock de Supabase para pruebas unitarias deterministas
const mockSettingsStorage: Record<string, any> = {};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => ({
      select: () => ({
        eq: (_key: string, val: string) => ({
          maybeSingle: async () => ({
            data: mockSettingsStorage[val] ? { value: mockSettingsStorage[val] } : null,
            error: null,
          }),
        }),
      }),
      upsert: async (record: any) => {
        mockSettingsStorage[record.key] = record.value;
        return { data: record, error: null };
      },
      insert: async () => ({ data: null, error: null }),
    }),
  }),
}));

describe("NEGOVA Support System (Phase 1): Interactions, Tickets & Workflow", () => {
  const TEST_BIZ = {
    id: "biz-1111-2222",
    name: "Comida Rapida AA",
    slug: "comida-rapida-aa",
    contactName: "Eva Maria Lopez",
    contactPhone: "3001234567",
    contactEmail: "eva@comidarapida.co",
  };

  const AGENT = {
    id: "user-admin-01",
    name: "Administrador NEGOVA",
  };

  beforeEach(async () => {
    // Limpiar almacenamiento antes de cada prueba
    for (const k in mockSettingsStorage) {
      delete mockSettingsStorage[k];
    }
    await _resetSupportStoreForTesting({ interactions: [], tickets: [] });
  });

  describe("1. Atención Rápida (SupportInteraction - ATN)", () => {
    it("debe registrar una atención rápida resuelta de inmediato sin generar ticket", async () => {
      const res = await createSupportInteraction({
        businessId: TEST_BIZ.id,
        businessName: TEST_BIZ.name,
        businessSlug: TEST_BIZ.slug,
        contactName: TEST_BIZ.contactName,
        contactPhone: TEST_BIZ.contactPhone,
        channel: "whatsapp",
        category: "usage_inquiry",
        subject: "Consulta sobre cambio de clave",
        summary: "El cliente preguntó cómo cambiar su contraseña. Se le indicó la ruta en Mi Perfil.",
        outcome: "resolved_immediately",
        agentId: AGENT.id,
        agentName: AGENT.name,
      });

      expect(res.success).toBe(true);
      expect(res.interaction).toBeDefined();
      expect(res.interaction?.interactionNumber).toMatch(/^ATN-\d{4}$/);
      expect(res.interaction?.channel).toBe("whatsapp");
      expect(res.interaction?.outcome).toBe("resolved_immediately");
      expect(res.interaction?.ticketId).toBeNull();
      expect(res.ticket).toBeUndefined();

      // Verificar en dashboard
      const dashboard = await getSupportDashboardData();
      expect(dashboard.interactionsTotalCount).toBe(1);
      expect(dashboard.ticketsTotalCount).toBe(0);
      expect(dashboard.stats.totalInteractions).toBe(1);
      expect(dashboard.stats.resolvedImmediatelyCount).toBe(1);
      expect(dashboard.stats.totalTickets).toBe(0);
    });

    it("debe registrar una atención y generar automáticamente un ticket si se marca como escalamiento", async () => {
      const res = await createSupportInteraction({
        businessId: TEST_BIZ.id,
        businessName: TEST_BIZ.name,
        businessSlug: TEST_BIZ.slug,
        contactName: TEST_BIZ.contactName,
        contactPhone: TEST_BIZ.contactPhone,
        channel: "whatsapp",
        category: "technical",
        subject: "No puede registrar ventas",
        summary: "El propietario indicó por WhatsApp que la pantalla de venta no responde al confirmar.",
        outcome: "escalated_to_ticket",
        createLinkedTicket: true,
        ticketPriority: "high",
        agentId: AGENT.id,
        agentName: AGENT.name,
      });

      expect(res.success).toBe(true);
      expect(res.interaction).toBeDefined();
      expect(res.ticket).toBeDefined();

      // Validación de vinculación bidireccional
      expect(res.interaction?.outcome).toBe("escalated_to_ticket");
      expect(res.interaction?.ticketId).toBe(res.ticket?.id);
      expect(res.interaction?.ticketNumber).toBe(res.ticket?.ticketNumber);

      expect(res.ticket?.interactionId).toBe(res.interaction?.id);
      expect(res.ticket?.interactionNumber).toBe(res.interaction?.interactionNumber);
      expect(res.ticket?.originChannel).toBe("whatsapp");
      expect(res.ticket?.priority).toBe("high");
      expect(res.ticket?.status).toBe("open");

      // Verificar en dashboard
      const dashboard = await getSupportDashboardData();
      expect(dashboard.interactionsTotalCount).toBe(1);
      expect(dashboard.ticketsTotalCount).toBe(1);
      expect(dashboard.stats.openTickets).toBe(1);
    });
  });

  describe("2. Creación Directa y Gestión de Tickets (SupportTicket - TCK)", () => {
    it("debe crear un ticket formal directamente sin requerir una atención previa", async () => {
      const res = await createSupportTicket({
        businessId: TEST_BIZ.id,
        businessName: TEST_BIZ.name,
        businessSlug: TEST_BIZ.slug,
        contactName: TEST_BIZ.contactName,
        contactEmail: TEST_BIZ.contactEmail,
        contactPhone: TEST_BIZ.contactPhone,
        originChannel: "phone",
        category: "billing",
        priority: "urgent",
        subject: "Error en comprobante de pago anual",
        description: "El comercio pagó anualidad pero la vigencia sigue marcando mensual.",
        internalNotes: "Revisar logs de auditoría en la tabla de facturación.",
        adminUserId: AGENT.id,
      });

      expect(res.success).toBe(true);
      expect(res.ticket).toBeDefined();
      expect(res.ticket?.ticketNumber).toMatch(/^TCK-\d{4}$/);
      expect(res.ticket?.interactionId).toBeNull();
      expect(res.ticket?.originChannel).toBe("phone");
      expect(res.ticket?.priority).toBe("urgent");
      expect(res.ticket?.internalNotes).toContain("Revisar logs");

      const dashboard = await getSupportDashboardData();
      expect(dashboard.ticketsTotalCount).toBe(1);
      expect(dashboard.stats.urgentTickets).toBe(1);
    });

    it("debe permitir escalar una atención existente a un nuevo ticket formal", async () => {
      // 1. Crear atención inicial
      const atnRes = await createSupportInteraction({
        businessId: TEST_BIZ.id,
        businessName: TEST_BIZ.name,
        businessSlug: TEST_BIZ.slug,
        contactName: TEST_BIZ.contactName,
        channel: "email",
        category: "account",
        subject: "Solicitud de reactivación de colaborador",
        summary: "El dueño pide reactivar al cajero 2 que fue suspendido por error.",
        outcome: "information_provided",
        agentId: AGENT.id,
        agentName: AGENT.name,
      });

      expect(atnRes.interaction?.ticketId).toBeNull();

      // 2. Escalar a ticket posteriormente
      const escRes = await escalateInteractionToTicket(atnRes.interaction!.id, {
        priority: "medium",
        description: "Reactivar cajero 2 y regenerar contraseña temporal.",
        adminUserId: AGENT.id,
        agentName: AGENT.name,
      });

      expect(escRes.success).toBe(true);
      expect(escRes.ticket).toBeDefined();
      expect(escRes.ticket?.interactionId).toBe(atnRes.interaction?.id);
      expect(escRes.interaction?.outcome).toBe("escalated_to_ticket");
      expect(escRes.interaction?.ticketId).toBe(escRes.ticket?.id);
    });

    it("debe separar estrictamente notas internas de la respuesta al cliente y gestionar estados", async () => {
      const createRes = await createSupportTicket({
        businessId: TEST_BIZ.id,
        businessName: TEST_BIZ.name,
        businessSlug: TEST_BIZ.slug,
        contactName: TEST_BIZ.contactName,
        category: "technical",
        priority: "medium",
        subject: "Falla intermitente en reportes",
        description: "Al exportar a PDF el reporte de ventas sale vacío.",
      });

      const ticketId = createRes.ticket!.id;

      // Actualizar a estado resuelto con notas internas y respuesta al cliente
      const updateRes = await updateSupportTicket(ticketId, {
        status: "resolved",
        internalNotes: "Bug en parser de fechas corregido en producción. Revisar commit #4910.",
        clientResolution: "El reporte de ventas ha sido actualizado y ya puedes exportar tus PDFs normalmente.",
        adminUserId: AGENT.id,
      });

      expect(updateRes.success).toBe(true);
      expect(updateRes.ticket?.status).toBe("resolved");
      expect(updateRes.ticket?.resolvedAt).not.toBeNull();
      expect(updateRes.ticket?.internalNotes).toContain("Bug en parser");
      expect(updateRes.ticket?.clientResolution).toContain("El reporte de ventas ha sido actualizado");
    });
  });

  describe("3. Filtros, Búsqueda y Canales", () => {
    it("debe filtrar correctamente atenciones y tickets por canal de origen", async () => {
      // 1 Atención por WhatsApp
      await createSupportInteraction({
        businessId: TEST_BIZ.id,
        businessName: TEST_BIZ.name,
        businessSlug: TEST_BIZ.slug,
        contactName: TEST_BIZ.contactName,
        channel: "whatsapp",
        category: "usage_inquiry",
        subject: "Consulta WhatsApp",
        summary: "Duda rápida WhatsApp",
        agentId: AGENT.id,
        agentName: AGENT.name,
      });

      // 1 Atención por Llamada
      await createSupportInteraction({
        businessId: TEST_BIZ.id,
        businessName: TEST_BIZ.name,
        businessSlug: TEST_BIZ.slug,
        contactName: TEST_BIZ.contactName,
        channel: "phone",
        category: "technical",
        subject: "Consulta Llamada",
        summary: "Duda rápida Llamada",
        agentId: AGENT.id,
        agentName: AGENT.name,
      });

      const all = await getSupportDashboardData();
      expect(all.interactionsTotalCount).toBe(2);

      const onlyWhatsApp = await getSupportDashboardData({ channel: "whatsapp" });
      expect(onlyWhatsApp.interactionsTotalCount).toBe(1);
      expect(onlyWhatsApp.interactions[0].channel).toBe("whatsapp");

      const onlyPhone = await getSupportDashboardData({ channel: "phone" });
      expect(onlyPhone.interactionsTotalCount).toBe(1);
      expect(onlyPhone.interactions[0].channel).toBe("phone");
    });

    it("debe buscar por texto en número, comercio, asunto o contacto", async () => {
      await createSupportInteraction({
        businessId: TEST_BIZ.id,
        businessName: "Panadería El Trigo",
        businessSlug: "panaderia-el-trigo",
        contactName: "Carlos Gómez",
        channel: "whatsapp",
        category: "general",
        subject: "Horario de atención soporte",
        summary: "Preguntó por horarios de atención.",
        agentId: AGENT.id,
        agentName: AGENT.name,
      });

      const searchRes = await getSupportDashboardData({ search: "Panadería" });
      expect(searchRes.interactionsTotalCount).toBe(1);
      expect(searchRes.interactions[0].businessName).toBe("Panadería El Trigo");

      const notFound = await getSupportDashboardData({ search: "Inexistente" });
      expect(notFound.interactionsTotalCount).toBe(0);
    });
  });
});
