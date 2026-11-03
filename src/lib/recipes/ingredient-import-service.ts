import * as XLSX from "xlsx";
import { getDbClient } from "./recipe-service";
import { ensureDefaultLocation, recordInventoryMovement, upsertInventoryStock } from "@/lib/inventory/inventory-service";

// ==========================================
// TIPOS E INTERFACES DE IMPORTACIÓN
// ==========================================

export interface RawIngredientImportRow {
  rowNumber: number;
  nombre?: string;
  descripcion?: string;
  categoria?: string;
  unidad?: string;
  costo?: any;
  precio_venta?: any;
  stock?: any;
  stock_minimo?: any;
  stock_maximo?: any;
  codigo_barras?: any;
  mostrar_en_pos?: any;
  mostrar_en_qr?: any;
  mostrar_en_mesas?: any;
  mostrar_en_domicilios?: any;
  [key: string]: any;
}

export interface ValidatedIngredientRow {
  rowNumber: number;
  name: string;
  description: string | null;
  categoryName: string | null;
  categoryId: string | null;
  isNewCategory: boolean;
  unit: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  maxStock: number | null;
  barcode: string | null;
  mostrarEnPos: boolean;
  mostrarEnQr: boolean;
  mostrarEnMesas: boolean;
  mostrarEnDomicilios: boolean;
  action: "create" | "update";
  existingIngredientId?: string;
  isValid: boolean;
  errors: string[];
}

export interface ParsedIngredientResult {
  totalRows: number;
  validRows: ValidatedIngredientRow[];
  invalidRows: ValidatedIngredientRow[];
  newCategoriesCount: number;
  existingIngredientsCount: number;
}

export interface ImportIngredientsBatchResult {
  success: boolean;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  errors: Array<{ rowNumber: number; name: string; error: string }>;
  message: string;
}

// ==========================================
// UNIDADES SOPORTADAS Y NORMALIZACIÓN
// ==========================================

export const VALID_UNITS = ["unit", "kg", "g", "l", "ml"] as const;

export function normalizeUnit(rawVal: any): { unit: string; isValid: boolean } {
  if (rawVal === null || rawVal === undefined) {
    return { unit: "unit", isValid: false };
  }

  const clean = String(rawVal)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (["unit", "unidad", "unidades", "un", "u", "und", "unds", "pz", "pieza"].includes(clean)) {
    return { unit: "unit", isValid: true };
  }
  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(clean)) {
    return { unit: "kg", isValid: true };
  }
  if (["g", "gr", "grs", "gramo", "gramos"].includes(clean)) {
    return { unit: "g", isValid: true };
  }
  if (["l", "lt", "lts", "litro", "litros"].includes(clean)) {
    return { unit: "l", isValid: true };
  }
  if (["ml", "mililitro", "mililitros", "cc"].includes(clean)) {
    return { unit: "ml", isValid: true };
  }
  // Unidades gastronómicas complementarias
  if (["oz", "onza", "onzas"].includes(clean)) {
    return { unit: "unit", isValid: true };
  }
  if (["lb", "libra", "libras"].includes(clean)) {
    return { unit: "kg", isValid: true };
  }
  if (["porcion", "porciones", "porc"].includes(clean)) {
    return { unit: "unit", isValid: true };
  }

  return { unit: clean, isValid: false };
}

export function parseBooleanValue(val: any, defaultVal = false): boolean {
  if (val === null || val === undefined || val === "") return defaultVal;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;

  const str = String(val).trim().toLowerCase();
  if (["true", "si", "sí", "1", "v", "verdadero", "yes", "y", "s"].includes(str)) {
    return true;
  }
  if (["false", "no", "0", "f", "falso"].includes(str)) {
    return false;
  }
  return defaultVal;
}

