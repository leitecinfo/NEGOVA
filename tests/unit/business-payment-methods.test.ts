import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PAYMENT_METHODS_CATALOG,
  PAYMENT_METHOD_CODES,
  isPaymentMethodComplete,
  toPublicPaymentMethodDTO,
} from "@/lib/payments/payment-methods-catalog";
import {
  getBusinessPaymentMethods,
  getPublicBusinessPaymentMethods,
  saveBusinessPaymentMethod,
  toggleBusinessPaymentMethod,
} from "@/lib/payments/payment-methods-service";
import {
  getPaymentMethodsAction,
  savePaymentMethodAction,
  togglePaymentMethodAction,
} from "@/app/workspace/[businessId]/configuracion/payment-actions";
import { createPublicMenuOrderAction } from "@/app/menu/[slugOrId]/actions";

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

// Mock de Supabase server client y admin client
const {
  paymentMethodsDbRows,
  businessesDbRow,
  fakeSupabase,
} = vi.hoisted(() => {
  const paymentMethodsDbRows: { current: any[] } = { current: [] };
  const businessesDbRow: { current: any } = { current: { settings: {} } };

  const fakeSupabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "business_payment_methods") {
        return {
          select: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation((col: string, val: any) => ({
              eq: vi.fn().mockImplementation(() => ({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  const match = paymentMethodsDbRows.current.find(
                    (r) => (r.configuration?.code === val || r.method === val)
                  );
                  return { data: match || null, error: null };
                }),
              })),
              maybeSingle: vi.fn().mockImplementation(async () => {
                const match = paymentMethodsDbRows.current.find(
                  (r) => r.business_id === val
                );
                return { data: match || null, error: null };
              }),
              then: (resolve: any) =>
                resolve({ data: paymentMethodsDbRows.current, error: null }),
            })),
          })),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          })),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === "businesses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(async () => ({
                data: businessesDbRow.current,
                error: null,
              })),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
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
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/qr.png" } }),
      }),
    },
  };

  return {
    paymentMethodsDbRows,
    businessesDbRow,
    fakeSupabase,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(fakeSupabase),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue(fakeSupabase),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Configuración de Métodos de Pago y Datos de Cobro por Negocio", () => {
  const businessId = "11111111-1111-4111-a111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    paymentMethodsDbRows.current = [];
    businessesDbRow.current = { settings: {} };
  });

  describe("1. Catálogo inicial y reglas de completitud", () => {
    it("Incluye Efectivo y las 6 entidades requeridas con códigos estables", () => {
      expect(PAYMENT_METHOD_CODES).toContain("cash");
      expect(PAYMENT_METHOD_CODES).toContain("nequi");
      expect(PAYMENT_METHOD_CODES).toContain("daviplata");
      expect(PAYMENT_METHOD_CODES).toContain("bancolombia");
      expect(PAYMENT_METHOD_CODES).toContain("davivienda");
      expect(PAYMENT_METHOD_CODES).toContain("nu");
      expect(PAYMENT_METHOD_CODES).toContain("bre_b");

      expect(PAYMENT_METHODS_CATALOG.nequi.name).toBe("Nequi");
      expect(PAYMENT_METHODS_CATALOG.daviplata.name).toBe("DaviPlata");
      expect(PAYMENT_METHODS_CATALOG.bancolombia.name).toBe("Bancolombia");
      expect(PAYMENT_METHODS_CATALOG.davivienda.name).toBe("Davivienda");
      expect(PAYMENT_METHODS_CATALOG.nu.name).toBe("Nu");
      expect(PAYMENT_METHODS_CATALOG.bre_b.name).toBe("Bre-B");
    });

    it("Valida completitud para billeteras y bancos (requieren destinationValue)", () => {
      expect(
        isPaymentMethodComplete("nequi", {
          destinationValue: "",
        })
      ).toBe(false);

      expect(
        isPaymentMethodComplete("nequi", {
          destinationValue: "3001234567",
        })
      ).toBe(true);

      expect(
        isPaymentMethodComplete("bancolombia", {
          destinationValue: "",
        })
      ).toBe(false);

      expect(
        isPaymentMethodComplete("bancolombia", {
          destinationValue: "123-456789-01",
        })
      ).toBe(true);
    });

    it("Valida completitud para Bre-B (requiere keyType y destinationValue, qr es opcional)", () => {
      // Sin keyType
      expect(
        isPaymentMethodComplete("bre_b", {
          destinationValue: "3001234567",
        })
      ).toBe(false);

      // Sin destinationValue
      expect(
        isPaymentMethodComplete("bre_b", {
          breBKeyType: "phone",
          destinationValue: "",
        })
      ).toBe(false);

      // Con keyType y valor, sin QR (QR es opcional)
      expect(
        isPaymentMethodComplete("bre_b", {
          breBKeyType: "phone",
          destinationValue: "3001234567",
          qrStoragePath: null,
        })
      ).toBe(true);

      // Con QR
      expect(
        isPaymentMethodComplete("bre_b", {
          breBKeyType: "merchant_code",
          destinationValue: "MERCHANT-888",
          qrStoragePath: "qr/test.png",
        })
      ).toBe(true);
    });

    it("Transforma método a DTO público omitiendo datos internos innecesarios", () => {
      const dto = toPublicPaymentMethodDTO({
        code: "bre_b",
        name: "Bre-B",
        isEnabled: true,
        isConfigured: true,
        accountHolder: "Negocio Demo SAS",
        destinationType: "bre_b_key",
        breBKeyType: "phone",
        destinationValue: "3009998877",
        instructions: "Por favor enviar comprobante",
        qrStoragePath: "path/to/qr.png",
        qrUrl: "https://example.com/qr.png",
      });

      expect(dto).toEqual({
        code: "bre_b",
        name: "Bre-B",
        category: "Transferencia por llave",
        destinationType: "bre_b_key",
        breBKeyType: "phone",
        destinationValue: "3009998877",
        accountHolder: "Negocio Demo SAS",
        instructions: "Por favor enviar comprobante",
        qrUrl: "https://example.com/qr.png",
        logoPath: "/bancos/breb.svg",
      });
    });
  });

  describe("2. Control de acceso y autorización en configuración", () => {
    it("Rechaza la modificación si el usuario no es propietario ni superadmin", async () => {
      const { verifyWorkspaceAction } = await import("@/lib/auth/workspace-context");
      vi.mocked(verifyWorkspaceAction).mockResolvedValueOnce({
        success: true,
        context: {
          isOwner: false,
          isSuperAdmin: false,
          userId: "auxiliar-1",
          businessId,
          businessName: "Burger House",
        } as any,
      });

      const res = await savePaymentMethodAction(businessId, "nequi", {
        isEnabled: true,
        destinationValue: "3001234567",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/solo el propietario/i);
    });

    it("Rechaza activar una entidad si los datos obligatorios están incompletos", async () => {
      const { verifyWorkspaceAction } = await import("@/lib/auth/workspace-context");
      vi.mocked(verifyWorkspaceAction).mockResolvedValueOnce({
        success: true,
        context: {
          isOwner: true,
          isSuperAdmin: false,
          userId: "owner-1",
          businessId,
          businessName: "Burger House",
        } as any,
      });

      const res = await savePaymentMethodAction(businessId, "nequi", {
        isEnabled: true,
        destinationValue: "", // Incompleto
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/no es posible activar/i);
    });

    it("Permite guardar como inactivo aunque esté incompleto", async () => {
      const { verifyWorkspaceAction } = await import("@/lib/auth/workspace-context");
      vi.mocked(verifyWorkspaceAction).mockResolvedValueOnce({
        success: true,
        context: {
          isOwner: true,
          isSuperAdmin: false,
          userId: "owner-1",
          businessId,
          businessName: "Burger House",
        } as any,
      });

      const res = await savePaymentMethodAction(businessId, "nequi", {
        isEnabled: false,
        destinationValue: "", // Borrador inactivo
      });

      expect(res.success).toBe(true);
      expect(res.config?.isConfigured).toBe(false);
      expect(res.config?.isEnabled).toBe(false);
    });

    it("Rechaza toggle activar si el método no está previamente configurado", async () => {
      const { verifyWorkspaceAction } = await import("@/lib/auth/workspace-context");
      vi.mocked(verifyWorkspaceAction).mockResolvedValueOnce({
        success: true,
        context: {
          isOwner: true,
          isSuperAdmin: false,
          userId: "owner-1",
          businessId,
          businessName: "Burger House",
        } as any,
      });

      const res = await togglePaymentMethodAction(businessId, "bancolombia", true);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/antes sus datos de cobro obligatorios/i);
    });
  });

  describe("3. Filtrado de métodos públicos para Menú Digital y POS", () => {
    it("Expone solo Efectivo si no hay transferencias activas y completas", async () => {
      paymentMethodsDbRows.current = [];
      const publicMethods = await getPublicBusinessPaymentMethods(businessId);
      // Solo cash está activo y configurado por defecto
      expect(publicMethods.length).toBe(1);
      expect(publicMethods[0].code).toBe("cash");
    });

    it("Expone únicamente Efectivo y las entidades de transferencia que están activas Y completas", async () => {
      paymentMethodsDbRows.current = [
        {
          id: "pm-1",
          business_id: businessId,
          method: "nequi",
          enabled: true,
          configuration: {
            code: "nequi",
            destination_value: "3001234567",
            account_holder: "Juan Pérez",
          },
        },
        {
          id: "pm-2",
          business_id: businessId,
          method: "daviplata",
          enabled: false, // Desactivado
          configuration: {
            code: "daviplata",
            destination_value: "3109876543",
          },
        },
        {
          id: "pm-3",
          business_id: businessId,
          method: "bre_b",
          enabled: true,
          configuration: {
            code: "bre_b",
            bre_b_key_type: "phone",
            destination_value: "3201112233",
            account_holder: "Burger House SAS",
            instructions: "Enviar comprobante por WhatsApp",
          },
        },
      ];

      const publicMethods = await getPublicBusinessPaymentMethods(businessId);
      // cash (siempre activo) + nequi + bre_b (daviplata está desactivado)
      expect(publicMethods.map((m) => m.code)).toEqual(["cash", "nequi", "bre_b"]);
      expect(publicMethods.find((m) => m.code === "daviplata")).toBeUndefined();
    });
  });

  describe("4. Validación en el servidor al crear pedidos en Menú Público", () => {
    it("Rechaza pedidos con método de transferencia deshabilitado o no configurado", async () => {
      paymentMethodsDbRows.current = [
        {
          id: "pm-1",
          business_id: businessId,
          method: "nequi",
          enabled: false,
          configuration: {
            code: "nequi",
            destination_value: "3001234567",
          },
        },
      ];

      const res = await createPublicMenuOrderAction({
        businessId,
        orderType: "takeout",
        customerName: "Carlos Pérez",
        customerPhone: "3001234567",
        paymentMethod: "nequi",
        items: [{ productId: "prod-1", quantity: 1 }],
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/no se encuentra activo o configurado/i);
    });

    it("Acepta pedido con entidad activa y registra el método informativo en las notas sin marcar pagado", async () => {
      paymentMethodsDbRows.current = [
        {
          id: "pm-1",
          business_id: businessId,
          method: "bre_b",
          enabled: true,
          configuration: {
            code: "bre_b",
            bre_b_key_type: "phone",
            destination_value: "3001234567",
            account_holder: "Don Pedro",
          },
        },
      ];

      const { createRestaurantOrder } = await import("@/lib/restaurant/restaurant-service");
      vi.mocked(createRestaurantOrder).mockResolvedValueOnce({
        success: true,
        orderId: "ord-999",
        orderNumber: 25,
        total: 45000,
      });

      const res = await createPublicMenuOrderAction({
        businessId,
        orderType: "takeout",
        customerName: "Carlos Pérez",
        customerPhone: "3001234567",
        paymentMethod: "bre_b",
        notes: "Por favor empacar para llevar",
        items: [{ productId: "prod-1", quantity: 1 }],
      });

      expect(res.success).toBe(true);
      expect(createRestaurantOrder).toHaveBeenCalledWith(
        businessId,
        expect.objectContaining({
          orderType: "takeout",
          notes: expect.stringContaining("Método de pago propuesto: Bre-B"),
        })
      );
    });
  });
});
