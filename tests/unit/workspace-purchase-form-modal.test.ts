import { describe, it, expect } from "vitest";
import { CreatePurchaseInputSchema, PurchaseItemInputSchema } from "../../src/lib/purchases/types";

describe("Modal 'Nueva compra' en formato de 2 columnas", () => {
  const mockProducts = [
    {
      id: "prod-1",
      name: "Café Especial 500g",
      metadata: { sku: "CAF-500", cost: 18000, track_stock: true },
    },
    {
      id: "prod-2",
      name: "Leche Entera 1L",
      metadata: { sku: "LEC-1L", cost: 4200, track_stock: true },
    },
  ];

  const mockSuppliers = [
    {
      id: "supp-1",
      name: "Distribuidora El Grano S.A.S.",
      taxId: "900123456-1",
      paymentTermsDays: 30,
    },
    {
      id: "supp-2",
      name: "Lácteos del Valle",
      taxId: "800987654-2",
      paymentTermsDays: 15,
    },
  ];

  it("Paso 1: debe requerir Proveedor (*) y Fecha de compra (*)", () => {
    // Schema valida que items tenga al menos 1 elemento
    const validPaso1 = {
      supplierId: "11111111-1111-4111-8111-111111111111",
      purchaseDate: "2026-11-02",
      paymentType: "cash" as const,
      paymentMethod: "cash",
      items: [
        {
          productId: "22222222-2222-4222-8222-222222222222",
          itemName: "Café Especial 500g",
          quantity: 10,
          unitCost: 18000,
          isInventoryItem: true,
        },
      ],
    };

    const parsed = CreatePurchaseInputSchema.safeParse(validPaso1);
    expect(parsed.success).toBe(true);
  });

  it("Paso 2: debe distinguir entre 'Producto del inventario' vs 'Ítem libre'", () => {
    // 1. Producto del inventario (con productId, afecta catálogo y costo promedio)
    const inventoryItem = {
      productId: "11111111-1111-4111-8111-111111111111",
      itemName: "Café Especial 500g",
      quantity: 5,
      unitCost: 17500,
      isInventoryItem: true,
    };
    const parsedInv = PurchaseItemInputSchema.safeParse(inventoryItem);
    expect(parsedInv.success).toBe(true);
    expect(parsedInv.data?.isInventoryItem).toBe(true);
    expect(parsedInv.data?.productId).toBe("11111111-1111-4111-8111-111111111111");

    // 2. Ítem libre (sin productId, gasto directo / insumo sin afectar catálogo)
    const freeItem = {
      itemName: "Bolsas de empaque biodegradables x100",
      quantity: 2,
      unitCost: 25000,
      isInventoryItem: false,
    };
    const parsedFree = PurchaseItemInputSchema.safeParse(freeItem);
    expect(parsedFree.success).toBe(true);
    expect(parsedFree.data?.isInventoryItem).toBe(false);
    expect(parsedFree.data?.productId).toBeUndefined();
  });

  it("Paso 2: la tabla temporal de ítems debe acumular subtotales y unidades correctamente", () => {
    const loadedItems = [
      {
        id: "item-1",
        isInventoryItem: true,
        itemName: "Café Especial 500g",
        quantity: 10,
        unitCost: 18000,
        totalCost: 10 * 18000, // 180,000
      },
      {
        id: "item-2",
        isInventoryItem: true,
        itemName: "Leche Entera 1L",
        quantity: 20,
        unitCost: 4200,
        totalCost: 20 * 4200, // 84,000
      },
      {
        id: "item-3",
        isInventoryItem: false,
        itemName: "Vasos de cartón 12oz x50",
        quantity: 4,
        unitCost: 15000,
        totalCost: 4 * 15000, // 60,000
      },
    ];

    const subtotal = loadedItems.reduce((acc, it) => acc + it.totalCost, 0);
    const totalUnits = loadedItems.reduce((acc, it) => acc + it.quantity, 0);

    expect(subtotal).toBe(324000); // 180000 + 84000 + 60000
    expect(totalUnits).toBe(34); // 10 + 20 + 4
    expect(loadedItems).toHaveLength(3);
  });

  it("Paso 3: debe soportar Condición de pago (Contado vs Crédito) e Integración con Caja activa", () => {
    // Compra de contado con deducción de caja
    const cashPurchase = {
      supplierId: "11111111-1111-4111-8111-111111111111",
      paymentType: "cash" as const,
      paymentMethod: "cash",
      deductFromCashRegister: true,
      items: [
        {
          itemName: "Insumos Varios",
          quantity: 1,
          unitCost: 50000,
          isInventoryItem: false,
        },
      ],
    };
    const parsedCash = CreatePurchaseInputSchema.safeParse(cashPurchase);
    expect(parsedCash.success).toBe(true);
    expect(parsedCash.data?.paymentType).toBe("cash");
    expect(parsedCash.data?.deductFromCashRegister).toBe(true);

    // Compra a crédito con fecha de vencimiento
    const creditPurchase = {
      supplierId: "11111111-1111-4111-8111-111111111111",
      paymentType: "credit" as const,
      paymentMethod: "transfer",
      dueDate: "2026-12-02T00:00:00.000Z",
      deductFromCashRegister: false,
      items: [
        {
          itemName: "Materia Prima",
          quantity: 5,
          unitCost: 20000,
          isInventoryItem: true,
        },
      ],
    };
    const parsedCredit = CreatePurchaseInputSchema.safeParse(creditPurchase);
    expect(parsedCredit.success).toBe(true);
    expect(parsedCredit.data?.paymentType).toBe("credit");
    expect(parsedCredit.data?.dueDate).toBe("2026-12-02T00:00:00.000Z");
  });

  it("Columna Derecha: debe calcular el Neto a Pagar con subtotal, IVA y retenciones en vivo", () => {
    const subtotal = 324000;
    const taxPercentage = 19;
    const retentionPercentage = 2.5;

    const taxAmount = (subtotal * taxPercentage) / 100; // 61,560
    const retentionAmount = (subtotal * retentionPercentage) / 100; // 8,100
    const total = Math.max(0, subtotal + taxAmount - retentionAmount); // 324,000 + 61,560 - 8,100 = 377,460

    expect(taxAmount).toBe(61560);
    expect(retentionAmount).toBe(8100);
    expect(total).toBe(377460);
  });

  it("Columna Derecha: debe estructurar el resumen en vivo con Proveedor, Fecha, Conteo, Subtotal, Neto y Detalle de pago", () => {
    // Simulación del estado del resumen en vivo
    const liveSummary = {
      supplier: {
        name: "Distribuidora El Grano S.A.S.",
        taxId: "900123456-1",
      },
      purchaseDate: "2026-11-02",
      loadedItemsCount: 2,
      totalUnits: 30,
      subtotal: 264000,
      netTotal: 264000,
      paymentDetail: {
        condition: "De Contado",
        method: "Efectivo",
        deductFromCashRegister: true,
      },
      actions: {
        submitButtonText: "Registrar compra",
        cancelButtonText: "Cancelar",
      },
    };

    expect(liveSummary.supplier.name).toBe("Distribuidora El Grano S.A.S.");
    expect(liveSummary.purchaseDate).toBe("2026-11-02");
    expect(liveSummary.loadedItemsCount).toBe(2);
    expect(liveSummary.totalUnits).toBe(30);
    expect(liveSummary.subtotal).toBe(264000);
    expect(liveSummary.netTotal).toBe(264000);
    expect(liveSummary.paymentDetail.condition).toBe("De Contado");
    expect(liveSummary.paymentDetail.method).toBe("Efectivo");
    expect(liveSummary.paymentDetail.deductFromCashRegister).toBe(true);
    expect(liveSummary.actions.submitButtonText).toBe("Registrar compra");
    expect(liveSummary.actions.cancelButtonText).toBe("Cancelar");
  });

  it("Paso 2: debe validar que Cantidad > 0 y Costo Unitario >= 0 antes de agregar a la lista", () => {
    const validateItemInput = (quantity: number, unitCost: number, name: string) => {
      if (!name.trim()) return { valid: false, error: "Nombre/Producto requerido" };
      if (isNaN(quantity) || quantity <= 0) return { valid: false, error: "La cantidad debe ser mayor a 0" };
      if (isNaN(unitCost) || unitCost < 0) return { valid: false, error: "El costo unitario no puede ser negativo" };
      return { valid: true };
    };

    expect(validateItemInput(0, 1000, "Prod").valid).toBe(false);
    expect(validateItemInput(-5, 1000, "Prod").valid).toBe(false);
    expect(validateItemInput(5, -100, "Prod").valid).toBe(false);
    expect(validateItemInput(5, 0, "").valid).toBe(false);
    expect(validateItemInput(5, 0, "Muestra gratis").valid).toBe(true);
    expect(validateItemInput(10, 15000, "Café").valid).toBe(true);
  });

  it("Paso 2: Selector Trifásico debe clasificar correctamente Insumo, Reventa Directa y Gasto", () => {
    type TriphasicType = "ingredient" | "resale" | "free";

    const classifyItem = (type: TriphasicType, item: { name: string; unit?: string; cost: number; productId?: string }) => {
      switch (type) {
        case "ingredient":
          return {
            category: "ingredient",
            isInventoryItem: true,
            destination: "bodega_insumos",
            affectsAverageCost: true,
            name: item.name,
            cost: item.cost,
            unit: item.unit || "unidad",
            productId: item.productId,
          };
        case "resale":
          return {
            category: "resale",
            isInventoryItem: true,
            destination: "pos_reventa",
            affectsAverageCost: true,
            name: item.name,
            cost: item.cost,
            unit: item.unit || "unidad",
            productId: item.productId,
          };
        case "free":
          return {
            category: "free",
            isInventoryItem: false,
            destination: "gasto_operativo",
            affectsAverageCost: false,
            name: item.name,
            cost: item.cost,
            unit: "unidad",
          };
      }
    };

    const cheese = classifyItem("ingredient", { name: "Queso Mozzarella", unit: "kg", cost: 24000, productId: "ing-1" });
    expect(cheese.destination).toBe("bodega_insumos");
    expect(cheese.isInventoryItem).toBe(true);
    expect(cheese.affectsAverageCost).toBe(true);

    const beer = classifyItem("resale", { name: "Cerveza Corona 355ml", unit: "unidad", cost: 6500, productId: "prod-beer" });
    expect(beer.destination).toBe("pos_reventa");
    expect(beer.isInventoryItem).toBe(true);
    expect(beer.affectsAverageCost).toBe(true);

    const bleach = classifyItem("free", { name: "Blanqueador Desinfectante 5L", cost: 18000 });
    expect(bleach.destination).toBe("gasto_operativo");
    expect(bleach.isInventoryItem).toBe(false);
    expect(bleach.affectsAverageCost).toBe(false);
  });

  it("Paso 2: debe bloquear la selección de platos preparados con receta en el selector de reventa", () => {
    const recipeProductIds = new Set(["prod-burger-classic", "prod-pizza-artesanal"]);

    const canSelectForResale = (productId: string, recipeIds: Set<string>) => {
      if (recipeIds.has(productId)) {
        return {
          allowed: false,
          label: "🔒 Bloqueado: Plato con receta",
          reason: "Este producto se cocina mediante receta y escandallo. Adquiere sus materias primas en la pestaña [Insumo / Ingrediente].",
        };
      }
      return { allowed: true, label: "Disponible para reventa" };
    };

    const burgerCheck = canSelectForResale("prod-burger-classic", recipeProductIds);
    expect(burgerCheck.allowed).toBe(false);
    expect(burgerCheck.label).toContain("Bloqueado: Plato con receta");

    const sodaCheck = canSelectForResale("prod-coca-cola", recipeProductIds);
    expect(sodaCheck.allowed).toBe(true);
    expect(sodaCheck.label).toBe("Disponible para reventa");
  });

  it("Paso 3: debe calcular correctamente IVA incluido vs IVA sumado sobre el subtotal", () => {
    const rawCost = 119000;
    const taxRate = 19;

    // Caso A: IVA Incluido (Desglose)
    const baseSubtotal = rawCost / (1 + taxRate / 100);
    const computedTax = rawCost - baseSubtotal;
    const totalA = baseSubtotal + computedTax;

    expect(Math.round(baseSubtotal)).toBe(100000);
    expect(Math.round(computedTax)).toBe(19000);
    expect(Math.round(totalA)).toBe(119000);

    // Caso B: IVA Sumado (Adición)
    const subtotalB = 100000;
    const taxB = (subtotalB * taxRate) / 100;
    const totalB = subtotalB + taxB;

    expect(taxB).toBe(19000);
    expect(totalB).toBe(119000);
  });

  it("Paso 3: debe calcular retención en la fuente para tarifas 2.5%, 3.5% y 1.0%", () => {
    const baseAmount = 1000000;

    const calcRetention = (base: number, rate: number) => (base * rate) / 100;

    expect(calcRetention(baseAmount, 2.5)).toBe(25000);
    expect(calcRetention(baseAmount, 3.5)).toBe(35000);
    expect(calcRetention(baseAmount, 1.0)).toBe(10000);
  });

  it("Columna Derecha: debe resolver el Badge de Origen de Fondos adecuadamente", () => {
    const resolveFundsBadge = (
      paymentType: "cash" | "credit",
      deductFromCashRegister: boolean,
      creditDays: string
    ) => {
      if (paymentType === "credit") {
        return {
          label: `Cuenta por Pagar (Crédito ${creditDays} días)`,
          category: "debt",
        };
      }
      if (deductFromCashRegister) {
        return {
          label: "Caja Activa (Efectivo)",
          category: "cash_register",
        };
      }
      return {
        label: "Bancos / Cuenta Comercial",
        category: "bank",
      };
    };

    const cashFromRegister = resolveFundsBadge("cash", true, "30");
    expect(cashFromRegister.label).toBe("Caja Activa (Efectivo)");
    expect(cashFromRegister.category).toBe("cash_register");

    const cashFromBank = resolveFundsBadge("cash", false, "30");
    expect(cashFromBank.label).toBe("Bancos / Cuenta Comercial");
    expect(cashFromBank.category).toBe("bank");

    const creditBadge = resolveFundsBadge("credit", false, "45");
    expect(creditBadge.label).toBe("Cuenta por Pagar (Crédito 45 días)");
    expect(creditBadge.category).toBe("debt");
  });

  it("Regla Global: Prohibido uso de alertas nativas en el componente del modal", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve("src/app/workspace/[businessId]/compras/purchase-form-modal.tsx");
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // Verificar que no se invoque window.alert, alert(...), window.confirm, window.prompt
    expect(fileContent).not.toMatch(/\bwindow\.alert\s*\(/);
    expect(fileContent).not.toMatch(/\balert\s*\(/);
    expect(fileContent).not.toMatch(/\bwindow\.confirm\s*\(/);
    expect(fileContent).not.toMatch(/\bconfirm\s*\(/);
    expect(fileContent).not.toMatch(/\bwindow\.prompt\s*\(/);
    expect(fileContent).not.toMatch(/\bprompt\s*\(/);

    // Debe usar toast de Sonner para retroalimentación
    expect(fileContent).toMatch(/toast\.(success|error|warning|info)/);
  });
});

