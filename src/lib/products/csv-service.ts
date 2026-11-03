import { Product, Category, CreateProductDTO } from "./types";
import {
  checkProductPlanLimit,
  getDbClient,
  createCategory,
  getCategories,
} from "./products-service";
import { ensureDefaultLocation, upsertInventoryStock } from "@/lib/inventory/inventory-service";

export interface RawProductCSVRow {
  rowNumber: number;
  name: string;
  category?: string;
  price: string;
  cost?: string;
  sku?: string;
  isAvailable?: string;
  description?: string;
  stockQuantity?: string;
}

export interface ValidatedProductRow {
  rowNumber: number;
  name: string;
  categoryName?: string;
  categoryId?: string | null;
  price: number;
  cost?: number | null;
  sku?: string | null;
  isAvailable: boolean;
  description?: string | null;
  stockQuantity?: number | null;
  minStock?: number | null;
  imageUrl?: string | null;
  barcode?: string | null;
  hasTax?: boolean;
  taxType?: string | null;
  taxIncludedInPrice?: boolean;
  hasVariants?: boolean;
  variantName?: string | null;
  variantCost?: number | null;
  variantPrice?: number | null;
  variantStock?: number | null;
  action: "create" | "update";
  existingProductId?: string;
  isValid: boolean;
  errors: string[];
}

export interface ParsedCSVResult {
  totalRows: number;
  validRows: ValidatedProductRow[];
  invalidRows: ValidatedProductRow[];
  existingSkusCount: number;
}

export interface ImportBatchResult {
  success: boolean;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  errors: Array<{ rowNumber: number; productName: string; error: string }>;
  message: string;
}

/**
 * Escapa y formatea un valor para una celda CSV.
 */
function escapeCSVField(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes(";") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Genera el archivo CSV con todos los productos activos de un negocio.
 * Incluye UTF-8 BOM para compatibilidad directa con Microsoft Excel en español/Windows.
 */
export function generateProductsCSV(products: Product[]): string {
  const headers = [
    "Nombre",
    "Categoría",
    "Precio",
    "Costo",
    "SKU",
    "Disponible",
    "Descripción",
    "Stock",
  ];

  const rows: string[] = [headers.join(",")];

  for (const p of products) {
    const meta = (p.metadata || {}) as any;
    const categoryName = p.categories?.name || "";
    const cost = meta.cost !== null && meta.cost !== undefined ? meta.cost : "";
    const sku = meta.sku || "";
    const stock = meta.stock_quantity !== null && meta.stock_quantity !== undefined ? meta.stock_quantity : "";
    const isAvail = p.is_available ? "Sí" : "No";

    const line = [
      escapeCSVField(p.name),
      escapeCSVField(categoryName),
      escapeCSVField(p.price),
      escapeCSVField(cost),
      escapeCSVField(sku),
      escapeCSVField(isAvail),
      escapeCSVField(p.description || ""),
      escapeCSVField(stock),
    ].join(",");

    rows.push(line);
  }

  // Prepend UTF-8 BOM (\uFEFF)
  return "\uFEFF" + rows.join("\r\n");
}

/**
 * Analizador robusto de CSV que soporta comas y punto y coma, saltos de línea y campos entrecomillados.
 */
export function parseCSVToRawRows(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, ""); // Remover BOM si existe
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  // Detectar delimitador primario (coma o punto y coma) inspeccionando la primera línea
  const firstLine = cleanText.split(/\r?\n/)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ";" : ",";

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Saltar siguiente comilla escapada
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // Saltar \n tras \r
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Limpia y normaliza cadenas de moneda y valores numéricos:
 * - Elimina símbolos de moneda ($), espacios y palabras como COP o USD.
 * - Detecta y resuelve separadores de miles (. o ,) y separadores decimales.
 */
export function cleanCurrencyOrNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;

  let str = String(val).trim();
  if (str === "" || str === "—" || str === "-") return null;

  // Remover palabras de moneda textuales (COP, USD, etc.) antes de remover espacios
  str = str.replace(/(cop|usd|pesos|dolares|dólares)/gi, "");
  // Remover símbolos de moneda y espacios
  str = str.replace(/[$€£\s]/g, "").trim();

  // Caso: Formato latino con miles '.' y decimal ',' (ej: 25.000,50 o 1.250.000)
  // O formato anglosajón con miles ',' y decimal '.' (ej: 25,000.50)
  if (str.includes(".") && str.includes(",")) {
    const lastDot = str.lastIndexOf(".");
    const lastComma = str.lastIndexOf(",");
    if (lastComma > lastDot) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(".")) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Múltiples puntos son separadores de miles (ej: 1.250.000)
      str = str.replace(/\./g, "");
    } else {
      // Un solo punto: si hay 3 dígitos finales enteros (ej: 25.000)
      const parts = str.split(".");
      if (parts[1].length === 3) {
        str = parts[0] + parts[1];
      }
    }
  } else if (str.includes(",")) {
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      str = str.replace(/,/g, "");
    } else {
      const parts = str.split(",");
      if (parts[1].length === 3) {
        str = parts[0] + parts[1];
      } else {
        str = parts[0] + "." + parts[1];
      }
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Normaliza valores booleanos comunes (Sí, No, True, False, 1, 0, Activo).
 */
export function parseBooleanFlag(val: any, defaultVal = false): boolean {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === "boolean") return val;
  const s = String(val).trim().toLowerCase();
  if (["si", "sí", "true", "1", "s", "yes", "y", "activo"].includes(s)) return true;
  if (["no", "false", "0", "n", "inactivo", "agotado"].includes(s)) return false;
  return defaultVal;
}

