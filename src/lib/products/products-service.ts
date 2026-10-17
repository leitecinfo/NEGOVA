import { createClient } from "@/lib/supabase/server";
import { Product, Category, CreateProductDTO, CreateCategoryDTO } from "./types";

/**
 * Servicio central para la gestión del catálogo de productos y categorías (Core).
 * Mantiene el aislamiento estricto por business_id y aplica las restricciones del plan comercial.
 */

export const PLAN_PRODUCT_LIMITS: Record<string, number> = {
  inicio: 50,
  crece: 200,
  negocio: Infinity,
  pro: Infinity,
};

/**
 * Obtener cliente Supabase para operaciones del servidor autorizadas.
 * Utiliza credenciales privilegiadas únicamente en el servidor tras la debida autorización RBAC.
 */
async function getDbClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return await createClient();
}

// ==========================================
// LÍMITES Y CAPACIDAD DEL PLAN
// ==========================================

export async function getBusinessProductCount(businessId: string): Promise<number> {
  const supabase = await getDbClient();
  const { count, error } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .neq("status", "archived");

  if (error) {
    console.error("[getBusinessProductCount] Error al contar productos:", error);
    throw new Error("No se pudo verificar el conteo actual de productos.");
  }

  return count || 0;
}

export async function checkProductPlanLimit(businessId: string): Promise<{
  allowed: boolean;
  planId: string;
  planName: string;
  maxProducts: number;
  currentCount: number;
  error?: string;
}> {
  const supabase = await getDbClient();

  // 1. Conteo de productos activos (los archivados no suman a la capacidad comercial)
  const currentCount = await getBusinessProductCount(businessId);

  // 2. Resolver suscripción y plan activo del comercio
  let planId = "inicio";
  let planName = "Inicio";

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, status, plans(code, name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub) {
    const rawPlans = sub.plans as any;
    const planData = Array.isArray(rawPlans) ? rawPlans[0] : rawPlans;
    const code = (planData?.code || sub.plan_id || "").toLowerCase();
    const name = (planData?.name || "").toLowerCase();

    if (code.includes("pro") || name.includes("pro") || code.includes("negocio") || name.includes("negocio")) {
      planId = "pro";
      planName = "Pro";
    } else if (code.includes("crece") || name.includes("crece")) {
      planId = "crece";
      planName = "Crece";
    } else {
      planId = "inicio";
      planName = "Inicio";
    }
  }

  const maxProducts = PLAN_PRODUCT_LIMITS[planId] ?? 50;
  const isAllowed = maxProducts === Infinity || currentCount < maxProducts;

  if (!isAllowed) {
    return {
      allowed: false,
      planId,
      planName,
      maxProducts,
      currentCount,
      error: `Has alcanzado el límite máximo de ${maxProducts} productos para el Plan ${planName}. Actualiza tu plan para agregar más productos o archiva los que no uses.`,
    };
  }

  return {
    allowed: true,
    planId,
    planName,
    maxProducts,
    currentCount,
  };
}

// ==========================================
// PLANTILLAS DE CATEGORÍAS POR TIPO DE NEGOCIO
// ==========================================

export const DEFAULT_CATEGORY_TEMPLATES: Record<string, Array<{ name: string; description?: string }>> = {
  restaurant: [
    { name: "Hamburguesas", description: "Hamburguesas artesanales y clásicas" },
    { name: "Salchipapas", description: "Papas francesas con salchicha y salsas" },
    { name: "Perros calientes", description: "Perros calientes tradicionales y especiales" },
    { name: "Bebidas", description: "Gaseosas, jugos y bebidas refrescantes" },
    { name: "Pizzas", description: "Pizzas personales y familiares" },
    { name: "Combos", description: "Combos y promociones de la casa" },
    { name: "Adiciones", description: "Porciones extras, quesos y tocineta" },
  ],
  fast_food: [
    { name: "Hamburguesas", description: "Hamburguesas artesanales y clásicas" },
    { name: "Salchipapas", description: "Papas francesas con salchicha y salsas" },
    { name: "Perros calientes", description: "Perros calientes tradicionales y especiales" },
    { name: "Bebidas", description: "Gaseosas, jugos y bebidas refrescantes" },
    { name: "Pizzas", description: "Pizzas personales y familiares" },
    { name: "Combos", description: "Combos y promociones de la casa" },
    { name: "Adiciones", description: "Porciones extras, quesos y tocineta" },
  ],
  retail: [
    { name: "Ropa", description: "Prendas de vestir para dama, caballero y niños" },
    { name: "Calzado", description: "Zapatos, tenis y sandalias" },
    { name: "Accesorios", description: "Bolsos, cinturones y complementos" },
    { name: "Promociones", description: "Artículos en descuento de temporada" },
  ],
  services: [
    { name: "Cortes y Peinados", description: "Servicios de barbería y estilismo" },
    { name: "Barba y Afeitado", description: "Arreglo de barba y perfilado tradicional" },
    { name: "Tratamientos", description: "Cuidado capilar y facial" },
    { name: "Paquetes Especiales", description: "Combos de servicios con descuento" },
  ],
  hardware: [
    { name: "Herramientas Manuales", description: "Martillos, destornilladores y llaves" },
    { name: "Herramientas Eléctricas", description: "Taladros, pulidoras y sierras" },
    { name: "Materiales y Fijación", description: "Tornillos, clavos y adhesivos" },
    { name: "Electricidad e Iluminación", description: "Cables, bombillos y tomas" },
    { name: "Pinturas y Acabados", description: "Pinturas, brochas y rodillos" },
  ],
  pharmacy: [
    { name: "Medicamentos", description: "Venta con y sin fórmula médica" },
    { name: "Cuidado Personal", description: "Higiene y aseo diario" },
    { name: "Primeros Auxilios", description: "Gasas, alcohol y curaciones" },
    { name: "Bebés y Maternidad", description: "Pañales, fórmulas y accesorios" },
  ],
  default: [
    { name: "General", description: "Productos y servicios principales" },
    { name: "Destacados", description: "Artículos más vendidos" },
    { name: "Promociones", description: "Ofertas y descuentos" },
  ],
};

