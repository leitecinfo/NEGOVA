import { describe, it, expect, beforeEach } from "vitest";
import {
  createEmployee,
  getEmployeesList,
  getEmployeeById,
  updateEmployee,
  createEmployeeNovelty,
  getEmployeeNovelties,
  createPayrollPeriod,
  getPayrollPeriodDetail,
  registerPayrollReceiptPayment,
  cancelPayrollReceipt,
} from "../../src/lib/payroll/payroll-service";

describe("NEGOVA — Módulo de Personal y Nómina Integrado", () => {
  const businessAId = "biz-restaurant-alpha";
  const businessBId = "biz-restaurant-beta";
  const ownerAId = "user-owner-a";
  const ownerBId = "user-owner-b";

  it("1. Un trabajador puede crearse y existir sin cuenta de usuario", async () => {
    const res = await createEmployee(
      {
        firstName: "María",
        lastName: "Pérez",
        documentType: "CC",
        documentNumber: "1098765432",
        jobTitle: "Cocinera Principal",
        baseSalary: 1600000,
        payFrequency: "biweekly",
        paymentMethod: "bank_transfer",
      },
      ownerAId,
      { businessId: businessAId }
    );

    expect(res.success).toBe(true);
    expect(res.employee).toBeDefined();
    expect(res.employee?.userId).toBeNull();
    expect(res.employee?.fullName).toBe("María Pérez");
    expect(res.employee?.baseSalary).toBe(1600000);
  });

  it("2. La vinculación de un trabajador con una cuenta de usuario actualiza la ficha sin duplicar", async () => {
    const created = await createEmployee(
      {
        firstName: "Andrés",
        lastName: "Suárez",
        documentType: "CC",
        documentNumber: "1122334455",
        jobTitle: "Mesero",
        baseSalary: 1400000,
      },
      ownerAId,
      { businessId: businessAId }
    );

    const empId = created.employee!.id;

    // Vincular cuenta de usuario
    const updated = await updateEmployee(
      empId,
      { userId: "auth-user-andres-99" },
      ownerAId,
      { businessId: businessAId }
    );

    expect(updated.success).toBe(true);
    expect(updated.employee?.userId).toBe("auth-user-andres-99");
    expect(updated.employee?.id).toBe(empId);

    // Listado sigue teniendo 1 solo registro para Andrés
    const list = await getEmployeesList({ businessId: businessAId }, { search: "Andrés" });
    expect(list.employees).toHaveLength(1);
  });

  it("3. Aislamiento Multi-Tenant: Negocio A no puede consultar ni modificar trabajadores de Negocio B", async () => {
    const empInB = await createEmployee(
      {
        firstName: "Carlos",
        lastName: "Montoya",
        documentType: "CC",
        documentNumber: "9988776655",
        jobTitle: "Parrillero",
        baseSalary: 1800000,
      },
      ownerBId,
      { businessId: businessBId }
    );

    // Negocio A intenta consultar el empleado del Negocio B
    const resultFromA = await getEmployeeById(empInB.employee!.id, { businessId: businessAId });
    expect(resultFromA).toBeNull();

    // Negocio A intenta editar el empleado del Negocio B
    const updateFromA = await updateEmployee(
      empInB.employee!.id,
      { baseSalary: 2500000 },
      ownerAId,
      { businessId: businessAId }
    );
    expect(updateFromA.success).toBe(false);
  });

  it("4. Empleados internos de NEGOVA (Plataforma) están separados de los comercios clientes", async () => {
    const platformEmp = await createEmployee(
      {
        firstName: "David",
        lastName: "García",
        documentType: "CC",
        documentNumber: "80123456",
        jobTitle: "Lead DevOps",
        baseSalary: 6000000,
      },
      "super-admin-01",
      { isPlatform: true }
    );

    expect(platformEmp.employee?.isPlatformEmployee).toBe(true);
    expect(platformEmp.employee?.businessId).toBeNull();

    // Negocio A no lo ve en su lista
    const bizList = await getEmployeesList({ businessId: businessAId });
    const foundInBiz = bizList.employees.some((e) => e.id === platformEmp.employee?.id);
    expect(foundInBiz).toBe(false);
  });

  it("5. Liquidación de nómina calcula correctamente el sueldo prorrateado y suma novedades", async () => {
    // 1. Crear trabajador con $1.600.000 mensual, liquidación quincenal (base = $800.000)
    const emp = await createEmployee(
      {
        firstName: "Laura",
        lastName: "Castro",
        documentType: "CC",
        documentNumber: "5544332211",
        jobTitle: "Supervisora de Barra",
        baseSalary: 1600000,
        payFrequency: "biweekly",
      },
      ownerAId,
      { businessId: businessAId }
    );

    // 2. Agregar bonificación de $100.000 y anticipo de $50.000
    await createEmployeeNovelty(
      {
        employeeId: emp.employee!.id,
        noveltyType: "bonus",
        description: "Bono cumplimiento",
        startDate: "2026-10-05",
        amount: 100000,
      },
      ownerAId,
      { businessId: businessAId }
    );

    await createEmployeeNovelty(
      {
        employeeId: emp.employee!.id,
        noveltyType: "advance",
        description: "Anticipo de quincena",
        startDate: "2026-10-10",
        amount: 50000,
      },
      ownerAId,
      { businessId: businessAId }
    );

    // 3. Liquidar nómina quincenal
    const periodRes = await createPayrollPeriod(
      {
        name: "1ra Quincena Octubre 2026",
        periodType: "biweekly",
        startDate: "2026-10-01",
        endDate: "2026-10-15",
      },
      ownerAId,
      { businessId: businessAId }
    );

    expect(periodRes.success).toBe(true);
    const periodDetail = await getPayrollPeriodDetail(periodRes.period!.id, { businessId: businessAId });
    const receipt = periodDetail?.receipts?.find((r) => r.employeeId === emp.employee!.id);

    expect(receipt).toBeDefined();
    expect(receipt?.baseSalary).toBe(800000);
    expect(receipt?.bonusesAmount).toBe(100000);
    expect(receipt?.advancesAmount).toBe(50000);
    expect(receipt?.netAmount).toBe(850000); // 800.000 + 100.000 - 50.000
  });

  it("6. Registro de pago vincula el egreso financiero y previene doble pago accidental", async () => {
    const periodRes = await createPayrollPeriod(
      {
        name: "Liquidación Test Pago",
        periodType: "biweekly",
        startDate: "2026-10-01",
        endDate: "2026-10-15",
      },
      ownerAId,
      { businessId: businessAId }
    );

    const periodDetail = await getPayrollPeriodDetail(periodRes.period!.id, { businessId: businessAId });
    const receipt = periodDetail!.receipts![0];

    // Registrar pago
    const payRes1 = await registerPayrollReceiptPayment(
      {
        receiptId: receipt.id,
        paymentMethod: "bank_transfer",
        paymentReference: "TRANSF-TEST-001",
      },
      ownerAId,
      { businessId: businessAId }
    );

    expect(payRes1.success).toBe(true);
    expect(payRes1.expenseId).toBeDefined();

    // Intentar pagar por segunda vez el mismo comprobante debe ser bloqueado
    const payRes2 = await registerPayrollReceiptPayment(
      {
        receiptId: receipt.id,
        paymentMethod: "bank_transfer",
      },
      ownerAId,
      { businessId: businessAId }
    );

    expect(payRes2.success).toBe(false);
    expect(payRes2.error).toContain("ya ha sido pagado");
  });

  it("7. Anulación de comprobante mantiene trazabilidad y cancela el gasto vinculado", async () => {
    const periodRes = await createPayrollPeriod(
      {
        name: "Liquidación Test Anulación",
        periodType: "biweekly",
        startDate: "2026-10-01",
        endDate: "2026-10-15",
      },
      ownerAId,
      { businessId: businessAId }
    );

    const periodDetail = await getPayrollPeriodDetail(periodRes.period!.id, { businessId: businessAId });
    const receipt = periodDetail!.receipts![0];

    await registerPayrollReceiptPayment(
      {
        receiptId: receipt.id,
        paymentMethod: "cash",
      },
      ownerAId,
      { businessId: businessAId }
    );

    // Anular
    const cancelRes = await cancelPayrollReceipt(receipt.id, ownerAId, { businessId: businessAId });
    expect(cancelRes.success).toBe(true);

    const updatedDetail = await getPayrollPeriodDetail(periodRes.period!.id, { businessId: businessAId });
    const updatedReceipt = updatedDetail?.receipts?.find((r) => r.id === receipt.id);
    expect(updatedReceipt?.status).toBe("cancelled");
  });
});
