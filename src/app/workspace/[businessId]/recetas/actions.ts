"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { revalidatePath } from "next/cache";
import {
  createIngredient,
  getIngredients,
  getIngredientKPIs,
  updateIngredient,
  archiveIngredient,
  getRecipesUsingIngredient,
  createRecipe,
  getRecipes,
  getRecipeById,
  getRecipeByProductId,
  updateRecipe,
  deleteRecipe,
  duplicateRecipe,
  deductRecipeIngredientsForSale,
  RecipeSaleItem,
  getProductRecipeAvailability,
  calculateRecipeAvailability,
} from "@/lib/recipes/recipe-service";
import {
  generateIngredientsCSV,
  generateIngredientsExcel,
} from "@/lib/recipes/ingredient-export-service";
import {
  CreateIngredientInput,
  UpdateIngredientInput,
  IngredientFilters,
  Ingredient,
  IngredientKPIs,
  CreateRecipeInput,
  UpdateRecipeInput,
  RecipeWithDetails,
  RecipeFilters,
  RecipeAvailabilityResult,
} from "@/lib/recipes/types";
import {
  validateIngredientRows,
  importIngredientsBatch,
  RawIngredientImportRow,
  ValidatedIngredientRow,
  ParsedIngredientResult,
  ImportIngredientsBatchResult,
} from "@/lib/recipes/ingredient-import-service";
import { getCategories } from "@/lib/products/products-service";

/**
 * Verificadores de permisos adaptables para materiales (Ingredientes e Insumos):
 * Permite acceso tanto en gastronómicos (recipes.*) como universales (products.* / inventory.*).
 */
async function verifyMaterialViewAction(businessId: string) {
  let auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "products.view");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "recipes.view");
  }
  return auth;
}

async function verifyMaterialCreateAction(businessId: string) {
  let auth = await verifyWorkspaceAction(businessId, "inventory.create");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "products.create");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "recipes.create");
  }
  return auth;
}

async function verifyMaterialUpdateAction(businessId: string) {
  let auth = await verifyWorkspaceAction(businessId, "products.update");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "inventory.create");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "recipes.update");
  }
  return auth;
}

// ==========================================
// INGREDIENTES E INSUMOS (REC-001)
// ==========================================

/**
 * Consulta la lista de ingredientes del comercio.
 * Permiso requerido: inventory.view, products.view o recipes.view
 */
export async function getIngredientsAction(
  businessId: string,
  filters: IngredientFilters = {}
): Promise<{ success: boolean; data?: Ingredient[]; error?: string }> {
  const auth = await verifyMaterialViewAction(businessId);
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver ingredientes e insumos." };
  }

  try {
    const data = await getIngredients(businessId, filters);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar ingredientes e insumos." };
  }
}

/**
 * Consulta los KPIs consolidados de ingredientes e insumos.
 * Permiso requerido: inventory.view, products.view o recipes.view
 */
export async function getIngredientKPIsAction(
  businessId: string
): Promise<{ success: boolean; data?: IngredientKPIs; error?: string }> {
  const auth = await verifyMaterialViewAction(businessId);
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver métricas de materiales." };
  }

  try {
    const data = await getIngredientKPIs(businessId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al calcular métricas de materiales." };
  }
}

/**
 * Crea un nuevo ingrediente o insumo como producto tipo "ingredient" con stock y kardex inicial.
 * Permiso requerido: inventory.create, products.create o recipes.create
 */
export async function createIngredientAction(
  businessId: string,
  input: CreateIngredientInput
): Promise<{ success: boolean; data?: Ingredient; error?: string }> {
  const auth = await verifyMaterialCreateAction(businessId);
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar materiales." };
  }

  try {
    const data = await createIngredient(businessId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/ingredientes`);
    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al crear el material." };
  }
}

/**
 * Actualiza la información y costo de un ingrediente o insumo.
 * Permiso requerido: products.update, inventory.create o recipes.update
 */
export async function updateIngredientAction(
  businessId: string,
  ingredientId: string,
  input: UpdateIngredientInput
): Promise<{ success: boolean; data?: Ingredient; error?: string }> {
  const auth = await verifyMaterialUpdateAction(businessId);
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para editar materiales." };
  }

  try {
    const data = await updateIngredient(businessId, ingredientId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/ingredientes`);
    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar el material." };
  }
}

/**
 * Alterna el estado activo / inactivo de un ingrediente o insumo.
 */
