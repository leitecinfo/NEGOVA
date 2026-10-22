import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPublicMenuOrderAction } from "@/app/menu/[slugOrId]/actions";
import { updateDeliverySettingsAction } from "@/app/workspace/[businessId]/configuracion/actions";

// Mock de verifyWorkspaceAction
vi.mock("@/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: vi.fn(),
}));

// Mock de audit service
vi.mock("@/lib/audit/audit-service", () => ({
  logAuditAction: vi.fn(),
}));

// Mock de restaurant-service
vi.mock("@/lib/restaurant/restaurant-service", () => ({
  createRestaurantOrder: vi.fn(),
  validateTableQrAccess: vi.fn(),
}));

// Mock de Supabase server client y admin client usando vi.hoisted
const {
  mockBusinessesSelect,
  mockBusinessesUpdate,
  mockMenuSelect,
  mockMenuUpdate,
  fakeSupabase,
} = vi.hoisted(() => {
  const mockBusinessesSelect = vi.fn();
  const mockBusinessesUpdate = vi.fn();
  const mockMenuSelect = vi.fn();
  const mockMenuUpdate = vi.fn();

  const fakeSupabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "businesses") {
        return {
          select: mockBusinessesSelect,
          update: mockBusinessesUpdate,
        };
      }
      if (table === "business_digital_menus") {
        return {
          select: mockMenuSelect,
          update: mockMenuUpdate,
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  };

  return {
    mockBusinessesSelect,
    mockBusinessesUpdate,
    mockMenuSelect,
    mockMenuUpdate,
    fakeSupabase,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(fakeSupabase),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue(fakeSupabase),
}));

