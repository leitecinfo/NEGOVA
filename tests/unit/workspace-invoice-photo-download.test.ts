import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("[FACTURAS-FOTO] Descarga y Compartir de Factura como Imagen / Foto en lugar de PDF", () => {
  const downloadUtilPath = path.resolve(
    __dirname,
    "../../src/lib/printing/download-invoice-image.ts"
  );
  const orderDetailModalPath = path.resolve(
    __dirname,
    "../../src/app/workspace/[businessId]/pedidos/order-detail-modal.tsx"
  );
  const posInvoiceModalPath = path.resolve(
    __dirname,
    "../../src/components/pos/pos-invoice-modal.tsx"
  );
  const thermalTicketModalPath = path.resolve(
    __dirname,
    "../../src/components/printing/thermal-ticket.tsx"
  );

  it("debe existir la utilidad download-invoice-image.ts con export downloadElementAsImage", () => {
    expect(fs.existsSync(downloadUtilPath)).toBe(true);
    const content = fs.readFileSync(downloadUtilPath, "utf-8");
    expect(content).toContain("export async function downloadElementAsImage");
    expect(content).toContain("toBlob");
    expect(content).toContain("image/png");
  });

  it("order-detail-modal.tsx debe ofrecer 'Descargar foto' en lugar de 'Descargar PDF'", () => {
    expect(fs.existsSync(orderDetailModalPath)).toBe(true);
    const content = fs.readFileSync(orderDetailModalPath, "utf-8");
    expect(content).toContain("<span>Descargar foto</span>");
    expect(content).toContain("handleDownloadPhoto");
    expect(content).toContain("downloadElementAsImage");
    expect(content).toContain("receiptCaptureRef");
    // No debe tener el botón obsoleto de Descargar PDF
    expect(content).not.toContain("<span>Descargar PDF</span>");
  });

  it("pos-invoice-modal.tsx debe incluir el botón 'Descargar foto'", () => {
    expect(fs.existsSync(posInvoiceModalPath)).toBe(true);
    const content = fs.readFileSync(posInvoiceModalPath, "utf-8");
    expect(content).toContain("<span>Descargar foto</span>");
    expect(content).toContain("handleDownloadPhoto");
    expect(content).toContain("downloadElementAsImage");
  });

  it("thermal-ticket.tsx debe incluir el botón 'Descargar foto'", () => {
    expect(fs.existsSync(thermalTicketModalPath)).toBe(true);
    const content = fs.readFileSync(thermalTicketModalPath, "utf-8");
    expect(content).toContain("<span>Descargar foto</span>");
    expect(content).toContain("handleDownloadPhoto");
    expect(content).toContain("downloadElementAsImage");
  });

  it("ningún archivo modificado debe invocar window.alert ni alertas nativas", () => {
    const files = [
      downloadUtilPath,
      orderDetailModalPath,
      posInvoiceModalPath,
      thermalTicketModalPath,
    ];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("window.alert");
      expect(content).not.toContain("window.confirm");
      expect(content).not.toContain("window.prompt");
    }
  });
});