export async function toggleIngredientAvailabilityAction(
  businessId: string,
  ingredientId: string,
  isAvailable: boolean
): Promise<{ success: boolean; data?: Ingredient; error?: string }> {
  const auth = await verifyMaterialUpdateAction(businessId);
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para modificar materiales." };
  }

  try {
    const data = await updateIngredient(businessId, ingredientId, { isAvailable }, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/ingredientes`);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al cambiar estado del material." };
  }
}

/**
 * Consulta qué recetas utilizan un ingrediente antes de inactivarlo o archivarlo.
 */
export async function getRecipesUsingIngredientAction(
  businessId: string,
  ingredientId: string
): Promise<{ success: boolean; data?: Array<{ recipeId: string; recipeName: string; productName: string; status: string }>; error?: string }> {
  const auth = await verifyMaterialViewAction(businessId);
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar recetas." };
  }

  try {
    const data = await getRecipesUsingIngredient(businessId, ingredientId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar recetas vinculadas." };
  }
}

/**
 * Exporta los ingredientes e insumos del comercio a formato CSV.
 */
export async function exportIngredientsCSVAction(
  businessId: string
): Promise<{ success: boolean; csv?: string; filename?: string; error?: string }> {
  const auth = await verifyMaterialViewAction(businessId);
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para exportar datos." };
  }

  try {
    const ingredients = await getIngredients(businessId);
    const csv = generateIngredientsCSV(ingredients);
    const dateStr = new Date().toISOString().slice(0, 10);
    return {
      success: true,
      csv,
      filename: `ingredientes_insumos_${dateStr}.csv`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al exportar a CSV." };
  }
}

/**
 * Exporta los ingredientes e insumos del comercio a formato Excel Base64.
 */
export async function exportIngredientsExcelAction(
  businessId: string
): Promise<{ success: boolean; base64?: string; filename?: string; error?: string }> {
  const auth = await verifyMaterialViewAction(businessId);
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para exportar datos." };
  }

  try {
    const ingredients = await getIngredients(businessId);
    const excelBytes = generateIngredientsExcel(ingredients);
    const base64 = Buffer.from(excelBytes).toString("base64");
    const dateStr = new Date().toISOString().slice(0, 10);
    return {
      success: true,
      base64,
      filename: `ingredientes_insumos_${dateStr}.xlsx`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al exportar a Excel." };
  }
}

/**
 * Consulta las categorías activas del negocio para el selector de ingredientes e insumos.
 */
export async function getMaterialCategoriesAction(
  businessId: string
): Promise<{ success: boolean; data?: Array<{ id: string; name: string }>; error?: string }> {
  const auth = await verifyMaterialViewAction(businessId);
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar categorías." };
  }

  try {
    // Consultar categorías clasificadas para uso interno o mixto [CAT-SCOPE-001]
    let cats = await getCategories(businessId, undefined, "internal");
    
    // Si aún no existen categorías internas pero hay categorías globales sin clasificar (migración inicial),
    // ofrecerlas para garantizar retrocompatibilidad fluida
    if (cats.length === 0) {
      const allCats = await getCategories(businessId, undefined, "all");
      const hasStrictScope = allCats.some((c: any) => c.scope === "internal");
      if (!hasStrictScope) {
        cats = allCats;
      }
    }

    return {
      success: true,
      data: cats.map((c) => ({ id: c.id, name: c.name })),
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar categorías." };
  }
}

/**
 * Crea una categoría técnica/operativa para materias primas e insumos (scope 'internal') [CAT-SCOPE-001].
 * Permiso requerido: inventory.create, products.create o recipes.create
 */
export async function createMaterialCategoryAction(
  businessId: string,
  input: { name: string; description?: string }
): Promise<{ success: boolean; data?: { id: string; name: string }; error?: string }> {
  const auth = await verifyMaterialCreateAction(businessId);
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para crear categorías de materiales." };
  }

  try {
    const trimmed = (input.name || "").trim();
    if (!trimmed) {
      return { success: false, error: "El nombre de la categoría es obligatorio." };
    }

    const { createCategory } = await import("@/lib/products/products-service");
    const created = await createCategory(businessId, {
      name: trimmed,
      description: input.description?.trim() || null,
      scope: "internal",
    } as any);

    revalidatePath(`/workspace/${businessId}/ingredientes`);
    revalidatePath(`/workspace/${businessId}/recetas`);

    return {
      success: true,
      data: { id: created.id, name: created.name },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al crear la categoría de material." };
  }
}

/**
 * Archiva (elimina lógicamente) un ingrediente.
 * Permiso requerido: products.delete o recipes.delete
 */
export async function archiveIngredientAction(
  businessId: string,
  ingredientId: string
): Promise<{ success: boolean; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "products.delete");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "recipes.delete");
  }
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para eliminar materiales." };
  }

  try {
    // Validar si está en recetas activas
    const linkedRecipes = await getRecipesUsingIngredient(businessId, ingredientId);
    const activeLinked = linkedRecipes.filter((r) => r.status === "active");
    if (activeLinked.length > 0) {
      const names = activeLinked.map((r) => `«${r.recipeName}» (${r.productName})`).join(", ");
      return {
        success: false,
        error: `No se puede eliminar porque está en uso en las siguientes recetas activas: ${names}. Desactiva las recetas primero.`,
      };
    }

    await archiveIngredient(businessId, ingredientId);
    revalidatePath(`/workspace/${businessId}/ingredientes`);
    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al archivar el ingrediente." };
  }
}

// ==========================================
// RECETAS Y ESCANDALLOS (REC-002)
// ==========================================

/**
 * Consulta las recetas y escandallos del comercio con filtros opcionales.
 * Permiso requerido: recipes.view
 */
export async function getRecipesAction(
  businessId: string,
  filters: RecipeFilters = {}
): Promise<{ success: boolean; data: RecipeWithDetails[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver recetas.", data: [] };
  }

  try {
    const data = await getRecipes(businessId, filters);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar recetas.", data: [] };
  }
}

/**
 * Consulta el detalle completo de una receta por su ID.
 * Permiso requerido: recipes.view
 */
export async function getRecipeByIdAction(
  businessId: string,
  recipeId: string
): Promise<{ success: boolean; data?: RecipeWithDetails | null; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver recetas." };
  }

  try {
    const data = await getRecipeById(businessId, recipeId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al obtener la receta." };
  }
}

/**
 * Consulta la receta activa vinculada a un producto específico.
 * Permiso requerido: recipes.view o products.view
 */
export async function getRecipeByProductIdAction(
  businessId: string,
  productId: string
): Promise<{ success: boolean; data?: RecipeWithDetails | null; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver recetas." };
  }

  try {
    const data = await getRecipeByProductId(businessId, productId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar la receta del producto." };
  }
}

/**
 * Crea una nueva receta vinculada a un producto.
 * Permiso requerido: recipes.create
 */
export async function createRecipeAction(
  businessId: string,
  input: CreateRecipeInput
): Promise<{ success: boolean; data?: RecipeWithDetails; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para crear recetas." };
  }

  try {
    const data = await createRecipe(businessId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al registrar la receta." };
  }
}

/**
 * Modifica una receta existente.
 * Permiso requerido: recipes.update
 */
export async function updateRecipeAction(
  businessId: string,
  recipeId: string,
  input: UpdateRecipeInput
): Promise<{ success: boolean; data?: RecipeWithDetails; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para editar recetas." };
  }

  try {
    const data = await updateRecipe(businessId, recipeId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar la receta." };
  }
}

/**
 * Elimina una receta de producto.
 * Permiso requerido: recipes.delete
 */
export async function deleteRecipeAction(
  businessId: string,
  recipeId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.delete");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para eliminar recetas." };
  }

  try {
    await deleteRecipe(businessId, recipeId);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al eliminar la receta." };
  }
}

/**
 * Duplica una receta existente.
 * Permiso requerido: recipes.create
 */
export async function duplicateRecipeAction(
  businessId: string,
  recipeId: string
): Promise<{ success: boolean; data?: RecipeWithDetails; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para duplicar recetas." };
  }

  try {
    const data = await duplicateRecipe(businessId, recipeId, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al duplicar la receta." };
  }
}

/**
 * Conmuta el estado de una receta entre activo e inactivo.
 * Permiso requerido: recipes.update
 */
export async function toggleRecipeStatusAction(
  businessId: string,
  recipeId: string,
  newStatus: "active" | "inactive"
): Promise<{ success: boolean; data?: RecipeWithDetails; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para cambiar el estado de la receta." };
  }

  try {
    const data = await updateRecipe(businessId, recipeId, { status: newStatus }, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al cambiar el estado de la receta." };
  }
}

/**
 * [REC-003] Descuenta existencias de ingredientes para una venta o comanda.
 * Permiso requerido: inventory.manage o orders.create
 */
export async function deductRecipeIngredientsAction(
  businessId: string,
  items: RecipeSaleItem[],
  referenceId: string,
  orderNumber?: number
) {
  const auth = await verifyWorkspaceAction(businessId, "inventory.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para mover inventario." };
  }

  try {
    const res = await deductRecipeIngredientsForSale(
      businessId,
      items,
      referenceId,
      orderNumber,
      auth.context.userId
    );
    revalidatePath(`/workspace/${businessId}/inventario`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data: res.deductedIngredients };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al descontar ingredientes de inventario." };
  }
}

/**
 * [REC-004] Consulta la disponibilidad, cuello de botella y stock proyectado
 * de la receta activa vinculada a un producto.
 * Permiso requerido: recipes.view o products.view
 */
export async function getProductRecipeAvailabilityAction(
  businessId: string,
  productId: string
): Promise<{ success: boolean; data?: RecipeAvailabilityResult | null; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar disponibilidad de recetas.",
    };
  }

  try {
    const data = await getProductRecipeAvailability(businessId, productId);
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al calcular la disponibilidad de la receta.",
    };
  }
}

/**
 * [REC-004] Calcula "¿Cuánto me alcanza?" para una receta específica y simula
 * el stock restante para un número determinado de porciones.
 * Permiso requerido: recipes.view
 */
export async function calculateRecipeAvailabilityAction(
  businessId: string,
  recipeId: string,
  desiredPortions?: number
): Promise<{ success: boolean; data?: RecipeAvailabilityResult | null; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para calcular disponibilidad de recetas.",
    };
  }

  try {
    const recipe = await getRecipeById(businessId, recipeId);
    if (!recipe) {
      return { success: false, error: "Receta no encontrada." };
    }
    const data = calculateRecipeAvailability(recipe, desiredPortions);
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al calcular el escandallo de la receta.",
    };
  }
}

// ==========================================
// IMPORTACIÓN MASIVA DE INGREDIENTES
// ==========================================

/**
 * Valida un conjunto de filas crudas extraídas de CSV o Excel para la importación masiva de ingredientes.
 * Permiso requerido: recipes.create o products.create
 */
export async function validateIngredientsImportAction(
  businessId: string,
  rawRows: RawIngredientImportRow[]
): Promise<{ success: boolean; data?: ParsedIngredientResult; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para importar ingredientes." };
  }

  try {
    const [existingIngredients, existingCategories] = await Promise.all([
      getIngredients(businessId),
      getCategories(businessId),
    ]);

    const result = validateIngredientRows(rawRows, existingIngredients, existingCategories);
    return { success: true, data: result };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al validar el archivo de ingredientes.",
    };
  }
}

/**
 * Ejecuta la importación masiva de filas validadas de ingredientes.
 * Autogenera categorías inexistentes y registra existencias en inventario.
 * Permiso requerido: recipes.create o products.create
 */
export async function importIngredientsBatchAction(
  businessId: string,
  rows: ValidatedIngredientRow[],
  locationId?: string | null
): Promise<{ success: boolean; data?: ImportIngredientsBatchResult; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para importar ingredientes." };
  }

  try {
    const result = await importIngredientsBatch(
      businessId,
      rows,
      locationId,
      auth.context.userId
    );

    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/inventario`);

    return { success: true, data: result };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al importar ingredientes.",
    };
  }
}

/**
 * Sube una imagen para un ingrediente o insumo al Storage de Supabase (aislado por businessId).
 * Reutiliza la infraestructura y almacenamiento de productos.
 */
export async function uploadMaterialImageAction(
  businessId: string,
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const auth = await verifyMaterialCreateAction(businessId);
    if (!auth.success) return { success: false, error: auth.error };

    const file = formData.get("file") as File | null;
    const previousUrl = formData.get("previousUrl") as string | null;
    const ingredientId = (formData.get("ingredientId") as string | null) || `mat_${Date.now()}`;

    if (!file || typeof file === "string" || !file.size) {
      return { success: false, error: "No se proporcionó ningún archivo de imagen válido." };
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !supabaseUrl) {
      return { success: false, error: "Configuración de almacenamiento no disponible en el servidor." };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { uploadProductImageFile } = await import("@/lib/storage/supabase-storage");
    const result = await uploadProductImageFile(adminClient, businessId, ingredientId, file, previousUrl);

    if (result.error || !result.url) {
      return { success: false, error: result.error || "Error al cargar la imagen en Storage." };
    }

    return { success: true, url: result.url };
  } catch (error: any) {
    return { success: false, error: error.message || "Error interno al procesar la imagen del material." };
  }
}
