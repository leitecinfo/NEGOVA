import { describe, it, expect } from "vitest";
import { buildWorkspaceNavSections, WORKSPACE_MODULES_CATALOG } from "../../src/config/workspace-navigation";

describe("Workspace Navigation Filtering by Role and Vertical", () => {
  const businessId = "a8e2612f-4acc-4c84-a420-220131b70d66";

  describe("1. Navegación para el rol Auxiliar (Colaborador)", () => {
    it("debe OCULTAR los módulos administrativos al auxiliar en un restaurante", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "fast_food_restaurant",
        isOwner: false,
        roleCode: "auxiliar",
      });

      const allItems = sections.flatMap((s) => s.items);
      const itemIds = allItems.map((item) => item.id);

      // Módulos administrativos prohibidos para Auxiliar
      expect(itemIds).not.toContain("usuarios");
      expect(itemIds).not.toContain("roles");
      expect(itemIds).not.toContain("configuracion");
      expect(itemIds).not.toContain("documentos");

      // Módulos operativos permitidos visibles
      expect(itemIds).toContain("dashboard");
      expect(itemIds).toContain("ventas");
      expect(itemIds).toContain("productos");
      expect(itemIds).toContain("clientes");
      expect(itemIds).toContain("gastos");
      expect(itemIds).toContain("finanzas");
      expect(itemIds).toContain("reportes");
      expect(itemIds).toContain("pedidos");
      expect(itemIds).toContain("mesas");
      expect(itemIds).toContain("notificaciones");
      expect(itemIds).toContain("soporte");
      expect(itemIds).toContain("perfil");
    });

    it("debe OCULTAR los módulos administrativos y de pedidos al auxiliar en una barbería", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "barbershop",
        isOwner: false,
        roleCode: "auxiliar",
      });

      const allItems = sections.flatMap((s) => s.items);
      const itemIds = allItems.map((item) => item.id);

      // Módulos administrativos ocultos
      expect(itemIds).not.toContain("usuarios");
      expect(itemIds).not.toContain("roles");
      expect(itemIds).not.toContain("configuracion");
      expect(itemIds).not.toContain("documentos");

      // Módulos gastronómicos ocultos por tipo de negocio
      expect(itemIds).not.toContain("pedidos");
      expect(itemIds).not.toContain("mesas");
      expect(itemIds).not.toContain("menu");
      expect(itemIds).not.toContain("cocina");
      expect(itemIds).not.toContain("despacho");

      // Módulos operativos universales visibles
      expect(itemIds).toContain("dashboard");
      expect(itemIds).toContain("ventas");
      expect(itemIds).toContain("productos");
      expect(itemIds).toContain("clientes");
      expect(itemIds).toContain("gastos");
      expect(itemIds).toContain("notificaciones");
      expect(itemIds).toContain("soporte");
      expect(itemIds).toContain("perfil");
    });
  });

  describe("2. Navegación para el rol Dueño / Propietario (Owner)", () => {
    it("debe MOSTRAR todos los módulos administrativos y operativos al owner en un restaurante", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "fast_food_restaurant",
        isOwner: true,
        roleCode: "owner",
      });

      const allItems = sections.flatMap((s) => s.items);
      const itemIds = allItems.map((item) => item.id);

      // Módulos administrativos visibles para Owner
      expect(itemIds).toContain("usuarios");
      expect(itemIds).toContain("roles");
      expect(itemIds).toContain("configuracion");
      expect(itemIds).toContain("documentos");

      // Módulos operativos y gastronómicos visibles
      expect(itemIds).toContain("dashboard");
      expect(itemIds).toContain("ventas");
      expect(itemIds).toContain("productos");
      expect(itemIds).toContain("pedidos");
      expect(itemIds).toContain("mesas");
      expect(itemIds).toContain("clientes");
      expect(itemIds).toContain("gastos");
      expect(itemIds).toContain("finanzas");
      expect(itemIds).toContain("reportes");
      expect(itemIds).toContain("notificaciones");
      expect(itemIds).toContain("soporte");
      expect(itemIds).toContain("perfil");
    });

    it("debe MOSTRAR módulos administrativos pero OCULTAR pedidos al owner en una barbería", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "barbershop",
        isOwner: true,
        roleCode: "owner",
      });

      const allItems = sections.flatMap((s) => s.items);
      const itemIds = allItems.map((item) => item.id);

      // Administrativos visibles para Owner
      expect(itemIds).toContain("usuarios");
      expect(itemIds).toContain("roles");
      expect(itemIds).toContain("configuracion");
      expect(itemIds).toContain("documentos");

      // Gastronómicos ocultos por vertical
      expect(itemIds).not.toContain("pedidos");
      expect(itemIds).not.toContain("mesas");
      expect(itemIds).not.toContain("menu");
      expect(itemIds).not.toContain("cocina");
      expect(itemIds).not.toContain("despacho");
    });
  });

  describe("3. Navegación para roles de plataforma con acceso delegado (super_admin / admin)", () => {
    it("debe conceder navegación completa a super_admin cuando inspecciona el workspace", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "restaurant",
        isOwner: false,
        roleCode: "super_admin",
      });

      const allItems = sections.flatMap((s) => s.items);
      const itemIds = allItems.map((item) => item.id);

      expect(itemIds).toContain("usuarios");
      expect(itemIds).toContain("roles");
      expect(itemIds).toContain("configuracion");
      expect(itemIds).toContain("documentos");
    });
  });

  describe("4. Integridad del Catálogo de Módulos", () => {
    it("los 4 módulos administrativos deben tener minRoleLevel = 'owner'", () => {
      const adminModules = WORKSPACE_MODULES_CATALOG.filter(
        (m) => ["usuarios", "roles", "configuracion", "documentos"].includes(m.id)
      );

      expect(adminModules).toHaveLength(4);
      adminModules.forEach((m) => {
        expect(m.minRoleLevel).toBe("owner");
      });
    });
  });
});