/**
 * Normaliza valores de impuestos y porcentajes desde cadenas (ej: "19%", "8", "Exento").
 */
export function parseTaxPercentage(val?: string | null, hasTax?: boolean): number | null {
  if (hasTax === false) return 0;
  if (!val || String(val).trim() === "") return hasTax === true ? 19 : null;
  const str = String(val).replace(/%/g, "").trim();
  const cleaned = cleanCurrencyOrNumber(str);
  if (cleaned !== null && !isNaN(cleaned)) return cleaned;
  const lower = str.toLowerCase();
  if (lower.includes("19")) return 19;
  if (lower.includes("8")) return 8;
  if (lower.includes("5")) return 5;
  if (lower.includes("0") || lower.includes("exent") || lower.includes("excluid") || lower.includes("no")) return 0;
  return hasTax === true ? 19 : null;
}

/**
 * Normaliza y mapea cabeceras CSV a propiedades estándar con detección flexible.
 */
export function normalizeHeaderName(header: string): string {
  const h = header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[-_ ]+/g, "_");

  // 1. SKU / Código / Referencia
  if (["sku", "referencia", "ref", "codigo", "codigo_producto", "code", "cod"].includes(h)) return "sku";

  // 2. Nombre / Producto / Detalle / Descripción
  if (["nombre", "producto", "name", "articulo", "item", "detalle"].includes(h)) return "name";
  if (["descripcion", "description"].includes(h)) return "description";

  // 3. Precio Costo / Costo / Compra
  if (
    [
      "precio_costo",
      "costo",
      "cost",
      "valor_compra",
      "precio_compra",
      "costo_unitario",
      "p_costo",
      "costo_base",
    ].includes(h)
  )
    return "cost";

  // 4. Precio Venta / Precio / Valor
  if (
    [
      "precio_venta",
      "precio",
      "price",
      "valor",
      "pvp",
      "venta",
      "p_venta",
      "precio_publico",
    ].includes(h)
  )
    return "price";

  // 5. Stock Actual
  if (
    [
      "stock_actual",
      "stock",
      "cantidad",
      "existencias",
      "inventario",
      "cant",
      "stock_quantity",
    ].includes(h)
  )
    return "stockQuantity";

  // 6. Stock Mínimo
  if (
    [
      "stock_minimo",
      "minimo",
      "min_stock",
      "stock_min",
      "alerta_stock",
      "min",
    ].includes(h)
  )
    return "minStock";

  // 7. Categoría
  if (
    [
      "categoria",
      "category",
      "seccion",
      "grupo",
      "familia",
      "linea",
      "departamento",
    ].includes(h)
  )
    return "category";

  // 8. Imagen URL
  if (
    [
      "imagen_url",
      "imagen",
      "image_url",
      "image",
      "foto",
      "url_imagen",
      "img",
    ].includes(h)
  )
    return "imageUrl";

  // 9. Código de barras
  if (
    [
      "codigo_barras",
      "barcode",
      "barra",
      "barras",
      "ean",
      "upc",
      "codigo_de_barras",
    ].includes(h)
  )
    return "barcode";

  // 10. Con Impuesto
  if (
    [
      "con_impuesto",
      "aplica_impuesto",
      "tiene_impuesto",
      "impuesto",
      "tax",
      "grava_iva",
    ].includes(h)
  )
    return "hasTax";

  // 11. Tipo Impuesto
  if (
    [
      "tipo_impuesto",
      "tipo_iva",
      "tax_type",
      "iva",
      "porcentaje_impuesto",
      "tarifa_impuesto",
    ].includes(h)
  )
    return "taxType";

  // 12. Precio Incluye Impuesto
  if (
    [
      "precio_incluye_impuesto",
      "iva_incluido",
      "incluye_impuesto",
      "tax_included",
      "incluye_iva",
    ].includes(h)
  )
    return "taxIncludedInPrice";

  // 13. Con Variante
  if (
    [
      "con_variante",
      "tiene_variante",
      "variante",
      "has_variants",
      "maneja_variantes",
    ].includes(h)
  )
    return "hasVariants";

  // 14. Variante Nombre
  if (
    [
      "variante_name",
      "nombre_variante",
      "variante_nombre",
      "variant_name",
      "tipo_variante",
    ].includes(h)
  )
    return "variantName";

  // 15. Variante Precio Costo
  if (
    [
      "variante_precio_costo",
      "costo_variante",
      "variant_cost",
      "precio_costo_variante",
    ].includes(h)
  )
    return "variantCost";

  // 16. Variante Precio Venta
  if (
    [
      "variante_precio_venta",
      "precio_variante",
      "variant_price",
      "precio_venta_variante",
    ].includes(h)
  )
    return "variantPrice";

  // 17. Variante Stock
  if (
    [
      "variante_stock",
      "stock_variante",
      "variant_stock",
      "cantidad_variante",
    ].includes(h)
  )
    return "variantStock";

  // Disponibilidad
  if (
    ["disponible", "disponibilidad", "activo", "is_available", "estado"].includes(
      h
    )
  )
    return "isAvailable";

  return h;
}

