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

  describe("5. Business Type Adaptation & Vertical Extensibility Matrix", () => {
    it("debe retornar todos los 9 módulos de negocio para un restaurante de comida rápida", async () => {
      const { getPermissionModulesForBusinessType } = await import("../../src/lib/auth/permissions");
      
      const fastFoodModules = getPermissionModulesForBusinessType("fast_food_restaurant");
      expect(fastFoodModules).toHaveLength(9);
      expect(fastFoodModules.map((m) => m.moduleId)).toContain("pedidos");

      const restaurantModules = getPermissionModulesForBusinessType("restaurant");
      expect(restaurantModules).toHaveLength(9);
      expect(restaurantModules.map((m) => m.moduleId)).toContain("pedidos");
    });

    it("debe excluir estrictamente el módulo de comandas/pedidos para negocios no gastronómicos (ej. barbería, retail)", async () => {
      const { getPermissionModulesForBusinessType } = await import("../../src/lib/auth/permissions");
      
      const barbershopModules = getPermissionModulesForBusinessType("barbershop");
      expect(barbershopModules).toHaveLength(8);
      expect(barbershopModules.map((m) => m.moduleId)).not.toContain("pedidos");

      const retailModules = getPermissionModulesForBusinessType("fashion");
      expect(retailModules).toHaveLength(8);
      expect(retailModules.map((m) => m.moduleId)).not.toContain("pedidos");
    });

    it("debe validar correctamente la compatibilidad de permisos individuales con el tipo de negocio", async () => {
      const { isPermissionCompatibleWithBusinessType } = await import("../../src/lib/auth/permissions");

      // Permisos de comandas (gastronomía)
      expect(isPermissionCompatibleWithBusinessType("orders.view", "restaurant")).toBe(true);
      expect(isPermissionCompatibleWithBusinessType("orders.create", "fast_food_restaurant")).toBe(true);
      expect(isPermissionCompatibleWithBusinessType("orders.update", "comida_rapida")).toBe(true);
      expect(isPermissionCompatibleWithBusinessType("orders.manage", "pizzeria")).toBe(true);

      // Bloqueo estricto para no gastronómicos
      expect(isPermissionCompatibleWithBusinessType("orders.create", "barbershop")).toBe(false);
      expect(isPermissionCompatibleWithBusinessType("orders.view", "hardware")).toBe(false);
      expect(isPermissionCompatibleWithBusinessType("orders.update", "spa")).toBe(false);

      // Permisos core universales compatibles con todos los verticales
      const universalPerms = [
        "sales.view", "sales.create", "sales.update",
        "products.view", "products.create",
        "customers.view", "customers.create",
        "inventory.view", "inventory.create",
        "expenses.view", "expenses.create",
        "reports.view", "business_settings.view"
      ];

      universalPerms.forEach((perm) => {
        expect(isPermissionCompatibleWithBusinessType(perm, "restaurant")).toBe(true);
        expect(isPermissionCompatibleWithBusinessType(perm, "barbershop")).toBe(true);
        expect(isPermissionCompatibleWithBusinessType(perm, "fashion")).toBe(true);
      });
    });

    it("debe calcular los permisos efectivos por defecto según el tipo de negocio", async () => {
      const { getDefaultPermissionsForRoleAndBusinessType } = await import("../../src/lib/auth/permissions");

      // Auxiliar en Restaurante: 17 permisos (incluye orders.view, orders.create, orders.update)
      const restaurantAuxPerms = getDefaultPermissionsForRoleAndBusinessType("auxiliar", "fast_food_restaurant");
      expect(restaurantAuxPerms).toHaveLength(17);
      expect(restaurantAuxPerms).toContain("orders.view");
      expect(restaurantAuxPerms).toContain("orders.create");
      expect(restaurantAuxPerms).toContain("orders.update");

      // Auxiliar en Barbería: 14 permisos (excluye órdenes de cocina)
      const barbershopAuxPerms = getDefaultPermissionsForRoleAndBusinessType("auxiliar", "barbershop");
      expect(barbershopAuxPerms).toHaveLength(14);
      expect(barbershopAuxPerms).not.toContain("orders.view");
      expect(barbershopAuxPerms).not.toContain("orders.create");
      expect(barbershopAuxPerms).not.toContain("orders.update");

      // Owner en Restaurante: 33 permisos (todos los de negocio)
      const restaurantOwnerPerms = getDefaultPermissionsForRoleAndBusinessType("owner", "restaurant");
      expect(restaurantOwnerPerms).toHaveLength(33);

      // Owner en Barbería: 28 permisos (33 - 5 de comandas)
      const barbershopOwnerPerms = getDefaultPermissionsForRoleAndBusinessType("owner", "barbershop");
      expect(barbershopOwnerPerms).toHaveLength(28);
      expect(barbershopOwnerPerms).not.toContain("orders.view");
      expect(barbershopOwnerPerms).not.toContain("orders.cancel");
    });

    it("debe entregar la lista de permisos asignables al auxiliar sin exponer operaciones críticas del dueño", async () => {
      const { getAssignablePermissionsForAuxiliar } = await import("../../src/lib/auth/permissions");

      const restaurantAssignable = getAssignablePermissionsForAuxiliar("fast_food_restaurant");
      
      // Debe incluir operaciones diarias permitidas
      expect(restaurantAssignable).toContain("sales.view");
      expect(restaurantAssignable).toContain("sales.create");
      expect(restaurantAssignable).toContain("sales.update");
      expect(restaurantAssignable).toContain("orders.view");
      expect(restaurantAssignable).toContain("orders.create");
      expect(restaurantAssignable).toContain("orders.update");
      expect(restaurantAssignable).toContain("products.view");
      expect(restaurantAssignable).toContain("customers.view");
      expect(restaurantAssignable).toContain("inventory.view");
      expect(restaurantAssignable).toContain("expenses.view");
      expect(restaurantAssignable).toContain("reports.view");

      // NUNCA debe permitir asignar permisos críticos reservados al Propietario
      expect(restaurantAssignable).not.toContain("sales.cancel");
      expect(restaurantAssignable).not.toContain("orders.cancel");
      expect(restaurantAssignable).not.toContain("orders.manage");
      expect(restaurantAssignable).not.toContain("products.delete");
      expect(restaurantAssignable).not.toContain("customers.delete");
      expect(restaurantAssignable).not.toContain("inventory.adjust");
      expect(restaurantAssignable).not.toContain("inventory.update");
      expect(restaurantAssignable).not.toContain("expenses.delete");
      expect(restaurantAssignable).not.toContain("business_users.view");
      expect(restaurantAssignable).not.toContain("business_users.create");
      expect(restaurantAssignable).not.toContain("business_users.update");
      expect(restaurantAssignable).not.toContain("business_users.disable");
      expect(restaurantAssignable).not.toContain("business_settings.view");
      expect(restaurantAssignable).not.toContain("business_settings.update");
      expect(restaurantAssignable).not.toContain("reports.export");
    });

    it("debe permitir extensibilidad para futuros verticales sin romper el núcleo", async () => {
      const { isModuleCompatibleWithBusinessType } = await import("../../src/lib/auth/permissions");

      // Simulación de módulo futuro de citas para barberías
      const futureAppointmentsModule = {
        moduleId: "citas",
        moduleName: "Citas y Agenda de Servicios",
        description: "Gestión de citas y turnos",
        scope: "business" as const,
        compatibleBusinessTypes: ["barbershop", "spa", "technical_service"],
        permissions: [
          { code: "appointments.view", name: "Ver Citas", description: "Consultar agenda", isAssignableToAuxiliar: true },
          { code: "appointments.create", name: "Agendar Cita", description: "Crear cita", isAssignableToAuxiliar: true },
        ],
      };

      // Debe ser compatible con barbería y spa
      expect(isModuleCompatibleWithBusinessType(futureAppointmentsModule, "barbershop")).toBe(true);
      expect(isModuleCompatibleWithBusinessType(futureAppointmentsModule, "spa")).toBe(true);

      // Debe ser rechazado para restaurante o retail
      expect(isModuleCompatibleWithBusinessType(futureAppointmentsModule, "restaurant")).toBe(false);
      expect(isModuleCompatibleWithBusinessType(futureAppointmentsModule, "fast_food_restaurant")).toBe(false);
      expect(isModuleCompatibleWithBusinessType(futureAppointmentsModule, "fashion")).toBe(false);
    });
  });
});
