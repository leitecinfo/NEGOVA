"use server";

import { revalidatePath } from "next/cache";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getMeasurementUnits,
  createMeasurementUnit,
  updateMeasurementUnit,
  deleteMeasurementUnit,
  checkUnitUsage,
} from "@/lib/units/units-service";
import {
  MeasurementUnit,
  MeasurementUnitType,
  CreateMeasurementUnitInput,
  UpdateMeasurementUnitInput,
} from "@/lib/units/types";
import { logAuditAction } from "@/lib/audit/audit-service";

/**
 * Consulta las unidades de medida de un comercio.
 * Requiere permiso de visualización de configuración de negocio.
 */
export async function getMeasurementUnitsAction(
  businessId: string,
  filterType?: MeasurementUnitType
): Promise<{ success: boolean; data?: MeasurementUnit[]; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para consultar unidades." };
    }

    const units = await getMeasurementUnits(businessId, filterType);
    return { success: true, data: units };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Error al consultar unidades de medida.",
    };
  }
}

/**
 * Crea una nueva unidad de medida personalizada.
 * Requiere permiso de actualización de configuración de negocio.
 */
export async function createMeasurementUnitAction(
  businessId: string,
  input: CreateMeasurementUnitInput
): Promise<{ success: boolean; data?: MeasurementUnit; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para crear unidades." };
    }

    const unit = await createMeasurementUnit(businessId, input);

    try {
      await logAuditAction({
        businessId,
        action: "create",
        entityType: "measurement_units",
        entityId: unit.id,
        newData: unit,
        userId: auth.context?.userId,
      });
    } catch {
      // Audit log non-blocking
    }

    revalidatePath(`/workspace/${businessId}/configuracion/unidades`);
    revalidatePath(`/workspace/${businessId}/recetas`);

    return { success: true, data: unit };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Error al crear la unidad de medida.",
    };
  }
}

/**
 * Actualiza una unidad de medida existente.
 */
export async function updateMeasurementUnitAction(
  businessId: string,
  unitId: string,
  input: UpdateMeasurementUnitInput
): Promise<{ success: boolean; data?: MeasurementUnit; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para modificar unidades." };
    }

    const unit = await updateMeasurementUnit(businessId, unitId, input);

    try {
      await logAuditAction({
        businessId,
        action: "update",
        entityType: "measurement_units",
        entityId: unitId,
        newData: unit,
        userId: auth.context?.userId,
      });
    } catch {
      // Non-blocking
    }

    revalidatePath(`/workspace/${businessId}/configuracion/unidades`);
    revalidatePath(`/workspace/${businessId}/recetas`);

    return { success: true, data: unit };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Error al actualizar la unidad de medida.",
    };
  }
}

/**
 * Verifica el uso de una unidad antes de intentar eliminarla.
 */
export async function checkUnitUsageAction(
  businessId: string,
  unitAbbreviation: string
): Promise<{ success: boolean; inUse: boolean; count: number; details: string[]; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
    if (!auth.success) {
      return { success: false, inUse: false, count: 0, details: [], error: auth.error };
    }

    const usage = await checkUnitUsage(businessId, unitAbbreviation);
    return {
      success: true,
      inUse: usage.inUse,
      count: usage.count,
      details: usage.details,
    };
  } catch (error: any) {
    return {
      success: false,
      inUse: false,
      count: 0,
      details: [],
      error: error?.message || "Error al verificar el uso de la unidad.",
    };
  }
}

/**
 * Elimina una unidad de medida.
 */
export async function deleteMeasurementUnitAction(
  businessId: string,
  unitId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para eliminar unidades." };
    }

    const res = await deleteMeasurementUnit(businessId, unitId);

    try {
      await logAuditAction({
        businessId,
        action: "delete",
        entityType: "measurement_units",
        entityId: unitId,
        userId: auth.context?.userId,
      });
    } catch {
      // Non-blocking
    }

    revalidatePath(`/workspace/${businessId}/configuracion/unidades`);
    revalidatePath(`/workspace/${businessId}/recetas`);

    return { success: true, message: res.message };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Error al eliminar la unidad de medida.",
    };
  }
}
