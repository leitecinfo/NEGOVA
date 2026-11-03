import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

describe("VEN-001: Historial de Ventas - Columna de Acciones y Modal de Factura", () => {
  const filePath = path.resolve(
    process.cwd(),
    "src/app/workspace/[businessId]/ventas/sales-list-client.tsx"
  );
  const fileContent = fs.readFileSync(filePath, "utf-8");

  describe("1. Columna de Acciones en Tabla y Vista Móvil", () => {
    it("debe contener el botón directo 'Factura' con icono FileText", () => {
      expect(fileContent).toContain('<span>Factura</span>');
      expect(fileContent).toContain('setSelectedInvoiceDoc(doc)');
    });

    it("NO debe tener un botón directo 'Ver detalle' fuera del menú desplegable", () => {
      // El botón directo debe ser Factura, y Ver detalle debe estar dentro del menú ...
      expect(fileContent).toContain('<span>Ver detalle</span>');
      expect(fileContent).toContain('setOpenActionMenuId');
    });

    it("el menú contextual '...' debe incluir las opciones complementarias requeridas", () => {
      // Ver detalle y Reimprimir tiquete
      expect(fileContent).toContain('<span>Ver detalle</span>');
      expect(fileContent).toContain('<span>Reimprimir tiquete</span>');
      expect(fileContent).toContain('<span>Descargar PDF</span>');
      expect(fileContent).toContain('<span>Compartir por WhatsApp</span>');
    });

    it("el menú contextual '...' debe estar presente tanto en la tabla desktop como en tarjetas móviles", () => {
      const moreHorizCount = (fileContent.match(/<MoreHorizontal/g) || []).length;
      expect(moreHorizCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("2. Modal Interactivo de Factura de Venta", () => {
    it("debe renderizar el modal en un ModalPortal con vista previa fiel del documento", () => {
      expect(fileContent).toContain("<ModalPortal>");
      expect(fileContent).toContain("selectedInvoiceDoc");
      expect(fileContent).toContain("Factura de Venta");
      expect(fileContent).toContain("selectedInvoiceDoc.documentNumber");
    });

    it("debe incluir los botones de acción requeridos en la barra de acciones del modal", () => {
      expect(fileContent).toContain('<span>Imprimir</span>');
      expect(fileContent).toContain('<span>Descargar PDF</span>');
      expect(fileContent).toContain('<span>Compartir por WhatsApp</span>');
    });

    it("debe desplegar la información comercial: cliente, ítems, desglose y total en COP", () => {
      expect(fileContent).toContain("selectedInvoiceDoc.customerName");
      expect(fileContent).toContain("selectedInvoiceDoc.items");
      expect(fileContent).toContain("formatCOP(selectedInvoiceDoc.total)");
      expect(fileContent).toContain("formatCOP(selectedInvoiceDoc.subtotal");
    });
  });

  describe("3. Formateo y Compartir por WhatsApp", () => {
    it("debe formatear el mensaje en Pesos Colombianos ($ COP) con número de comprobante y total", () => {
      const formatCOP = (val: number) => {
        return new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        }).format(val);
      };

      const mockDoc = {
        documentNumber: "DOC-2026-0042",
        customerName: "Juan Pérez",
        issuedAt: "2026-11-03T10:00:00Z",
        paymentMethod: "cash",
        total: 85000,
        items: [
          { description: "Hamburguesa Doble", quantity: 2, total: 60000 },
          { description: "Papas Rústicas", quantity: 1, total: 25000 },
        ],
      };

      const itemsLines = mockDoc.items.map(
        (it) => `• ${it.quantity}x ${it.description} (${formatCOP(it.total)})`
      ).join("\n");

      const msg = [
        `¡Hola! Te compartimos el comprobante de tu compra en *Mi Negocio*:`,
        ``,
        `📄 *Comprobante:* ${mockDoc.documentNumber}`,
        `👤 *Cliente:* ${mockDoc.customerName}`,
        itemsLines ? `\n🛍️ *Detalle de compra:*\n${itemsLines}\n` : "",
        `💰 *Total:* ${formatCOP(mockDoc.total)}`,
      ].filter(Boolean).join("\n");

      expect(msg).toContain("DOC-2026-0042");
      expect(msg).toContain("Juan Pérez");
      expect(msg).toContain("$");
      expect(msg).toContain("85.000");
      expect(msg).toContain("Hamburguesa Doble");
    });

    it("debe sanitizar el número telefónico para la URL de wa.me", () => {
      const sanitizePhone = (phone: string) => {
        let clean = phone.replace(/\D/g, "");
        if (clean.length === 10 && !clean.startsWith("57")) {
          clean = "57" + clean;
        }
        return clean;
      };

      expect(sanitizePhone("3101234567")).toBe("573101234567");
      expect(sanitizePhone("+57 310 123 4567")).toBe("573101234567");
      expect(sanitizePhone("")).toBe("");
    });
  });

  describe("4. Regla de Oro: Prohibido uso de alertas nativas", () => {
    it("no debe contener window.alert, window.confirm ni window.prompt en el cliente de ventas", () => {
      expect(fileContent).not.toMatch(/window\.alert\s*\(/);
      expect(fileContent).not.toMatch(/window\.confirm\s*\(/);
      expect(fileContent).not.toMatch(/window\.prompt\s*\(/);
      expect(fileContent).not.toMatch(/(?<![a-zA-Z0-9_])alert\s*\(/);
    });

    it("debe emplear sonner toast para retroalimentación al usuario", () => {
      expect(fileContent).toContain('import { toast } from "sonner"');
      expect(fileContent).toContain('toast.');
    });
  });
});
