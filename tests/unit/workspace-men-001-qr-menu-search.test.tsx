import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  filterMenuProducts,
  groupMenuProducts,
  getMenuCategoryPills,
} from "@/lib/menu/category-grouping";
import { Product, Category } from "@/lib/products/types";
import { UrbanaMenuTemplate } from "@/components/menu/urbana-template";
import { ComercialMenuTemplate } from "@/components/menu/comercial-template";
import { EleganteMenuTemplate } from "@/components/menu/elegante-template";
import { VisualMenuTemplate } from "@/components/menu/visual-template";
import fs from "fs";
import path from "path";

// Mock data para pruebas
const mockBusiness = {
  id: "biz_test_qr",
  name: "Restaurante Gourmet & Fast Food",
  slug: "restaurante-gourmet",
  currency: "COP",
  logo_url: "https://example.com/logo.png",
  banner_url: null,
  phone: "3001234567",
  whatsapp: "+573001234567",
  address: "Calle 100 # 15-20",
  city: "Bogotá",
  schedule: "Lun - Dom: 11:00 AM - 10:00 PM",
};

const mockCategories: Category[] = [
  {
    id: "cat_burgers",
    business_id: "biz_test_qr",
    name: "Hamburguesas",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "cat_drinks",
    business_id: "biz_test_qr",
    name: "Bebidas",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "cat_desserts",
    business_id: "biz_test_qr",
    name: "Postres",
    sort_order: 3,
    is_active: true,
  },
];

