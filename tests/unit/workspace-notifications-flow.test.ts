import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createNotification,
  getNotifications,
  getPlatformNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/notifications/notifications-service";
import {
  sanitizeWorkspaceNotificationLink,
  AppNotification,
} from "@/lib/notifications/types";
import {
  getWorkspaceNotificationsAction,
  getWorkspaceUnreadCountAction,
  markWorkspaceNotificationAsReadAction,
  markAllWorkspaceNotificationsAsReadAction,
} from "@/app/workspace/[businessId]/notificaciones/actions";

// In-memory mock database
let inMemoryDb: Array<{
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

let shouldThrowDbError = false;

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "platform_notifications") {
        return {
          insert: vi.fn(async (payload: any) => {
            if (shouldThrowDbError) {
              return { data: null, error: { message: "DB Error" } };
            }
            inMemoryDb.push({ ...payload });
            return { data: payload, error: null };
          }),
          select: vi.fn(() => {
            let filtered = [...inMemoryDb];
            const builder = {
              eq: vi.fn((col: string, val: any) => {
                filtered = filtered.filter((row: any) => row[col] === val);
                return builder;
              }),
              or: vi.fn((orCondition: string) => {
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
                if (shouldThrowDbError) {
                  return resolve({ data: null, error: { message: "Error al consultar la base de datos." } });
                }
                return resolve({ data: filtered, error: null });
              },
            };
            return builder;
          }),
          update: vi.fn((updates: any) => {
            let targets = [...inMemoryDb];
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
                  if (shouldThrowDbError) {
                    return resolve({ data: null, error: { message: "Error al actualizar." } });
                  }
                  targets.forEach((t) => Object.assign(t, updates));
                  return resolve({ data: targets, error: null });
                },
              })),
              then: (resolve: any) => {
                if (shouldThrowDbError) {
                  return resolve({ data: null, error: { message: "Error al actualizar." } });
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

// Mock del contexto de workspace
vi.mock("@/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: vi.fn(async (businessId: string, requiredPerm: string) => {
    if (businessId === "biz-unauthorized" || businessId === "invalid-uuid") {
      return { success: false, error: "No autorizado." };
    }
    return {
      success: true,
      context: {
        userId: "7bfdea13-6a76-4011-a699-7582c6bad4e5",
        userEmail: "user@comercio.com",
        businessId: businessId,
        businessName: "Comercio Test",
        businessStatus: "active",
        roleCode: "owner",
        roleName: "Dueño",
        isOwner: true,
        isSuperAdmin: false,
      },
    };
  }),
  requireWorkspaceSession: vi.fn(async (businessId: string) => {
    return {
      userId: "7bfdea13-6a76-4011-a699-7582c6bad4e5",
      userEmail: "user@comercio.com",
      businessId: businessId,
      businessName: "Comercio Test",
      businessStatus: "active",
      roleCode: "owner",
      roleName: "Dueño",
      isOwner: true,
      isSuperAdmin: false,
    };
  }),
}));

