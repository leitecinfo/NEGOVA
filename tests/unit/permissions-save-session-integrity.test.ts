import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache revalidatePath
const revalidatedPaths: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn((path: string) => {
    revalidatedPaths.push(path);
  }),
}));

// Mock next/navigation
const redirectedUrls: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    redirectedUrls.push(url);
    throw new Error(`NEXT_REDIRECT: ${url}`);
  }),
  notFound: vi.fn(),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    get: () => null,
    set: () => {},
  })),
}));

// Mock authorization module for server action testing
vi.mock("@/lib/auth/authorization", () => ({
  verifyUserPermission: vi.fn(async (code: string) => {
    return { userId: "usr-super_admin-01", userRole: "super_admin" };
  }),
  getCurrentUserAuthorization: vi.fn(async () => ({
    userId: "usr-owner-01",
    email: "owner@negova.com",
    platformRole: "customer",
    isPlatformUser: false,
    businessMemberships: [{ businessId: "biz-restaurant-01", roleCode: "owner", status: "active" }],
  })),
  hasPermission: vi.fn(async () => true),
}));

import { saveUserCustomPermissions, getUserEffectivePermissionsDetail } from "../../src/lib/auth/user-permissions-service";
import { saveAdminUserCustomPermissionsAction } from "../../src/app/admin/usuarios/actions";
import { saveUserPermissionsAction } from "../../src/app/workspace/[businessId]/usuarios/actions";

describe("NEGOVA — Integridad de Sesión al Guardar Permisos", () => {
  beforeEach(() => {
    revalidatedPaths.length = 0;
    redirectedUrls.length = 0;
  });

  describe("1. Guardado de permisos por rol OWNER", () => {
    it("permite al owner conceder y revocar permisos de un auxiliar sin provocar redirección al login", async () => {
      const res = await saveUserCustomPermissions({
        businessId: "biz-restaurant-01",
        targetUserId: "usr-auxiliar-01",
        actorUserId: "usr-owner-01",
        grantedPermissions: ["expenses.update"],
        revokedPermissions: ["sales.create"],
      });

      expect(res.success).toBe(true);
      expect(res.effectivePermissions).toBeDefined();
      expect(res.effectivePermissions).toContain("expenses.update");
      expect(res.effectivePermissions).not.toContain("sales.create");
      expect(redirectedUrls).toHaveLength(0);
    });

    it("permite al owner realizar múltiples guardados consecutivos manteniendo la consistencia", async () => {
      // Primer guardado
      const res1 = await saveUserCustomPermissions({
        businessId: "biz-restaurant-01",
        targetUserId: "usr-auxiliar-02",
        actorUserId: "usr-owner-01",
        grantedPermissions: ["expenses.update"],
        revokedPermissions: [],
      });
      expect(res1.success).toBe(true);

      // Segundo guardado consecutivo
      const res2 = await saveUserCustomPermissions({
        businessId: "biz-restaurant-01",
        targetUserId: "usr-auxiliar-02",
        actorUserId: "usr-owner-01",
        grantedPermissions: ["expenses.update"],
        revokedPermissions: ["sales.view"],
      });
      expect(res2.success).toBe(true);
      expect(res2.effectivePermissions).toContain("expenses.update");
      expect(res2.effectivePermissions).not.toContain("sales.view");
      expect(redirectedUrls).toHaveLength(0);
    });

    it("persiste los cambios en el detalle de permisos efectivos", async () => {
      await saveUserCustomPermissions({
        businessId: "biz-restaurant-01",
        targetUserId: "usr-auxiliar-03",
        actorUserId: "usr-owner-01",
        grantedPermissions: ["expenses.update"],
        revokedPermissions: ["sales.view"],
      });

      const detail = await getUserEffectivePermissionsDetail("biz-restaurant-01", "usr-auxiliar-03");
      expect(detail.effectivePermissions).toContain("expenses.update");
      expect(detail.customGrantedPermissions).toContain("expenses.update");
      expect(detail.customRevokedPermissions).toContain("sales.view");
      expect(detail.effectivePermissions).not.toContain("sales.view");
    });
  });

  describe("2. Guardado de permisos por rol ADMIN", () => {
    it("permite a un super_admin o admin guardar permisos sin revalidar rutas cruzadas de workspace", async () => {
      const res = await saveAdminUserCustomPermissionsAction(
        "biz-restaurant-01",
        "usr-auxiliar-04",
        ["expenses.update"],
        []
      );

      expect(res.success).toBe(true);
      // Las rutas revalidadas deben limitarse al panel de administración
      expect(revalidatedPaths).toContain("/admin/usuarios/usr-auxiliar-04");
      expect(revalidatedPaths).toContain("/admin/usuarios");
      // CRÍTICO: NO debe revalidar /workspace/... ya que causaría redirección al login
      expect(revalidatedPaths).not.toContain("/workspace/biz-restaurant-01/usuarios");
      expect(revalidatedPaths).not.toContain("/workspace/biz-restaurant-01/usuarios/usr-auxiliar-04");
      expect(redirectedUrls).toHaveLength(0);
    });
  });

  describe("3. Manejo controlado de errores y seguridad de sesión", () => {
    it("rechaza modificaciones cuando el actor no es owner ni admin sin expulsar de sesión", async () => {
      const res = await saveUserCustomPermissions({
        businessId: "biz-restaurant-01",
        targetUserId: "usr-auxiliar-01",
        actorUserId: "usr-auxiliar-impostor",
        grantedPermissions: ["expenses.update"],
        revokedPermissions: [],
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Solo el propietario del negocio o un administrador/);
      // El error se maneja como respuesta JSON, NO disparando redirecciones abruptas
      expect(redirectedUrls).toHaveLength(0);
    });

    it("impide que un admin modifique sus propios permisos (auto-escalamiento)", async () => {
      const res = await saveAdminUserCustomPermissionsAction(
        "biz-restaurant-01",
        "usr-super_admin-01", // Mismo id que el actor mockeado
        ["roles.manage"],
        []
      );

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/No puedes modificar tus propios permisos/);
      expect(redirectedUrls).toHaveLength(0);
    });

    it("impide modificar permisos del owner de un negocio", async () => {
      const res = await saveUserCustomPermissions({
        businessId: "biz-restaurant-01",
        targetUserId: "usr-owner-02",
        actorUserId: "usr-owner-01",
        grantedPermissions: [],
        revokedPermissions: ["sales.view"],
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/No se pueden aplicar restricciones.*al propietario/);
      expect(redirectedUrls).toHaveLength(0);
    });
  });
});