const mockProducts: Product[] = [
  {
    id: "prod_1",
    business_id: "biz_test_qr",
    category_id: "cat_burgers",
    name: "Hamburguesa Clásica Artesanal",
    description: "Carne angus 150g, queso cheddar fundido y vegetales frescos",
    price: 24000,
    cost: 10000,
    status: "active",
    is_available: true,
    available_in_qr: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_2",
    business_id: "biz_test_qr",
    category_id: "cat_burgers",
    name: "Hamburguesa Doble Queso BBQ",
    description: "Doble carne smash, tocineta crujiente y salsa BBQ ahumada",
    price: 32000,
    cost: 14000,
    status: "active",
    is_available: true,
    available_in_qr: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_3",
    business_id: "biz_test_qr",
    category_id: "cat_drinks",
    name: "Café Latte Especial",
    description: "Café de origen colombiano con leche vaporizada",
    price: 8000,
    cost: 2500,
    status: "active",
    is_available: true,
    available_in_qr: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_4",
    business_id: "biz_test_qr",
    category_id: "cat_drinks",
    name: "Limonada de Coco",
    description: "Refrescante jugo de limón con crema de coco natural",
    price: 12000,
    cost: 4000,
    status: "active",
    is_available: true,
    available_in_qr: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_hidden",
    business_id: "biz_test_qr",
    category_id: "cat_burgers",
    name: "Producto Solo POS",
    description: "No debe verse en el menú QR",
    price: 15000,
    cost: 5000,
    status: "active",
    is_available: true,
    available_in_qr: false, // Desactivado para QR
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe("MEN-001: Búsqueda de texto en menú QR público", () => {
  describe("1. Lógica de Filtrado Cliente-side (filterMenuProducts)", () => {
    it("debe filtrar productos por coincidencia exacta o parcial de nombre", () => {
      const results = filterMenuProducts(mockProducts, mockCategories, "Doble Queso", "all");
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Hamburguesa Doble Queso BBQ");
    });

    it("debe ser insensible a mayúsculas y minúsculas", () => {
      const resultsLower = filterMenuProducts(mockProducts, mockCategories, "hamburguesa", "all");
      const resultsUpper = filterMenuProducts(mockProducts, mockCategories, "HAMBURGUESA", "all");

      expect(resultsLower.length).toBe(2);
      expect(resultsUpper.length).toBe(2);
      expect(resultsLower.map((p) => p.id)).toEqual(["prod_1", "prod_2"]);
    });

    it("debe normalizar tildes / diacríticos (ej. 'cafe' encuentra 'Café Latte Especial')", () => {
      const resultsWithoutAccent = filterMenuProducts(mockProducts, mockCategories, "cafe", "all");
      const resultsWithAccent = filterMenuProducts(mockProducts, mockCategories, "café", "all");

      expect(resultsWithoutAccent.length).toBe(1);
      expect(resultsWithoutAccent[0].name).toBe("Café Latte Especial");
      expect(resultsWithAccent.length).toBe(1);
      expect(resultsWithAccent[0].name).toBe("Café Latte Especial");
    });

    it("debe normalizar tildes en 'limon' para encontrar 'Limonada de Coco'", () => {
      const results = filterMenuProducts(mockProducts, mockCategories, "limon", "all");
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Limonada de Coco");
    });

    it("debe excluir productos no disponibles en QR (available_in_qr = false)", () => {
      const results = filterMenuProducts(mockProducts, mockCategories, "Solo POS", "all");
      expect(results.length).toBe(0);
    });

    it("debe retornar array vacío cuando ningún producto coincide con el término", () => {
      const results = filterMenuProducts(mockProducts, mockCategories, "Sushi Roll Teriyaki", "all");
      expect(results.length).toBe(0);
    });
  });

  describe("2. Agrupación de Resultados de Búsqueda (groupMenuProducts)", () => {
    it("debe retornar sección única 'Resultados de búsqueda' cuando search no está vacío", () => {
      const filtered = filterMenuProducts(mockProducts, mockCategories, "hamburguesa", "all");
      const groups = groupMenuProducts(filtered, mockCategories, "all", "hamburguesa");

      expect(groups.length).toBe(1);
      expect(groups[0].categoryId).toBe("search-results");
      expect(groups[0].categoryName).toBe("Resultados de búsqueda");
      expect(groups[0].products.length).toBe(2);
    });

    it("debe retornar array vacío cuando filteredProducts está vacío", () => {
      const groups = groupMenuProducts([], mockCategories, "all", "producto_inexistente");
      expect(groups.length).toBe(0);
    });
  });

  describe("3. Estado Vacío 'No encontramos productos con ese nombre' en Plantillas", () => {
    it("UrbanaMenuTemplate: renderiza input de búsqueda y estado vacío con el mensaje requerido", () => {
      const html = renderToStaticMarkup(
        <UrbanaMenuTemplate
          business={mockBusiness}
          categories={mockCategories}
          products={[]} // Sin productos para forzar el estado vacío
        />
      );

      // Verificamos que contenga input con aria-label o placeholder
      expect(html).toContain("Buscar platillo o ingrediente");
      expect(html).toContain('aria-label="Buscar productos por nombre"');
    });

    it("ComercialMenuTemplate: renderiza input de búsqueda y placeholder", () => {
      const html = renderToStaticMarkup(
        <ComercialMenuTemplate
          business={mockBusiness}
          categories={mockCategories}
          products={[]}
        />
      );

      expect(html).toContain("Buscar en el catálogo por nombre");
      expect(html).toContain('aria-label="Buscar productos por nombre"');
    });

    it("EleganteMenuTemplate: renderiza input de búsqueda y placeholder", () => {
      const html = renderToStaticMarkup(
        <EleganteMenuTemplate
          business={mockBusiness}
          categories={mockCategories}
          products={[]}
        />
      );

      expect(html).toContain("Buscar en la carta por nombre");
      expect(html).toContain('aria-label="Buscar productos por nombre"');
    });

    it("VisualMenuTemplate: renderiza input de búsqueda y placeholder", () => {
      const html = renderToStaticMarkup(
        <VisualMenuTemplate
          business={mockBusiness}
          categories={mockCategories}
          products={[]}
        />
      );

      expect(html).toContain("BUSCAR EN EL MENÚ");
      expect(html).toContain('aria-label="Buscar productos por nombre"');
    });

    it("Todas las 4 plantillas contienen el mensaje exacto 'No encontramos productos con ese nombre'", () => {
      const templates = [
        "src/components/menu/urbana-template.tsx",
        "src/components/menu/comercial-template.tsx",
        "src/components/menu/elegante-template.tsx",
        "src/components/menu/visual-template.tsx",
      ];

      for (const tPath of templates) {
        const fullPath = path.resolve(process.cwd(), tPath);
        const code = fs.readFileSync(fullPath, "utf-8");
        expect(code).toContain("No encontramos productos con ese nombre");
        expect(code).toContain("Limpiar búsqueda");
      }
    });
  });

  describe("4. Regla de Código Global: Cero Alertas Nativas", () => {
    it("no debe contener llamadas a window.alert, window.confirm o window.prompt en el menú público", () => {
      const filesToCheck = [
        "src/lib/menu/category-grouping.ts",
        "src/components/menu/urbana-template.tsx",
        "src/components/menu/comercial-template.tsx",
        "src/components/menu/elegante-template.tsx",
        "src/components/menu/visual-template.tsx",
        "src/components/menu/template-renderer.tsx",
        "src/app/menu/[slugOrId]/page.tsx",
      ];

      for (const file of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), file);
        const code = fs.readFileSync(fullPath, "utf-8");

        expect(code).not.toMatch(/\bwindow\.alert\b/);
        expect(code).not.toMatch(/\bwindow\.confirm\b/);
        expect(code).not.toMatch(/\bwindow\.prompt\b/);
        expect(code).not.toMatch(/\bAlert\.alert\b/);
      }
    });
  });
});
