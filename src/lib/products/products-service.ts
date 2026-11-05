import { createClient } from "@/lib/supabase/server";
import { checkPlanLimit } from "@/lib/subscriptions/plan-limits-service";
import {
  Product,
  Category,
  CreateProductDTO,
  CreateCategoryDTO,
  SalesChannel,
  isProductAvailableInPos,
  isProductAvailableInQr,
  isProductAvailableOnline,
  resolveProductChannels,
} from "./types";

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
export async function getDbClient() {
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
  const result = await checkPlanLimit(businessId, "products");
  const maxProducts = result.maxLimit === -1 ? Infinity : result.maxLimit;

  return {
    allowed: result.allowed,
    planId: result.planCode,
    planName: result.planName,
    maxProducts,
    currentCount: result.currentCount,
    error: result.error,
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
    // Si el error es de clave duplicada (código 23505), significa que otra petición concurrente (SSR / prefetch)
    // ya completó la inserción en el mismo instante. Se considera una operación exitosa e idempotente.
    if ((insErr as any).code === "23505" || insErr.message?.toLowerCase().includes("duplicate key")) {
      return { seeded: true, count: rowsToInsert.length };
    }

    console.error(
      "[seedDefaultCategoriesForBusiness] Error al insertar categorías iniciales:",
      insErr.message || JSON.stringify(insErr)
    );
    return { seeded: false, count: 0 };
  }

  return { seeded: true, count: rowsToInsert.length };
}

// ==========================================
// CATEGORÍAS
// ==========================================

function attachCategoryParents(cats: Category[]): Category[] {
  const catMap = new Map<string, Category>(cats.map((c) => [c.id, c]));
  return cats.map((cat) => {
    let parent = null;
    if (cat.parent_category_id && catMap.has(cat.parent_category_id)) {
      const p = catMap.get(cat.parent_category_id)!;
      parent = { id: p.id, name: p.name };
    }
    return {
      ...cat,
      parent,
    };
  });
}

export async function getCategories(businessId: string, _businessType?: string): Promise<Category[]> {
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

  return attachCategoryParents((data || []) as Category[]);
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
  const parentId = payload.parent_category_id ? payload.parent_category_id.trim() : null;

  // Validaciones jerárquicas: Máximo 2 niveles (no recursivo)
  if (parentId) {
    const { data: parentCat, error: parentErr } = await supabase
      .from("categories")
      .select("id, business_id, parent_category_id, status")
      .eq("id", parentId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (parentErr || !parentCat) {
      throw new Error("La categoría padre seleccionada no existe o no pertenece a este comercio.");
    }

    if (parentCat.parent_category_id) {
      throw new Error("Una subcategoría no puede ser categoría padre. Solo se permiten hasta 2 niveles de jerarquía.");
    }
  }

  // Verificar si ya existe una categoría activa con el mismo nombre y padre para evitar duplicados
  const { data: existingList } = await supabase
    .from("categories")
    .select("*")
    .eq("business_id", businessId)
    .neq("status", "archived");

  const existing = (existingList || []).find(
    (c) =>
      c.name.toLowerCase().trim() === trimmedName.toLowerCase() &&
      (c.parent_category_id || null) === parentId
  );

  if (existing) {
    return existing as Category;
  }

  const insertPayload: Record<string, any> = {
    business_id: businessId,
    name: trimmedName,
    description: payload.description || null,
    sort_order: payload.sort_order || 0,
    status: payload.status || "active",
    default_tax_rate: payload.default_tax_rate !== undefined ? payload.default_tax_rate : null,
  };
  if (parentId) {
    insertPayload.parent_category_id = parentId;
  }

  const { data, error } = await supabase
    .from("categories")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("[createCategory] Error:", error);
    throw new Error(error.message || "No se pudo crear la categoría.");
  }
  return data as Category;
}

