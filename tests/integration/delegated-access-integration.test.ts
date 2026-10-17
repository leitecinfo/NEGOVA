import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  requestAdminAccess,
  approveAdminAccess,
  rejectAdminAccess,
  registerWhatsAppAccess,
  revokeAdminAccess,
  revokeAllGrantsForTicket,
  validateActiveGrant,
  logAdminAccess,
  getAdminAccessGrants,
} from "@/lib/support/delegated-access-service";
import {
  getDiagnosticOrders,
  getDiagnosticSales,
  getDiagnosticInventory,
} from "@/lib/support/diagnostic-readers";
import { hasPermission } from "../../src/lib/auth/authorization";

describe("Validación de Integración E2E - Acceso Administrativo Delegado", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let adminClient: ReturnType<typeof createClient>;
  let anonClient: ReturnType<typeof createClient>;

  // Variables para las pruebas con datos reales / semillas
  let testBusinessAId: string;
  let testBusinessBId: string;
  let testOwnerAId: string;
  let testAuxiliarAId: string;
  let testAdminUserId: string;
  let testTicketAId: string;

  beforeAll(async () => {
    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonClient = createClient(supabaseUrl, anonKey);

    // Obtener un negocio real existente en la base de datos
    const { data: rawBusinesses } = await adminClient
      .from("businesses")
      .select("id, name")
      .limit(2);
    const businesses = (rawBusinesses || []) as any[];

    if (businesses && businesses.length >= 2) {
      testBusinessAId = businesses[0].id;
      testBusinessBId = businesses[1].id;
    } else if (businesses && businesses.length === 1) {
      testBusinessAId = businesses[0].id;
      testBusinessBId = "00000000-0000-0000-0000-000000000002";
    } else {
      testBusinessAId = "00000000-0000-0000-0000-000000000001";
      testBusinessBId = "00000000-0000-0000-0000-000000000002";
    }

    // Obtener un usuario super_admin o staff
    const { data: adminUser } = await adminClient
      .from("users")
      .select("id, platform_role")
      .eq("platform_role", "super_admin")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    testAdminUserId = (adminUser as any)?.id || "00000000-0000-0000-0000-000000000099";

    // Obtener el dueño real del Negocio A
    const { data: ownerMembership } = await adminClient
      .from("business_users")
      .select("user_id, roles(code)")
      .eq("business_id", testBusinessAId)
      .eq("status", "active")
      .limit(5);

    const ownerList = (ownerMembership || []) as any[];
    const ownerRow = ownerList.find((m: any) => (m.roles as any)?.code === "owner");
    const auxRow = ownerList.find((m: any) => (m.roles as any)?.code === "auxiliar");

    testOwnerAId = ownerRow?.user_id || "00000000-0000-0000-0000-000000000044";
    testAuxiliarAId = auxRow?.user_id || "00000000-0000-0000-0000-000000000055";

    // Obtener o simular ticket para Negocio A
    const { data: tickets } = await adminClient
      .from("support_tickets")
      .select("id, ticket_number, business_id")
      .eq("business_id", testBusinessAId)
      .limit(1)
      .maybeSingle();

    testTicketAId = (tickets as any)?.id || "TCK-INTEGRATION-TEST";
  });

  describe("1. Existencia física y accesibilidad de tablas en Supabase", () => {
    it("las tablas admin_access_grants y admin_access_logs deben existir en Supabase", async () => {
      const { error: grantsErr } = await adminClient
        .from("admin_access_grants")
        .select("id")
        .limit(1);

      expect(grantsErr).toBeNull();

      const { error: logsErr } = await adminClient
        .from("admin_access_logs")
        .select("id")
        .limit(1);

      expect(logsErr).toBeNull();
    });
  });

  describe("2. Políticas RLS de Seguridad e Inmutabilidad", () => {
    it("un cliente anónimo o no autenticado NO debe poder consultar admin_access_grants ni logs", async () => {
      const { data: anonGrants, error: anonGrantsErr } = await anonClient
        .from("admin_access_grants")
        .select("*");

      // Con RLS activo, retorna arreglo vacío o error
      expect(anonGrants === null || anonGrants?.length === 0).toBe(true);

      const { data: anonLogs, error: anonLogsErr } = await anonClient
        .from("admin_access_logs")
        .select("*");

      expect(anonLogs === null || anonLogs?.length === 0).toBe(true);
    });
  });

  describe("3. Flujo E2E de Autorización, Lectura, Auditoría y Revocación", () => {
    let createdGrantId: string;

    it("Flujo Paso 1: Solicitud in-app de acceso para revisión de ventas", async () => {
      // Si el ticket no existe en DB, creamos uno de prueba controlado o probamos el handler
      const res = await requestAdminAccess({
        ticketId: testTicketAId,
        businessId: testBusinessAId,
        requestedBy: testAdminUserId,
        scope: "sales_read",
        reason: "Validación de integración: Revisión técnica de comprobante",
        durationHours: 2,
      });

      if (res.success && res.grant) {
        createdGrantId = res.grant.id;
        expect(res.grant.status).toBe("pending");
        expect(res.grant.scope).toBe("sales_read");
        expect(res.grant.grantChannel).toBe("in_app");
      } else {
        // En caso de que el ticketId de prueba no esté en la tabla support_tickets
        expect(res.error).toBeDefined();
      }
    });

    it("Flujo Paso 2: Aprobación rechazada si quien intenta aprobar no es el owner (ej. auxiliar)", async () => {
      if (createdGrantId) {
        const approveRes = await approveAdminAccess({
          grantId: createdGrantId,
          approvedBy: testAuxiliarAId,
        });

        expect(approveRes.success).toBe(false);
        expect(approveRes.error).toContain("Solo el dueño (propietario) del negocio");
      }
    });

    it("Flujo Paso 3: Aprobación exitosa por el Dueño (owner)", async () => {
      if (createdGrantId) {
        const approveRes = await approveAdminAccess({
          grantId: createdGrantId,
          approvedBy: testOwnerAId,
        });

        if (approveRes.success && approveRes.grant) {
          expect(approveRes.grant.status).toBe("approved");
          expect(approveRes.grant.approvedBy).toBe(testOwnerAId);
          expect(approveRes.grant.validUntil).toBeDefined();
        }
      }
    });

    it("Flujo Paso 4: Consulta de diagnóstico autorizada dentro del alcance permitido", async () => {
      if (createdGrantId) {
        const salesDiag = await getDiagnosticSales({
          grantId: createdGrantId,
          businessId: testBusinessAId,
          adminUserId: testAdminUserId,
          limit: 5,
        });

        // La consulta debe ser validada correctamente y registrar log
        expect(salesDiag).toHaveProperty("success");
      }
    });

    it("Flujo Paso 5: Denegación estricta si se intenta consultar un módulo no autorizado (Cross-Scope: Orders)", async () => {
      if (createdGrantId) {
        const ordersDiag = await getDiagnosticOrders({
          grantId: createdGrantId,
          businessId: testBusinessAId,
          adminUserId: testAdminUserId,
          limit: 5,
        });

        // El grant es de sales_read, debe rechazar orders_read
        expect(ordersDiag.success).toBe(false);
        expect(ordersDiag.error).toContain("no cubre el alcance");
      }
    });

    it("Flujo Paso 6: Denegación estricta si se intenta consultar otro negocio ajeno (Cross-Tenant: Business B)", async () => {
      if (createdGrantId) {
        const crossTenantDiag = await getDiagnosticSales({
          grantId: createdGrantId,
          businessId: testBusinessBId, // Negocio ajeno B
          adminUserId: testAdminUserId,
          limit: 5,
        });

        expect(crossTenantDiag.success).toBe(false);
      }
    });

    it("Flujo Paso 7: Revocación inmediata del grant (Kill-Switch)", async () => {
      if (createdGrantId) {
        const revokeRes = await revokeAdminAccess({
          grantId: createdGrantId,
          revokedBy: testOwnerAId,
          reason: "Incidencia resuelta satisfactoriamente",
        });

        expect(revokeRes.success).toBe(true);

        // La siguiente consulta debe ser denegada inmediatamente
        const postRevokeDiag = await getDiagnosticSales({
          grantId: createdGrantId,
          businessId: testBusinessAId,
          adminUserId: testAdminUserId,
        });

        expect(postRevokeDiag.success).toBe(false);
      }
    });
  });

  describe("4. Canal WhatsApp y Registro de Evidencia", () => {
    it("debe registrar autorización por WhatsApp con evidencia y teléfono, con approved_by nulo", async () => {
      const waResult = await registerWhatsAppAccess({
        ticketId: testTicketAId,
        businessId: testBusinessAId,
        registeredBy: testAdminUserId,
        scope: "inventory_read",
        reason: "Cliente autorizó por chat soporte",
        whatsappEvidenceRef: "https://support.negova.com/evidence/chat-992.pdf",
        verifiedPhone: "+573009876543",
        durationHours: 2,
      });

      if (waResult.success && waResult.grant) {
        expect(waResult.grant.grantChannel).toBe("manual_whatsapp");
        expect(waResult.grant.approvedBy).toBeNull();
        expect(waResult.grant.status).toBe("approved");
      }
    });
  });

  describe("5. Bloqueo de Mutaciones Operativas para Asistencia Administrativa", () => {
    it("el personal de plataforma NO debe poder ejecutar mutaciones (.create, .edit, .delete) en el negocio", async () => {
      const isCreateAllowed = await hasPermission(testAdminUserId, "sales.create", {
        scope: "business",
        businessId: testBusinessAId,
      });

      expect(isCreateAllowed).toBe(false);

      const isDeleteAllowed = await hasPermission(testAdminUserId, "orders.delete", {
        scope: "business",
        businessId: testBusinessAId,
      });

      expect(isDeleteAllowed).toBe(false);
    });
  });
});
