import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("CAJA-002: Modales de Caja: 'Nueva Caja' y 'Movimiento de Caja'", () => {
  const newRegisterModalPath = path.resolve(
    process.cwd(),
    "src/components/cash/create-cash-register-modal.tsx"
  );
  const movementModalPath = path.resolve(
    process.cwd(),
    "src/components/cash/cash-movement-modal.tsx"
  );
  const clientCajaPath = path.resolve(
    process.cwd(),
    "src/components/cash/workspace-caja-client.tsx"
  );

  const newRegisterContent = fs.readFileSync(newRegisterModalPath, "utf-8");
  const movementContent = fs.readFileSync(movementModalPath, "utf-8");
  const clientCajaContent = fs.readFileSync(clientCajaPath, "utf-8");

  describe("1. Modal 'Nueva Caja' (Especificaciones y Campos)", () => {
    it("debe contener el título y descripción exactos", () => {
      expect(newRegisterContent).toContain("Nueva caja");
      expect(newRegisterContent).toContain(
        "Configura el cajón que llevará sus propios turnos, ventas y movimientos."
      );
    });

    it("debe contener el campo obligatorio 'Nombre de la caja (*)'", () => {
      expect(newRegisterContent).toContain("Nombre de la caja");
      expect(newRegisterContent).toContain('text-rose-500">*</span>');
      expect(newRegisterContent).toContain("register-name-input");
    });

    it("debe contener el campo 'Punto físico (opcional)' con icono de ubicación MapPin", () => {
      expect(newRegisterContent).toContain("Punto físico (opcional)");
      expect(newRegisterContent).toContain("<MapPin");
      expect(newRegisterContent).toContain("register-physical-point-input");
    });

    it("debe contener 'Base sugerida para abrir ($ COP)' con texto de ayuda explicativo", () => {
      expect(newRegisterContent).toContain("Base sugerida para abrir ($ COP)");
      expect(newRegisterContent).toContain("$ COP");
      expect(newRegisterContent).toContain(
        "Monto de efectivo recomendado con el que habitualmente se inicia el turno en esta caja para dar cambio."
      );
    });

    it("debe incluir las acciones requeridas: Cancelar y 'Crear caja ->'", () => {
      expect(newRegisterContent).toContain("Cancelar");
      expect(newRegisterContent).toMatch(/Crear caja\s*->/);
    });
  });

  describe("2. Modal 'Movimiento de Caja' (Especificaciones y Flujo)", () => {
    it("debe contener el título y descripción exactos", () => {
      expect(movementContent).toContain("Movimiento de caja");
      expect(movementContent).toContain(
        "Entradas o salidas de efectivo que no son ventas: fondo, retiros, pagos menores..."
      );
    });

    it("debe tener el Selector Toggle de Tipo: ↑ Entrada (verde) y ↓ Salida (rojo)", () => {
      expect(movementContent).toContain("↑ Entrada");
      expect(movementContent).toContain("↓ Salida");
      // Clases o variantes para verde y rojo
      expect(movementContent).toContain("emerald");
      expect(movementContent).toContain("rose");
    });

    it("debe incluir selector de Caja (*) con visualización de saldo en tiempo real", () => {
      expect(movementContent).toContain("Caja");
      expect(movementContent).toContain("Saldo en cajón en tiempo real:");
      expect(movementContent).toContain("currentCashInDrawer");
      expect(movementContent).toContain("formatCOP(currentCashInDrawer)");
    });

    it("debe incluir campo Monto (*) monetario con validación de fondos en retiros", () => {
      expect(movementContent).toContain("Monto");
      expect(movementContent).toContain("cash-movement-amount");
      expect(movementContent).toContain("isWithdrawalExceeding");
      expect(movementContent).toContain(
        "El monto a retirar no puede superar el efectivo disponible en cajón."
      );
    });

    it("debe incluir los tags de concepto rápido para Entradas", () => {
      expect(movementContent).toContain("Fondo de caja");
      expect(movementContent).toContain("Refuerzo de caja");
      expect(movementContent).toContain("Ingreso extra");
    });

    it("debe incluir los tags de concepto rápido para Salidas", () => {
      expect(movementContent).toContain("Retiro para depósito");
      expect(movementContent).toContain("Gastos menores");
      expect(movementContent).toContain("Pago a proveedor");
      expect(movementContent).toContain("Pago de servicio");
    });

    it("debe tener área de texto libre opcional para Motivo / Detalle", () => {
      expect(movementContent).toContain("Motivo / Detalle");
      expect(movementContent).toContain("movement-notes");
    });

    it("debe renderizar botones de confirmación: Cancelar y 'Registrar entrada' / 'Registrar salida'", () => {
      expect(movementContent).toContain("Cancelar");
      expect(movementContent).toContain("Registrar entrada");
      expect(movementContent).toContain("Registrar salida");
    });
  });

  describe("3. Criterios de Aceptación: Reactividad y Sin Alertas Nativas", () => {
    it("debe actualizar el efectivo en caja al instante en la interfaz al registrar movimiento", () => {
      expect(clientCajaContent).toContain("onSuccess={(updatedExpectedCash, registerId)");
      expect(clientCajaContent).toContain("expectedCashInDrawer: updatedExpectedCash");
      expect(clientCajaContent).toContain("totalCashInDrawers: newTotalCash");
    });

    it("no debe contener alertas nativas (window.alert, window.confirm, window.prompt) en modales ni cliente", () => {
      const filesToCheck = [newRegisterContent, movementContent, clientCajaContent];
      for (const content of filesToCheck) {
        expect(content).not.toMatch(/window\.alert\s*\(/);
        expect(content).not.toMatch(/window\.confirm\s*\(/);
        expect(content).not.toMatch(/window\.prompt\s*\(/);
        expect(content).not.toMatch(/(?<![a-zA-Z0-9_])alert\s*\(/);
      }
    });

    it("debe usar sonner toast para las notificaciones de éxito o validación", () => {
      expect(newRegisterContent).toContain('import { toast } from "sonner"');
      expect(movementContent).toContain('import { toast } from "sonner"');
      expect(newRegisterContent).toContain("toast.success(");
      expect(movementContent).toContain("toast.success(");
    });
  });
});