/**
 * Genera la plantilla CSV estándar completa con todas las columnas del sistema.
 */
export function generateProductsTemplateCSV(): string {
  const headers = [
    "sku",
    "nombre",
    "precio_costo",
    "precio_venta",
    "stock_actual",
    "stock_minimo",
    "categoria",
    "imagen_url",
    "codigo_barras",
    "con_impuesto",
    "tipo_impuesto",
    "precio_incluye_impuesto",
    "con_variante",
    "variante_name",
    "variante_precio_costo",
    "variante_precio_venta",
    "variante_stock",
  ];

  const sampleRows = [
    [
      "HAM-001",
      "Hamburguesa Clásica Artesanal",
      "12000",
      "28000",
      "50",
      "10",
      "Hamburguesas",
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
      "7701234567890",
      "Sí",
      "19%",
      "Sí",
      "No",
      "",
      "",
      "",
      "",
    ],
    [
      "GAS-002",
      "Gaseosa Personal 400ml",
      "2200",
      "4500",
      "100",
      "20",
      "Bebidas",
      "",
      "7709876543210",
      "Sí",
      "19%",
      "Sí",
      "No",
      "",
      "",
      "",
      "",
    ],
    [
      "PIZ-003",
      "Pizza Suprema Especial",
      "18000",
      "42000",
      "25",
      "5",
      "Pizzas",
      "",
      "7705551234567",
      "Sí",
      "8%",
      "Sí",
      "Sí",
      "Familiar 8 Porciones",
      "18000",
      "42000",
      "25",
    ],
  ];

  const csvLines = [headers.join(",")];
  for (const row of sampleRows) {
    csvLines.push(row.map(escapeCSVField).join(","));
  }

  return "\uFEFF" + csvLines.join("\r\n");
}

