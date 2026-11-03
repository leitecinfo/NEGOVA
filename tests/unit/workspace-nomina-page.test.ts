import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  createEmployee,
  createEmployeeNovelty,
  createPayrollPeriod,
  getPayrollPeriodsList,
  getPayrollPeriodDetail,
  registerPayrollReceiptPayment,
  cancelPayrollReceipt,
} from "@/lib/payroll/payroll-service";

describe("[EMP-001] Conectar página de nómina con UI existente", () => {
  const businessAId = "biz-emp001-alpha";
  const businessBId = "biz-emp001-beta";
  const ownerAId = "owner-emp001-a";
  const ownerBId = "owner-emp001-b";

  describe("Criterio de aceptación 1: La ruta /workspace/[businessId]/nomina carga la UI de nómina sin redirect", () => {
    it("el archivo nomina/page.tsx no debe contener redirect a placeholder", () => {
      const pagePath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/nomina/page.tsx"
      );
      expect(fs.existsSync(pagePath)).toBe(true);

      const content = fs.readFileSync(pagePath, "utf8");
      // No debe redirigir a /modulo/nomina
      expect(content).not.toMatch(/redirect\s*\(\s*`?\/workspace\/[^/]+\/modulo\/nomina/);
      expect(content).not.toMatch(/redirect\s*\(/);

      // Debe importar y montar WorkspaceNominaClient
      expect(content).toContain("WorkspaceNominaClient");
      expect(content).toContain("AppPageContainer");
      expect(content).toContain("payroll.view");
    });

    it("el archivo workspace-nomina-client.tsx no debe invocar alertas nativas", () => {
      const clientPath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/nomina/workspace-nomina-client.tsx"
      );
      expect(fs.existsSync(clientPath)).toBe(true);

      const content = fs.readFileSync(clientPath, "utf8");
      expect(content).not.toMatch(/window\.alert\s*\(/);
      expect(content).not.toMatch(/window\.confirm\s*\(/);
      expect(content).not.toMatch(/window\.prompt\s*\(/);
      expect(content).toContain("ConfirmModal");
    });

    it("el catálogo de navegación debe registrar 'nomina' como módulo implementado con ruta directa", () => {
      const navConfigPath = path.join(
        process.cwd(),
        "src/config/workspace-navigation.ts"
      );
      const content = fs.readFileSync(navConfigPath, "utf8");

      expect(content).toMatch(/id:\s*"nomina"[\s\S]*?href:\s*"nomina"[\s\S]*?status:\s*"implemented"/);
    });
  });

  describe("Criterio de aceptación 2: Se puede crear un período de nómina", () => {
    it("debe crear un período de nómina quincenal calculando salarios de trabajadores activos", async () => {
      // 1. Crear colaborador en Negocio A
      const empRes = await createEmployee(
        {
          firstName: "Esteban",
          lastName: "Ramírez",
          documentType: "CC",
          documentNumber: "1020304050",
          jobTitle: "Jefe de Cocina",
          baseSalary: 2400000,
          payFrequency: "biweekly",
          paymentMethod: "bank_transfer",
        },
        ownerAId,
        { businessId: businessAId }
      );
      expect(empRes.success).toBe(true);

      // 2. Crear período de nómina
      const periodRes = await createPayrollPeriod(
        {
          name: "1ra Quincena Noviembre 2026",
          periodType: "biweekly",
          startDate: "2026-11-01",
          endDate: "2026-11-15",
          notes: "Liquidación quincenal regular",
        },
        ownerAId,
        { businessId: businessAId }
      );

      expect(periodRes.success).toBe(true);
      expect(periodRes.period).toBeDefined();
      expect(periodRes.period?.name).toBe("1ra Quincena Noviembre 2026");
      expect(periodRes.period?.periodType).toBe("biweekly");
      expect(periodRes.period?.status).toBe("calculated");
      expect(periodRes.period?.totalBase).toBeGreaterThanOrEqual(1200000); // mitad de 2.400.000
    });

    it("debe listar los períodos creados para el negocio", async () => {
      const periods = await getPayrollPeriodsList({ businessId: businessAId });
      expect(periods.length).toBeGreaterThan(0);
      expect(periods[0].businessId).toBe(businessAId);
    });
  });

  describe("Criterio de aceptación 3: Se puede ver la liquidación de un empleado", () => {
    it("debe consultar el detalle del período y liquidación del colaborador con desglose de haberes y deducciones", async () => {
      // 1. Crear colaborador con novedades
      const empRes = await createEmployee(
        {
          firstName: "Lucía",
          lastName: "Mendoza",
          documentType: "CC",
          documentNumber: "9876543210",
          jobTitle: "Bartender",
          baseSalary: 1800000,
          payFrequency: "biweekly",
        },
        ownerAId,
        { businessId: businessAId }
      );
      const empId = empRes.employee!.id;

      // Bono por propinas/desempeño de $150.000
      await createEmployeeNovelty(
        {
          employeeId: empId,
          noveltyType: "bonus",
          description: "Bono barra fin de semana",
          startDate: "2026-11-05",
          amount: 150000,
        },
        ownerAId,
        { businessId: businessAId }
      );

      // Deducción o anticipo de $70.000
      await createEmployeeNovelty(
        {
          employeeId: empId,
          noveltyType: "advance",
          description: "Préstamo de turno",
          startDate: "2026-11-10",
          amount: 70000,
        },
        ownerAId,
        { businessId: businessAId }
      );

      // 2. Liquidar período
      const periodRes = await createPayrollPeriod(
        {
          name: "Detalle Liquidación Bartender",
          periodType: "biweekly",
          startDate: "2026-11-01",
          endDate: "2026-11-15",
        },
        ownerAId,
        { businessId: businessAId }
      );

      // 3. Consultar detalle del período
      const detail = await getPayrollPeriodDetail(periodRes.period!.id, { businessId: businessAId });
      expect(detail).toBeDefined();

      const receipt = detail?.receipts?.find((r) => r.employeeId === empId);
      expect(receipt).toBeDefined();
      expect(receipt?.employeeName).toBe("Lucía Mendoza");
      expect(receipt?.jobTitle).toBe("Bartender");
      expect(receipt?.baseSalary).toBe(900000); // 1.800.000 / 2
      expect(receipt?.bonusesAmount).toBe(150000);
      expect(receipt?.advancesAmount).toBe(70000);
      expect(receipt?.netAmount).toBe(980000); // 900.000 + 150.000 - 70.000
      expect(receipt?.status).toBe("pending");
    });

    it("debe registrar el pago de un comprobante y permitir anulación con auditoría", async () => {
      // 1. Obtener período
      const periods = await getPayrollPeriodsList({ businessId: businessAId });
      const periodDetail = await getPayrollPeriodDetail(periods[0].id, { businessId: businessAId });
      const pendingReceipt = periodDetail?.receipts?.find((r) => r.status === "pending");

      if (pendingReceipt) {
        // 2. Registrar pago
        const payRes = await registerPayrollReceiptPayment(
          {
            receiptId: pendingReceipt.id,
            paymentMethod: "bank_transfer",
            paymentReference: "TRANSF-TEST-883",
          },
          ownerAId,
          { businessId: businessAId }
        );

        expect(payRes.success).toBe(true);

        // 3. Verificar estado pagado
        const updatedDetail = await getPayrollPeriodDetail(periods[0].id, { businessId: businessAId });
        const paidReceipt = updatedDetail?.receipts?.find((r) => r.id === pendingReceipt.id);
        expect(paidReceipt?.status).toBe("paid");
        expect(paidReceipt?.paymentMethod).toBe("bank_transfer");

        // 4. Anular comprobante
        const cancelRes = await cancelPayrollReceipt(pendingReceipt.id, ownerAId, { businessId: businessAId });
        expect(cancelRes.success).toBe(true);

        const cancelledDetail = await getPayrollPeriodDetail(periods[0].id, { businessId: businessAId });
        const cancelledReceipt = cancelledDetail?.receipts?.find((r) => r.id === pendingReceipt.id);
        expect(cancelledReceipt?.status).toBe("cancelled");
      }
    });
  });

  describe("Aislamiento Multi-Tenant", () => {
    it("el Negocio B no puede ver los períodos ni liquidaciones del Negocio A", async () => {
      const periodsBizB = await getPayrollPeriodsList({ businessId: businessBId });
      const hasBizAPeriod = periodsBizB.some((p) => p.businessId === businessAId);
      expect(hasBizAPeriod).toBe(false);
    });
  });
});