export async function updateCategory(businessId: string, categoryId: string, payload: Partial<CreateCategoryDTO>): Promise<Category> {
  const supabase = await getDbClient();

  // Validaciones jerárquicas en actualización
  if (payload.parent_category_id !== undefined && payload.parent_category_id !== null && payload.parent_category_id !== "") {
    const parentId = payload.parent_category_id.trim();
    if (parentId === categoryId) {
      throw new Error("Una categoría no puede ser su propio padre.");
    }

    const { data: parentCat, error: parentErr } = await supabase
      .from("categories")
      .select("id, business_id, parent_category_id, status")
      .eq("id", parentId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (parentErr || !parentCat) {
      throw new Error("La categoría padre seleccionada no existe o no pertenece a este comercio.");
    }

    if (parentCat.parent_category_id) {
      throw new Error("Una subcategoría no puede ser categoría padre. Solo se permiten hasta 2 niveles de jerarquía.");
    }

    // Regla: si esta categoría ya tiene hijos, no puede convertirse en subcategoría (máximo 2 niveles)
    const { data: children } = await supabase
      .from("categories")
      .select("id")
      .eq("business_id", businessId)
      .eq("parent_category_id", categoryId)
      .neq("status", "archived")
      .limit(1);

    if (children && children.length > 0) {
      throw new Error("Esta categoría ya tiene subcategorías asociadas y no puede ser convertida en subcategoría.");
    }
  }

  const updatePayload: Record<string, any> = { ...payload };
  if (payload.parent_category_id === "") {
    updatePayload.parent_category_id = null;
  }

  const { data, error } = await supabase
    .from("categories")
    .update(updatePayload)
    .eq("id", categoryId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) {
    console.error("[updateCategory] Error:", error);
    throw new Error(error.message || "No se pudo actualizar la categoría.");
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
// ==========================================
// PRODUCTOS
// ==========================================

/**
 * Normaliza los campos de disponibilidad por canal de venta (`available_in_pos`,
 * `available_in_qr`, `available_online`) para que estén sincronizados tanto en
 * nivel superior del registro como dentro de `metadata`.
 */
export function normalizeProductChannels(raw: any): Product {
  if (!raw) return raw;
  const channels = resolveProductChannels(raw);
  const rawMeta = typeof raw.metadata === "object" && raw.metadata !== null ? raw.metadata : {};

  return {
    ...raw,
    available_in_pos: channels.available_in_pos,
    available_in_qr: channels.available_in_qr,
    available_online: channels.available_online,
    metadata: {
      ...rawMeta,
      available_in_pos: channels.available_in_pos,
      available_in_qr: channels.available_in_qr,
      available_online: channels.available_online,
      show_in_qr_menu: channels.available_in_qr,
    },
  } as Product;
}

export async function getProducts(
  businessId: string,
  filters?: {
    category_id?: string;
    is_available?: boolean;
    status?: string;
    channel?: SalesChannel;
  }
): Promise<Product[]> {
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

  let normalized = ((data || []) as any[]).map(normalizeProductChannels);

  if (filters?.channel === "pos") {
    normalized = normalized.filter((p) => isProductAvailableInPos(p));
  } else if (filters?.channel === "qr") {
    normalized = normalized.filter((p) => isProductAvailableInQr(p));
  } else if (filters?.channel === "online") {
    normalized = normalized.filter((p) => isProductAvailableOnline(p));
  }

  // [REC-004] Enriquecer con cálculo de porciones y disponibilidad de recetas
  // Si el cuello de botella de la receta tiene 0 porciones, se marca como 'is_available = false' (Agotado)
  try {
    const { enrichProductsWithRecipeAvailability } = await import("@/lib/recipes/recipe-service");
    normalized = await enrichProductsWithRecipeAvailability(businessId, normalized);
  } catch {
    // Continuar con normalized si las recetas no están disponibles en el contexto
  }

  if (filters?.is_available !== undefined) {
    normalized = normalized.filter((p) => p.is_available === filters.is_available);
  }

  return normalized;
}

export async function getProductById(businessId: string, productId: string): Promise<Product | null> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !data) return null;

  let normalized = normalizeProductChannels(data);
  try {
    const { enrichProductsWithRecipeAvailability } = await import("@/lib/recipes/recipe-service");
    const [enriched] = await enrichProductsWithRecipeAvailability(businessId, [normalized]);
    return enriched || normalized;
  } catch {
    return normalized;
  }
}

function buildSyncedProductPayload(
  payload: Partial<CreateProductDTO>,
  existingProduct?: Partial<Product> | null
): Record<string, any> {
  const existingMeta =
    existingProduct && typeof existingProduct.metadata === "object" && existingProduct.metadata !== null
      ? (existingProduct.metadata as Record<string, any>)
      : {};
  const incomingMeta =
    payload.metadata && typeof payload.metadata === "object"
      ? (payload.metadata as Record<string, any>)
      : {};

  const mergedMeta: Record<string, any> = {
    ...existingMeta,
    ...incomingMeta,
  };

  const posVal =
    typeof payload.available_in_pos === "boolean"
      ? payload.available_in_pos
      : typeof incomingMeta.available_in_pos === "boolean"
      ? incomingMeta.available_in_pos
      : existingProduct
      ? isProductAvailableInPos(existingProduct)
      : true;

  const qrVal =
    typeof payload.available_in_qr === "boolean"
      ? payload.available_in_qr
      : typeof incomingMeta.available_in_qr === "boolean"
      ? incomingMeta.available_in_qr
      : existingProduct
      ? isProductAvailableInQr(existingProduct)
      : true;

  const onlineVal =
    typeof payload.available_online === "boolean"
      ? payload.available_online
      : typeof incomingMeta.available_online === "boolean"
      ? incomingMeta.available_online
      : existingProduct
      ? isProductAvailableOnline(existingProduct)
      : true;

  mergedMeta.available_in_pos = posVal;
  mergedMeta.available_in_qr = qrVal;
  mergedMeta.available_online = onlineVal;
  mergedMeta.show_in_qr_menu = qrVal;

  return {
    ...payload,
    available_in_pos: posVal,
    available_in_qr: qrVal,
    available_online: onlineVal,
    metadata: mergedMeta,
  };
}

export async function createProduct(
  businessId: string,
  payload: Omit<CreateProductDTO, "business_id">
): Promise<Product> {
  // Validación estricta de capacidad del plan en el servidor
  const limitCheck = await checkProductPlanLimit(businessId);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.error || "Capacidad de productos alcanzada para el plan actual.");
  }

  const supabase = await getDbClient();
  const syncedPayload = buildSyncedProductPayload(payload, null);

  let { data, error } = await supabase
    .from("products")
    .insert({
      business_id: businessId,
      ...syncedPayload,
    })
    .select()
    .single();

  // Resiliencia ante caché de esquema si las columnas aún no han sido recargadas en PostgREST
  if (
    error &&
    (error.code === "PGRST204" ||
      String(error.message || "").includes("available_in_") ||
      String(error.message || "").includes("available_online") ||
      String(error.message || "").includes("cost_price"))
  ) {
    const {
      available_in_pos: _pos,
      available_in_qr: _qr,
      available_online: _online,
      cost_price: _cost,
      ...fallbackPayload
    } = syncedPayload as any;

    const retry = await supabase
      .from("products")
      .insert({
        business_id: businessId,
        ...fallbackPayload,
      })
      .select()
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("[createProduct] Error:", error);
    throw new Error("No se pudo crear el producto.");
  }
  return normalizeProductChannels(data);
}

