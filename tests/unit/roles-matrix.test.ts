import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PLATFORM_ROLES_CATALOG,
  BUSINESS_ROLES_CATALOG,
  DEFAULT_ROLE_PERMISSIONS_MAP,
  hasPlatformPermission,
} from "../../src/lib/auth/permissions";
import {
  hasPermission,
  verifyUserPermission,
  validateSuperAdminIntegrity,
} from "../../src/lib/auth/authorization";

describe("Roles & Permissions Security Matrix", () => {
  describe("1. Canonical Counts & Role Scope Separation", () => {
    it("debe verificar que los roles canónicos activos y de soporte existan con sus conteos exactos", () => {
      expect(DEFAULT_ROLE_PERMISSIONS_MAP.super_admin).toHaveLength(25);
      expect(DEFAULT_ROLE_PERMISSIONS_MAP.admin).toHaveLength(14);
      expect(DEFAULT_ROLE_PERMISSIONS_MAP.owner).toHaveLength(33);
      expect(DEFAULT_ROLE_PERMISSIONS_MAP.auxiliar).toHaveLength(17);
      expect(DEFAULT_ROLE_PERMISSIONS_MAP.business_admin).toHaveLength(28);
      expect(DEFAULT_ROLE_PERMISSIONS_MAP.supervisor).toHaveLength(20);
      expect(DEFAULT_ROLE_PERMISSIONS_MAP.seller).toHaveLength(9);
      expect(DEFAULT_ROLE_PERMISSIONS_MAP.cashier).toHaveLength(7);
    });

    it("debe separar estrictamente los ámbitos platform y business con catálogo MVP (2 roles de negocio)", () => {
      const platformCodes = PLATFORM_ROLES_CATALOG.map((r) => r.code);
      const businessCodes = BUSINESS_ROLES_CATALOG.map((r) => r.code);

      expect(platformCodes).toEqual(["super_admin", "admin"]);
      expect(businessCodes).toEqual(["owner", "auxiliar"]);

      // Sin solapamiento
      expect(platformCodes.filter((c) => businessCodes.includes(c as any))).toHaveLength(0);
    });
  });

  describe("2. Admin Delegation & Limitation Matrix (Admin vs Super Admin)", () => {
    const adminPerms = DEFAULT_ROLE_PERMISSIONS_MAP.admin;
    const superAdminPerms = DEFAULT_ROLE_PERMISSIONS_MAP.super_admin;

    it("admin DEBE tener permisos de consulta y gestión operativa delegada", () => {
      const expectedAdminAllowed = [
        "users.view",
        "users.create",
        "users.update",
        "businesses.view",
        "businesses.create",
        "businesses.update",
        "subscriptions.view",
        "plans.view",
        "billing.view",
        "support.view",
        "support.manage",
        "audit.view",
        "roles.view",
        "platform_settings.view",
      ];

      expectedAdminAllowed.forEach((perm) => {
        expect(adminPerms).toContain(perm);
        expect(hasPlatformPermission("admin", perm)).toBe(true);
      });
    });

    it("admin DEBE estar estrictamente bloqueado para acciones críticas de infraestructura", () => {
      const expectedAdminDenied = [
        "users.disable",
        "users.delete",
        "businesses.suspend",
        "businesses.delete",
        "subscriptions.create",
        "subscriptions.update",
        "subscriptions.cancel",
        "billing.manage",
        "audit.export",
        "platform_settings.update",
        "roles.manage",
      ];

      expectedAdminDenied.forEach((perm) => {
        expect(adminPerms).not.toContain(perm);
        expect(hasPlatformPermission("admin", perm)).toBe(false);
      });
    });

    it("super_admin DEBE poseer todos los 25 permisos de plataforma", () => {
      expect(superAdminPerms).toHaveLength(25);
      superAdminPerms.forEach((perm) => {
        expect(hasPlatformPermission("super_admin", perm)).toBe(true);
      });
    });
  });

  describe("3. Business Roles Operational Hierarchy Matrix", () => {
    const owner = DEFAULT_ROLE_PERMISSIONS_MAP.owner;
    const auxiliar = DEFAULT_ROLE_PERMISSIONS_MAP.auxiliar;
    const businessAdmin = DEFAULT_ROLE_PERMISSIONS_MAP.business_admin;
    const supervisor = DEFAULT_ROLE_PERMISSIONS_MAP.supervisor;
    const seller = DEFAULT_ROLE_PERMISSIONS_MAP.seller;
    const cashier = DEFAULT_ROLE_PERMISSIONS_MAP.cashier;

    it("owner debe tener capacidades exclusivas de propietario (33 permisos)", () => {
      expect(owner).toContain("products.delete");
      expect(owner).toContain("customers.delete");
      expect(owner).toContain("expenses.delete");
      expect(owner).toContain("business_users.disable");
      expect(owner).toContain("business_settings.update");
    });

    it("auxiliar (ayudante) debe tener 17 permisos operativos diarios y carecer de privilegios críticos de propietario", () => {
      expect(auxiliar).toHaveLength(17);

      // Permisos operativos diarios permitidos
      expect(auxiliar).toContain("sales.view");
      expect(auxiliar).toContain("sales.create");
      expect(auxiliar).toContain("sales.update");
      expect(auxiliar).toContain("orders.view");
      expect(auxiliar).toContain("orders.create");
      expect(auxiliar).toContain("orders.update");
      expect(auxiliar).toContain("products.view");
      expect(auxiliar).toContain("products.create");
      expect(auxiliar).toContain("products.update");
      expect(auxiliar).toContain("customers.view");
      expect(auxiliar).toContain("customers.create");
      expect(auxiliar).toContain("customers.update");
      expect(auxiliar).toContain("inventory.view");
      expect(auxiliar).toContain("inventory.create");
      expect(auxiliar).toContain("expenses.view");
      expect(auxiliar).toContain("expenses.create");
      expect(auxiliar).toContain("reports.view");

      // Bloqueos de seguridad y propiedad exclusiva de owner
      expect(auxiliar).not.toContain("sales.cancel");
      expect(auxiliar).not.toContain("orders.cancel");
      expect(auxiliar).not.toContain("orders.manage");
      expect(auxiliar).not.toContain("products.delete");
      expect(auxiliar).not.toContain("customers.delete");
      expect(auxiliar).not.toContain("inventory.adjust");
      expect(auxiliar).not.toContain("expenses.delete");
      expect(auxiliar).not.toContain("business_users.view");
      expect(auxiliar).not.toContain("business_users.create");
      expect(auxiliar).not.toContain("business_users.disable");
      expect(auxiliar).not.toContain("business_settings.view");
      expect(auxiliar).not.toContain("business_settings.update");
      expect(auxiliar).not.toContain("reports.export");
    });

    it("business_admin debe tener 28 permisos y carecer de eliminaciones críticas", () => {
      expect(businessAdmin).toHaveLength(28);
      expect(businessAdmin).not.toContain("products.delete");
      expect(businessAdmin).not.toContain("customers.delete");
      expect(businessAdmin).not.toContain("expenses.delete");
      expect(businessAdmin).not.toContain("business_users.disable");
      expect(businessAdmin).not.toContain("business_settings.update");

      // Pero sí puede gestionar inventario y comandas
      expect(businessAdmin).toContain("inventory.create");
      expect(businessAdmin).toContain("inventory.update");
      expect(businessAdmin).toContain("inventory.adjust");
      expect(businessAdmin).toContain("orders.manage");
    });

    it("supervisor debe tener 20 permisos orientados a arqueo y anulación de turno", () => {
      expect(supervisor).toHaveLength(20);
      expect(supervisor).toContain("sales.cancel");
      expect(supervisor).toContain("orders.cancel");
      expect(supervisor).toContain("inventory.adjust");
      expect(supervisor).toContain("reports.view");

      // Bloqueos de supervisor
      expect(supervisor).not.toContain("products.create");
      expect(supervisor).not.toContain("products.update");
      expect(supervisor).not.toContain("reports.export");
      expect(supervisor).not.toContain("business_settings.view");
      expect(supervisor).not.toContain("business_users.create");
    });

    it("seller (vendedor) debe tener 9 permisos enfocados en venta y pedidos", () => {
      expect(seller).toHaveLength(9);
      expect(seller).toContain("sales.view");
      expect(seller).toContain("sales.create");
      expect(seller).toContain("orders.view");
      expect(seller).toContain("orders.create");
      expect(seller).toContain("orders.update");
      expect(seller).toContain("products.view");
      expect(seller).toContain("customers.view");
      expect(seller).toContain("customers.create");
      expect(seller).toContain("customers.update");

      // Bloqueos de seller
      expect(seller).not.toContain("sales.cancel");
      expect(seller).not.toContain("orders.cancel");
      expect(seller).not.toContain("orders.manage");
      expect(seller).not.toContain("inventory.view");
      expect(seller).not.toContain("expenses.view");
      expect(seller).not.toContain("reports.view");
    });

    it("cashier (cajero) debe tener 7 permisos orientados a cobro en caja", () => {
      expect(cashier).toHaveLength(7);
      expect(cashier).toContain("sales.view");
      expect(cashier).toContain("sales.create");
      expect(cashier).toContain("orders.view");
      expect(cashier).toContain("orders.create");
      expect(cashier).toContain("products.view");
      expect(cashier).toContain("customers.view");
      expect(cashier).toContain("customers.create");

      // Bloqueos de cashier
      expect(cashier).not.toContain("sales.cancel");
      expect(cashier).not.toContain("sales.update");
      expect(cashier).not.toContain("orders.cancel");
      expect(cashier).not.toContain("orders.update");
      expect(cashier).not.toContain("customers.update");
      expect(cashier).not.toContain("inventory.view");
      expect(cashier).not.toContain("expenses.view");
    });
  });

  describe("4. Super Admin Inviolability & Critical Permissions Protection", () => {
    it("debe rechazar la eliminación de permisos críticos de super_admin", async () => {
      const strippedPermissions = ["users.view", "businesses.view"]; // Le faltan roles.manage, platform_settings.update, etc.

      const result = await validateSuperAdminIntegrity(
        "super_admin_id",
        "super_admin",
        strippedPermissions
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("No es posible retirar permisos de seguridad críticos");
    });

    it("debe aceptar actualizaciones de permisos de super_admin si conserva todos los críticos", async () => {
      const validPermissions = [
        "roles.view",
        "roles.manage",
        "platform_settings.view",
        "platform_settings.update",
        "users.view",
        "users.update",
        "businesses.view",
      ];

      const result = await validateSuperAdminIntegrity(
        "super_admin_id",
        "super_admin",
        validPermissions
      );

      expect(result.valid).toBe(true);
    });

    it("no debe aplicar restricciones de super_admin a roles no-super_admin", async () => {
      const result = await validateSuperAdminIntegrity(
        "admin_id",
        "admin",
        ["users.view"]
      );

      expect(result.valid).toBe(true);
    });
  });
});
