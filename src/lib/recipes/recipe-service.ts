// Dynamic import of createClient inside getDbClient to avoid next/headers leakage
import { assertPlanLimit } from "@/lib/subscriptions/plan-limits-service";
import {
  Ingredient,
  CreateIngredientInput,
  CreateIngredientInputSchema,
  UpdateIngredientInput,
  UpdateIngredientInputSchema,
  IngredientFilters,
  IngredientKPIs,
  Recipe,
  RecipeWithDetails,
  RecipeIngredient,
  CreateRecipeInput,
  CreateRecipeInputSchema,
  UpdateRecipeInput,
  UpdateRecipeInputSchema,
  RecipeFilters,
  LimitingIngredientInfo,
  RecipeAvailabilityResult,
} from "./types";
import {
  ensureDefaultLocation,
  recordInventoryMovement,
  upsertInventoryStock,
} from "@/lib/inventory/inventory-service";

/**
 * Cliente de base de datos con privilegios para garantizar operaciones transaccionales seguras.
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

  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

/**
 * Mapea una fila de producto tipo "ingredient" hacia la interfaz normalizada Ingredient.
 */
function mapProductToIngredient(prod: any, stockRows?: any[]): Ingredient {
  const meta = (prod.metadata as Record<string, any>) || {};
  const stockForProd = (stockRows || []).filter((s) => s.product_id === prod.id);

  // Cantidad consolidada o registrada
  const totalStock =
    stockForProd.length > 0
      ? stockForProd.reduce((sum, s) => sum + Number(s.quantity || 0), 0)
      : Number(meta.stock_quantity || 0);

  // Primera ubicación asociada para referencia
  const primaryStock = stockForProd[0];

  return {
    id: prod.id,
    businessId: prod.business_id,
    name: prod.name,
    unit: meta.unit || "unidad",
    costPerUnit: Number(primaryStock?.cost ?? meta.cost ?? 0),
    stockQuantity: totalStock,
    minStock: Number(primaryStock?.min_stock ?? meta.min_stock ?? 0),
    maxStock: meta.max_stock !== undefined ? Number(meta.max_stock) : null,
    locationId: primaryStock?.location_id || null,
    locationName: primaryStock?.locations?.name || null,
    categoryId: prod.category_id || null,
    availableInPos: Boolean(prod.available_in_pos ?? meta.available_in_pos ?? false),
    availableInQr: Boolean(prod.available_in_qr ?? meta.available_in_qr ?? false),
    availableOnline: Boolean(meta.available_online ?? false),
    isAvailable: Boolean(prod.is_available),
    notes: prod.description || null,
    createdAt: prod.created_at,
    updatedAt: prod.updated_at,
  };
}

/**
 * Garantiza la existencia de una categoría por defecto "Insumos e Ingredientes" para el negocio.
 */