/**
 * Convierte el texto CSV crudo en registros validados y clasificados por fila.
 */
export function validateProductsCSV(
  csvContent: string,
  existingProducts: Product[] = []
): ParsedCSVResult {
  const rawMatrix = parseCSVToRawRows(csvContent);
  if (rawMatrix.length < 2) {
    return {
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      existingSkusCount: 0,
    };
  }

  const rawHeaders = rawMatrix[0];
  const headerKeys = rawHeaders.map(normalizeHeaderName);

  // Mapa de productos existentes indexados por SKU normalizado
  const existingBySku = new Map<string, Product>();
  for (const prod of existingProducts) {
    const sku = ((prod.metadata as any)?.sku || "").trim().toLowerCase();
    if (sku) {
      existingBySku.set(sku, prod);
    }
  }

  const validRows: ValidatedProductRow[] = [];
  const invalidRows: ValidatedProductRow[] = [];

  for (let i = 1; i < rawMatrix.length; i++) {
    const rowValues = rawMatrix[i];
    const rowNumber = i + 1; // Fila visual en la hoja de cálculo
    const rawRow: Record<string, string> = {};

    headerKeys.forEach((key, index) => {
      rawRow[key] = rowValues[index] !== undefined ? String(rowValues[index]).trim() : "";
    });

    const rowErrors: string[] = [];

    // 1. Validación de Nombre (* Requerido)
    const name = (rawRow.name || "").trim();
    if (!name) {
      rowErrors.push("El nombre del producto es obligatorio.");
    }

    // 2. Validación de Precio Venta (* Requerido)
    const price = cleanCurrencyOrNumber(rawRow.price);
    if (price === null || price < 0) {
      rowErrors.push("El precio debe ser un número válido mayor o igual a 0.");
    }

    // 3. Validación de Costo (* Requerido si la columna existe)
    let cost: number | null = null;
    if (rawRow.cost !== undefined && rawRow.cost !== "") {
      const parsedCost = cleanCurrencyOrNumber(rawRow.cost);
      if (parsedCost === null || parsedCost < 0) {
        rowErrors.push("El costo debe ser un valor numérico mayor o igual a 0.");
      } else {
        cost = parsedCost;
      }
    }

    // 4. Validación de Stock opcional
    let stockQuantity: number | null = null;
    if (rawRow.stockQuantity !== undefined && rawRow.stockQuantity !== "") {
      const parsedStock = cleanCurrencyOrNumber(rawRow.stockQuantity);
      if (parsedStock === null || parsedStock < 0) {
        rowErrors.push("El stock debe ser un número entero mayor o igual a 0.");
      } else {
        stockQuantity = Math.floor(parsedStock);
      }
    }

    // 5. Stock mínimo opcional
    let minStock: number | null = null;
    if (rawRow.minStock !== undefined && rawRow.minStock !== "") {
      const parsedMin = cleanCurrencyOrNumber(rawRow.minStock);
      if (parsedMin === null || parsedMin < 0) {
        rowErrors.push("El stock mínimo debe ser un número mayor o igual a 0.");
      } else {
        minStock = Math.floor(parsedMin);
      }
    }

    // 6. Disponibilidad
    let isAvailable = true;
    if (rawRow.isAvailable && rawRow.isAvailable !== "") {
      isAvailable = parseBooleanFlag(rawRow.isAvailable, true);
    }

    // 7. Impuestos
    const hasTax = rawRow.hasTax ? parseBooleanFlag(rawRow.hasTax, false) : undefined;
    const taxType = rawRow.taxType ? rawRow.taxType.trim() : null;
    const taxIncludedInPrice = rawRow.taxIncludedInPrice
      ? parseBooleanFlag(rawRow.taxIncludedInPrice, false)
      : undefined;

    // 8. Variantes
    const hasVariants = rawRow.hasVariants
      ? parseBooleanFlag(rawRow.hasVariants, false)
      : Boolean(rawRow.variantName);
    const variantName = rawRow.variantName ? rawRow.variantName.trim() : null;
    const variantCost = cleanCurrencyOrNumber(rawRow.variantCost);
    const variantPrice = cleanCurrencyOrNumber(rawRow.variantPrice);
    const variantStock = cleanCurrencyOrNumber(rawRow.variantStock);

    // 9. Imagen y código de barras
    const imageUrl = rawRow.imageUrl ? rawRow.imageUrl.trim() : null;
    const barcode = rawRow.barcode ? rawRow.barcode.trim() : null;

    // 10. SKU y detección de creación vs actualización
    const sku = (rawRow.sku || "").trim();
    const skuLower = sku.toLowerCase();
    let action: "create" | "update" = "create";
    let existingProductId: string | undefined;

    if (skuLower && existingBySku.has(skuLower)) {
      action = "update";
      existingProductId = existingBySku.get(skuLower)?.id;
    }

    const validatedRow: ValidatedProductRow = {
      rowNumber,
      name,
      categoryName: (rawRow.category || "").trim() || undefined,
      price: price ?? 0,
      cost,
      sku: sku || null,
      isAvailable,
      description: (rawRow.description || "").trim() || null,
      stockQuantity,
      minStock,
      imageUrl,
      barcode,
      hasTax,
      taxType,
      taxIncludedInPrice,
      hasVariants,
      variantName,
      variantCost,
      variantPrice,
      variantStock,
      action,
      existingProductId,
      isValid: rowErrors.length === 0,
      errors: rowErrors,
    };

    if (validatedRow.isValid) {
      validRows.push(validatedRow);
    } else {
      invalidRows.push(validatedRow);
    }
  }

  const existingSkusCount = validRows.filter((r) => r.action === "update").length;

  return {
    totalRows: validRows.length + invalidRows.length,
    validRows,
    invalidRows,
    existingSkusCount,
  };
}

