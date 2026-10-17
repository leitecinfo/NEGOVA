import { describe, it, expect, beforeEach } from "vitest";
import {
  getUserEffectivePermissionsDetail,
  saveUserCustomPermissions,
} from "../../src/lib/auth/user-permissions-service";
import { hasPermission } from "../../src/lib/auth/authorization";
import {
  isPermissionAssignableToAuxiliar,
  getDefaultPermissionsForRoleAndBusinessType,
} from "../../src/lib/auth/permissions";

describe("NEGOVA — Permisos Individuales por Trabajador / Auxiliar", () => {
  const businessId = "biz-restaurant-001";
  const ownerUserId = "user-owner-001";
  const auxiliarAId = "user-auxiliar-a";
  const auxiliarBId = "user-auxiliar-b";

  beforeEach(async () => {
    // Restaurar permisos base
    await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarAId,
      actorUserId: ownerUserId,
      grantedPermissions: [],
      revokedPermissions: [],
    });

    await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarBId,
      actorUserId: ownerUserId,
      grantedPermissions: [],
      revokedPermissions: [],
    });
  });

  it("1. Dos auxiliares del mismo negocio pueden tener permisos diferentes", async () => {
    // Auxiliar A: se le otorga adicionalmente 'expenses.update' (modificar gastos)
    // Auxiliar B: se le revoca 'sales.update' (solo puede registrar, no modificar ventas)
    const resA = await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarAId,
      actorUserId: ownerUserId,
      grantedPermissions: ["expenses.update"],
      revokedPermissions: [],
    });

    const resB = await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarBId,
      actorUserId: ownerUserId,
      grantedPermissions: [],
      revokedPermissions: ["sales.update"],
    });

    expect(resA.success).toBe(true);
    expect(resB.success).toBe(true);

    const detailA = await getUserEffectivePermissionsDetail(businessId, auxiliarAId);
    const detailB = await getUserEffectivePermissionsDetail(businessId, auxiliarBId);

    // Auxiliar A tiene permisos adicionales de modificar gastos
    expect(detailA.effectivePermissions).toContain("expenses.update");
    expect(detailA.customGrantedPermissions).toContain("expenses.update");
    expect(detailA.effectivePermissions).toContain("sales.update");

    // Auxiliar B NO tiene expenses.update y tiene revocado sales.update
    expect(detailB.effectivePermissions).not.toContain("expenses.update");
    expect(detailB.effectivePermissions).not.toContain("sales.update");
    expect(detailB.customRevokedPermissions).toContain("sales.update");
    expect(detailB.customGrantedPermissions).toHaveLength(0);
  });

  it("2. Modificar los permisos de un auxiliar no altera los permisos del otro", async () => {
    // Auxiliar A recibe el permiso adicional 'expenses.update' (modificar gastos)
    await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarAId,
      actorUserId: ownerUserId,
      grantedPermissions: ["expenses.update"],
      revokedPermissions: [],
    });

    const detailA = await getUserEffectivePermissionsDetail(businessId, auxiliarAId);
    const detailB = await getUserEffectivePermissionsDetail(businessId, auxiliarBId);

    // Auxiliar A tiene expenses.update pero Auxiliar B NO lo tiene (mantiene sus permisos base)
    expect(detailA.effectivePermissions).toContain("expenses.update");
    expect(detailB.effectivePermissions).not.toContain("expenses.update");
  });

  it("3. Un auxiliar NO puede recibir permisos exclusivos de Dueño ni de Plataforma", async () => {
    const res = await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarAId,
      actorUserId: ownerUserId,
      grantedPermissions: [
        "business_settings.update", // Exclusivo Owner
        "business_users.disable",   // Exclusivo Owner
        "billing.manage",           // Plataforma
      ],
      revokedPermissions: [],
    });

    expect(res.success).toBe(true);
    const detailA = await getUserEffectivePermissionsDetail(businessId, auxiliarAId);

    expect(detailA.effectivePermissions).not.toContain("business_settings.update");
    expect(detailA.effectivePermissions).not.toContain("business_users.disable");
    expect(detailA.effectivePermissions).not.toContain("billing.manage");
  });

  it("4. Los permisos incompatibles con el vertical de negocio permanecen bloqueados", async () => {
    const barberBusinessId = "biz-barber-999";
    const barberAuxiliarId = "user-barber-aux";

    // En una barbería, las comandas/pedidos gastronómicos son incompatibles
    expect(isPermissionAssignableToAuxiliar("orders.create", "barber")).toBe(false);
  });

  it("5. Un auxiliar no puede modificar sus propios permisos ni los de otros", async () => {
    const res = await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarBId,
      actorUserId: auxiliarAId, // Actor es un auxiliar, no el dueño
      grantedPermissions: ["expenses.create"],
      revokedPermissions: [],
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Solo el propietario del negocio");
  });

  it("6. No se puede modificar ni restringir los permisos del Propietario (Owner)", async () => {
    const res = await saveUserCustomPermissions({
      businessId,
      targetUserId: ownerUserId, // Destino es el owner
      actorUserId: ownerUserId,
      grantedPermissions: [],
      revokedPermissions: ["sales.create"],
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("No se pueden aplicar restricciones");
  });

  it("7. Un Administrador de Plataforma (Admin) puede gestionar permisos individuales de un auxiliar", async () => {
    const platformAdminId = "user-platform-admin-001";

    const res = await saveUserCustomPermissions({
      businessId,
      targetUserId: auxiliarAId,
      actorUserId: platformAdminId,
      grantedPermissions: ["expenses.create", "inventory.create"],
      revokedPermissions: [],
      isPlatformAdmin: true,
    });

    expect(res.success).toBe(true);

    const detailA = await getUserEffectivePermissionsDetail(businessId, auxiliarAId);
    expect(detailA.effectivePermissions).toContain("expenses.create");
    expect(detailA.effectivePermissions).toContain("inventory.create");
  });

  it("8. Un Administrador de Plataforma NO puede modificar sus propios permisos ni escalar privilegios", async () => {
    const platformAdminId = "user-platform-admin-001";

    // Intentar modificarse a sí mismo a través del servicio
    const res = await saveUserCustomPermissions({
      businessId,
      targetUserId: platformAdminId,
      actorUserId: platformAdminId,
      grantedPermissions: ["billing.manage"],
      revokedPermissions: [],
      isPlatformAdmin: true,
    });

    expect(res.success).toBe(false);
  });
});
