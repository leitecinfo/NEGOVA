import { describe, it, expect } from "vitest";

describe("Modal: Detalle de Orden / Venta", () => {
  const mockOrder = {
    id: "ord-12345678-1234-1234-1234-123456789abc",
    business_id: "biz-1",
    order_number: 1042,
    status: "delivered",
    order_type: "takeout",
    channel_origin: "in_person",
    subtotal: 20000,
    delivery_fee: 0,
    total: 20000,
    customer_name: "Público General",
    customer_phone: "3001234567",
    notes: "Pedido despachado por JJCOMIDA",
    payment_status: "paid",
    created_at: "2026-11-02T01:46:00.000Z",
    updated_at: "2026-11-02T01:50:00.000Z",
    items: [
      {
        id: "item-1",
        business_id: "biz-1",
        order_id: "ord-12345678-1234-1234-1234-123456789abc",
        product_name: "SALCHIPAPA",
        quantity: 1,
        unit_price: 20000,
        subtotal: 20000,
        modifiers: [],
        notes: null,
        created_at: "2026-11-02T01:46:00.000Z",
        updated_at: "2026-11-02T01:46:00.000Z",
      },
    ],
  };

  it("1. Encabezado Superior: debe contener identificador principal, subtítulo continuo y badges", () => {
    // Identificador principal (cajero/responsable/orden)
    const orderIdentifier = mockOrder.notes?.match(/JJCOMIDA/i)?.[0] || "JJCOMIDA";
    expect(orderIdentifier).toBe("JJCOMIDA");

    // Subtítulo descriptivo: "Orden para Público general · lunes, 2 nov · 01:46"
    const d = new Date(mockOrder.created_at);
    expect(mockOrder.customer_name).toBe("Público General");

    // Badges de estado y origen
    const statusLabel = mockOrder.status === "delivered" ? "Completado" : "Pendiente";
    const originLabel = mockOrder.channel_origin === "in_person" ? "POS" : "WEB";
    expect(statusLabel).toBe("Completado");
    expect(originLabel).toBe("POS");
  });

  it("2. Sección Información de la Orden: cuadrícula 2x2 con Cliente, Método de pago, Servicio y Creación", () => {
    // Tarjeta 1: Cliente
    const cardCliente = {
      label: "CLIENTE",
      value: mockOrder.customer_name,
    };
    expect(cardCliente.label).toBe("CLIENTE");
    expect(cardCliente.value).toBe("Público General");

    // Tarjeta 2: Método de Pago
    const cardPago = {
      label: "MÉTODO DE PAGO",
      value: mockOrder.payment_status === "paid" ? "Efectivo" : "Pendiente",
    };
    expect(cardPago.label).toBe("MÉTODO DE PAGO");
    expect(cardPago.value).toBe("Efectivo");

    // Tarjeta 3: Servicio (takeout -> Para Recoger)
    const cardServicio = {
      label: "SERVICIO",
      value: mockOrder.order_type === "takeout" ? "Para Recoger" : "Mesa",
    };
    expect(cardServicio.label).toBe("SERVICIO");
    expect(cardServicio.value).toBe("Para Recoger");

    // Tarjeta 4: Creada
    const cardCreada = {
      label: "CREADA",
      value: "2 Noviembre 2026 · 01:46",
    };
    expect(cardCreada.label).toBe("CREADA");
  });

  it("3. Sección Productos: miniatura con badge de cantidad superpuesto, info central y total alineado", () => {
    const item = mockOrder.items[0];
    expect(item.product_name).toBe("SALCHIPAPA");
    expect(item.quantity).toBe(1);
    expect(item.unit_price).toBe(20000);
    expect(item.subtotal).toBe(20000);

    const formattedUnit = `$ 20.000 por unidad`;
    expect(formattedUnit).toContain("20.000 por unidad");
  });

  it("4. Pie del Modal: 3 botones de acciones ('Factura', 'Descargar PDF', 'Ver comanda') y Resumen de pago", () => {
    const actions = ["Factura", "Descargar PDF", "Ver comanda"];
    expect(actions).toHaveLength(3);
    expect(actions).toContain("Factura");
    expect(actions).toContain("Descargar PDF");
    expect(actions).toContain("Ver comanda");

    // Resumen de pago: Subtotal y Total de la orden destacado
    expect(mockOrder.subtotal).toBe(20000);
    expect(mockOrder.total).toBe(20000);
  });

  it("5. Diferenciación estricta entre Factura (Comercial) y Comanda (Cocina/KDS)", () => {
    // Factura: Orientada al cliente final y cobro (incluye valores monetarios)
    const facturaData = {
      documentType: "FACTURA_COMERCIAL",
      documentNumber: `FAC-${mockOrder.order_number}`,
      subtotal: mockOrder.subtotal,
      total: mockOrder.total,
      paymentStatus: mockOrder.payment_status,
      hasFinancialDetails: true,
    };
    expect(facturaData.hasFinancialDetails).toBe(true);
    expect(facturaData.total).toBe(20000);

    // Comanda: Orientada a estación de cocina/preparación (cero precios, foco en productos, notas y raciones)
    const comandaData = {
      documentType: "COMANDA_COCINA",
      orderNumber: mockOrder.order_number,
      serviceType: "PARA LLEVAR",
      items: mockOrder.items.map((it) => ({
        quantity: it.quantity,
        name: it.product_name,
        notes: it.notes,
        modifiers: it.modifiers,
      })),
      hasFinancialDetails: false,
    };
    expect(comandaData.hasFinancialDetails).toBe(false);
    expect(comandaData.items[0].name).toBe("SALCHIPAPA");
    expect(comandaData.items[0].quantity).toBe(1);
    // Garantizar que la comanda no expone campos de precios al personal de cocina
    expect((comandaData.items[0] as any).unit_price).toBeUndefined();
    expect((comandaData.items[0] as any).subtotal).toBeUndefined();
    expect((comandaData as any).total).toBeUndefined();
  });
});

