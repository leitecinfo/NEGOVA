import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  cleanCurrencyOrNumber,
  normalizeHeaderName,
  parseBooleanFlag,
  parseTaxPercentage,
  generateProductsTemplateCSV,
  validateProductsCSV,
} from "../../src/lib/products/csv-service";

describe("Modal de Importación Masiva de Productos - CSV / Excel", () => {
  describe("1. Detección Inteligente de Encabezados Comunes", () => {
    it("debe mapear variantes comunes a SKU / Referencia / Código", () => {
      expect(normalizeHeaderName("SKU")).toBe("sku");
      expect(normalizeHeaderName("referencia")).toBe("sku");
      expect(normalizeHeaderName("ref")).toBe("sku");
      expect(normalizeHeaderName("código")).toBe("sku");
      expect(normalizeHeaderName("codigo_producto")).toBe("sku");
      expect(normalizeHeaderName("Cod")).toBe("sku");
    });

    it("debe mapear variantes comunes a Nombre / Producto / Detalle", () => {
      expect(normalizeHeaderName("nombre")).toBe("name");
      expect(normalizeHeaderName("producto")).toBe("name");
      expect(normalizeHeaderName("artículo")).toBe("name");
      expect(normalizeHeaderName("detalle")).toBe("name");
      expect(normalizeHeaderName("item")).toBe("name");
    });

    it("debe mapear variantes comunes a Precio Costo", () => {
      expect(normalizeHeaderName("precio_costo")).toBe("cost");
      expect(normalizeHeaderName("costo")).toBe("cost");
      expect(normalizeHeaderName("valor_compra")).toBe("cost");
      expect(normalizeHeaderName("costo_unitario")).toBe("cost");
      expect(normalizeHeaderName("cost")).toBe("cost");
    });

    it("debe mapear variantes comunes a Precio Venta", () => {
      expect(normalizeHeaderName("precio_venta")).toBe("price");
      expect(normalizeHeaderName("precio")).toBe("price");
      expect(normalizeHeaderName("valor")).toBe("price");
      expect(normalizeHeaderName("pvp")).toBe("price");
      expect(normalizeHeaderName("precio_publico")).toBe("price");
    });

    it("debe mapear existencias, stock mínimo y categorías", () => {
      expect(normalizeHeaderName("stock_actual")).toBe("stockQuantity");
      expect(normalizeHeaderName("existencias")).toBe("stockQuantity");
      expect(normalizeHeaderName("stock_minimo")).toBe("minStock");
      expect(normalizeHeaderName("alerta_stock")).toBe("minStock");
      expect(normalizeHeaderName("categoría")).toBe("category");
      expect(normalizeHeaderName("grupo")).toBe("category");
      expect(normalizeHeaderName("familia")).toBe("category");
    });

    it("debe mapear imágenes, código de barras, impuestos y variantes", () => {
      expect(normalizeHeaderName("imagen_url")).toBe("imageUrl");
      expect(normalizeHeaderName("foto")).toBe("imageUrl");
      expect(normalizeHeaderName("codigo_barras")).toBe("barcode");
      expect(normalizeHeaderName("ean")).toBe("barcode");
      expect(normalizeHeaderName("con_impuesto")).toBe("hasTax");
      expect(normalizeHeaderName("tipo_impuesto")).toBe("taxType");
      expect(normalizeHeaderName("precio_incluye_impuesto")).toBe("taxIncludedInPrice");
      expect(normalizeHeaderName("con_variante")).toBe("hasVariants");
      expect(normalizeHeaderName("variante_name")).toBe("variantName");
      expect(normalizeHeaderName("variante_precio_costo")).toBe("variantCost");
      expect(normalizeHeaderName("variante_precio_venta")).toBe("variantPrice");
      expect(normalizeHeaderName("variante_stock")).toBe("variantStock");
    });
  });

  describe("2. Limpieza Automática de Símbolos de Moneda y Formatos", () => {
    it("debe limpiar símbolos de moneda ($ y COP) y espacios", () => {
      expect(cleanCurrencyOrNumber("$25.000")).toBe(25000);
      expect(cleanCurrencyOrNumber("$ 120.000 COP")).toBe(120000);
      expect(cleanCurrencyOrNumber("COP 4.500")).toBe(4500);
    });

    it("debe procesar separadores de miles y decimales correctamente", () => {
      expect(cleanCurrencyOrNumber("1.250.000")).toBe(1250000);
      expect(cleanCurrencyOrNumber("25.000,50")).toBe(25000.5);
      expect(cleanCurrencyOrNumber("25,000.50")).toBe(25000.5);
      expect(cleanCurrencyOrNumber("18000")).toBe(18000);
    });

    it("debe retornar null para valores vacíos o no numéricos", () => {
      expect(cleanCurrencyOrNumber("")).toBeNull();
      expect(cleanCurrencyOrNumber("—")).toBeNull();
      expect(cleanCurrencyOrNumber(null)).toBeNull();
      expect(cleanCurrencyOrNumber(undefined)).toBeNull();
    });

    it("debe interpretar correctamente booleanos y tasas de impuesto", () => {
      expect(parseBooleanFlag("Sí")).toBe(true);
      expect(parseBooleanFlag("si")).toBe(true);
      expect(parseBooleanFlag("1")).toBe(true);
      expect(parseBooleanFlag("No")).toBe(false);
      expect(parseBooleanFlag("0")).toBe(false);

      expect(parseTaxPercentage("19%")).toBe(19);
      expect(parseTaxPercentage("8")).toBe(8);
      expect(parseTaxPercentage("Exento")).toBe(0);
      expect(parseTaxPercentage(null, true)).toBe(19);
      expect(parseTaxPercentage(null, false)).toBe(0);
    });
  });

  describe("3. Estructura y Validación de Columnas CSV", () => {
    it("debe requerir nombre y precio_venta obligatoriamente", () => {
      const csvSinNombre = "sku,nombre,precio_costo,precio_venta\nSKU-1,,5000,10000";
      const resultSinNombre = validateProductsCSV(csvSinNombre);
      expect(resultSinNombre.invalidRows.length).toBe(1);
      expect(resultSinNombre.invalidRows[0].errors).toContain("El nombre del producto es obligatorio.");

      const csvSinPrecio = "sku,nombre,precio_costo,precio_venta\nSKU-1,Pizza Personal,5000,";
      const resultSinPrecio = validateProductsCSV(csvSinPrecio);
      expect(resultSinPrecio.invalidRows.length).toBe(1);
      expect(resultSinPrecio.invalidRows[0].errors).toContain(
        "El precio debe ser un número válido mayor o igual a 0."
      );
    });

    it("debe validar filas completas con variantes e impuestos", () => {
      const fullCSV = [
        "sku,nombre,precio_costo,precio_venta,stock_actual,stock_minimo,categoria,imagen_url,codigo_barras,con_impuesto,tipo_impuesto,precio_incluye_impuesto,con_variante,variante_name,variante_precio_costo,variante_precio_venta,variante_stock",
        'HAM-001,Hamburguesa Doble,$14.000,$28.000,40,10,Hamburguesas,https://img.com/h.jpg,770111222,Sí,19%,Sí,Sí,Combo Papas y Gaseosa,$18.000,$35.000,30',
      ].join("\n");

      const result = validateProductsCSV(fullCSV);
      expect(result.validRows.length).toBe(1);
      expect(result.invalidRows.length).toBe(0);

      const row = result.validRows[0];
      expect(row.sku).toBe("HAM-001");
      expect(row.name).toBe("Hamburguesa Doble");
      expect(row.cost).toBe(14000);
      expect(row.price).toBe(28000);
      expect(row.stockQuantity).toBe(40);
      expect(row.minStock).toBe(10);
      expect(row.categoryName).toBe("Hamburguesas");
      expect(row.imageUrl).toBe("https://img.com/h.jpg");
      expect(row.barcode).toBe("770111222");
      expect(row.hasTax).toBe(true);
      expect(row.taxType).toBe("19%");
      expect(row.taxIncludedInPrice).toBe(true);
      expect(row.hasVariants).toBe(true);
      expect(row.variantName).toBe("Combo Papas y Gaseosa");
      expect(row.variantCost).toBe(18000);
      expect(row.variantPrice).toBe(35000);
      expect(row.variantStock).toBe(30);
    });

    it("debe generar la plantilla CSV con UTF-8 BOM y las 17 columnas oficiales", () => {
      const template = generateProductsTemplateCSV();
      expect(template.startsWith("\uFEFF")).toBe(true);
      expect(template).toContain("sku,nombre,precio_costo,precio_venta,stock_actual,stock_minimo,categoria");
      expect(template).toContain("imagen_url,codigo_barras,con_impuesto,tipo_impuesto,precio_incluye_impuesto");
      expect(template).toContain("con_variante,variante_name,variante_precio_costo,variante_precio_venta,variante_stock");
    });
  });

  describe("4. Cumplimiento de Reglas Globales (Cero alertas nativas)", () => {
    it("el archivo del modal no debe contener window.alert, window.confirm ni window.prompt", () => {
      const modalFilePath = path.resolve(
        __dirname,
        "../../src/app/workspace/[businessId]/productos/product-import-modal.tsx"
      );
      const content = fs.readFileSync(modalFilePath, "utf-8");

      expect(content).not.toMatch(/\bwindow\.alert\b/);
      expect(content).not.toMatch(/\balert\s*\(/);
      expect(content).not.toMatch(/\bwindow\.confirm\b/);
      expect(content).not.toMatch(/\bconfirm\s*\(/);
      expect(content).not.toMatch(/\bwindow\.prompt\b/);
      expect(content).not.toMatch(/\bprompt\s*\(/);
      expect(content).not.toMatch(/\bAlert\.alert\b/);
    });

    it("el modal debe incluir el título y descripción exactos requeridos", () => {
      const modalFilePath = path.resolve(
        __dirname,
        "../../src/app/workspace/[businessId]/productos/product-import-modal.tsx"
      );
      const content = fs.readFileSync(modalFilePath, "utf-8");

      expect(content).toContain('title="Importar Productos desde CSV / Excel"');
      expect(content).toContain(
        'description="Sube un archivo CSV o Excel (.xlsx) con tus productos para agregarlos masivamente."'
      );
      expect(content).toContain("Descargar plantilla");
      expect(content).toContain("onDragOver");
      expect(content).toContain("onDragLeave");
      expect(content).toContain("onDrop");
    });
  });
});