export async function updateProduct(
  businessId: string,
  productId: string,
  payload: Partial<CreateProductDTO>
): Promise<Product> {
  const supabase = await getDbClient();

  let existing: Product | null = null;
  try {
    existing = await getProductById(businessId, productId);
  } catch {
    existing = null;
  }

  const syncedPayload = buildSyncedProductPayload(payload, existing);

  let { data, error } = await supabase
    .from("products")
    .update(syncedPayload)
    .eq("id", productId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (
    error &&
    (error.code === "PGRST204" ||
      String(error.message || "").includes("available_in_") ||
      String(error.message || "").includes("available_online") ||
      String(error.message || "").includes("cost_price"))
  ) {
    const {
      available_in_pos: _pos,
      available_in_qr: _qr,
      available_online: _online,
      cost_price: _cost,
      ...fallbackPayload
    } = syncedPayload as any;

    const retry = await supabase
      .from("products")
      .update(fallbackPayload)
      .eq("id", productId)
      .eq("business_id", businessId)
      .select()
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("[updateProduct] Error:", error);
    throw new Error("No se pudo actualizar el producto.");
  }
  return normalizeProductChannels(data);
}

export async function updateProductChannelAvailability(
  businessId: string,
  productId: string,
  channels: {
    available_in_pos?: boolean;
    available_in_qr?: boolean;
    available_online?: boolean;
  }
): Promise<Product> {
  return updateProduct(businessId, productId, channels);
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

