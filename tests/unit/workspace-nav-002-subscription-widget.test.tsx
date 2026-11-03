import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";
import {
  WorkspaceSidebarSubscriptionWidget,
} from "@/components/workspace/workspace-sidebar-subscription-widget";
import { getBusinessSubscriptionDetails } from "@/lib/subscriptions/subscriptions-service";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { buildWorkspaceNavSections } from "@/config/workspace-navigation";

// Mock Supabase admin client for subscriptions
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockEq = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/test-biz/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/layout/navigation-progress-bar", () => ({
  useNavigationProgress: () => ({
    startNavigation: vi.fn(),
  }),
}));

describe("[NAV-002] Widget de suscripción y límites en el Sidebar de Workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Renderizado del Widget de Suscripción", () => {
    it("debe mostrar el nombre del plan actual y badge de activo para Plan Inicio", () => {
      const html = renderToStaticMarkup(
        <WorkspaceSidebarSubscriptionWidget
          businessId="biz-1"
          planId="inicio"
          productCount={25}
          planLimits={{ maxProducts: 200, maxUsers: 2, maxBranches: 1, maxRegistersPerBranch: 1 }}
          isTrialing={false}
          trialRemainingDays={null}
        />
      );

      expect(html).toContain("Plan Inicio");
      expect(html).toContain("Activo");
      expect(html).toContain("25 / 200 (13%)");
      expect(html).toContain("Actualizar plan");
      expect(html).toContain('href="/planes"');
    });

    it("debe mostrar el nombre de Plan Crece y la cuota de productos correcta", () => {
      const html = renderToStaticMarkup(
        <WorkspaceSidebarSubscriptionWidget
          businessId="biz-1"
          planId="crece"
          productCount={750}
          planLimits={{ maxProducts: 1000, maxUsers: 5, maxBranches: 2, maxRegistersPerBranch: 2 }}
          isTrialing={false}
        />
      );

      expect(html).toContain("Plan Crece");
      expect(html).toContain("750 / 1000 (75%)");
      // Color ámbar para uso >= 70%
      expect(html).toContain("bg-amber-500");
    });

    it("debe mostrar alerta crítica (rojo/rose) cuando el uso de productos supera el 90%", () => {
      const html = renderToStaticMarkup(
        <WorkspaceSidebarSubscriptionWidget
          businessId="biz-1"
          planId="inicio"
          productCount={190}
          planLimits={{ maxProducts: 200, maxUsers: 2, maxBranches: 1, maxRegistersPerBranch: 1 }}
          isTrialing={false}
        />
      );

      expect(html).toContain("190 / 200 (95%)");
      expect(html).toContain("bg-rose-500");
    });

    it("debe mostrar indicador de días de prueba restantes cuando isTrialing es verdadero", () => {
      const html = renderToStaticMarkup(
        <WorkspaceSidebarSubscriptionWidget
          businessId="biz-1"
          planId="crece"
          productCount={10}
          isTrialing={true}
          trialRemainingDays={18}
        />
      );

      expect(html).toContain("18d prueba");
      expect(html).not.toContain("Activo");
    });

    it("debe renderizar versión compacta y accesible cuando el sidebar está colapsado", () => {
      const html = renderToStaticMarkup(
        <WorkspaceSidebarSubscriptionWidget
          businessId="biz-1"
          planId="negocio"
          productCount={500}
          planLimits={{ maxProducts: 3000, maxUsers: 15, maxBranches: 5, maxRegistersPerBranch: 5 }}
          isCollapsed={true}
          isTrialing={true}
          trialRemainingDays={5}
        />
      );

      expect(html).toContain('href="/planes"');
      expect(html).toContain("Plan Negocio");
      expect(html).toContain("animate-pulse"); // Badge de prueba en icono compacto
      // En modo colapsado no se muestra el texto visible del botón ni la barra de progreso
      expect(html).not.toContain("<span>Actualizar plan</span>");
      expect(html).not.toContain('role="progressbar"');
    });

    it("debe soportar planes con cuota infinita sin romperse con división por cero", () => {
      const html = renderToStaticMarkup(
        <WorkspaceSidebarSubscriptionWidget
          businessId="biz-1"
          planId="negocio"
          productCount={420}
          planLimits={{ maxProducts: Infinity, maxUsers: Infinity, maxBranches: Infinity, maxRegistersPerBranch: Infinity }}
        />
      );

      expect(html).toContain("420 / ∞ (0%)");
      expect(html).toContain("Plan Negocio");
    });
  });

  describe("Integración con AppSidebar", () => {
    it("debe renderizar el widget en la sección footer del AppSidebar", () => {
      const navSections = buildWorkspaceNavSections("biz-app-sidebar", {
        businessType: "restaurant",
        isOwner: true,
        roleCode: "owner",
      });

      const html = renderToStaticMarkup(
        <AppSidebar
          isCollapsed={false}
          onToggleCollapse={() => {}}
          navSections={navSections}
          branding={{
            appTitle: "Mi Restaurante",
            homeUrl: "/workspace/biz-app-sidebar",
          }}
          sidebarFooterWidget={
            <WorkspaceSidebarSubscriptionWidget
              businessId="biz-app-sidebar"
              planId="crece"
              productCount={45}
            />
          }
        />
      );

      expect(html).toContain('data-testid="workspace-sidebar-subscription-widget"');
      expect(html).toContain("Plan Crece");
      expect(html).toContain("Actualizar plan");
    });
  });

  describe("Servicio Backend getBusinessSubscriptionDetails", () => {
    it("debe mapear correctamente un plan de prueba y calcular días restantes", async () => {
      const in15Days = new Date(Date.now() + 15 * 86400000).toISOString();
      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          plan_id: "plan_crece",
          status: "trial",
          trial_ends_at: in15Days,
          current_period_end: in15Days,
          created_at: new Date().toISOString(),
          plans: {
            code: "crece",
            name: "Plan Crece",
          },
        },
        error: null,
      });

      const details = await getBusinessSubscriptionDetails("biz-test-sub");
      expect(details.planId).toBe("crece");
      expect(details.planName).toBe("Crece");
      expect(details.isTrial).toBe(true);
      expect(details.status).toBe("trial");
      expect(details.trialRemainingDays).toBeGreaterThanOrEqual(14);
      expect(details.trialRemainingDays).toBeLessThanOrEqual(16);
    });

    it("debe retornar fallback por defecto en caso de error de base de datos", async () => {
      mockMaybeSingle.mockRejectedValueOnce(new Error("Database disconnected"));

      const details = await getBusinessSubscriptionDetails("biz-error");
      expect(details.planId).toBe("inicio");
      expect(details.planName).toBe("Inicio");
      expect(details.isTrial).toBe(false);
      expect(details.status).toBe("active");
      expect(details.trialRemainingDays).toBeNull();
    });
  });

  describe("Cumplimiento de Reglas Globales (Sin Alertas Nativas)", () => {
    it("no debe contener llamadas a alertas nativas en los archivos implementados", () => {
      const filesToCheck = [
        path.join(process.cwd(), "src/components/workspace/workspace-sidebar-subscription-widget.tsx"),
        path.join(process.cwd(), "src/components/workspace/workspace-shell.tsx"),
        path.join(process.cwd(), "src/components/layout/app-sidebar.tsx"),
        path.join(process.cwd(), "src/components/layout/app-mobile-sidebar.tsx"),
        path.join(process.cwd(), "src/components/layout/app-layout-shell.tsx"),
      ];

      for (const filePath of filesToCheck) {
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content).not.toMatch(/\bwindow\.alert\b/);
        expect(content).not.toMatch(/\bwindow\.confirm\b/);
        expect(content).not.toMatch(/\bwindow\.prompt\b/);
        expect(content).not.toMatch(/\bAlert\.alert\b/);
      }
    });
  });
});
