import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";
import { ProductDetailModal } from "@/components/menu/product-detail-modal";
import { validateModifierGroupSelection, validateAllModifierGroups } from "@/lib/pos/types";
import { Product, ProductModifierGroup } from "@/lib/products/types";
import { DigitalMenuPublicBusiness } from "@/lib/menu/types";

// Mock de sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const mockBusiness: DigitalMenuPublicBusiness = {
  id: "biz-1",
  name: "Restaurante Demo",
  slug: "demo",
  currency: "COP",
  whatsapp: "573001234567",
  phone: "3001234567",
};

describe("MEN-002: Validation of Min/Max Modifiers in QR Menu UI", () => {
  const modalFilePath = path.resolve(process.cwd(), "src/components/menu/product-detail-modal.tsx");
  const modalCode = fs.readFileSync(modalFilePath, "utf-8");

  describe("Global Rules & Static Code Integrity", () => {
    it("should strictly prohibit native alerts in product-detail-modal", () => {
      expect(modalCode).not.toMatch(/window\.(alert|confirm|prompt)/);
      expect(modalCode).not.toMatch(/Alert\.alert/);
    });

    it("should import canonical modifier validation functions from pos types", () => {
      expect(modalCode).toContain("validateModifierGroupSelection");
      expect(modalCode).toContain("validateAllModifierGroups");
    });

    it("should include validation check in onAddToCart click handler", () => {
      expect(modalCode).toContain("disabled={!validation.isValid}");
      expect(modalCode).toContain("validation.isValid");
      expect(modalCode).toContain("validation.error");
    });

    it("should warn user when attempting to select more options than max_select", () => {
      expect(modalCode).toContain("toast.warning");
      expect(modalCode).toContain("Límite alcanzado: puedes seleccionar como máximo");
    });
  });

  describe("Helper Functions: validateModifierGroupSelection and validateAllModifierGroups", () => {
    it("should invalidate when required group has 0 options selected", () => {
      const group: ProductModifierGroup = {
        name: "Término de la carne",
        required: true,
        max_select: 1,
        options: [
          { name: "Tres cuartos", price: 0 },
          { name: "Bien asado", price: 0 },
        ],
      };

      const result = validateModifierGroupSelection(group, []);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Debes seleccionar al menos una opción en «Término de la carne»");
    });

    it("should validate when required group has 1 option selected", () => {
      const group: ProductModifierGroup = {
        name: "Término de la carne",
        required: true,
        max_select: 1,
        options: [
          { name: "Tres cuartos", price: 0 },
          { name: "Bien asado", price: 0 },
        ],
      };

      const result = validateModifierGroupSelection(group, ["Tres cuartos"]);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should invalidate when selection exceeds max_select", () => {
      const group: ProductModifierGroup = {
        name: "Salsas",
        required: false,
        max_select: 2,
        options: [
          { name: "BBQ", price: 0 },
          { name: "Mostaza miel", price: 0 },
          { name: "Ajo", price: 0 },
        ],
      };

      const result = validateModifierGroupSelection(group, ["BBQ", "Mostaza miel", "Ajo"]);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Puedes seleccionar como máximo 2 opciones en «Salsas» (has seleccionado 3)");
    });

    it("should invalidate when selection is below min_select", () => {
      const group: ProductModifierGroup = {
        name: "Toppings",
        required: false,
        min_select: 2,
        max_select: 4,
        options: [
          { name: "Queso", price: 1000 },
          { name: "Tocineta", price: 2000 },
          { name: "Cebolla", price: 500 },
        ],
      };

      const result = validateModifierGroupSelection(group, ["Queso"]);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Debes seleccionar al menos 2 opciones en «Toppings» (has seleccionado 1)");
    });

    it("should validate all groups collectively via validateAllModifierGroups", () => {
      const groups: ProductModifierGroup[] = [
        {
          name: "Bebida",
          required: true,
          max_select: 1,
          options: [{ name: "Coca Cola", price: 0 }],
        },
        {
          name: "Acompañamiento",
          required: false,
          max_select: 1,
          options: [{ name: "Papas", price: 0 }],
        },
      ];

      // Caso 1: falta requerida
      const res1 = validateAllModifierGroups(groups, { Bebida: [] });
      expect(res1.isValid).toBe(false);

      // Caso 2: requerida completada
      const res2 = validateAllModifierGroups(groups, { Bebida: ["Coca Cola"] });
      expect(res2.isValid).toBe(true);
    });
  });

  describe("UI Component Markup: ProductDetailModal", () => {
    const productWithRequiredModifiers: Product = {
      id: "prod-1",
      business_id: "biz-1",
      name: "Hamburguesa Especial",
      description: "Carne angus con queso fundido",
      price: 25000,
      is_available: true,
      category_id: "cat-1",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        modifier_groups: [
          {
            id: "group-meat",
            name: "Término de la carne",
            required: true,
            max_select: 1,
            options: [
              { id: "opt-1", name: "Tres cuartos", price: 0, is_available: true },
              { id: "opt-2", name: "Bien asada", price: 0, is_available: true },
            ],
          },
          {
            id: "group-sauces",
            name: "Salsas adicionales",
            required: false,
            max_select: 2,
            options: [
              { id: "opt-s1", name: "Salsa BBQ", price: 1500, is_available: true },
              { id: "opt-s2", name: "Salsa de Ajo", price: 1500, is_available: true },
            ],
          },
        ],
      },
    };

    it("should render error notice and disable button when required modifier is missing", () => {
      const html = renderToStaticMarkup(
        <ProductDetailModal
          product={productWithRequiredModifiers}
          isOpen={true}
          onClose={vi.fn()}
          business={mockBusiness}
          onAddToCart={vi.fn()}
        />
      );

      // Contiene badge 'Obligatorio'
      expect(html).toContain("Obligatorio");

      // Contiene mensaje de error del grupo requerido
      expect(html).toContain("Debes seleccionar al menos una opción en «Término de la carne»");

      // El botón de acción debe tener el atributo disabled
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*style="background-color:#2563EB"/i);
    });

    it("should render cleanly without errors when product has no modifier groups", () => {
      const simpleProduct: Product = {
        id: "prod-simple",
        business_id: "biz-1",
        name: "Jugo Natural",
        price: 8000,
        is_available: true,
        category_id: "cat-1",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const html = renderToStaticMarkup(
        <ProductDetailModal
          product={simpleProduct}
          isOpen={true}
          onClose={vi.fn()}
          business={mockBusiness}
          onAddToCart={vi.fn()}
        />
      );

      expect(html).toContain("Jugo Natural");
      // Sin modificadores requeridos pendientes, el botón de agregar debe estar habilitado (sin disabled="")
      expect(html).toMatch(/<button[^>]*style="background-color:#2563EB"[^>]*>.*?Agregar al Pedido/i);
      expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*style="background-color:#2563EB"/i);
    });
  });

  describe("Integration with Digital Menu Templates (MEN-001 & MEN-002)", () => {
    it("should verify all 4 templates use ProductDetailModal and implement search (MEN-001)", () => {
      const templates = ["comercial-template.tsx", "elegante-template.tsx", "urbana-template.tsx", "visual-template.tsx"];

      for (const t of templates) {
        const filePath = path.resolve(process.cwd(), "src/components/menu", t);
        const code = fs.readFileSync(filePath, "utf-8");

        // MEN-001: Búsqueda reactiva de texto
        expect(code).toContain("search");
        expect(code).toContain("setSearch");
        expect(code).toContain("filterMenuProducts");
        expect(code).toContain("groupMenuProducts");

        // MEN-002: Usa ProductDetailModal
        expect(code).toContain("<ProductDetailModal");
      }
    });
  });
});
