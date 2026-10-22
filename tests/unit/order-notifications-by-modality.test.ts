import { describe, it, expect, vi, beforeEach } from "vitest";
import { enqueueOrderWhatsAppNotification } from "@/lib/whatsapp/order-notifications";
import { WhatsAppQueueService } from "@/lib/whatsapp/queue-service";

// Mock de WhatsAppQueueService
vi.mock("@/lib/whatsapp/queue-service", () => ({
  WhatsAppQueueService: {
    enqueue: vi.fn(),
  },
}));

describe("Regla de notificaciones por modalidad de pedido (order-notifications)", () => {
  const businessId = "22222222-2222-4222-a222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Modalidad 'dine_in' (En mesa): NUNCA encola ni envía notificación por WhatsApp", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { phone_number_id: "phone-123", status: "active" },
              error: null,
            }),
          }),
        }),
      }),
    };

    const res = await enqueueOrderWhatsAppNotification(mockSupabase, businessId, {
      orderId: "order-mesa-1",
      orderNumber: 101,
      total: 45000,
      orderType: "dine_in",
      channelOrigin: "digital_menu",
      tableName: "Mesa 3",
      items: [
        { productName: "Hamburguesa Clásica", quantity: 2, unitPrice: 20000, subtotal: 40000 },
        { productName: "Gaseosa 400ml", quantity: 1, unitPrice: 5000, subtotal: 5000 },
      ],
    });

    expect(res.enqueued).toBe(false);
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(WhatsAppQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("2. Modalidad 'takeout' (Recogida): SÍ genera y encola notificación por WhatsApp", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { phone_number_id: "phone-123", status: "active" },
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(WhatsAppQueueService.enqueue).mockResolvedValueOnce({
      success: true,
      eventId: "evt-takeout-1",
    });

    const res = await enqueueOrderWhatsAppNotification(mockSupabase, businessId, {
      orderId: "order-takeout-1",
      orderNumber: 102,
      total: 30000,
      orderType: "takeout",
      channelOrigin: "digital_menu",
      customerName: "Carlos Pérez",
      customerPhone: "3001234567",
      items: [
        { productName: "Pizza Mediana", quantity: 1, unitPrice: 30000, subtotal: 30000 },
      ],
    });

    expect(res.enqueued).toBe(true);
    expect(WhatsAppQueueService.enqueue).toHaveBeenCalledTimes(1);
    expect(WhatsAppQueueService.enqueue).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        businessId,
        phoneNumberId: "phone-123",
        senderPhone: "3001234567",
        payload: expect.objectContaining({
          type: "order_notification",
          orderId: "order-takeout-1",
          orderNumber: 102,
          text: expect.stringContaining("Recogida en local"),
        }),
      })
    );
  });

  it("3. Modalidad 'delivery' (Domicilio): SÍ genera y encola notificación por WhatsApp incluyendo dirección", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { phone_number_id: "phone-123", status: "active" },
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(WhatsAppQueueService.enqueue).mockResolvedValueOnce({
      success: true,
      eventId: "evt-delivery-1",
    });

    const res = await enqueueOrderWhatsAppNotification(mockSupabase, businessId, {
      orderId: "order-delivery-1",
      orderNumber: 103,
      total: 55000,
      orderType: "delivery",
      channelOrigin: "digital_menu",
      customerName: "Laura Restrepo",
      customerPhone: "3129876543",
      deliveryAddress: "Calle 100 # 15-20, Apto 501",
      deliveryReference: "Torre B",
      items: [
        { productName: "Bandeja Paisa", quantity: 2, unitPrice: 25000, subtotal: 50000 },
      ],
    });

    expect(res.enqueued).toBe(true);
    expect(WhatsAppQueueService.enqueue).toHaveBeenCalledTimes(1);
    expect(WhatsAppQueueService.enqueue).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        businessId,
        phoneNumberId: "phone-123",
        senderPhone: "3129876543",
        payload: expect.objectContaining({
          type: "order_notification",
          orderId: "order-delivery-1",
          orderNumber: 103,
          text: expect.stringMatching(/Domicilio.*Calle 100 # 15-20/s),
        }),
      })
    );
  });

  it("4. Si WhatsApp no está activo para el comercio, no encola pero no arroja error para takeout/delivery", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { phone_number_id: "phone-123", status: "inactive" },
              error: null,
            }),
          }),
        }),
      }),
    };

    const res = await enqueueOrderWhatsAppNotification(mockSupabase, businessId, {
      orderId: "order-takeout-2",
      orderNumber: 104,
      total: 20000,
      orderType: "takeout",
      channelOrigin: "digital_menu",
      customerName: "Pedro",
      customerPhone: "3111111111",
      items: [{ productName: "Papas Fritas", quantity: 2, unitPrice: 10000, subtotal: 20000 }],
    });

    expect(res.enqueued).toBe(false);
    expect(WhatsAppQueueService.enqueue).not.toHaveBeenCalled();
  });
});
