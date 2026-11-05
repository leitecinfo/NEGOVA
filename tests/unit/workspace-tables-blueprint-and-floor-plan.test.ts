import { describe, it, expect } from "vitest";
import {
  inferTableShape,
  computeDefaultFloorPlan,
} from "@/lib/restaurant/table-layout-storage";
import fs from "fs";
import path from "path";

describe("NEGOVA — Dibujos Técnicos de Mesas y Plano de Sala 2D", () => {
  it("prohíbe el uso de alertas nativas en todos los componentes de mesas", () => {
    const filesToCheck = [
      "src/components/mesas/table-blueprint-illustration.tsx",
      "src/components/mesas/table-floor-plan-view.tsx",
      "src/lib/restaurant/table-layout-storage.ts",
      "src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx",
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toMatch(/\bwindow\.alert\s*\(/);
        expect(content).not.toMatch(/\bwindow\.confirm\s*\(/);
        expect(content).not.toMatch(/\bwindow\.prompt\s*\(/);
        expect(content).not.toMatch(/\bAlert\.alert\s*\(/);
      }
    }
  });

  it("infiere las formas geométricas correctamente según capacidad y nombre", () => {
    expect(inferTableShape(4, "Barra Central")).toBe("bar");
    expect(inferTableShape(2, "Bar")).toBe("bar");
    expect(inferTableShape(2, "Mesa 1")).toBe("square");
    expect(inferTableShape(4, "Mesa 2")).toBe("round");
    expect(inferTableShape(6, "Mesa Familiar")).toBe("rectangle");
    expect(inferTableShape(8, "Mesa 10")).toBe("rectangle");
  });

  it("calcula distribución de plano de sala con coordenadas porcentuales y presets", () => {
    const mockTables = [
      { id: "tbl-1", name_or_number: "Mesa 1", capacity: 4 },
      { id: "tbl-2", name_or_number: "Mesa 2", capacity: 2 },
      { id: "tbl-3", name_or_number: "Mesa 3", capacity: 8 },
      { id: "tbl-4", name_or_number: "Barra 1", capacity: 3 },
    ];

    const plan = computeDefaultFloorPlan(mockTables, "rectangle");
    expect(plan.roomShapePreset).toBe("rectangle");
    expect(Object.keys(plan.tables)).toHaveLength(4);

    expect(plan.tables["tbl-1"].shape).toBe("round");
    expect(plan.tables["tbl-2"].shape).toBe("square");
    expect(plan.tables["tbl-3"].shape).toBe("rectangle");
    expect(plan.tables["tbl-4"].shape).toBe("bar");

    // Coordenadas deben estar entre 0 y 100
    for (const pos of Object.values(plan.tables)) {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.x).toBeLessThanOrEqual(100);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeLessThanOrEqual(100);
    }
  });

  it("verifica que TableBlueprintIllustration y TableFloorPlanView están integrados en el dashboard", () => {
    const dashboardFile = path.resolve(
      process.cwd(),
      "src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx"
    );
    const content = fs.readFileSync(dashboardFile, "utf-8");

    expect(content).toContain("TableBlueprintIllustration");
    expect(content).toContain("TableFloorPlanView");
    expect(content).toContain("tablesViewMode");
    expect(content).toContain("Plano Salón");
    expect(content).toContain("Lista Rápida");
    expect(content).toContain("createTableShape");
    expect(content).toContain("editTableShape");
  });
});
