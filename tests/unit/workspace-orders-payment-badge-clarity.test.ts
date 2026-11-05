import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("[PEDIDOS-UX] Claridad y Espaciado de Estado de Pago y Botón Confirmar Pago", () => {
  const ordersListPath = path.resolve(
    __dirname,
    "../../src/app/workspace/[businessId]/pedidos/orders-list-client.tsx"
  );

  it("debe existir el archivo orders-list-client.tsx", () => {
    expect(fs.existsSync(ordersListPath)).toBe(true);
  });

  it("getPaymentStatusBadge debe retornar 'Pago pendiente' explícito en lugar del ambiguo 'Pendiente'", () => {
    const content = fs.readFileSync(ordersListPath, "utf-8");
    // El label para pending debe ser 'Pago pendiente'
    expect(content).toContain('label: "Pago pendiente"');
    // Para partial debe ser 'Pago parcial'
    expect(content).toContain('label: "Pago parcial"');
    // Para paid debe ser 'Pagado'
    expect(content).toContain('label: "Pagado"');
  });

  it("la tarjeta no debe amontonar Confirmar Pago y el badge en la misma fila estrecha del total", () => {
    const content = fs.readFileSync(ordersListPath, "utf-8");
    // La sección 4 debe tener espacio vertical separado
    expect(content).toContain('space-y-2');
    expect(content).toContain('w-full py-1.5 px-3 rounded-xl border border-emerald-500/30');
    expect(content).toContain('<span>Confirmar pago</span>');
  });

  it("no debe utilizar alertas nativas", () => {
    const content = fs.readFileSync(ordersListPath, "utf-8");
    expect(content).not.toContain("window.alert");
    expect(content).not.toContain("window.confirm");
  });
});
