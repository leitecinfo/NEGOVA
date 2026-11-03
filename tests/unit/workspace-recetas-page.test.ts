import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Pantalla Principal del Módulo de Recetas (/workspace/[businessId]/recetas)", () => {
  const pagePath = path.join(
    process.cwd(),
    "src/app/workspace/[businessId]/recetas/page.tsx"
  );
  const managerClientPath = path.join(
    process.cwd(),
    "src/app/workspace/[businessId]/recetas/recetas-manager-client.tsx"
  );
  const recipesTabPath = path.join(
    process.cwd(),
    "src/app/workspace/[businessId]/recetas/recipes-tab.tsx"
  );

  describe("1. Encabezado de la Pantalla", () => {
    it("debe tener el título 'Recetas' y la descripción 'Crea y gestiona las recetas de tus productos.'", () => {
      expect(fs.existsSync(pagePath)).toBe(true);
      const content = fs.readFileSync(pagePath, "utf-8");

      expect(content).toContain('title="Recetas"');
      expect(content).toContain(
        'description="Crea y gestiona las recetas de tus productos."'
      );
    });
  });

  describe("2. Selector de Pestañas", () => {
    it("debe contener las pestañas 'Recetas' e 'Ingredientes'", () => {
      expect(fs.existsSync(managerClientPath)).toBe(true);
      const content = fs.readFileSync(managerClientPath, "utf-8");

      expect(content).toContain("Recetas");
      expect(content).toContain("Ingredientes");
    });
  });

  describe("3. KPIs Superiores Requeridos", () => {
    it("debe calcular y renderizar Total Recetas, Costo Promedio (por porción) y Recetas Activas", () => {
      expect(fs.existsSync(recipesTabPath)).toBe(true);
      const content = fs.readFileSync(recipesTabPath, "utf-8");

      expect(content).toContain("Total Recetas");
      expect(content).toContain("Costo Promedio (por porción)");
      expect(content).toContain("Recetas Activas");
    });
  });

  describe("4. Barra de Filtros y Acción Principal", () => {
    it("debe contener el buscador 'Buscar recetas...', el desplegable 'Todos los productos' y el botón '+ Nueva Receta'", () => {
      const content = fs.readFileSync(recipesTabPath, "utf-8");

      expect(content).toContain('placeholder="Buscar recetas..."');
      expect(content).toContain("Todos los productos");
      expect(content).toContain("+ Nueva Receta");
    });
  });

  describe("5. Estructura de Cards (Tarjetas) de Receta", () => {
    it("Cabecera: debe contener Nombre de la receta, fecha y badges ('Alcanza para X porciones', 'Activa')", () => {
      const content = fs.readFileSync(recipesTabPath, "utf-8");

      expect(content).toContain("recipe.name");
      expect(content).toContain("formatRecipeDate");
      expect(content).toContain("Alcanza para");
      expect(content).toContain("porción");
      expect(content).toContain("Activa");
      expect(content).toContain("Inactiva");
    });

    it("Producto asociado: debe mostrar miniatura, nombre, categoría, precio de venta y stock actual", () => {
      const content = fs.readFileSync(recipesTabPath, "utf-8");

      expect(content).toContain("productImageUrl");
      expect(content).toContain("productName");
      expect(content).toContain("productCategory");
      expect(content).toContain("productPrice");
      expect(content).toContain("productStock");
    });

    it("Descripción: debe contener notas de preparación de la receta", () => {
      const content = fs.readFileSync(recipesTabPath, "utf-8");

      expect(content).toContain("Notas de preparación");
      expect(content).toContain("recipe.description");
    });

    it("Pie: debe mostrar conteo de ingredientes, costo por porción y menú de opciones (Editar, Duplicar, Desactivar, Eliminar)", () => {
      const content = fs.readFileSync(recipesTabPath, "utf-8");

      expect(content).toContain("ingrediente");
      expect(content).toContain("costPerPortion");
      expect(content).toContain("Editar");
      expect(content).toContain("Duplicar");
      expect(content).toContain("Desactivar");
      expect(content).toContain("Eliminar");
    });
  });

  describe("6. Regla Global de Código (Sin alertas nativas)", () => {
    it("no debe contener window.alert, window.confirm, window.prompt o Alert.alert", () => {
      const files = [pagePath, managerClientPath, recipesTabPath];
      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        expect(content).not.toMatch(/\bwindow\.alert\b/);
        expect(content).not.toMatch(/\bwindow\.confirm\b/);
        expect(content).not.toMatch(/\bwindow\.prompt\b/);
        expect(content).not.toMatch(/\bAlert\.alert\b/);
      }
    });
  });
});