export function parseNumericValue(val: any, defaultVal = 0): number {
  if (val === null || val === undefined || val === "") return defaultVal;
  if (typeof val === "number") return isNaN(val) ? defaultVal : val;

  // Limpiar caracteres de moneda y espacios
  let str = String(val).replace(/[$€\s]/g, "").trim();

  // Si tiene puntos y comas (ej. 1.500,50 o 1,500.50)
  if (str.includes(".") && str.includes(",")) {
    if (str.lastIndexOf(".") > str.lastIndexOf(",")) {
      // Formato US: 1,500.50
      str = str.replace(/,/g, "");
    } else {
      // Formato Español: 1.500,50
      str = str.replace(/\./g, "").replace(",", ".");
    }
  } else if (str.includes(",")) {
    // Si solo tiene coma, asumir decimal
    str = str.replace(",", ".");
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultVal : parsed;
}

// ==========================================
// MAPEO FLEXIBLE DE ENCABEZADOS
// ==========================================

export function normalizeHeader(headerName: string): string {
  const h = String(headerName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .trim();

  if (["nombre", "name", "ingrediente", "insumo", "materia_prima", "producto"].includes(h)) {
    return "nombre";
  }
  if (["descripcion", "description", "detalle", "notas", "observaciones"].includes(h)) {
    return "descripcion";
  }
  if (["categoria", "category", "grupo", "seccion", "rubro", "clasificacion"].includes(h)) {
    return "categoria";
  }
  if (["unidad", "unit", "uom", "medida", "unidad_medida", "unidad_de_medida"].includes(h)) {
    return "unidad";
  }
  if (["costo", "cost", "costo_unitario", "precio_costo", "valor_unitario", "cost_per_unit", "costo_compra"].includes(h)) {
    return "costo";
  }
  if (["precio_venta", "precio", "price", "pvp", "valor_venta"].includes(h)) {
    return "precio_venta";
  }
  if (["stock", "stock_inicial", "cantidad", "existencias", "initial_stock", "inventario_inicial"].includes(h)) {
    return "stock";
  }
  if (["stock_minimo", "min_stock", "minimo", "alerta_minimo", "stock_min"].includes(h)) {
    return "stock_minimo";
  }
  if (["stock_maximo", "max_stock", "maximo", "stock_max"].includes(h)) {
    return "stock_maximo";
  }
  if (
    [
      "codigo_barras",
      "codigo",
      "barcode",
      "sku",
      "ean",
      "upc",
      "cod_barras",
      "codigo_de_barras",
    ].includes(h)
  ) {
    return "codigo_barras";
  }
  if (["mostrar_en_pos", "pos", "disponible_en_pos", "available_in_pos"].includes(h)) {
    return "mostrar_en_pos";
  }
  if (["mostrar_en_qr", "qr", "disponible_en_qr", "menu_qr", "available_in_qr"].includes(h)) {
    return "mostrar_en_qr";
  }
  if (["mostrar_en_mesas", "mesas", "disponible_en_mesas", "available_in_mesas", "tables"].includes(h)) {
    return "mostrar_en_mesas";
  }
  if (["mostrar_en_domicilios", "domicilios", "delivery", "disponible_en_domicilios", "available_online", "online"].includes(h)) {
    return "mostrar_en_domicilios";
  }

  return h;
}

// ==========================================
// PARSER DE ARCHIVOS (CSV, XLSX, XLS)
// ==========================================

export function parseFileRawRows(fileData: ArrayBuffer | Uint8Array | string): RawIngredientImportRow[] {
  let workbook: XLSX.WorkBook;

  if (typeof fileData === "string") {
    workbook = XLSX.read(fileData, { type: "string" });
  } else {
    workbook = XLSX.read(fileData, { type: "array" });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];

  // Convertir hoja a matriz 2D
  const matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
  if (matrix.length < 2) return [];

  const headerRow = matrix[0] || [];
  const normalizedHeaders = headerRow.map((h) => normalizeHeader(String(h)));

  const parsedRows: RawIngredientImportRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const rowValues = matrix[r];
    if (!rowValues || rowValues.every((c) => c === null || c === undefined || String(c).trim() === "")) {
      continue; // Ignorar filas totalmente vacías
    }

    const rowObj: RawIngredientImportRow = { rowNumber: r + 1 };

    for (let c = 0; c < normalizedHeaders.length; c++) {
      const headerKey = normalizedHeaders[c];
      if (headerKey) {
        rowObj[headerKey] = rowValues[c] !== undefined ? rowValues[c] : "";
      }
    }

    parsedRows.push(rowObj);
  }

  return parsedRows;
}

// ==========================================
// VALIDACIÓN Y MAPEO DE REGISTROS
// ==========================================

export function validateIngredientRows(
  rawRows: RawIngredientImportRow[],
  existingIngredients: any[] = [],
  existingCategories: any[] = []
): ParsedIngredientResult {
  const validRows: ValidatedIngredientRow[] = [];
  const invalidRows: ValidatedIngredientRow[] = [];

  // Mapas para detección rápida de duplicados y categorías
  const categoriesByName = new Map<string, any>();
  for (const cat of existingCategories) {
    categoriesByName.set(cat.name.trim().toLowerCase(), cat);
  }

  const ingredientsByName = new Map<string, any>();
  const ingredientsByBarcode = new Map<string, any>();
  for (const ing of existingIngredients) {
    if (ing.name) ingredientsByName.set(ing.name.trim().toLowerCase(), ing);
    const barcode = (ing.metadata?.barcode || ing.metadata?.sku || "").trim().toLowerCase();
    if (barcode) ingredientsByBarcode.set(barcode, ing);
  }

  const discoveredNewCategories = new Set<string>();
  let existingMatchesCount = 0;

  for (const raw of rawRows) {
    const errors: string[] = [];

    // 1. Nombre (Requerido)
    const name = String(raw.nombre || "").trim();
    if (!name) {
      errors.push("El nombre es requerido.");
    }

    // 2. Unidad (Requerido: unit, kg, g, l, ml)
    const rawUnit = raw.unidad;
    const { unit, isValid: isUnitValid } = normalizeUnit(rawUnit);
    if (!rawUnit || String(rawUnit).trim() === "") {
      errors.push("La unidad de medida es requerida.");
    } else if (!isUnitValid) {
      errors.push(`Unidad «${rawUnit}» no válida. Debe ser unit, kg, g, l o ml.`);
    }

    // 3. Costo (Requerido)
    const rawCost = raw.costo;
    if (rawCost === null || rawCost === undefined || String(rawCost).trim() === "") {
      errors.push("El costo es requerido.");
    }
    const cost = parseNumericValue(rawCost, -1);
    if (cost < 0) {
      errors.push("El costo debe ser un número igual o superior a 0.");
    }

    // 4. Categoría (Opcional, autogeneración si no existe)
    const rawCategory = raw.categoria ? String(raw.categoria).trim() : null;
    let categoryId: string | null = null;
    let isNewCategory = false;

    if (rawCategory) {
      const matchCat = categoriesByName.get(rawCategory.toLowerCase());
      if (matchCat) {
        categoryId = matchCat.id;
      } else {
        isNewCategory = true;
        discoveredNewCategories.add(rawCategory.toLowerCase());
      }
    }

    // 5. Campos numéricos opcionales
    const price = parseNumericValue(raw.precio_venta, 0);
    const stock = parseNumericValue(raw.stock, 0);
    const minStock = parseNumericValue(raw.stock_minimo, 0);
    const rawMaxStock = raw.stock_maximo;
    const maxStock =
      rawMaxStock !== undefined && rawMaxStock !== null && String(rawMaxStock).trim() !== ""
        ? parseNumericValue(rawMaxStock, 0)
        : null;

    if (stock < 0) errors.push("El stock no puede ser negativo.");
    if (minStock < 0) errors.push("El stock mínimo no puede ser negativo.");
    if (maxStock !== null && maxStock < minStock) {
      errors.push("El stock máximo no puede ser inferior al stock mínimo.");
    }

    // 6. Código de barras (Opcional)
    const barcode = raw.codigo_barras ? String(raw.codigo_barras).trim() : null;

    // 7. Canales de visualización (TRUE/FALSE)
    const mostrarEnPos = parseBooleanValue(raw.mostrar_en_pos, false);
    const mostrarEnQr = parseBooleanValue(raw.mostrar_en_qr, false);
    const mostrarEnMesas = parseBooleanValue(raw.mostrar_en_mesas, false);
    const mostrarEnDomicilios = parseBooleanValue(raw.mostrar_en_domicilios, false);

    // 8. Detección de ingrediente existente (Actualización vs Creación)
    let action: "create" | "update" = "create";
    let existingId: string | undefined = undefined;

    if (barcode && ingredientsByBarcode.has(barcode.toLowerCase())) {
      action = "update";
      existingId = ingredientsByBarcode.get(barcode.toLowerCase()).id;
      existingMatchesCount++;
    } else if (name && ingredientsByName.has(name.toLowerCase())) {
      action = "update";
      existingId = ingredientsByName.get(name.toLowerCase()).id;
      existingMatchesCount++;
    }

    const rowResult: ValidatedIngredientRow = {
      rowNumber: raw.rowNumber,
      name,
      description: raw.descripcion ? String(raw.descripcion).trim() : null,
      categoryName: rawCategory,
      categoryId,
      isNewCategory,
      unit,
      cost: Math.max(0, cost),
      price: Math.max(0, price),
      stock: Math.max(0, stock),
      minStock: Math.max(0, minStock),
      maxStock,
      barcode,
      mostrarEnPos,
      mostrarEnQr,
      mostrarEnMesas,
      mostrarEnDomicilios,
      action,
      existingIngredientId: existingId,
      isValid: errors.length === 0,
      errors,
    };

    if (rowResult.isValid) {
      validRows.push(rowResult);
    } else {
      invalidRows.push(rowResult);
    }
  }

  return {
    totalRows: rawRows.length,
    validRows,
    invalidRows,
    newCategoriesCount: discoveredNewCategories.size,
    existingIngredientsCount: existingMatchesCount,
  };
}

// ==========================================
// GENERACIÓN DE PLANTILLAS (CSV Y EXCEL)
// ==========================================

export const TEMPLATE_COLUMNS = [
  "nombre",
  "descripcion",
  "categoria",
  "unidad",
  "costo",
  "precio_venta",
  "stock",
  "stock_minimo",
  "stock_maximo",
  "codigo_barras",
  "mostrar_en_pos",
  "mostrar_en_qr",
  "mostrar_en_mesas",
  "mostrar_en_domicilios",
];

export const SAMPLE_INGREDIENT_ROWS = [
  [
    "Harina de Trigo Especial",
    "Harina de fuerza para masas de pizza",
    "Panadería y Masas",
    "kg",
    4200,
    0,
    50,
    10,
    200,
    "7701234567890",
    "FALSE",
    "FALSE",
    "FALSE",
    "FALSE",
  ],
  [
    "Queso Mozzarella Rallado",
    "Bolsa 2.5kg para gratinar",
    "Lácteos y Quesos",
    "kg",
    22500,
    0,
    30,
    8,
    100,
    "7701234567891",
    "FALSE",
    "FALSE",
    "FALSE",
    "FALSE",
  ],
  [
    "Salsa BBQ Ahumada",
    "Salsa de la casa para hamburguesas y costillas",
    "Salsas y Aderezos",
    "ml",
    18,
    2500,
    5000,
    1000,
    20000,
    "7701234567892",
    "TRUE",
    "TRUE",
    "TRUE",
    "TRUE",
  ],
  [
    "Caja Hamburguesa Biodegradable",
    "Empaque kraft resistente a la grasa",
    "Desechables",
    "unit",
    450,
    0,
    300,
    50,
    1000,
    "7701234567893",
    "FALSE",
    "FALSE",
    "FALSE",
    "FALSE",
  ],
  [
    "Leche Entera Pasteurizada",
    "Bolsa 1 Litro",
    "Lácteos y Quesos",
    "l",
    3600,
    0,
    24,
    6,
    60,
    "7701234567894",
    "FALSE",
    "FALSE",
    "FALSE",
    "FALSE",
  ],
];

export function generateIngredientCSVTemplate(): string {
  const rows: string[] = [TEMPLATE_COLUMNS.join(",")];

  for (const row of SAMPLE_INGREDIENT_ROWS) {
    const escaped = row.map((val) => {
      const str = String(val);
      if (str.includes(",") || str.includes(";") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    rows.push(escaped.join(","));
  }

  // Prepend UTF-8 BOM (\uFEFF) para visualización correcta en Excel
  return "\uFEFF" + rows.join("\r\n");
}

export function generateIngredientExcelTemplate(): Uint8Array {
  const wsData = [TEMPLATE_COLUMNS, ...SAMPLE_INGREDIENT_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Ancho estimado de columnas
  ws["!cols"] = [
    { wch: 30 }, // nombre
    { wch: 40 }, // descripcion
    { wch: 22 }, // categoria
    { wch: 10 }, // unidad
    { wch: 12 }, // costo
    { wch: 14 }, // precio_venta
    { wch: 10 }, // stock
    { wch: 14 }, // stock_minimo
    { wch: 14 }, // stock_maximo
    { wch: 18 }, // codigo_barras
    { wch: 16 }, // mostrar_en_pos
    { wch: 16 }, // mostrar_en_qr
    { wch: 18 }, // mostrar_en_mesas
    { wch: 22 }, // mostrar_en_domicilios
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ingredientes");

  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

// ==========================================
// IMPORTACIÓN EN LOTE (BATCH EXECUTION)
// ==========================================

export async function importIngredientsBatch(
  businessId: string,
  rows: ValidatedIngredientRow[],
  locationId?: string | null,
  userId?: string | null
): Promise<ImportIngredientsBatchResult> {
  const supabase = await getDbClient();

  // 1. Resolver ubicación
  let defaultLocId = locationId;
  if (!defaultLocId) {
    const defLoc = await ensureDefaultLocation(businessId);
    defaultLocId = defLoc.id;
  }

  // 2. Resolver o autogenerar categorías
  const { data: existingCats } = await supabase
    .from("categories")
    .select("id, name")
    .eq("business_id", businessId);

  const categoryMap = new Map<string, string>();
  for (const c of existingCats || []) {
    categoryMap.set(c.name.trim().toLowerCase(), c.id);
  }

  // Identificar categorías faltantes que necesitan autogeneración
  const neededCategories = new Set<string>();
  for (const row of rows) {
    if (row.categoryName && !categoryMap.has(row.categoryName.trim().toLowerCase())) {
      neededCategories.add(row.categoryName.trim());
    }
  }

  // Autogenerar categorías nuevas en base de datos
  for (const catName of neededCategories) {
    const { data: createdCat, error: catErr } = await supabase
      .from("categories")
      .insert({
        business_id: businessId,
        name: catName,
        description: "Categoría de insumos autogenerada durante importación masiva",
        sort_order: 999,
        status: "active",
      })
      .select("id")
      .single();

    if (!catErr && createdCat) {
      categoryMap.set(catName.toLowerCase(), createdCat.id);
    }
  }

  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const executionErrors: Array<{ rowNumber: number; name: string; error: string }> = [];

  for (const row of rows) {
    try {
      const resolvedCategoryId = row.categoryName
        ? categoryMap.get(row.categoryName.trim().toLowerCase()) || null
        : null;

      const metadata = {
        product_type: "ingredient",
        unit: row.unit,
        cost: row.cost,
        barcode: row.barcode || null,
        sku: row.barcode || null,
        track_stock: true,
        stock_quantity: row.stock,
        min_stock: row.minStock,
        max_stock: row.maxStock,
        available_in_pos: row.mostrarEnPos,
        available_in_qr: row.mostrarEnQr,
        show_in_qr_menu: row.mostrarEnQr,
        available_in_mesas: row.mostrarEnMesas,
        available_in_domicilios: row.mostrarEnDomicilios,
        available_online: row.mostrarEnDomicilios,
      };

      if (row.action === "update" && row.existingIngredientId) {
        // Actualizar ingrediente existente
        const { error: updErr } = await supabase
          .from("products")
          .update({
            name: row.name,
            description: row.description,
            price: row.price,
            category_id: resolvedCategoryId,
            available_in_pos: row.mostrarEnPos,
            available_in_qr: row.mostrarEnQr,
            metadata,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.existingIngredientId)
          .eq("business_id", businessId);

        if (updErr) {
          throw new Error(`Error al actualizar: ${updErr.message}`);
        }

        // Sincronizar existencias en inventory_stock si se especificó stock
        if (defaultLocId) {
          await upsertInventoryStock(businessId, {
            productId: row.existingIngredientId,
            locationId: defaultLocId,
            quantity: row.stock,
            minStock: row.minStock,
            cost: row.cost,
          });
        }

        updatedCount++;
      } else {
        // Crear nuevo ingrediente
        const { data: newProd, error: insErr } = await supabase
          .from("products")
          .insert({
            business_id: businessId,
            name: row.name,
            description: row.description,
            price: row.price,
            category_id: resolvedCategoryId,
            is_available: true,
            status: "active",
            available_in_pos: row.mostrarEnPos,
            available_in_qr: row.mostrarEnQr,
            metadata,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insErr || !newProd) {
          throw new Error(`Error al insertar ingrediente: ${insErr?.message || "No se pudo registrar"}`);
        }

        // Registrar inventario inicial y movimiento
        if (defaultLocId) {
          await upsertInventoryStock(businessId, {
            productId: newProd.id,
            locationId: defaultLocId,
            quantity: row.stock,
            minStock: row.minStock,
            cost: row.cost,
          });

          if (row.stock > 0) {
            try {
              await recordInventoryMovement(
                businessId,
                {
                  productId: newProd.id,
                  locationId: defaultLocId,
                  movementType: "entry",
                  quantity: row.stock,
                  unitCost: row.cost,
                  referenceType: "adjustment",
                  notes: "Carga inicial masiva de ingredientes",
                },
                userId
              );
            } catch (movErr) {
              console.warn("[importIngredientsBatch] Movimiento kardex no registrado:", movErr);
            }
          }
        }

        createdCount++;
      }
    } catch (err: any) {
      failedCount++;
      executionErrors.push({
        rowNumber: row.rowNumber,
        name: row.name,
        error: err?.message || "Error desconocido durante la importación",
      });
    }
  }

  const message = `Importación completada: ${createdCount} creados, ${updatedCount} actualizados.${
    failedCount > 0 ? ` ${failedCount} fallaron.` : ""
  }`;

  return {
    success: createdCount > 0 || updatedCount > 0 || failedCount === 0,
    createdCount,
    updatedCount,
    failedCount,
    errors: executionErrors,
    message,
  };
}
