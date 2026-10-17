import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deleteUser,
} from "../../src/lib/auth/users-service";
import {
  DEFAULT_ROLE_PERMISSIONS_MAP,
  ALL_PERMISSION_MODULES,
} from "../../src/lib/auth/permissions";
import {
  deleteUserAction,
} from "../../src/app/admin/usuarios/actions";

describe("Admin User Deletion Security & Architecture Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Permissions Catalog & Matrix Protection", () => {
    it("el permiso 'users.delete' debe estar definido en el módulo de usuarios de plataforma", () => {
      const userModule = ALL_PERMISSION_MODULES.find((m) => m.moduleId === "usuarios");
      expect(userModule).toBeDefined();
      const deletePerm = userModule?.permissions.find((p) => p.code === "users.delete");
      expect(deletePerm).toBeDefined();
      expect(deletePerm?.name).toBe("Eliminar Usuarios");
    });

    it("el permiso 'users.delete' debe estar otorgado exclusivamente a super_admin y NO a admin ni roles de negocio", () => {
      const superAdminPerms = DEFAULT_ROLE_PERMISSIONS_MAP["super_admin"] || [];
      const adminPerms = DEFAULT_ROLE_PERMISSIONS_MAP["admin"] || [];
      const ownerPerms = DEFAULT_ROLE_PERMISSIONS_MAP["owner"] || [];
      const auxiliarPerms = DEFAULT_ROLE_PERMISSIONS_MAP["auxiliar"] || [];

      expect(superAdminPerms).toContain("users.delete");
      expect(adminPerms).not.toContain("users.delete");
      expect(ownerPerms).not.toContain("users.delete");
      expect(auxiliarPerms).not.toContain("users.delete");
    });
  });

  describe("2. Server-Side Protection & Validation Rules", () => {
    it("debe rechazar la auto-eliminación (actorId === userId)", async () => {
      const currentAdminId = "fb3dd639-2033-4ee4-8208-88cbfb665a36";
      const result = await deleteUser(
        currentAdminId,
        "leitec.info@gmail.com",
        currentAdminId,
        "Intento de auto-borrado"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No puedes eliminar tu propia cuenta");
    });

    it("debe rechazar la eliminación si el correo de confirmación no coincide con el usuario", async () => {
      const targetUserId = "48617c5a-4574-4824-84b1-eb874aaa94bf";
      const actorId = "fb3dd639-2033-4ee4-8208-88cbfb665a36";

      const result = await deleteUser(
        targetUserId,
        "correo_incorrecto@gmail.com",
        actorId,
        "Test de correo erróneo"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("correo de confirmación no coincide");
    });

    it("debe proteger e impedir la eliminación del único Super Administrador activo", async () => {
      const superAdminId = "fb3dd639-2033-4ee4-8208-88cbfb665a36";
      const actorId = "00000000-0000-0000-0000-000000000099";

      const result = await deleteUser(
        superAdminId,
        "leitec.info@gmail.com",
        actorId,
        "Intento de borrar único super admin"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("único Super Administrador activo");
    });

    it("debe proteger e impedir eliminar al único propietario de un negocio activo sin transferir la propiedad", async () => {
      // Alex Smith (e53b803b-8f08-48b7-b833-365908946531) es owner en Comida Rápida AA Gourmet
      const ownerUserId = "e53b803b-8f08-48b7-b833-365908946531";
      const actorId = "fb3dd639-2033-4ee4-8208-88cbfb665a36";

      const result = await deleteUser(
        ownerUserId,
        "alexandersmithh2002@gmail.com",
        actorId,
        "Intento de borrar owner único"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("único propietario del negocio");
    });

    it("debe retornar error amigable si el usuario a eliminar no existe en la base de datos", async () => {
      const nonExistentUserId = "00000000-0000-0000-0000-999999999999";
      const actorId = "fb3dd639-2033-4ee4-8208-88cbfb665a36";

      const result = await deleteUser(
        nonExistentUserId,
        "noexiste@gmail.com",
        actorId,
        "Test inexistente"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Usuario no encontrado");
    });
  });

  describe("3. Server Action Authorization Enforcement", () => {
    it("deleteUserAction debe fallar si se invoca sin sesión autenticada con permiso users.delete", async () => {
      const res = await deleteUserAction(
        "48617c5a-4574-4824-84b1-eb874aaa94bf",
        "lucashoyos2002@gmail.com"
      );

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
