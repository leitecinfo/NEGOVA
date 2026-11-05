import { describe, it, expect } from "vitest";
import {
  CENTRALIZED_PLAN_EMPLOYEE_LIMITS,
  getPlanMaxEmployees,
  NEGOVA_PLANS,
} from "@/config/plans";
import {
  DEFAULT_PRESET_CARGOS,
  getCargoBadgeStyles,
} from "@/lib/auth/cargos-service";
import { PLAN_RESOURCE_LIMITS } from "@/lib/subscriptions/plan-limits-service";
import fs from "fs";
import path from "path";

describe("Límites Centralizados de Empleados por Plan", () => {
  it("CENTRALIZED_PLAN_EMPLOYEE_LIMITS debe ser la única fuente de la verdad para todos los planes", () => {
    expect(CENTRALIZED_PLAN_EMPLOYEE_LIMITS.inicio.maxMembers).toBe(2);
    expect(CENTRALIZED_PLAN_EMPLOYEE_LIMITS.crece.maxMembers).toBe(3);
    expect(CENTRALIZED_PLAN_EMPLOYEE_LIMITS.negocio.maxMembers).toBe(6);

    // Contabilización: 1 Propietario + N Auxiliares
    expect(CENTRALIZED_PLAN_EMPLOYEE_LIMITS.inicio.maxAuxiliares).toBe(1);
    expect(CENTRALIZED_PLAN_EMPLOYEE_LIMITS.crece.maxAuxiliares).toBe(2);
    expect(CENTRALIZED_PLAN_EMPLOYEE_LIMITS.negocio.maxAuxiliares).toBe(5);
  });

  it("getPlanMaxEmployees debe resolver correctamente el límite según la clave o código del plan", () => {
    expect(getPlanMaxEmployees("inicio")).toBe(2);
    expect(getPlanMaxEmployees("starter")).toBe(2);
    expect(getPlanMaxEmployees("crece")).toBe(3);
    expect(getPlanMaxEmployees("professional")).toBe(3);
    expect(getPlanMaxEmployees("negocio")).toBe(6);
    expect(getPlanMaxEmployees("enterprise")).toBe(6);
  });

  it("NEGOVA_PLANS y PLAN_RESOURCE_LIMITS deben sincronizarse exactamente con la definición centralizada", () => {
    expect(NEGOVA_PLANS.inicio.limits.maxUsers).toBe(
      CENTRALIZED_PLAN_EMPLOYEE_LIMITS.inicio.maxMembers
    );
    expect(NEGOVA_PLANS.crece.limits.maxUsers).toBe(
      CENTRALIZED_PLAN_EMPLOYEE_LIMITS.crece.maxMembers
    );
    expect(NEGOVA_PLANS.negocio.limits.maxUsers).toBe(
      CENTRALIZED_PLAN_EMPLOYEE_LIMITS.negocio.maxMembers
    );

    expect(PLAN_RESOURCE_LIMITS.inicio.employees).toBe(2);
    expect(PLAN_RESOURCE_LIMITS.crece.employees).toBe(3);
    expect(PLAN_RESOURCE_LIMITS.negocio.employees).toBe(6);
  });
});

describe("Catálogo Multi-Vertical de Cargos Operativos", () => {
  it("debe contener presets para diferentes verticales (gastronomía, retail, belleza, servicios)", () => {
    expect(DEFAULT_PRESET_CARGOS).toContain("Cajero");
    expect(DEFAULT_PRESET_CARGOS).toContain("Mesero");
    expect(DEFAULT_PRESET_CARGOS).toContain("Cocinero");
    expect(DEFAULT_PRESET_CARGOS).toContain("Domiciliario");
    expect(DEFAULT_PRESET_CARGOS).toContain("Vendedor");
    expect(DEFAULT_PRESET_CARGOS).toContain("Barbero");
    expect(DEFAULT_PRESET_CARGOS).toContain("Peluquero");
    expect(DEFAULT_PRESET_CARGOS).toContain("Administrador operativo");
  });

  it("getCargoBadgeStyles debe asignar estilos semánticos coherentes con el diseño de NEGOVA", () => {
    const cajeroStyle = getCargoBadgeStyles("Cajero");
    expect(cajeroStyle.badgeClass).toContain("emerald");

    const meseroStyle = getCargoBadgeStyles("Mesero");
    expect(meseroStyle.badgeClass).toContain("amber");

    const cocineroStyle = getCargoBadgeStyles("Cocinero");
    expect(cocineroStyle.badgeClass).toContain("#ED500A");

    const barberoStyle = getCargoBadgeStyles("Barbero");
    expect(barberoStyle.badgeClass).toContain("violet");

    const customStyle = getCargoBadgeStyles("Parrillero Especial");
    expect(customStyle.badgeClass).toContain("#ED500A"); // Reconoce parrill como cocina
  });
});

describe("Regla Global: Prohibido uso de alertas nativas", () => {
  const filesToCheck = [
    "src/components/usuarios/assign-cargos-modal.tsx",
    "src/components/usuarios/cargo-badge.tsx",
    "src/lib/auth/cargos-service.ts",
    "src/app/workspace/[businessId]/usuarios/workspace-usuarios-client.tsx",
    "src/app/workspace/[businessId]/usuarios/nuevo/workspace-user-form-client.tsx",
    "src/app/workspace/[businessId]/usuarios/[id]/workspace-user-detail-client.tsx",
  ];

  it("ningún archivo nuevo o modificado debe contener alertas nativas (window.alert, window.confirm, window.prompt)", () => {
    const nativeAlertPatterns = [
      /\bwindow\.alert\b/,
      /\balert\(/,
      /\bwindow\.confirm\b/,
      /\bconfirm\(/,
      /\bwindow\.prompt\b/,
      /\bprompt\(/,
    ];

    for (const relativePath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relativePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        for (const pattern of nativeAlertPatterns) {
          // Excluir nombres de variables legítimos como confirmModal o confirmLabel
          const matches = content.match(pattern);
          if (matches) {
            // Verificar si es una invocación de alert() nativo real
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (
                line.includes("alert(") ||
                line.includes("window.alert") ||
                line.includes("window.confirm") ||
                line.includes("window.prompt")
              ) {
                // Si no es parte de una palabra compuesta
                const isInvocation = /(?<![a-zA-Z0-9_])(window\.)?(alert|confirm|prompt)\s*\(/.test(line);
                expect(
                  isInvocation,
                  `Alerta nativa encontrada en ${relativePath}:${i + 1} -> ${line.trim()}`
                ).toBe(false);
              }
            }
          }
        }
      }
    }
  });
});

