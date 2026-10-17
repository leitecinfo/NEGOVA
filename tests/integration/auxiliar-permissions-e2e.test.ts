import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  getUserEffectivePermissionsDetail,
  saveUserCustomPermissions,
  getUserCustomPermissions,
} from "../../src/lib/auth/user-permissions-service";
import { hasPermission } from "../../src/lib/auth/authorization";

describe("NEGOVA — Verificación E2E de Permisos Individuales de Auxiliares", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const businessId = "a8e2612f-4acc-4c84-a420-220131b70d66";
  const otherBusinessId = "00000000-0000-0000-0000-000000000099";
  const ownerId = "e53b803b-8f08-48b7-b833-365908946531";
  const auxiliarAId = "48617c5a-4574-4824-84b1-eb874aaa94bf";
  let auxiliarBId: string;

  let adminClient: any;

  beforeAll(async () => {
    process.env.TEST_AGAINST_REAL_DB = "true";
    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Asegurar rol auxiliar para Auxiliar B en business_users para pruebas
    const { data: auxRole } = await adminClient
      .from("roles")
      .select("id")
      .eq("code", "auxiliar")
      .single();

    // Crear o buscar usuario B en auth.users y public.users
    const { data: existingUserB } = await adminClient
      .from("users")
      .select("id")
      .eq("email", "auxiliar.b.test@negova.com")
      .maybeSingle();

    if (existingUserB) {
      auxiliarBId = existingUserB.id;
    } else {
      const { data: authUserB } = await adminClient.auth.admin.createUser({
        email: "auxiliar.b.test@negova.com",
        password: "TestPasswordAux123!",
        email_confirm: true,
        user_metadata: { full_name: "Auxiliar B Prueba", role: "auxiliar" },
        app_metadata: { role: "auxiliar" },
      });
      auxiliarBId = authUserB.user!.id;
    }

    await adminClient.from("users").upsert({
      id: auxiliarBId,
      email: "auxiliar.b.test@negova.com",
      platform_role: "customer",
      status: "active",
    });

    await adminClient.from("business_users").upsert({
      business_id: businessId,
      user_id: auxiliarBId,
      role_id: auxRole!.id,
      status: "active",
    });

    // Limpiar permisos previos
    await adminClient
      .from("business_user_permissions")
      .delete()
      .eq("business_id", businessId)
      .in("user_id", [auxiliarAId, auxiliarBId]);
  });

  afterAll(async () => {
    // Restaurar limpieza de Auxiliar B
    if (auxiliarBId) {
      await adminClient
        .from("business_user_permissions")
        .delete()
        .eq("business_id", businessId)
        .eq("user_id", auxiliarBId);
      await adminClient
        .from("business_users")
        .delete()
        .eq("business_id", businessId)
        .eq("user_id", auxiliarBId);
      await adminClient
        .from("users")
        .delete()
        .eq("id", auxiliarBId);
      await adminClient.auth.admin.deleteUser(auxiliarBId);
    }
  });

  it("1. Abrir la gestión de permisos: Se muestran los auxiliares y sus permisos", async () => {
    const detail = await getUserEffectivePermissionsDetail(businessId, auxiliarAId);
    expect(detail).toBeDefined();
    expect(detail.roleCode).toBe("auxiliar");
    expect(detail.inheritedPermissions.length).toBeGreaterThan(0);
    expect(detail.moduleBreakdown.length).toBeGreaterThan(0);
    expect(detail.effectivePermissions).toContain("sales.view");
  });

  it("2. Conceder un permiso: Se guarda y aparece concedido al recargar", async () => {
    // Conceder 'expenses.update' (no heredado por auxiliar, pero asignable)
    const saveRes = await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarAId,
      actorUserId: ownerId,
      grantedPermissions: ["expenses.update"],
      revokedPermissions: [],
    });

    expect(saveRes.success).toBe(true);
    expect(saveRes.effectivePermissions).toContain("expenses.update");

    // Recargar desde la BD (simulando recargar pantalla)
    const reloaded = await getUserEffectivePermissionsDetail(businessId, auxiliarAId);
    expect(reloaded.customGrantedPermissions).toContain("expenses.update");
    expect(reloaded.effectivePermissions).toContain("expenses.update");
    
    // Verificar en desglose por módulo
    const expMod = reloaded.moduleBreakdown.find((m) => m.moduleId === "gastos");
    const expUpdate = expMod?.permissions.find((p) => p.code === "expenses.update");
    expect(expUpdate?.status).toBe("custom_granted");
    expect(expUpdate?.isEffective).toBe(true);
  });

  it("3. Revocar un permiso: Se guarda y aparece revocado al recargar", async () => {
    // Revocar 'sales.create' (heredado por auxiliar)
    const saveRes = await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarAId,
      actorUserId: ownerId,
      grantedPermissions: ["expenses.update"],
      revokedPermissions: ["sales.create"],
    });

    expect(saveRes.success).toBe(true);
    expect(saveRes.effectivePermissions).not.toContain("sales.create");

    // Recargar desde la BD
    const reloaded = await getUserEffectivePermissionsDetail(businessId, auxiliarAId);
    expect(reloaded.customRevokedPermissions).toContain("sales.create");
    expect(reloaded.effectivePermissions).not.toContain("sales.create");

    const salesMod = reloaded.moduleBreakdown.find((m) => m.moduleId === "ventas");
    const salesCreate = salesMod?.permissions.find((p) => p.code === "sales.create");
    expect(salesCreate?.status).toBe("custom_revoked");
    expect(salesCreate?.isEffective).toBe(false);
  });

  it("4. Cambiar permisos de dos auxiliares: Cada uno conserva su propia configuración independiente", async () => {
    // Auxiliar A: ya tiene expenses.update concedido y sales.create revocado
    // Auxiliar B: se le concede staff.view y se le revoca orders.create
    const saveBRes = await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarBId,
      actorUserId: ownerId,
      grantedPermissions: ["staff.view"],
      revokedPermissions: ["orders.create"],
    });

    expect(saveBRes.success).toBe(true);

    const detailA = await getUserEffectivePermissionsDetail(businessId, auxiliarAId);
    const detailB = await getUserEffectivePermissionsDetail(businessId, auxiliarBId);

    // Auxiliar A
    expect(detailA.effectivePermissions).toContain("expenses.update");
    expect(detailA.effectivePermissions).not.toContain("sales.create");
    expect(detailA.effectivePermissions).toContain("orders.create"); // No revocado para A
    expect(detailA.effectivePermissions).not.toContain("staff.view"); // No concedido para A

    // Auxiliar B
    expect(detailB.effectivePermissions).not.toContain("expenses.update"); // No concedido para B
    expect(detailB.effectivePermissions).toContain("sales.create"); // No revocado para B
    expect(detailB.effectivePermissions).toContain("staff.view"); // Concedido para B
    expect(detailB.effectivePermissions).not.toContain("orders.create"); // Revocado para B
  });

  it("5. Ejecutar una acción autorizada: El auxiliar puede realizarla en el servidor", async () => {
    // Auxiliar A tiene expenses.update concedido
    const canUpdateExpenses = await hasPermission(auxiliarAId, "expenses.update", {
      scope: "business",
      businessId,
    });
    expect(canUpdateExpenses).toBe(true);

    // Auxiliar A conserva sales.view (heredado no revocado)
    const canViewSales = await hasPermission(auxiliarAId, "sales.view", {
      scope: "business",
      businessId,
    });
    expect(canViewSales).toBe(true);
  });

  it("6. Ejecutar una acción revocada: El servidor la rechaza tajantemente", async () => {
    // Auxiliar A tiene sales.create revocado individualmente
    const canCreateSales = await hasPermission(auxiliarAId, "sales.create", {
      scope: "business",
      businessId,
    });
    expect(canCreateSales).toBe(false);
  });

  it("7. Intentar gestionar otro negocio: Acceso denegado", async () => {
    // Owner intentando modificar permisos en un negocio al que no pertenece
    const res = await saveUserCustomPermissions({
      businessId: otherBusinessId,
      targetUserId: auxiliarAId,
      actorUserId: ownerId,
      grantedPermissions: ["expenses.update"],
      revokedPermissions: [],
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Solo el propietario del negocio");
  });

  it("8. Intentar modificar permisos como auxiliar: Operación rechazada", async () => {
    // Auxiliar intentando modificar permisos de otro auxiliar
    const res = await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarBId,
      actorUserId: auxiliarAId, // Actor es auxiliar
      grantedPermissions: ["inventory.update"],
      revokedPermissions: [],
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Solo el propietario del negocio");
  });

  it("9. Intentar modificar permisos del Owner: Bloqueado", async () => {
    const res = await saveUserCustomPermissions({
      businessId,
      targetUserId: ownerId, // Target es el dueño
      actorUserId: ownerId,
      grantedPermissions: [],
      revokedPermissions: ["sales.create"],
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("No se pueden aplicar restricciones ni modificaciones de permisos al propietario");
  });

  it("10. Intentar conceder permisos administrativos exclusivos de dueño: Bloqueado", async () => {
    const res = await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarAId,
      actorUserId: ownerId,
      grantedPermissions: [
        "business_users.disable",
        "business_settings.update",
        "billing.manage",
      ],
      revokedPermissions: [],
    });

    expect(res.success).toBe(true);
    const detail = await getUserEffectivePermissionsDetail(businessId, auxiliarAId);
    expect(detail.effectivePermissions).not.toContain("business_users.disable");
    expect(detail.effectivePermissions).not.toContain("business_settings.update");
    expect(detail.effectivePermissions).not.toContain("billing.manage");
  });

  afterAll(async () => {
    if (adminClient) {
      await adminClient.from("business_user_permissions").delete().in("user_id", [auxiliarAId, auxiliarBId]);
    }
  });
});
