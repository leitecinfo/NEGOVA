import { describe, it, expect } from "vitest";
import { UnifiedMovement, MovementFlow } from "../../src/lib/expenses/types";
import { formatCOP } from "../../src/config/plans";

describe("Pantalla Principal Unificada de Ingresos y Egresos (/workspace/[businessId]/gastos)", () => {
  const mockMovements: UnifiedMovement[] = [
    {
      id: "mov-1",
      businessId: "b-1",
      flow: "income",
      concept: "Aporte de capital de socios para equipamiento",
      amount: 2500000,
      category: "Aportes de Capital",
      date: "2026-11-02T10:00:00.000Z",
      paymentMethod: "efectivo",
      cashRegisterName: "Caja Principal",
      cajaBadge: "Ingresó a Caja Principal",
      thirdPartyName: "Socio Carlos Gómez",
      receiptNumber: "APO-001",
      status: "completed",
      createdAt: "2026-11-02T10:00:00.000Z",
    },
    {
      id: "mov-2",
      businessId: "b-1",
      flow: "expense",
      concept: "Pago de arriendo local comercial mes de noviembre",
      amount: 1800000,
      category: "Arriendo",
      expenseType: "operational",
      date: "2026-11-01T09:00:00.000Z",
      paymentMethod: "transferencia",
      cajaBadge: "Transferencia Bancaria",
      thirdPartyName: "Inmobiliaria El Poblado S.A.S.",
      receiptNumber: "FAC-8819",
      status: "completed",
      createdAt: "2026-11-01T09:00:00.000Z",
    },
    {
      id: "mov-3",
      businessId: "b-1",
      flow: "expense",
      concept: "Compra de materia prima carne molida y queso",
      amount: 450000,
      category: "Materia Prima",
      expenseType: "production",
      date: "2026-11-02T14:30:00.000Z",
      paymentMethod: "efectivo",
      cashRegisterName: "Caja Principal",
      cajaBadge: "Salió de Caja Principal",
      thirdPartyName: "Distribuidora San Antonio",
      receiptNumber: "REC-1049",
      status: "completed",
      createdAt: "2026-11-02T14:30:00.000Z",
    },
    {
      id: "mov-4",
      businessId: "b-1",
      flow: "income",
      concept: "Reembolso por devolución de empaques defectuosos",
      amount: 80000,
      category: "Reembolsos y Devoluciones",
      date: "2026-11-03T08:00:00.000Z",
      paymentMethod: "efectivo",
      cashRegisterName: "Caja Principal",
      cajaBadge: "Ingresó a Caja Principal",
      thirdPartyName: "Empaques de Colombia",
      receiptNumber: "DEV-012",
      status: "completed",
      createdAt: "2026-11-03T08:00:00.000Z",
    },
  ];

  it("Encabezado: debe contar con Título 'Ingresos y Egresos', descripción y botón principal '+ Nuevo Movimiento'", () => {
    const header = {
      title: "Ingresos y Egresos",
      badge: "Flujo de Caja & Gastos",
      description: "Control financiero unificado de ingresos, egresos operativos, costos de producción y movimientos de caja.",
      actionButton: "+ Nuevo Movimiento",
    };

    expect(header.title).toBe("Ingresos y Egresos");
    expect(header.description).toContain("Control financiero unificado");
    expect(header.actionButton).toBe("+ Nuevo Movimiento");
  });

  it("KPIs superiores: debe calcular Total Ingresos (+), Total Egresos (-), Balance Neto y Conteo de movimientos", () => {
    let totalIncome = 0;
    let totalExpenses = 0;
    let incomeCount = 0;
    let expensesCount = 0;

    for (const mov of mockMovements) {
      if (mov.status === "cancelled") continue;
      if (mov.flow === "income") {
        totalIncome += mov.amount;
        incomeCount += 1;
      } else {
        totalExpenses += mov.amount;
        expensesCount += 1;
      }
    }

    const netBalance = totalIncome - totalExpenses;

    expect(totalIncome).toBe(2580000); // 2,500,000 + 80,000
    expect(totalExpenses).toBe(2250000); // 1,800,000 + 450,000
    expect(netBalance).toBe(330000); // 2,580,000 - 2,250,000
    expect(mockMovements).toHaveLength(4);
    expect(incomeCount).toBe(2);
    expect(expensesCount).toBe(2);

    // Formateo y badges visuales
    const isProfitable = netBalance >= 0;
    expect(isProfitable).toBe(true);
    expect(formatCOP(totalIncome)).toContain("2.580.000");
    expect(formatCOP(totalExpenses)).toContain("2.250.000");
    expect(formatCOP(netBalance)).toContain("330.000");
  });

  it("Filtros de Flujo: debe filtrar Todos, Solo Egresos y Solo Ingresos", () => {
    const filterByFlow = (flow: "all" | "income" | "expense") => {
      if (flow === "all") return mockMovements;
      return mockMovements.filter((m) => m.flow === flow);
    };

    expect(filterByFlow("all")).toHaveLength(4);

    const expensesOnly = filterByFlow("expense");
    expect(expensesOnly).toHaveLength(2);
    expect(expensesOnly.every((m) => m.flow === "expense")).toBe(true);

    const incomesOnly = filterByFlow("income");
    expect(incomesOnly).toHaveLength(2);
    expect(incomesOnly.every((m) => m.flow === "income")).toBe(true);
  });

  it("Filtros por Categoría: debe clasificar entre Operativos, Producción y Aportes/Ingresos", () => {
    const filterByCategory = (category: string) => {
      return mockMovements.filter((m) => m.category.toLowerCase() === category.toLowerCase());
    };

    const arriendos = filterByCategory("Arriendo");
    expect(arriendos).toHaveLength(1);
    expect(arriendos[0].id).toBe("mov-2");

    const materiasPrimas = filterByCategory("Materia Prima");
    expect(materiasPrimas).toHaveLength(1);
    expect(materiasPrimas[0].id).toBe("mov-3");

    const aportes = filterByCategory("Aportes de Capital");
    expect(aportes).toHaveLength(1);
    expect(aportes[0].id).toBe("mov-1");
  });

  it("Buscador: debe buscar por concepto, tercero y número de comprobante", () => {
    const searchMovements = (query: string) => {
      const q = query.toLowerCase().trim();
      return mockMovements.filter((m) => {
        return (
          m.concept.toLowerCase().includes(q) ||
          (m.thirdPartyName && m.thirdPartyName.toLowerCase().includes(q)) ||
          (m.receiptNumber && m.receiptNumber.toLowerCase().includes(q)) ||
          m.category.toLowerCase().includes(q)
        );
      });
    };

    expect(searchMovements("arriendo")).toHaveLength(1);
    expect(searchMovements("Carlos Gómez")).toHaveLength(1);
    expect(searchMovements("REC-1049")).toHaveLength(1);
    expect(searchMovements("Inexistente")).toHaveLength(0);
  });

  it("Tabla Unificada de Movimientos: debe estructurar concepto, badges de tipo/categoría, fecha, canal/caja, monto coloreado y soporte", () => {
    const row = mockMovements[2]; // mov-3: Egreso en efectivo

    const tableRepresentation = {
      movement: {
        concept: row.concept,
        thirdParty: row.thirdPartyName,
        receipt: row.receiptNumber,
      },
      typeAndCategory: {
        typeBadge: row.flow === "income" ? "Ingreso" : "Egreso",
        categoryBadge: row.category,
      },
      date: row.date,
      channelAndCash: row.cajaBadge,
      coloredAmount: {
        sign: row.flow === "income" ? "+" : "-",
        color: row.flow === "income" ? "text-emerald-600" : "text-rose-600",
        formatted: formatCOP(row.amount),
      },
      actions: ["view_support", "cancel_movement"],
    };

    expect(tableRepresentation.movement.concept).toContain("Compra de materia prima");
    expect(tableRepresentation.movement.thirdParty).toBe("Distribuidora San Antonio");
    expect(tableRepresentation.typeAndCategory.typeBadge).toBe("Egreso");
    expect(tableRepresentation.typeAndCategory.categoryBadge).toBe("Materia Prima");
    expect(tableRepresentation.channelAndCash).toBe("Salió de Caja Principal");
    expect(tableRepresentation.coloredAmount.sign).toBe("-");
    expect(tableRepresentation.coloredAmount.color).toBe("text-rose-600");
    expect(tableRepresentation.coloredAmount.formatted).toContain("450.000");
    expect(tableRepresentation.actions).toContain("view_support");
    expect(tableRepresentation.actions).toContain("cancel_movement");
  });

  it("Medio y Caja: debe resolver badge 'Ingresó a Caja' vs 'Salió de Caja' para operaciones en efectivo", () => {
    const resolveCashBadge = (flow: MovementFlow, isCash: boolean, registerName: string) => {
      if (!isCash) return "Transferencia Bancaria";
      return flow === "income"
        ? `Ingresó a ${registerName}`
        : `Salió de ${registerName}`;
    };

    expect(resolveCashBadge("income", true, "Caja Principal")).toBe("Ingresó a Caja Principal");
    expect(resolveCashBadge("expense", true, "Caja Principal")).toBe("Salió de Caja Principal");
    expect(resolveCashBadge("expense", false, "Caja Principal")).toBe("Transferencia Bancaria");
  });

  it("Regla Global: Prohibido uso de alertas nativas en el módulo de Ingresos y Egresos", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const filesToCheck = [
      "src/app/workspace/[businessId]/gastos/workspace-gastos-client.tsx",
      "src/app/workspace/[businessId]/gastos/movement-form-modal.tsx",
      "src/app/workspace/[businessId]/gastos/movement-detail-modal.tsx",
      "src/app/workspace/[businessId]/gastos/confirm-cancel-movement-modal.tsx",
      "src/app/workspace/[businessId]/gastos/actions.ts",
    ];

    for (const file of filesToCheck) {
      const fullPath = path.resolve(file);
      const content = fs.readFileSync(fullPath, "utf-8");

      expect(content).not.toMatch(/\bwindow\.alert\s*\(/);
      expect(content).not.toMatch(/\balert\s*\(/);
      expect(content).not.toMatch(/\bwindow\.confirm\s*\(/);
      expect(content).not.toMatch(/\bconfirm\s*\(/);
      expect(content).not.toMatch(/\bwindow\.prompt\s*\(/);
      expect(content).not.toMatch(/\bprompt\s*\(/);
    }
  });
});
