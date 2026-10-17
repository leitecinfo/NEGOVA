import { describe, it, expect } from "vitest";
import {
  PLATFORM_ROLES_CATALOG,
  BUSINESS_ROLES_CATALOG,
  DEFAULT_ROLE_PERMISSIONS_MAP,
} from "../../src/lib/auth/permissions";
import { NEGOVA_PLANS } from "../../src/config/plans";

describe("Users RBAC & Architecture Unit Tests", () => {
  describe("Role Scope Separation", () => {
    it("debe contener únicamente roles con scope 'platform' en PLATFORM_ROLES_CATALOG (super_admin y admin)", () => {
      expect(PLATFORM_ROLES_CATALOG).toHaveLength(2);
      PLATFORM_ROLES_CATALOG.forEach((role) => {
        expect(role.scope).toBe("platform");
        expect(["super_admin", "admin"]).toContain(role.code);
      });
    });

    it("debe contener únicamente roles con scope 'business' en BUSINESS_ROLES_CATALOG (owner y auxiliar para MVP)", () => {
      expect(BUSINESS_ROLES_CATALOG).toHaveLength(2);
      BUSINESS_ROLES_CATALOG.forEach((role) => {
        expect(role.scope).toBe("business");
        expect(["owner", "auxiliar"]).toContain(role.code);
      });
    });

    it("no debe existir solapamiento de códigos entre roles de plataforma y negocio", () => {
      const platformCodes = PLATFORM_ROLES_CATALOG.map((r) => r.code);
      const businessCodes = BUSINESS_ROLES_CATALOG.map((r) => r.code);

      const intersection = platformCodes.filter((code) => businessCodes.includes(code as any));
      expect(intersection).toHaveLength(0);
    });
  });

  describe("Permissions Mapping Consistency", () => {
    it("el rol super_admin debe poseer todos los permisos críticos del sistema", () => {
      const superAdminPermissions = DEFAULT_ROLE_PERMISSIONS_MAP["super_admin"];
      expect(superAdminPermissions).toBeDefined();

      const critical = [
        "users.view",
        "users.create",
        "users.update",
        "users.disable",
        "users.delete",
        "roles.view",
        "roles.manage",
        "platform_settings.view",
        "platform_settings.update",
      ];

      critical.forEach((perm) => {
        expect(superAdminPermissions).toContain(perm);
      });
    });

    it("el rol admin (ayudante) debe tener permisos delegados pero no acceso crítico total", () => {
      const adminPermissions = DEFAULT_ROLE_PERMISSIONS_MAP["admin"];
      expect(adminPermissions).toBeDefined();

      // Debe tener permisos operativos
      expect(adminPermissions).toContain("users.view");
      expect(adminPermissions).toContain("users.create");
      expect(adminPermissions).toContain("businesses.view");
      expect(adminPermissions).toContain("support.view");

      // No debe tener permisos críticos de super_admin por defecto
      expect(adminPermissions).not.toContain("roles.manage");
      expect(adminPermissions).not.toContain("users.delete");
      expect(adminPermissions).not.toContain("platform_settings.update");
      expect(adminPermissions).not.toContain("businesses.delete");
    });

    it("los roles de negocio deben tener permisos acordes a su nivel operativo", () => {
      const ownerPerms = DEFAULT_ROLE_PERMISSIONS_MAP["owner"];
      expect(ownerPerms).toBeDefined();
      expect(ownerPerms).toContain("sales.create");
      expect(ownerPerms).toContain("orders.view");
      expect(ownerPerms).toContain("business_users.view");

      const auxiliarPerms = DEFAULT_ROLE_PERMISSIONS_MAP["auxiliar"];
      expect(auxiliarPerms).toBeDefined();
      expect(auxiliarPerms).toContain("sales.create");
      expect(auxiliarPerms).toContain("inventory.view");
      expect(auxiliarPerms).not.toContain("business_settings.update");
      expect(auxiliarPerms).not.toContain("business_users.disable");
    });
  });

  describe("Plans Limits & User Capacity", () => {
    it("el plan 'inicio' debe permitir hasta 2 usuarios en total (dueño + 1 colaborador)", () => {
      expect(NEGOVA_PLANS.inicio.limits.maxUsers).toBe(2);
    });

    it("el plan 'crece' debe permitir hasta 3 usuarios", () => {
      expect(NEGOVA_PLANS.crece.limits.maxUsers).toBe(3);
    });

    it("el plan 'negocio' debe permitir hasta 6 usuarios", () => {
      expect(NEGOVA_PLANS.negocio.limits.maxUsers).toBe(6);
    });
  });
});
