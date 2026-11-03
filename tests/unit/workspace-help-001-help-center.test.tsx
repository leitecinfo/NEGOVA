import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";
import {
  HELP_ARTICLES,
  HELP_FAQS,
  HELP_VIDEOS,
  resolveHelpContextFromPath,
} from "@/config/workspace-help-content";
import { WorkspaceHelpFloatingButton } from "@/components/workspace/workspace-help-floating-button";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/biz-test-123/pos",
  useSearchParams: () => new URLSearchParams(),
}));

describe("[HELP-001] Centro de Ayuda en Workspace", () => {
  describe("Contenido de Guías Rápidas", () => {
    it("contiene al menos un artículo por cada módulo principal del workspace", () => {
      const requiredModules = [
        "pos",
        "caja",
        "productos",
        "mesas",
        "cocina",
        "domicilios",
        "clientes",
        "reportes",
        "configuracion",
      ];

      for (const mod of requiredModules) {
        const found = HELP_ARTICLES.find((a) => a.moduleId === mod);
        expect(found, `Debe existir al menos un artículo para el módulo ${mod}`).toBeDefined();
        expect(found?.steps.length).toBeGreaterThanOrEqual(2);
        expect(found?.title.length).toBeGreaterThan(5);
        expect(found?.summary.length).toBeGreaterThan(10);
      }
    });

    it("cada guía cuenta con pasos secuenciales detallados", () => {
      for (const article of HELP_ARTICLES) {
        for (const step of article.steps) {
          expect(step.title).toBeTruthy();
          expect(step.description).toBeTruthy();
        }
      }
    });
  });

  describe("Preguntas Frecuentes (FAQs) y Videos Tutoriales", () => {
    it("contiene preguntas frecuentes estructuradas con categorías y respuestas", () => {
      expect(HELP_FAQS.length).toBeGreaterThanOrEqual(6);
      for (const faq of HELP_FAQS) {
        expect(faq.id).toBeTruthy();
        expect(faq.question).toBeTruthy();
        expect(faq.answer).toBeTruthy();
        expect(faq.category).toBeTruthy();
      }
    });

    it("contiene videos tutoriales con embeds y duraciones", () => {
      expect(HELP_VIDEOS.length).toBeGreaterThanOrEqual(3);
      for (const vid of HELP_VIDEOS) {
        expect(vid.id).toBeTruthy();
        expect(vid.title).toBeTruthy();
        expect(vid.duration).toBeTruthy();
        expect(vid.embedUrl).toMatch(/^https?:\/\//);
      }
    });
  });

  describe("Resolución Contextual de Rutas", () => {
    it("mapea rutas del workspace hacia su módulo de ayuda correspondiente", () => {
      expect(resolveHelpContextFromPath("/workspace/biz-1/pos")).toBe("pos");
      expect(resolveHelpContextFromPath("/workspace/biz-1/caja/turnos")).toBe("caja");
      expect(resolveHelpContextFromPath("/workspace/biz-1/productos/nuevo")).toBe("productos");
      expect(resolveHelpContextFromPath("/workspace/biz-1/mesas")).toBe("mesas");
      expect(resolveHelpContextFromPath("/workspace/biz-1/cocina")).toBe("cocina");
      expect(resolveHelpContextFromPath("/workspace/biz-1/pedidos/domicilios")).toBe("domicilios");
      expect(resolveHelpContextFromPath("/workspace/biz-1/clientes")).toBe("clientes");
      expect(resolveHelpContextFromPath("/workspace/biz-1/reportes/ventas")).toBe("reportes");
      expect(resolveHelpContextFromPath("/workspace/biz-1/configuracion/impresion")).toBe("configuracion");
    });
  });

  describe("Botón Flotante '?' Contextual", () => {
    it("renderiza el botón flotante con el enlace contextual al POS", () => {
      const html = renderToStaticMarkup(
        <WorkspaceHelpFloatingButton businessId="biz-test-123" />
      );

      expect(html).toContain('href="/workspace/biz-test-123/ayuda?context=pos"');
      expect(html).toContain("Ayuda:");
      expect(html).toContain("Punto de Venta (POS)");
    });
  });

  describe("Integración con Navegación y Shell", () => {
    it("verifica que el módulo 'ayuda' está registrado en workspace-navigation.ts", () => {
      const navFile = path.resolve(process.cwd(), "src/config/workspace-navigation.ts");
      const content = fs.readFileSync(navFile, "utf-8");

      expect(content).toContain('id: "ayuda"');
      expect(content).toContain('href: "ayuda"');
      expect(content).toContain("Centro de Ayuda");
    });

    it("verifica que WorkspaceHelpFloatingButton está integrado en workspace-shell.tsx", () => {
      const shellFile = path.resolve(process.cwd(), "src/components/workspace/workspace-shell.tsx");
      const content = fs.readFileSync(shellFile, "utf-8");

      expect(content).toContain("WorkspaceHelpFloatingButton");
      expect(content).toContain("<WorkspaceHelpFloatingButton businessId={businessId} />");
    });
  });

  describe("Cumplimiento Estricto de Cero Alertas Nativas", () => {
    it("garantiza que ningún archivo del centro de ayuda use window.alert, window.confirm, window.prompt o Alert.alert", () => {
      const filesToCheck = [
        path.resolve(process.cwd(), "src/config/workspace-help-content.ts"),
        path.resolve(process.cwd(), "src/components/workspace/workspace-help-floating-button.tsx"),
        path.resolve(process.cwd(), "src/app/workspace/[businessId]/ayuda/actions.ts"),
        path.resolve(process.cwd(), "src/app/workspace/[businessId]/ayuda/workspace-help-client.tsx"),
        path.resolve(process.cwd(), "src/app/workspace/[businessId]/ayuda/page.tsx"),
        path.resolve(process.cwd(), "src/components/workspace/workspace-shell.tsx"),
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
});

