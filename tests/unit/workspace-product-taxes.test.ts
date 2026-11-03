import { describe, it, expect } from "vitest";
import {
  ProductMetadataSchema,
  ProductSchema,
  Product,
} from "@/lib/products/types";
import {
  calculateItemTax,
  calculateCartSummary,
  createCartItem,
  PosCartItem,
} from "@/lib/pos/types";
import { mapRestaurantOrderToDocument } from "@/lib/documents/document-service";

describe("[CAT-004] Configuración y desglose de impuestos por producto", () => {
  describe("Validación de esquema de producto con impuestos", () => {
    it("permite configurar tarifas estándar (0%, 5%, 8%, 19%) y precio incluye impuesto", () => {
      const validMetadata = ProductMetadataSchema.parse({
        tax_percentage: 19,
        tax_included_in_price: true,
      });

      expect(validMetadata.tax_percentage).toBe(19);
      expect(validMetadata.tax_included_in_price).toBe(true);
    });

    it("asigna valores por defecto de 0% de impuesto e impuesto incluido", () => {
      const defaultMetadata = ProductMetadataSchema.parse({});
      expect(defaultMetadata.tax_percentage).toBe(0);
      expect(defaultMetadata.tax_included_in_price).toBe(true);
    });

    it("soporta producto con tarifa de Impoconsumo del 8% y precio que excluye impuesto", () => {
      const product = ProductSchema.parse({
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        business_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        name: "Cerveza Artesanal",
        price: 15000,
        tax_percentage: 8,
        tax_included_in_price: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          tax_percentage: 8,
          tax_included_in_price: false,
        },
      });

      expect(product.metadata?.tax_percentage).toBe(8);
      expect(product.metadata?.tax_included_in_price).toBe(false);
    });
  });

  describe("Cálculo fiscal unitario (calculateItemTax)", () => {
    it("si taxPercentage es 0, el impuesto es 0 y la base es el total", () => {
      const res = calculateItemTax(50000, 0, true);
      expect(res.netSubtotal).toBe(50000);
      expect(res.taxAmount).toBe(0);
    });

    it("cuando 'precio incluye IVA' (19%): desagrega la base gravable y el IVA sin inflar el total", () => {
      // Precio al público: $11.900 (IVA 19% incluido)
      // Base: 11900 / 1.19 = 10000
      // IVA: 11900 - 10000 = 1900
      const res = calculateItemTax(11900, 19, true);
      expect(res.netSubtotal).toBe(10000);
      expect(res.taxAmount).toBe(1900);
      expect(res.netSubtotal + res.taxAmount).toBe(11900);
    });

    it("cuando 'precio incluye Impoconsumo' (8%): desagrega correctamente la base y el impuesto", () => {
      // Precio al público: $10.800 (Impoconsumo 8% incluido)
      // Base: 10800 / 1.08 = 10000
      // Impuesto: 10800 - 10000 = 800
      const res = calculateItemTax(10800, 8, true);
      expect(res.netSubtotal).toBe(10000);
      expect(res.taxAmount).toBe(800);
    });

    it("cuando 'precio excluye IVA' (19%): la base es el precio y el IVA se calcula para adicionarse", () => {
      // Precio base: $10.000 (sin IVA)
      // IVA 19%: 10000 * 0.19 = 1900
      const res = calculateItemTax(10000, 19, false);
      expect(res.netSubtotal).toBe(10000);
      expect(res.taxAmount).toBe(1900);
    });
  });

  describe("Resumen de compras en el POS (calculateCartSummary)", () => {
    it("si 'precio incluye IVA', el ticket muestra el IVA desagregado y el total no se altera", () => {
      const item: PosCartItem = {
        id: "item_1",
        productId: "prod_1",
        productName: "Hamburguesa Especial",
        basePrice: 23800,
        quantity: 1,
        selectedModifiers: [],
        modifiersPrice: 0,
        unitPrice: 23800,
        lineTotal: 23800,
        taxPercentage: 19,
        taxIncludedInPrice: true,
        // 23800 / 1.19 = 20000 base, 3800 IVA
        netSubtotal: 20000,
        taxAmount: 3800,
      };

      const summary = calculateCartSummary([item]);

      expect(summary.subtotal).toBe(23800);
      expect(summary.total).toBe(23800); // El total a pagar sigue siendo $23.800
      expect(summary.netSubtotal).toBe(20000); // Base gravable desagregada
      expect(summary.includedTax).toBe(3800); // IVA incluido desagregado
      expect(summary.additionalTax).toBe(0); // Nada adicional al checkout
      expect(summary.tax).toBe(3800);
      expect(summary.taxesBreakdown).toHaveLength(1);
      expect(summary.taxesBreakdown[0]).toEqual({
        percentage: 19,
        base: 20000,
        taxAmount: 3800,
        included: true,
      });
    });

    it("si 'precio excluye IVA', el total suma el IVA al checkout", () => {
      const item: PosCartItem = {
        id: "item_2",
        productId: "prod_2",
        productName: "Servicio de Catering Corporativo",
        basePrice: 100000,
        quantity: 1,
        selectedModifiers: [],
        modifiersPrice: 0,
        unitPrice: 100000,
        lineTotal: 100000,
        taxPercentage: 19,
        taxIncludedInPrice: false, // Excluye IVA -> Debe sumarse al cobro
        netSubtotal: 100000,
        taxAmount: 19000,
      };

      const summary = calculateCartSummary([item]);

      expect(summary.subtotal).toBe(100000);
      expect(summary.additionalTax).toBe(19000); // IVA adicional calculado
      expect(summary.total).toBe(119000); // Total suma el impuesto: 100.000 + 19.000
      expect(summary.includedTax).toBe(0);
      expect(summary.tax).toBe(19000);
      expect(summary.taxesBreakdown[0].included).toBe(false);
    });

    it("maneja una canasta mixta con productos de IVA incluido, IVA excluido y exentos", () => {
      const itemIncluido: PosCartItem = {
        id: "item_inc",
        productId: "p1",
        productName: "Gaseosa",
        basePrice: 5000,
        quantity: 2,
        selectedModifiers: [],
        modifiersPrice: 0,
        unitPrice: 5000,
        lineTotal: 10000, // 10000 con 19% inc -> Base 8403, IVA 1597
        taxPercentage: 19,
        taxIncludedInPrice: true,
      };

      const itemExcluido: PosCartItem = {
        id: "item_exc",
        productId: "p2",
        productName: "Bebida Alcohólica Premium",
        basePrice: 20000,
        quantity: 1,
        selectedModifiers: [],
        modifiersPrice: 0,
        unitPrice: 20000,
        lineTotal: 20000, // 20000 base + 8% impoconsumo (1600)
        taxPercentage: 8,
        taxIncludedInPrice: false,
      };

      const itemExento: PosCartItem = {
        id: "item_exe",
        productId: "p3",
        productName: "Botella de Agua",
        basePrice: 3000,
        quantity: 1,
        selectedModifiers: [],
        modifiersPrice: 0,
        unitPrice: 3000,
        lineTotal: 3000,
        taxPercentage: 0,
        taxIncludedInPrice: true,
      };

      const summary = calculateCartSummary([itemIncluido, itemExcluido, itemExento]);

      expect(summary.subtotal).toBe(33000); // 10.000 + 20.000 + 3.000
      expect(summary.additionalTax).toBe(1600); // Solo el producto que excluye IVA suma al cobro
      expect(summary.total).toBe(34600); // 33.000 + 1.600
      expect(summary.includedTax).toBe(1597); // IVA incluido desagregado de la gaseosa
    });
  });

  describe("Construcción de items de carrito desde producto (createCartItem)", () => {
    it("hereda la tarifa de impuesto y configuración de inclusión de metadata del producto", () => {
      const product: Product = {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        business_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        name: "Combo Pizza Personal",
        price: 25000,
        status: "active",
        is_available: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          tax_percentage: 8,
          tax_included_in_price: true,
        },
      };

      const cartItem = createCartItem(product, [], 2);

      expect(cartItem.lineTotal).toBe(50000);
      expect(cartItem.taxPercentage).toBe(8);
      expect(cartItem.taxIncludedInPrice).toBe(true);
      expect(cartItem.taxAmount).toBeGreaterThan(0);
      expect(cartItem.netSubtotal).toBeLessThan(50000);
      expect(cartItem.netSubtotal! + cartItem.taxAmount!).toBe(50000);
    });
  });

  describe("Mapeo de documentos de venta (mapRestaurantOrderToDocument)", () => {
    it("asigna correctamente tax_total al documento de venta", () => {
      const order = {
        id: "ord-1",
        business_id: "biz-1",
        order_number: 1042,
        order_type: "takeout",
        status: "delivered",
        subtotal: 50000,
        delivery_fee: 0,
        tax_total: 8000,
        total: 58000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const doc = mapRestaurantOrderToDocument(order, [
        {
          id: "it-1",
          product_name: "Almuerzo Ejecutivo",
          quantity: 2,
          unit_price: 25000,
          subtotal: 50000,
        },
      ]);

      expect(doc.taxTotal).toBe(8000);
      expect(doc.subtotal).toBe(50000);
      expect(doc.total).toBe(58000);
    });
  });
});
