import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getWorkspaceTicketsAction,
  getWorkspaceTicketDetailAction,
  createWorkspaceTicketAction,
  sendWorkspaceTicketMessageAction,
} from "@/app/workspace/[businessId]/soporte/actions";
import * as workspaceContext from "@/lib/auth/workspace-context";
import * as supportService from "@/lib/support/support-service";
import { SupportTicket } from "@/lib/support/types";

describe("Workspace Soporte Flow & Multi-Tenant Security", () => {
  const targetBusinessId = "biz-acme-123";
  const otherBusinessId = "biz-other-999";
  const userId = "user-test-456";

  const mockActiveSession: workspaceContext.WorkspaceUserContext = {
    userId,
    userEmail: "owner@acme.com",
    businessId: targetBusinessId,
    businessName: "ACME Corp",
    businessStatus: "active",
    businessSlug: "acme-corp",
    roleCode: "owner",
    roleName: "Dueño / Propietario",
    isOwner: true,
    isSuperAdmin: false,
  };

  const sampleTicket: SupportTicket = {
    id: "tck-001",
    ticketNumber: "TCK-0001",
    businessId: targetBusinessId,
    businessName: "ACME Corp",
    businessSlug: "acme-corp",
    contactName: "owner",
    contactEmail: "owner@acme.com",
    contactPhone: null,
    originChannel: "in_app_chat",
    interactionId: null,
    interactionNumber: null,
    category: "technical",
    priority: "high",
    status: "open",
    subject: "Error al emitir comprobante fiscal",
    description: "Al intentar guardar la venta 1024 se presenta una demora inusual.",
    assignedAgentId: null,
    assignedAgentName: null,
    internalNotes: null,
    clientResolution: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    closedAt: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Consulta de Solicitudes (Multi-Tenant)", () => {
    it("debe listar únicamente las solicitudes pertenecientes al negocio activo", async () => {
      vi.spyOn(workspaceContext, "requireWorkspaceSession").mockResolvedValue(mockActiveSession);
      vi.spyOn(supportService, "getBusinessSupportTickets").mockResolvedValue([sampleTicket]);

      const res = await getWorkspaceTicketsAction(targetBusinessId);

      expect(res.success).toBe(true);
      expect(res.tickets.length).toBe(1);
      expect(res.tickets[0].id).toBe("tck-001");
      expect(res.tickets[0].businessId).toBe(targetBusinessId);
      expect(supportService.getBusinessSupportTickets).toHaveBeenCalledWith(targetBusinessId, {});
    });

    it("debe rechazar solicitudes si el usuario no tiene membresía en el negocio", async () => {
      vi.spyOn(workspaceContext, "requireWorkspaceSession").mockRejectedValue(
        new Error("Acceso denegado: membresía no activa en este comercio.")
      );

      const res = await getWorkspaceTicketsAction(targetBusinessId);

      expect(res.success).toBe(false);
      expect(res.tickets).toEqual([]);
      expect(res.error).toContain("Acceso denegado");
    });
  });

  describe("2. Creación de Solicitudes", () => {
    it("debe validar campos obligatorios antes de crear el ticket", async () => {
      vi.spyOn(workspaceContext, "requireWorkspaceSession").mockResolvedValue(mockActiveSession);

      const resEmptySubject = await createWorkspaceTicketAction(targetBusinessId, {
        subject: "",
        description: "Detalle del problema",
        category: "technical",
      });
      expect(resEmptySubject.success).toBe(false);
      expect(resEmptySubject.error).toContain("asunto");

      const resEmptyDesc = await createWorkspaceTicketAction(targetBusinessId, {
        subject: "Consulta",
        description: "   ",
        category: "general",
      });
      expect(resEmptyDesc.success).toBe(false);
      expect(resEmptyDesc.error).toContain("descripción");
    });

    it("debe crear la solicitud formal asociando el businessId del contexto autenticado", async () => {
      vi.spyOn(workspaceContext, "requireWorkspaceSession").mockResolvedValue(mockActiveSession);
      vi.spyOn(supportService, "createSupportTicket").mockResolvedValue({
        success: true,
        ticket: sampleTicket,
      });

      const res = await createWorkspaceTicketAction(targetBusinessId, {
        subject: "Error al emitir comprobante fiscal",
        description: "Al intentar guardar la venta 1024 se presenta una demora inusual.",
        category: "technical",
        priority: "high",
      });

      expect(res.success).toBe(true);
      expect(res.ticket).toBeDefined();
      expect(res.ticket?.ticketNumber).toBe("TCK-0001");
      expect(supportService.createSupportTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: targetBusinessId,
          businessName: "ACME Corp",
          category: "technical",
          priority: "high",
          subject: "Error al emitir comprobante fiscal",
        })
      );
    });
  });

  describe("3. Detalle y Protección Cruzada Multi-Tenant", () => {
    it("debe obtener el detalle del ticket y sus mensajes cuando pertenece al negocio", async () => {
      vi.spyOn(workspaceContext, "requireWorkspaceSession").mockResolvedValue(mockActiveSession);
      vi.spyOn(supportService, "getBusinessSupportTicketById").mockResolvedValue(sampleTicket);
      vi.spyOn(supportService, "getTicketMessages").mockResolvedValue([
        {
          id: "msg-1",
          senderRole: "client",
          senderName: "owner",
          content: "Hola, sigo a la espera.",
          createdAt: new Date().toISOString(),
        },
      ]);

      const res = await getWorkspaceTicketDetailAction(targetBusinessId, "tck-001");

      expect(res.success).toBe(true);
      expect(res.ticket?.id).toBe("tck-001");
      expect(res.messages?.length).toBe(1);
    });

    it("debe denegar y retornar error si se intenta consultar un ticket que no pertenece al negocio", async () => {
      vi.spyOn(workspaceContext, "requireWorkspaceSession").mockResolvedValue(mockActiveSession);
      vi.spyOn(supportService, "getBusinessSupportTicketById").mockResolvedValue(null);

      const res = await getWorkspaceTicketDetailAction(targetBusinessId, "tck-other-biz");

      expect(res.success).toBe(false);
      expect(res.error).toContain("no encontrada o no pertenece");
    });
  });

  describe("4. Seguimiento y Mensajería", () => {
    it("debe permitir enviar mensajes de seguimiento en tickets abiertos", async () => {
      vi.spyOn(workspaceContext, "requireWorkspaceSession").mockResolvedValue(mockActiveSession);
      vi.spyOn(supportService, "addTicketMessage").mockResolvedValue({
        success: true,
        messageId: "msg-new-123",
      });

      const res = await sendWorkspaceTicketMessageAction(
        targetBusinessId,
        "tck-001",
        "Adjunto información complementaria de la caja."
      );

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("msg-new-123");
      expect(supportService.addTicketMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: targetBusinessId,
          ticketId: "tck-001",
          senderRole: "client",
          content: "Adjunto información complementaria de la caja.",
        })
      );
    });

    it("debe rechazar mensajes vacíos", async () => {
      vi.spyOn(workspaceContext, "requireWorkspaceSession").mockResolvedValue(mockActiveSession);

      const res = await sendWorkspaceTicketMessageAction(targetBusinessId, "tck-001", "   ");

      expect(res.success).toBe(false);
      expect(res.error).toContain("vacío");
    });
  });
});
