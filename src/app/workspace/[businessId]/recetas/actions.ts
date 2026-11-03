"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { revalidatePath } from "next/cache";
import {
  createIngredient,
  getIngredients,
  getIngredientKPIs,
  updateIngredient,
  archiveIngredient,
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

// ==========================================
// INGREDIENTES (REC-001)
// ==========================================

/**
 * Consulta la lista de ingredientes del comercio.
 * Permiso requerido: recipes.view o products.view
 */
export async function getIngredientsAction(
  businessId: string,
  filters: IngredientFilters = {}
): Promise<{ success: boolean; data?: Ingredient[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver ingredientes." };
  }

  try {
    const data = await getIngredients(businessId, filters);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar ingredientes." };
  }
}

/**
 * Consulta los KPIs consolidados de ingredientes.
 * Permiso requerido: recipes.view
 */
export async function getIngredientKPIsAction(
  businessId: string
): Promise<{ success: boolean; data?: IngredientKPIs; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver métricas de ingredientes." };
  }

  try {
    const data = await getIngredientKPIs(businessId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al calcular métricas de ingredientes." };
  }
}

/**
 * Crea un nuevo ingrediente como producto tipo "ingredient" con stock y kardex inicial.
 * Permiso requerido: recipes.create o products.create
 */
export async function createIngredientAction(
  businessId: string,
  input: CreateIngredientInput
): Promise<{ success: boolean; data?: Ingredient; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar ingredientes." };
  }

  try {
    const data = await createIngredient(businessId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al crear el ingrediente." };
  }
}

/**
 * Actualiza la información y costo de un ingrediente.
 * Permiso requerido: recipes.update o products.update
 */
export async function updateIngredientAction(
  businessId: string,
  ingredientId: string,
  input: UpdateIngredientInput
): Promise<{ success: boolean; data?: Ingredient; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para editar ingredientes." };
  }

  try {
    const data = await updateIngredient(businessId, ingredientId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar el ingrediente." };
  }
}

/**
 * Alterna el estado activo / oculto de un ingrediente.
 * Permiso requerido: recipes.update
 */
export async function toggleIngredientAvailabilityAction(
  businessId: string,
  ingredientId: string,
  isAvailable: boolean
): Promise<{ success: boolean; data?: Ingredient; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para modificar ingredientes." };
  }

  try {
    const data = await updateIngredient(businessId, ingredientId, { isAvailable }, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/recetas`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al cambiar visibilidad del ingrediente." };
  }
}

/**
 * Archiva (elimina lógicamente) un ingrediente.
 * Permiso requerido: recipes.delete o products.delete
 */
export async function archiveIngredientAction(
  businessId: string,
  ingredientId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "recipes.delete");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para eliminar ingredientes." };
  }

  try {
    await archiveIngredient(businessId, ingredientId);
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
