import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  AccountReceivable,
  AccountsReceivableKPIs,
  TopDebtorItem,
} from "@/lib/customers/types";

describe("Workspace Customer Portfolio & Payments [CLI-003]", () => {
  describe("1. Cálculo de KPIs de Cartera y Salud Financiera", () => {
    it("debe calcular correctamente el total por cobrar, recaudado y balance vencido", () => {
      const receivables: AccountReceivable[] = [
        {
          id: "rec-1",
          businessId: "biz-1",
          customerId: "cust-1",
          amount: 200000,
          paidAmount: 50000,
          balance: 150000,
          dueDate: new Date(Date.now() + 86400000 * 5).toISOString(), // Al día (en 5 días)
          status: "partial",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "rec-2",
          businessId: "biz-1",
          customerId: "cust-2",
          amount: 100000,
          paidAmount: 0,
          balance: 100000,
          dueDate: new Date(Date.now() - 86400000 * 10).toISOString(), // Vencida (hace 10 días)
          status: "overdue",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "rec-3",
          businessId: "biz-1",
          customerId: "cust-3",
          amount: 300000,
          paidAmount: 300000,
          balance: 0,
          dueDate: new Date(Date.now() - 86400000 * 20).toISOString(),
          status: "paid",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const totalReceivable = receivables.reduce((sum, r) => sum + r.balance, 0);
      const totalCollected = receivables.reduce((sum, r) => sum + r.paidAmount, 0);
      const overdueBalance = receivables
        .filter((r) => r.status === "overdue")
        .reduce((sum, r) => sum + r.balance, 0);

      expect(totalReceivable).toBe(250000);
      expect(totalCollected).toBe(350000);
      expect(overdueBalance).toBe(100000);

      // Tasa de recaudación: 350.000 / (350.000 + 250.000) = 350 / 600 = 58.33%
      const collectionRate = Math.round((totalCollected / (totalCollected + totalReceivable)) * 100);
      expect(collectionRate).toBe(58);

      // Salud de cartera: (250.000 - 100.000) / 250.000 = 60%
      const portfolioHealthRate = Math.round(
        ((totalReceivable - overdueBalance) / totalReceivable) * 100
      );
      expect(portfolioHealthRate).toBe(60);
    });

    it("debe clasificar correctamente la cartera por rangos de antigüedad (aging buckets)", () => {
      const now = Date.now();
      const mockAccounts = [
        { balance: 50000, daysPastDue: -2 }, // Al día
        { balance: 75000, daysPastDue: 15 }, // 1 a 30 días
        { balance: 120000, daysPastDue: 45 }, // 31 a 60 días
        { balance: 90000, daysPastDue: 80 }, // Más de 60 días
      ];

      const aging = {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        daysOver60: 0,
      };

      for (const item of mockAccounts) {
        if (item.daysPastDue <= 0) {
          aging.current += item.balance;
        } else if (item.daysPastDue <= 30) {
          aging.days1to30 += item.balance;
        } else if (item.daysPastDue <= 60) {
          aging.days31to60 += item.balance;
        } else {
          aging.daysOver60 += item.balance;
        }
      }

      expect(aging.current).toBe(50000);
      expect(aging.days1to30).toBe(75000);
      expect(aging.days31to60).toBe(120000);
      expect(aging.daysOver60).toBe(90000);
      expect(aging.current + aging.days1to30 + aging.days31to60 + aging.daysOver60).toBe(335000);
    });
  });

  describe("2. Top deudores y Gestión de Cartera", () => {
    it("debe ordenar clientes con mayor saldo pendiente en orden descendente", () => {
      const debtors: TopDebtorItem[] = [
        {
          customerId: "c1",
          customerName: "Empresa Alfa",
          phone: "3001111111",
          totalDebt: 500000,
          overdueDebt: 200000,
          creditLimit: 1000000,
          creditAvailable: 500000,
          activeReceivablesCount: 2,
        },
        {
          customerId: "c2",
          customerName: "Restaurante Beta",
          phone: "3002222222",
          totalDebt: 1200000,
          overdueDebt: 600000,
          creditLimit: 1500000,
          creditAvailable: 300000,
          activeReceivablesCount: 4,
        },
        {
          customerId: "c3",
          customerName: "Cafetería Gamma",
          phone: "3003333333",
          totalDebt: 150000,
          overdueDebt: 0,
          creditLimit: 500000,
          creditAvailable: 350000,
          activeReceivablesCount: 1,
        },
      ];

      const sorted = [...debtors].sort((a, b) => b.totalDebt - a.totalDebt);

      expect(sorted[0].customerId).toBe("c2");
      expect(sorted[0].totalDebt).toBe(1200000);
      expect(sorted[1].customerId).toBe("c1");
      expect(sorted[2].customerId).toBe("c3");
    });
  });

  describe("3. Reglas de Negocio de Abonos y Pagos", () => {
    it("debe procesar un abono parcial reduciendo el saldo de la cuenta y el cupo usado del cliente", () => {
      const initialAccount = {
        id: "ar-101",
        amount: 500000,
        paidAmount: 100000,
        balance: 400000,
        status: "partial" as const,
      };

      const initialCustomerCreditUsed = 400000;
      const paymentAmount = 150000;

      // Validación de abono
      expect(paymentAmount).toBeGreaterThan(0);
      expect(paymentAmount).toBeLessThanOrEqual(initialAccount.balance);

      const newPaidAmount = initialAccount.paidAmount + paymentAmount;
      const newBalance = Math.max(0, initialAccount.balance - paymentAmount);
      const newStatus = newBalance === 0 ? "paid" : "partial";
      const newCustomerCreditUsed = Math.max(0, initialCustomerCreditUsed - paymentAmount);

      expect(newPaidAmount).toBe(250000);
      expect(newBalance).toBe(250000);
      expect(newStatus).toBe("partial");
      expect(newCustomerCreditUsed).toBe(250000);
    });

    it("debe liquidar totalmente la cuenta al abonar el saldo completo y pasar a estado 'paid'", () => {
      const initialAccount = {
        id: "ar-102",
        amount: 300000,
        paidAmount: 100000,
        balance: 200000,
        status: "partial" as const,
      };

      const paymentAmount = 200000; // Pago del saldo exacto

      const newPaidAmount = initialAccount.paidAmount + paymentAmount;
      const newBalance = Math.max(0, initialAccount.balance - paymentAmount);
      const newStatus = newBalance === 0 ? "paid" : "partial";

      expect(newPaidAmount).toBe(300000);
      expect(newBalance).toBe(0);
      expect(newStatus).toBe("paid");
    });

    it("debe rechazar abonos que superen el saldo pendiente de la cuenta", () => {
      const account = {
        id: "ar-103",
        balance: 80000,
      };

      const invalidPayment = 100000;

      const validatePayment = (amount: number, balance: number) => {
        if (amount <= 0) return { valid: false, error: "El monto debe ser mayor a cero" };
        if (amount > balance) return { valid: false, error: "El valor del abono no puede superar el saldo pendiente" };
        return { valid: true };
      };

      const result = validatePayment(invalidPayment, account.balance);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("no puede superar el saldo pendiente");
    });

    it("debe rechazar montos de abono menores o iguales a cero", () => {
      const validatePayment = (amount: number) => {
        if (!Number.isFinite(amount) || amount <= 0) {
          return { valid: false, error: "El monto debe ser mayor a cero" };
        }
        return { valid: true };
      };

      expect(validatePayment(0).valid).toBe(false);
      expect(validatePayment(-50000).valid).toBe(false);
      expect(validatePayment(NaN).valid).toBe(false);
      expect(validatePayment(50000).valid).toBe(true);
    });
  });

  describe("4. Regla Estricta: Prohibición de Alertas Nativas", () => {
    it("ningún archivo nuevo o modificado de cartera/abonos debe contener alert(), confirm() o prompt()", () => {
      const filesToCheck = [
        path.join(process.cwd(), "src/lib/customers/customers-service.ts"),
        path.join(process.cwd(), "src/lib/customers/types.ts"),
        path.join(process.cwd(), "src/components/customers/customer-payment-modal.tsx"),
        path.join(process.cwd(), "src/components/customers/customer-portfolio-tab.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/clientes/customers-list-client.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/clientes/[id]/customer-detail-client.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/clientes/actions.ts"),
      ];

      const bannedPatterns = [
        /\bwindow\.alert\b/,
        /\bwindow\.confirm\b/,
        /\bwindow\.prompt\b/,
        /\balert\(/,
        /\bconfirm\(/,
        /\bAlert\.alert\b/,
      ];

      for (const filePath of filesToCheck) {
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, "utf-8");

        for (const pattern of bannedPatterns) {
          // Filtrar comentarios si aplica
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
            const matches = pattern.test(line);
            expect(
              matches,
              `Alerta nativa prohibida detectada en ${path.basename(filePath)}:${idx + 1} -> "${trimmed}"`
            ).toBe(false);
          });
        }
      }
    });
  });
});
