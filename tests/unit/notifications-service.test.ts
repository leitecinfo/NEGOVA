import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createNotification,
  getNotifications,
  getPlatformNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../../src/lib/notifications/notifications-service";

// Almacenamiento en memoria para pruebas deterministas sin escribir en DB remota
let inMemoryNotifications: Array<{
  id: string;
  scope: string;
  audience: string;
  recipient_user_id: string | null;
  business_id: string | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
}> = [];

let shouldThrowQueryError = false;

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "platform_notifications") {
        return {
          insert: vi.fn(async (payload: any) => {
            if (shouldThrowQueryError) {
              return { data: null, error: { message: "Database connection failed" } };
            }
            inMemoryNotifications.push({ ...payload });
            return { data: payload, error: null };
          }),
          select: vi.fn(() => {
            let filtered = [...inMemoryNotifications];
            const builder = {
              eq: vi.fn((col: string, val: any) => {
                filtered = filtered.filter((row: any) => row[col] === val);
                return builder;
              }),
              or: vi.fn((orCondition: string) => {
                // Parse simple audience OR condition
                const userMatch = orCondition.match(/recipient_user_id\.eq\.([a-f0-9-]+)/i);
                const targetUserId = userMatch ? userMatch[1] : null;
                filtered = filtered.filter((row: any) => {
                  if (row.audience === "global") return true;
                  if (row.audience === "user" && targetUserId && row.recipient_user_id === targetUserId) return true;
                  return false;
                });
                return builder;
              }),
              order: vi.fn(() => builder),
              limit: vi.fn((lim: number) => {
                filtered = filtered.slice(0, lim);
                return builder;
              }),
              then: (resolve: any) => {
                if (shouldThrowQueryError) {
                  return resolve({ data: null, error: { message: "Database query failed" } });
                }
                return resolve({ data: filtered, error: null });
              },
            };
            return builder;
          }),
          update: vi.fn((updates: any) => {
            let targets = [...inMemoryNotifications];
            const updateBuilder = {
              eq: vi.fn((col: string, val: any) => {
                targets = targets.filter((row: any) => row[col] === val);
                return updateBuilder;
              }),
              or: vi.fn((orCondition: string) => {
                const userMatch = orCondition.match(/recipient_user_id\.eq\.([a-f0-9-]+)/i);
                const targetUserId = userMatch ? userMatch[1] : null;
                targets = targets.filter((row: any) => {
                  if (row.audience === "global") return true;
                  if (row.audience === "user" && targetUserId && row.recipient_user_id === targetUserId) return true;
                  return false;
                });
                return updateBuilder;
              }),
              select: vi.fn(() => ({
                then: (resolve: any) => {
                  if (shouldThrowQueryError) {
                    return resolve({ data: null, error: { message: "Update failed" } });
                  }
                  targets.forEach((t) => Object.assign(t, updates));
                  return resolve({ data: targets, error: null });
                },
              })),
              then: (resolve: any) => {
                if (shouldThrowQueryError) {
                  return resolve({ data: null, error: { message: "Update failed" } });
                }
                targets.forEach((t) => Object.assign(t, updates));
                return resolve({ data: targets, error: null });
              },
            };
            return updateBuilder;
          }),
        };
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })) };
    }),
  })),
}));

