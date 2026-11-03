import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Suite de Verificación de Integración para Tarea [SEC-001]
 * Aislamiento Multi-Tenant de Productos y Categorías a nivel RLS
 */
describe("SEC-001: Verificación de Aislamiento RLS en Products y Categories", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  let adminClient: SupabaseClient;
  let clientUserA: SupabaseClient;

  const testBusinessA = "a8e2612f-4acc-4c84-a420-220131b70d66"; // Negocio Real Existente A
  let testBusinessB: string;
  let testUserAId: string;
  const testUserAEmail = `test.rls.user.a.${Date.now()}@negova-test.com`;
  const testUserAPassword = "SecurePassword123!*RLS";

  let createdProductAId: string;
  let createdProductBId: string;
  let createdCategoryAId: string;
  let createdCategoryBId: string;

  beforeAll(async () => {
    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Obtener un rol válido para business_users
    const { data: auxRole } = await adminClient
      .from("roles")
      .select("id")
      .eq("code", "auxiliar")
      .single();

    // 2. Crear un Negocio B efímero para pruebas de aislamiento multi-tenant
    const { data: newBizB, error: errBizB } = await adminClient
      .from("businesses")
      .insert({
        name: "Negocio B Test Aislamiento RLS",
        slug: `negocio-b-rls-${Date.now()}`,
        status: "active",
      })
      .select("id")
      .single();

    if (errBizB || !newBizB) {
      throw new Error(`Error creando Negocio B: ${errBizB?.message}`);
    }
    testBusinessB = newBizB.id;

    // 3. Crear Categoría y Producto para Negocio A (usando service_role)
    const { data: catA, error: errCatA } = await adminClient
      .from("categories")
      .insert({
        business_id: testBusinessA,
        name: `Cat Negocio A ${Date.now()}`,
        status: "active",
      })
      .select("id")
      .single();
    if (errCatA) throw errCatA;
    createdCategoryAId = catA.id;

    const { data: prodA, error: errProdA } = await adminClient
      .from("products")
      .insert({
        business_id: testBusinessA,
        category_id: createdCategoryAId,
        name: `Producto Negocio A ${Date.now()}`,
        price: 15000,
        status: "active",
        is_available: true,
      })
      .select("id")
      .single();
    if (errProdA) throw errProdA;
    createdProductAId = prodA.id;

    // 4. Crear Categoría y Producto para Negocio B (usando service_role)
    const { data: catB, error: errCatB } = await adminClient
      .from("categories")
      .insert({
        business_id: testBusinessB,
        name: `Cat Negocio B Secreto ${Date.now()}`,
        status: "active",
      })
      .select("id")
      .single();
    if (errCatB) throw errCatB;
    createdCategoryBId = catB.id;

    const { data: prodB, error: errProdB } = await adminClient
      .from("products")
      .insert({
        business_id: testBusinessB,
        category_id: createdCategoryBId,
        name: `Producto Negocio B Secreto ${Date.now()}`,
        price: 99000,
        status: "active",
        is_available: true,
      })
      .select("id")
      .single();
    if (errProdB) throw errProdB;
    createdProductBId = prodB.id;

    // 5. Crear Usuario A en auth.users y public.users
    const { data: authUserA, error: errAuthUser } = await adminClient.auth.admin.createUser({
      email: testUserAEmail,
      password: testUserAPassword,
      email_confirm: true,
      user_metadata: { full_name: "Usuario Negocio A RLS Test" },
    });
    if (errAuthUser || !authUserA.user) {
      throw new Error(`Error creando auth user A: ${errAuthUser?.message}`);
    }
    testUserAId = authUserA.user.id;

    await adminClient.from("users").upsert({
      id: testUserAId,
      email: testUserAEmail,
      platform_role: "customer",
      status: "active",
    });

    // Vincular Usuario A a Negocio A como miembro activo en business_users
    const { error: errBu } = await adminClient.from("business_users").insert({
      business_id: testBusinessA,
      user_id: testUserAId,
      role_id: auxRole!.id,
      status: "active",
    });
    if (errBu) throw errBu;

    // 6. Autenticar cliente Supabase directamente como Usuario A
    clientUserA = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: errSignIn } = await clientUserA.auth.signInWithPassword({
      email: testUserAEmail,
      password: testUserAPassword,
    });
    if (errSignIn) throw errSignIn;
  });

  afterAll(async () => {
    // Teardown: Limpieza garantizada de entidades efímeras de prueba
    try {
      if (createdProductAId) {
        await adminClient.from("products").delete().eq("id", createdProductAId);
      }
      if (createdCategoryAId) {
        await adminClient.from("categories").delete().eq("id", createdCategoryAId);
      }
      if (createdProductBId) {
        await adminClient.from("products").delete().eq("id", createdProductBId);
      }
      if (createdCategoryBId) {
        await adminClient.from("categories").delete().eq("id", createdCategoryBId);
      }
      if (testUserAId) {
        await adminClient.from("business_users").delete().eq("user_id", testUserAId);
        await adminClient.from("users").delete().eq("id", testUserAId);
        await adminClient.auth.admin.deleteUser(testUserAId);
      }
      if (testBusinessB) {
        await adminClient.from("businesses").delete().eq("id", testBusinessB);
      }
    } catch (cleanErr) {
      console.warn("Aviso en limpieza de prueba SEC-001:", cleanErr);
    }
  });

  it("1. [Criterio de Aceptación] Server Actions / service_role tiene acceso completo a products y categories de cualquier negocio", async () => {
    const { data: prods, error: errProds } = await adminClient
      .from("products")
      .select("id, name, business_id")
      .in("id", [createdProductAId, createdProductBId]);

    expect(errProds).toBeNull();
    expect(prods).toHaveLength(2);
    expect(prods?.some((p) => p.id === createdProductAId)).toBe(true);
    expect(prods?.some((p) => p.id === createdProductBId)).toBe(true);

    const { data: cats, error: errCats } = await adminClient
      .from("categories")
      .select("id, name, business_id")
      .in("id", [createdCategoryAId, createdCategoryBId]);

    expect(errCats).toBeNull();
    expect(cats).toHaveLength(2);
  });

  it("2. Usuario autenticado del Negocio A PUEDE leer sus propios productos y categorías vía Supabase client", async () => {
    const { data: prodsA, error: errProdsA } = await clientUserA
      .from("products")
      .select("id, name, business_id")
      .eq("id", createdProductAId);

    expect(errProdsA).toBeNull();
    expect(prodsA).toBeDefined();
    expect(prodsA).toHaveLength(1);
    expect(prodsA![0].id).toBe(createdProductAId);
    expect(prodsA![0].business_id).toBe(testBusinessA);

    const { data: catsA, error: errCatsA } = await clientUserA
      .from("categories")
      .select("id, name, business_id")
      .eq("id", createdCategoryAId);

    expect(errCatsA).toBeNull();
    expect(catsA).toHaveLength(1);
    expect(catsA![0].id).toBe(createdCategoryAId);
  });

  it("3. [Criterio de Aceptación] Usuario autenticado en Negocio A NO puede leer productos del Negocio B (retorna vacío)", async () => {
    // Intento 1: Consultar producto de Negocio B directamente por ID
    const { data: prodsBById, error: errById } = await clientUserA
      .from("products")
      .select("id, name, business_id")
      .eq("id", createdProductBId);

    expect(errById).toBeNull();
    // Aislamiento RLS estricto: la consulta retorna un conjunto vacío sin exponer información
    expect(prodsBById).toBeDefined();
    expect(prodsBById).toHaveLength(0);

    // Intento 2: Listar productos filtrando por el business_id ajeno
    const { data: prodsBByBiz, error: errByBiz } = await clientUserA
      .from("products")
      .select("id, name, business_id")
      .eq("business_id", testBusinessB);

    expect(errByBiz).toBeNull();
    expect(prodsBByBiz).toBeDefined();
    expect(prodsBByBiz).toHaveLength(0);
  });

  it("4. [Criterio de Aceptación] Usuario autenticado en Negocio A NO puede leer categorías del Negocio B (retorna vacío)", async () => {
    // Intento 1: Consultar categoría de Negocio B directamente por ID
    const { data: catsBById, error: errCatById } = await clientUserA
      .from("categories")
      .select("id, name, business_id")
      .eq("id", createdCategoryBId);

    expect(errCatById).toBeNull();
    expect(catsBById).toBeDefined();
    expect(catsBById).toHaveLength(0);

    // Intento 2: Listar categorías filtrando por el business_id ajeno
    const { data: catsBByBiz, error: errCatByBiz } = await clientUserA
      .from("categories")
      .select("id, name, business_id")
      .eq("business_id", testBusinessB);

    expect(errCatByBiz).toBeNull();
    expect(catsBByBiz).toBeDefined();
    expect(catsBByBiz).toHaveLength(0);
  });

  it("5. [Criterio de Aceptación] Usuario autenticado en Negocio A NO puede insertar productos en el Negocio B", async () => {
    const { data: hackInsert, error: errHack } = await clientUserA
      .from("products")
      .insert({
        business_id: testBusinessB,
        name: "Producto Inyección No Autorizada",
        price: 5000,
        status: "active",
      })
      .select("id");

    // RLS WITH CHECK deniega tajantemente la inserción
    expect(errHack).not.toBeNull();
    expect(hackInsert).toBeNull();
  });
});
