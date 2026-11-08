import * as XLSX from "xlsx";
import { Ingredient } from "./types";

/**
 * Escapa y formatea un valor para una celda CSV.
 */
function escapeCSVField(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (
    str.includes(",") ||
    str.includes(";") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const INGREDIENT_EXPORT_HEADERS = [
  "Nombre",
  "Tipo",
  "Categoría",
  "SKU",
  "Código de barras",
  "Unidad de medida",
  "Existencia actual",
  "Stock mínimo",
  "Costo unitario",
  "Estado",
];

/**
 * Genera el archivo CSV con todos los materiales (ingredientes e insumos) del negocio.
 * Incluye UTF-8 BOM (\uFEFF) para compatibilidad con Microsoft Excel en Windows / español.
 */
export function generateIngredientsCSV(ingredients: Ingredient[]): string {
  const rows: string[] = [INGREDIENT_EXPORT_HEADERS.map(escapeCSVField).join(",")];

  for (const item of ingredients) {
    const row = [
      escapeCSVField(item.name),
      escapeCSVField(item.type === "supply" ? "Insumo" : "Ingrediente"),
      escapeCSVField(item.categoryName || ""),
      escapeCSVField(item.sku || ""),
      escapeCSVField(item.barcode || ""),
      escapeCSVField(item.unit),
      escapeCSVField(item.stockQuantity),
      escapeCSVField(item.minStock),
      escapeCSVField(item.costPerUnit),
      escapeCSVField(item.isAvailable ? "Activo" : "Inactivo"),
    ];
    rows.push(row.join(","));
  }

  return "\uFEFF" + rows.join("\r\n");
}

/**
 * Genera un buffer de Excel (.xlsx) con los ingredientes e insumos.
 */
export function generateIngredientsExcel(ingredients: Ingredient[]): Uint8Array {
  const data = [
    INGREDIENT_EXPORT_HEADERS,
    ...ingredients.map((item) => [
      item.name,
      item.type === "supply" ? "Insumo" : "Ingrediente",
      item.categoryName || "",
      item.sku || "",
      item.barcode || "",
      item.unit,
      item.stockQuantity,
      item.minStock,
      item.costPerUnit,
      item.isAvailable ? "Activo" : "Inactivo",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ingredientes e Insumos");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbout);
}

