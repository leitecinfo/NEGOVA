"use server";

import { revalidatePath } from "next/cache";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import * as productsService from "@/lib/products/products-service";
import { CreateProductSchema, CreateCategorySchema, Product, Category } from "@/lib/products/types";

// ==========================================
// CATEGORÍAS
// ==========================================

export async function getCategoriesAction(
  businessId: string
): Promise<{ success: boolean; data?: Category[]; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.view");
    if (!auth.success) return { success: false, error: auth.error };

    const data = await productsService.getCategories(businessId);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al obtener categorías." };
  }
}

export async function createCategoryAction(
  businessId: string,
  payload: { name: string; description?: string | null; sort_order?: number }
): Promise<{ success: boolean; data?: Category; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.create");
    if (!auth.success) return { success: false, error: auth.error };

    const parsed = CreateCategorySchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const category = await productsService.createCategory(businessId, parsed.data);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data: category };
  } catch (error: any) {
    return { success: false, error: error.message || "Error interno del servidor." };
  }
}

export async function updateCategoryAction(
  businessId: string,
  categoryId: string,
  payload: { name?: string; description?: string | null; sort_order?: number; status?: "active" | "inactive" | "archived" }
): Promise<{ success: boolean; data?: Category; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.update");
    if (!auth.success) return { success: false, error: auth.error };

    const category = await productsService.updateCategory(businessId, categoryId, payload);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data: category };
  } catch (error: any) {
    return { success: false, error: error.message || "Error interno del servidor." };
  }
}

export async function archiveCategoryAction(
  businessId: string,
  categoryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.delete");
    if (!auth.success) return { success: false, error: auth.error };

    await productsService.archiveCategory(businessId, categoryId);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error interno del servidor." };
  }
}

export async function getCategoryProductCountAction(
  businessId: string,
  categoryId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.view");
    if (!auth.success) return { success: false, error: auth.error };

    const count = await productsService.getCategoryProductCount(businessId, categoryId);
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al consultar productos asociados." };
  }
}

export async function deleteCategoryAction(
  businessId: string,
  categoryId: string,
  reassignToCategoryId?: string | null
): Promise<{ success: boolean; affectedProducts?: number; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.delete");
    if (!auth.success) return { success: false, error: auth.error };

    const res = await productsService.deleteCategory(businessId, categoryId, reassignToCategoryId);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, affectedProducts: res.affectedProducts };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al eliminar categoría." };
  }
}

// ==========================================
// PRODUCTOS
// ==========================================

export async function createProductAction(
  businessId: string,
  payload: any
): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.create");
    if (!auth.success) return { success: false, error: auth.error };

    const parsed = CreateProductSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    // Validación server-side: si es servicio o producto según la actividad configurada
    const isService = parsed.data.metadata?.product_type === "service";
    if (isService && !auth.context?.commercialActivities.includes("provide_services")) {
      return {
        success: false,
        error: "La prestación de servicios no está habilitada en la configuración de este negocio.",
      };
    }
    if (!isService && !auth.context?.commercialActivities.includes("sell_products")) {
      return {
        success: false,
        error: "La venta de productos no está habilitada en la configuración de este negocio.",
      };
    }

    const product = await productsService.createProduct(businessId, parsed.data);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data: product };
  } catch (error: any) {
    return { success: false, error: error.message || "Error interno del servidor." };
  }
}

export async function updateProductAction(
  businessId: string,
  productId: string,
  payload: any
): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.update");
    if (!auth.success) return { success: false, error: auth.error };

    // Validar parcialmente usando el schema
    const parsed = CreateProductSchema.partial().safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const isService = parsed.data.metadata?.product_type === "service";
    if (isService && !auth.context?.commercialActivities.includes("provide_services")) {
      return {
        success: false,
        error: "La prestación de servicios no está habilitada en la configuración de este negocio.",
      };
    }

    const product = await productsService.updateProduct(businessId, productId, parsed.data);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data: product };
  } catch (error: any) {
    return { success: false, error: error.message || "Error interno del servidor." };
  }
}

export async function toggleProductAvailabilityAction(
  businessId: string,
  productId: string,
  isAvailable: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.update");
    if (!auth.success) return { success: false, error: auth.error };

    await productsService.toggleProductAvailability(businessId, productId, isAvailable);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error interno del servidor." };
  }
}

export async function archiveProductAction(
  businessId: string,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.delete");
    if (!auth.success) return { success: false, error: auth.error };

    await productsService.archiveProduct(businessId, productId);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error interno del servidor." };
  }
}

export async function checkProductPlanLimitAction(
  businessId: string
): Promise<{
  success: boolean;
  allowed?: boolean;
  planId?: string;
  planName?: string;
  maxProducts?: number;
  currentCount?: number;
  error?: string;
}> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.view");
    if (!auth.success) return { success: false, error: auth.error };

    const limit = await productsService.checkProductPlanLimit(businessId);
    return {
      success: true,
      allowed: limit.allowed,
      planId: limit.planId,
      planName: limit.planName,
      maxProducts: limit.maxProducts,
      currentCount: limit.currentCount,
      error: limit.error,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al verificar límites del plan." };
  }
}

// ==========================================
// IMÁGENES Y ALMACENAMIENTO (STORAGE)
// ==========================================

export async function uploadProductImageAction(
  businessId: string,
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.create");
    if (!auth.success) return { success: false, error: auth.error };

    const file = formData.get("file") as File | null;
    const previousUrl = formData.get("previousUrl") as string | null;
    const productId = (formData.get("productId") as string | null) || `prod_${Date.now()}`;

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
    const result = await uploadProductImageFile(adminClient, businessId, productId, file, previousUrl);

    if (result.error || !result.url) {
      return { success: false, error: result.error || "Error al cargar la imagen en Storage." };
    }

    return { success: true, url: result.url };
  } catch (error: any) {
    return { success: false, error: error.message || "Error interno al procesar la imagen." };
  }
}


