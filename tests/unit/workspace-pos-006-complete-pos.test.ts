import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { calculateCartSummary, calculateItemTax, PosCartItem } from "@/lib/pos/types";

describe("[POS-006] Sistema POS Integral - Especificación, Componentes y Lógica", () => {
  const componentsDir = path.resolve(__dirname, "../../src/components/pos");

  describe("1. Existencia e Integridad de Componentes", () => {
    it("debe existir el modal de Ítem Libre (pos-item-libre-modal.tsx)", () => {
      const filePath = path.join(componentsDir, "pos-item-libre-modal.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function PosItemLibreModal");
      expect(content).toContain("Ítem libre");
      expect(content).toContain("onAddItem");
      expect(content).not.toContain("window.alert");
    });

    it("debe existir el modal de Descuento Individual (pos-discount-modal.tsx)", () => {
      const filePath = path.join(componentsDir, "pos-discount-modal.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function PosDiscountModal");
      expect(content).toContain("Descuento individual");
      expect(content).toContain("QUICK_PERCENTAGES");
      expect(content).not.toContain("window.alert");
    });

    it("debe existir el modal de Editar Precio (pos-edit-price-modal.tsx)", () => {
      const filePath = path.join(componentsDir, "pos-edit-price-modal.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function PosEditPriceModal");
      expect(content).toContain("Editar precio");
      expect(content).toContain("currentUnitPrice");
      expect(content).not.toContain("window.alert");
    });

    it("debe existir el modal de Selección de Cliente (pos-select-customer-modal.tsx)", () => {
      const filePath = path.join(componentsDir, "pos-select-customer-modal.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function PosSelectCustomerModal");
      expect(content).toContain("Seleccionar Cliente");
      expect(content).toContain("searchCustomersForPosAction");
      expect(content).not.toContain("window.alert");
    });

    it("debe existir el modal de Comanda de Cocina (pos-kitchen-ticket-modal.tsx)", () => {
      const filePath = path.join(componentsDir, "pos-kitchen-ticket-modal.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function PosKitchenTicketModal");
      expect(content).toContain("KitchenTicketData");
      expect(content).toContain("COMER AQUÍ");
      expect(content).not.toContain("window.alert");
    });

    it("debe existir el modal de Factura / Recibo de Venta (pos-invoice-modal.tsx)", () => {
      const filePath = path.join(componentsDir, "pos-invoice-modal.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function PosInvoiceModal");
      expect(content).toContain("No responsable de IVA");
      expect(content).toContain("InvoiceData");
      expect(content).not.toContain("window.alert");
    });

    it("debe existir el drawer de Tickets Abiertos (pos-open-tickets-drawer.tsx)", () => {
      const filePath = path.join(componentsDir, "pos-open-tickets-drawer.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function PosOpenTicketsDrawer");
      expect(content).toContain("Tickets Abiertos");
      expect(content).toContain("Ir a Mis Órdenes");
      expect(content).not.toContain("window.alert");
    });
  });

  describe("2. Integración en PosScreenClient", () => {
    it("debe contener la barra superior con los elementos requeridos", () => {
      const screenPath = path.join(componentsDir, "pos-screen-client.tsx");
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Buscar producto, SKU o código...");
      expect(content).toContain("setIsOpenTicketsDrawerOpen");
      expect(content).toContain("activeCashSession");
      expect(content).toContain("gridDensity");
    });

    it("debe soportar la conmutación de densidad visual del catálogo", () => {
      const screenPath = path.join(componentsDir, "pos-screen-client.tsx");
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("gridDensity");
      expect(content).toContain("setGridDensity");
      expect(content).toContain("large");
      expect(content).toContain("medium");
      expect(content).toContain("compact");
      expect(content).toContain("list");
    });

    it("debe mostrar la tarjeta de ítem libre en la cuadrícula de catálogo", () => {
      const screenPath = path.join(componentsDir, "pos-screen-client.tsx");
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Personalizado");
      expect(content).toContain("Texto libre");
      expect(content).toContain("Precio libre");
      expect(content).toContain("setIsItemLibreModalOpen(true)");
    });

    it("debe contener el flujo de cobro lateral en 2 pasos", () => {
      const screenPath = path.join(componentsDir, "pos-screen-client.tsx");
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("isCheckoutStepActive");
      expect(content).toContain("Tipo de Servicio");
      expect(content).toContain("Para llevar");
      expect(content).toContain("Comer aquí");
      expect(content).toContain("Para recoger");
      expect(content).toContain("Domicilio");
      expect(content).toContain("Cobro del pedido");
      expect(content).toContain("Cobrar ahora");
      expect(content).toContain("Dejar pago pendiente");
      expect(content).toContain("Propina (Opcional)");
      expect(content).toMatch(/Confirmar pedido|Confirmar y cobrar/);
    });

    it("debe cumplir con la regla estricta de NO usar alertas nativas (window.alert)", () => {
      const screenPath = path.join(componentsDir, "pos-screen-client.tsx");
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).not.toContain("window.alert");
      expect(content).not.toContain("window.confirm");
    });
  });

  describe("3. Lógica de Cálculo de Carrito con Ítem Libre y Descuento", () => {
    it("debe calcular correctamente el resumen del pedido con ítems de catálogo e ítem libre", () => {
      const items: PosCartItem[] = [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "Hamburguesa Clásica",
          basePrice: 20000,
          unitPrice: 20000,
          quantity: 2,
          selectedModifiers: [],
          modifiersPrice: 0,
          lineTotal: 40000,
          taxPercentage: 0,
          taxIncludedInPrice: true,
          taxAmount: 0,
          netSubtotal: 40000,
        },
        {
          id: "custom-item-123",
          productId: "custom-item-123",
          productName: "Postre especial chef",
          basePrice: 15000,
          unitPrice: 15000,
          quantity: 1,
          selectedModifiers: [],
          modifiersPrice: 0,
          lineTotal: 15000,
          taxPercentage: 0,
          taxIncludedInPrice: true,
          taxAmount: 0,
          netSubtotal: 15000,
          isCustom: true,
        },
      ];

      const summary = calculateCartSummary(items);
      expect(summary.itemsCount).toBe(3);
      expect(summary.linesCount).toBe(2);
      expect(summary.subtotal).toBe(55000);
      expect(summary.total).toBe(55000);
    });

    it("debe liquidar base e impuesto correctamente en items con IVA", () => {
      const taxCalc = calculateItemTax(11900, 19, true);
      expect(taxCalc.netSubtotal).toBe(10000);
      expect(taxCalc.taxAmount).toBe(1900);
    });
  });
});
