import { describe, it, expect } from "vitest";
import {
  MOVEMENT_ORIGIN_OPTIONS,
  resolveMovementOrigin,
  formatMovementDate,
  MovementOrigin,
} from "@/lib/inventory/types";
import * as fs from "fs";
import * as path from "path";

describe("Pestaña 'Historial' dentro de /workspace/[businessId]/inventario", () => {
  describe("1. Encabezado y Opciones de Canal/Origen", () => {
    it("debe contar con las opciones requeridas en el filtro desplegable de origen [TAREA-08]", () => {
      expect(MOVEMENT_ORIGIN_OPTIONS.some((o) => o.value === "all")).toBe(true);
      expect(MOVEMENT_ORIGIN_OPTIONS.some((o) => o.value === "Compra")).toBe(true);
      expect(MOVEMENT_ORIGIN_OPTIONS.some((o) => o.value === "Merma")).toBe(true);
      expect(MOVEMENT_ORIGIN_OPTIONS.some((o) => o.value === "Ajuste")).toBe(true);
      expect(MOVEMENT_ORIGIN_OPTIONS.some((o) => o.value === "Receta")).toBe(true);
      expect(MOVEMENT_ORIGIN_OPTIONS.some((o) => o.value === "POS")).toBe(true);
      expect(MOVEMENT_ORIGIN_OPTIONS.some((o) => o.value === "Mesa")).toBe(true);
      expect(MOVEMENT_ORIGIN_OPTIONS.some((o) => o.value === "Domicilio")).toBe(true);
      expect(MOVEMENT_ORIGIN_OPTIONS.some((o) => o.value === "Devolución")).toBe(true);
      expect(MOVEMENT_ORIGIN_OPTIONS.some((o) => o.value === "Otro")).toBe(true);
    });

    it("el archivo de la pestaña Historial debe existir y tener el encabezado 'Historial de Movimientos'", () => {
      const filePath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/inventario/inventory-history-tab.tsx"
      );
      expect(fs.existsSync(filePath), `El archivo ${filePath} debe existir`).toBe(true);

      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("Historial de Movimientos");
    });
  });

  describe("2. Trazabilidad y Resolución del Origen Operativo (Kardex)", () => {
    it("debe clasificar como POS las ventas en caja, mostrador y para llevar", () => {
      const originTakeout = resolveMovementOrigin({
        orderType: "takeout",
        movementType: "sale",
        notes: "Venta directa en caja",
      });
      expect(originTakeout).toBe("POS");

      const originPosText = resolveMovementOrigin({
        movementType: "sale",
        notes: "Venta POS #1029",
      });
      expect(originPosText).toBe("POS");
    });

    it("debe clasificar como Mesa los consumos en salón / dine_in", () => {
      const originDineIn = resolveMovementOrigin({
        orderType: "dine_in",
        notes: "Consumo comensales",
      });
      expect(originDineIn).toBe("Mesa");

      const originMesaNotes = resolveMovementOrigin({
        referenceType: "restaurant_order",
        notes: "Comanda Mesa 4 salón principal",
      });
      expect(originMesaNotes).toBe("Mesa");
    });

    it("debe clasificar como Domicilio los pedidos de delivery / reparto", () => {
      const originDelivery = resolveMovementOrigin({
        orderType: "delivery",
        notes: "Pedido domicilio cliente Calle 10 #5-20",
      });
      expect(originDelivery).toBe("Domicilio");

      const originRappi = resolveMovementOrigin({
        notes: "Pedido despachado por Rappi",
      });
      expect(originRappi).toBe("Domicilio");
    });

    it("debe clasificar como Devolución las anulaciones de ventas, notas de crédito o reintegros", () => {
      const originCancellation = resolveMovementOrigin({
        referenceType: "sale_cancellation",
        notes: "Devolución de stock por anulación de venta FV-102",
      });
      expect(originCancellation).toBe("Devolución");

      const originCreditNote = resolveMovementOrigin({
        docType: "credit_note",
        notes: "Reintegro de unidades por producto defectuoso",
      });
      expect(originCreditNote).toBe("Devolución");
    });

    it("debe clasificar con precisión compras, mermas, ajustes y otros movimientos [TAREA-08]", () => {
      const originPurchase = resolveMovementOrigin({
        referenceType: "purchase",
        notes: "Compra Factura Proveedor #8821",
        movementType: "entry",
      });
      expect(originPurchase).toBe("Compra");

      const originAdjustment = resolveMovementOrigin({
        movementType: "adjustment",
        notes: "Ajuste físico de inventario fin de mes",
      });
      expect(originAdjustment).toBe("Ajuste");

      const originSpoilage = resolveMovementOrigin({
        movementType: "spoilage",
        notes: "Merma por vencimiento de producto",
      });
      expect(originSpoilage).toBe("Merma");

      const originOther = resolveMovementOrigin({
        notes: "Cierre anual no clasificado",
      });
      expect(originOther).toBe("Otro");
    });
  });

  describe("3. Formateo de Fecha (D/M/AAAA HH:mm)", () => {
    it("debe formatear correctamente una fecha ISO a D/M/AAAA HH:mm", () => {
      // 2026-11-02T15:30:00
      const date = new Date(2026, 10, 2, 15, 30); // Mes 10 es noviembre (0-indexed)
      const formatted = formatMovementDate(date.toISOString());
      expect(formatted).toBe("2/11/2026 15:30");
    });

    it("debe manejar fechas inválidas o nulas sin lanzar error", () => {
      expect(formatMovementDate("")).toBe("—");
      expect(formatMovementDate("fecha-invalida")).toBe("fecha-invalida");
    });
  });

  describe("4. Cumplimiento de Reglas Globales (Sin alertas nativas)", () => {
    it("no debe contener window.alert, window.confirm, window.prompt o Alert.alert", () => {
      const filePath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/inventario/inventory-history-tab.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).not.toMatch(/\bwindow\.alert\b/);
      expect(content).not.toMatch(/\bwindow\.confirm\b/);
      expect(content).not.toMatch(/\bwindow\.prompt\b/);
      expect(content).not.toMatch(/\bAlert\.alert\b/);
    });
  });

  describe("5. Columnas Requeridas en la Tabla de Kardex", () => {
    it("debe incluir todas las columnas solicitadas en el archivo inventory-history-tab.tsx", () => {
      const filePath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/inventario/inventory-history-tab.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      // Columnas solicitadas:
      // 1. Fecha (D/M/AAAA HH:mm)
      expect(content).toContain("Fecha");
      // 2. Producto (Nombre)
      expect(content).toContain("Producto");
      // 3. Tipo (Badge Entrada en verde / Salida en rojo)
      expect(content).toContain("Tipo");
      expect(content).toContain("Entrada");
      expect(content).toContain("Salida");
      // 4. Origen (Badge POS, Mesa, Domicilio, Devolución, Otro)
      expect(content).toContain("Origen");
      // 5. Cantidad (Unidades afectadas)
      expect(content).toContain("Cantidad");
      // 6. Costo Unit.
      expect(content).toContain("Costo Unit.");
      // 7. Total (Cantidad x Costo unitario)
      expect(content).toContain("Total");
      // 8. Notas
      expect(content).toContain("Notas");
    });
  });
});
