import { Product, ProductVariant } from "./types";

export interface BarcodeMatchResult {
  product: Product;
  matchedVariant?: ProductVariant;
  matchType: "barcode" | "sku" | "variant_barcode" | "variant_sku";
  matchedCode: string;
}

/**
 * Busca un producto o variante dentro de una lista por código de barras o SKU.
 * Prioridad de resolución:
 * 1. Coincidencia exacta de `metadata.barcode`
 * 2. Coincidencia de `variant.barcode` en variantes
 * 3. Coincidencia exacta de `metadata.sku`
 * 4. Coincidencia de `variant.sku` en variantes
 */
export function findProductByBarcode(
  products: Product[],
  scannedCode: string
): BarcodeMatchResult | null {
  if (!scannedCode || !products || products.length === 0) return null;

  const code = scannedCode.trim();
  const codeLower = code.toLowerCase();

  // 1. Coincidencia directa de metadata.barcode
  for (const product of products) {
    const meta = (product.metadata || {}) as Record<string, any>;
    const pBarcode = (meta.barcode || "").toString().trim();
    if (pBarcode && pBarcode.toLowerCase() === codeLower) {
      return {
        product,
        matchType: "barcode",
        matchedCode: pBarcode,
      };
    }
  }

  // 2. Coincidencia en variantes (variant.barcode)
  for (const product of products) {
    const meta = (product.metadata || {}) as Record<string, any>;
    const variants = (meta.variants || []) as ProductVariant[];
    for (const v of variants) {
      const vBarcode = ((v as any).barcode || "").toString().trim();
      if (vBarcode && vBarcode.toLowerCase() === codeLower) {
        return {
          product,
          matchedVariant: v,
          matchType: "variant_barcode",
          matchedCode: vBarcode,
        };
      }
    }
  }

  // 3. Coincidencia con SKU del producto
  for (const product of products) {
    const meta = (product.metadata || {}) as Record<string, any>;
    const pSku = (meta.sku || "").toString().trim();
    if (pSku && pSku.toLowerCase() === codeLower) {
      return {
        product,
        matchType: "sku",
        matchedCode: pSku,
      };
    }
  }

  // 4. Coincidencia en SKU de variante
  for (const product of products) {
    const meta = (product.metadata || {}) as Record<string, any>;
    const variants = (meta.variants || []) as ProductVariant[];
    for (const v of variants) {
      const vSku = (v.sku || "").toString().trim();
      if (vSku && vSku.toLowerCase() === codeLower) {
        return {
          product,
          matchedVariant: v,
          matchType: "variant_sku",
          matchedCode: vSku,
        };
      }
    }
  }

  return null;
}

/**
 * Valida si una cadena parece un código de barras válido (EAN-13, EAN-8, UPC-A, Code 128 o alfanumérico estándar).
 */
export function validateBarcodeFormat(code: string): { isValid: boolean; format: string } {
  const clean = (code || "").trim();
  if (!clean || clean.length < 3) {
    return { isValid: false, format: "unknown" };
  }

  const isNumeric = /^\d+$/.test(clean);

  if (isNumeric) {
    if (clean.length === 13) return { isValid: true, format: "EAN-13" };
    if (clean.length === 8) return { isValid: true, format: "EAN-8" };
    if (clean.length === 12) return { isValid: true, format: "UPC-A" };
    if (clean.length === 14) return { isValid: true, format: "ITF-14 / GTIN-14" };
    return { isValid: true, format: "NUMERIC_BARCODE" };
  }

  // Alfanumérico (Code 128 / Code 39 / SKU)
  if (/^[A-Za-z0-9_\-\.\/]+$/.test(clean)) {
    return { isValid: true, format: "CODE-128 / SKU" };
  }

  return { isValid: false, format: "unknown" };
}

