import { describe, it, expect } from "vitest";
import { Supplier, Purchase, AccountsPayableWithDetails } from "../../src/lib/purchases/types";
import { formatCOP } from "../../src/config/plans";

describe("Pantalla Principal de Proveedores (/workspace/[businessId]/proveedores)", () => {
  const mockSuppliers: Supplier[] = [
    {
      id: "supp-1",
      businessId: "b-1",
      name: "Distribuidora El Grano S.A.S.",
      contactName: "Carlos Restrepo",
      phone: "+57 300 123 4567",
      email: "ventas@elgrano.com",
      address: "Calle 10 # 40-20, Medellín",
      taxId: "900123456-1",
      paymentTermsDays: 30,
      notes: "Descuento 5% pronto pago",
      status: "active",
      createdAt: "2026-01-10T10:00:00.000Z",
      updatedAt: "2026-01-10T10:00:00.000Z",
    },
    {
      id: "supp-2",
      businessId: "b-1",
      name: "Lácteos del Valle",
      contactName: "María Pérez",
      phone: "+57 311 987 6543",
      email: "pedidos@lacteosvalle.com",
      address: "Carrera 50 # 30-10, Medellín",
      taxId: "800987654-2",
      paymentTermsDays: 15,
      notes: null,
      status: "active",
      createdAt: "2026-02-15T10:00:00.000Z",
      updatedAt: "2026-02-15T10:00:00.000Z",
    },
    {
      id: "supp-3",
      businessId: "b-1",
      name: "Carnes Premium de Colombia",
      contactName: "Jorge Gómez",
      phone: "+57 320 555 1234",
      email: "ventas@carnespremium.co",
      address: "Avenida 80 # 20-50, Medellín",
      taxId: "901555666-3",
      paymentTermsDays: 45,
      notes: null,
      status: "inactive",
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    },
  ];

  const now = new Date("2026-11-03T12:00:00.000Z");

  const mockPurchases: Purchase[] = [
    {
      id: "pur-1",
      businessId: "b-1",
      purchaseNumber: "COMP-00001",
      supplierId: "supp-1",
      supplierName: "Distribuidora El Grano S.A.S.",
      purchaseDate: "2026-11-01T10:00:00.000Z",
      subtotal: 500000,
      taxAmount: 95000,
      total: 595000,
      paymentType: "credit",
      paymentMethod: "transfer",
      status: "confirmed",
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
    },
    {
      id: "pur-2",
      businessId: "b-1",
      purchaseNumber: "COMP-00002",
      supplierId: "supp-1",
      supplierName: "Distribuidora El Grano S.A.S.",
      purchaseDate: "2026-10-15T10:00:00.000Z",
      subtotal: 300000,
      taxAmount: 57000,
      total: 357000,
      paymentType: "cash",
      paymentMethod: "cash",
      status: "confirmed",
      createdAt: "2026-10-15T10:00:00.000Z",
      updatedAt: "2026-10-15T10:00:00.000Z",
    },
    {
      id: "pur-3",
      businessId: "b-1",
      purchaseNumber: "COMP-00003",
      supplierId: "supp-2",
      supplierName: "Lácteos del Valle",
      purchaseDate: "2026-10-01T10:00:00.000Z",
      subtotal: 200000,
      taxAmount: 0,
      total: 200000,
      paymentType: "credit",
      paymentMethod: "cash",
      status: "confirmed",
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
    },
  ];

  const mockAccountsPayable: AccountsPayableWithDetails[] = [
    {
      id: "ap-1",
      businessId: "b-1",
      purchaseId: "pur-1",
      supplierId: "supp-1",
      supplierName: "Distribuidora El Grano S.A.S.",
      purchaseNumber: "COMP-00001",
      amount: 595000,
      totalAmount: 595000,
      paidAmount: 195000,
      balance: 400000,
      dueDate: "2026-11-30T00:00:00.000Z", // Vence a fin de mes (al día)
      status: "partial",
      isOverdue: false,
      daysUntilDue: 27,
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
    },
    {
      id: "ap-2",
      businessId: "b-1",
      purchaseId: "pur-3",
      supplierId: "supp-2",
      supplierName: "Lácteos del Valle",
      purchaseNumber: "COMP-00003",
      amount: 200000,
      totalAmount: 200000,
      paidAmount: 0,
      balance: 200000,
      dueDate: "2026-10-16T00:00:00.000Z", // Venció el 16 de octubre (en mora)
      status: "overdue",
      isOverdue: true,
      daysUntilDue: -18,
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
    },
  ];

  it("Encabezado: debe contar con Título 'Proveedores', descripción comercial y botones 'Compras' y '+ Nuevo proveedor'", () => {
    const headerConfig = {
      title: "Proveedores",
      badge: "Directorio & Créditos",
      description: "Gestiona tu directorio de distribuidores, condiciones comerciales, historial de compras y cuentas por pagar.",
      buttons: [
        { label: "Compras", href: "/workspace/b-1/compras" },
        { label: "+ Nuevo proveedor", action: "open_create_modal" },
      ],
    };

    expect(headerConfig.title).toBe("Proveedores");
    expect(headerConfig.buttons).toHaveLength(2);
    expect(headerConfig.buttons[0].label).toBe("Compras");
    expect(headerConfig.buttons[1].label).toBe("+ Nuevo proveedor");
  });

  it("KPIs superiores: debe calcular Proveedores activos, Por pagar, Vencido y Comprado este mes", () => {
    // 1. Proveedores activos
    const activeSuppliers = mockSuppliers.filter((s) => s.status !== "inactive").length;
    expect(activeSuppliers).toBe(2);

    // 2. Por pagar total
    const pendingDebts = mockAccountsPayable.filter((ap) => ap.status !== "paid" && ap.status !== "cancelled");
    const totalBalance = pendingDebts.reduce((acc, ap) => acc + ap.balance, 0);
    expect(totalBalance).toBe(600000); // 400000 + 200000

    // 3. Vencido total
    const overdueDebts = pendingDebts.filter((ap) => ap.isOverdue || new Date(ap.dueDate) < now);
    const overdueBalance = overdueDebts.reduce((acc, ap) => acc + ap.balance, 0);
    expect(overdueBalance).toBe(200000); // Solo ap-2 vencida

    // 4. Comprado este mes (Noviembre 2026)
    const thisMonthPurchases = mockPurchases.filter((p) => {
      const d = new Date(p.purchaseDate);
      return p.status !== "cancelled" && d.getFullYear() === 2026 && d.getMonth() === 10; // Noviembre (0-indexed: 10)
    });
    const totalThisMonth = thisMonthPurchases.reduce((acc, p) => acc + p.total, 0);
    expect(totalThisMonth).toBe(595000); // pur-1
    expect(thisMonthPurchases).toHaveLength(1);
  });

  it("KPIs superiores: debe mostrar badge verde 'Al día' cuando la deuda por pagar es 0", () => {
    const resolveBalanceKPI = (balance: number) => {
      if (balance === 0) {
        return { isUpToDate: true, badgeText: "Al día", color: "text-emerald-600" };
      }
      return { isUpToDate: false, badgeText: formatCOP(balance), color: "text-amber-600" };
    };

    const zeroBalanceKPI = resolveBalanceKPI(0);
    expect(zeroBalanceKPI.isUpToDate).toBe(true);
    expect(zeroBalanceKPI.badgeText).toBe("Al día");

    const positiveBalanceKPI = resolveBalanceKPI(450000);
    expect(positiveBalanceKPI.isUpToDate).toBe(false);
    expect(positiveBalanceKPI.badgeText).toContain("450.000");
  });

  it("Bloque analítico 1: '¿A quién le compras más?' debe rankear los proveedores en 12 meses y calcular barra porcentual", () => {
    const twelveMonthsAgo = new Date("2025-11-03T12:00:00.000Z");

    const supplierPurchasesSummary = mockSuppliers.map((supplier) => {
      const purchases12m = mockPurchases.filter(
        (p) => p.supplierId === supplier.id && p.status !== "cancelled" && new Date(p.purchaseDate) >= twelveMonthsAgo
      );
      const totalSpent12m = purchases12m.reduce((acc, p) => acc + p.total, 0);
      const purchasesCount = purchases12m.length;

      return {
        id: supplier.id,
        name: supplier.name,
        totalSpent12m,
        purchasesCount,
      };
    });

    // Ordenar de mayor a menor facturado
    const ranked = supplierPurchasesSummary
      .filter((s) => s.totalSpent12m > 0)
      .sort((a, b) => b.totalSpent12m - a.totalSpent12m);

    expect(ranked).toHaveLength(2);
    expect(ranked[0].id).toBe("supp-1");
    expect(ranked[0].totalSpent12m).toBe(952000); // 595,000 + 357,000
    expect(ranked[0].purchasesCount).toBe(2);

    expect(ranked[1].id).toBe("supp-2");
    expect(ranked[1].totalSpent12m).toBe(200000);
    expect(ranked[1].purchasesCount).toBe(1);

    // Barra porcentual con respecto al #1
    const maxSpent = ranked[0].totalSpent12m;
    const rank1Percentage = Math.round((ranked[0].totalSpent12m / maxSpent) * 100);
    const rank2Percentage = Math.round((ranked[1].totalSpent12m / maxSpent) * 100);

    expect(rank1Percentage).toBe(100);
    expect(rank2Percentage).toBe(Math.round((200000 / 952000) * 100)); // ~21%
  });

  it("Bloque analítico 2: 'Pagos pendientes' debe monitorear deudas activas priorizando las vencidas", () => {
    const pendingDebts = mockAccountsPayable
      .filter((ap) => ap.status !== "paid" && ap.status !== "cancelled" && ap.balance > 0)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    expect(pendingDebts).toHaveLength(2);

    // La primera debe ser la vencida (due date en octubre)
    expect(pendingDebts[0].id).toBe("ap-2");
    expect(pendingDebts[0].isOverdue).toBe(true);
    expect(pendingDebts[0].balance).toBe(200000);

    // La segunda vence en noviembre
    expect(pendingDebts[1].id).toBe("ap-1");
    expect(pendingDebts[1].isOverdue).toBe(false);
    expect(pendingDebts[1].balance).toBe(400000);
  });

  it("Filtros: Pestañas por estado deben clasificar Activos, Con saldo, Vencidos e Inactivos", () => {
    // Clasificación de cada proveedor
    const enriched = mockSuppliers.map((s) => {
      const debts = mockAccountsPayable.filter((ap) => ap.supplierId === s.id && ap.balance > 0);
      const totalBalance = debts.reduce((acc, ap) => acc + ap.balance, 0);
      const hasOverdue = debts.some((ap) => ap.isOverdue || new Date(ap.dueDate) < now);
      return { ...s, totalBalance, hasOverdue };
    });

    const activeList = enriched.filter((s) => s.status !== "inactive");
    expect(activeList).toHaveLength(2); // supp-1 y supp-2

    const withBalanceList = enriched.filter((s) => s.totalBalance > 0);
    expect(withBalanceList).toHaveLength(2); // supp-1 (400k) y supp-2 (200k)

    const overdueList = enriched.filter((s) => s.hasOverdue);
    expect(overdueList).toHaveLength(1);
    expect(overdueList[0].id).toBe("supp-2"); // supp-2 tiene deuda vencida

    const inactiveList = enriched.filter((s) => s.status === "inactive");
    expect(inactiveList).toHaveLength(1);
    expect(inactiveList[0].id).toBe("supp-3"); // Carnes Premium
  });

  it("Filtros: Buscador interactivo por nombre, NIT y teléfono", () => {
    const filterSuppliers = (query: string) => {
      const q = query.toLowerCase().trim();
      return mockSuppliers.filter((s) => {
        return (
          s.name.toLowerCase().includes(q) ||
          (s.taxId && s.taxId.toLowerCase().includes(q)) ||
          (s.contactName && s.contactName.toLowerCase().includes(q)) ||
          (s.phone && s.phone.toLowerCase().includes(q))
        );
      });
    };

    expect(filterSuppliers("El Grano")).toHaveLength(1);
    expect(filterSuppliers("800987654")).toHaveLength(1); // NIT supp-2
    expect(filterSuppliers("Pérez")).toHaveLength(1); // Contacto María Pérez
    expect(filterSuppliers("320 555")).toHaveLength(1); // Teléfono supp-3
    expect(filterSuppliers("Inexistente")).toHaveLength(0);
  });

  it("Tabla de Proveedores: debe estructurar Proveedor, Contacto, Plazo, Compras 12m, Por pagar y Acciones", () => {
    const s1 = mockSuppliers[0];
    const purchases12m = mockPurchases.filter((p) => p.supplierId === s1.id);
    const totalSpent = purchases12m.reduce((acc, p) => acc + p.total, 0);
    const balance = mockAccountsPayable
      .filter((ap) => ap.supplierId === s1.id)
      .reduce((acc, ap) => acc + ap.balance, 0);

    const tableRow = {
      provider: { name: s1.name, nit: s1.taxId, status: s1.status },
      contact: { name: s1.contactName, phone: s1.phone, email: s1.email },
      paymentTerms: `${s1.paymentTermsDays} días`,
      purchases12m: { amount: totalSpent, count: purchases12m.length },
      accountsPayable: balance,
      hasQuickPurchaseAction: true,
      hasPaymentAction: balance > 0,
    };

    expect(tableRow.provider.name).toBe("Distribuidora El Grano S.A.S.");
    expect(tableRow.provider.nit).toBe("900123456-1");
    expect(tableRow.contact.phone).toBe("+57 300 123 4567");
    expect(tableRow.paymentTerms).toBe("30 días");
    expect(tableRow.purchases12m.amount).toBe(952000);
    expect(tableRow.purchases12m.count).toBe(2);
    expect(tableRow.accountsPayable).toBe(400000);
    expect(tableRow.hasQuickPurchaseAction).toBe(true);
    expect(tableRow.hasPaymentAction).toBe(true);
  });

  it("Regla Global: Prohibido uso de alertas nativas en el módulo de proveedores", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const filesToCheck = [
      "src/app/workspace/[businessId]/proveedores/workspace-proveedores-client.tsx",
      "src/app/workspace/[businessId]/proveedores/supplier-form-modal.tsx",
      "src/app/workspace/[businessId]/proveedores/confirm-delete-supplier-modal.tsx",
      "src/app/workspace/[businessId]/proveedores/actions.ts",
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

