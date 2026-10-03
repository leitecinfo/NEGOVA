import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hasPermission,
  verifyUserPermission,
  validateSuperAdminIntegrity,
} from "../../src/lib/auth/authorization";
import {
  createUser,
  changeUserRole,
  changeUserStatus,
} from "../../src/lib/auth/users-service";

describe("Authorization Engine & Security Controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Platform Context Permissions", () => {
    it("super_admin con estado active debe tener acceso total", async () => {
      const result = await hasPermission("fb3dd639-2033-4ee4-8208-88cbfb665a36", "roles.manage", {
        scope: "platform",
      });
      expect(result).toBe(true);
    });

    it("usuario inexistente o sin rol debe ser denegado", async () => {
      const result = await hasPermission("00000000-0000-0000-0000-000000000099", "users.view", {
        scope: "platform",
      });
      expect(result).toBe(false);
    });
  });

  describe("Tenant Isolation (Cross-Business ID Tampering Prevention)", () => {
    it("usuario perteneciente a Business A intentando acceder a Business B debe ser denegado", async () => {
      const denied = await hasPermission("00000000-0000-0000-0000-000000000001", "sales.create", {
        scope: "business",
        businessId: "00000000-0000-0000-0000-000000000002",
      });

      expect(denied).toBe(false);
    });

    it("usuario sin contexto de negocio no debe acceder a permisos tenant", async () => {
      const denied = await hasPermission("00000000-0000-0000-0000-000000000001", "sales.create", {
        scope: "business",
        businessId: null,
      });

      expect(denied).toBe(false);
    });
  });

  describe("User Account Status Enforcement", () => {
    it("un usuario inexistente o no activo debe ser denegado en todas las operaciones", async () => {
      const allowed = await hasPermission("00000000-0000-0000-0000-000000000003", "users.view", {
        scope: "platform",
      });
      expect(allowed).toBe(false);
    });

    it("un usuario con status 'blocked' o 'disabled' debe ser denegado", async () => {
      const allowed = await hasPermission("00000000-0000-0000-0000-000000000004", "businesses.view", {
        scope: "platform",
      });
      expect(allowed).toBe(false);
    });
  });

  describe("Privilege Escalation Prevention Tests", () => {
    it("un actor no super_admin no debe poder crear un super_admin", async () => {
      // Actor con ID simulado que no es super_admin
      const result = await createUser(
        {
          email: "malicious_admin_escalation@test.com",
          fullName: "Attacker",
          type: "platform",
          roleCode: "super_admin",
        },
        "7bfdea13-6a76-4011-a699-7582c6bad4e5" // ID de usuario customer en DB
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Acceso denegado");
    });

    it("un actor no super_admin no debe poder elevar a otro usuario a super_admin", async () => {
      const result = await changeUserRole(
        "7bfdea13-6a76-4011-a699-7582c6bad4e5",
        "super_admin",
        undefined,
        "7bfdea13-6a76-4011-a699-7582c6bad4e5" // Self-promotion attempt
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Acceso denegado");
    });
  });

  describe("Last Super Admin Integrity Protection", () => {
    it("no debe permitir deshabilitar al único Super Administrador activo de la plataforma", async () => {
      const result = await changeUserStatus(
        "fb3dd639-2033-4ee4-8208-88cbfb665a36",
        "disabled",
        "fb3dd639-2033-4ee4-8208-88cbfb665a36"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("único Super Administrador activo");
    });

    it("no debe permitir degradar el rol del único Super Administrador activo", async () => {
      const result = await changeUserRole(
        "fb3dd639-2033-4ee4-8208-88cbfb665a36",
        "admin",
        undefined,
        "fb3dd639-2033-4ee4-8208-88cbfb665a36"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("único Super Administrador activo");
    });
  });

  describe("Server Action Verification Exception (verifyUserPermission)", () => {
    it("debe lanzar excepción si el usuario no tiene la sesión requerida", async () => {
      await expect(
        verifyUserPermission("roles.manage")
      ).rejects.toThrow();
    });
  });
});
