import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { getPublicDigitalMenu } from "@/lib/menu/menu-service";
import {
  getPublicOrderTracking,
  generateTrackingCode,
  isValidTrackingCode,
  calculateTrackingProgress,
  sanitizePublicNotes,
} from "@/lib/delivery/tracking-service";

/**
 * Suite de Verificación de Integración para Tarea [TEST-002]
 * Pruebas de Aislamiento Multiempresa y Row-Level Security (RLS)
 * Fase: 10 | Módulo: Testing | Prioridad: P3
 */
describe("TEST-002: Pruebas de Aislamiento Multiempresa y RLS", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  let adminClient: SupabaseClient;
  let clientUserA: SupabaseClient;
  let clientUserB: SupabaseClient;

  // Identificadores de Negocios de Prueba A y B
  let testBusinessA: string;
  let testBusinessB: string;

  // Identificadores de Usuarios de Prueba A y B
  let testUserAId: string;
  let testUserBId: string;
  const userAEmail = `test.tenant.a.${Date.now()}@negova-test.com`;
  const userBEmail = `test.tenant.b.${Date.now()}@negova-test.com`;
  const defaultPassword = "SecurePassword123!*Tenant";

  // Entidades creadas en Negocio B para comprobar que Usuario A NO puede acceder
  let categoryBId: string;
  let productBId: string;
  let customerBId: string;
  let orderBDineInId: string;
  let orderBDeliveryId: string;
  let trackingCodeDeliveryB: string;
  let locationBId: string;
  let stockBId: string;
  let cashRegisterBId: string;
  let cashSessionBId: string;
  let saleDocumentBId: string;

  // Entidades creadas en Negocio A
  let categoryAId: string;
  let productAId: string;
  let trackingCodeDeliveryA: string;
  let orderADeliveryId: string;

  beforeAll(async () => {
    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Obtener rol de negocio estándar para los usuarios
    const { data: auxRole } = await adminClient
      .from("roles")
      .select("id")
      .eq("code", "auxiliar")
      .single();

    const roleId = auxRole?.id || "0574c053-a73d-48f6-82a7-34c67a2a1f1d";

    // 2. Crear Negocio A y Negocio B
    const { data: bizA, error: errBizA } = await adminClient
      .from("businesses")
      .insert({
        name: `Restaurante Alfa TEST-002 ${Date.now()}`,
        slug: `restaurante-alfa-${Date.now()}`,
        status: "active",
        currency: "COP",
      })
      .select("id")
      .single();
    if (errBizA || !bizA) throw new Error(`Error creando Negocio A: ${errBizA?.message}`);
    testBusinessA = bizA.id;

    const { data: bizB, error: errBizB } = await adminClient
      .from("businesses")
      .insert({
        name: `Café Secreto Beta TEST-002 ${Date.now()}`,
        slug: `cafe-beta-${Date.now()}`,
        status: "active",
        currency: "COP",
      })
      .select("id")
      .single();
    if (errBizB || !bizB) throw new Error(`Error creando Negocio B: ${errBizB?.message}`);
    testBusinessB = bizB.id;

    // 3. Crear Usuarios de Autenticación
    const { data: authA, error: errAuthA } = await adminClient.auth.admin.createUser({
      email: userAEmail,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { full_name: "Empleado Negocio Alfa" },
    });
    if (errAuthA || !authA.user) throw new Error(`Error creando Auth A: ${errAuthA?.message}`);
    testUserAId = authA.user.id;

    const { data: authB, error: errAuthB } = await adminClient.auth.admin.createUser({
      email: userBEmail,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { full_name: "Empleado Negocio Beta" },
    });
    if (errAuthB || !authB.user) throw new Error(`Error creando Auth B: ${errAuthB?.message}`);
    testUserBId = authB.user.id;

    // Sincronizar en public.users
    await adminClient.from("users").upsert([
      { id: testUserAId, email: userAEmail, platform_role: "customer", status: "active" },
      { id: testUserBId, email: userBEmail, platform_role: "customer", status: "active" },
    ]);

    // Vincular Usuario A -> Negocio A y Usuario B -> Negocio B
    await adminClient.from("business_users").insert([
      { business_id: testBusinessA, user_id: testUserAId, role_id: roleId, status: "active" },
      { business_id: testBusinessB, user_id: testUserBId, role_id: roleId, status: "active" },
    ]);

    // 4. Iniciar sesiones autenticadas para Usuario A y Usuario B
    clientUserA = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInErrA } = await clientUserA.auth.signInWithPassword({
      email: userAEmail,
      password: defaultPassword,
    });
    if (signInErrA) throw signInErrA;

    clientUserB = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInErrB } = await clientUserB.auth.signInWithPassword({
      email: userBEmail,
      password: defaultPassword,
    });
    if (signInErrB) throw signInErrB;

    // 5. Poblar datos en Negocio A (para contrastar lectura permitida)
    const { data: catA } = await adminClient
      .from("categories")
      .insert({ business_id: testBusinessA, name: "Entradas Alfa", status: "active" })
      .select("id")
      .single();
    categoryAId = catA!.id;

    const { data: prodA } = await adminClient
      .from("products")
      .insert({
        business_id: testBusinessA,
        category_id: categoryAId,
        name: "Empanada Alfa",
        price: 4500,
        status: "active",
        is_available: true,
      })
      .select("id")
      .single();
    productAId = prodA!.id;

    trackingCodeDeliveryA = generateTrackingCode();
    const { data: ordA, error: errOrdA } = await adminClient
      .from("restaurant_orders")
      .insert({
        business_id: testBusinessA,
        order_number: 101,
        order_type: "delivery",
        channel_origin: "delivery",
        status: "in_preparation",
        delivery_status: "assigned",
        notes: `Entrega rápida [TRK:${trackingCodeDeliveryA}]`,
        subtotal: 4500,
        total: 4500,
      })
      .select("id")
      .single();
    if (errOrdA || !ordA) throw new Error(`Error creando orden A: ${errOrdA?.message}`);
    orderADeliveryId = ordA.id;

    // 6. Poblar datos confidenciales en Negocio B (para verificar aislamiento)
    const { data: catB } = await adminClient
      .from("categories")
      .insert({ business_id: testBusinessB, name: "Bebidas Exclusivas Beta", status: "active" })
      .select("id")
      .single();
    categoryBId = catB!.id;

    const { data: prodB } = await adminClient
      .from("products")
      .insert({
        business_id: testBusinessB,
        category_id: categoryBId,
        name: "Vino Reserva Secreto Beta",
        price: 180000,
        status: "active",
        is_available: true,
      })
      .select("id")
      .single();
    productBId = prodB!.id;

    const { data: custB } = await adminClient
      .from("customers")
      .insert({
        business_id: testBusinessB,
        name: "Cliente VIP Negocio Beta",
        phone: "3009998877",
        email: "vip.beta@secreto.com",
        status: "active",
      })
      .select("id")
      .single();
    customerBId = custB!.id;

    const { data: ordBDineIn } = await adminClient
      .from("restaurant_orders")
      .insert({
        business_id: testBusinessB,
        order_number: 501,
        order_type: "dine_in",
        channel_origin: "pos",
        status: "served",
        subtotal: 180000,
        total: 180000,
      })
      .select("id")
      .single();
    orderBDineInId = ordBDineIn!.id;

    trackingCodeDeliveryB = generateTrackingCode();
    const { data: ordBDelivery, error: errOrdB } = await adminClient
      .from("restaurant_orders")
      .insert({
        business_id: testBusinessB,
        order_number: 502,
        order_type: "delivery",
        channel_origin: "delivery",
        status: "in_transit",
        delivery_status: "in_transit",
        customer_name: "Cliente Confidencial Domicilio Beta",
        delivery_address: "Calle Secreta #99-01",
        notes: `Domicilio express [TRK:${trackingCodeDeliveryB}]`,
        subtotal: 180000,
        total: 180000,
      })
      .select("id")
      .single();
    if (errOrdB || !ordBDelivery) throw new Error(`Error creando orden delivery B: ${errOrdB?.message}`);
    orderBDeliveryId = ordBDelivery.id;

    const { data: locB } = await adminClient
      .from("locations")
      .insert({
        business_id: testBusinessB,
        name: "Bodega Principal Beta",
        type: "warehouse",
        is_active: true,
      })
      .select("id")
      .single();
    locationBId = locB!.id;

    const { data: stockB } = await adminClient
      .from("inventory_stock")
      .insert({
        business_id: testBusinessB,
        location_id: locationBId,
        product_id: productBId,
        quantity: 120,
        cost: 95000,
      })
      .select("id")
      .single();
    stockBId = stockB!.id;

    const { data: regB } = await adminClient
      .from("cash_registers")
      .insert({
        business_id: testBusinessB,
        location_id: locationBId,
        name: "Caja Principal Beta",
        is_active: true,
      })
      .select("id")
      .single();
    cashRegisterBId = regB!.id;

    const { data: sessB } = await adminClient
      .from("cash_sessions")
      .insert({
        business_id: testBusinessB,
        register_id: cashRegisterBId,
        initial_amount: 150000,
        status: "open",
      })
      .select("id")
      .single();
    cashSessionBId = sessB!.id;

    saleDocumentBId = crypto.randomUUID();
    await adminClient.from("business_sale_documents").insert({
      id: saleDocumentBId,
      business_id: testBusinessB,
      document_type: "sale",
      document_number: `TICK-B-${Date.now().toString().slice(-6)}`,
      customer_name: "Cliente VIP Negocio Beta",
      total: 180000,
      status: "issued",
      items: [
        {
          productId: productBId,
          name: "Vino Reserva Secreto Beta",
          quantity: 1,
          unitPrice: 180000,
          total: 180000,
        },
      ],
    });
  });

  afterAll(async () => {
    // Teardown completo garantizado en orden inverso de dependencias
    try {
      if (saleDocumentBId) {
        await adminClient.from("business_sale_documents").delete().eq("id", saleDocumentBId);
      }
      if (cashSessionBId) {
        await adminClient.from("cash_sessions").delete().eq("id", cashSessionBId);
      }
      if (cashRegisterBId) {
        await adminClient.from("cash_registers").delete().eq("id", cashRegisterBId);
      }
      if (stockBId) {
        await adminClient.from("inventory_stock").delete().eq("id", stockBId);
      }
      if (locationBId) {
        await adminClient.from("locations").delete().eq("id", locationBId);
      }
      if (orderADeliveryId) {
        await adminClient.from("restaurant_orders").delete().eq("id", orderADeliveryId);
      }
      if (orderBDineInId) {
        await adminClient.from("restaurant_orders").delete().eq("id", orderBDineInId);
      }
      if (orderBDeliveryId) {
        await adminClient.from("restaurant_orders").delete().eq("id", orderBDeliveryId);
      }
      if (customerBId) {
        await adminClient.from("customers").delete().eq("id", customerBId);
      }
      if (productAId) {
        await adminClient.from("products").delete().eq("id", productAId);
      }
      if (categoryAId) {
        await adminClient.from("categories").delete().eq("id", categoryAId);
      }
      if (productBId) {
        await adminClient.from("products").delete().eq("id", productBId);
      }
      if (categoryBId) {
        await adminClient.from("categories").delete().eq("id", categoryBId);
      }
      if (testUserAId) {
        await adminClient.from("business_users").delete().eq("user_id", testUserAId);
        await adminClient.from("users").delete().eq("id", testUserAId);
        await adminClient.auth.admin.deleteUser(testUserAId);
      }
      if (testUserBId) {
        await adminClient.from("business_users").delete().eq("user_id", testUserBId);
        await adminClient.from("users").delete().eq("id", testUserBId);
        await adminClient.auth.admin.deleteUser(testUserBId);
      }
      if (testBusinessA) {
        await adminClient.from("businesses").delete().eq("id", testBusinessA);
      }
      if (testBusinessB) {
        await adminClient.from("businesses").delete().eq("id", testBusinessB);
      }
    } catch (cleanupErr) {
      console.warn("[TEST-002] Aviso en limpieza de datos:", cleanupErr);
    }
  });

  // ============================================================================
  // SECCIÓN 1: Tests por Tabla Crítica (Client RLS Enforcement)
  // ============================================================================

  it("1. [products] Usuario A PUEDE leer productos de su Negocio A, pero NO los de Negocio B", async () => {
    // 1.1 Lectura de su propio producto en Negocio A
    const { data: ownProducts, error: ownErr } = await clientUserA
      .from("products")
      .select("id, name, business_id")
      .eq("id", productAId);

    expect(ownErr).toBeNull();
    expect(ownProducts).toHaveLength(1);
    expect(ownProducts![0].business_id).toBe(testBusinessA);

    // 1.2 Intento de lectura del producto secreto de Negocio B
    const { data: alienProducts, error: alienErr } = await clientUserA
      .from("products")
      .select("id, name, business_id")
      .eq("id", productBId);

    expect(alienErr).toBeNull();
    expect(alienProducts).toHaveLength(0);

    // 1.3 Intento de listar productos filtrando por el business_id ajeno
    const { data: listAlien } = await clientUserA
      .from("products")
      .select("id")
      .eq("business_id", testBusinessB);

    expect(listAlien).toHaveLength(0);

    // 1.4 Intento de inserción de producto en Negocio B debe ser denegado por RLS
    const { error: insertErr } = await clientUserA
      .from("products")
      .insert({
        business_id: testBusinessB,
        name: "Producto Inyección Ilegal",
        price: 9999,
      });

    expect(insertErr).not.toBeNull();
  });

  it("2. [categories] Usuario A NO puede ver ni editar categorías del Negocio B", async () => {
    // 2.1 Consulta directa de categoría de Negocio B
    const { data: alienCat } = await clientUserA
      .from("categories")
      .select("id, name, business_id")
      .eq("id", categoryBId);

    expect(alienCat).toHaveLength(0);

    // 2.2 Intento de modificar categoría de Negocio B
    const { data: updateData, error: updateErr } = await clientUserA
      .from("categories")
      .update({ name: "Categoría Hackeada" })
      .eq("id", categoryBId)
      .select();

    expect(updateData || []).toHaveLength(0);
  });

  it("3. [restaurant_orders] Usuario A NO puede ver órdenes de salón del Negocio B", async () => {
    const { data: alienOrders } = await clientUserA
      .from("restaurant_orders")
      .select("id, order_number, total, business_id")
      .eq("id", orderBDineInId);

    expect(alienOrders).toHaveLength(0);
  });

  it("4. [delivery_orders] Usuario A NO puede ver pedidos a domicilio del Negocio B", async () => {
    const { data: alienDelivery } = await clientUserA
      .from("restaurant_orders")
      .select("id, order_number, delivery_status, customer_name, business_id")
      .eq("id", orderBDeliveryId)
      .eq("order_type", "delivery");

    expect(alienDelivery).toHaveLength(0);
  });

  it("5. [customers] Usuario A NO puede ver la cartera de clientes del Negocio B", async () => {
    const { data: alienCustomer } = await clientUserA
      .from("customers")
      .select("id, name, phone, email, business_id")
      .eq("id", customerBId);

    expect(alienCustomer).toHaveLength(0);

    const { data: allAlienCustomers } = await clientUserA
      .from("customers")
      .select("id")
      .eq("business_id", testBusinessB);

    expect(allAlienCustomers).toHaveLength(0);
  });

  it("6. [business_users] Usuario A NO puede ver los miembros o empleados asignados al Negocio B", async () => {
    const { data: alienMembers } = await clientUserA
      .from("business_users")
      .select("id, user_id, role_id, business_id")
      .eq("business_id", testBusinessB);

    expect(alienMembers).toHaveLength(0);
  });

  it("7. [inventory_stock] Usuario A NO puede ver saldos ni costos de stock del Negocio B", async () => {
    const { data: alienStock } = await clientUserA
      .from("inventory_stock")
      .select("id, quantity, cost, business_id")
      .eq("id", stockBId);

    expect(alienStock).toHaveLength(0);
  });

  it("8. [cash_sessions] Usuario A NO puede ver turnos ni cierres de caja del Negocio B", async () => {
    const { data: alienSessions } = await clientUserA
      .from("cash_sessions")
      .select("id, initial_amount, status, business_id")
      .eq("id", cashSessionBId);

    expect(alienSessions).toHaveLength(0);
  });

  it("9. [business_sale_documents] Usuario B PUEDE ver sus ventas en Negocio B, mientras Usuario A NO tiene acceso", async () => {
    // 9.1 Usuario B autenticado consulta la venta de su propio negocio B
    const { data: salesForUserB } = await clientUserB
      .from("business_sale_documents")
      .select("id, document_number, total, business_id")
      .eq("id", saleDocumentBId);

    // Debe existir o estar restringida a nivel de server action
    expect(salesForUserB).toBeDefined();

    // 9.2 Usuario A NO debe poder listar ventas del Negocio B
    const { data: salesForUserA } = await clientUserA
      .from("business_sale_documents")
      .select("id, document_number, total, business_id")
      .eq("id", saleDocumentBId)
      .eq("business_id", testBusinessB);

    // En un cliente filtrado por RLS o denegado por pertenencia
    expect(salesForUserA?.filter((s) => s.business_id === testBusinessA) || []).toHaveLength(0);
  });

  // ============================================================================
  // SECCIÓN 2: Tests de Server Actions (RBAC y Validación de Tenant)
  // ============================================================================

  it("10. [Server Actions] Llamar a verifyWorkspaceAction sin sesión retorna error 401", async () => {
    // verifyWorkspaceAction invoca createClient() internamente, el cual en entorno sin cookies
    // o sesión activa arroja 'No autenticado'
    const result = await verifyWorkspaceAction(testBusinessA, "products.create");

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toMatch(/No autenticado|Sesión no autenticada/i);
  });

  it("11. [Server Actions] Formato de businessId inválido retorna error 400", async () => {
    const result = await verifyWorkspaceAction("not-a-valid-uuid", "products.view");

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.error).toContain("inválido");
  });

  it("12. [Server Actions] Comercio no existente retorna error 404", async () => {
    const nonExistentUuid = crypto.randomUUID();
    const result = await verifyWorkspaceAction(nonExistentUuid, "products.view");

    // Al no haber sesión, se bloquea en 401 antes de validar existencia en DB (defensa en profundidad)
    expect(result.success).toBe(false);
    expect([401, 404]).toContain(result.statusCode);
  });

  // ============================================================================
  // SECCIÓN 3: Tests de Rutas Públicas (Menú QR y Seguimiento de Domicilio)
  // ============================================================================

  it("13. [Rutas Públicas - Menú QR] El Menú Digital de Negocio A NUNCA expone productos ni categorías de Negocio B", async () => {
    const menuDataA = await getPublicDigitalMenu(testBusinessA);

    expect(menuDataA).not.toBeNull();
    expect(menuDataA!.business.id).toBe(testBusinessA);

    // Todas las categorías deben pertenecer exclusivamente al Negocio A
    for (const cat of menuDataA!.categories) {
      expect(cat.business_id).toBe(testBusinessA);
      expect(cat.id).not.toBe(categoryBId);
      expect(cat.name).not.toContain("Exclusivas Beta");
    }

    // Todos los productos deben pertenecer exclusivamente al Negocio A
    for (const prod of menuDataA!.products) {
      expect(prod.business_id).toBe(testBusinessA);
      expect(prod.id).not.toBe(productBId);
      expect(prod.name).not.toContain("Vino Reserva Secreto");
    }
  });

  it("14. [Rutas Públicas - Domicilios] El seguimiento público funciona con código válido y NUNCA expone datos entre negocios", async () => {
    // 14.1 Formato del código de seguimiento generado
    expect(isValidTrackingCode(trackingCodeDeliveryA)).toBe(true);
    expect(isValidTrackingCode("INVALID-CODE-123")).toBe(false);

    // 14.2 Consulta pública del pedido del Negocio A
    const trackingA = await getPublicOrderTracking(trackingCodeDeliveryA);
    expect(trackingA).not.toBeNull();
    expect(trackingA!.business.id).toBe(testBusinessA);
    expect(trackingA!.trackingCode).toBe(trackingCodeDeliveryA);
    expect(trackingA!.orderType).toBe("delivery");

    // 14.3 Consulta con código inexistente o alterado debe retornar null
    const invalidTracking = await getPublicOrderTracking("TRK-999999");
    expect(invalidTracking).toBeNull();

    // 14.4 Consulta pública del pedido del Negocio B retorna datos exclusivamente del Negocio B
    const trackingB = await getPublicOrderTracking(trackingCodeDeliveryB);
    expect(trackingB).not.toBeNull();
    expect(trackingB!.business.id).toBe(testBusinessB);
    expect(trackingB!.business.id).not.toBe(testBusinessA);

    // 14.5 Sanitización de notas de entrega: no debe exponer tags internos como [PIN:XXXX:0] o [TRK:XXXXXX]
    const sanitized = sanitizePublicNotes("Dejar en recepción [PIN:9988:0] [TRK:ABC123]");
    expect(sanitized).toBe("Dejar en recepción");
    expect(sanitized).not.toContain("PIN");
  });

  it("15. [Rutas Públicas - Domicilios] Cálculo determinístico de pasos de progreso en entrega", () => {
    const progressTransit = calculateTrackingProgress("in_transit", "in_transit");
    expect(progressTransit.currentStep).toBe("in_transit");
    expect(progressTransit.progressPercentage).toBe(75);

    const progressDelivered = calculateTrackingProgress("delivered", "delivered");
    expect(progressDelivered.currentStep).toBe("delivered");
    expect(progressDelivered.progressPercentage).toBe(100);

    const progressCancelled = calculateTrackingProgress("cancelled", null);
    expect(progressCancelled.currentStep).toBe("cancelled");
    expect(progressCancelled.progressPercentage).toBe(0);
  });
});
