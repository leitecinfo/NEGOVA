import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";
import {
  WorkspaceSidebarSubscriptionWidget,
} from "@/components/workspace/workspace-sidebar-subscription-widget";

describe("[SUB-002] Widget de plan y límites en UI (Sidebar y Configuración)", () => {
  it("muestra el nombre del plan con badge y barras de progreso de productos y empleados", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSidebarSubscriptionWidget
        businessId="biz-123"
        planName="Profesional"
        productCount={45}
        employeeCount={8}
        planLimits={{
          maxProducts: 500,
          maxUsers: 15,
          maxBranches: 2,
          canUsePos: true,
          canUseAiAssistant: true,
          canUseMultipleRoles: true,
          canUseCreditAndDebts: true,
          canUseAdvancedReports: true,
          supportLevel: "priority",
        }}
        upgradeUrl="/workspace/biz-123/configuracion?tab=mi-negocio"
      />
    );

    // Nombre del plan y badge
    expect(html).toContain("Plan Profesional");
    expect(html).toContain("Activo");

    // Barra de Productos: 45 / 500 (9%)
    expect(html).toContain("Productos");
    expect(html).toContain("45 / 500 (9%)");

    // Barra de Usuarios: 8 / 15 (53%)
    expect(html).toContain("Usuarios");
    expect(html).toContain("8 / 15 (53%)");

    // Enlace Mejorar plan
    expect(html).toContain("Mejorar plan");
    expect(html).toContain('href="/workspace/biz-123/configuracion?tab=mi-negocio"');
  });

  it("cambia a color de advertencia (amarillo/ámbar) en la barra cuando se alcanza el 80% del límite sin alarmar la cabecera", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSidebarSubscriptionWidget
        businessId="biz-warning"
        planName="Profesional"
        productCount={400} // 400 / 500 = 80%
        employeeCount={3}
        planLimits={{
          maxProducts: 500,
          maxUsers: 15,
          maxBranches: 2,
          canUsePos: true,
          canUseAiAssistant: true,
          canUseMultipleRoles: true,
          canUseCreditAndDebts: true,
          canUseAdvancedReports: true,
          supportLevel: "priority",
        }}
      />
    );

    // Barra en amarillo / ámbar para el recurso al 80%
    expect(html).toContain("bg-amber-500");
    // Cabecera mantiene estado habitual Activo y no alarma global falsa
    expect(html).toContain("Activo");
    expect(html).not.toContain("Límite alcanzado");
  });

  it("cambia a color rojo y muestra 'Límite alcanzado' cuando se alcanza el 100% de un recurso", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSidebarSubscriptionWidget
        businessId="biz-critical"
        planName="Profesional"
        productCount={500} // 100%
        employeeCount={15} // 100%
        planLimits={{
          maxProducts: 500,
          maxUsers: 15,
          maxBranches: 2,
          canUsePos: true,
          canUseAiAssistant: true,
          canUseMultipleRoles: true,
          canUseCreditAndDebts: true,
          canUseAdvancedReports: true,
          supportLevel: "priority",
        }}
      />
    );

    // Barra en rojo
    expect(html).toContain("bg-rose-500");
    // Badge y texto de límite alcanzado
    expect(html).toContain("Límite alcanzado");
  });

  it("incluye atributos title detallados en cada barra de progreso como tooltip", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSidebarSubscriptionWidget
        businessId="biz-tooltip"
        planName="Profesional"
        productCount={45}
        employeeCount={8}
        planLimits={{
          maxProducts: 500,
          maxUsers: 15,
          maxBranches: 2,
          canUsePos: true,
          canUseAiAssistant: true,
          canUseMultipleRoles: true,
          canUseCreditAndDebts: true,
          canUseAdvancedReports: true,
          supportLevel: "priority",
        }}
      />
    );

    // Tooltip de productos
    expect(html).toContain('title="Productos: 45 de 500 usados (9%). Te quedan 455 disponibles."');
    // Tooltip de usuarios
    expect(html).toContain('title="Usuarios: 8 de 15 usados (53%). Te quedan 7 disponibles."');
  });

  it("renderiza correctamente en modo colapsado para el sidebar", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSidebarSubscriptionWidget
        businessId="biz-collapsed"
        planName="Profesional"
        isCollapsed={true}
        productCount={10}
        employeeCount={2}
        upgradeUrl="/planes"
      />
    );

    expect(html).toContain('href="/planes"');
    expect(html).toContain("Plan Profesional");
  });

  it("verifica que la página de configuración del negocio contiene la sección y tabla de límites y uso actual", () => {
    const configuracionFile = path.resolve(
      process.cwd(),
      "src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx"
    );
    const content = fs.readFileSync(configuracionFile, "utf-8");

    // Verificar presencia de la sección "Tu plan y límites de uso"
    expect(content).toContain("Tu plan y límites de uso");
    // Verificar tabla de límites y consumo actual
    expect(content).toContain("Tabla de límites y uso actual");
    expect(content).toContain("Recurso / Capacidad");
    expect(content).toContain("Uso Actual");
    expect(content).toContain("Límite");
    expect(content).toContain("Consumo");
    expect(content).toContain("Productos en catálogo");
    expect(content).toContain("Empleados y usuarios");
  });

  it("cumple con la política de cero alertas nativas (sin window.alert, window.confirm, etc.)", () => {
    const filesToCheck = [
      path.resolve(process.cwd(), "src/components/workspace/workspace-sidebar-subscription-widget.tsx"),
      path.resolve(process.cwd(), "src/components/workspace/workspace-shell.tsx"),
      path.resolve(process.cwd(), "src/app/workspace/[businessId]/layout.tsx"),
      path.resolve(process.cwd(), "src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx"),
    ];

    const forbiddenPatterns = [
      /\bwindow\.alert\s*\(/,
      /\bwindow\.confirm\s*\(/,
      /\bwindow\.prompt\s*\(/,
      /\bAlert\.alert\s*\(/,
    ];

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf-8");
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }
  });
});