describe("NEGOVA Universal Notification Architecture (Scope & Audience)", () => {
  const REAL_BUSINESS_ID = "a8e2612f-4acc-4c84-a420-220131b70d66";

  beforeEach(() => {
    inMemoryNotifications = [];
    shouldThrowQueryError = false;
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
        businessId: REAL_BUSINESS_ID,
        type: "system",
        title: "Nuevo Pedido",
        message: "Pedido #102 recibido en Comida Rapida AA",
      });

      // Consulta de plataforma (Admin): Solo debe retornar la de plataforma
      const platformNotifs = await getPlatformNotifications();
      expect(platformNotifs.some((n) => n.title.includes("ATN-0001"))).toBe(true);
      expect(platformNotifs.some((n) => n.scope === "business")).toBe(false);

      // Consulta del Workspace del negocio A: Solo debe retornar la del negocio A
      const bizANotifs = await getNotifications({
        scope: "business",
        businessId: REAL_BUSINESS_ID,
      });
      expect(bizANotifs.some((n) => n.title === "Nuevo Pedido" && n.message.includes("Comida Rapida AA"))).toBe(true);
      expect(bizANotifs.every((n) => n.scope === "business" && n.businessId === REAL_BUSINESS_ID)).toBe(true);

      // Consulta de negocio sin businessId debe retornar vacío por seguridad
      const emptyBizNotifs = await getNotifications({
        scope: "business",
      });
      expect(emptyBizNotifs).toHaveLength(0);
    });
  });

  describe("2. Audience Resolution (global vs user)", () => {
    const AGENT_A_ID = "7bfdea13-6a76-4011-a699-7582c6bad4e5";
    const AGENT_B_ID = "00000000-0000-0000-0000-000000000002";

    it("debe entregar notificaciones globales a todos los usuarios del ámbito", async () => {
      const globalTicket = await createNotification({
        scope: "platform",
        audience: "global",
        type: "support_ticket",
        title: "Nuevo Ticket: TCK-101",
        message: "Comercio reportó error en ventas",
        href: "/admin/soporte",
      });

      // Debe ser visible para el Agente A
      const forAgentA = await getNotifications({
        scope: "platform",
        currentUserId: AGENT_A_ID,
      });
      expect(forAgentA.some((n) => n.id === globalTicket.id)).toBe(true);

      // Debe ser visible para el Agente B
      const forAgentB = await getNotifications({
        scope: "platform",
        currentUserId: AGENT_B_ID,
      });
      expect(forAgentB.some((n) => n.id === globalTicket.id)).toBe(true);
    });

    it("debe entregar notificaciones dirigidas (user) exclusivamente al destinatario asignado", async () => {
      // Notificación dirigida específicamente a Agente A
      const targetedTicket = await createNotification({
        scope: "platform",
        audience: "user",
        recipientUserId: AGENT_A_ID,
        type: "ticket_assigned",
        title: "Ticket asignado a ti: TCK-102",
        message: "El ticket te ha sido asignado",
        href: "/admin/soporte",
      });

      // Agente A debe verla
      const forAgentA = await getNotifications({
        scope: "platform",
        currentUserId: AGENT_A_ID,
      });
      expect(forAgentA.some((n) => n.id === targetedTicket.id)).toBe(true);

      // Agente B NO debe verla
      const forAgentB = await getNotifications({
        scope: "platform",
        currentUserId: AGENT_B_ID,
      });
      expect(forAgentB.some((n) => n.id === targetedTicket.id)).toBe(false);
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
      const marked = await markNotificationAsRead(notif1.id, { scope: "platform" });
      expect(marked).toBe(true);

      const unreadList = await getNotifications({
        scope: "platform",
        unreadOnly: true,
      });
      expect(unreadList.some((n) => n.id === notif1.id)).toBe(false);
      expect(unreadList.some((n) => n.id === notif2.id)).toBe(true);

      // Marcar todas como leídas
      await markAllNotificationsAsRead({ scope: "platform" });

      const allUnread = await getNotifications({
        scope: "platform",
        unreadOnly: true,
      });
      expect(allUnread.some((n) => n.id === notif2.id)).toBe(false);
    });
  });

  describe("4. Manejo de Errores y Estados Vacíos Reales", () => {
    it("debe retornar array vacío cuando no hay notificaciones reales registradas", async () => {
      const list = await getNotifications({ scope: "platform" });
      expect(list).toHaveLength(0);
    });

    it("debe propagar el error cuando la consulta a la base de datos falla", async () => {
      shouldThrowQueryError = true;
      await expect(getNotifications({ scope: "platform" })).rejects.toThrow("Database query failed");
    });
  });
});
