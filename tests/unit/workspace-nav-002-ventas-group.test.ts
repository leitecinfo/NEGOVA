import { describe, it, expect } from "vitest";
import {
  WORKSPACE_NAV_GROUPS,
  WORKSPACE_MODULES_CATALOG,
  buildWorkspaceNavSections,
  getWorkspaceModuleById,
} from "../../src/config/workspace-navigation";
import fs from "fs";
import path from "path";

describe("[NAV-002] Sidebar: Nuevo grupo 'Ventas' con 'Historial' y 'Caja'", () => {
  const businessId = "biz-test-123";

  it("WORKSPACE_NAV_GROUPS: debe definir el grupo canónico 'ventas' con etiqueta 'Ventas'", () => {
    const ventasGroup = WORKSPACE_NAV_GROUPS.find((g) => g.id === "ventas");
    expect(ventasGroup).toBeDefined();
    expect(ventasGroup?.label).toBe("Ventas");
  });

  it("WORKSPACE_MODULES_CATALOG: debe contener 'ventas' (Historial) y 'caja' (Caja) asignados al grupo 'ventas'", () => {
    const historialMod = getWorkspaceModuleById("ventas");
    expect(historialMod).toBeDefined();
    expect(historialMod?.label).toBe("Historial");
    expect(historialMod?.group).toBe("ventas");
    expect(historialMod?.href).toBe("ventas");
    expect(historialMod?.shortDescription).toBe("Historial de ventas y cotizaciones.");
    expect(historialMod?.status).toBe("implemented");
    expect(historialMod?.showInMenu).toBe(true);

    const cajaMod = getWorkspaceModuleById("caja");
    expect(cajaMod).toBeDefined();
    expect(cajaMod?.label).toBe("Caja");
    expect(cajaMod?.group).toBe("ventas");
    expect(cajaMod?.href).toBe("caja");
    expect(cajaMod?.shortDescription).toBe("Control de cajas, turnos y arqueos.");
    expect(cajaMod?.status).toBe("implemented");
    expect(cajaMod?.showInMenu).toBe(true);
  });

  it("buildWorkspaceNavSections: debe generar la sección 'ventas' con URLs absolutas hacia /ventas y /caja", () => {
    // 1. Negocio estándar / retail
    const retailSections = buildWorkspaceNavSections(businessId, {
      businessType: "retail",
    });
    const retailVentas = retailSections.find((s) => s.id === "ventas");
    expect(retailVentas).toBeDefined();
    expect(retailVentas?.label).toBe("Ventas");
    expect(retailVentas?.items).toHaveLength(2);

    expect(retailVentas?.items[0].id).toBe("ventas");
    expect(retailVentas?.items[0].label).toBe("Historial");
    expect(retailVentas?.items[0].href).toBe(`/workspace/${businessId}/ventas`);

    expect(retailVentas?.items[1].id).toBe("caja");
    expect(retailVentas?.items[1].label).toBe("Caja");
    expect(retailVentas?.items[1].href).toBe(`/workspace/${businessId}/caja`);

    // 2. Negocio gastronómico
    const gastroSections = buildWorkspaceNavSections(businessId, {
      businessType: "restaurant",
    });
    const gastroVentas = gastroSections.find((s) => s.id === "ventas");
    expect(gastroVentas).toBeDefined();
    expect(gastroVentas?.items.map((i) => i.id)).toEqual(["ventas", "caja"]);
  });

  it("app-sidebar: debe incluir 'ventas: true' en openSections para permitir colapsar/expandir el grupo", () => {
    const sidebarPath = path.resolve("src/components/layout/app-sidebar.tsx");
    const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");

    // Verificar que el estado inicial contenga ventas: true
    expect(sidebarContent).toMatch(/ventas:\s*true/);
    // Verificar que se rendericen los grupos de forma accesible y colapsable
    expect(sidebarContent).toContain("toggleSection");
  });

  it("app-mobile-sidebar: debe incluir 'ventas: true' en openSections y responder en móvil", () => {
    const mobileSidebarPath = path.resolve("src/components/layout/app-mobile-sidebar.tsx");
    const mobileContent = fs.readFileSync(mobileSidebarPath, "utf-8");

    // Verificar que el estado inicial móvil contenga ventas: true
    expect(mobileContent).toMatch(/ventas:\s*true/);
    expect(mobileContent).toContain("toggleSection");
  });

  it("Regla Global: Prohibido uso de alertas nativas en app-sidebar y app-mobile-sidebar", () => {
    const sidebarPath = path.resolve("src/components/layout/app-sidebar.tsx");
    const mobilePath = path.resolve("src/components/layout/app-mobile-sidebar.tsx");

    const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
    const mobileContent = fs.readFileSync(mobilePath, "utf-8");

    [sidebarContent, mobileContent].forEach((content) => {
      expect(content).not.toMatch(/\bwindow\.alert\s*\(/);
      expect(content).not.toMatch(/\balert\s*\(/);
      expect(content).not.toMatch(/\bwindow\.confirm\s*\(/);
      expect(content).not.toMatch(/\bconfirm\s*\(/);
      expect(content).not.toMatch(/\bwindow\.prompt\s*\(/);
      expect(content).not.toMatch(/\bprompt\s*\(/);
    });
  });
});