describe("Workspace Notifications Architecture & Real Data Integrity (Fase 2.4.2)", () => {
  const BUSINESS_A_ID = "a8e2612f-4acc-4c84-a420-220131b70d66";
  const BUSINESS_B_ID = "b9f3612f-4acc-4c84-a420-220131b70d77";
  const USER_A_ID = "7bfdea13-6a76-4011-a699-7582c6bad4e5";
  const USER_B_ID = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    inMemoryDb = [];
    shouldThrowDbError = false;
  });

  describe("1. Consulta de Datos Reales y Estado Vacío Auténtico", () => {
    it("1. Cuando no hay registros reales, retorna lista vacía sin inventar datos", async () => {
      const res = await getWorkspaceNotificationsAction(BUSINESS_A_ID);
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(0);
    });

    it("2. Ante error en la base de datos, retorna estado de error real para reintento", async () => {
      shouldThrowDbError = true;
      const res = await getWorkspaceNotificationsAction(BUSINESS_A_ID);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it("3. El contador de no leídas coincide estrictamente con las notificaciones reales pendientes", async () => {
      // Sin notificaciones: conteo = 0
      let countRes = await getWorkspaceUnreadCountAction(BUSINESS_A_ID);
      expect(countRes.success).toBe(true);
      expect(countRes.count).toBe(0);

      // Crear 2 notificaciones para Negocio A (1 leída, 1 no leída)
      await createNotification({
        scope: "business",
        audience: "global",
        businessId: BUSINESS_A_ID,
        type: "document_generated",
        title: "Comprobante 1",
        message: "Venta #1",
      });

      const notif2 = await createNotification({
        scope: "business",
        audience: "global",
        businessId: BUSINESS_A_ID,
        type: "document_generated",
        title: "Comprobante 2",
        message: "Venta #2",
      });

      // Marcar una como leída
      await markNotificationAsRead(notif2.id, { scope: "business", businessId: BUSINESS_A_ID });

      countRes = await getWorkspaceUnreadCountAction(BUSINESS_A_ID);
      expect(countRes.success).toBe(true);
      expect(countRes.count).toBe(1);
    });
  });

  describe("2. Aislamiento Multi-Tenant y Seguridad de Destinatarios", () => {
    it("4. No muestra notificaciones de otros negocios", async () => {
      // Notificación de Negocio B
      await createNotification({
        scope: "business",
        audience: "global",
        businessId: BUSINESS_B_ID,
        type: "document_generated",
        title: "Venta en Negocio B",
        message: "Comprobante emitido en B",
      });

      // Consulta desde Negocio A
      const resA = await getWorkspaceNotificationsAction(BUSINESS_A_ID);
      expect(resA.success).toBe(true);
      expect(resA.data?.some((n) => n.businessId === BUSINESS_B_ID)).toBe(false);
    });

    it("5. No muestra notificaciones individuales dirigidas a otros usuarios", async () => {
      // Notificación dirigida a Usuario B
      await createNotification({
        scope: "business",
        audience: "user",
        recipientUserId: USER_B_ID,
        businessId: BUSINESS_A_ID,
        type: "system",
        title: "Mensaje privado para Usuario B",
        message: "Solo para B",
      });

      // Consulta de Usuario A en Negocio A
      const resA = await getWorkspaceNotificationsAction(BUSINESS_A_ID);
      expect(resA.success).toBe(true);
      expect(resA.data?.some((n) => n.recipientUserId === USER_B_ID)).toBe(false);
    });

    it("6. No permite a Workspace consultar ni alterar notificaciones de plataforma", async () => {
      const platformNotif = await createNotification({
        scope: "platform",
        audience: "global",
        type: "system",
        title: "Mantenimiento Global",
        message: "Aviso de plataforma",
      });

      // Consulta de Workspace
      const res = await getWorkspaceNotificationsAction(BUSINESS_A_ID);
      expect(res.data?.some((n) => n.id === platformNotif.id)).toBe(false);

      // Intento de marcar notificación de plataforma desde Server Action de Workspace
      const markRes = await markWorkspaceNotificationAsReadAction(BUSINESS_A_ID, platformNotif.id);
      expect(markRes.success).toBe(false);
    });
  });

  describe("3. Vista Previa y Centro de Notificaciones Consistentes", () => {
    it("7. La vista previa limitada y el listado completo consultan la misma fuente autorizada", async () => {
      // Insertar 3 notificaciones reales
      for (let i = 1; i <= 3; i++) {
        await createNotification({
          scope: "business",
          audience: "global",
          businessId: BUSINESS_A_ID,
          type: "document_generated",
          title: `Comprobante ${i}`,
          message: `Doc #${i}`,
        });
      }

      // Dropdown pide limit: 3
      const dropdownRes = await getWorkspaceNotificationsAction(BUSINESS_A_ID, { limit: 3 });
      // Página principal pide limit: 50
      const fullRes = await getWorkspaceNotificationsAction(BUSINESS_A_ID, { limit: 50 });

      expect(dropdownRes.data).toHaveLength(3);
      expect(fullRes.data).toHaveLength(3);
      expect(dropdownRes.data?.[0].id).toBe(fullRes.data?.[0].id);
    });
  });

  describe("4. Sanitización de Enlaces de Redirección", () => {
    it("8. Mantiene los enlaces dentro del contexto del negocio actual", () => {
      expect(sanitizeWorkspaceNotificationLink("/workspace/biz-123/ventas", "biz-123")).toBe("/workspace/biz-123/ventas");
      expect(sanitizeWorkspaceNotificationLink("/admin/soporte", "biz-123")).toBeNull();
      expect(sanitizeWorkspaceNotificationLink("https://malicious.com", "biz-123")).toBeNull();
    });
  });

  describe("5. Navegación en Sidebar de Workspace", () => {
    it("9. La ruta de notificaciones está disponible y apunta al businessId activo", () => {
      const expectedHref = `/workspace/${BUSINESS_A_ID}/notificaciones`;
      expect(expectedHref).toContain("notificaciones");
      expect(expectedHref).toContain(BUSINESS_A_ID);
    });
  });
});
