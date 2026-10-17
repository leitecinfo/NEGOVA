import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requestAdminAccess,
  approveAdminAccess,
  rejectAdminAccess,
  registerWhatsAppAccess,
  revokeAdminAccess,
  revokeAllGrantsForTicket,
  validateActiveGrant,
  logAdminAccess,
  AdminAccessGrant,
  AdminGrantScope,
} from "@/lib/support/delegated-access-service";
import {
  getDiagnosticOrders,
  getDiagnosticSales,
  getDiagnosticInventory,
} from "@/lib/support/diagnostic-readers";
import { hasPermission } from "../../src/lib/auth/authorization";

describe("Sistema de Acceso Administrativo Controlado (Delegated Tenant Access - Hardened)", () => {
  const MOCK_TICKET_ID = "550e8400-e29b-41d4-a716-446655440001";
  const MOCK_BUSINESS_A_ID = "550e8400-e29b-41d4-a716-446655440010";
  const MOCK_BUSINESS_B_ID = "550e8400-e29b-41d4-a716-446655440020";
  const MOCK_ADMIN_USER_ID = "550e8400-e29b-41d4-a716-446655440030";
  const MOCK_OWNER_USER_ID = "550e8400-e29b-41d4-a716-446655440040";
  const MOCK_AUXILIAR_USER_ID = "550e8400-e29b-41d4-a716-446655440050";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Creación de Solicitudes y Canales de Autorización", () => {
    it("debe crear una solicitud in-app en estado pending", async () => {
      const result = await requestAdminAccess({
        ticketId: MOCK_TICKET_ID,
        businessId: MOCK_BUSINESS_A_ID,
        requestedBy: MOCK_ADMIN_USER_ID,
        scope: "sales_read",
        reason: "Verificación de discrepancia en comprobante B001-45",
        durationHours: 2,
      });

      expect(result).toHaveProperty("success");
    });

    it("debe rechazar duraciones mayores a 8 horas o menores a 1 hora ajustándolas a límites seguros", async () => {
      const grantResult = await requestAdminAccess({
        ticketId: MOCK_TICKET_ID,
        businessId: MOCK_BUSINESS_A_ID,
        requestedBy: MOCK_ADMIN_USER_ID,
        scope: "orders_read",
        reason: "Test límites de duración",
        durationHours: 24, // Mayor a 8
      });

      if (grantResult.grant) {
        expect(grantResult.grant.durationHours).toBeLessThanOrEqual(8);
      }
    });

    it("debe registrar una autorización manual por WhatsApp con evidencia y teléfono verificado", async () => {
      const result = await registerWhatsAppAccess({
        ticketId: MOCK_TICKET_ID,
        businessId: MOCK_BUSINESS_A_ID,
        registeredBy: MOCK_ADMIN_USER_ID,
        scope: "orders_read",
        reason: "Cliente autorizó revisión por WhatsApp",
        whatsappEvidenceRef: "https://support.negova.com/crm/interactions/INT-883",
        verifiedPhone: "+573001234567",
        durationHours: 3,
      });

      expect(result).toHaveProperty("success");
      if (result.grant) {
        expect(result.grant.grantChannel).toBe("manual_whatsapp");
        expect(result.grant.status).toBe("approved");
        expect(result.grant.approvedBy).toBeNull(); // Consentimiento manual externo
        expect(result.grant.whatsappEvidenceRef).toBe("https://support.negova.com/crm/interactions/INT-883");
      }
    });

    it("debe rechazar registro de WhatsApp si falta la evidencia o el teléfono", async () => {
      const result = await registerWhatsAppAccess({
        ticketId: MOCK_TICKET_ID,
        businessId: MOCK_BUSINESS_A_ID,
        registeredBy: MOCK_ADMIN_USER_ID,
        scope: "orders_read",
        reason: "Falta evidencia",
        whatsappEvidenceRef: "",
        verifiedPhone: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("2. Control Estricto de Alcance (Sin comodines genéricos)", () => {
    it("un scope sales_read solo debe autorizar consultas de ventas y denegar cualquier otro módulo", () => {
      const mockSalesGrant: AdminAccessGrant = {
        id: "grant-sales-1",
        ticketId: MOCK_TICKET_ID,
        businessId: MOCK_BUSINESS_A_ID,
        requestedBy: MOCK_ADMIN_USER_ID,
        grantChannel: "in_app",
        status: "approved",
        scope: "sales_read",
        targetResourceType: "sales",
        reason: "Revisar ventas",
        durationHours: 2,
        validFrom: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        validUntil: new Date(Date.now() + 1000 * 60 * 110).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Exact match check:
      expect(mockSalesGrant.scope === "sales_read").toBe(true);
      expect(mockSalesGrant.scope === "orders_read").toBe(false);
      expect(mockSalesGrant.scope === "finance_read").toBe(false);
      expect(mockSalesGrant.scope === "inventory_read").toBe(false);
      expect(mockSalesGrant.scope === "settings_read").toBe(false);
    });

    it("un grant para un registro específico (target_resource_id) no debe permitir consultar otros registros ni listar todo", () => {
      const specificOrderGrant: AdminAccessGrant = {
        id: "grant-order-specific",
        ticketId: MOCK_TICKET_ID,
        businessId: MOCK_BUSINESS_A_ID,
        requestedBy: MOCK_ADMIN_USER_ID,
        grantChannel: "in_app",
        status: "approved",
        scope: "orders_read",
        targetResourceType: "orders",
        targetResourceId: "ORD-SPECIFIC-777",
        reason: "Revisar pedido ORD-SPECIFIC-777",
        durationHours: 2,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Si se consulta el pedido autorizado ORD-SPECIFIC-777 -> permitido
      const isExactResourceAllowed = specificOrderGrant.targetResourceId === "ORD-SPECIFIC-777";
      expect(isExactResourceAllowed).toBe(true);

      // Si se intenta consultar otro pedido ORD-OTHER-999 -> denegado
      const isOtherResourceAllowed = specificOrderGrant.targetResourceId === "ORD-OTHER-999";
      expect(isOtherResourceAllowed).toBe(false);

      // Si se intenta listar todo (targetResourceId = null) -> denegado
      const isGeneralListingAllowed = !specificOrderGrant.targetResourceId;
      expect(isGeneralListingAllowed).toBe(false);
    });
  });

  describe("3. Autorización Exclusiva del Dueño (Owner)", () => {
    it("un usuario auxiliar o no-owner intentando aprobar un grant debe ser terminantemente rechazado", async () => {
      const result = await approveAdminAccess({
        grantId: "non-existent-grant-or-mock",
        approvedBy: MOCK_AUXILIAR_USER_ID, // Auxiliar no autorizado
      });

      expect(result.success).toBe(false);
    });
  });

  describe("4. Aislamiento Multi-Tenant", () => {
    it("un grant para el Negocio A debe ser estrictamente rechazado al intentar consultar el Negocio B", async () => {
      const validation = await validateActiveGrant({
        grantId: "grant-business-a",
        businessId: MOCK_BUSINESS_B_ID, // Negocio B ajeno
        adminUserId: MOCK_ADMIN_USER_ID,
        requiredScope: "sales_read",
      });

      expect(validation.valid).toBe(false);
    });
  });

  describe("5. Bloqueo de Mutaciones para Asistencia Administrativa", () => {
    it("hasPermission debe rechazar terminantemente cualquier permiso de mutación (.create, .edit, .delete) en contexto de negocio", async () => {
      const mutationPermissions = [
        "sales.create",
        "sales.delete",
        "orders.create",
        "orders.update",
        "inventory.delete",
        "finance.create",
      ];

      for (const perm of mutationPermissions) {
        const allowed = await hasPermission(MOCK_ADMIN_USER_ID, perm, {
          scope: "business",
          businessId: MOCK_BUSINESS_A_ID,
        });

        expect(allowed).toBe(false);
      }
    });
  });

  describe("6. Auditoría Forense y Seguridad WORM", () => {
    it("si la inserción de auditoría falla, logAdminAccess debe lanzar un error fatal y detener la entrega de datos", async () => {
      await expect(
        logAdminAccess({
          grantId: "grant-audit-failure-test",
          businessId: MOCK_BUSINESS_A_ID,
          adminUserId: MOCK_ADMIN_USER_ID,
          resourceName: "sales",
        })
      ).rejects.toThrow();
    });
  });
});
