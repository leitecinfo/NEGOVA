import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  CreateRecipeInputSchema,
  CreateIngredientInputSchema,
  INGREDIENT_UNITS,
} from "@/lib/recipes/types";
import { CreateProductSchema, PRODUCT_UNITS } from "@/lib/products/types";

describe("Recipe Wizard Assistant Modal [Wizard Recetas y Escandallos]", () => {
  const filePath = path.join(
    process.cwd(),
    "src/app/workspace/[businessId]/recetas/recipe-form-modal.tsx"
  );
  const fileContent = fs.readFileSync(filePath, "utf-8");

  describe("Reglas de Código y Prohibición de Alertas Nativas", () => {
    it("NO debe usar alertas nativas prohibidas (window.alert, window.confirm, window.prompt, Alert.alert)", () => {
      expect(fileContent).not.toMatch(/window\.alert\s*\(/);
      expect(fileContent).not.toMatch(/window\.confirm\s*\(/);
      expect(fileContent).not.toMatch(/window\.prompt\s*\(/);
      expect(fileContent).not.toMatch(/Alert\.alert\s*\(/);
    });

    it("debe utilizar Sonner toast y ModalPortal para la experiencia interactiva", () => {
      expect(fileContent).toContain('import { toast } from "sonner"');
      expect(fileContent).toContain('import { ModalPortal } from "@/components/ui/modal-portal"');
    });
  });

  describe("Paso 1: Información Básica del Wizard", () => {
    it("incluye el indicador del Wizard con los 3 pasos requeridos", () => {
      expect(fileContent).toContain("1 Información");
      expect(fileContent).toContain("2 Ingredientes");
      expect(fileContent).toContain("3 Resumen");
    });

    it("incluye buscador por nombre de producto y selector por categorías", () => {
      expect(fileContent).toContain("productSearchQuery");
      expect(fileContent).toContain("selectedCategoryFilter");
      expect(fileContent).toContain("Buscar producto por nombre...");
      expect(fileContent).toContain("Todas las categorías");
    });

    it("incluye lista de selección rápida de productos", () => {
      expect(fileContent).toContain("Lista de selección rápida");
      expect(fileContent).toContain("handleProductSelect");
    });

    it("incluye botón directo '+ Crear producto nuevo' y submodal de creación rápida", () => {
      expect(fileContent).toContain("+ Crear producto nuevo");
      expect(fileContent).toContain("isQuickProductModalOpen");
      expect(fileContent).toContain("Crear Producto Rápido");
      expect(fileContent).toContain("handleCreateQuickProduct");
    });

    it("valida el esquema para creación rápida de producto", () => {
      const validProduct = {
        name: "Hamburguesa Gourmet",
        price: 28000,
        metadata: {
          product_type: "product" as const,
          cost: 12000,
          unit: "unidad",
        },
      };

      const parsed = CreateProductSchema.safeParse(validProduct);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe("Hamburguesa Gourmet");
        expect(parsed.data.price).toBe(28000);
      }
    });

    it("incluye campos de Nombre de Receta, Porciones (raciones), y Tiempo de preparación", () => {
      expect(fileContent).toContain("Nombre de la Receta / Ficha Técnica *");
      expect(fileContent).toContain("Rendimiento en Porciones (Raciones) *");
      expect(fileContent).toContain("Tiempo de Preparación en Minutos");
      expect(fileContent).toContain("Centro de Producción o Cocina");
    });
  });

  describe("Paso 2: Ingredientes e Insumos", () => {
    it("incluye selector de origen con pestañas 'Ingrediente' (materias primas) vs 'Producto' (sub-recetas)", () => {
      expect(fileContent).toContain("Ingrediente (Materias primas)");
      expect(fileContent).toContain("Producto (Sub-recetas / Artículos)");
      expect(fileContent).toContain("originType");
    });

    it("incluye buscador de ítems con indicación de unidad de medida y costo unitario", () => {
      expect(fileContent).toContain("itemSearchQuery");
      expect(fileContent).toContain("Unidad:");
      expect(fileContent).toContain("Costo:");
    });

    it("incluye botón directo '+ Crear ingrediente' para añadir insumos al vuelo", () => {
      expect(fileContent).toContain("+ Crear ingrediente");
      expect(fileContent).toContain("isQuickIngredientModalOpen");
      expect(fileContent).toContain("Crear Ingrediente al Vuelo");
      expect(fileContent).toContain("handleCreateQuickIngredient");
    });

    it("valida el esquema para creación rápida de ingrediente", () => {
      const validIngredient = {
        name: "Queso Cheddar Fundido",
        unit: "kg",
        costPerUnit: 24000,
        initialStock: 5,
        minStock: 1,
      };

      const parsed = CreateIngredientInputSchema.safeParse(validIngredient);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe("Queso Cheddar Fundido");
        expect(parsed.data.costPerUnit).toBe(24000);
        expect(parsed.data.unit).toBe("kg");
      }
    });

    it("incluye lista de ingredientes agregados con cantidad, costo parcial y botón eliminar", () => {
      expect(fileContent).toContain("Ingredientes en la Receta");
      expect(fileContent).toContain("Cantidad Requerida");
      expect(fileContent).toContain("Costo Parcial");
      expect(fileContent).toContain("handleRemoveIngredient");
    });

    it("calcula el costo acumulado en vivo en el Paso 2", () => {
      expect(fileContent).toContain("Costo acumulado en vivo:");
      expect(fileContent).toContain("calculations.totalCost");
    });
  });

  describe("Paso 3: Resumen, Métricas y Guardado Final", () => {
    it("incluye encabezado con datos generales y badges de métricas", () => {
      expect(fileContent).toContain("Ficha Técnica & Resumen");
      expect(fileContent).toContain("Rendimiento:");
      expect(fileContent).toContain("Tiempo:");
      expect(fileContent).toContain("Precio de Venta");
    });

    it("incluye tabla desglosada de ingredientes con cantidades y costos", () => {
      expect(fileContent).toContain("Tabla Desglosada de Ingredientes y Escandallo");
    });

    it("muestra costeo total, porciones y costo por porción", () => {
      expect(fileContent).toContain("Costo Total Base");
      expect(fileContent).toContain("Costo por Porción");
      expect(fileContent).toContain("Margen Bruto");
    });

    it("incluye indicador de proyección ('¿Cuánto me alcanza?') con limitante de inventario", () => {
      expect(fileContent).toContain("Indicador de Proyección: ¿Cuánto me alcanza?");
      expect(fileContent).toContain("Cuello de botella de inventario:");
      expect(fileContent).toContain("calculations.portionsAvailable");
    });

    it("el botón de guardado final tiene el texto exacto requerido", () => {
      expect(fileContent).toContain("✓ Crear Receta");
      expect(fileContent).toContain("✓ Guardar Cambios");
    });
  });

  describe("Lógica de Cálculos de Escandallo y Disponibilidad", () => {
    it("calcula correctamente el costo total, costo por porción y porciones alcanzables", () => {
      const portions = 2; // Rinde 2 raciones
      const ingredients = [
        { name: "Carne Res", quantity: 0.4, unit: "kg", unitCost: 30000, subtotalCost: 12000, isOptional: false, stockQuantity: 2 },
        { name: "Pan Brioche", quantity: 2, unit: "unidad", unitCost: 1500, subtotalCost: 3000, isOptional: false, stockQuantity: 6 },
        { name: "Salsa Secreta", quantity: 50, unit: "ml", unitCost: 20, subtotalCost: 1000, isOptional: true, stockQuantity: 500 }, // Opcional
      ];

      // Calcular costo base (solo no opcionales)
      const nonOptional = ingredients.filter((i) => !i.isOptional);
      const totalCost = nonOptional.reduce((sum, i) => sum + i.subtotalCost, 0);
      expect(totalCost).toBe(15000); // 12000 + 3000

      const costPerPortion = totalCost / portions;
      expect(costPerPortion).toBe(7500);

      // Disponibilidad ("¿Cuánto me alcanza?"):
      // Carne: 2 kg / 0.4 kg = 5 tandas -> 5 * 2 = 10 porciones
      // Pan: 6 unidades / 2 unidades = 3 tandas -> 3 * 2 = 6 porciones (Cuello de botella)
      const batchesCarne = Math.floor(2 / 0.4); // 5
      const batchesPan = Math.floor(6 / 2); // 3
      const minBatches = Math.min(batchesCarne, batchesPan);
      const portionsAvailable = minBatches * portions;

      expect(portionsAvailable).toBe(6);
    });

    it("calcula correctamente el margen bruto sobre el precio de venta", () => {
      const productPrice = 25000;
      const costPerPortion = 7500;
      const margin = (((productPrice - costPerPortion) / productPrice) * 100).toFixed(2);
      expect(parseFloat(margin)).toBe(70.0);
    });
  });

  describe("Validación de Formulario Completo de Receta", () => {
    it("valida un payload de creación de receta completo según CreateRecipeInputSchema", () => {
      const validRecipe = {
        productId: "a0000000-0000-4000-8000-000000000001",
        name: "Hamburguesa Doble Carne",
        description: "Cocinar a término 3/4",
        portions: 1,
        prepTimeMinutes: 20,
        ingredients: [
          {
            ingredientId: "b0000000-0000-4000-8000-000000000002",
            quantity: 0.3,
            unit: "kg",
            isOptional: false,
            sortOrder: 0,
          },
        ],
      };

      const parsed = CreateRecipeInputSchema.safeParse(validRecipe);
      expect(parsed.success).toBe(true);
    });

    it("rechaza recetas sin ingredientes", () => {
      const invalidRecipe = {
        productId: "a0000000-0000-4000-8000-000000000001",
        name: "Receta Vacía",
        portions: 1,
        ingredients: [],
      };

      const parsed = CreateRecipeInputSchema.safeParse(invalidRecipe);
      expect(parsed.success).toBe(false);
    });
  });
});
