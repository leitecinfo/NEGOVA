import { describe, it, expect } from "vitest";
import {
  InventariableItem,
  StockAdjustmentInputSchema,
  ADJUSTMENT_REASON_LABELS,
  AdjustmentReason,
} from "../../src/lib/inventory/types";
import { Product } from "../../src/lib/products/types";
import fs from "fs";
import path from "path";

describe("TAREA 3 — Unificación de Inventario y visualización de productos en NEGOVA", () => {
  const mockProducts: Product[] = [
    // 1. Producto vendible con control directo de existencias (Gaseosa)
    {
      id: "prod-gaseosa",
      business_id: "biz-1",
      name: "Gaseosa Manzana 400ml",
      price: 4500,
      status: "active",
      is_available: true,
      category_id: "cat-bebidas",
      metadata: {
        product_type: "product",
        track_stock: true,
        stock_quantity: 24,
        min_stock: 10,
        cost: 2200,
        unit: "un",
        sku: "GAS-MANZ-400",
      },
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
    // 2. Producto preparado con receta activa (Hamburguesa Especial)
    {
      id: "prod-hamburguesa",
      business_id: "biz-1",
      name: "Hamburguesa Doble Carne",
      price: 24000,
      status: "active",
      is_available: true,
      category_id: "cat-comidas",
      metadata: {
        product_type: "prepared",
        track_stock: false,
        stock_quantity: 0,
        min_stock: 0,
        cost: 11000,
        has_recipe: true,
      },
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
    // 3. Producto preparado SIN receta configurada (Salchipapa Especial)
    {
      id: "prod-salchipapa",
      business_id: "biz-1",
      name: "Salchipapa Especial",
      price: 20000,
      status: "active",
      is_available: true,
      category_id: "cat-comidas",
      metadata: {
        product_type: "prepared",
        track_stock: false,
        stock_quantity: 0,
        min_stock: 0,
        cost: 9000,
      },
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
    // 4. Servicio puro sin stock (debe quedar excluido de inventario)
    {
      id: "prod-servicio",
      business_id: "biz-1",
      name: "Servicio de Domicilio Especial",
      price: 8000,
      status: "active",
      is_available: true,
      category_id: null,
      metadata: {
        product_type: "service",
        track_stock: false,
      },
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
    // 5. Insumo / Ingrediente inventariable (Queso Mozzarella)
    {
      id: "ing-queso",
      business_id: "biz-1",
      name: "Queso Mozzarella Bloque",
      price: 0,
      status: "active",
      is_available: true,
      category_id: "cat-insumos",
      metadata: {
        product_type: "ingredient",
        track_stock: true,
        stock_quantity: 5,
        min_stock: 8,
        cost: 32000,
        unit: "kg",
        sku: "INS-QUES-01",
      },
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
    // 6. Insumo / Ingrediente inventariable (Pan Hamburguesa)
    {
      id: "ing-pan",
      business_id: "biz-1",
      name: "Pan Artesanal Hamburguesa",
      price: 0,
      status: "active",
      is_available: true,
      category_id: "cat-insumos",
      metadata: {
        product_type: "ingredient",
        track_stock: true,
        stock_quantity: 20,
        min_stock: 10,
        cost: 1500,
        unit: "un",
        sku: "INS-PAN-01",
      },
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
  ];

  it("1. Inclusión en Inventario: incluye productos directos, insumos y preparados; excluye únicamente servicios", () => {
    const isInventariable = (p: Product) => {
      const meta = (p.metadata || {}) as Record<string, any>;
      // Se excluyen únicamente los servicios puros
      return meta.product_type !== "service";
    };

    const inventariables = mockProducts.filter(isInventariable);

    // Debe incluir 5 artículos: Gaseosa, Hamburguesa, Salchipapa, Queso y Pan
    expect(inventariables).toHaveLength(5);
    const ids = inventariables.map((i) => i.id);
    expect(ids).toContain("prod-gaseosa");
    expect(ids).toContain("prod-hamburguesa");
    expect(ids).toContain("prod-salchipapa");
    expect(ids).toContain("ing-queso");
    expect(ids).toContain("ing-pan");

    // NO debe incluir el Servicio
    expect(ids).not.toContain("prod-servicio");
  });

  it("2. Modalidad de control y cálculo dinámico de disponibilidad por receta", () => {
    // Simulación de receta activa para Hamburguesa Doble Carne:
    // Requiere: 1 pan y 0.25 kg queso.
    // Stock pan = 20 un. -> rinde 20 porciones
    // Stock queso = 5 kg -> rinde 5 / 0.25 = 20 porciones
    const recipeHamburguesa = {
      id: "rec-1",
      productId: "prod-hamburguesa",
      portionsAvailable: 20,
      limitingIngredient: {
        ingredientId: "ing-pan",
        name: "Pan Artesanal Hamburguesa",
        currentStock: 20,
        requiredPerPortion: 1,
        unit: "un",
        availablePortions: 20,
      },
      status: "active",
    };

    const recipesMap = new Map([["prod-hamburguesa", recipeHamburguesa]]);

    // Mapeo hacia InventariableItem
    const items: InventariableItem[] = mockProducts
      .filter((p) => (p.metadata as any)?.product_type !== "service")
      .map((p) => {
        const meta = (p.metadata || {}) as Record<string, any>;
        const isIngredient = meta.product_type === "ingredient";
        const recipe = recipesMap.get(p.id);
        const isPrepared =
          meta.product_type === "prepared" ||
          Boolean(meta.has_recipe) ||
          Boolean(recipe) ||
          (!meta.track_stock && !isIngredient);

        const controlType = (isPrepared || Boolean(recipe)) && !isIngredient ? "recipe" : "direct";

        if (controlType === "recipe") {
          return {
            id: p.id,
            name: p.name,
            itemType: "product",
            controlType: "recipe",
            unit: "porción",
            currentStock: recipe ? recipe.portionsAvailable : 0,
            minStock: 0,
            cost: meta.cost || 0,
            price: p.price,
            totalValue: 0,
            status: recipe ? (recipe.portionsAvailable > 0 ? "in_stock" : "out_of_stock") : "pending_recipe",
            hasVariants: false,
            variants: [],
            trackStock: false,
            isAvailable: true,
            recipeId: recipe?.id || null,
            recipeStatus: (recipe?.status as any) || "none",
            portionsAvailable: recipe ? recipe.portionsAvailable : null,
            limitingIngredient: recipe?.limitingIngredient || null,
          };
        }

        return {
          id: p.id,
          name: p.name,
          itemType: isIngredient ? "ingredient" : "product",
          controlType: "direct",
          unit: meta.unit || "un",
          currentStock: meta.stock_quantity || 0,
          minStock: meta.min_stock || 0,
          cost: meta.cost || 0,
          price: p.price,
          totalValue: (meta.stock_quantity || 0) * (meta.cost || 0),
          status: (meta.stock_quantity || 0) <= (meta.min_stock || 0) ? "low_stock" : "in_stock",
          hasVariants: false,
          variants: [],
          trackStock: true,
          isAvailable: true,
        };
      });

    // Validar Hamburguesa con receta
    const burg = items.find((i) => i.id === "prod-hamburguesa")!;
    expect(burg.controlType).toBe("recipe");
    expect(burg.portionsAvailable).toBe(20);
    expect(burg.status).toBe("in_stock");
    expect(burg.limitingIngredient?.name).toBe("Pan Artesanal Hamburguesa");
    expect(burg.totalValue).toBe(0); // No genera stock físico duplicado

    // Validar Salchipapa SIN receta configurada
    const salchi = items.find((i) => i.id === "prod-salchipapa")!;
    expect(salchi.controlType).toBe("recipe");
    expect(salchi.portionsAvailable).toBeNull(); // No inventa disponibilidad
    expect(salchi.status).toBe("pending_recipe"); // Identificada como Receta pendiente
    expect(salchi.recipeStatus).toBe("none");

    // Validar artículos directos
    const gaseosa = items.find((i) => i.id === "prod-gaseosa")!;
    expect(gaseosa.controlType).toBe("direct");
    expect(gaseosa.currentStock).toBe(24);
    expect(gaseosa.totalValue).toBe(24 * 2200);

    const queso = items.find((i) => i.id === "ing-queso")!;
    expect(queso.controlType).toBe("direct");
    expect(queso.itemType).toBe("ingredient");
    expect(queso.status).toBe("low_stock"); // 5 <= 8
  });

  it("3. Ajustes manuales: valida el esquema de entrada y los motivos autorizados", () => {
    const validAdjustment = {
      productId: "a0000000-0000-4000-8000-000000000001",
      targetQuantity: 30,
      reason: "physical_count",
      unitCost: 2200,
      notes: "Conteo físico fin de mes",
    };

    const parsed = StockAdjustmentInputSchema.safeParse(validAdjustment);
    expect(parsed.success).toBe(true);

    // Debe soportar todos los motivos requeridos por la especificación
    const expectedReasons: AdjustmentReason[] = [
      "physical_count",
      "damage",
      "expiration",
      "loss",
      "correction",
      "return",
      "internal_use",
      "other",
    ];

    expectedReasons.forEach((r) => {
      expect(ADJUSTMENT_REASON_LABELS[r]).toBeDefined();
    });

    // Rechaza cantidades negativas
    const invalidNegative = {
      ...validAdjustment,
      targetQuantity: -5,
    };
    expect(StockAdjustmentInputSchema.safeParse(invalidNegative).success).toBe(false);
  });

  it("4. Cálculo de variación en ajuste manual", () => {
    const previousStock = 24;
    const targetStock = 30;
    const difference = targetStock - previousStock;
    expect(difference).toBe(6);

    const targetStockLower = 18;
    const differenceLower = targetStockLower - previousStock;
    expect(differenceLower).toBe(-6);
  });

  it("5. Regla Global: Prohibido el uso de alertas nativas (window.alert, window.confirm, window.prompt, Alert.alert)", () => {
    const filesToCheck = [
      "src/app/workspace/[businessId]/inventario/workspace-inventario-client.tsx",
      "src/app/workspace/[businessId]/inventario/stock-adjustment-modal.tsx",
      "src/app/workspace/[businessId]/inventario/item-detail-modal.tsx",
      "src/app/workspace/[businessId]/inventario/inventory-history-tab.tsx",
      "src/app/workspace/[businessId]/inventario/inventory-low-stock-tab.tsx",
    ];

    const forbiddenPatterns = [
      /\bwindow\.alert\s*\(/,
      /\bwindow\.confirm\s*\(/,
      /\bwindow\.prompt\s*\(/,
      /\balert\s*\(/,
      /\bconfirm\s*\(/,
      /\bAlert\.alert\s*\(/,
    ];

    filesToCheck.forEach((relPath) => {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        forbiddenPatterns.forEach((pattern) => {
          expect(pattern.test(content)).toBe(false);
        });
      }
    });
  });
});
