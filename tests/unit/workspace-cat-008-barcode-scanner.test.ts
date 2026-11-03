import { describe, it, expect, vi } from "vitest";
import { findProductByBarcode, validateBarcodeFormat } from "@/lib/products/barcode-service";
import type { Product } from "@/lib/products/types";
import fs from "fs";
import path from "path";

// Mock de productos para pruebas de búsqueda de códigos de barras
const mockProducts: Product[] = [
  {
    id: "prod-1",
    business_id: "biz-123",
    category_id: "cat-1",
    name: "Coca Cola Original 330ml",
    description: "Bebida gaseosa refrescante",
    price: 4500,
    status: "active",
    is_available: true,
    sort_order: 1,
    metadata: {
      sku: "BEB-001",
      barcode: "7702535010015", // Código EAN-13
      product_type: "product",
    },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "prod-2",
    business_id: "biz-123",
    category_id: "cat-1",
    name: "Agua Mineral Manantial 500ml",
    description: "Agua pura de manantial sin gas",
    price: 3500,
    status: "active",
    is_available: true,
    sort_order: 2,
    metadata: {
      sku: "AGU-500",
      barcode: "7701234567890",
      product_type: "product",
    },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "prod-3",
    business_id: "biz-123",
    category_id: "cat-2",
    name: "Camiseta Deportiva NEGOVA",
    description: "Prenda deportiva transpirable",
    price: 45000,
    status: "active",
    is_available: true,
    sort_order: 3,
    metadata: {
      sku: "CAM-DEP",
      has_variants: true,
      variants: [
        {
          id: "var-s",
          name: "Talla S",
          sku: "CAM-DEP-S",
          barcode: "7709999000011",
          price: 45000,
          is_active: true,
        },
        {
          id: "var-m",
          name: "Talla M",
          sku: "CAM-DEP-M",
          barcode: "7709999000022",
          price: 45000,
          is_active: true,
        },
      ],
      product_type: "product",
    },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "prod-4",
    business_id: "biz-123",
    category_id: "cat-3",
    name: "Cerveza Artesanal IPA 355ml",
    description: "Cerveza rubia con lúpulo aromático",
    price: 12000,
    status: "active",
    is_available: false, // Agotado
    sort_order: 4,
    metadata: {
      sku: "CER-IPA-355",
      barcode: "7705555444433",
      product_type: "product",
    },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("[CAT-008] Scanner de Código de Barras", () => {
  const rootDir = process.cwd();

  // ==========================================
  // 1. Servicio de Búsqueda por Código de Barras
  // ==========================================
  describe("findProductByBarcode Service", () => {
    it("debe encontrar producto por código de barras exacto (EAN-13)", () => {
      const result = findProductByBarcode(mockProducts, "7702535010015");
      expect(result).not.toBeNull();
      expect(result?.product.id).toBe("prod-1");
      expect(result?.matchType).toBe("barcode");
      expect(result?.matchedCode).toBe("7702535010015");
    });

    it("debe ignorar espacios en blanco y diferencias de mayúsculas/minúsculas", () => {
      const result = findProductByBarcode(mockProducts, "  7701234567890  ");
      expect(result).not.toBeNull();
      expect(result?.product.id).toBe("prod-2");
    });

    it("debe encontrar producto por SKU si no coincide el código de barras", () => {
      const result = findProductByBarcode(mockProducts, "BEB-001");
      expect(result).not.toBeNull();
      expect(result?.product.id).toBe("prod-1");
      expect(result?.matchType).toBe("sku");
    });

    it("debe encontrar producto y variante por código de barras de variante específica", () => {
      const result = findProductByBarcode(mockProducts, "7709999000022");
      expect(result).not.toBeNull();
      expect(result?.product.id).toBe("prod-3");
      expect(result?.matchedVariant?.id).toBe("var-m");
      expect(result?.matchType).toBe("variant_barcode");
    });

    it("debe encontrar variante por su SKU específico", () => {
      const result = findProductByBarcode(mockProducts, "CAM-DEP-S");
      expect(result).not.toBeNull();
      expect(result?.product.id).toBe("prod-3");
      expect(result?.matchedVariant?.id).toBe("var-s");
      expect(result?.matchType).toBe("variant_sku");
    });

    it("debe retornar null cuando el código no existe en ningún producto o variante", () => {
      const result = findProductByBarcode(mockProducts, "9999999999999");
      expect(result).toBeNull();
    });

    it("debe retornar null si la lista de productos está vacía o el código es inválido", () => {
      expect(findProductByBarcode([], "7702535010015")).toBeNull();
      expect(findProductByBarcode(mockProducts, "")).toBeNull();
    });
  });

  // ==========================================
  // 2. Validación de Formatos de Código de Barras
  // ==========================================
  describe("validateBarcodeFormat Helper", () => {
    it("debe identificar formato EAN-13 correctamente", () => {
      const res = validateBarcodeFormat("7702535010015");
      expect(res.isValid).toBe(true);
      expect(res.format).toBe("EAN-13");
    });

    it("debe identificar formato EAN-8 correctamente", () => {
      const res = validateBarcodeFormat("12345670");
      expect(res.isValid).toBe(true);
      expect(res.format).toBe("EAN-8");
    });

    it("debe identificar formato UPC-A (12 dígitos)", () => {
      const res = validateBarcodeFormat("012345678905");
      expect(res.isValid).toBe(true);
      expect(res.format).toBe("UPC-A");
    });

    it("debe identificar códigos alfanuméricos como Code-128 / SKU", () => {
      const res = validateBarcodeFormat("SKU-PROD-2026");
      expect(res.isValid).toBe(true);
      expect(res.format).toContain("CODE-128");
    });

    it("debe rechazar cadenas vacías o menores a 3 caracteres", () => {
      expect(validateBarcodeFormat("").isValid).toBe(false);
      expect(validateBarcodeFormat("12").isValid).toBe(false);
    });
  });

  // ==========================================
  // 3. Integración en Componentes de POS y Catálogo
  // ==========================================
  describe("Integración en UI (POS, Modal de Producto, Catálogo)", () => {
    it("el archivo pos-screen-client.tsx integra useBarcodeScanner y BarcodeScannerModal", () => {
      const posPath = path.join(rootDir, "src/components/pos/pos-screen-client.tsx");
      expect(fs.existsSync(posPath)).toBe(true);
      const content = fs.readFileSync(posPath, "utf8");

      expect(content).toContain("useBarcodeScanner");
      expect(content).toContain("BarcodeScannerModal");
      expect(content).toContain("findProductByBarcode");
      expect(content).toContain("handleBarcodeScan");
      expect(content).toContain("Escanear");
    });

    it("el modal de producto integra escaneo por cámara de código de barras", () => {
      const modalPath = path.join(rootDir, "src/app/workspace/[businessId]/productos/product-form-modal.tsx");
      expect(fs.existsSync(modalPath)).toBe(true);
      const content = fs.readFileSync(modalPath, "utf8");

      expect(content).toContain("BarcodeScannerModal");
      expect(content).toContain("isBarcodeScannerOpen");
      expect(content).toContain("Escanear");
    });

    it("la vista de catálogo en productos-manager-client.tsx incluye botón de escanear y búsqueda por SKU/código", () => {
      const catalogPath = path.join(rootDir, "src/app/workspace/[businessId]/productos/products-manager-client.tsx");
      expect(fs.existsSync(catalogPath)).toBe(true);
      const content = fs.readFileSync(catalogPath, "utf8");

      expect(content).toContain("BarcodeScannerModal");
      expect(content).toContain("isBarcodeScannerOpen");
      expect(content).toContain("meta.barcode");
      expect(content).toContain("meta.sku");
    });

    it("BarcodeScannerModal cuenta con accesibilidad por teclado y ModalPortal", () => {
      const scannerModalPath = path.join(rootDir, "src/components/scanner/barcode-scanner-modal.tsx");
      expect(fs.existsSync(scannerModalPath)).toBe(true);
      const content = fs.readFileSync(scannerModalPath, "utf8");

      expect(content).toContain("ModalPortal");
      expect(content).toContain('role="dialog"');
      expect(content).toContain("Escape");
    });
  });

  // ==========================================
  // 4. Regla Global: Prohibido Alertas Nativas
  // ==========================================
  describe("Regla Global de Negocio", () => {
    it("los componentes de escaneo no deben invocar window.alert, window.confirm ni window.prompt", () => {
      const filesToCheck = [
        "src/components/scanner/barcode-scanner-modal.tsx",
        "src/hooks/use-barcode-scanner.ts",
        "src/lib/audio/beep.ts",
        "src/lib/products/barcode-service.ts",
      ];

      const prohibited = [
        /\bwindow\.alert\s*\(/,
        /\balert\s*\(/,
        /\bwindow\.confirm\s*\(/,
        /\bconfirm\s*\(/,
        /\bwindow\.prompt\s*\(/,
        /\bprompt\s*\(/,
        /\bAlert\.alert\s*\(/,
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.join(rootDir, relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf8");
          for (const pattern of prohibited) {
            expect(pattern.test(content)).toBe(false);
          }
        }
      }
    });
  });
});

