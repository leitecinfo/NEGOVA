import { describe, it, expect } from "vitest";
import { verifyWorkspaceAction } from "../../src/lib/auth/workspace-context";
import { hasPermission } from "../../src/lib/auth/authorization";

describe("Workspace Multi-Tenant Security & RBAC Guard", () => {
  const REAL_BUSINESS_ID = "a8e2612f-4acc-4c84-a420-220131b70d66";
  const OTHER_BUSINESS_ID = "00000000-0000-0000-0000-000000000999";
  const OWNER_USER_ID = "e53b803b-8f08-48b7-b833-365908946531"; // Eva Maria Lopez Mejia (Dueña canónica de Comida Rápida AA Gourmet)
  const UNPRIVILEGED_USER_ID = "00000000-0000-0000-0000-000000000099";

  it("debe rechazar acceso si businessId es inválido o malformado", async () => {
    const res = await verifyWorkspaceAction("not-a-uuid");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/inválido/i);
  });

  it("debe rechazar invocación en entorno no autenticado", async () => {
    // Sin cookies de sesión activa
    const res = await verifyWorkspaceAction(REAL_BUSINESS_ID);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/autenticada|iniciar sesión/i);
  });

  it("owner debe poseer permiso de business_settings.view y business_settings.update", async () => {
    const canView = await hasPermission(OWNER_USER_ID, "business_settings.view", {
      scope: "business",
      businessId: REAL_BUSINESS_ID,
    });
    const canUpdate = await hasPermission(OWNER_USER_ID, "business_settings.update", {
      scope: "business",
      businessId: REAL_BUSINESS_ID,
    });

    expect(canView).toBe(true);
    expect(canUpdate).toBe(true);
  });

  it("owner del negocio A NO debe tener permisos sobre un negocio B ajeno", async () => {
    const canViewB = await hasPermission(OWNER_USER_ID, "business_settings.view", {
      scope: "business",
      businessId: OTHER_BUSINESS_ID,
    });
    const canUpdateB = await hasPermission(OWNER_USER_ID, "business_settings.update", {
      scope: "business",
      businessId: OTHER_BUSINESS_ID,
    });

    expect(canViewB).toBe(false);
    expect(canUpdateB).toBe(false);
  });

  it("usuario sin membresía en el negocio debe ser denegado terminantemente", async () => {
    const canView = await hasPermission(UNPRIVILEGED_USER_ID, "business_settings.view", {
      scope: "business",
      businessId: REAL_BUSINESS_ID,
    });
    const canUpdate = await hasPermission(UNPRIVILEGED_USER_ID, "business_settings.update", {
      scope: "business",
      businessId: REAL_BUSINESS_ID,
    });

    expect(canView).toBe(false);
    expect(canUpdate).toBe(false);
  });

  it("owner y roles con ventas deben tener permiso sales.view para el Dashboard", async () => {
    const canViewSales = await hasPermission(OWNER_USER_ID, "sales.view", {
      scope: "business",
      businessId: REAL_BUSINESS_ID,
    });
    expect(canViewSales).toBe(true);
  });

  it("getUserActiveBusinessId debe resolver el negocio activo del usuario", async () => {
    const { getUserActiveBusinessId } = await import("@/lib/auth/workspace-context");

    const bizId = await getUserActiveBusinessId(OWNER_USER_ID);
    expect(bizId).toBe(REAL_BUSINESS_ID);

    const nonMemberBiz = await getUserActiveBusinessId(UNPRIVILEGED_USER_ID);
    expect(nonMemberBiz).toBeNull();

    const invalidBiz = await getUserActiveBusinessId("not-a-uuid");
    expect(invalidBiz).toBeNull();
  });
});