/**
 * Importa por lotes los registros validados respetando los límites comerciales del plan.
 * Actualiza si coincide el SKU, crea nuevos productos si no existe.
 */
export async function importProductsBatch(
  businessId: string,
  validRows: ValidatedProductRow[]
): Promise<ImportBatchResult> {
  if (validRows.length === 0) {
    return {
      success: true,
      createdCount: 0,
      updatedCount: 0,
      failedCount: 0,
      errors: [],
      message: "No hay filas válidas para importar.",
    };
  }

  // 1. Verificar límite del plan comercial para los productos a crear
  const newProductsCount = validRows.filter((r) => r.action === "create").length;
  if (newProductsCount > 0) {
    const planCheck = await checkProductPlanLimit(businessId);
    if (!planCheck.allowed) {
      throw new Error(planCheck.error || "Capacidad máxima de productos alcanzada para el plan actual.");
    }

    const remainingSlots = planCheck.maxProducts - planCheck.currentCount;
    if (newProductsCount > remainingSlots) {
      throw new Error(
        `Tu plan comercial (${planCheck.planName}) permite crear hasta ${remainingSlots} productos más, pero intentas importar ${newProductsCount} productos nuevos. Actualiza tu plan o ajusta el archivo.`
      );
    }
  }

  const supabase = await getDbClient();

  // 2. Resolver o autocrear categorías mencionadas en el archivo
  const existingCategories = await getCategories(businessId);
  const categoryMapByName = new Map<string, string>();
  for (const c of existingCategories) {
    categoryMapByName.set(c.name.trim().toLowerCase(), c.id);
  }

  // Identificar categorías nuevas a crear
  const newCategoryNames = new Set<string>();
  for (const r of validRows) {
    if (r.categoryName && !categoryMapByName.has(r.categoryName.toLowerCase())) {
      newCategoryNames.add(r.categoryName);
    }
  }

  for (const catName of newCategoryNames) {
    try {
      const created = await createCategory(businessId, {
        name: catName,
        status: "active",
      });
      categoryMapByName.set(catName.toLowerCase(), created.id);
    } catch (cErr) {
      console.warn("[importProductsBatch] No se pudo autocrear categoría:", catName, cErr);
    }
  }

  // Resolver ubicación predeterminada para el inventario normalizado si hay control de stock
  let defaultLocationId: string | null = null;
  try {
    const defaultLoc = await ensureDefaultLocation(businessId);
    defaultLocationId = defaultLoc.id;
  } catch (locErr) {
    console.warn("[importProductsBatch] Advertencia al resolver ubicación de inventario:", locErr);
  }

  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const executionErrors: Array<{ rowNumber: number; productName: string; error: string }> = [];

  // 3. Procesar cada fila válida por lote de forma aislada
  for (const row of validRows) {
    try {
      const categoryId = row.categoryName
        ? categoryMapByName.get(row.categoryName.toLowerCase()) || null
        : null;

      const trackStock = row.stockQuantity !== null && row.stockQuantity !== undefined;

      if (row.action === "update" && row.existingProductId) {
        // Actualizar producto existente por SKU
        const { data: existingProd } = await supabase
          .from("products")
          .select("metadata, image_url, tax_percentage, tax_included_in_price")
          .eq("id", row.existingProductId)
          .eq("business_id", businessId)
          .single();

        const currentMeta = (existingProd?.metadata || {}) as any;

        // Manejar variantes si vienen especificadas
        let updatedVariants = Array.isArray(currentMeta.variants) ? [...currentMeta.variants] : [];
        const hasVariants = currentMeta.has_variants || row.hasVariants || Boolean(row.variantName);
        if (row.variantName) {
          const vIndex = updatedVariants.findIndex(
            (v: any) => v.name?.toLowerCase() === row.variantName!.toLowerCase()
          );
          const variantData = {
            id:
              vIndex !== -1
                ? updatedVariants[vIndex].id
                : `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: row.variantName,
            price:
              row.variantPrice !== null && row.variantPrice !== undefined
                ? row.variantPrice
                : row.price,
            cost:
              row.variantCost !== null && row.variantCost !== undefined
                ? row.variantCost
                : row.cost || null,
            stock_quantity:
              row.variantStock !== null && row.variantStock !== undefined
                ? row.variantStock
                : row.stockQuantity || null,
            sku: row.sku ? `${row.sku}-VAR` : null,
            is_available: true,
            sort_order: vIndex !== -1 ? updatedVariants[vIndex].sort_order : updatedVariants.length,
            inherit_base_ingredients: true,
          };
          if (vIndex !== -1) {
            updatedVariants[vIndex] = { ...updatedVariants[vIndex], ...variantData };
          } else {
            updatedVariants.push(variantData);
          }
        }

        const parsedTax = parseTaxPercentage(row.taxType, row.hasTax);

        const updatedMeta = {
          ...currentMeta,
          sku: row.sku || currentMeta.sku,
          barcode: row.barcode || currentMeta.barcode || null,
          cost: row.cost !== null && row.cost !== undefined ? row.cost : currentMeta.cost,
          track_stock: trackStock || currentMeta.track_stock,
          stock_quantity:
            row.stockQuantity !== null && row.stockQuantity !== undefined
              ? row.stockQuantity
              : currentMeta.stock_quantity,
          min_stock:
            row.minStock !== null && row.minStock !== undefined
              ? row.minStock
              : currentMeta.min_stock,
          tax_percentage: parsedTax !== null ? parsedTax : currentMeta.tax_percentage,
          tax_included_in_price:
            row.taxIncludedInPrice !== undefined
              ? row.taxIncludedInPrice
              : currentMeta.tax_included_in_price,
          has_variants: hasVariants,
          variants: updatedVariants,
        };

        const updateData: Record<string, any> = {
          name: row.name,
          price: row.price,
          description: row.description || undefined,
          category_id: categoryId || undefined,
          is_available: row.isAvailable,
          metadata: updatedMeta,
          updated_at: new Date().toISOString(),
        };

        if (row.imageUrl) {
          updateData.image_url = row.imageUrl;
        }
        if (parsedTax !== null) {
          updateData.tax_percentage = parsedTax;
        }
        if (row.taxIncludedInPrice !== undefined) {
          updateData.tax_included_in_price = row.taxIncludedInPrice;
        }

        const { error: updErr } = await supabase
          .from("products")
          .update(updateData)
          .eq("id", row.existingProductId)
          .eq("business_id", businessId);

        if (updErr) {
          throw new Error(`Error al actualizar: ${updErr.message}`);
        }

        // Sincronizar existencias normalizadas en inventory_stock si aplica
        if (trackStock && defaultLocationId) {
          try {
            await upsertInventoryStock(businessId, {
              productId: row.existingProductId,
              locationId: defaultLocationId,
              quantity: row.stockQuantity || 0,
              minStock: row.minStock ?? 0,
              cost: row.cost ?? 0,
            });
          } catch (stkErr) {
            console.warn("[importProductsBatch] Advertencia al sincronizar inventory_stock:", stkErr);
          }
        }

        updatedCount++;
      } else {
        // Crear nuevo producto
        const parsedTax = parseTaxPercentage(row.taxType, row.hasTax);
        const variants =
          (row.hasVariants || row.variantName) && row.variantName
            ? [
                {
                  id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  name: row.variantName,
                  price:
                    row.variantPrice !== null && row.variantPrice !== undefined
                      ? row.variantPrice
                      : row.price,
                  cost:
                    row.variantCost !== null && row.variantCost !== undefined
                      ? row.variantCost
                      : row.cost || null,
                  stock_quantity:
                    row.variantStock !== null && row.variantStock !== undefined
                      ? row.variantStock
                      : row.stockQuantity || null,
                  sku: row.sku ? `${row.sku}-VAR` : null,
                  is_available: true,
                  sort_order: 0,
                  inherit_base_ingredients: true,
                },
              ]
            : [];

        const metadata = {
          product_type: "product",
          sku: row.sku || null,
          barcode: row.barcode || null,
          cost: row.cost || null,
          track_stock: trackStock,
          stock_quantity: row.stockQuantity || 0,
          min_stock: row.minStock || 0,
          tax_percentage: parsedTax !== null ? parsedTax : 0,
          tax_included_in_price: row.taxIncludedInPrice ?? true,
          has_variants: Boolean(row.hasVariants || row.variantName),
          variants,
          available_in_pos: true,
          available_in_qr: true,
          available_online: true,
        };

        const insertData: Record<string, any> = {
          business_id: businessId,
          name: row.name,
          price: row.price,
          description: row.description || null,
          category_id: categoryId || null,
          is_available: row.isAvailable,
          status: "active",
          sort_order: 0,
          metadata,
        };

        if (row.imageUrl) {
          insertData.image_url = row.imageUrl;
        }
        if (parsedTax !== null) {
          insertData.tax_percentage = parsedTax;
        }
        if (row.taxIncludedInPrice !== undefined) {
          insertData.tax_included_in_price = row.taxIncludedInPrice;
        }

        const { data: newProd, error: insErr } = await supabase
          .from("products")
          .insert(insertData)
          .select()
          .single();

        if (insErr || !newProd) {
          throw new Error(`Error al insertar: ${insErr?.message || "No se pudo registrar"}`);
        }

        // Registrar existencias normalizadas en inventory_stock
        if (trackStock && defaultLocationId) {
          try {
            await upsertInventoryStock(businessId, {
              productId: newProd.id,
              locationId: defaultLocationId,
              quantity: row.stockQuantity || 0,
              minStock: row.minStock ?? 0,
              cost: row.cost ?? 0,
            });
          } catch (stkErr) {
            console.warn("[importProductsBatch] Advertencia al registrar stock en inventory_stock:", stkErr);
          }
        }

        createdCount++;
      }
    } catch (err: any) {
      failedCount++;
      executionErrors.push({
        rowNumber: row.rowNumber,
        productName: row.name,
        error: err?.message || "Error desconocido",
      });
    }
  }

  const message = `Importación completada: ${createdCount} creados, ${updatedCount} actualizados.${
    failedCount > 0 ? ` ${failedCount} filas fallaron.` : ""
  }`;

  return {
    success: failedCount === 0 || createdCount > 0 || updatedCount > 0,
    createdCount,
    updatedCount,
    failedCount,
    errors: executionErrors,
    message,
  };
}
