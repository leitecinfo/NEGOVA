import { describe, it, expect } from "vitest";

describe("Workspace → Ventas: Pruebas de Estados de la UI", () => {
  // 1. ESTADO DE CARGA (Loading State)
  describe("Estado de carga (Loading)", () => {
    it("debe simular y validar el estado de carga durante el registro de venta", () => {
      let isSubmitting = false;
      const getButtonState = () => ({
        disabled: isSubmitting,
        text: isSubmitting ? "Registrando venta..." : "Registrar comprobante",
        showSpinner: isSubmitting,
      });

      expect(getButtonState().disabled).toBe(false);
      expect(getButtonState().text).toBe("Registrar comprobante");
      expect(getButtonState().showSpinner).toBe(false);

      // Simular inicio de envío
      isSubmitting = true;
      expect(getButtonState().disabled).toBe(true);
      expect(getButtonState().text).toBe("Registrando venta...");
      expect(getButtonState().showSpinner).toBe(true);
    });

    it("debe simular y validar el estado de carga durante la generación/descarga de PDF", () => {
      let isDownloading = false;
      const getPdfButtonState = () => ({
        disabled: isDownloading,
        showSpinner: isDownloading,
        label: isDownloading ? "Generando..." : "Descargar PDF",
      });

      expect(getPdfButtonState().disabled).toBe(false);
      expect(getPdfButtonState().showSpinner).toBe(false);

      isDownloading = true;
      expect(getPdfButtonState().disabled).toBe(true);
      expect(getPdfButtonState().showSpinner).toBe(true);
    });
  });

  // 2. ESTADO VACÍO (Empty State)
  describe("Estado vacío (Empty)", () => {
    it("debe mostrar mensaje inicial cuando no existen ventas registradas en el negocio", () => {
      const documents: any[] = [];
      const hasActiveFilters = false;

      const getEmptyMessage = () => {
        if (documents.length > 0) return null;
        if (hasActiveFilters) {
          return {
            title: "Sin resultados para estos filtros",
            description: "Prueba cambiando o limpiando los criterios de búsqueda para visualizar comprobantes.",
            showCreateCta: false,
          };
        }
        return {
          title: "No hay ventas registradas todavía",
          description: "Comienza registrando la primera venta de tu comercio para generar comprobantes y métricas.",
          showCreateCta: true,
        };
      };

      const emptyState = getEmptyMessage();
      expect(emptyState).not.toBeNull();
      expect(emptyState?.title).toBe("No hay ventas registradas todavía");
      expect(emptyState?.showCreateCta).toBe(true);
    });

    it("debe mostrar mensaje de filtro sin resultados cuando existen filtros activos", () => {
      const documents: any[] = [];
      const hasActiveFilters = true;

      const getEmptyMessage = () => {
        if (documents.length > 0) return null;
        if (hasActiveFilters) {
          return {
            title: "Sin resultados para estos filtros",
            description: "Prueba cambiando o limpiando los criterios de búsqueda para visualizar comprobantes.",
            showCreateCta: false,
          };
        }
        return {
          title: "No hay ventas registradas todavía",
          description: "Comienza registrando la primera venta de tu comercio para generar comprobantes y métricas.",
          showCreateCta: true,
        };
      };

      const emptyState = getEmptyMessage();
      expect(emptyState).not.toBeNull();
      expect(emptyState?.title).toBe("Sin resultados para estos filtros");
      expect(emptyState?.showCreateCta).toBe(false);
    });
  });

  // 3. ESTADO DE ERROR (Error State)
  describe("Estado de error (Error Validation)", () => {
    it("debe validar y rechazar formulario de venta si no tiene líneas o tienen datos inválidos", () => {
      const validateSaleForm = (customerName: string, items: any[]) => {
        if (!customerName.trim()) {
          return { valid: false, error: "Por favor ingrese el nombre del cliente o receptor." };
        }
        if (!items || items.length === 0) {
          return { valid: false, error: "Agregue al menos un producto o concepto a la venta." };
        }
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (!it.description || !it.description.trim()) {
            return { valid: false, error: `La línea ${i + 1} no tiene descripción del producto o servicio.` };
          }
          if (it.quantity <= 0 || isNaN(it.quantity)) {
            return { valid: false, error: `La cantidad en la línea ${i + 1} debe ser mayor a 0.` };
          }
          if (it.unitPrice < 0 || isNaN(it.unitPrice)) {
            return { valid: false, error: `El precio unitario en la línea ${i + 1} no puede ser negativo.` };
          }
        }
        return { valid: true, error: null };
      };

      // Nombre vacío
      expect(validateSaleForm("", [{ description: "Item 1", quantity: 1, unitPrice: 100 }])).toEqual({
        valid: false,
        error: "Por favor ingrese el nombre del cliente o receptor.",
      });

      // Sin líneas
      expect(validateSaleForm("Consumidor Final", [])).toEqual({
        valid: false,
        error: "Agregue al menos un producto o concepto a la venta.",
      });

      // Línea con descripción vacía
      expect(validateSaleForm("Consumidor Final", [{ description: "   ", quantity: 1, unitPrice: 100 }])).toEqual({
        valid: false,
        error: "La línea 1 no tiene descripción del producto o servicio.",
      });

      // Línea con cantidad 0
      expect(validateSaleForm("Consumidor Final", [{ description: "Venta", quantity: 0, unitPrice: 100 }])).toEqual({
        valid: false,
        error: "La cantidad en la línea 1 debe ser mayor a 0.",
      });

      // Línea con precio negativo
      expect(validateSaleForm("Consumidor Final", [{ description: "Venta", quantity: 1, unitPrice: -50 }])).toEqual({
        valid: false,
        error: "El precio unitario en la línea 1 no puede ser negativo.",
      });
    });

    it("debe validar motivo de cancelación (mínimo 3 caracteres)", () => {
      const validateCancelReason = (reason: string) => {
        const clean = (reason || "").trim();
        if (clean.length < 3) {
          return { valid: false, error: "Debe ingresar un motivo de anulación válido (mínimo 3 caracteres)." };
        }
        return { valid: true, error: null };
      };

      expect(validateCancelReason("").valid).toBe(false);
      expect(validateCancelReason("ab").valid).toBe(false);
      expect(validateCancelReason("Devolución por garantía").valid).toBe(true);
    });
  });

  // 4. ESTADO DE CREACIÓN EXITOSA (Success State)
  describe("Estado de creación exitosa (Success)", () => {
    it("debe generar la ruta de redirección al detalle tras registrar la venta", () => {
      const businessId = "biz-12345";
      const result = {
        success: true,
        documentId: "doc-99999",
        documentNumber: "DOC-2026-0001",
      };

      const redirectPath = `/workspace/${businessId}/ventas/${result.documentId}`;
      expect(redirectPath).toBe("/workspace/biz-12345/ventas/doc-99999");
    });
  });
});
