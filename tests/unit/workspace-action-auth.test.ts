import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyWorkspaceAction } from "../../src/lib/auth/workspace-context";
import { hasPermission } from "../../src/lib/auth/authorization";

// Mock de Supabase Client para sesión de usuario
vi.mock("../../src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-owner-123", email: "owner@negova.com" } },
        error: null,
      }),
    },
  })),
}));

// Mock de Supabase Admin Client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "businesses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => ({
              maybeSingle: vi.fn().mockImplementation(async () => {
                if (val === "b8e2612f-4acc-4c84-a420-220131b70d77") {
                  return {
                    data: {
                      id: "b8e2612f-4acc-4c84-a420-220131b70d77",
                      name: "Barbería Style",
                      status: "active",
                      business_type: "barbershop",
                    },
                    error: null,
                  };
                }
                if (val === "a8e2612f-4acc-4c84-a420-220131b70d66") {
                  return {
                    data: {
                      id: "a8e2612f-4acc-4c84-a420-220131b70d66",
                      name: "Burger Fast Food",
                      status: "active",
                      business_type: "fast_food_restaurant",
                    },
                    error: null,
                  };
                }
                if (val === "c8e2612f-4acc-4c84-a420-220131b70d88") {
                  return {
                    data: {
                      id: "c8e2612f-4acc-4c84-a420-220131b70d88",
                      name: "Comercio Suspendido",
                      status: "suspended",
                      business_type: "retail",
                    },
                    error: null,
                  };
                }
                if (val === "d8e2612f-4acc-4c84-a420-220131b70d99") {
                  return {
                    data: {
                      id: "d8e2612f-4acc-4c84-a420-220131b70d99",
                      name: "Otro Comercio No Asignado",
                      status: "active",
                      business_type: "restaurant",
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              }),
            })),
          }),
        };
      }

      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "user-owner-123", platform_role: "customer", status: "active" },
                error: null,
              }),
            })),
          }),
        };
      }

      if (table === "business_users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col1: string, val1: string) => ({
              eq: vi.fn().mockImplementation((col2: string, val2: string) => ({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  // Membresía activa para el restaurante y la barbería
                  if (
                    (val1 === "a8e2612f-4acc-4c84-a420-220131b70d66" ||
                      val1 === "b8e2612f-4acc-4c84-a420-220131b70d77") &&
                    val2 === "user-owner-123"
                  ) {
                    return {
                      data: {
                        id: "bu-owner-1",
                        status: "active",
                        role_id: "role-owner-id",
                        roles: { id: "role-owner-id", code: "owner", name: "Dueño / Propietario" },
                      },
                      error: null,
                    };
                  }
                  return { data: null, error: null };
                }),
              })),
            })),
          }),
        };
      }

      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "sub-1",
                      status: "active",
                      current_period_end: new Date(Date.now() + 86400000).toISOString(),
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  })),
}));

describe("Workspace Action Authorization & Vertical Enforcement", () => {
  const restaurantId = "a8e2612f-4acc-4c84-a420-220131b70d66";
  const barbershopId = "b8e2612f-4acc-4c84-a420-220131b70d77";
  const suspendedId = "c8e2612f-4acc-4c84-a420-220131b70d88";
  const unassignedId = "d8e2612f-4acc-4c84-a420-220131b70d99";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Bloqueo Vertical Estricto en Servidor para Owner", () => {
    it("debe RECHAZAR que un owner de barbería ejecute una acción gastronómica (orders.create)", async () => {
      const auth = await verifyWorkspaceAction(barbershopId, "orders.create");

      expect(auth.success).toBe(false);
      expect(auth.error).toBe("Operación no disponible o incompatible con el tipo de negocio del comercio.");
    });

    it("debe RECHAZAR en hasPermission que un owner de barbería tenga permiso gastronómico (orders.view)", async () => {
      const allowed = await hasPermission("user-owner-123", "orders.view", {
        scope: "business",
        businessId: barbershopId,
      });

      expect(allowed).toBe(false);
    });

    it("debe PERMITIR que un owner de restaurante ejecute acciones gastronómicas (orders.create)", async () => {
      const auth = await verifyWorkspaceAction(restaurantId, "orders.create");

      expect(auth.success).toBe(true);
      expect(auth.context).toBeDefined();
      expect(auth.context?.isOwner).toBe(true);
      expect(auth.context?.businessType).toBe("fast_food_restaurant");
    });

    it("debe PERMITIR operaciones universales en ambos tipos de negocio para owner", async () => {
      const restaurantAuth = await verifyWorkspaceAction(restaurantId, "sales.create");
      expect(restaurantAuth.success).toBe(true);

      const barbershopAuth = await verifyWorkspaceAction(barbershopId, "sales.create");
      expect(barbershopAuth.success).toBe(true);
    });
  });

  describe("2. Acciones Transversales (Soporte, Perfil, Notificaciones)", () => {
    it("debe autorizar acciones con permiso 'none' validando únicamente sesión y membresía activa", async () => {
      const profileAuth = await verifyWorkspaceAction(restaurantId, "none");

      expect(profileAuth.success).toBe(true);
      expect(profileAuth.context?.userId).toBe("user-owner-123");
      expect(profileAuth.context?.businessId).toBe(restaurantId);
    });
  });

  describe("3. Aislamiento Multi-Tenant y Estados de Negocio", () => {
    it("debe RECHAZAR acceso si el usuario no tiene membresía en el negocio solicitado", async () => {
      const auth = await verifyWorkspaceAction(unassignedId, "sales.view");

      expect(auth.success).toBe(false);
      expect(auth.error).toContain("Acceso denegado");
    });

    it("debe RECHAZAR acceso si el negocio se encuentra suspendido", async () => {
      const auth = await verifyWorkspaceAction(suspendedId, "sales.view");

      expect(auth.success).toBe(false);
      expect(auth.error).toBe("El comercio se encuentra inactivo o suspendido.");
    });

    it("debe RECHAZAR llamadas con identificadores UUID inválidos", async () => {
      const auth = await verifyWorkspaceAction("not-a-valid-uuid", "sales.create");

      expect(auth.success).toBe(false);
      expect(auth.error).toBe("Identificador de negocio inválido.");
    });
  });
});
