import { describe, it, expect } from "vitest";
import { parseOrderProposedPayment } from "@/components/payments/order-payment-modal";

describe("parseOrderProposedPayment", () => {
  it("debe retornar objeto vacío si no hay notas", () => {
    expect(parseOrderProposedPayment(null)).toEqual({});
    expect(parseOrderProposedPayment(undefined)).toEqual({});
    expect(parseOrderProposedPayment("")).toEqual({});
  });

  it("debe detectar método propuesto Nequi con pin", () => {
    const notes = "Método de pago propuesto: Nequi [PIN:2733:0]";
    const res = parseOrderProposedPayment(notes);
    expect(res.proposedMethodLabel).toBe("Nequi");
    expect(res.proposedMethodCode).toBe("nequi");
  });

  it("debe detectar DaviPlata", () => {
    const notes = "Sin cebolla | Método de pago propuesto: DaviPlata";
    const res = parseOrderProposedPayment(notes);
    expect(res.proposedMethodLabel).toBe("DaviPlata");
    expect(res.proposedMethodCode).toBe("daviplata");
  });

  it("debe detectar Bre-B y código", () => {
    const notes = "Método de pago propuesto: Bre-B";
    const res = parseOrderProposedPayment(notes);
    expect(res.proposedMethodLabel).toBe("Bre-B");
    expect(res.proposedMethodCode).toBe("bre_b");
  });

  it("debe detectar Efectivo y calcular monto de pago", () => {
    const notes = "Método de pago propuesto: Efectivo | Paga en efectivo con: $50.000";
    const res = parseOrderProposedPayment(notes);
    expect(res.proposedMethodLabel).toBe("Efectivo");
    expect(res.proposedMethodCode).toBe("cash");
    expect(res.cashAmount).toBe(50000);
  });
});
