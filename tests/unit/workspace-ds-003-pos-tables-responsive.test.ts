import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("DS-003: Responsive Optimization for POS and Tables Modules", () => {
  const posClientPath = path.resolve(process.cwd(), "src/components/pos/pos-screen-client.tsx");
  const tablesClientPath = path.resolve(process.cwd(), "src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx");
  const modifierModalPath = path.resolve(process.cwd(), "src/components/pos/modifier-selection-modal.tsx");
  const destinationModalPath = path.resolve(process.cwd(), "src/components/pos/order-destination-modal.tsx");
  const paymentModalPath = path.resolve(process.cwd(), "src/components/payments/order-payment-modal.tsx");

  const posCode = fs.readFileSync(posClientPath, "utf-8");
  const tablesCode = fs.readFileSync(tablesClientPath, "utf-8");
  const modifierCode = fs.readFileSync(modifierModalPath, "utf-8");
  const destinationCode = fs.readFileSync(destinationModalPath, "utf-8");
  const paymentCode = fs.readFileSync(paymentModalPath, "utf-8");

  describe("Global Rule: Strict prohibition of native alerts", () => {
    it("should not use window.alert, window.confirm, window.prompt or Alert.alert in POS", () => {
      expect(posCode).not.toMatch(/window\.(alert|confirm|prompt)/);
      expect(posCode).not.toMatch(/Alert\.alert/);
    });

    it("should not use window.alert, window.confirm, window.prompt or Alert.alert in Tables", () => {
      expect(tablesCode).not.toMatch(/window\.(alert|confirm|prompt)/);
      expect(tablesCode).not.toMatch(/Alert\.alert/);
    });

    it("should not use window.alert, window.confirm, window.prompt or Alert.alert in Modals", () => {
      expect(modifierCode).not.toMatch(/window\.(alert|confirm|prompt)/);
      expect(destinationCode).not.toMatch(/window\.(alert|confirm|prompt)/);
      expect(paymentCode).not.toMatch(/window\.(alert|confirm|prompt)/);
    });
  });

  describe("POS Module: Responsive Design & Touch Accessibility", () => {
    it("should implement an adaptive grid for product catalog supporting mobile, tablet and desktop", () => {
      // 2 cols on mobile (< sm), 3 cols on sm, 4 cols on md (tablets), 2-3-4 cols on desktop
      expect(posCode).toContain("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4");
    });

    it("should provide horizontal fluid scroll for category pills without horizontal overflow", () => {
      expect(posCode).toContain("overflow-x-auto");
      expect(posCode).toContain("no-scrollbar");
      expect(posCode).toContain("scroll-smooth");
    });

    it("should offer an optimized persistent mobile bottom bar for order summary", () => {
      expect(posCode).toContain("lg:hidden fixed bottom-0 left-0 right-0");
      expect(posCode).toContain("safe-area-inset-bottom");
      expect(posCode).toContain("itemsCount");
      expect(posCode).toContain("formatCOP(summary.total)");
    });

    it("should offer a mobile cart drawer with comfortable touch targets", () => {
      expect(posCode).toContain("isMobileCartOpen");
      expect(posCode).toContain("max-h-[88vh]");
      // Touch-friendly buttons for quantity updates and deletion
      expect(posCode).toContain("min-h-[36px]");
      expect(posCode).toContain("min-w-[36px]");
      expect(posCode).toContain("min-h-[48px]");
    });

    it("should give fast add buttons comfortable hit areas for POS touch screens", () => {
      expect(posCode).toContain("w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl");
    });
  });

  describe("Tables Module: Responsive Design & Floor Layout", () => {
    it("should keep room filter pills accessible on all screen sizes (no hidden md:flex)", () => {
      expect(tablesCode).not.toContain("hidden md:flex items-center gap-1.5 overflow-x-auto");
      expect(tablesCode).toContain("overflow-x-auto no-scrollbar scroll-smooth");
    });

    it("should make view mode switcher (Plano Salón vs Lista Rápida) accessible on mobile", () => {
      expect(tablesCode).toContain("inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-white/5");
      expect(tablesCode).toContain("Plano Salón");
      expect(tablesCode).toContain("Lista Rápida");
    });

    it("should use responsive labels for header actions to prevent mobile toolbar overflow", () => {
      expect(tablesCode).toContain("<span className=\"hidden sm:inline\">Nueva </span>Mesa");
    });

    it("should provide an adaptive 2x2 touch button grid for occupied tables on mobile", () => {
      expect(tablesCode).toContain("grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:justify-between sm:gap-2");
      expect(tablesCode).toContain("min-h-[40px]");
      expect(tablesCode).toContain("min-h-[44px]");
    });

    it("should provide comfortable touch targets in quick list mode", () => {
      expect(tablesCode).toContain("min-h-[38px] min-w-[38px]");
    });

    it("should adapt table modals with max-height and scrolling for compact displays", () => {
      expect(tablesCode).toContain("max-h-[92vh] flex flex-col");
      expect(tablesCode).toContain("overflow-y-auto");
    });
  });

  describe("Associated Modals: Responsive & Touch Standards", () => {
    it("should have mobile-optimized safe area and touch targets in ModifierSelectionModal", () => {
      expect(modifierCode).toContain("min-h-[46px]");
      expect(modifierCode).toContain("min-h-[36px]");
      expect(modifierCode).toContain("safe-area-inset-bottom");
    });

    it("should have responsive action layout in OrderDestinationModal", () => {
      expect(destinationCode).toContain("flex-col-reverse sm:flex-row");
      expect(destinationCode).toContain("min-h-[44px]");
      expect(destinationCode).toContain("safe-area-inset-bottom");
    });

    it("should have touch-friendly action buttons in OrderPaymentModal", () => {
      expect(paymentCode).toContain("min-h-[44px]");
    });
  });
});

