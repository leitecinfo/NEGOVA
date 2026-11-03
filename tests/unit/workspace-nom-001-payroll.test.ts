import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  createEmployee,
  createEmployeeNovelty,
  createPayrollPeriod,
  getPayrollPeriodDetail,
  approvePayrollPeriod,
  registerPayrollReceiptPayment,
  cancelPayrollReceipt,
  getMemoryPayrollExpenses,
} from "@/lib/payroll/payroll-service";
import { approveWorkspacePayrollPeriodAction } from "@/app/workspace/[businessId]/personal/actions";

describe("[NOM-001] Completar módulo de nómina y hacerlo accesible", () => {
  const businessId = "biz-nom001-test";
  const actorUserId = "user-nom001-owner";

  it("1. Se puede crear un período quincenal, calcular las liquidaciones y aprobarlas", async () => {
    // 1. Crear colaboradores
    const emp1 = await createEmployee(
      {
        firstName: "Carlos",
        lastName: "Gómez",
        documentType: "CC",
        documentNumber: "10102020",
        jobTitle: "Chef Ejecutivo",
        baseSalary: 3000000,
        payFrequency: "biweekly",
        paymentMethod: "bank_transfer",
      },
      actorUserId,
      { businessId }
    );
    expect(emp1.success).toBe(true);

    const emp2 = await createEmployee(
      {
        firstName: "Diana",
        lastName: "Torres",
        documentType: "CC",
        documentNumber: "20203030",
        jobTitle: "Jefa de Sala",
        baseSalary: 2000000,
        payFrequency: "biweekly",
        paymentMethod: "nequi",
      },
      actorUserId,
      { businessId }
    );
    expect(emp2.success).toBe(true);

    // 2. Registrar novedades (bono para Carlos, anticipo para Diana)
    await createEmployeeNovelty(
      {
        employeeId: emp1.employee!.id,
        noveltyType: "bonus",
        description: "Bono por metas del restaurante",
        startDate: "2026-11-05",
        amount: 250000,
      },
      actorUserId,
      { businessId }
    );

    await createEmployeeNovelty(
      {
        employeeId: emp2.employee!.id,
        noveltyType: "advance",
        description: "Anticipo primera quincena",
        startDate: "2026-11-08",
        amount: 100000,
      },
      actorUserId,
      { businessId }
    );

    // 3. Crear y liquidar período quincenal
    const createRes = await createPayrollPeriod(
      {
        name: "1ra Quincena Noviembre 2026 - NOM-001",
        periodType: "biweekly",
        startDate: "2026-11-01",
        endDate: "2026-11-15",
        notes: "Liquidación quincenal regular",
      },
      actorUserId,
      { businessId }
    );

    expect(createRes.success).toBe(true);
    expect(createRes.period).toBeDefined();
    expect(createRes.period?.status).toBe("calculated");
    expect(createRes.period?.receiptsCount).toBeGreaterThanOrEqual(2);

    const periodId = createRes.period!.id;

    // 4. Aprobar período liquidado
    const approveRes = await approvePayrollPeriod(periodId, actorUserId, { businessId });
    expect(approveRes.success).toBe(true);
    expect(approveRes.period?.status).toBe("approved");

    // Verificar detalle tras aprobación
    const periodDetail = await getPayrollPeriodDetail(periodId, { businessId });
    expect(periodDetail?.status).toBe("approved");
  });

  it("2. Los comprobantes de pago se generan correctamente con el desglose exacto de conceptos", async () => {
    const periodRes = await createPayrollPeriod(
      {
        name: "Comprobantes Test Quincena",
        periodType: "biweekly",
        startDate: "2026-11-01",
        endDate: "2026-11-15",
      },
      actorUserId,
      { businessId }
    );

    const periodDetail = await getPayrollPeriodDetail(periodRes.period!.id, { businessId });
    expect(periodDetail?.receipts).toBeDefined();
    expect(periodDetail!.receipts!.length).toBeGreaterThanOrEqual(2);

    // Validar comprobante con bonos
    const chefReceipt = periodDetail!.receipts!.find((r) => r.employeeName === "Carlos Gómez");
    expect(chefReceipt).toBeDefined();
    expect(chefReceipt?.baseSalary).toBe(1500000); // 3.000.000 / 2
    expect(chefReceipt?.bonusesAmount).toBe(250000);
    expect(chefReceipt?.netAmount).toBe(1750000); // 1.500.000 + 250.000
    expect(chefReceipt?.status).toBe("pending");

    // Validar comprobante con anticipos
    const dianaReceipt = periodDetail!.receipts!.find((r) => r.employeeName === "Diana Torres");
    expect(dianaReceipt).toBeDefined();
    expect(dianaReceipt?.baseSalary).toBe(1000000); // 2.000.000 / 2
    expect(dianaReceipt?.advancesAmount).toBe(100000);
    expect(dianaReceipt?.netAmount).toBe(900000); // 1.000.000 - 100.000
  });

  it("3. El pago de nómina registra un gasto tipo 'nómina' en el módulo de gastos", async () => {
    const createRes = await createPayrollPeriod(
      {
        name: "Gastos Test Quincena",
        periodType: "biweekly",
        startDate: "2026-11-01",
        endDate: "2026-11-15",
      },
      actorUserId,
      { businessId }
    );

    const periodId = createRes.period!.id;
    await approvePayrollPeriod(periodId, actorUserId, { businessId });

    const periodDetail = await getPayrollPeriodDetail(periodId, { businessId });
    const receiptToPay = periodDetail!.receipts![0];

    const payRes = await registerPayrollReceiptPayment(
      {
        receiptId: receiptToPay.id,
        paymentMethod: "bank_transfer",
        paymentReference: "TRANSF-NOM-001",
      },
      actorUserId,
      { businessId }
    );

    expect(payRes.success).toBe(true);
    expect(payRes.expenseId).toBeDefined();

    // Validar que el egreso registrado en gastos tenga categoría "Nómina y Honorarios" y tipo "operational"
    const expenses = getMemoryPayrollExpenses(businessId);
    const linkedExpense = expenses.find((e) => e.id === payRes.expenseId);

    expect(linkedExpense).toBeDefined();
    expect(linkedExpense?.category).toBe("Nómina y Honorarios");
    expect(linkedExpense?.expenseType).toBe("operational");
    expect(linkedExpense?.amount).toBe(receiptToPay.netAmount);
    expect(linkedExpense?.status).toBe("completed");
    expect(linkedExpense?.receiptNumber).toBe("TRANSF-NOM-001");
  });

  it("4. Transición automática: pagar todos los comprobantes actualiza el período a estado 'paid'", async () => {
    const createRes = await createPayrollPeriod(
      {
        name: "Cierre Total Quincena",
        periodType: "biweekly",
        startDate: "2026-11-01",
        endDate: "2026-11-15",
      },
      actorUserId,
      { businessId }
    );

    const periodId = createRes.period!.id;
    await approvePayrollPeriod(periodId, actorUserId, { businessId });

    const detailBefore = await getPayrollPeriodDetail(periodId, { businessId });
    for (const receipt of detailBefore!.receipts!) {
      if (receipt.status === "pending") {
        await registerPayrollReceiptPayment(
          {
            receiptId: receipt.id,
            paymentMethod: "bank_transfer",
          },
          actorUserId,
          { businessId }
        );
      }
    }

    const detailAfter = await getPayrollPeriodDetail(periodId, { businessId });
    expect(detailAfter?.status).toBe("paid");
  });

  it("5. Bloquea pagos duplicados accidentales para un comprobante ya pagado", async () => {
    const periodDetail = await getPayrollPeriodDetail(
      (await createPayrollPeriod(
        {
          name: "Prevención Duplicado",
          periodType: "biweekly",
          startDate: "2026-11-01",
          endDate: "2026-11-15",
        },
        actorUserId,
        { businessId }
      )).period!.id,
      { businessId }
    );

    const receipt = periodDetail!.receipts![0];

    // Pago 1
    const res1 = await registerPayrollReceiptPayment(
      {
        receiptId: receipt.id,
        paymentMethod: "cash",
      },
      actorUserId,
      { businessId }
    );
    expect(res1.success).toBe(true);

    // Pago 2 (mismo comprobante)
    const res2 = await registerPayrollReceiptPayment(
      {
        receiptId: receipt.id,
        paymentMethod: "cash",
      },
      actorUserId,
      { businessId }
    );
    expect(res2.success).toBe(false);
    expect(res2.error).toContain("ya ha sido pagado");
  });

  it("6. Anular un comprobante de nómina cancela el gasto en el módulo de egresos", async () => {
    const periodDetail = await getPayrollPeriodDetail(
      (await createPayrollPeriod(
        {
          name: "Anulación y Reversión Gasto",
          periodType: "biweekly",
          startDate: "2026-11-01",
          endDate: "2026-11-15",
        },
        actorUserId,
        { businessId }
      )).period!.id,
      { businessId }
    );

    const receipt = periodDetail!.receipts![0];

    const payRes = await registerPayrollReceiptPayment(
      {
        receiptId: receipt.id,
        paymentMethod: "bank_transfer",
      },
      actorUserId,
      { businessId }
    );

    expect(payRes.success).toBe(true);
    const expenseId = payRes.expenseId!;

    const cancelRes = await cancelPayrollReceipt(receipt.id, actorUserId, { businessId });
    expect(cancelRes.success).toBe(true);

    const expenses = getMemoryPayrollExpenses(businessId);
    const cancelledExp = expenses.find((e) => e.id === expenseId);
    expect(cancelledExp?.status).toBe("cancelled");
  });

  it("7. La interfaz de nómina (workspace-nomina-client.tsx) no contiene llamadas a alertas nativas", () => {
    const clientPath = path.join(
      process.cwd(),
      "src/app/workspace/[businessId]/nomina/workspace-nomina-client.tsx"
    );
    const content = fs.readFileSync(clientPath, "utf8");

    expect(content).not.toMatch(/window\.alert\s*\(/);
    expect(content).not.toMatch(/window\.confirm\s*\(/);
    expect(content).not.toMatch(/window\.prompt\s*\(/);
    expect(content).not.toMatch(/Alert\.alert\s*\(/);

    // Debe contener modales accesibles y badges de estado
    expect(content).toContain("ConfirmModal");
    expect(content).toContain("Aprobar Período");
    expect(content).toContain("approveWorkspacePayrollPeriodAction");
  });
});

