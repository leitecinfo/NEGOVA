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
      expect(implementedIds).toContain("clientes");
      expect(implementedIds).toContain("gastos");
      expect(implementedIds).toContain("caja");
      expect(implementedIds).toContain("cocina");
      expect(implementedIds).toContain("reportes");
      expect(implementedIds).toContain("nomina");
      expect(implementedIds).toContain("inventario");
      expect(implementedIds).toContain("recetas");
      expect(implementedIds).toContain("compras");
      expect(implementedIds).toContain("proveedores");
    });

    it("should identify modules under construction without creating mock implementations", () => {
      const constructionIds = WORKSPACE_MODULES_CATALOG.filter(
        (m) => m.status === "under_construction"
      ).map((m) => m.id);

      expect(constructionIds).toContain("finanzas");
      expect(constructionIds).toContain("cuentas");
      expect(constructionIds).toContain("menu");
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
    it("should build core sections in canonical order for a standard non-gastronomy business", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "retail",
      });

      expect(sections.length).toBe(WORKSPACE_NAV_GROUPS.length);
      expect(sections.map((s) => s.id)).toEqual([
        "operacion",
        "ventas",
        "catalogo",
        "gestion",
        "administracion",
        "cuenta",
      ]);

      // Verify non-gastro operation items
      const operacionSection = sections.find((s) => s.id === "operacion");
      expect(operacionSection?.items.map((i) => i.id)).toEqual(["dashboard", "pos"]);

      // Verify ventas section
      const ventasSection = sections.find((s) => s.id === "ventas");
      expect(ventasSection?.items.map((i) => i.id)).toEqual(["ventas", "caja"]);
    });

    it("should build core sections including Pedidos and Mesas inside Operación for gastronomy businesses", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "fast_food",
      });

      expect(sections.length).toBe(WORKSPACE_NAV_GROUPS.length);

      // Verify exact group ordering
      expect(sections.map((s) => s.id)).toEqual([
        "operacion",
        "ventas",
        "catalogo",
        "gestion",
        "administracion",
        "cuenta",
      ]);

      const operacionSection = sections.find((s: AppNavSection) => s.id === "operacion");
      expect(operacionSection?.items.map((i: AppNavItem) => i.id)).toEqual([
        "dashboard",
        "pos",
        "pedidos",
        "domicilios",
        "mesas",
        "reservas",
        "cocina",
      ]);
    });

    it("should enforce the exact module order inside each group for gastronomy businesses", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "restaurant",
      });

      const sectionMap = Object.fromEntries(
        sections.map((s: AppNavSection) => [s.id, s.items.map((i: AppNavItem) => i.id)])
      );

      // 1. Operación: Inicio, Punto de venta, Pedidos, Domicilios, Mesas, Reservas, Cocina
      expect(sectionMap["operacion"]).toEqual(["dashboard", "pos", "pedidos", "domicilios", "mesas", "reservas", "cocina"]);

      // 2. Ventas: Historial, Caja
      expect(sectionMap["ventas"]).toEqual(["ventas", "caja"]);

      // 3. Productos: Productos, Inventario, Recetas, Compras, Proveedores
      expect(sectionMap["catalogo"]).toEqual([
        "productos",
        "inventario",
        "recetas",
        "compras",
        "proveedores",
      ]);

      // 4. Gestión del negocio: Clientes, Gastos, Finanzas, Documentos, Reportes
      expect(sectionMap["gestion"]).toEqual([
        "clientes",
        "gastos",
        "finanzas",
        "documentos",
        "reportes",
      ]);

      // 5. Administración: Usuarios/Empleados, Nómina, Roles y permisos, Configuración del negocio
      expect(sectionMap["administracion"]).toEqual(["usuarios", "nomina", "roles", "configuracion"]);

      // 6. Cuenta: Notificaciones, Mi perfil, Soporte
      expect(sectionMap["cuenta"]).toEqual(["notificaciones", "perfil", "soporte"]);
    });

    it("should assign direct route to implemented modules without 'En construcción' badge", () => {
      const sections = buildWorkspaceNavSections(businessId);
      const allItems: AppNavItem[] = sections.flatMap((s: AppNavSection) => s.items);

      const pos = allItems.find((i: AppNavItem) => i.id === "pos");
      expect(pos).toBeDefined();
      expect(pos?.href).toBe(`/workspace/${businessId}/pos`);
      expect(pos?.label).toBe("Vender");
      expect(pos?.badge).toBeUndefined();

      const ventas = allItems.find((i: AppNavItem) => i.id === "ventas");
      expect(ventas).toBeDefined();
      expect(ventas?.href).toBe(`/workspace/${businessId}/ventas`);
      expect(ventas?.label).toBe("Historial");
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

      const finanzas = allItems.find((i: AppNavItem) => i.id === "finanzas");
      expect(finanzas).toBeDefined();
      expect(finanzas?.href).toBe(`/workspace/${businessId}/modulo/finanzas`);
      expect(finanzas?.badge).toBeUndefined();
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
      const mod = getWorkspaceModuleById("compras");
      expect(mod).toBeDefined();
      expect(mod?.label).toBe("Compras");
      expect(mod?.group).toBe("catalogo");
      expect(mod?.status).toBe("implemented");

      const provMod = getWorkspaceModuleById("proveedores");
      expect(provMod).toBeDefined();
      expect(provMod?.label).toBe("Proveedores");
      expect(provMod?.group).toBe("catalogo");
      expect(provMod?.status).toBe("implemented");

      const recMod = getWorkspaceModuleById("recetas");
      expect(recMod).toBeDefined();
      expect(recMod?.label).toBe("Recetas");
      expect(recMod?.group).toBe("catalogo");
      expect(recMod?.status).toBe("implemented");

      const invMod = getWorkspaceModuleById("inventario");
      expect(invMod).toBeDefined();
      expect(invMod?.label).toBe("Inventario");
      expect(invMod?.status).toBe("implemented");

      const finMod = getWorkspaceModuleById("finanzas");
      expect(finMod).toBeDefined();
      expect(finMod?.group).toBe("gestion");
      expect(finMod?.status).toBe("under_construction");
    });

    it("should return undefined for unknown module id", () => {
      const mod = getWorkspaceModuleById("non_existent_module_xyz");
      expect(mod).toBeUndefined();
    });
  });
});
