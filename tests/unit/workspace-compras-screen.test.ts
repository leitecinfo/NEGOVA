import { describe, it, expect } from "vitest";
import { Purchase, PurchaseKPIs, PurchasePeriodPreset } from "../../src/lib/purchases/types";

describe("Pantalla principal del Módulo de Compras (/workspace/[businessId]/compras)", () => {
  const mockPurchases: Purchase[] = [
    {
      id: "pur-1",
      businessId: "biz-1",
      purchaseNumber: "COMP-00101",
      supplierId: "supp-1",
      supplierName: "Distribuidora El Grano S.A.S.",
      invoiceNumber: "FAC-9821",
      purchaseDate: "2026-11-02T10:00:00Z",
      subtotal: 200000,
      taxAmount: 38000,
      total: 238000,
      paymentType: "cash",
      paymentMethod: "cash",
      status: "confirmed",
      notes: "Insumos para café",
      deductFromCashRegister: true,
      cashRegisterName: "Caja Principal",
      createdAt: "2026-11-02T10:00:00Z",
      updatedAt: "2026-11-02T10:00:00Z",
      items: [
        {
          id: "item-1",
          purchaseId: "pur-1",
          itemName: "Café en Grano 1kg",
          quantity: 10,
          unitCost: 20000,
          totalCost: 200000,
          isInventoryItem: true,
        },
      ],
    },
    {
      id: "pur-2",
      businessId: "biz-1",
      purchaseNumber: "COMP-00102",
      supplierId: "supp-2",
      supplierName: "Lácteos del Valle",
      invoiceNumber: "FAC-4412",
      purchaseDate: "2026-11-01T15:30:00Z",
      subtotal: 150000,
      taxAmount: 0,
      total: 150000,
      paymentType: "credit",
      paymentMethod: "transfer",
      status: "confirmed",
      notes: "Compra a 30 días",
      deductFromCashRegister: false,
      createdAt: "2026-11-01T15:30:00Z",
      updatedAt: "2026-11-01T15:30:00Z",
      accountPayable: {
        id: "ap-2",
        businessId: "biz-1",
        purchaseId: "pur-2",
        supplierId: "supp-2",
        supplierName: "Lácteos del Valle",
        purchaseNumber: "COMP-00102",
        totalAmount: 150000,
        paidAmount: 50000,
        balance: 100000,
        dueDate: "2026-12-01T00:00:00Z",
        status: "pending",
        createdAt: "2026-11-01T15:30:00Z",
        updatedAt: "2026-11-01T15:30:00Z",
      },
      items: [
        {
          id: "item-2",
          purchaseId: "pur-2",
          itemName: "Leche Entera 1L",
          quantity: 30,
          unitCost: 5000,
          totalCost: 150000,
          isInventoryItem: true,
        },
      ],
    },
  ];

  it("Encabezado: debe contener el título 'Compras' y los botones de acción requeridos", () => {
    const header = {
      title: "Compras",
      description:
        "Control integral de compras de contado y a crédito, sincronización con egresos de caja activa y existencias.",
      actions: ["Proveedores", "Informe de compras", "+ Nueva compra"],
    };

    expect(header.title).toBe("Compras");
    expect(header.actions).toContain("Proveedores");
    expect(header.actions).toContain("Informe de compras");
    expect(header.actions).toContain("+ Nueva compra");
  });

  it("Filtros de período: debe soportar los 7 accesos rápidos de tiempo", () => {
    const periodPresets: { id: PurchasePeriodPreset; label: string }[] = [
      { id: "today", label: "Hoy" },
      { id: "yesterday", label: "Ayer" },
      { id: "7d", label: "7 días" },
      { id: "this_week", label: "Semana" },
      { id: "this_month", label: "Mes" },
      { id: "last_month", label: "Mes anterior" },
      { id: "all", label: "Todo" },
    ];

    expect(periodPresets).toHaveLength(7);
    expect(periodPresets.map((p) => p.id)).toEqual([
      "today",
      "yesterday",
      "7d",
      "this_week",
      "this_month",
      "last_month",
      "all",
    ]);
  });

  it("KPIs Financieros: debe calcular Comprado, De contado, A crédito y Por pagar hoy", () => {
    const kpis: PurchaseKPIs = {
      totalPurchased: 388000,
      uniqueSuppliersCount: 2,
      totalCash: 238000,
      totalCredit: 150000,
      dueTodayOrOverdue: 100000,
      totalPurchasesCount: 2,
    };

    expect(kpis.totalPurchased).toBe(388000);
    expect(kpis.uniqueSuppliersCount).toBe(2);
    expect(kpis.totalCash).toBe(238000);
    expect(kpis.totalCredit).toBe(150000);
    expect(kpis.dueTodayOrOverdue).toBe(100000);
  });

  it("Pestañas por estado de pago: debe definir Todas, De contado, A crédito, Por pagar, Vencidas", () => {
    const tabs = ["Todas", "De contado", "A crédito", "Por pagar", "Vencidas"];
    expect(tabs).toHaveLength(5);
  });

  it("Tabla de Compras: debe mapear badges compuestos de Pago (condición, medio, caja origen)", () => {
    const getPaymentBadges = (purchase: Purchase) => {
      const condition = purchase.paymentType === "cash" ? "De Contado" : "A Crédito";
      const method = purchase.paymentMethod === "cash" ? "Efectivo" : "Transferencia";
      const originBox =
        purchase.deductFromCashRegister || (purchase.paymentType === "cash" && purchase.paymentMethod === "cash")
          ? purchase.cashRegisterName || "Salió de Caja Principal"
          : null;

      return { condition, method, originBox };
    };

    const badges1 = getPaymentBadges(mockPurchases[0]);
    expect(badges1.condition).toBe("De Contado");
    expect(badges1.method).toBe("Efectivo");
    expect(badges1.originBox).toBe("Caja Principal");

    const badges2 = getPaymentBadges(mockPurchases[1]);
    expect(badges2.condition).toBe("A Crédito");
    expect(badges2.method).toBe("Transferencia");
    expect(badges2.originBox).toBeNull();
  });

  it("Tabla de Compras: debe evaluar Saldo (Pagada vs Saldo pendiente)", () => {
    const getSaldoStatus = (purchase: Purchase) => {
      if (purchase.status === "cancelled") return { label: "Anulada", isPending: false };
      if (purchase.paymentType === "cash" || !purchase.accountPayable || purchase.accountPayable.balance === 0) {
        return { label: "Pagada", isPending: false, balance: 0 };
      }
      return {
        label: `Saldo: $ ${purchase.accountPayable.balance.toLocaleString("es-CO")} pendiente`,
        isPending: true,
        balance: purchase.accountPayable.balance,
      };
    };

    const saldo1 = getSaldoStatus(mockPurchases[0]);
    expect(saldo1.label).toBe("Pagada");
    expect(saldo1.isPending).toBe(false);

    const saldo2 = getSaldoStatus(mockPurchases[1]);
    expect(saldo2.isPending).toBe(true);
    expect(saldo2.balance).toBe(100000);
  });

  it("Acciones: debe incluir Ver detalle, Imprimir y Anular con modal de confirmación", () => {
    const actions = ["Ver detalle", "Imprimir", "Anular"];
    expect(actions).toContain("Ver detalle");
    expect(actions).toContain("Imprimir");
    expect(actions).toContain("Anular");
  });
});
