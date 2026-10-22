import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPublicMenuOrderAction } from "@/app/menu/[slugOrId]/actions";

// Mock del servicio de restaurante
vi.mock("@/lib/restaurant/restaurant-service", () => ({
  createRestaurantOrder: vi.fn(),
  validateTableQrAccess: vi.fn(),
}));

describe("Flujo Público de Creación de Pedidos (3 Modalidades y Validación Servidor)", () => {
  const businessId = "11111111-1111-4111-a111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Mesa: Rechaza si no se incluye tableId", async () => {
    const res = await createPublicMenuOrderAction({
      businessId,
      orderType: "dine_in",
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/escanear el código QR/i);
  });

  it("2. Mesa: Rechaza si el token del QR es inválido o revocado", async () => {
    const { validateTableQrAccess } = await import("@/lib/restaurant/restaurant-service");
    vi.mocked(validateTableQrAccess).mockResolvedValueOnce({
      valid: false,
      error: "Código QR inválido o caducado.",
    });

    const res = await createPublicMenuOrderAction({
      businessId,
      orderType: "dine_in",
      tableId: "table-123",
      tableToken: "v1.token_invalido",
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/inválido o caducado/i);
  });

  it("3. Mesa: Si el QR es válido, crea el pedido asignando la mesa y canal digital_menu", async () => {
    const { validateTableQrAccess, createRestaurantOrder } = await import("@/lib/restaurant/restaurant-service");
    vi.mocked(validateTableQrAccess).mockResolvedValueOnce({
      valid: true,
      table: { id: "table-123", name_or_number: "Mesa 4", status: "available", capacity: 4 },
    });
    vi.mocked(createRestaurantOrder).mockResolvedValueOnce({
      success: true,
      orderId: "order-999",
      orderNumber: 42,
      total: 25000,
    });

    const res = await createPublicMenuOrderAction({
      businessId,
      orderType: "dine_in",
      tableId: "table-123",
      tableToken: "v1.token_valido",
      items: [{ productId: "prod-1", quantity: 2 }],
    });

    expect(res.success).toBe(true);
    expect(res.orderNumber).toBe(42);
    expect(createRestaurantOrder).toHaveBeenCalledWith(
      businessId,
      expect.objectContaining({
        orderType: "dine_in",
        channelOrigin: "digital_menu",
        tableId: "table-123",
      })
    );
  });

  it("4. Recogida (takeout): Exige nombre y teléfono del cliente, no exige dirección", async () => {
    // Sin nombre
    const resNoName = await createPublicMenuOrderAction({
      businessId,
      orderType: "takeout",
      items: [{ productId: "prod-1", quantity: 1 }],
    });
    expect(resNoName.success).toBe(false);
    expect(resNoName.error).toMatch(/nombre/i);

    // Sin teléfono
    const resNoPhone = await createPublicMenuOrderAction({
      businessId,
      orderType: "takeout",
      customerName: "Juan Pérez",
      items: [{ productId: "prod-1", quantity: 1 }],
    });
    expect(resNoPhone.success).toBe(false);
    expect(resNoPhone.error).toMatch(/teléfono/i);

    // Con datos completos
    const { createRestaurantOrder } = await import("@/lib/restaurant/restaurant-service");
    vi.mocked(createRestaurantOrder).mockResolvedValueOnce({
      success: true,
      orderId: "order-100",
      orderNumber: 43,
      total: 18000,
    });

    const resOk = await createPublicMenuOrderAction({
      businessId,
      orderType: "takeout",
      customerName: "Juan Pérez",
      customerPhone: "3001234567",
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    expect(resOk.success).toBe(true);
    expect(createRestaurantOrder).toHaveBeenCalledWith(
      businessId,
      expect.objectContaining({
        orderType: "takeout",
        channelOrigin: "digital_menu",
        customerName: "Juan Pérez",
        customerPhone: "3001234567",
        deliveryAddress: null,
      })
    );
  });

  it("5. Domicilio (delivery): Exige nombre, teléfono y dirección de entrega obligatoria", async () => {
    // Sin dirección
    const resNoAddress = await createPublicMenuOrderAction({
      businessId,
      orderType: "delivery",
      customerName: "Ana Gómez",
      customerPhone: "3109876543",
      items: [{ productId: "prod-1", quantity: 1 }],
    });
    expect(resNoAddress.success).toBe(false);
    expect(resNoAddress.error).toMatch(/dirección/i);

    // Con dirección
    const { createRestaurantOrder } = await import("@/lib/restaurant/restaurant-service");
    vi.mocked(createRestaurantOrder).mockResolvedValueOnce({
      success: true,
      orderId: "order-101",
      orderNumber: 44,
      total: 35000,
    });

    const resOk = await createPublicMenuOrderAction({
      businessId,
      orderType: "delivery",
      customerName: "Ana Gómez",
      customerPhone: "3109876543",
      deliveryAddress: "Cra 15 # 85-20, Apto 402",
      deliveryReference: "Cerca al parque",
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    expect(resOk.success).toBe(true);
    expect(resOk.orderType).toBe("delivery");
    expect(createRestaurantOrder).toHaveBeenCalledWith(
      businessId,
      expect.objectContaining({
        orderType: "delivery",
        channelOrigin: "digital_menu",
        tableId: null,
        deliveryAddress: "Cra 15 # 85-20, Apto 402",
        deliveryReference: "Cerca al parque",
      })
    );
  });

  it("6. Servidor determina la modalidad y anula campos conflictivos o maliciosos enviados por el cliente", async () => {
    const { validateTableQrAccess, createRestaurantOrder } = await import("@/lib/restaurant/restaurant-service");
    vi.mocked(validateTableQrAccess).mockResolvedValueOnce({
      valid: true,
      table: { id: "table-safe", name_or_number: "Mesa 10", status: "available", capacity: 2 },
    });
    vi.mocked(createRestaurantOrder).mockResolvedValueOnce({
      success: true,
      orderId: "order-safe-1",
      orderNumber: 50,
      total: 15000,
    });

    // Cliente malicioso intenta enviar deliveryAddress y mesa a la vez
    const res = await createPublicMenuOrderAction({
      businessId,
      orderType: "dine_in",
      tableId: "table-safe",
      tableToken: "v1.token_ok",
      deliveryAddress: "Dirección falsa que no debe guardarse en mesa",
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    expect(res.success).toBe(true);
    expect(res.orderType).toBe("dine_in");
    // El servidor debe haber limpiado deliveryAddress a null
    expect(createRestaurantOrder).toHaveBeenCalledWith(
      businessId,
      expect.objectContaining({
        orderType: "dine_in",
        tableId: "table-safe",
        deliveryAddress: null,
      })
    );
  });

  it("7. Rechaza modalidades inválidas o no soportadas", async () => {
    const res = await createPublicMenuOrderAction({
      businessId,
      orderType: "invalido" as any,
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/modalidad.*no válida/i);
  });
});
