"use server";

import { revalidatePath } from "next/cache";
import { verifyUserPermission } from "@/lib/auth/authorization";
import {
  getBusinessesList,
  getBusinessDetail,
  createBusiness,
  updateBusiness,
  changeBusinessStatus,
  deleteBusiness,
  getAvailableOwnersList,
  renewOrExtendSubscription,
  BusinessListFilters,
  BusinessListResult,
  BusinessModel,
  CreateBusinessInput,
  UpdateBusinessInput,
  BusinessStatus,
  BusinessUserMembership,
} from "@/lib/businesses/businesses-service";
import { COMMERCIAL_PLANS_LIST, PlanId } from "@/config/plans";

/**
 * 1. SERVER ACTION: OBTENER LISTADO DE NEGOCIOS PAGINADO Y FILTRADO
 */
export async function getBusinessesListAction(
  filters: BusinessListFilters = {}
): Promise<{ success: boolean; data?: BusinessListResult; error?: string }> {
  try {
    await verifyUserPermission("businesses.view");
    const result = await getBusinessesList(filters);
    return { success: true, data: result };
  } catch (err: any) {
    console.error("[getBusinessesListAction Error]:", err);
    return {
      success: false,
      error: err.message || "Acceso denegado: No cuenta con permisos para consultar negocios.",
    };
  }
}

/**
 * 2. SERVER ACTION: OBTENER DETALLE COMPLETO DE UN NEGOCIO
 */
export async function getBusinessDetailAction(
  businessId: string
): Promise<{
  success: boolean;
  data?: {
    business: BusinessModel;
    memberships: BusinessUserMembership[];
    auditLogs: any[];
  };
  error?: string;
}> {
  try {
    await verifyUserPermission("businesses.view");
    const result = await getBusinessDetail(businessId);
    return { success: true, data: result };
  } catch (err: any) {
    console.error("[getBusinessDetailAction Error]:", err);
    return {
      success: false,
      error: err.message || "No fue posible consultar el detalle del negocio.",
    };
  }
}

/**
 * 3. SERVER ACTION: CREAR NUEVO NEGOCIO (TENANT)
 */
export async function createBusinessAction(
  input: CreateBusinessInput
): Promise<{
  success: boolean;
  business?: BusinessModel;
  error?: string;
}> {
  try {
    const actor = await verifyUserPermission("businesses.create");
    const result = await createBusiness(input, actor.userId);

    if (result.success && result.business) {
      revalidatePath("/admin/negocios");
      revalidatePath("/admin");
      revalidatePath("/admin/notificaciones");

      try {
        const { createPlatformNotification } = await import("@/lib/notifications/notifications-service");
        const cityText = result.business.city ? ` en ${result.business.city}` : "";
        const assignedText = result.business.owner?.fullName
          ? ` asignado a ${result.business.owner.fullName}`
          : "";
        const planName = result.business.plan?.name || "Comercial";
        await createPlatformNotification({
          type: "business_created",
          title: "Nuevo negocio registrado",
          message: `Se registró el comercio '${result.business.name}' (${result.business.slug})${cityText}${assignedText} bajo el plan '${planName}'.`,
          link: `/admin/negocios/${result.business.id}`,
          metadata: {
            businessId: result.business.id,
            businessName: result.business.name,
            slug: result.business.slug,
            city: result.business.city,
            department: result.business.department,
            ownerName: result.business.owner?.fullName,
            ownerEmail: result.business.owner?.email,
          },
        });
      } catch (notifErr) {
        console.error("Error creating notification:", notifErr);
      }
    }

    return result;
  } catch (err: any) {
    console.error("[createBusinessAction Error]:", err);
    return {
      success: false,
      error: err.message || "Acceso denegado: No cuenta con permisos para crear negocios.",
    };
  }
}

/**
 * 4. SERVER ACTION: ACTUALIZAR INFORMACIÓN DEL NEGOCIO
 */
export async function updateBusinessAction(
  businessId: string,
  input: UpdateBusinessInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("businesses.update");
    const result = await updateBusiness(businessId, input, actor.userId);

    if (result.success) {
      revalidatePath("/admin/negocios");
      revalidatePath(`/admin/negocios/${businessId}`);
    }

    return result;
  } catch (err: any) {
    console.error("[updateBusinessAction Error]:", err);
    return {
      success: false,
      error: err.message || "No fue posible actualizar la información del negocio.",
    };
  }
}

/**
 * 5. SERVER ACTION: CAMBIAR ESTADO OPERACIONAL DEL NEGOCIO
 */
export async function changeBusinessStatusAction(
  businessId: string,
  newStatus: BusinessStatus,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("businesses.suspend");
    const result = await changeBusinessStatus(businessId, newStatus, reason, actor.userId);

    if (result.success) {
      revalidatePath("/admin/negocios");
      revalidatePath(`/admin/negocios/${businessId}`);
      revalidatePath("/admin");
    }

    return result;
  } catch (err: any) {
    console.error("[changeBusinessStatusAction Error]:", err);
    return {
      success: false,
      error: err.message || "No fue posible modificar el estado del negocio.",
    };
  }
}

/**
 * 6. SERVER ACTION: OBTENER OPCIONES PARA CREACIÓN Y ASIGNACIÓN
 */
export async function getBusinessCreationOptionsAction(): Promise<{
  success: boolean;
  plans: typeof COMMERCIAL_PLANS_LIST;
  candidateOwners: Array<{ id: string; fullName: string; email: string }>;
  error?: string;
}> {
  try {
    await verifyUserPermission("businesses.view");
    const candidateOwners = await getAvailableOwnersList();

    return {
      success: true,
      plans: COMMERCIAL_PLANS_LIST,
      candidateOwners,
    };
  } catch (err: any) {
    console.error("[getBusinessCreationOptionsAction Error]:", err);
    return {
      success: false,
      plans: COMMERCIAL_PLANS_LIST,
      candidateOwners: [],
      error: err.message,
    };
  }
}

/**
 * 7. SERVER ACTION: ELIMINAR NEGOCIO / TENANT PERMANENTEMENTE
 */
export async function deleteBusinessAction(
  businessId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("businesses.delete");
    const result = await deleteBusiness(businessId, actor.userId);

    if (result.success) {
      revalidatePath("/admin/negocios");
      revalidatePath("/admin");
      revalidatePath("/admin/usuarios");
    }

    return result;
  } catch (err: any) {
    console.error("[deleteBusinessAction Error]:", err);
    return {
      success: false,
      error: err.message || "Acceso denegado: No cuenta con permisos para eliminar negocios.",
    };
  }
}

/**
 * 8. SERVER ACTION: RENOVAR O EXTENDER SUSCRIPCIÓN (GESTIÓN MANUAL DE PAGO)
 */
export async function renewSubscriptionAction(
  businessId: string,
  months: number = 1,
  planId?: PlanId
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("businesses.update");
    const result = await renewOrExtendSubscription(businessId, months, planId, actor.userId);

    if (result.success) {
      revalidatePath(`/admin/negocios/${businessId}`);
      revalidatePath("/admin/negocios");
      revalidatePath("/admin/suscripciones");
      revalidatePath("/admin");
    }

    return result;
  } catch (err: any) {
    console.error("[renewSubscriptionAction Error]:", err);
    return {
      success: false,
      error: err.message || "No fue posible renovar la suscripción.",
    };
  }
}