/**
 * Inicializa de forma idempotente las categorías iniciales según el tipo de negocio.
 * Si el negocio ya posee categorías registradas, NO duplica ni modifica nada.
 */
export async function seedDefaultCategoriesForBusiness(
  businessId: string,
  businessType: string = "restaurant"
): Promise<{ seeded: boolean; count: number }> {
  const supabase = await getDbClient();

  // 1. Verificar si ya existen categorías en el negocio (Idempotencia estricta)
  const { data: existing, error: countErr } = await supabase
    .from("categories")
    .select("id, name")
    .eq("business_id", businessId)
    .neq("status", "archived");

  if (countErr) {
    console.error("[seedDefaultCategoriesForBusiness] Error al verificar categorías:", countErr);
    return { seeded: false, count: 0 };
  }

  const existingNames = new Set((existing || []).map((c) => c.name.toLowerCase().trim()));

  if (existingNames.size > 0) {
    return { seeded: false, count: existingNames.size };
  }

  // 2. Resolver plantilla adecuada según businessType
  const normalizedType = (businessType || "").toLowerCase().trim();
  const template =
    DEFAULT_CATEGORY_TEMPLATES[normalizedType] ||
    (normalizedType.includes("rest") || normalizedType.includes("food") || normalizedType.includes("comida")
      ? DEFAULT_CATEGORY_TEMPLATES.fast_food
      : normalizedType.includes("barber") || normalizedType.includes("belleza") || normalizedType.includes("serv")
      ? DEFAULT_CATEGORY_TEMPLATES.services
      : normalizedType.includes("tienda") || normalizedType.includes("retail") || normalizedType.includes("moda")
      ? DEFAULT_CATEGORY_TEMPLATES.retail
      : normalizedType.includes("ferreter") || normalizedType.includes("hard")
      ? DEFAULT_CATEGORY_TEMPLATES.hardware
      : DEFAULT_CATEGORY_TEMPLATES.default);

  // 3. Filtrar para no insertar duplicados
  const rowsToInsert = template
    .filter((cat) => !existingNames.has(cat.name.toLowerCase().trim()))
    .map((cat, idx) => ({
      business_id: businessId,
      name: cat.name,
      description: cat.description || null,
      sort_order: (idx + 1) * 10,
      status: "active",
    }));

  if (rowsToInsert.length === 0) {
    return { seeded: false, count: existingNames.size };
  }

  const { error: insErr } = await supabase.from("categories").insert(rowsToInsert);

  if (insErr) {
    console.error("[seedDefaultCategoriesForBusiness] Error al insertar categorías iniciales:", insErr);
    return { seeded: false, count: 0 };
  }

  return { seeded: true, count: rowsToInsert.length };
}

// ==========================================
// CATEGORÍAS
// ==========================================

export async function getCategories(businessId: string, businessType?: string): Promise<Category[]> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("business_id", businessId)
    .neq("status", "archived")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[getCategories] Error:", error);
    throw new Error("No se pudieron cargar las categorías.");
  }

  // Si no tiene categorías y se pasó el businessType, auto-sembrar plantilla
  if ((!data || data.length === 0) && businessType) {
    await seedDefaultCategoriesForBusiness(businessId, businessType);
    const reload = await supabase
      .from("categories")
      .select("*")
      .eq("business_id", businessId)
      .neq("status", "archived")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    return (reload.data || []) as Category[];
  }

  return (data || []) as Category[];
}

export async function getCategoryProductCount(businessId: string, categoryId: string): Promise<number> {
  const supabase = await getDbClient();
  const { count, error } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("category_id", categoryId)
    .neq("status", "archived");

  if (error) {
    console.error("[getCategoryProductCount] Error:", error);
    return 0;
  }
  return count || 0;
}