async function ensureIngredientCategory(businessId: string): Promise<string> {
  const supabase = await getDbClient();

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("business_id", businessId)
    .ilike("name", "%ingrediente%")
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  // Si no existe, crearla
  const { data: created, error } = await supabase
    .from("categories")
    .insert({
      business_id: businessId,
      name: "Insumos e Ingredientes",
      description: "Materia prima, ingredientes y componentes gastronómicos",
      sort_order: 999,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !created) {
    // Si falla, buscar cualquier categoría activa
    const { data: fallback } = await supabase
      .from("categories")
      .select("id")
      .eq("business_id", businessId)
      .limit(1)
      .maybeSingle();

    return fallback?.id || "";
  }

  return created.id;
}

/**
 * Crea un nuevo ingrediente como producto tipo "ingredient" con inicialización en el Kardex y stock.
 */
export async function createIngredient(
  businessId: string,
  input: CreateIngredientInput,
  userId?: string | null
): Promise<Ingredient> {
  const parsed = CreateIngredientInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Resolver categoría
  let categoryId = parsed.categoryId;
  if (!categoryId) {
    categoryId = await ensureIngredientCategory(businessId);
  }

  // 2. Resolver ubicación
  let locationId = parsed.locationId;
  if (!locationId) {
    const defaultLoc = await ensureDefaultLocation(businessId);
    locationId = defaultLoc.id;
  }

  // 3. Crear el producto en la tabla `products` con product_type = 'ingredient'
  const metadata = {
    product_type: "ingredient",
    unit: parsed.unit,
    cost: parsed.costPerUnit,
    track_stock: true,
    stock_quantity: parsed.initialStock,
    min_stock: parsed.minStock,
    max_stock: parsed.maxStock || null,
    available_in_pos: parsed.availableInPos,
    available_in_qr: parsed.availableInQr,
    show_in_qr_menu: parsed.availableInQr,
    available_online: parsed.availableOnline,
  };

  const insertPayload: Record<string, any> = {
    business_id: businessId,
    category_id: categoryId || null,
    name: parsed.name.trim(),
    description: parsed.notes?.trim() || null,
    price: 0,
    is_available: true,
    status: "active",
    available_in_pos: parsed.availableInPos,
    available_in_qr: parsed.availableInQr,
    metadata,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let { data: productData, error: prodErr } = await supabase
    .from("products")
    .insert(insertPayload)
    .select()
    .single();

  if (
    prodErr &&
    (prodErr.code === "PGRST204" ||
      String(prodErr.message || "").includes("available_in_"))
  ) {
    delete insertPayload.available_in_pos;
    delete insertPayload.available_in_qr;
    const retry = await supabase
      .from("products")
      .insert(insertPayload)
      .select()
      .single();
    productData = retry.data;
    prodErr = retry.error;
  }

  if (prodErr || !productData) {
    console.error("[createIngredient] Error al crear ingrediente en products:", prodErr);
    throw new Error(`No se pudo crear el ingrediente: ${prodErr?.message}`);
  }

  const productId = productData.id;

  // 4. Inicializar existencias físicas y Kardex
  if (parsed.initialStock > 0) {
    try {
      await recordInventoryMovement(
        businessId,
        {
          productId,
          locationId,
          movementType: "entry",
          quantity: parsed.initialStock,
          unitCost: parsed.costPerUnit,
          referenceType: "adjustment",
          notes: "Inventario inicial al dar de alta el ingrediente",
        },
        userId
      );

      // Asegurar configuración de stock mínimo si se especificó
      if (parsed.minStock > 0) {
        await upsertInventoryStock(businessId, {
          productId,
          locationId,
          quantity: parsed.initialStock,
          minStock: parsed.minStock,
          cost: parsed.costPerUnit,
        });
      }
    } catch (movErr) {
      console.warn("[createIngredient] Error al registrar movimiento inicial:", movErr);
    }
  } else {
    // Si stock inicial es 0, inicializar fila física en 0
    await upsertInventoryStock(businessId, {
      productId,
      locationId,
      quantity: 0,
      minStock: parsed.minStock,
      cost: parsed.costPerUnit,
    });
  }

  return mapProductToIngredient(productData, [
    {
      product_id: productId,
      location_id: locationId,
      quantity: parsed.initialStock,
      cost: parsed.costPerUnit,
      min_stock: parsed.minStock,
    },
  ]);
}

/**
 * Consulta la lista de ingredientes del comercio aplicando filtros.
 */
export async function getIngredients(
  businessId: string,
  filters: IngredientFilters = {}
): Promise<Ingredient[]> {
  const supabase = await getDbClient();

  // Consultar productos de tipo ingrediente
  let query = supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .neq("status", "archived");

  const { data: products, error: pErr } = await query;
  if (pErr) {
    console.error("[getIngredients] Error al consultar productos:", pErr);
    throw new Error(`Error al listar ingredientes: ${pErr.message}`);
  }

  // Filtrar estrictamente por metadata->product_type === 'ingredient'
  const ingredientProducts = (products || []).filter(
    (p: any) => (p.metadata as any)?.product_type === "ingredient"
  );

  if (ingredientProducts.length === 0) {
    return [];
  }

  const prodIds = ingredientProducts.map((p) => p.id);

  // Consultar existencias de inventory_stock con nombre de ubicación
  const { data: stockRows } = await supabase
    .from("inventory_stock")
    .select("*, locations(name)")
    .eq("business_id", businessId)
    .in("product_id", prodIds);

  let ingredients = ingredientProducts.map((p) =>
    mapProductToIngredient(p, stockRows || [])
  );

  // Filtro por ubicación
  if (filters.locationId && filters.locationId !== "all") {
    ingredients = ingredients.filter((ing) => ing.locationId === filters.locationId);
  }

  // Filtro por unidad de medida
  if (filters.unit && filters.unit !== "all") {
    ingredients = ingredients.filter((ing) => ing.unit === filters.unit);
  }

  // Filtro por estado de stock
  if (filters.stockStatus && filters.stockStatus !== "all") {
    if (filters.stockStatus === "out_of_stock") {
      ingredients = ingredients.filter((ing) => ing.stockQuantity <= 0);
    } else if (filters.stockStatus === "low_stock") {
      ingredients = ingredients.filter(
        (ing) => ing.stockQuantity > 0 && ing.stockQuantity <= ing.minStock
      );
    } else if (filters.stockStatus === "in_stock") {
      ingredients = ingredients.filter((ing) => ing.stockQuantity > ing.minStock);
    }
  }

  // Búsqueda de texto
  if (filters.search && filters.search.trim().length > 0) {
    const q = filters.search.toLowerCase().trim();
    ingredients = ingredients.filter((ing) => ing.name.toLowerCase().includes(q));
  }

  // Ordenar alfabéticamente
  ingredients.sort((a, b) => a.name.localeCompare(b.name));

  return ingredients;
}

/**
 * Calcula los KPIs consolidados de ingredientes para el negocio.
 */
export async function getIngredientKPIs(businessId: string): Promise<IngredientKPIs> {
  const ingredients = await getIngredients(businessId);

  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalCostValuation = 0;

  for (const ing of ingredients) {
    const stock = ing.stockQuantity;
    const cost = ing.costPerUnit;

    totalCostValuation += stock * cost;

    if (stock <= 0) {
      outOfStockCount++;
    } else if (stock <= ing.minStock) {
      lowStockCount++;
    }
  }

  return {
    totalIngredients: ingredients.length,
    lowStockCount,
    outOfStockCount,
    totalCostValuation: Number(totalCostValuation.toFixed(2)),
  };
}

/**
 * Actualiza los datos de un ingrediente.
 */
export async function updateIngredient(
  businessId: string,
  ingredientId: string,
  input: UpdateIngredientInput,
  userId?: string | null
): Promise<Ingredient> {
  const parsed = UpdateIngredientInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Obtener ingrediente actual
  const { data: current, error: cErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", ingredientId)
    .eq("business_id", businessId)
    .single();

  if (cErr || !current) {
    throw new Error("El ingrediente no existe o no pertenece a este comercio.");
  }

  const currentMeta = (current.metadata as Record<string, any>) || {};

  const updatedMeta = {
    ...currentMeta,
    product_type: "ingredient",
    unit: parsed.unit ?? currentMeta.unit,
    cost: parsed.costPerUnit ?? currentMeta.cost,
    min_stock: parsed.minStock ?? currentMeta.min_stock,
    max_stock: parsed.maxStock !== undefined ? parsed.maxStock : currentMeta.max_stock,
    available_in_pos: parsed.availableInPos ?? currentMeta.available_in_pos ?? false,
    available_in_qr: parsed.availableInQr ?? currentMeta.available_in_qr ?? false,
    show_in_qr_menu: parsed.availableInQr ?? currentMeta.show_in_qr_menu ?? false,
    available_online: parsed.availableOnline ?? currentMeta.available_online ?? false,
  };

  const productUpdatePayload: Record<string, any> = {
    metadata: updatedMeta,
    updated_at: new Date().toISOString(),
  };

  if (parsed.name) productUpdatePayload.name = parsed.name.trim();
  if (parsed.notes !== undefined) productUpdatePayload.description = parsed.notes?.trim() || null;
  if (parsed.availableInPos !== undefined) productUpdatePayload.available_in_pos = parsed.availableInPos;
  if (parsed.availableInQr !== undefined) productUpdatePayload.available_in_qr = parsed.availableInQr;
  if (parsed.isAvailable !== undefined) productUpdatePayload.is_available = parsed.isAvailable;
  if (parsed.categoryId) productUpdatePayload.category_id = parsed.categoryId;

  let { data: updatedProd, error: uErr } = await supabase
    .from("products")
    .update(productUpdatePayload)
    .eq("id", ingredientId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (
    uErr &&
    (uErr.code === "PGRST204" ||
      String(uErr.message || "").includes("available_in_"))
  ) {
    delete productUpdatePayload.available_in_pos;
    delete productUpdatePayload.available_in_qr;
    const retry = await supabase
      .from("products")
      .update(productUpdatePayload)
      .eq("id", ingredientId)
      .eq("business_id", businessId)
      .select()
      .single();
    updatedProd = retry.data;
    uErr = retry.error;
  }

  if (uErr) {
    throw new Error(`Error al actualizar ingrediente: ${uErr.message}`);
  }

  // 2. Si se actualizó el costo o min_stock, propagar a inventory_stock
  if (parsed.costPerUnit !== undefined || parsed.minStock !== undefined) {
    const stockUpdatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (parsed.costPerUnit !== undefined) stockUpdatePayload.cost = parsed.costPerUnit;
    if (parsed.minStock !== undefined) stockUpdatePayload.min_stock = parsed.minStock;

    await supabase
      .from("inventory_stock")
      .update(stockUpdatePayload)
      .eq("business_id", businessId)
      .eq("product_id", ingredientId);
  }

  return mapProductToIngredient(updatedProd);
}

/**
 * Archiva (elimina lógicamente) un ingrediente.
 */
export async function archiveIngredient(
  businessId: string,
  ingredientId: string
): Promise<void> {
  const supabase = await getDbClient();

  const { error } = await supabase
    .from("products")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", ingredientId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Error al archivar ingrediente: ${error.message}`);
  }
}

// ==========================================
// RECETAS Y ESCANDALLOS [REC-002]
// ==========================================

/**
 * Realiza los cálculos financieros de escandallo y disponibilidad de porciones
 * a partir de los ingredientes de una receta y el stock físico disponible.
 */
export function computeRecipeCalculations(
  recipe: any,
  rawIngredients: any[],
  ingredientsProductData: Map<string, any>,
  stockMap: Map<string, number>,
  costMap: Map<string, number>
): {
  totalCost: number;
  costPerPortion: number;
  marginPercentage: number;
  portionsAvailable: number;
  exactPortionsAvailable: number;
  limitingIngredient: LimitingIngredientInfo | null;
  ingredients: RecipeIngredient[];
} {
  const portions = Math.max(1, Number(recipe.portions) || 1);
  let totalCost = 0;
  let minExactPortions = Infinity;
  let limiting: LimitingIngredientInfo | null = null;
  let hasMandatory = false;

  // 1. Determinar cuello de botella y acumular costos
  for (const ri of rawIngredients) {
    const ingProduct = ingredientsProductData.get(ri.ingredient_id) || {};
    const unitCost = costMap.get(ri.ingredient_id) ?? Number(ingProduct?.metadata?.cost || 0);
    const quantity = Number(ri.quantity) || 0;
    const subtotalCost = Number((quantity * unitCost).toFixed(4));
    const isOptional = Boolean(ri.is_optional);
    const stockQuantity = Math.max(0, stockMap.get(ri.ingredient_id) ?? 0);
    const requiredPerPortion = portions > 0 ? quantity / portions : quantity;

    if (!isOptional) {
      hasMandatory = true;
      totalCost += subtotalCost;

      const ingredientPortionsAvailable = requiredPerPortion > 0
        ? stockQuantity / requiredPerPortion
        : 0;

      if (ingredientPortionsAvailable < minExactPortions) {
        minExactPortions = ingredientPortionsAvailable;
        const formattedPortions = Number(ingredientPortionsAvailable.toFixed(2));
        limiting = {
          ingredientId: ri.ingredient_id,
          name: ingProduct.name || "Ingrediente",
          currentStock: stockQuantity,
          requiredPerPortion: Number(requiredPerPortion.toFixed(4)),
          unit: ri.unit || ingProduct.metadata?.unit || "unidad",
          availablePortions: formattedPortions,
          displayText: `${ingProduct.name || "Ingrediente"} (alcanza para ${formattedPortions} ${formattedPortions === 1 ? "porción" : "porciones"})`,
        };
      }
    }
  }

  const exactPortionsAvailable = hasMandatory
    ? (minExactPortions === Infinity ? 0 : minExactPortions)
    : 0;

  // Criterio de Aceptación: Si disponibilidad = 1.5 porciones -> "1 porción disponible" (truncar al entero con Math.floor)
  const portionsAvailable = Math.floor(Math.max(0, exactPortionsAvailable));

  // 2. Proyectar stock restante por ingrediente
  const ingredients: RecipeIngredient[] = rawIngredients.map((ri) => {
    const ingProduct = ingredientsProductData.get(ri.ingredient_id) || {};
    const unitCost = costMap.get(ri.ingredient_id) ?? Number(ingProduct?.metadata?.cost || 0);
    const quantity = Number(ri.quantity) || 0;
    const subtotalCost = Number((quantity * unitCost).toFixed(4));
    const isOptional = Boolean(ri.is_optional);
    const stockQuantity = Math.max(0, stockMap.get(ri.ingredient_id) ?? 0);
    const requiredPerPortion = portions > 0 ? quantity / portions : quantity;
    const availablePortions = requiredPerPortion > 0
      ? Number((stockQuantity / requiredPerPortion).toFixed(2))
      : 0;
    const projectedRemainingStock = Math.max(
      0,
      Number((stockQuantity - requiredPerPortion * portionsAvailable).toFixed(4))
    );

    return {
      id: ri.id,
      recipeId: ri.recipe_id,
      ingredientId: ri.ingredient_id,
      ingredientName: ingProduct.name || "Ingrediente",
      quantity,
      unit: ri.unit || ingProduct.metadata?.unit || "unidad",
      unitCost,
      subtotalCost,
      isOptional,
      sortOrder: Number(ri.sort_order) || 0,
      stockQuantity,
      requiredPerPortion: Number(requiredPerPortion.toFixed(4)),
      availablePortions,
      projectedRemainingStock,
      createdAt: ri.created_at,
    };
  });

  const costPerPortion = Number((totalCost / portions).toFixed(4));
  const productPrice = Number(recipe.products?.price ?? recipe.product_price ?? 0);
  const marginPercentage =
    productPrice > 0
      ? Number((((productPrice - costPerPortion) / productPrice) * 100).toFixed(2))
      : 0;

  return {
    totalCost: Number(totalCost.toFixed(4)),
    costPerPortion,
    marginPercentage,
    portionsAvailable,
    exactPortionsAvailable: Number(exactPortionsAvailable.toFixed(2)),
    limitingIngredient: hasMandatory ? limiting : null,
    ingredients,
  };
}

/**
 * [REC-004] Función "¿Cuánto me alcanza?" en la ficha de receta:
 * - Para cada ingrediente no opcional: calcula `stock_disponible / cantidad_por_porción`
 * - El cuello de botella es el ingrediente con menor rendimiento
 * - Muestra: porciones posibles, ingrediente cuello de botella, stock restante proyectado
 */
export function calculateRecipeAvailability(
  recipe: RecipeWithDetails,
  desiredPortions?: number
): RecipeAvailabilityResult {
  const portions = Math.max(1, Number(recipe.portions) || 1);
  const targetPortions =
    desiredPortions !== undefined && desiredPortions >= 0
      ? desiredPortions
      : recipe.portionsAvailable;

  const calculatedIngredients = recipe.ingredients.map((ing) => {
    const requiredPerPortion =
      ing.requiredPerPortion ?? (portions > 0 ? ing.quantity / portions : ing.quantity);
    const currentStock = Math.max(0, ing.stockQuantity);
    const availablePortions =
      requiredPerPortion > 0 ? Number((currentStock / requiredPerPortion).toFixed(2)) : 0;
    const projectedRemainingStock = Math.max(
      0,
      Number((currentStock - requiredPerPortion * targetPortions).toFixed(4))
    );
    const isLimiting = Boolean(
      recipe.limitingIngredient && recipe.limitingIngredient.ingredientId === ing.ingredientId
    );

    return {
      ingredientId: ing.ingredientId,
      ingredientName: ing.ingredientName,
      unit: ing.unit,
      isOptional: ing.isOptional,
      currentStock,
      requiredPerPortion: Number(requiredPerPortion.toFixed(4)),
      availablePortions,
      projectedRemainingStock,
      isLimiting,
    };
  });

  return {
    recipeId: recipe.id,
    productId: recipe.productId,
    productName: recipe.productName,
    portionsAvailable: recipe.portionsAvailable,
    exactPortionsAvailable: recipe.exactPortionsAvailable ?? recipe.portionsAvailable,
    isOutOfStock: recipe.portionsAvailable <= 0,
    limitingIngredient: recipe.limitingIngredient || null,
    ingredients: calculatedIngredients,
  };
}

/**
 * [REC-004] Obtiene el cálculo de disponibilidad y cuello de botella de la receta activa
 * de un producto específico.
 */
export async function getProductRecipeAvailability(
  businessId: string,
  productId: string
): Promise<RecipeAvailabilityResult | null> {
  const recipe = await getRecipeByProductId(businessId, productId);
  if (!recipe) {
    return null;
  }
  return calculateRecipeAvailability(recipe);
}

/**
 * [REC-004] Obtiene en lote el mapa de disponibilidad de recetas para los productos de un negocio.
 * Retorna Map<productId, RecipeAvailabilityResult>.
 */
export async function getProductsRecipeAvailabilityMap(
  businessId: string,
  productIds?: string[]
): Promise<Map<string, RecipeAvailabilityResult>> {
  const recipes = await getRecipes(businessId, { status: "active" });
  const map = new Map<string, RecipeAvailabilityResult>();

  for (const recipe of recipes) {
    if (!productIds || productIds.includes(recipe.productId)) {
      map.set(recipe.productId, calculateRecipeAvailability(recipe));
    }
  }

  return map;
}

/**
 * [REC-004] Enriquece una lista de productos con la información de disponibilidad de receta.
 * Regla de Negocio: Si el producto tiene receta activa y su cuello de botella es 0 porciones,
 * se marca automáticamente como 'is_available = false' ("Agotado" en el POS).
 */
export async function enrichProductsWithRecipeAvailability<
  T extends { id: string; metadata?: any; is_available?: boolean }
>(businessId: string, products: T[]): Promise<T[]> {
  if (!products || products.length === 0) return products;

  try {
    const availabilityMap = await getProductsRecipeAvailabilityMap(
      businessId,
      products.map((p) => p.id)
    );

    if (availabilityMap.size === 0) {
      return products;
    }

    return products.map((product) => {
      const recipeAvail = availabilityMap.get(product.id);
      if (!recipeAvail) {
        return product;
      }

      const isOutOfStockByRecipe = recipeAvail.portionsAvailable <= 0;
      const currentIsAvailable = product.is_available !== false;

      return {
        ...product,
        // Si el cuello de botella es 0 porciones, se marca como 'Agotado' automáticamente
        is_available: currentIsAvailable && !isOutOfStockByRecipe,
        metadata: {
          ...(product.metadata || {}),
          has_recipe: true,
          recipe_id: recipeAvail.recipeId,
          recipe_portions_available: recipeAvail.portionsAvailable,
          recipe_exact_portions: recipeAvail.exactPortionsAvailable,
          recipe_limiting_ingredient: recipeAvail.limitingIngredient,
          recipe_is_out_of_stock: isOutOfStockByRecipe,
        },
      };
    });
  } catch (error) {
    console.error("[enrichProductsWithRecipeAvailability] Error:", error);
    return products;
  }
}

/**
 * Consulta todas las recetas del negocio con filtros y cálculos en tiempo real.
 */
export async function getRecipes(
  businessId: string,
  filters: RecipeFilters = {}
): Promise<RecipeWithDetails[]> {
  const supabase = await getDbClient();

  let query = supabase
    .from("recipes")
    .select(`
      id,
      business_id,
      product_id,
      name,
      description,
      portions,
      prep_time_minutes,
      location_id,
      status,
      created_at,
      updated_at,
      products(id, name, price, image_url, category_id, metadata, categories(id, name)),
      locations(id, name)
    `)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  } else {
    query = query.neq("status", "archived");
  }

  if (filters.productId) {
    query = query.eq("product_id", filters.productId);
  }

  if (filters.locationId) {
    query = query.eq("location_id", filters.locationId);
  }

  const { data: recipesData, error: rErr } = await query;
  if (rErr) {
    throw new Error(`Error al consultar recetas: ${rErr.message}`);
  }

  if (!recipesData || recipesData.length === 0) {
    return [];
  }

  const recipeIds = recipesData.map((r: any) => r.id);

  // 1. Consultar todos los ingredientes asociados a estas recetas
  const { data: riData, error: riErr } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .in("recipe_id", recipeIds)
    .order("sort_order", { ascending: true });

  if (riErr) {
    throw new Error(`Error al consultar ingredientes de recetas: ${riErr.message}`);
  }

  const allIngredientIds = Array.from(
    new Set((riData || []).map((ri: any) => ri.ingredient_id))
  );

  // 2. Consultar datos de los productos ingrediente
  let productsMap = new Map<string, any>();
  if (allIngredientIds.length > 0) {
    const { data: pData } = await supabase
      .from("products")
      .select("id, name, metadata, price")
      .in("id", allIngredientIds);

    (pData || []).forEach((p: any) => productsMap.set(p.id, p));
  }

  // 3. Consultar stock consolidado de cada ingrediente
  let stockRows: any[] = [];
  if (allIngredientIds.length > 0) {
    const { data: sData } = await supabase
      .from("inventory_stock")
      .select("product_id, location_id, quantity, cost")
      .eq("business_id", businessId)
      .in("product_id", allIngredientIds);

    stockRows = sData || [];
  }

  // 4. Mapear cada receta con sus cálculos
  const results: RecipeWithDetails[] = [];

  for (const recipe of recipesData) {
    const thisRecipeIngredients = (riData || []).filter(
      (ri: any) => ri.recipe_id === recipe.id
    );

    // Armar mapas de stock y costo para esta receta
    const stockMap = new Map<string, number>();
    const costMap = new Map<string, number>();

    allIngredientIds.forEach((ingId) => {
      // Filtrar filas de stock para este ingrediente
      let ingStockRows = stockRows.filter((s) => s.product_id === ingId);
      if (recipe.location_id) {
        // Si la receta tiene ubicación asignada, preferir el stock de esa ubicación
        const locStock = ingStockRows.filter((s) => s.location_id === recipe.location_id);
        if (locStock.length > 0) {
          ingStockRows = locStock;
        }
      }

      const totalQty = ingStockRows.reduce((acc, row) => acc + Number(row.quantity || 0), 0);
      const unitCost = Number(
        ingStockRows[0]?.cost ?? productsMap.get(ingId)?.metadata?.cost ?? 0
      );

      stockMap.set(ingId, totalQty);
      costMap.set(ingId, unitCost);
    });

    const calc = computeRecipeCalculations(
      recipe,
      thisRecipeIngredients,
      productsMap,
      stockMap,
      costMap
    );

    const prodRel = Array.isArray(recipe.products) ? (recipe.products[0] as any) : (recipe.products as any);
    const categoryRel = Array.isArray(prodRel?.categories) ? prodRel.categories[0] : prodRel?.categories;
    const locRel = Array.isArray(recipe.locations) ? (recipe.locations[0] as any) : (recipe.locations as any);
    const productName = prodRel?.name || "Producto no encontrado";
    const productPrice = Number(prodRel?.price || 0);
    const productCategory = categoryRel?.name || prodRel?.metadata?.category_name || null;
    const productImageUrl = prodRel?.image_url || prodRel?.metadata?.image_url || null;
    const productStock = prodRel?.metadata?.stock_quantity !== undefined ? Number(prodRel.metadata.stock_quantity) : null;

    // Filtro por búsqueda de texto si aplica
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchesName = recipe.name.toLowerCase().includes(q);
      const matchesProduct = productName.toLowerCase().includes(q);
      if (!matchesName && !matchesProduct) {
        continue;
      }
    }

    results.push({
      id: recipe.id,
      businessId: recipe.business_id,
      productId: recipe.product_id,
      name: recipe.name,
      description: recipe.description,
      portions: recipe.portions,
      prepTimeMinutes: recipe.prep_time_minutes,
      locationId: recipe.location_id,
      status: recipe.status,
      createdAt: recipe.created_at,
      updatedAt: recipe.updated_at,
      productName,
      productPrice,
      productSku: prodRel?.metadata?.sku || null,
      productCategory,
      productImageUrl,
      productStock,
      locationName: locRel?.name || null,
      ingredients: calc.ingredients,
      totalCost: calc.totalCost,
      costPerPortion: calc.costPerPortion,
      marginPercentage: calc.marginPercentage,
      portionsAvailable: calc.portionsAvailable,
      exactPortionsAvailable: calc.exactPortionsAvailable,
      limitingIngredient: calc.limitingIngredient,
    });
  }

  return results;
}

/**
 * Consulta una receta específica por su ID con todo el detalle de ingredientes y cálculos.
 */
export async function getRecipeById(
  businessId: string,
  recipeId: string
): Promise<RecipeWithDetails | null> {
  const supabase = await getDbClient();

  const { data: recipe, error: rErr } = await supabase
    .from("recipes")
    .select(`
      id,
      business_id,
      product_id,
      name,
      description,
      portions,
      prep_time_minutes,
      location_id,
      status,
      created_at,
      updated_at,
      products(id, name, price, image_url, category_id, metadata, categories(id, name)),
      locations(id, name)
    `)
    .eq("id", recipeId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (rErr || !recipe) {
    return null;
  }

  // Consultar ingredientes de la receta
  const { data: riData } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("sort_order", { ascending: true });

  const rawIngredients = riData || [];
  const ingredientIds = rawIngredients.map((ri: any) => ri.ingredient_id);

  let productsMap = new Map<string, any>();
  if (ingredientIds.length > 0) {
    const { data: pData } = await supabase
      .from("products")
      .select("id, name, metadata, price")
      .in("id", ingredientIds);

    (pData || []).forEach((p: any) => productsMap.set(p.id, p));
  }

  let stockRows: any[] = [];
  if (ingredientIds.length > 0) {
    const { data: sData } = await supabase
      .from("inventory_stock")
      .select("product_id, location_id, quantity, cost")
      .eq("business_id", businessId)
      .in("product_id", ingredientIds);

    stockRows = sData || [];
  }

  const stockMap = new Map<string, number>();
  const costMap = new Map<string, number>();

  ingredientIds.forEach((ingId) => {
    let ingStockRows = stockRows.filter((s) => s.product_id === ingId);
    if (recipe.location_id) {
      const locStock = ingStockRows.filter((s) => s.location_id === recipe.location_id);
      if (locStock.length > 0) ingStockRows = locStock;
    }

    const totalQty = ingStockRows.reduce((acc, row) => acc + Number(row.quantity || 0), 0);
    const unitCost = Number(
      ingStockRows[0]?.cost ?? productsMap.get(ingId)?.metadata?.cost ?? 0
    );

    stockMap.set(ingId, totalQty);
    costMap.set(ingId, unitCost);
  });

  const calc = computeRecipeCalculations(
    recipe,
    rawIngredients,
    productsMap,
    stockMap,
    costMap
  );

  const prodRel = Array.isArray(recipe.products) ? (recipe.products[0] as any) : (recipe.products as any);
  const categoryRel = Array.isArray(prodRel?.categories) ? prodRel.categories[0] : prodRel?.categories;
  const locRel = Array.isArray(recipe.locations) ? (recipe.locations[0] as any) : (recipe.locations as any);

  return {
    id: recipe.id,
    businessId: recipe.business_id,
    productId: recipe.product_id,
    name: recipe.name,
    description: recipe.description,
    portions: recipe.portions,
    prepTimeMinutes: recipe.prep_time_minutes,
    locationId: recipe.location_id,
    status: recipe.status,
    createdAt: recipe.created_at,
    updatedAt: recipe.updated_at,
    productName: prodRel?.name || "Producto",
    productPrice: Number(prodRel?.price || 0),
    productSku: prodRel?.metadata?.sku || null,
    productCategory: categoryRel?.name || prodRel?.metadata?.category_name || null,
    productImageUrl: prodRel?.image_url || prodRel?.metadata?.image_url || null,
    productStock: prodRel?.metadata?.stock_quantity !== undefined ? Number(prodRel.metadata.stock_quantity) : null,
    locationName: locRel?.name || null,
    ingredients: calc.ingredients,
    totalCost: calc.totalCost,
    costPerPortion: calc.costPerPortion,
    marginPercentage: calc.marginPercentage,
    portionsAvailable: calc.portionsAvailable,
    exactPortionsAvailable: calc.exactPortionsAvailable,
    limitingIngredient: calc.limitingIngredient,
  };
}

/**
 * Consulta la receta activa vinculada a un producto específico.
 */
export async function getRecipeByProductId(
  businessId: string,
  productId: string
): Promise<RecipeWithDetails | null> {
  const supabase = await getDbClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("business_id", businessId)
    .eq("product_id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (!recipe) {
    return null;
  }

  return await getRecipeById(businessId, recipe.id);
}

/**
 * Crea una nueva receta vinculada a un producto, con validación de unicidad
 * y desglose de ingredientes.
 */
export async function createRecipe(
  businessId: string,
  input: CreateRecipeInput,
  userId?: string
): Promise<RecipeWithDetails> {
  // Validación de límites de suscripción en servidor [SUB-001]
  await assertPlanLimit(businessId, "recipes");

  const parsed = CreateRecipeInputSchema.parse(input);
  const supabase = await getDbClient();

  // 1. Validar que el producto exista y pertenezca al negocio
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("id, name, price, metadata, business_id")
    .eq("id", parsed.productId)
    .eq("business_id", businessId)
    .single();

  if (pErr || !product) {
    throw new Error("El producto seleccionado no existe o no pertenece a este negocio.");
  }

  // 2. Validar que no exista ya una receta activa para este producto
  const { data: existingActive } = await supabase
    .from("recipes")
    .select("id")
    .eq("business_id", businessId)
    .eq("product_id", parsed.productId)
    .eq("status", "active")
    .maybeSingle();

  if (existingActive) {
    throw new Error(
      "El producto ya cuenta con una receta activa vinculada. Edita la receta existente o desactívala."
    );
  }

  // 3. Insertar la cabecera de la receta
  const recipePayload = {
    business_id: businessId,
    product_id: parsed.productId,
    name: parsed.name.trim(),
    description: parsed.description?.trim() || null,
    portions: parsed.portions,
    prep_time_minutes: parsed.prepTimeMinutes ?? null,
    location_id: parsed.locationId || null,
    status: "active",
  };

  const { data: createdRecipe, error: rErr } = await supabase
    .from("recipes")
    .insert(recipePayload)
    .select()
    .single();

  if (rErr || !createdRecipe) {
    throw new Error(`Error al crear la receta: ${rErr?.message || "Desconocido"}`);
  }

  // 4. Insertar los ingredientes de la receta
  const ingredientsPayload = parsed.ingredients.map((item, idx) => ({
    recipe_id: createdRecipe.id,
    ingredient_id: item.ingredientId,
    quantity: item.quantity,
    unit: item.unit.trim(),
    is_optional: Boolean(item.isOptional),
    sort_order: item.sortOrder ?? idx,
  }));

  const { error: iErr } = await supabase
    .from("recipe_ingredients")
    .insert(ingredientsPayload);

  if (iErr) {
    // Si falla la inserción de ingredientes, eliminar la cabecera creada
    await supabase.from("recipes").delete().eq("id", createdRecipe.id);
    throw new Error(`Error al registrar ingredientes de la receta: ${iErr.message}`);
  }

  // 5. Retornar la receta completa con sus cálculos
  const result = await getRecipeById(businessId, createdRecipe.id);
  if (!result) {
    throw new Error("No se pudo obtener la receta creada.");
  }
  return result;
}

/**
 * Actualiza una receta existente y sus ingredientes.
 */
export async function updateRecipe(
  businessId: string,
  recipeId: string,
  input: UpdateRecipeInput,
  userId?: string
): Promise<RecipeWithDetails> {
  const parsed = UpdateRecipeInputSchema.parse(input);
  const supabase = await getDbClient();

  const { data: existing, error: eErr } = await supabase
    .from("recipes")
    .select("id, business_id, product_id, status")
    .eq("id", recipeId)
    .eq("business_id", businessId)
    .single();

  if (eErr || !existing) {
    throw new Error("Receta no encontrada.");
  }

  // Si se cambia a activo, validar que no haya otra receta activa para el mismo producto
  if (parsed.status === "active" && existing.status !== "active") {
    const { data: otherActive } = await supabase
      .from("recipes")
      .select("id")
      .eq("business_id", businessId)
      .eq("product_id", existing.product_id)
      .eq("status", "active")
      .neq("id", recipeId)
      .maybeSingle();

    if (otherActive) {
      throw new Error("Ya existe otra receta activa vinculada a este producto.");
    }
  }

  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (parsed.name !== undefined) updatePayload.name = parsed.name.trim();
  if (parsed.description !== undefined) updatePayload.description = parsed.description?.trim() || null;
  if (parsed.portions !== undefined) updatePayload.portions = parsed.portions;
  if (parsed.prepTimeMinutes !== undefined) updatePayload.prep_time_minutes = parsed.prepTimeMinutes;
  if (parsed.locationId !== undefined) updatePayload.location_id = parsed.locationId || null;
  if (parsed.status !== undefined) updatePayload.status = parsed.status;

  const { error: uErr } = await supabase
    .from("recipes")
    .update(updatePayload)
    .eq("id", recipeId)
    .eq("business_id", businessId);

  if (uErr) {
    throw new Error(`Error al actualizar la receta: ${uErr.message}`);
  }

  // Si se proveen nuevos ingredientes, reemplazar los anteriores
  if (parsed.ingredients && parsed.ingredients.length > 0) {
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);

    const newIngredients = parsed.ingredients.map((item, idx) => ({
      recipe_id: recipeId,
      ingredient_id: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit.trim(),
      is_optional: Boolean(item.isOptional),
      sort_order: item.sortOrder ?? idx,
    }));

    const { error: iErr } = await supabase.from("recipe_ingredients").insert(newIngredients);
    if (iErr) {
      throw new Error(`Error al actualizar ingredientes: ${iErr.message}`);
    }
  }

  const result = await getRecipeById(businessId, recipeId);
  if (!result) {
    throw new Error("No se pudo obtener la receta actualizada.");
  }
  return result;
}

/**
 * Elimina o archiva una receta.
 */
export async function deleteRecipe(
  businessId: string,
  recipeId: string
): Promise<void> {
  const supabase = await getDbClient();

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", recipeId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Error al eliminar la receta: ${error.message}`);
  }
}

