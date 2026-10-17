import { describe, it, expect } from "vitest";
import {
  WORKSPACE_MODULES_CATALOG,
  buildWorkspaceNavSections,
  getWorkspaceModuleById,
  isGastronomyBusiness,
  WORKSPACE_NAV_GROUPS,
  type AppNavItem,
  type AppNavSection,
} from "../../src/config/workspace-navigation";

describe("Workspace Navigation Catalog & Architecture (5 Secciones Canónicas)", () => {
  const businessId = "test-business-123";

  describe("WORKSPACE_MODULES_CATALOG definitions", () => {
    it("should define stable module IDs without duplicates", () => {
      const ids = WORKSPACE_MODULES_CATALOG.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should classify each module with a valid level, group, and implementation status", () => {
      const validStatuses = ["implemented", "under_construction", "not_applicable"];
      const validLevels = ["core", "specific"];

      for (const mod of WORKSPACE_MODULES_CATALOG) {
        expect(validStatuses).toContain(mod.status);
        expect(validLevels).toContain(mod.level);
        expect(mod.label).toBeTruthy();
        expect(mod.shortDescription).toBeTruthy();
        expect(mod.icon).toBeDefined();
        expect(mod.group).toBeTruthy();
      }
    });

    it("should identify implemented modules correctly", () => {
      const implementedIds = WORKSPACE_MODULES_CATALOG.filter(
        (m) => m.status === "implemented"
      ).map((m) => m.id);

      expect(implementedIds).toContain("dashboard");
      expect(implementedIds).toContain("pos");
      expect(implementedIds).toContain("ventas");
      expect(implementedIds).toContain("pedidos");
      expect(implementedIds).toContain("mesas");
      expect(implementedIds).toContain("productos");
      expect(implementedIds).toContain("usuarios");
      expect(implementedIds).toContain("roles");
      expect(implementedIds).toContain("configuracion");
      expect(implementedIds).toContain("documentos");
      expect(implementedIds).toContain("notificaciones");
      expect(implementedIds).toContain("perfil");
      expect(implementedIds).toContain("soporte");
    });

    it("should identify modules under construction without creating mock implementations", () => {
      const constructionIds = WORKSPACE_MODULES_CATALOG.filter(
        (m) => m.status === "under_construction"
      ).map((m) => m.id);

      expect(constructionIds).toContain("clientes");
      expect(constructionIds).toContain("proveedores");
      expect(constructionIds).toContain("inventario");
      expect(constructionIds).toContain("compras");
      expect(constructionIds).toContain("gastos");
      expect(constructionIds).toContain("caja");
      expect(constructionIds).toContain("finanzas");
      expect(constructionIds).toContain("cuentas");
      expect(constructionIds).toContain("reportes");
      expect(constructionIds).toContain("menu");
      expect(constructionIds).toContain("cocina");
      expect(constructionIds).toContain("despacho");
    });
  });

  describe("isGastronomyBusiness helper", () => {
    it("should identify fast food and restaurant business types", () => {
      expect(isGastronomyBusiness("restaurant")).toBe(true);
      expect(isGastronomyBusiness("fast_food")).toBe(true);
      expect(isGastronomyBusiness("restaurante")).toBe(true);
      expect(isGastronomyBusiness("comida_rapida")).toBe(true);
      expect(isGastronomyBusiness("cafeteria")).toBe(true);
      expect(isGastronomyBusiness("pizzeria")).toBe(true);
      expect(isGastronomyBusiness("food_truck")).toBe(true);
    });

    it("should return false for generic or non-gastronomy businesses", () => {
      expect(isGastronomyBusiness("retail")).toBe(false);
      expect(isGastronomyBusiness("servicios")).toBe(false);
      expect(isGastronomyBusiness("tienda_ropa")).toBe(false);
      expect(isGastronomyBusiness(undefined)).toBe(false);
      expect(isGastronomyBusiness("")).toBe(false);
    });
  });

  describe("buildWorkspaceNavSections", () => {
    it("should build exactly 5 core sections in canonical order for a standard non-gastronomy business", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "retail",
      });

      expect(sections.length).toBe(WORKSPACE_NAV_GROUPS.length);
      expect(sections.map((s) => s.id)).toEqual([
        "operacion",
        "catalogo",
        "gestion",
        "administracion",
        "cuenta",
      ]);

      // Verify gastronomy specific items are NOT present in non-gastro operation
      const operacionSection = sections.find((s) => s.id === "operacion");
      expect(operacionSection?.items.map((i) => i.id)).toEqual(["dashboard", "pos", "ventas"]);
    });

    it("should build exactly 5 core sections including Pedidos and Mesas inside Operación for gastronomy businesses", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "fast_food",
      });

      expect(sections.length).toBe(WORKSPACE_NAV_GROUPS.length);

      // Verify exact 5 group ordering
      expect(sections.map((s) => s.id)).toEqual([
        "operacion",
        "catalogo",
        "gestion",
        "administracion",
        "cuenta",
      ]);

      const operacionSection = sections.find((s: AppNavSection) => s.id === "operacion");
      expect(operacionSection?.items.map((i: AppNavItem) => i.id)).toEqual([
        "dashboard",
        "pos",
        "ventas",
        "pedidos",
        "mesas",
      ]);
    });

    it("should enforce the exact module order inside each group for gastronomy businesses", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "restaurant",
      });

      const sectionMap = Object.fromEntries(
        sections.map((s: AppNavSection) => [s.id, s.items.map((i: AppNavItem) => i.id)])
      );

      // 1. Operación: Inicio, Punto de venta, Ventas, Pedidos, Mesas
      expect(sectionMap["operacion"]).toEqual(["dashboard", "pos", "ventas", "pedidos", "mesas"]);

      // 2. Catálogo: Productos y servicios
      expect(sectionMap["catalogo"]).toEqual(["productos"]);

      // 3. Gestión del negocio: Clientes, Gastos, Finanzas, Documentos, Reportes
      expect(sectionMap["gestion"]).toEqual([
        "clientes",
        "gastos",
        "finanzas",
        "documentos",
        "reportes",
      ]);

      // 4. Administración: Usuarios, Roles y permisos, Configuración del negocio
      expect(sectionMap["administracion"]).toEqual(["usuarios", "roles", "configuracion"]);

      // 5. Cuenta: Notificaciones, Mi perfil, Soporte
      expect(sectionMap["cuenta"]).toEqual(["notificaciones", "perfil", "soporte"]);
    });

    it("should assign direct route to implemented modules without 'En construcción' badge", () => {
      const sections = buildWorkspaceNavSections(businessId);
      const allItems: AppNavItem[] = sections.flatMap((s: AppNavSection) => s.items);

      const pos = allItems.find((i: AppNavItem) => i.id === "pos");
      expect(pos).toBeDefined();
      expect(pos?.href).toBe(`/workspace/${businessId}/pos`);
      expect(pos?.label).toBe("Punto de venta");
      expect(pos?.badge).toBeUndefined();

      const ventas = allItems.find((i: AppNavItem) => i.id === "ventas");
      expect(ventas).toBeDefined();
      expect(ventas?.href).toBe(`/workspace/${businessId}/ventas`);
      expect(ventas?.label).toBe("Ventas");
      expect(ventas?.badge).toBeUndefined();

      const dashboard = allItems.find((i: AppNavItem) => i.id === "dashboard");
      expect(dashboard).toBeDefined();
      expect(dashboard?.href).toBe(`/workspace/${businessId}`);
      expect(dashboard?.label).toBe("Inicio");

      const notificaciones = allItems.find((i: AppNavItem) => i.id === "notificaciones");
      expect(notificaciones).toBeDefined();
      expect(notificaciones?.href).toBe(`/workspace/${businessId}/notificaciones`);
      expect(notificaciones?.badge).toBeUndefined();

      const soporte = allItems.find((i: AppNavItem) => i.id === "soporte");
      expect(soporte).toBeDefined();
      expect(soporte?.href).toBe(`/workspace/${businessId}/soporte`);
      expect(soporte?.badge).toBeUndefined();

      const perfil = allItems.find((i: AppNavItem) => i.id === "perfil");
      expect(perfil).toBeDefined();
      expect(perfil?.href).toBe(`/workspace/${businessId}/perfil`);
      expect(perfil?.badge).toBeUndefined();

      // Pedidos and Mesas in gastronomy business
      const gastroSections = buildWorkspaceNavSections(businessId, { businessType: "restaurant" });
      const gastroItems: AppNavItem[] = gastroSections.flatMap((s: AppNavSection) => s.items);
      const pedidos = gastroItems.find((i: AppNavItem) => i.id === "pedidos");
      expect(pedidos).toBeDefined();
      expect(pedidos?.href).toBe(`/workspace/${businessId}/pedidos`);
      expect(pedidos?.badge).toBeUndefined();

      const mesas = gastroItems.find((i: AppNavItem) => i.id === "mesas");
      expect(mesas).toBeDefined();
      expect(mesas?.href).toBe(`/workspace/${businessId}/mesas`);
      expect(mesas?.badge).toBeUndefined();
    });

    it("should assign informative '/modulo/[id]' route to under construction modules with clean sidebar labels", () => {
      const sections = buildWorkspaceNavSections(businessId, { businessType: "restaurant" });
      const allItems: AppNavItem[] = sections.flatMap((s: AppNavSection) => s.items);

      const clientes = allItems.find((i: AppNavItem) => i.id === "clientes");
      expect(clientes).toBeDefined();
      expect(clientes?.href).toBe(`/workspace/${businessId}/modulo/clientes`);
      expect(clientes?.badge).toBeUndefined();
    });

    it("should isolate businessId in all generated URLs", () => {
      const customBiz = "biz-custom-uuid-999";
      const sections = buildWorkspaceNavSections(customBiz, { businessType: "restaurant" });
      const allItems: AppNavItem[] = sections.flatMap((s: AppNavSection) => s.items);

      for (const item of allItems) {
        expect(item.href.startsWith(`/workspace/${customBiz}`)).toBe(true);
      }
    });
  });

  describe("getWorkspaceModuleById helper", () => {
    it("should return correct module metadata for valid id", () => {
      const mod = getWorkspaceModuleById("inventario");
      expect(mod).toBeDefined();
      expect(mod?.label).toBe("Inventario");
      expect(mod?.group).toBe("catalogo");
      expect(mod?.status).toBe("under_construction");
    });

    it("should return undefined for unknown module id", () => {
      const mod = getWorkspaceModuleById("non_existent_module_xyz");
      expect(mod).toBeUndefined();
    });
  });
});