export async function createCategory(businessId: string, payload: Omit<CreateCategoryDTO, "business_id">): Promise<Category> {
  const supabase = await getDbClient();
  const trimmedName = payload.name.trim();

  // Verificar si ya existe una categoría activa con el mismo nombre para evitar duplicados
  const { data: existingList } = await supabase
    .from("categories")
    .select("*")
    .eq("business_id", businessId)
    .neq("status", "archived");

  const existing = (existingList || []).find(
    (c) => c.name.toLowerCase().trim() === trimmedName.toLowerCase()
  );

  if (existing) {
    return existing as Category;
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      business_id: businessId,
      name: trimmedName,
      description: payload.description,
      sort_order: payload.sort_order || 0,
      status: payload.status || "active",
    })
    .select()
    .single();

  if (error) {
    console.error("[createCategory] Error:", error);
    throw new Error("No se pudo crear la categoría.");
  }
  return data as Category;
}

export async function updateCategory(businessId: string, categoryId: string, payload: Partial<CreateCategoryDTO>): Promise<Category> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("categories")
    .update(payload)
    .eq("id", categoryId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) {
    console.error("[updateCategory] Error:", error);
    throw new Error("No se pudo actualizar la categoría.");
  }
  return data as Category;
}

export async function deleteCategory(
  businessId: string,
  categoryId: string,
  reassignToCategoryId?: string | null
): Promise<{ affectedProducts: number }> {
  const supabase = await getDbClient();

  // 1. Contar productos relacionados
  const count = await getCategoryProductCount(businessId, categoryId);

  // 2. Si hay productos y se especifica reasignar, actualizarlos; si no, dejarlos sin categoría (null)
  if (count > 0) {
    const targetCatId = reassignToCategoryId && reassignToCategoryId !== categoryId ? reassignToCategoryId : null;
    await supabase
      .from("products")
      .update({ category_id: targetCatId })
      .eq("business_id", businessId)
      .eq("category_id", categoryId);
  }

  // 3. Eliminar la categoría (el FK ON DELETE SET NULL de la BD respalda la integridad)
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("business_id", businessId);

  if (error) {
    // Si falla el borrado por alguna política, marcar como archivada
    await supabase
      .from("categories")
      .update({ status: "archived" })
      .eq("id", categoryId)
      .eq("business_id", businessId);
  }

  return { affectedProducts: count };
}

export async function archiveCategory(businessId: string, categoryId: string): Promise<void> {
  await deleteCategory(businessId, categoryId, null);
}

// ==========================================
// PRODUCTOS
// ==========================================

export async function getProducts(businessId: string, filters?: { category_id?: string; is_available?: boolean; status?: string }): Promise<Product[]> {
  const supabase = await getDbClient();
  let query = supabase
    .from("products")
    .select("*, categories(id, name)")
    .eq("business_id", businessId)
    .neq("status", "archived")
    .order("category_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (filters?.category_id) {
    query = query.eq("category_id", filters.category_id);
  }
  if (filters?.is_available !== undefined) {
    query = query.eq("is_available", filters.is_available);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getProducts] Error:", error.message || error);
    throw new Error(`No se pudieron cargar los productos: ${error.message || "Error de base de datos"}`);
  }
  return data as Product[];
}

export async function getProductById(businessId: string, productId: string): Promise<Product | null> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    console.error("[getProductById] Error:", error);
    return null;
  }
  return data as Product | null;
}

export async function createProduct(businessId: string, payload: Omit<CreateProductDTO, "business_id">): Promise<Product> {
  // Validación estricta de capacidad del plan en el servidor
  const limitCheck = await checkProductPlanLimit(businessId);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.error || "Capacidad de productos alcanzada para el plan actual.");
  }

  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      business_id: businessId,
      ...payload,
    })
    .select()
    .single();

  if (error) {
    console.error("[createProduct] Error:", error);
    throw new Error("No se pudo crear el producto.");
  }
  return data as Product;
}

export async function updateProduct(businessId: string, productId: string, payload: Partial<CreateProductDTO>): Promise<Product> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", productId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) {
    console.error("[updateProduct] Error:", error);
    throw new Error("No se pudo actualizar el producto.");
  }
  return data as Product;
}

export async function toggleProductAvailability(businessId: string, productId: string, isAvailable: boolean): Promise<void> {
  const supabase = await getDbClient();
  const { error } = await supabase
    .from("products")
    .update({ is_available: isAvailable })
    .eq("id", productId)
    .eq("business_id", businessId);

  if (error) {
    console.error("[toggleProductAvailability] Error:", error);
    throw new Error("No se pudo cambiar la disponibilidad del producto.");
  }
}

export async function archiveProduct(businessId: string, productId: string): Promise<void> {
  const supabase = await getDbClient();
  const { error } = await supabase
    .from("products")
    .update({ status: "archived" })
    .eq("id", productId)
    .eq("business_id", businessId);

  if (error) {
    console.error("[archiveProduct] Error:", error);
    throw new Error("No se pudo archivar el producto.");
  }
}