// Mock de next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Configuración de Tarifa de Domicilio y Selección de Método de Pago", () => {
  const businessId = "11111111-1111-4111-a111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("4. Configuración de la tarifa de domicilio en Configuración del Negocio", () => {
    it("Rechaza la modificación si el usuario no es propietario ni superadmin", async () => {
      const { verifyWorkspaceAction } = await import("@/lib/auth/workspace-context");
      vi.mocked(verifyWorkspaceAction).mockResolvedValueOnce({
        success: true,
        context: {
          isOwner: false,
          isSuperAdmin: false,
          userId: "user-auxiliar",
          businessId,
          businessName: "Burger House",
        } as any,
      });

      const res = await updateDeliverySettingsAction(businessId, {
        enabled: true,
        fee: 5000,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/solo el propietario/i);
    });

    it("Rechaza tarifas negativas o no numéricas", async () => {
      const { verifyWorkspaceAction } = await import("@/lib/auth/workspace-context");
      vi.mocked(verifyWorkspaceAction).mockResolvedValueOnce({
        success: true,
        context: {
          isOwner: true,
          isSuperAdmin: false,
          userId: "user-owner",
          businessId,
          businessName: "Burger House",
        } as any,
      });

      const resNegative = await updateDeliverySettingsAction(businessId, {
        enabled: true,
        fee: -1000,
      });

      expect(resNegative.success).toBe(false);
      expect(resNegative.error).toMatch(/válido/i);
    });

    it("Persiste la tarifa fija y estado activo para el propietario en businesses.settings.delivery", async () => {
      const { verifyWorkspaceAction } = await import("@/lib/auth/workspace-context");
      vi.mocked(verifyWorkspaceAction).mockResolvedValueOnce({
        success: true,
        context: {
          isOwner: true,
          isSuperAdmin: false,
          userId: "user-owner",
          businessId,
          businessName: "Burger House",
        } as any,
      });

      // Configurar retorno de businesses
      mockBusinessesSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { settings: { pos: { printReceipt: true } } },
            error: null,
          }),
        }),
      });

      mockBusinessesUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // Configurar retorno de business_digital_menus
      mockMenuSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { custom_settings: { primaryColor: "#ED500A" } },
            error: null,
          }),
        }),
      });

      mockMenuUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const res = await updateDeliverySettingsAction(businessId, {
        enabled: true,
        fee: 5000,
      });

      expect(res.success).toBe(true);

      // Verificar que se guardó en businesses.settings.delivery
      expect(mockBusinessesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            delivery: { enabled: true, fee: 5000 },
          }),
        })
      );

      // Verificar que se sincronizó con business_digital_menus
      expect(mockMenuUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_settings: expect.objectContaining({
            deliveryEnabled: true,
            deliveryFee: 5000,
          }),
        })
      );
    });
  });

  describe("3. Selección del método de pago en menú público", () => {
    it("Rechaza métodos de pago no permitidos como tarjetas o billeteras virtuales", async () => {
      const res = await createPublicMenuOrderAction({
        businessId,
        orderType: "takeout",
        customerName: "Carlos Pérez",
        customerPhone: "3001234567",
        paymentMethod: "credit_card" as any,
        items: [{ productId: "prod-1", quantity: 1 }],
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/solo se admite efectivo o transferencia/i);
    });

    it("Permite seleccionar Efectivo y lo incorpora en notas sin marcar como pagado", async () => {
      const { createRestaurantOrder } = await import("@/lib/restaurant/restaurant-service");
      vi.mocked(createRestaurantOrder).mockResolvedValueOnce({
        success: true,
        orderId: "ord-101",
        orderNumber: 15,
        total: 26000,
      });

      const res = await createPublicMenuOrderAction({
        businessId,
        orderType: "takeout",
        customerName: "Carlos Pérez",
        customerPhone: "3001234567",
        paymentMethod: "cash",
        notes: "Sin salsas",
        items: [{ productId: "prod-1", quantity: 1 }],
      });

      expect(res.success).toBe(true);
      expect(createRestaurantOrder).toHaveBeenCalledWith(
        businessId,
        expect.objectContaining({
          orderType: "takeout",
          notes: expect.stringContaining("Método de pago propuesto: Efectivo"),
        })
      );
    });

    it("Permite seleccionar Transferencia y lo incorpora en notas sin alterar el estado de pago", async () => {
      const { createRestaurantOrder } = await import("@/lib/restaurant/restaurant-service");
      vi.mocked(createRestaurantOrder).mockResolvedValueOnce({
        success: true,
        orderId: "ord-102",
        orderNumber: 16,
        total: 31000,
      });

      const res = await createPublicMenuOrderAction({
        businessId,
        orderType: "delivery",
        customerName: "María López",
        customerPhone: "3109876543",
        deliveryAddress: "Calle 100 # 15-20",
        paymentMethod: "transfer",
        items: [{ productId: "prod-1", quantity: 2 }],
      });

      expect(res.success).toBe(true);
      expect(createRestaurantOrder).toHaveBeenCalledWith(
        businessId,
        expect.objectContaining({
          orderType: "delivery",
          notes: expect.stringContaining("Método de pago propuesto: Transferencia"),
        })
      );
    });
  });

  describe("5. Cálculo del total y mensaje de WhatsApp", () => {
    const formatCOP = (val: number) =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(val);

    const generateWhatsAppTestMessage = (params: {
      businessName: string;
      items: Array<{ name: string; quantity: number; unitPrice: number }>;
      orderType: "dine_in" | "takeout" | "delivery";
      deliveryFee: number;
      deliveryEnabled: boolean;
      paymentMethod: "cash" | "transfer";
      customerName?: string;
      customerPhone?: string;
      deliveryAddress?: string;
      tableName?: string;
    }) => {
      const subtotalAmount = params.items.reduce(
        (sum, it) => sum + it.unitPrice * it.quantity,
        0
      );
      const isDeliveryAllowed = params.deliveryEnabled !== false;
      const applicableDeliveryFee =
        params.orderType === "delivery" && isDeliveryAllowed
          ? Math.max(0, params.deliveryFee)
          : 0;
      const totalAmount = subtotalAmount + applicableDeliveryFee;

      const lines = params.items.map(
        (it) => `• ${it.quantity} x ${it.name} — ${formatCOP(it.unitPrice * it.quantity)}`
      );

      const subtotalText = `*Subtotal de productos:* ${formatCOP(subtotalAmount)}`;
      const deliveryText =
        params.orderType === "delivery" && applicableDeliveryFee > 0
          ? `\n*Domicilio:* ${formatCOP(applicableDeliveryFee)}`
          : "";
      const totalText = `\n*Total del pedido:* ${formatCOP(totalAmount)}`;

      const paymentLabel =
        params.paymentMethod === "cash" ? "Efectivo" : "Transferencia";
      const paymentText = `\n\n*Método de pago elegido:* ${paymentLabel}.`;

      let modalityInfo = "";
      if (params.orderType === "dine_in") {
        modalityInfo = `\n\n*Modalidad:* Consumo en Mesa (${params.tableName || "Mesa"})`;
      } else if (params.orderType === "takeout") {
        modalityInfo = `\n\n*Modalidad:* Recogida en el local\n*Cliente:* ${params.customerName} (${params.customerPhone})`;
      } else if (params.orderType === "delivery") {
        modalityInfo = `\n\n*Modalidad:* Domicilio\n*Cliente:* ${params.customerName} (${params.customerPhone})\n*Dirección:* ${params.deliveryAddress}`;
      }

      return {
        subtotalAmount,
        applicableDeliveryFee,
        totalAmount,
        message: `¡Hola! Quisiera realizar el siguiente pedido en *${params.businessName}*:\n\n${lines.join(
          "\n"
        )}\n\n${subtotalText}${deliveryText}${totalText}${paymentText}${modalityInfo}\n\nQuedo atento a la confirmación del pedido.`,
      };
    };

    it("5.1 Pedido a domicilio: suma la tarifa de domicilio exactamente una vez al total", () => {
      const result = generateWhatsAppTestMessage({
        businessName: "Burger House",
        items: [
          { name: "Salchipapa especial", quantity: 1, unitPrice: 18000 },
          { name: "Gaseosa", quantity: 2, unitPrice: 4000 },
        ],
        orderType: "delivery",
        deliveryFee: 5000,
        deliveryEnabled: true,
        paymentMethod: "transfer",
        customerName: "Carlos Martínez",
        customerPhone: "3001234567",
        deliveryAddress: "Calle 123 # 45-67",
      });

      expect(result.subtotalAmount).toBe(26000);
      expect(result.applicableDeliveryFee).toBe(5000);
      expect(result.totalAmount).toBe(31000);
      expect(result.message).toContain("*Subtotal de productos:*");
      expect(result.message).toContain("*Domicilio:*");
      expect(result.message).toContain("*Total del pedido:*");
      expect(result.message).toContain("*Método de pago elegido:* Transferencia.");
      expect(result.message).toContain("Quedo atento a la confirmación del pedido.");
    });

    it("5.2 Pedido para recoger: NO suma la tarifa de domicilio", () => {
      const result = generateWhatsAppTestMessage({
        businessName: "Burger House",
        items: [
          { name: "Hamburguesa Clásica", quantity: 1, unitPrice: 20000 },
        ],
        orderType: "takeout",
        deliveryFee: 5000,
        deliveryEnabled: true,
        paymentMethod: "cash",
        customerName: "Ana Gómez",
        customerPhone: "3112223344",
      });

      expect(result.subtotalAmount).toBe(20000);
      expect(result.applicableDeliveryFee).toBe(0);
      expect(result.totalAmount).toBe(20000);
      expect(result.message).not.toContain("*Domicilio:*");
      expect(result.message).toContain("*Método de pago elegido:* Efectivo.");
      expect(result.message).toContain("*Modalidad:* Recogida en el local");
    });

    it("5.3 Pedido en mesa: NO suma la tarifa de domicilio", () => {
      const result = generateWhatsAppTestMessage({
        businessName: "Burger House",
        items: [
          { name: "Pizza Mediana", quantity: 1, unitPrice: 35000 },
        ],
        orderType: "dine_in",
        deliveryFee: 5000,
        deliveryEnabled: true,
        paymentMethod: "cash",
        tableName: "Mesa 3",
      });

      expect(result.subtotalAmount).toBe(35000);
      expect(result.applicableDeliveryFee).toBe(0);
      expect(result.totalAmount).toBe(35000);
      expect(result.message).not.toContain("*Domicilio:*");
      expect(result.message).toContain("Consumo en Mesa (Mesa 3)");
    });
  });
});
