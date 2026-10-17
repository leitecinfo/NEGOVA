import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BUSINESS_ROLES_CATALOG,
  PLATFORM_ROLES_CATALOG,
  DEFAULT_ROLE_PERMISSIONS_MAP,
  ALL_PERMISSION_MODULES,
} from "../../src/lib/auth/permissions";
import {
  getWorkspaceRolesAction,
  updateWorkspaceRoleAction,
} from "../../src/app/workspace/[businessId]/roles/actions";

// Mock de autorización
vi.mock("../../src/lib/auth/authorization", () => ({
  verifyUserPermission: vi.fn(async (perm: string, ctx: { businessId?: string }) => {
    if (ctx.businessId === "invalid-business-id" || ctx.businessId === "00000000-0000-0000-0000-000000000000") {
      throw new Error("Acceso denegado: membresía no activa en este comercio.");
    }
    return { userId: "user-123", userRole: "owner" };
  }),
}));

// Mock de Supabase Client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "business_users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (val === "a8e2612f-4acc-4c84-a420-220131b70d66") {
                return Promise.resolve({
                  data: [
                    { role_id: "role-owner-id", roles: { id: "role-owner-id", code: "owner", name: "Dueño" } },
                    { role_id: "role-aux-id", roles: { id: "role-aux-id", code: "auxiliar", name: "Auxiliar" } },
                    { role_id: "role-aux-id", roles: { id: "role-aux-id", code: "auxiliar", name: "Auxiliar" } },
                  ],
                  error: null,
                });
              }
              return Promise.resolve({ data: [], error: null });
            }),
          }),
        };
      }
      if (table === "roles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "0574c053-a73d-48f6-82a7-34c67a2a1f1d",
                    code: "owner",
                    name: "Dueño / Propietario",
                    description: "Máxima autoridad dentro del comercio.",
                    scope: "business",
                    type: "system",
                    is_system_role: true,
                    status: "active",
                    created_at: "2026-08-27T04:16:49Z",
                    updated_at: "2026-09-06T04:13:30Z",
                    role_permissions: [],
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "businesses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: val === "b8e2612f-4acc-4c84-a420-220131b70d77"
                  ? { id: val, name: "Barbería Style", business_type: "barbershop" }
                  : { id: val, name: "Burger Fast Food", business_type: "fast_food_restaurant" },
                error: null,
              }),
            })),
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

