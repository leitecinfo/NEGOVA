import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("CAJA-003: Cierre de Caja Integrado: Vistas de 'Cierre del Día' y 'Cierre por Rango'", () => {
  const cajaClientPath = path.resolve(
    process.cwd(),
    "src/components/cash/workspace-caja-client.tsx"
  );
  const dailyPanelPath = path.resolve(
    process.cwd(),
    "src/components/cash/daily-closure-panel.tsx"
  );
  const rangePanelPath = path.resolve(
    process.cwd(),
    "src/components/cash/date-range-closure-panel.tsx"
  );

  const cajaClientContent = fs.readFileSync(cajaClientPath, "utf-8");
  const dailyPanelContent = fs.readFileSync(dailyPanelPath, "utf-8");
  const rangePanelContent = fs.readFileSync(rangePanelPath, "utf-8");

  describe("1. Requisito Clave: Integración en la misma pantalla (/workspace/[businessId]/caja)", () => {
    it("debe renderizar tanto DailyClosurePanel como DateRangeClosurePanel dentro de la misma vista de caja", () => {
      expect(cajaClientContent).toContain("<DailyClosurePanel");
      expect(cajaClientContent).toContain("<DateRangeClosurePanel");
    });

    it("debe permitir acceso inmediato desde la cabecera superior a Cierre diario y Cierre por rango", () => {
      expect(cajaClientContent).toContain('setActiveTab("daily_closure")');
      expect(cajaClientContent).toContain('setActiveTab("range_closure")');
      expect(cajaClientContent).toContain("Cierre diario");
      expect(cajaClientContent).toContain("Cierre por rango");
    });

    it("debe incluir ambas opciones en la barra de pestañas de navegación", () => {
      expect(cajaClientContent).toContain('activeTab === "daily_closure"');
      expect(cajaClientContent).toContain('activeTab === "range_closure"');
    });
  });

  describe("2. Especificación: Cierre del Día", () => {
    it("debe incluir selector de fecha de consulta", () => {
      expect(dailyPanelContent).toContain('type="date"');
      expect(dailyPanelContent).toContain("selectedDate");
      expect(dailyPanelContent).toContain("setSelectedDate");
    });

    it("debe incluir resumen del día: Total Ventas (bruto), sin propinas, propinas y canales", () => {
      expect(dailyPanelContent).toContain("Total Ventas (Bruto)");
      expect(dailyPanelContent).toContain("Sin Propinas");
      expect(dailyPanelContent).toContain("Propinas");
      // Canales
      expect(dailyPanelContent).toContain("Mostrador");
      expect(dailyPanelContent).toContain("Mesas");
      expect(dailyPanelContent).toContain("Domicilios");
      expect(dailyPanelContent).toContain("Online");
    });

    it("debe incluir cuadre por método de pago: Efectivo, Transferencias, Tarjetas, Crédito, Otros", () => {
      expect(dailyPanelContent).toContain("Efectivo");
      expect(dailyPanelContent).toContain("Transferencias");
      expect(dailyPanelContent).toContain("Tarjetas");
      expect(dailyPanelContent).toContain("Crédito");
      expect(dailyPanelContent).toContain("Otros");
    });

    it("debe incluir las columnas: Total Sistema, Total Contado y Diferencia automática", () => {
      expect(dailyPanelContent).toContain("Total Sistema");
      expect(dailyPanelContent).toContain("Total Contado");
      expect(dailyPanelContent).toContain("Diferencia");
      expect(dailyPanelContent).toContain("countedInputs");
    });

    it("debe incluir campo de Notas del cierre (opcional)", () => {
      expect(dailyPanelContent).toContain("Notas del cierre");
      expect(dailyPanelContent).toContain("closure-observations");
    });

    it("debe incluir los botones de acción: 'Exportar PDF' y 'Guardar Cierre del Día'", () => {
      expect(dailyPanelContent).toContain("Exportar PDF");
      expect(dailyPanelContent).toContain("Guardar Cierre del Día");
    });
  });

  describe("3. Especificación: Cierre por Rango", () => {
    it("debe incluir intervalo con selectores de fecha/hora de inicio y fin con límite de 30 días", () => {
      expect(rangePanelContent).toContain("Fecha y Hora de Inicio");
      expect(rangePanelContent).toContain("Fecha y Hora Final");
      expect(rangePanelContent).toContain("startDate");
      expect(rangePanelContent).toContain("endDate");
      expect(rangePanelContent).toContain("30");
      expect(rangePanelContent).toContain("diffDays > 30");
    });

    it("debe incluir el botón exacto 'Calcular Cierre'", () => {
      expect(rangePanelContent).toContain("Calcular Cierre");
    });

    it("debe incluir resumen del intervalo por canales y desglose de propinas", () => {
      expect(rangePanelContent).toContain("Total Facturado (Bruto)");
      expect(rangePanelContent).toContain("Sin Propinas");
      expect(rangePanelContent).toContain("Desglose de Propinas");
      expect(rangePanelContent).toContain("Mostrador");
      expect(rangePanelContent).toContain("Mesas");
      expect(rangePanelContent).toContain("Domicilios");
      expect(rangePanelContent).toContain("Online");
    });

    it("debe incluir tabla de cuadre por método de pago con cálculo reactivo de diferencias", () => {
      expect(rangePanelContent).toContain("Total Sistema");
      expect(rangePanelContent).toContain("Total Contado");
      expect(rangePanelContent).toContain("Diferencia");
      expect(rangePanelContent).toContain("countedInputs");
    });

    it("debe incluir toggle entre 'Borrador' y 'Confirmado' para el estado del cierre", () => {
      expect(rangePanelContent).toContain("closureStatus");
      expect(rangePanelContent).toContain("Borrador");
      expect(rangePanelContent).toContain("Confirmado");
      expect(rangePanelContent).toContain('setClosureStatus("draft")');
      expect(rangePanelContent).toContain('setClosureStatus("confirmed")');
    });

    it("debe incluir notas del cierre y acciones: 'Exportar PDF' y 'Guardar Cierre'", () => {
      expect(rangePanelContent).toContain("Notas del cierre");
      expect(rangePanelContent).toContain("range-closure-notes");
      expect(rangePanelContent).toContain("Exportar PDF");
      expect(rangePanelContent).toContain("Guardar Cierre");
    });
  });

  describe("4. Criterios de Aceptación: Cuadre en Vivo y Cero Alertas Nativas", () => {
    it("debe validar el cuadre con colores indicativos de sobrante (azul), faltante (rojo) y exacto (verde)", () => {
      // Daily panel
      expect(dailyPanelContent).toContain("text-emerald");
      expect(dailyPanelContent).toContain("text-blue");
      expect(dailyPanelContent).toContain("text-rose");

      // Range panel
      expect(rangePanelContent).toContain("text-emerald");
      expect(rangePanelContent).toContain("text-blue");
      expect(rangePanelContent).toContain("text-rose");
    });

    it("no debe contener alertas nativas (window.alert, window.confirm, window.prompt)", () => {
      const files = [cajaClientContent, dailyPanelContent, rangePanelContent];
      for (const file of files) {
        expect(file).not.toMatch(/window\.alert\s*\(/);
        expect(file).not.toMatch(/window\.confirm\s*\(/);
        expect(file).not.toMatch(/window\.prompt\s*\(/);
        expect(file).not.toMatch(/(?<![a-zA-Z0-9_])alert\s*\(/);
      }
    });

    it("debe usar sonner toast para la comunicación de eventos y notificaciones", () => {
      expect(dailyPanelContent).toContain('import { toast } from "sonner"');
      expect(rangePanelContent).toContain('import { toast } from "sonner"');
      expect(cajaClientContent).toContain('import { toast } from "sonner"');
    });
  });
});
