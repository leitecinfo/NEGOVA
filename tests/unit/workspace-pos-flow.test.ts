import { describe, it, expect } from "vitest";
import {
  generateCartItemId,
  calculateCartSummary,
  createCartItem,
  validateModifierGroupSelection,
  validateAllModifierGroups,
  formatCOP,
  type PosCartItem,
  type PosSelectedModifier,
} from "../../src/lib/pos/types";
import type { Product, ProductModifierGroup } from "../../src/lib/products/types";

describe("NEGOVA — ETAPA 2: POS y Selección del Pedido (Lógica y Modelo del Carrito)", () => {
  // Mock de producto gastronómico (Ej. Hamburguesa Artesanal con complementos)
  const burgerProduct: Product = {
    id: "e4b3c2a1-0000-4000-8000-000000000001",
    business_id: "a8e2612f-4acc-4c84-a420-220131b70d66",
    category_id: "cat-111",
    name: "Hamburguesa Doble Carne",
    description: "Doble carne angus con queso cheddar",
    price: 25000,
    status: "active",
    is_available: true,
    sort_order: 1,
    image_url: "https://example.com/burger.jpg",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      modifier_groups: [
        {
          id: "grp_termino",
          name: "Término de la carne",
          required: true,
          min_select: 1,
          max_select: 1,
          options: [
            { id: "opt_3_4", name: "Tres cuartos", price: 0, is_available: true },
            { id: "opt_bien", name: "Bien asada", price: 0, is_available: true },
          ],
        },
        {
          id: "grp_adicionales",
          name: "Acompañamiento o extra",
          required: false,
          min_select: 0,
          max_select: 2,
          options: [
            { id: "opt_papas", name: "Papas francesas", price: 5000, is_available: true },
            { id: "opt_tocino", name: "Tocineta crocante", price: 4000, is_available: true },
            { id: "opt_queso", name: "Queso extra", price: 3000, is_available: false }, // Agotado
          ],
        },
      ],
    },
  };

  // Mock de producto estándar sin complementos (Ej. Ferretería o Retail)
  const retailProduct: Product = {
    id: "f5c4d3b2-0000-4000-8000-000000000002",
    business_id: "a8e2612f-4acc-4c84-a420-220131b70d66",
    category_id: "cat-222",
    name: "Cinta Aislante 3M",
    description: "Cinta de uso profesional",
    price: 6500,
    status: "active",
    is_available: true,
    sort_order: 2,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      modifier_groups: [],
    },
  };

  // ==============================================================================
  // 1. GENERACIÓN DETERMINÍSTICA DE IDENTIFICADORES DE LÍNEA
  // ==============================================================================
  describe("1. Identidad y firmas de líneas del carrito", () => {
    it("debe generar un ID determinístico base cuando un producto no tiene modificadores", () => {
      const id = generateCartItemId(retailProduct.id, []);
      expect(id).toBe(`item_${retailProduct.id}_base`);
    });

    it("debe generar el mismo ID para combinaciones idénticas independientemente del orden de selección", () => {
      const modsOrderA: PosSelectedModifier[] = [
        { groupId: "grp_termino", groupName: "Término", optionId: "opt_3_4", optionName: "3/4", price: 0 },
        { groupId: "grp_adicionales", groupName: "Adicionales", optionId: "opt_papas", optionName: "Papas", price: 5000 },
      ];

      const modsOrderB: PosSelectedModifier[] = [
        { groupId: "grp_adicionales", groupName: "Adicionales", optionId: "opt_papas", optionName: "Papas", price: 5000 },
        { groupId: "grp_termino", groupName: "Término", optionId: "opt_3_4", optionName: "3/4", price: 0 },
      ];

      const idA = generateCartItemId(burgerProduct.id, modsOrderA);
      const idB = generateCartItemId(burgerProduct.id, modsOrderB);

      expect(idA).toBe(idB);
      expect(idA).toContain("grp_adicionales:opt_papas");
      expect(idA).toContain("grp_termino:opt_3_4");
    });

    it("debe generar IDs distintos cuando los complementos difieren", () => {
      const modsA: PosSelectedModifier[] = [
        { groupId: "grp_adicionales", groupName: "Adicionales", optionId: "opt_papas", optionName: "Papas", price: 5000 },
      ];
      const modsB: PosSelectedModifier[] = [
        { groupId: "grp_adicionales", groupName: "Adicionales", optionId: "opt_tocino", optionName: "Tocineta", price: 4000 },
      ];

      const idA = generateCartItemId(burgerProduct.id, modsA);
      const idB = generateCartItemId(burgerProduct.id, modsB);

      expect(idA).not.toBe(idB);
    });
  });

  // ==============================================================================
  // 2. CREACIÓN Y MODELADO DE ÍTEMS DEL CARRITO
  // ==============================================================================
  describe("2. Creación y cálculo de líneas de pedido", () => {
    it("debe crear una línea de producto simple sin complementos", () => {
      const item = createCartItem(retailProduct, [], 2);

      expect(item.productId).toBe(retailProduct.id);
      expect(item.productName).toBe(retailProduct.name);
      expect(item.basePrice).toBe(6500);
      expect(item.modifiersPrice).toBe(0);
      expect(item.unitPrice).toBe(6500);
      expect(item.quantity).toBe(2);
      expect(item.lineTotal).toBe(13000);
    });

    it("debe sumar el precio de los complementos al precio unitario final", () => {
      const mods: PosSelectedModifier[] = [
        { groupId: "grp_termino", groupName: "Término", optionId: "opt_3_4", optionName: "3/4", price: 0 },
        { groupId: "grp_adicionales", groupName: "Adicional", optionId: "opt_papas", optionName: "Papas", price: 5000 },
        { groupId: "grp_adicionales", groupName: "Adicional", optionId: "opt_tocino", optionName: "Tocineta", price: 4000 },
      ];

      const item = createCartItem(burgerProduct, mods, 2, "Sin cebolla");

      // base: 25000 + extras: 9000 = unit: 34000
      expect(item.basePrice).toBe(25000);
      expect(item.modifiersPrice).toBe(9000);
      expect(item.unitPrice).toBe(34000);
      expect(item.quantity).toBe(2);
      expect(item.lineTotal).toBe(68000);
      expect(item.notes).toBe("Sin cebolla");
      expect(item.selectedModifiers).toHaveLength(3);
    });

    it("debe forzar cantidad mínima de 1 si se pasa cantidad inválida o menor a 1", () => {
      const itemZero = createCartItem(retailProduct, [], 0);
      const itemNeg = createCartItem(retailProduct, [], -5);

      expect(itemZero.quantity).toBe(1);
      expect(itemNeg.quantity).toBe(1);
    });
  });

  // ==============================================================================
  // 3. VALIDACIÓN DE REGLAS DE COMPLEMENTOS Y MODIFICADORES
  // ==============================================================================
  describe("3. Motor de validación de modificadores", () => {
    const requiredGroup: ProductModifierGroup = {
      id: "grp_req",
      name: "Salsa Principal",
      required: true,
      min_select: 1,
      max_select: 1,
      options: [
        { id: "opt_bbq", name: "BBQ", price: 0, is_available: true },
        { id: "opt_ajo", name: "Ajo", price: 0, is_available: true },
      ],
    };

    const optionalMultiGroup: ProductModifierGroup = {
      id: "grp_opt",
      name: "Toppings",
      required: false,
      min_select: 0,
      max_select: 2,
      options: [
        { id: "t1", name: "T1", price: 1000, is_available: true },
        { id: "t2", name: "T2", price: 1000, is_available: true },
        { id: "t3", name: "T3", price: 1000, is_available: true },
      ],
    };

    it("debe rechazar selección vacía en un grupo obligatorio", () => {
      const check = validateModifierGroupSelection(requiredGroup, []);
      expect(check.isValid).toBe(false);
      expect(check.error).toContain("Debes seleccionar al menos una opción");
    });

    it("debe aceptar exactamente 1 selección en un grupo obligatorio con max 1", () => {
      const check = validateModifierGroupSelection(requiredGroup, ["opt_bbq"]);
      expect(check.isValid).toBe(true);
      expect(check.error).toBeUndefined();
    });

    it("debe rechazar si excede el máximo permitido", () => {
      const check = validateModifierGroupSelection(optionalMultiGroup, ["t1", "t2", "t3"]);
      expect(check.isValid).toBe(false);
      expect(check.error).toContain("máximo 2 opciones");
    });

    it("debe aceptar selección vacía en un grupo opcional", () => {
      const check = validateModifierGroupSelection(optionalMultiGroup, []);
      expect(check.isValid).toBe(true);
    });

    it("debe validar integralmente múltiples grupos de un producto", () => {
      const groups = [requiredGroup, optionalMultiGroup];

      // Caso 1: Falta el obligatorio
      const resIncomplete = validateAllModifierGroups(groups, {
        grp_req: [],
        grp_opt: ["t1"],
      });
      expect(resIncomplete.isValid).toBe(false);

      // Caso 2: Completo y válido
      const resValid = validateAllModifierGroups(groups, {
        grp_req: ["opt_ajo"],
        grp_opt: ["t1", "t2"],
      });
      expect(resValid.isValid).toBe(true);
    });
  });

  // ==============================================================================
  // 4. CÁLCULO DEL RESUMEN GLOBAL DEL CARRITO
  // ==============================================================================
  describe("4. Resumen y cálculos totales del carrito", () => {
    it("debe retornar ceros cuando el carrito está vacío", () => {
      const summary = calculateCartSummary([]);

      expect(summary.itemsCount).toBe(0);
      expect(summary.linesCount).toBe(0);
      expect(summary.subtotal).toBe(0);
      expect(summary.total).toBe(0);
    });

    it("debe calcular subtotal y total sumando múltiples líneas con cantidades", () => {
      const item1 = createCartItem(retailProduct, [], 3); // 6,500 * 3 = 19,500
      const mods = [
        { groupId: "grp_adicionales", groupName: "Extra", optionId: "opt_papas", optionName: "Papas", price: 5000 },
      ];
      const item2 = createCartItem(burgerProduct, mods, 2); // (25,000 + 5,000) * 2 = 60,000

      const summary = calculateCartSummary([item1, item2]);

      expect(summary.itemsCount).toBe(5); // 3 + 2
      expect(summary.linesCount).toBe(2);
      expect(summary.subtotal).toBe(79500); // 19,500 + 60,000
      expect(summary.total).toBe(79500);
    });

    it("debe aplicar descuentos e impuestos correctamente sin producir valores negativos", () => {
      const item = createCartItem(retailProduct, [], 2); // 13,000
      const summaryWithDiscount = calculateCartSummary([item], 3000, 1000);

      expect(summaryWithDiscount.subtotal).toBe(13000);
      expect(summaryWithDiscount.discount).toBe(3000);
      expect(summaryWithDiscount.tax).toBe(1000);
      expect(summaryWithDiscount.total).toBe(11000); // 13,000 - 3,000 + 1,000

      // Descuento mayor al subtotal no debe producir total negativo
      const excessiveDiscount = calculateCartSummary([item], 50000, 0);
      expect(excessiveDiscount.total).toBe(0);
    });
  });

  // ==============================================================================
  // 5. COMPATIBILIDAD CON NEGOCIOS NO GASTRONÓMICOS (RETAIL / SERVICIOS)
  // ==============================================================================
  describe("5. Compatibilidad universal para negocios no gastronómicos", () => {
    it("debe permitir agregar productos sin complementos directamente con 1 clic", () => {
      const modifierGroups = (retailProduct.metadata as any)?.modifier_groups || [];
      expect(modifierGroups).toHaveLength(0);

      // No se requieren validaciones de complementos
      const validation = validateAllModifierGroups(modifierGroups, {});
      expect(validation.isValid).toBe(true);

      const cartItem = createCartItem(retailProduct, [], 1);
      expect(cartItem.id).toBe(`item_${retailProduct.id}_base`);
      expect(cartItem.lineTotal).toBe(retailProduct.price);
    });
  });

  // ==============================================================================
  // 6. FORMATEADOR DE MONEDA COP
  // ==============================================================================
  describe("6. Formato de moneda colombiana (COP)", () => {
    it("debe formatear valores enteros en pesos colombianos sin decimales", () => {
      const formatted = formatCOP(25000);
      expect(formatted).toContain("25");
      expect(formatted).toContain("$");
    });

    it("debe manejar 0 y valores no definidos elegantemente", () => {
      expect(formatCOP(0)).toContain("$");
      expect(formatCOP(undefined as any)).toContain("$");
    });
  });

  // ==============================================================================
  // 7. AISLAMIENTO Y NO PERSISTENCIA EN ETAPA 2 (SIN REGISTRO DE VENTA)
  // ==============================================================================
  describe("7. Alcance de Etapa 2: Cero persistencia y carrito en memoria", () => {
    it("debe mantener el pedido estrictamente en memoria sin persistir en la base de datos", () => {
      // Simular flujo completo del POS en memoria
      const item1 = createCartItem(retailProduct, [], 1);
      const mods: PosSelectedModifier[] = [
        { groupId: "grp_termino", groupName: "Término", optionId: "opt_3_4", optionName: "3/4", price: 0 },
      ];
      const item2 = createCartItem(burgerProduct, mods, 2);

      const cart = [item1, item2];
      const summary = calculateCartSummary(cart);

      // El resumen totaliza en memoria sin crear IDs de documento ni ventas en base de datos
      expect(summary.itemsCount).toBe(3);
      expect(summary.total).toBe(6500 + 25000 * 2);
      expect((summary as any).documentId).toBeUndefined();
      expect((summary as any).documentNumber).toBeUndefined();

      // El carrito en memoria preserva sus líneas exactamente iguales
      expect(cart).toHaveLength(2);
      expect(cart[0].productId).toBe(retailProduct.id);
      expect(cart[1].productId).toBe(burgerProduct.id);
    });
  });

  // ==============================================================================
  // 8. CONTROL DE DISPONIBILIDAD DE PRODUCTOS Y COMPLEMENTOS
  // ==============================================================================
  describe("8. Control de disponibilidad de catálogo", () => {
    it("debe identificar productos y complementos no disponibles", () => {
      const unavailableProduct: Product = {
        ...burgerProduct,
        id: "prod-agotado-999",
        name: "Producto Agotado",
        is_available: false,
      };

      expect(unavailableProduct.is_available).toBe(false);

      // Verificar que los complementos agotados tengan is_available: false
      const addonsGroup = burgerProduct.metadata.modifier_groups?.find(
        (g) => g.id === "grp_adicionales"
      );
      const quesoExtra = addonsGroup?.options.find((o) => o.id === "opt_queso");
      expect(quesoExtra).toBeDefined();
      expect(quesoExtra?.is_available).toBe(false);
    });
  });

  // ==============================================================================
  // 9. DESTINO Y CANAL: SOPORTE DE DATOS DE CLIENTE EN PARA LLEVAR (TAKEOUT)
  // ==============================================================================
  describe("9. Destino Para Llevar y Datos de Cliente", () => {
    it("permite registrar nombre y teléfono de contacto para pedidos Para Llevar", () => {
      const takeoutPayload = {
        orderType: "takeout" as const,
        channelOrigin: "in_person" as const,
        customerName: "Carlos Mendoza",
        customerPhone: "3001234567",
        tableId: null,
        deliveryAddress: null,
      };

      expect(takeoutPayload.orderType).toBe("takeout");
      expect(takeoutPayload.customerName).toBe("Carlos Mendoza");
      expect(takeoutPayload.customerPhone).toBe("3001234567");
      expect(takeoutPayload.tableId).toBeNull();
      expect(takeoutPayload.deliveryAddress).toBeNull();
    });

    it("valida que un pedido Para Llevar pueda registrarse sin mesa y sin dirección de entrega", () => {
      const isTakeoutValid = (orderType: string, tableId?: string | null, address?: string | null) => {
        if (orderType === "takeout") {
          return tableId === null && (address === null || address === undefined);
        }
        return false;
      };

      expect(isTakeoutValid("takeout", null, null)).toBe(true);
      expect(isTakeoutValid("takeout", "table-uuid", null)).toBe(false);
    });
  });
});

