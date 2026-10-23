import { describe, it, expect, vi } from "vitest";
import React from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { buildWorkspaceNavSections } from "@/config/workspace-navigation";
import { isRouteActive } from "@/components/layout/navigation-utils";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/test-biz/productos",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock navigation progress
vi.mock("@/components/layout/navigation-progress-bar", () => ({
  useNavigationProgress: () => ({
    startNavigation: vi.fn(),
  }),
}));

describe("AppSidebar — Comportamiento en Modo Colapsado y Expandido", () => {
  const businessId = "test-business-123";
  const navSections = buildWorkspaceNavSections(businessId, {
    businessType: "restaurant",
    isOwner: true,
    roleCode: "owner",
  });

  const branding = {
    appTitle: "NEGOVA",
    appSubtitle: "Restaurante",
    homeUrl: `/workspace/${businessId}`,
  };

  it("debe exportar e instanciar el componente AppSidebar sin errores", () => {
    expect(AppSidebar).toBeDefined();
    const element = React.createElement(AppSidebar, {
      isCollapsed: false,
      onToggleCollapse: vi.fn(),
      navSections,
      branding,
    });
    expect(element).toBeDefined();
    expect(element.props.isCollapsed).toBe(false);
  });

  describe("Filtrado de secciones para modo colapsado", () => {
    const isOperacionesSection = (id: string, label: string) =>
      id.toLowerCase() === "operacion" ||
      id.toLowerCase() === "operaciones" ||
      label.toLowerCase().includes("operaci");

    it("debe identificar 'operacion' como el único grupo primario visible", () => {
      const operacionSection = navSections.find((s) => isOperacionesSection(s.id, s.label));
      expect(operacionSection).toBeDefined();
      expect(operacionSection?.id).toBe("operacion");

      // Validar que los ítems operativos existen
      const itemIds = operacionSection?.items.map((i) => i.id);
      expect(itemIds).toContain("dashboard");
      expect(itemIds).toContain("pos");
      expect(itemIds).toContain("ventas");
      expect(itemIds).toContain("pedidos");
      expect(itemIds).toContain("mesas");
    });

    it("debe separar correctamente las secciones ocultas que van al menú Módulos", () => {
      const hiddenSections = navSections.filter((s) => !isOperacionesSection(s.id, s.label));
      const hiddenSectionIds = hiddenSections.map((s) => s.id);

      // Grupos que deben ir al menú flotante de Módulos
      expect(hiddenSectionIds).toContain("catalogo");
      expect(hiddenSectionIds).toContain("gestion");
      expect(hiddenSectionIds).toContain("administracion");
      expect(hiddenSectionIds).toContain("cuenta");

      // Operaciones no debe estar en las secciones ocultas
      expect(hiddenSectionIds).not.toContain("operacion");
    });
  });

  describe("Filtrado por Búsqueda en el Menú Flotante de Módulos", () => {
    it("debe filtrar ítems ocultos por término de búsqueda (ej: 'inventario')", () => {
      const isOperacionesSection = (id: string, label: string) =>
        id.toLowerCase() === "operacion" || label.toLowerCase().includes("operaci");

      const hiddenSections = navSections
        .filter((s) => !isOperacionesSection(s.id, s.label))
        .map((s) => ({
          ...s,
          items: s.items.filter((i) => i.allowed !== false),
        }));

      const query = "inventario".toLowerCase();
      const filtered = hiddenSections
        .map((sec) => ({
          ...sec,
          items: sec.items.filter(
            (item) =>
              item.label.toLowerCase().includes(query) ||
              item.description?.toLowerCase().includes(query)
          ),
        }))
        .filter((sec) => sec.items.length > 0);

      expect(filtered.length).toBeGreaterThan(0);
      const allFilteredItemLabels = filtered.flatMap((s) => s.items.map((i) => i.label.toLowerCase()));
      expect(allFilteredItemLabels.some((l) => l.includes("inventario"))).toBe(true);
    });

    it("debe retornar vacío si la búsqueda no coincide con ningún módulo", () => {
      const isOperacionesSection = (id: string, label: string) =>
        id.toLowerCase() === "operacion" || label.toLowerCase().includes("operaci");

      const hiddenSections = navSections
        .filter((s) => !isOperacionesSection(s.id, s.label))
        .map((s) => ({
          ...s,
          items: s.items.filter((i) => i.allowed !== false),
        }));

      const query = "termino_inexistente_xyz_123".toLowerCase();
      const filtered = hiddenSections
        .map((sec) => ({
          ...sec,
          items: sec.items.filter(
            (item) =>
              item.label.toLowerCase().includes(query) ||
              item.description?.toLowerCase().includes(query)
          ),
        }))
        .filter((sec) => sec.items.length > 0);

      expect(filtered.length).toBe(0);
    });
  });

  describe("Detección de Ruta Activa para iluminar botón Módulos", () => {
    it("debe detectar si la ruta activa está dentro de un módulo oculto", () => {
      const activePath = `/workspace/${businessId}/productos`;
      const searchParams = new URLSearchParams();

      const isOperacionesSection = (id: string, label: string) =>
        id.toLowerCase() === "operacion" || label.toLowerCase().includes("operaci");

      const hiddenSections = navSections.filter((s) => !isOperacionesSection(s.id, s.label));

      const isAnyHiddenActive = hiddenSections.some((sec) =>
        sec.items.some((item) => isRouteActive(item.href, activePath, searchParams, item.exactMatch))
      );

      // Como 'productos' (Inventario) está en el grupo 'catalogo' (oculto), debe ser true
      expect(isAnyHiddenActive).toBe(true);
    });

    it("no debe iluminar Módulos si la ruta activa es de Operación (ej: Ventas)", () => {
      const activePath = `/workspace/${businessId}/ventas`;
      const searchParams = new URLSearchParams();

      const isOperacionesSection = (id: string, label: string) =>
        id.toLowerCase() === "operacion" || label.toLowerCase().includes("operaci");

      const hiddenSections = navSections.filter((s) => !isOperacionesSection(s.id, s.label));

      const isAnyHiddenActive = hiddenSections.some((sec) =>
        sec.items.some((item) => isRouteActive(item.href, activePath, searchParams, item.exactMatch))
      );

      // Como 'ventas' está en 'operacion', no es un módulo oculto
      expect(isAnyHiddenActive).toBe(false);
    });
  });
});