describe("Workspace Roles & Permissions Flow (Fase 2.2)", () => {
  const validBusinessId = "a8e2612f-4acc-4c84-a420-220131b70d66";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Roles filtering & Canonical Workspace Scope", () => {
    it("debe retornar ÚNICAMENTE los roles 'owner' y 'auxiliar'", async () => {
      const res = await getWorkspaceRolesAction(validBusinessId);

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data).toHaveLength(2);

      const returnedCodes = res.data!.map((r) => r.code);
      expect(returnedCodes).toEqual(["owner", "auxiliar"]);

      // Verificar que NO incluya roles de plataforma
      expect(returnedCodes).not.toContain("super_admin");
      expect(returnedCodes).not.toContain("admin");

      // Verificar que NO incluya otros roles secundarios
      expect(returnedCodes).not.toContain("business_admin");
      expect(returnedCodes).not.toContain("supervisor");
      expect(returnedCodes).not.toContain("seller");
      expect(returnedCodes).not.toContain("cashier");
    });

    it("todos los roles retornados deben tener scope 'business' y ser del sistema", async () => {
      const res = await getWorkspaceRolesAction(validBusinessId);

      expect(res.success).toBe(true);
      res.data!.forEach((role) => {
        expect(role.scope).toBe("business");
        expect(role.isSystemRole).toBe(true);
        expect(role.status).toBe("active");
        expect(role.businessId).toBe(validBusinessId);
      });
    });
  });

  describe("2. Conteo Aislado de Usuarios por Negocio", () => {
    it("debe contabilizar exactamente los usuarios del negocio indicado", async () => {
      const res = await getWorkspaceRolesAction(validBusinessId);

      expect(res.success).toBe(true);
      const owner = res.data!.find((r) => r.code === "owner");
      const auxiliar = res.data!.find((r) => r.code === "auxiliar");

      expect(owner?.userCount).toBe(1);
      expect(auxiliar?.userCount).toBe(2);
    });
  });

  describe("3. Matriz de Permisos de Negocio", () => {
    it("debe asignar los permisos canónicos correctos a cada rol", async () => {
      const res = await getWorkspaceRolesAction(validBusinessId);

      expect(res.success).toBe(true);
      const owner = res.data!.find((r) => r.code === "owner");
      const auxiliar = res.data!.find((r) => r.code === "auxiliar");

      expect(owner?.permissionCount).toBe(33);
      expect(auxiliar?.permissionCount).toBe(17);

      // Owner tiene permisos críticos de negocio
      expect(owner?.permissions).toContain("business_settings.update");
      expect(owner?.permissions).toContain("business_users.create");
      expect(owner?.permissions).toContain("sales.cancel");

      // Auxiliar tiene permisos operativos pero NO críticos
      expect(auxiliar?.permissions).toContain("sales.create");
      expect(auxiliar?.permissions).toContain("products.view");
      expect(auxiliar?.permissions).not.toContain("business_settings.update");
      expect(auxiliar?.permissions).not.toContain("business_users.create");
      expect(auxiliar?.permissions).not.toContain("sales.cancel");
    });

    it("todos los módulos de permisos de negocio deben pertenecer al scope 'business'", () => {
      const businessModules = ALL_PERMISSION_MODULES.filter((m) => m.scope === "business");
      expect(businessModules).toHaveLength(9);

      const moduleIds = businessModules.map((m) => m.moduleId);
      expect(moduleIds).toEqual([
        "ventas",
        "pedidos",
        "productos",
        "clientes",
        "inventario",
        "gastos",
        "empleados",
        "configuracion_negocio",
        "reportes",
      ]);
    });

    it("debe adaptar la matriz de roles cuando el negocio es de otro tipo (ej. barbería)", async () => {
      const barbershopBusinessId = "b8e2612f-4acc-4c84-a420-220131b70d77";
      const res = await getWorkspaceRolesAction(barbershopBusinessId);

      expect(res.success).toBe(true);
      expect(res.businessType).toBe("barbershop");

      const owner = res.data!.find((r) => r.code === "owner");
      const auxiliar = res.data!.find((r) => r.code === "auxiliar");

      // Para barbería: el owner tiene 28 permisos (sin pedidos) y el auxiliar 14 permisos
      expect(owner?.permissionCount).toBe(28);
      expect(owner?.permissions).not.toContain("orders.view");
      expect(owner?.permissions).not.toContain("orders.create");

      expect(auxiliar?.permissionCount).toBe(14);
      expect(auxiliar?.permissions).not.toContain("orders.view");
      expect(auxiliar?.permissions).not.toContain("orders.create");
      expect(auxiliar?.permissions).toContain("sales.create");
    });
  });

  describe("4. Seguridad Multi-Tenant e Inmutabilidad", () => {
    it("debe rechazar solicitudes con businessId inválido", async () => {
      const res = await getWorkspaceRolesAction("not-a-valid-uuid");

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it("debe rechazar solicitudes a comercios donde el usuario no tiene membresía activa", async () => {
      const res = await getWorkspaceRolesAction("00000000-0000-0000-0000-000000000000");

      expect(res.success).toBe(false);
      expect(res.error).toContain("Acceso denegado");
    });

    it("debe rechazar de forma estricta cualquier intento de mutación sobre roles en Workspace", async () => {
      const updateRes = await updateWorkspaceRoleAction();

      expect(updateRes.success).toBe(false);
      expect(updateRes.error).toContain("Operación no permitida");
    });
  });
});
