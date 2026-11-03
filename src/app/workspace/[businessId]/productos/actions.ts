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
  payload: {
    name: string;
    description?: string | null;
    sort_order?: number;
    parent_category_id?: string | null;
    default_tax_rate?: number | null;
  }
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
  payload: {
    name?: string;
    description?: string | null;
    sort_order?: number;
    status?: "active" | "inactive" | "archived";
    parent_category_id?: string | null;
    default_tax_rate?: number | null;
  }
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

export async function getProductsAction(
  businessId: string
): Promise<{ success: boolean; data?: Product[]; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.view");
    if (!auth.success) return { success: false, error: auth.error };

    const products = await productsService.getProducts(businessId);
    return { success: true, data: products };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al listar productos." };
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
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/menu/${businessId}`);
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
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/menu/${businessId}`);
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
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/menu/${businessId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error interno del servidor." };
  }
}

export async function toggleProductChannelAction(
  businessId: string,
  productId: string,
  channel: "pos" | "qr" | "online",
  enabled: boolean
): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.update");
    if (!auth.success) return { success: false, error: auth.error };

    const channelUpdates: {
      available_in_pos?: boolean;
      available_in_qr?: boolean;
      available_online?: boolean;
    } = {};

    if (channel === "pos") channelUpdates.available_in_pos = enabled;
    if (channel === "qr") channelUpdates.available_in_qr = enabled;
    if (channel === "online") channelUpdates.available_online = enabled;

    const updated = await productsService.updateProductChannelAvailability(
      businessId,
      productId,
      channelUpdates
    );

    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/menu/${businessId}`);
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al cambiar disponibilidad del canal." };
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
// IMPORTACIÓN Y EXPORTACIÓN DE PRODUCTOS [CAT-006]
// ==========================================

export async function exportProductsCSVAction(
  businessId: string
): Promise<{ success: boolean; csvContent?: string; filename?: string; count?: number; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.view");
    if (!auth.success) return { success: false, error: auth.error };

    const products = await productsService.getProducts(businessId);
    const { generateProductsCSV } = await import("@/lib/products/csv-service");
    const csvContent = generateProductsCSV(products);

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `catalogo_productos_${dateStr}.csv`;

    return {
      success: true,
      csvContent,
      filename,
      count: products.length,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al exportar catálogo en CSV." };
  }
}

export async function validateProductsCSVAction(
  businessId: string,
  csvContent: string
): Promise<{
  success: boolean;
  data?: import("@/lib/products/csv-service").ParsedCSVResult;
  error?: string;
}> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.create");
    if (!auth.success) return { success: false, error: auth.error };

    const products = await productsService.getProducts(businessId);
    const { validateProductsCSV } = await import("@/lib/products/csv-service");
    const parsed = validateProductsCSV(csvContent, products);

    return { success: true, data: parsed };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al validar archivo CSV." };
  }
}

export async function importProductsBatchAction(
  businessId: string,
  validRows: import("@/lib/products/csv-service").ValidatedProductRow[]
): Promise<{
  success: boolean;
  data?: import("@/lib/products/csv-service").ImportBatchResult;
  error?: string;
}> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.create");
    if (!auth.success) return { success: false, error: auth.error };

    const { importProductsBatch } = await import("@/lib/products/csv-service");
    const result = await importProductsBatch(businessId, validRows);

    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al importar lote de productos." };
  }
}

export async function getProductsTemplateCSVAction(
  businessId: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.view");
    if (!auth.success) return { success: false, error: auth.error };

    const { generateProductsTemplateCSV } = await import("@/lib/products/csv-service");
    const template = generateProductsTemplateCSV();
    return { success: true, data: template };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al generar plantilla." };
  }
}


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

// ==========================================
// MERMAS DE PRODUCTOS E INGREDIENTES [CAT-007]
// ==========================================

export async function getSpoilageRecordsAction(
  businessId: string,
  options?: import("@/lib/spoilage/types").SpoilageFilterOptions
): Promise<{
  success: boolean;
  data?: import("@/lib/spoilage/types").SpoilageRecord[];
  error?: string;
}> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.view");
    if (!auth.success) return { success: false, error: auth.error };

    const { getSpoilageRecords } = await import("@/lib/spoilage/spoilage-service");
    const records = await getSpoilageRecords(businessId, options);
    return { success: true, data: records };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al obtener registros de mermas." };
  }
}

export async function getSpoilageKPIsAction(
  businessId: string
): Promise<{
  success: boolean;
  data?: import("@/lib/spoilage/types").SpoilageKPIs;
  error?: string;
}> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.view");
    if (!auth.success) return { success: false, error: auth.error };

    const { getSpoilageKPIs } = await import("@/lib/spoilage/spoilage-service");
    const kpis = await getSpoilageKPIs(businessId);
    return { success: true, data: kpis };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al calcular indicadores de mermas." };
  }
}

export async function createSpoilageRecordAction(
  businessId: string,
  input: import("@/lib/spoilage/types").CreateSpoilageInput
): Promise<{
  success: boolean;
  data?: import("@/lib/spoilage/types").SpoilageRecord;
  error?: string;
}> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.update");
    if (!auth.success) return { success: false, error: auth.error };

    const { createSpoilageRecord } = await import("@/lib/spoilage/spoilage-service");
    const record = await createSpoilageRecord(businessId, input, auth.context?.userId);

    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true, data: record };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar la merma." };
  }
}