/**
 * Duplica una receta existente creando una copia inactiva con "(Copia)" en el nombre.
 */
export async function duplicateRecipe(
  businessId: string,
  recipeId: string,
  userId?: string | null
): Promise<RecipeWithDetails> {
  const original = await getRecipeById(businessId, recipeId);
  if (!original) {
    throw new Error("La receta a duplicar no existe.");
  }

  const supabase = await getDbClient();

  const recipePayload = {
    business_id: businessId,
    product_id: original.productId,
    name: `${original.name} (Copia)`,
    description: original.description,
    portions: original.portions,
    prep_time_minutes: original.prepTimeMinutes,
    location_id: original.locationId,
    status: "inactive",
  };

  const { data: createdRecipe, error: rErr } = await supabase
    .from("recipes")
    .insert(recipePayload)
    .select()
    .single();

  if (rErr || !createdRecipe) {
    throw new Error(`Error al duplicar la receta: ${rErr?.message || "Desconocido"}`);
  }

  if (original.ingredients && original.ingredients.length > 0) {
    const ingredientsPayload = original.ingredients.map((item, idx) => ({
      recipe_id: createdRecipe.id,
      ingredient_id: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit.trim(),
      is_optional: Boolean(item.isOptional),
      sort_order: item.sortOrder ?? idx,
    }));

    const { error: iErr } = await supabase
      .from("recipe_ingredients")
      .insert(ingredientsPayload);

    if (iErr) {
      await supabase.from("recipes").delete().eq("id", createdRecipe.id);
      throw new Error(`Error al duplicar los ingredientes: ${iErr.message}`);
    }
  }

  const duplicated = await getRecipeById(businessId, createdRecipe.id);
  if (!duplicated) {
    throw new Error("No se pudo cargar la receta duplicada.");
  }
  return duplicated;
}

