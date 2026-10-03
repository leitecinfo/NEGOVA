import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createNotification,
  getNotifications,
  getPlatformNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  _resetNotificationsStoreForTesting,
} from "../../src/lib/notifications/notifications-service";

describe("NEGOVA Universal Notification Architecture (Scope & Audience)", () => {
  beforeEach(() => {
    _resetNotificationsStoreForTesting([]);
  });

  describe("1. Scope Isolation (platform vs business)", () => {
    it("debe aislar estrictamente las notificaciones de plataforma y de negocio", async () => {
      // 1. Notificación interna de plataforma
      await createNotification({
        scope: "platform",
        audience: "global",
        type: "support_interaction",
        title: "Nueva Atención: ATN-0001",
        message: "Comercio Comida Rapida AA contactó por WhatsApp",
        href: "/admin/soporte",
      });

      // 2. Notificación operativa de un negocio A
      await createNotification({
        scope: "business",
        audience: "global",
        businessId: "biz-1111",
        type: "system",
        title: "Nuevo Pedido",
        message: "Pedido #102 recibido en Comida Rapida AA",
      });

      // 3. Notificación operativa de un negocio B
      await createNotification({
        scope: "business",
        audience: "global",
        businessId: "biz-2222",
        type: "system",
        title: "Nuevo Pedido",
        message: "Pedido #205 recibido en Panadería El Trigo",
      });

      // Consulta de plataforma (Admin): Solo debe retornar la de plataforma
      const platformNotifs = await getPlatformNotifications();
      expect(platformNotifs).toHaveLength(1);
      expect(platformNotifs[0].scope).toBe("platform");
      expect(platformNotifs[0].title).toContain("ATN-0001");

      // Consulta del Workspace del negocio A: Solo debe retornar la del negocio A
      const bizANotifs = await getNotifications({
        scope: "business",
        businessId: "biz-1111",
      });
      expect(bizANotifs).toHaveLength(1);
      expect(bizANotifs[0].scope).toBe("business");
      expect(bizANotifs[0].businessId).toBe("biz-1111");

      // Consulta de negocio sin businessId debe retornar vacío por seguridad
      const emptyBizNotifs = await getNotifications({
        scope: "business",
      });
      expect(emptyBizNotifs).toHaveLength(0);
    });
  });

  describe("2. Audience Resolution (global vs user)", () => {
    const AGENT_A_ID = "agent-user-aaa";
    const AGENT_B_ID = "agent-user-bbb";

    it("debe entregar notificaciones globales a todos los usuarios del ámbito", async () => {
      await createNotification({
        scope: "platform",
        audience: "global",
        type: "support_ticket",
        title: "Nuevo Ticket: TCK-0001",
        message: "Comercio reportó error en ventas",
        href: "/admin/soporte",
      });

      // Debe ser visible para el Agente A
      const forAgentA = await getNotifications({
        scope: "platform",
        currentUserId: AGENT_A_ID,
      });
      expect(forAgentA).toHaveLength(1);

      // Debe ser visible para el Agente B
      const forAgentB = await getNotifications({
        scope: "platform",
        currentUserId: AGENT_B_ID,
      });
      expect(forAgentB).toHaveLength(1);
    });

    it("debe entregar notificaciones dirigidas (user) exclusivamente al destinatario asignado", async () => {
      // Notificación dirigida específicamente a Agente A
      await createNotification({
        scope: "platform",
        audience: "user",
        recipientUserId: AGENT_A_ID,
        type: "ticket_assigned",
        title: "Ticket asignado a ti: TCK-0002",
        message: "El ticket TCK-0002 te ha sido asignado",
        href: "/admin/soporte",
      });

      // Agente A debe verla
      const forAgentA = await getNotifications({
        scope: "platform",
        currentUserId: AGENT_A_ID,
      });
      expect(forAgentA).toHaveLength(1);
      expect(forAgentA[0].recipientUserId).toBe(AGENT_A_ID);
      expect(forAgentA[0].type).toBe("ticket_assigned");

      // Agente B NO debe verla
      const forAgentB = await getNotifications({
        scope: "platform",
        currentUserId: AGENT_B_ID,
      });
      expect(forAgentB).toHaveLength(0);
    });
  });

  describe("3. Lectura y Marcado de Notificaciones", () => {
    it("debe marcar notificaciones como leídas individualmente y en lote", async () => {
      const notif1 = await createNotification({
        scope: "platform",
        audience: "global",
        type: "support_interaction",
        title: "Atención 1",
        message: "Test 1",
      });

      const notif2 = await createNotification({
        scope: "platform",
        audience: "global",
        type: "support_interaction",
        title: "Atención 2",
        message: "Test 2",
      });

      expect(notif1.read).toBe(false);
      expect(notif2.read).toBe(false);

      // Marcar una como leída
      await markNotificationAsRead(notif1.id);

      const unreadList = await getNotifications({
        scope: "platform",
        unreadOnly: true,
      });
      expect(unreadList).toHaveLength(1);
      expect(unreadList[0].id).toBe(notif2.id);

      // Marcar todas como leídas
      await markAllNotificationsAsRead({ scope: "platform" });

      const allUnread = await getNotifications({
        scope: "platform",
        unreadOnly: true,
      });
      expect(allUnread).toHaveLength(0);
    });
  });
});
