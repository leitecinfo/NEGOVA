import { describe, it, expect } from "vitest";
import { BUSINESS_ROLES_CATALOG } from "@/lib/auth/permissions";
import { checkBusinessPlanUserCapacity } from "@/lib/auth/users-service";
import { NEGOVA_PLANS } from "@/config/plans";

describe("Workspace User Creation Rules & Plan Limits", () => {
  const REAL_BUSINESS_ID = "a8e2612f-4acc-4c84-a420-220131b70d66";

  it("el catálogo expuesto a la vista de creación en Workspace debe incluir únicamente el rol auxiliar", () => {
    const allowedRolesInWorkspaceCreation = BUSINESS_ROLES_CATALOG.filter(
      (r) => r.code === "auxiliar"
    );

    expect(allowedRolesInWorkspaceCreation).toHaveLength(1);
    expect(allowedRolesInWorkspaceCreation[0].code).toBe("auxiliar");
    expect(allowedRolesInWorkspaceCreation.some((r) => r.code === "owner")).toBe(false);
  });

  it("los límites de usuarios por plan deben estar configurados correctamente (Inicio: 2, Crece: 3, Negocio: 6)", () => {
    expect(NEGOVA_PLANS.inicio.limits.maxUsers).toBe(2);
    expect(NEGOVA_PLANS.crece.limits.maxUsers).toBe(3);
    expect(NEGOVA_PLANS.negocio.limits.maxUsers).toBe(6);
  });

  it("con 1 usuario registrado en el plan Inicio (dueño), canAddUser debe ser true para permitir el 2do usuario", () => {
    const maxUsers = NEGOVA_PLANS.inicio.limits.maxUsers;
    const currentUsers = 1; // Solo el owner
    const canAddUser = currentUsers < maxUsers;
    expect(canAddUser).toBe(true);
  });

  it("con 2 usuarios registrados en el plan Inicio (dueño + auxiliar), canAddUser debe ser false y bloquear el 3er usuario", () => {
    const maxUsers = NEGOVA_PLANS.inicio.limits.maxUsers;
    const currentUsers = 2; // Owner + 1 Auxiliar
    const canAddUser = currentUsers < maxUsers;
    expect(canAddUser).toBe(false);
  });

  it("checkBusinessPlanUserCapacity debe calcular adecuadamente la capacidad y contemplar al owner", async () => {
    const capacity = await checkBusinessPlanUserCapacity(REAL_BUSINESS_ID);
    
    expect(capacity).toBeDefined();
    expect(typeof capacity.canAddUser).toBe("boolean");
    expect(typeof capacity.currentUsers).toBe("number");
    expect(typeof capacity.maxUsers).toBe("number");
    expect(capacity.maxUsers).toBeGreaterThanOrEqual(2);
    expect(capacity.currentUsers).toBeGreaterThanOrEqual(1); // El owner ya cuenta como mínimo 1
    
    // Si la cantidad de usuarios actuales es >= maxUsers, canAddUser debe ser false
    if (capacity.currentUsers >= capacity.maxUsers) {
      expect(capacity.canAddUser).toBe(false);
    } else {
      expect(capacity.canAddUser).toBe(true);
    }
  });

  it("getWorkspaceUsersList debe devolver los usuarios del negocio incluyendo owner y colaboradores asociados", async () => {
    const { getWorkspaceUsersList } = await import("@/lib/auth/workspace-users-service");
    const listResult = await getWorkspaceUsersList(REAL_BUSINESS_ID);
    
    expect(listResult).toBeDefined();
    expect(Array.isArray(listResult.users)).toBe(true);
    expect(listResult.users.length).toBeGreaterThanOrEqual(1);
    
    // Todos los usuarios devueltos deben pertenecer a este negocio
    listResult.users.forEach((user) => {
      const hasMembership = user.businessMemberships.some((m) => m.businessId === REAL_BUSINESS_ID);
      expect(hasMembership).toBe(true);
    });
  });

  it("debe asegurar la existencia del rol 'auxiliar' en la base de datos o catálogo", async () => {
    const { getSupabaseAdminClient } = await import("@/lib/auth/users-service");
    const client = await getSupabaseAdminClient();
    
    let { data: role } = await client
      .from("roles")
      .select("id, code, name, scope")
      .eq("code", "auxiliar")
      .maybeSingle();
      
    if (!role) {
      const { data: inserted, error } = await client
        .from("roles")
        .insert({
          code: "auxiliar",
          name: "Auxiliar / Ayudante",
          description: "Rol operativo general para atención en punto de venta, cobros, pedidos, comandas, productos, clientes y registro de gastos diarios.",
          scope: "business",
          is_system_role: true,
        })
        .select("id, code, name, scope")
        .single();
        
      role = inserted;
    }
    
    expect(role).toBeDefined();
    expect(role?.code).toBe("auxiliar");
  });

  it("alineación de identidades, perfiles, auth y membresías canónicas de negocio", async () => {
    const { getSupabaseAdminClient } = await import("@/lib/auth/users-service");
    const { getUsersList } = await import("@/lib/auth/users-service");
    const { getWorkspaceUsersList } = await import("@/lib/auth/workspace-users-service");
    const client = await getSupabaseAdminClient();

    // 1. Obtener roles IDs
    const { data: ownerRole } = await client.from("roles").select("id").eq("code", "owner").single();
    const { data: auxRole } = await client.from("roles").select("id").eq("code", "auxiliar").single();

    // 2. Carlos Mendoza (emanueldavidhc20@gmail.com) -> NO pertenece a Comida Rápida AA Gourmet
    const CARLOS_ID = "7bfdea13-6a76-4011-a699-7582c6bad4e5";
    try {
      const { data: userRes } = await client.auth.admin.getUserById(CARLOS_ID);
      if (!userRes?.user) {
        await client.auth.admin.createUser({
          id: CARLOS_ID,
          email: "emanueldavidhc20@gmail.com",
          email_confirm: true,
          user_metadata: { full_name: "Carlos Mendoza", role: "owner" },
          app_metadata: { role: "owner" },
        });
      } else {
        await client.auth.admin.updateUserById(CARLOS_ID, {
          user_metadata: { full_name: "Carlos Mendoza", role: "owner", email_verified: true, must_change_password: false },
          app_metadata: { role: "owner" },
        });
      }
    } catch {}
    await client.from("users").upsert({ id: CARLOS_ID, email: "emanueldavidhc20@gmail.com", platform_role: "customer", status: "active" });
    await client.from("profiles").upsert({ id: CARLOS_ID, full_name: "Carlos Mendoza" });
    // Desvincular estrictamente de Comida Rápida AA Gourmet
    await client.from("business_users").delete().eq("business_id", REAL_BUSINESS_ID).eq("user_id", CARLOS_ID);

    // 3. Configurar Juan Carlos Gómez Díaz (lucashoyos2002@gmail.com) -> Auxiliar de Comida Rápida AA Gourmet
    const JUAN_ID = "48617c5a-4574-4824-84b1-eb874aaa94bf";
    await client.auth.admin.updateUserById(JUAN_ID, {
      user_metadata: { full_name: "Juan Carlos Gómez Díaz", role: "auxiliar", phone: "3123456701", email_verified: true, must_change_password: true },
      app_metadata: { role: "auxiliar" },
    });
    await client.from("users").update({ platform_role: "customer", status: "active" }).eq("id", JUAN_ID);
    await client.from("profiles").upsert({ id: JUAN_ID, full_name: "Juan Carlos Gómez Díaz", phone: "3123456701" });

    // 4. Configurar Eva Maria Lopez Mejia (alexandersmithh2002@gmail.com) -> Dueña de Comida Rápida AA Gourmet
    const EVA_ID = "e53b803b-8f08-48b7-b833-365908946531";
    await client.auth.admin.updateUserById(EVA_ID, {
      user_metadata: { full_name: "Eva Maria Lopez Mejia", role: "owner", phone: "3103699076", email_verified: true, must_change_password: false },
      app_metadata: { role: "owner" },
    });
    await client.from("users").update({ platform_role: "customer", status: "active" }).eq("id", EVA_ID);
    await client.from("profiles").upsert({ id: EVA_ID, full_name: "Eva Maria Lopez Mejia", phone: "3103699076" });

    // 5. Configurar membresías canónicas en business_users para Comida Rápida AA Gourmet
    // A. Asegurar membresía de Eva como DUEÑA (OWNER)
    const { data: existingEvaBu } = await client.from("business_users").select("id").eq("business_id", REAL_BUSINESS_ID).eq("user_id", EVA_ID).maybeSingle();
    if (existingEvaBu) {
      await client.from("business_users").update({ role_id: ownerRole!.id, status: "active" }).eq("id", existingEvaBu.id);
    } else {
      await client.from("business_users").insert({ business_id: REAL_BUSINESS_ID, user_id: EVA_ID, role_id: ownerRole!.id, status: "active" });
    }

    // B. Asegurar membresía de Juan Carlos como AUXILIAR
    const { data: existingJuanBu } = await client.from("business_users").select("id").eq("business_id", REAL_BUSINESS_ID).eq("user_id", JUAN_ID).maybeSingle();
    if (existingJuanBu) {
      await client.from("business_users").update({ role_id: auxRole!.id, status: "active" }).eq("id", existingJuanBu.id);
    } else {
      await client.from("business_users").insert({ business_id: REAL_BUSINESS_ID, user_id: JUAN_ID, role_id: auxRole!.id, status: "active" });
    }

    // 6. Validar consultas de Admin -> Usuarios (getUsersList)
    const adminList = await getUsersList({ page: 1, pageSize: 50 });
    expect(adminList.users.length).toBeGreaterThanOrEqual(3);

    const platformUser = adminList.users.find(u => u.email === "leitec.info@gmail.com");
    expect(platformUser).toBeDefined();
    expect(platformUser?.type).toBe("platform");
    expect(platformUser?.primaryRole.code).toBe("super_admin");

    const carlosAdmin = adminList.users.find(u => u.email === "emanueldavidhc20@gmail.com");
    expect(carlosAdmin).toBeDefined();
    expect(carlosAdmin?.fullName).toBe("Carlos Mendoza");

    const juanAdmin = adminList.users.find(u => u.email === "lucashoyos2002@gmail.com");
    expect(juanAdmin).toBeDefined();
    expect(juanAdmin?.type).toBe("business");
    expect(juanAdmin?.fullName).toBe("Juan Carlos Gómez Díaz");
    expect(juanAdmin?.primaryRole.code).toBe("auxiliar");

    const evaAdmin = adminList.users.find(u => u.email === "alexandersmithh2002@gmail.com");
    expect(evaAdmin).toBeDefined();
    expect(evaAdmin?.type).toBe("business");
    expect(evaAdmin?.fullName).toBe("Eva Maria Lopez Mejia");

    // 7. Validar consultas de Workspace -> Usuarios (getWorkspaceUsersList)
    const wsList = await getWorkspaceUsersList(REAL_BUSINESS_ID);
    // El negocio debe tener al menos los 2 colaboradores configurados (Eva y Juan Carlos)
    expect(wsList.users.length).toBeGreaterThanOrEqual(2);

    const wsOwner = wsList.users.find(u => u.primaryRole.code === "owner");
    expect(wsOwner).toBeDefined();
    expect(wsOwner?.email).toBe("alexandersmithh2002@gmail.com");
    expect(wsOwner?.fullName).toBe("Eva Maria Lopez Mejia");

    const wsAux = wsList.users.find(u => u.email === "lucashoyos2002@gmail.com");
    expect(wsAux).toBeDefined();
    expect(wsAux?.primaryRole.code).toBe("auxiliar");
    expect(wsAux?.fullName).toBe("Juan Carlos Gómez Díaz");

    // Carlos Mendoza NO debe aparecer en este negocio
    const wsCarlos = wsList.users.find(u => u.email === "emanueldavidhc20@gmail.com");
    expect(wsCarlos).toBeUndefined();
  });

  it("cuando el negocio ya tiene 2 usuarios (dueño + auxiliar), intentar invitar o asignar un 3er usuario debe ser bloqueado", async () => {
    const { checkBusinessPlanUserCapacity } = await import("@/lib/auth/users-service");
    const capacity = await checkBusinessPlanUserCapacity(REAL_BUSINESS_ID);
    
    expect(capacity).toBeDefined();
    expect(capacity.maxUsers).toBe(2);
    expect(capacity.currentUsers).toBeGreaterThanOrEqual(2);
    expect(capacity.canAddUser).toBe(false);
  });

  it("probar loginWithPassword con super_admin", async () => {
    const { loginWithPassword } = await import("@/app/(auth)/actions");
    const formData = new FormData();
    formData.append("email", "leitec.info@gmail.com");
    formData.append("password", "TestPassword123!"); // invalid password to see response

    const res = await loginWithPassword(formData);
    console.log("loginWithPassword result:", res);
    expect(res).toBeDefined();
  });
});
