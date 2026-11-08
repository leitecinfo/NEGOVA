import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpoilageFormModal } from "../../src/app/workspace/[businessId]/inventario/spoilage-form-modal";
import { StockAdjustmentModal } from "../../src/app/workspace/[businessId]/inventario/stock-adjustment-modal";
import { InventariableItem, ADJUSTMENT_UI_REASONS } from "../../src/lib/inventory/types";
import { SPOILAGE_UI_CAUSES, SPOILAGE_CAUSE_LABELS } from "../../src/lib/spoilage/types";

// Mock de Server Actions y ModalPortal para render SSR
vi.mock("../../src/app/workspace/[businessId]/inventario/actions", () => ({
  createSpoilageRecordAction: vi.fn(),
  executeStockAdjustmentAction: vi.fn(),
}));

vi.mock("@/components/ui/modal-portal", () => ({
  ModalPortal: ({ children }: any) => <div data-testid="modal-portal">{children}</div>,
  AdminModalPortal: ({ children }: any) => <div data-testid="modal-portal">{children}</div>,
}));

describe("NEGOVA — Corrección de Inventario: Modales, Overlays y Operaciones de Stock", () => {
  const sampleItems: InventariableItem[] = [
    {
      id: "prod-gaseosa",
      name: "Gaseosa Cola 350ml",
      sku: "GAS-350",
      categoryName: "Bebidas",
      itemType: "product",
      controlType: "direct",
      currentStock: 25,
      minStock: 5,
      cost: 2500,
      totalValue: 62500,
      status: "in_stock",
      unit: "un",
      trackStock: true,
    },
    {
      id: "prod-pan",
      name: "Pan Hamburguesa Brioche",
      sku: "PAN-BRI",
      categoryName: "Panadería",
      itemType: "ingredient",
      controlType: "direct",
      currentStock: 40,
      minStock: 10,
      cost: 800,
      totalValue: 32000,
      status: "in_stock",
      unit: "un",
      trackStock: true,
    },
    {
      id: "prod-carne-molida",
      name: "Carne de Res Molida",
      sku: "CAR-RES",
      categoryName: "Carnes",
      itemType: "ingredient",
      controlType: "direct",
      currentStock: 0, // Agotado
      minStock: 5,
      cost: 15000,
      totalValue: 0,
      status: "out_of_stock",
      unit: "kg",
      trackStock: true,
    },
    {
      id: "prod-hamburguesa-preparada",
      name: "Hamburguesa Especial La Bárbara",
      sku: "HAMB-ESP",
      categoryName: "Hamburguesas",
      itemType: "product",
      controlType: "recipe", // Producto preparado por receta
      currentStock: 0,
      minStock: 0,
      cost: 8500,
      totalValue: 0,
      status: "in_stock",
      unit: "unidad",
      trackStock: false,
    },
    {
      id: "prod-servicio-entrega",
      name: "Servicio de Domicilio Express",
      sku: "SERV-DOM",
      categoryName: "Servicios",
      itemType: "product",
      controlType: "direct",
      currentStock: 0,
      minStock: 0,
      cost: 0,
      totalValue: 0,
      status: "in_stock",
      unit: "servicio",
      trackStock: false, // Servicio sin stock
    },
  ];

  describe("1. Overlay oficial del sistema de diseño", () => {
    it("el modal de Registrar merma utiliza el overlay oficial bg-black/75 backdrop-blur-sm", () => {
      const html = renderToStaticMarkup(
        <SpoilageFormModal
          isOpen={true}
          onClose={() => {}}
          businessId="biz-1"
          items={sampleItems}
          onSuccess={() => {}}
        />
      );

      expect(html).toContain("bg-black/75");
      expect(html).toContain("backdrop-blur-sm");
      expect(html).not.toContain("bg-slate-950/70");
      expect(html).not.toContain("backdrop-blur-xs");
    });

    it("el modal de Ajuste manual utiliza el overlay oficial bg-black/75 backdrop-blur-sm", () => {
      const html = renderToStaticMarkup(
        <StockAdjustmentModal
          isOpen={true}
          onClose={() => {}}
          businessId="biz-1"
          items={sampleItems}
          onSuccess={() => {}}
        />
      );

      expect(html).toContain("bg-black/75");
      expect(html).toContain("backdrop-blur-sm");
      expect(html).not.toContain("bg-slate-950/70");
      expect(html).not.toContain("backdrop-blur-xs");
    });
  });

  describe("2. Reglas de selección de artículos para Registrar merma", () => {
    it("permite preseleccionar un artículo físico con stock disponible", () => {
      const html = renderToStaticMarkup(
        <SpoilageFormModal
          isOpen={true}
          onClose={() => {}}
          businessId="biz-1"
          items={sampleItems}
          initialItem={sampleItems[0]} // Gaseosa Cola 350ml
          onSuccess={() => {}}
        />
      );

      expect(html).toContain("Gaseosa Cola 350ml");
      expect(html).toContain("Stock disponible");
      expect(html).toContain("25 un");
    });

    it("no permite preseleccionar productos preparados por receta sin existencias físicas", () => {
      const html = renderToStaticMarkup(
        <SpoilageFormModal
          isOpen={true}
          onClose={() => {}}
          businessId="biz-1"
          items={sampleItems}
          initialItem={sampleItems[3]} // Hamburguesa Especial (receta)
          onSuccess={() => {}}
        />
      );

      // No debe renderizarse en vista fija de artículo a mermar
      expect(html).not.toContain("Hamburguesa Especial La Bárbara");
    });

    it("muestra estado vacío amigable cuando no existen artículos elegibles", () => {
      const emptyItems: InventariableItem[] = [
        sampleItems[3], // receta
        sampleItems[4], // servicio
      ];

      const html = renderToStaticMarkup(
        <SpoilageFormModal
          isOpen={true}
          onClose={() => {}}
          businessId="biz-1"
          items={emptyItems}
          onSuccess={() => {}}
        />
      );

      expect(html).toContain("No hay artículos con existencias disponibles");
    });
  });

  describe("3. Reglas de selección de artículos para Ajuste manual", () => {
    it("permite preseleccionar productos con stock directo e insumos (incluso con stock 0)", () => {
      const htmlConStock0 = renderToStaticMarkup(
        <StockAdjustmentModal
          isOpen={true}
          onClose={() => {}}
          businessId="biz-1"
          items={sampleItems}
          initialItem={sampleItems[2]} // Carne molida (stock 0)
          onSuccess={() => {}}
        />
      );

      expect(htmlConStock0).toContain("Carne de Res Molida");
      expect(htmlConStock0).toContain("Stock registrado");
      expect(htmlConStock0).toContain("0 kg");
    });

    it("no permite preseleccionar productos preparados por receta", () => {
      const htmlReceta = renderToStaticMarkup(
        <StockAdjustmentModal
          isOpen={true}
          onClose={() => {}}
          businessId="biz-1"
          items={sampleItems}
          initialItem={sampleItems[3]} // Hamburguesa Especial (receta)
          onSuccess={() => {}}
        />
      );

      expect(htmlReceta).not.toContain("Hamburguesa Especial La Bárbara");
    });
  });

  describe("4. Motivos oficiales reorganizados", () => {
    it("Registrar merma incluye las 7 causas oficiales sin duplicidades", () => {
      const causes = SPOILAGE_UI_CAUSES;
      expect(causes).toEqual([
        "expired",
        "damaged",
        "decomposed",
        "spilled",
        "handling_error",
        "stolen",
        "other",
      ]);

      expect(SPOILAGE_CAUSE_LABELS.expired).toBe("Producto vencido");
      expect(SPOILAGE_CAUSE_LABELS.damaged).toBe("Producto dañado");
      expect(SPOILAGE_CAUSE_LABELS.decomposed).toBe("Descomposición");
      expect(SPOILAGE_CAUSE_LABELS.spilled).toBe("Derrame o desperdicio");
      expect(SPOILAGE_CAUSE_LABELS.stolen).toBe("Pérdida o faltante");
      expect(SPOILAGE_CAUSE_LABELS.handling_error).toBe("Error de manipulación");
      expect(SPOILAGE_CAUSE_LABELS.other).toBe("Otro motivo");
    });

    it("Ajuste manual incluye los 7 motivos oficiales ordenados", () => {
      expect(ADJUSTMENT_UI_REASONS).toEqual([
        "initial_inventory",
        "correction",
        "physical_count",
        "return",
        "internal_use",
        "sample",
        "other",
      ]);
    });
  });

  describe("5. Componentes oficiales del sistema de diseño", () => {
    it("ambos modales utilizan NumberInput con controles interactivos de incremento y decremento", () => {
      const htmlMerma = renderToStaticMarkup(
        <SpoilageFormModal
          isOpen={true}
          onClose={() => {}}
          businessId="biz-1"
          items={sampleItems}
          onSuccess={() => {}}
        />
      );

      expect(htmlMerma).toContain('role="spinbutton"');
      expect(htmlMerma).toContain('aria-label="Aumentar cantidad"');
      expect(htmlMerma).toContain('aria-label="Disminuir cantidad"');

      const htmlAjuste = renderToStaticMarkup(
        <StockAdjustmentModal
          isOpen={true}
          onClose={() => {}}
          businessId="biz-1"
          items={sampleItems}
          onSuccess={() => {}}
        />
      );

      expect(htmlAjuste).toContain('role="spinbutton"');
      expect(htmlAjuste).toContain('aria-label="Aumentar cantidad"');
      expect(htmlAjuste).toContain('aria-label="Disminuir cantidad"');
    });

    it("no contienen alertas nativas de JavaScript", () => {
      const htmlMerma = renderToStaticMarkup(
        <SpoilageFormModal
          isOpen={true}
          onClose={() => {}}
          businessId="biz-1"
          items={sampleItems}
          onSuccess={() => {}}
        />
      );
      expect(htmlMerma).not.toContain("window.alert");
      expect(htmlMerma).not.toContain("window.confirm");

      const htmlAjuste = renderToStaticMarkup(
        <StockAdjustmentModal
          isOpen={true}
          onClose={() => {}}
          businessId="biz-1"
          items={sampleItems}
          onSuccess={() => {}}
        />
      );
      expect(htmlAjuste).not.toContain("window.alert");
      expect(htmlAjuste).not.toContain("window.confirm");
    });
  });
});
