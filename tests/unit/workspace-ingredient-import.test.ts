import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import {
  normalizeHeader,
  normalizeUnit,
  parseBooleanValue,
  parseNumericValue,
  parseFileRawRows,
  validateIngredientRows,
  generateIngredientCSVTemplate,
  generateIngredientExcelTemplate,
  TEMPLATE_COLUMNS,
} from "@/lib/recipes/ingredient-import-service";

describe("Ingredient Import Modal & Service [Importación Masiva de Ingredientes]", () => {
  const modalFilePath = path.join(
    process.cwd(),
    "src/app/workspace/[businessId]/recetas/ingredient-import-modal.tsx"
  );
  const modalFileContent = fs.readFileSync(modalFilePath, "utf-8");

  describe("Reglas de Código y Prohibición de Alertas Nativas", () => {
    it("NO debe usar alertas nativas prohibidas (window.alert, window.confirm, window.prompt, Alert.alert)", () => {
      expect(modalFileContent).not.toMatch(/window\.alert\s*\(/);
      expect(modalFileContent).not.toMatch(/window\.confirm\s*\(/);
      expect(modalFileContent).not.toMatch(/window\.prompt\s*\(/);
      expect(modalFileContent).not.toMatch(/Alert\.alert\s*\(/);
    });

    it("utiliza Sonner toast y ModalPortal para la experiencia interactiva", () => {
      expect(modalFileContent).toContain('import { toast } from "sonner"');
      expect(modalFileContent).toContain('import { ModalPortal } from "@/components/ui/modal-portal"');
    });
  });

  describe("Estructura y Encabezado del Modal", () => {
    it("tiene el título exacto 'Importar ingredientes'", () => {
      expect(modalFileContent).toContain("Importar ingredientes");
    });

    it("incluye la descripción para subir CSV o Excel (.xlsx, .xls)", () => {
      expect(modalFileContent).toContain(".xlsx, .xls");
      expect(modalFileContent).toContain("CSV");
    });

    it("incluye el botón de cierre '✕'", () => {
      expect(modalFileContent).toContain("✕");
    });
  });

  describe("Zona Drag & Drop y Botones de Acción", () => {
    it("incluye la zona Drag & Drop interactiva con eventos de arrastre", () => {
      expect(modalFileContent).toContain("onDragOver");
      expect(modalFileContent).toContain("onDragEnter");
      expect(modalFileContent).toContain("onDragLeave");
      expect(modalFileContent).toContain("onDrop");
      expect(modalFileContent).toContain("isDragging");
    });

    it("incluye el texto de arrastre o selección por explorador", () => {
      expect(modalFileContent).toContain("Arrastra y suelta tu archivo aquí, o usa el explorador");
    });

    it("incluye el botón de acción 'Seleccionar archivo'", () => {
      expect(modalFileContent).toContain("Seleccionar archivo");
    });

    it("incluye el botón de acción 'Descargar plantilla'", () => {
      expect(modalFileContent).toContain("Descargar plantilla (.xlsx)");
      expect(modalFileContent).toContain("Descargar CSV (.csv)");
    });
  });

  describe("Normalización de Encabezados de Columnas Estándar", () => {
    it("soporta y normaliza todas las columnas estándar requeridas", () => {
      expect(normalizeHeader("nombre")).toBe("nombre");
      expect(normalizeHeader("Nombre")).toBe("nombre");
      expect(normalizeHeader("ingrediente")).toBe("nombre");

      expect(normalizeHeader("descripcion")).toBe("descripcion");
      expect(normalizeHeader("Descripción")).toBe("descripcion");

      expect(normalizeHeader("categoria")).toBe("categoria");
      expect(normalizeHeader("Categoría")).toBe("categoria");

      expect(normalizeHeader("unidad")).toBe("unidad");
      expect(normalizeHeader("Unidad de Medida")).toBe("unidad");

      expect(normalizeHeader("costo")).toBe("costo");
      expect(normalizeHeader("Costo Unitario")).toBe("costo");

      expect(normalizeHeader("precio_venta")).toBe("precio_venta");
      expect(normalizeHeader("Precio Venta")).toBe("precio_venta");

      expect(normalizeHeader("stock")).toBe("stock");
      expect(normalizeHeader("Stock Inicial")).toBe("stock");

      expect(normalizeHeader("stock_minimo")).toBe("stock_minimo");
      expect(normalizeHeader("Stock Mínimo")).toBe("stock_minimo");

      expect(normalizeHeader("stock_maximo")).toBe("stock_maximo");
      expect(normalizeHeader("Stock Máximo")).toBe("stock_maximo");

      expect(normalizeHeader("codigo_barras")).toBe("codigo_barras");
      expect(normalizeHeader("Código de Barras")).toBe("codigo_barras");

      expect(normalizeHeader("mostrar_en_pos")).toBe("mostrar_en_pos");
      expect(normalizeHeader("mostrar_en_qr")).toBe("mostrar_en_qr");
      expect(normalizeHeader("mostrar_en_mesas")).toBe("mostrar_en_mesas");
      expect(normalizeHeader("mostrar_en_domicilios")).toBe("mostrar_en_domicilios");
    });
  });

  describe("Validación de Unidades Estándar (unit, kg, g, l, ml)", () => {
    it("reconoce y normaliza 'unit' y sinónimos", () => {
      expect(normalizeUnit("unit")).toEqual({ unit: "unit", isValid: true });
      expect(normalizeUnit("unidad")).toEqual({ unit: "unit", isValid: true });
      expect(normalizeUnit("un")).toEqual({ unit: "unit", isValid: true });
      expect(normalizeUnit("unidades")).toEqual({ unit: "unit", isValid: true });
    });

    it("reconoce y normaliza 'kg'", () => {
      expect(normalizeUnit("kg")).toEqual({ unit: "kg", isValid: true });
      expect(normalizeUnit("kilo")).toEqual({ unit: "kg", isValid: true });
      expect(normalizeUnit("kilogramos")).toEqual({ unit: "kg", isValid: true });
    });

    it("reconoce y normaliza 'g'", () => {
      expect(normalizeUnit("g")).toEqual({ unit: "g", isValid: true });
      expect(normalizeUnit("gramo")).toEqual({ unit: "g", isValid: true });
      expect(normalizeUnit("gr")).toEqual({ unit: "g", isValid: true });
    });

    it("reconoce y normaliza 'l'", () => {
      expect(normalizeUnit("l")).toEqual({ unit: "l", isValid: true });
      expect(normalizeUnit("lt")).toEqual({ unit: "l", isValid: true });
      expect(normalizeUnit("litro")).toEqual({ unit: "l", isValid: true });
    });

    it("reconoce y normaliza 'ml'", () => {
      expect(normalizeUnit("ml")).toEqual({ unit: "ml", isValid: true });
      expect(normalizeUnit("mililitro")).toEqual({ unit: "ml", isValid: true });
    });

    it("marca como inválida una unidad desconocida", () => {
      expect(normalizeUnit("cucharadas").isValid).toBe(false);
      expect(normalizeUnit("metros").isValid).toBe(false);
      expect(normalizeUnit("").isValid).toBe(false);
      expect(normalizeUnit(null).isValid).toBe(false);
    });
  });

  describe("Parsing de Valores Numéricos y Canales Booleanos (TRUE/FALSE)", () => {
    it("interpreta valores booleanos para mostrar_en_pos, mostrar_en_qr, mostrar_en_mesas, mostrar_en_domicilios", () => {
      expect(parseBooleanValue("TRUE")).toBe(true);
      expect(parseBooleanValue("true")).toBe(true);
      expect(parseBooleanValue("SI")).toBe(true);
      expect(parseBooleanValue("sí")).toBe(true);
      expect(parseBooleanValue("1")).toBe(true);
      expect(parseBooleanValue(1)).toBe(true);
      expect(parseBooleanValue(true)).toBe(true);

      expect(parseBooleanValue("FALSE")).toBe(false);
      expect(parseBooleanValue("false")).toBe(false);
      expect(parseBooleanValue("NO")).toBe(false);
      expect(parseBooleanValue("0")).toBe(false);
      expect(parseBooleanValue(0)).toBe(false);
      expect(parseBooleanValue(false)).toBe(false);
      expect(parseBooleanValue("")).toBe(false);
      expect(parseBooleanValue(null)).toBe(false);
    });

    it("limpia y convierte valores numéricos con formatos de moneda o separadores", () => {
      expect(parseNumericValue("4500")).toBe(4500);
      expect(parseNumericValue("$ 4500")).toBe(4500);
      expect(parseNumericValue("4.500,50")).toBe(4500.5);
      expect(parseNumericValue("4,500.50")).toBe(4500.5);
      expect(parseNumericValue("12500")).toBe(12500);
      expect(parseNumericValue("")).toBe(0);
      expect(parseNumericValue(null)).toBe(0);
    });
  });

  describe("Previsualización, Validación de Filas y Autogeneración de Categorías", () => {
    it("valida correctamente una fila válida con todos los campos estándar", () => {
      const rawRows = [
        {
          rowNumber: 2,
          nombre: "Queso Parmesano Reggiano",
          descripcion: "Queso madurado 24 meses",
          categoria: "Lácteos Gourmet",
          unidad: "kg",
          costo: 48000,
          precio_venta: 0,
          stock: 12,
          stock_minimo: 3,
          stock_maximo: 50,
          codigo_barras: "770999999001",
          mostrar_en_pos: "FALSE",
          mostrar_en_qr: "FALSE",
          mostrar_en_mesas: "FALSE",
          mostrar_en_domicilios: "FALSE",
        },
      ];

      const existingCategories = [{ id: "cat-1", name: "Insumos Generales" }];
      const existingIngredients: any[] = [];

      const result = validateIngredientRows(rawRows, existingIngredients, existingCategories);

      expect(result.totalRows).toBe(1);
      expect(result.validRows.length).toBe(1);
      expect(result.invalidRows.length).toBe(0);
      expect(result.newCategoriesCount).toBe(1); // 'Lácteos Gourmet' es nueva y se autogenerará

      const validRow = result.validRows[0];
      expect(validRow.name).toBe("Queso Parmesano Reggiano");
      expect(validRow.unit).toBe("kg");
      expect(validRow.cost).toBe(48000);
      expect(validRow.stock).toBe(12);
      expect(validRow.isNewCategory).toBe(true);
      expect(validRow.action).toBe("create");
    });

    it("detecta categoría existente y la asocia sin marcarla como nueva", () => {
      const rawRows = [
        {
          rowNumber: 2,
          nombre: "Tomate Chonto",
          unidad: "kg",
          costo: 3500,
          categoria: "Verduras y Frutas",
        },
      ];

      const existingCategories = [{ id: "cat-verduras-id", name: "Verduras y Frutas" }];
      const result = validateIngredientRows(rawRows, [], existingCategories);

      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0].categoryId).toBe("cat-verduras-id");
      expect(result.validRows[0].isNewCategory).toBe(false);
      expect(result.newCategoriesCount).toBe(0);
    });

    it("clasifica filas inválidas cuando faltan campos requeridos o unidad no válida", () => {
      const rawRows = [
        {
          rowNumber: 2,
          nombre: "", // Error: nombre requerido
          unidad: "kg",
          costo: 2000,
        },
        {
          rowNumber: 3,
          nombre: "Cilantro Fresco",
          unidad: "atado_invalido", // Error: unidad inválida
          costo: 1500,
        },
        {
          rowNumber: 4,
          nombre: "Sal Marina",
          unidad: "kg",
          costo: -500, // Error: costo negativo
        },
      ];

      const result = validateIngredientRows(rawRows, [], []);
      expect(result.validRows.length).toBe(0);
      expect(result.invalidRows.length).toBe(3);

      expect(result.invalidRows[0].errors).toContain("El nombre es requerido.");
      expect(result.invalidRows[1].errors.some((e) => e.includes("no válida"))).toBe(true);
      expect(result.invalidRows[2].errors.some((e) => e.includes("costo"))).toBe(true);
    });

    it("detecta coincidencia por nombre o código de barras para actualizar (action: update)", () => {
      const rawRows = [
        {
          rowNumber: 2,
          nombre: "Pechuga de Pollo",
          unidad: "kg",
          costo: 16000,
          stock: 40,
        },
      ];

      const existingIngredients = [
        {
          id: "ing-pollo-existente",
          name: "Pechuga de Pollo",
          metadata: { unit: "kg", cost: 14000 },
        },
      ];

      const result = validateIngredientRows(rawRows, existingIngredients, []);
      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0].action).toBe("update");
      expect(result.validRows[0].existingIngredientId).toBe("ing-pollo-existente");
    });
  });

  describe("Generación y Descarga de Plantillas", () => {
    it("genera una plantilla CSV válida con UTF-8 BOM y todas las columnas", () => {
      const csv = generateIngredientCSVTemplate();
      expect(csv.startsWith("\uFEFF")).toBe(true);

      const firstLine = csv.replace("\uFEFF", "").split("\r\n")[0];
      for (const col of TEMPLATE_COLUMNS) {
        expect(firstLine).toContain(col);
      }
    });

    it("genera una plantilla Excel (.xlsx) con libro y hoja de ingredientes", () => {
      const excelBuffer = generateIngredientExcelTemplate();
      expect(excelBuffer).toBeDefined();
      expect(excelBuffer.length).toBeGreaterThan(0);

      // Verificar que XLSX pueda leer el buffer generado
      const wb = XLSX.read(excelBuffer, { type: "array" });
      expect(wb.SheetNames).toContain("Ingredientes");
      const ws = wb.Sheets["Ingredientes"];
      const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
      expect(matrix[0]).toEqual(TEMPLATE_COLUMNS);
      expect(matrix.length).toBeGreaterThan(1);
    });
  });

  describe("Previsualización y Barra de Progreso en la UI", () => {
    it("el modal contiene la barra de progreso interactiva", () => {
      expect(modalFileContent).toContain("isImporting");
      expect(modalFileContent).toContain("progressPercentage");
      expect(modalFileContent).toContain("progressMessage");
      expect(modalFileContent).toContain("w-full h-2.5 bg-muted rounded-full");
    });

    it("el modal contiene pestañas de filtrado para previsualización (Todas, Válidas, Con Errores)", () => {
      expect(modalFileContent).toContain("filterTab");
      expect(modalFileContent).toContain("Todas (");
      expect(modalFileContent).toContain("Válidas (");
      expect(modalFileContent).toContain("Con Errores (");
    });

    it("el modal contiene la tabla de previsualización con columnas detalladas", () => {
      expect(modalFileContent).toContain("Tabla de Previsualización");
      expect(modalFileContent).toContain("Nombre");
      expect(modalFileContent).toContain("Categoría");
      expect(modalFileContent).toContain("Unidad");
      expect(modalFileContent).toContain("Costo");
      expect(modalFileContent).toContain("Stock");
      expect(modalFileContent).toContain("Canales");
    });
  });
});