// ==========================================
// DESCUENTO DE INGREDIENTES EN VENTA [REC-003]
// ==========================================

export interface RecipeSaleItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface IngredientDeductionResult {
  ingredientId: string;
  ingredientName: string;
  locationId: string;
  quantityDeducted: number;
  unit: string;
  unitCost: number;
  movementId: string;
}

/**
 * [REC-003] Valida existencias y descuenta de forma proporcional los ingredientes
 * de recetas activas para una venta o comanda.
 * 
 * Si un ingrediente obligatorio no tiene existencias suficientes, lanza una excepción
 * descriptiva sin realizar ninguna deducción (garantía todo o nada).
 * Los ingredientes opcionales NO se descuentan automáticamente y no bloquean la venta.
 */
export async function deductRecipeIngredientsForSale(
  businessId: string,
  items: RecipeSaleItem[],
  referenceId: string,
  orderNumber?: number,
  userId?: string
): Promise<{
  success: boolean;
  deductedIngredients: IngredientDeductionResult[];
}> {
  const supabase = await getDbClient();

  // 1. Resolver recetas activas para los productos vendidos
  const productIds = Array.from(new Set(items.map((it) => it.productId)));

  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, product_id, portions, location_id, status")
    .eq("business_id", businessId)
    .in("product_id", productIds)
    .eq("status", "active");

  const activeRecipes = recipes || [];
  if (activeRecipes.length === 0) {
    return { success: true, deductedIngredients: [] };
  }

  const recipeIds = activeRecipes.map((r: any) => r.id);

  // 2. Consultar ingredientes de estas recetas
  const { data: recipeIngredients } = await supabase
    .from("recipe_ingredients")
    .select("id, recipe_id, ingredient_id, quantity, unit, is_optional, products(id, name, metadata)")
    .in("recipe_id", recipeIds)
    .order("sort_order", { ascending: true });

  const rawIngredients = recipeIngredients || [];

  // Obtener ubicación por defecto
  const defaultLoc = await ensureDefaultLocation(businessId);
  const defaultLocationId = defaultLoc.id;

  // 3. FASE 1: Calcular necesidades agregadas de ingredientes obligatorios y validar existencias
  interface RequiredIngredientAccumulator {
    ingredientId: string;
    ingredientName: string;
    unit: string;
    locationId: string;
    requiredQty: number;
    unitCost: number;
  }

  const requiredMap = new Map<string, RequiredIngredientAccumulator>();

  for (const item of items) {
    const recipe = activeRecipes.find((r: any) => r.product_id === item.productId);
    if (!recipe) continue;

    const portions = Math.max(1, Number(recipe.portions) || 1);
    const targetLocationId = recipe.location_id || defaultLocationId;

    const ings = rawIngredients.filter((ri: any) => ri.recipe_id === recipe.id);
    for (const ri of ings) {
      // Regla de Negocio: ingredientes opcionales NO se descuentan automáticamente ni bloquean
      if (ri.is_optional) continue;

      const ingProd = Array.isArray(ri.products) ? ri.products[0] : ri.products;
      const ingName = ingProd?.name || "Ingrediente";
      const deductionPerItem = (item.quantity * Number(ri.quantity)) / portions;

      const key = `${ri.ingredient_id}_${targetLocationId}`;
      const existing = requiredMap.get(key);

      const unitCost = Number(ingProd?.metadata?.cost || 0);

      if (existing) {
        existing.requiredQty += deductionPerItem;
      } else {
        requiredMap.set(key, {
          ingredientId: ri.ingredient_id,
          ingredientName: ingName,
          unit: ri.unit || "unidad",
          locationId: targetLocationId,
          requiredQty: deductionPerItem,
          unitCost,
        });
      }
    }
  }

  // Si ninguno de los productos vendidos tiene ingredientes obligatorios con receta
  if (requiredMap.size === 0) {
    return { success: true, deductedIngredients: [] };
  }

  // Consultar stock actual de los ingredientes obligatorios
  const ingredientIds = Array.from(new Set(Array.from(requiredMap.values()).map((v) => v.ingredientId)));

  const { data: stockRows } = await supabase
    .from("inventory_stock")
    .select("product_id, location_id, quantity, cost")
    .eq("business_id", businessId)
    .in("product_id", ingredientIds);

  const stocks = stockRows || [];

  // Validar disponibilidad de cada ingrediente obligatorio
  for (const req of Array.from(requiredMap.values())) {
    const stockRow = stocks.find(
      (s: any) => s.product_id === req.ingredientId && s.location_id === req.locationId
    );
    const availableQty = Number(stockRow?.quantity ?? 0);

    if (availableQty < req.requiredQty) {
      const dispAvail = availableQty === 0 ? "0" : String(parseFloat(availableQty.toFixed(4)));
      const dispReq = req.requiredQty === 0 ? "0" : String(parseFloat(req.requiredQty.toFixed(4)));

      throw new Error(
        `Existencias insuficientes para «${req.ingredientName}». Disponibles: ${dispAvail} ${req.unit}, requeridas: ${dispReq} ${req.unit}`
      );
    }

    if (stockRow && stockRow.cost !== undefined) {
      req.unitCost = Number(stockRow.cost);
    }
  }

  // 4. FASE 2: Deducción de inventario y registro en Kardex
  const deductedResults: IngredientDeductionResult[] = [];
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validReferenceId = referenceId && uuidRegex.test(referenceId) ? referenceId : null;

  for (const req of Array.from(requiredMap.values())) {
    await recordInventoryMovement(
      businessId,
      {
        productId: req.ingredientId,
        locationId: req.locationId,
        movementType: "sale",
        quantity: req.requiredQty,
        unitCost: req.unitCost,
        referenceId: validReferenceId,
        referenceType: "sale",
        notes: `Descuento por receta (pedido #${orderNumber || referenceId.slice(0, 8)})`,
      },
      userId
    );

    deductedResults.push({
      ingredientId: req.ingredientId,
      ingredientName: req.ingredientName,
      locationId: req.locationId,
      quantityDeducted: req.requiredQty,
      unit: req.unit,
      unitCost: req.unitCost,
      movementId: referenceId,
    });
  }

  return { success: true, deductedIngredients: deductedResults };
}

