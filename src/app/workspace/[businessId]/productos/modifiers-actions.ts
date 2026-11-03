"use server";

import { revalidatePath } from "next/cache";
import {
  addModifierOption,
  createModifierGroup,
  deleteModifierGroup,
  deleteModifierOption,
  getModifierGroupKPIs,
  getModifierGroups,
  toggleModifierGroupStatus,
  updateModifierGroup,
  updateModifierOption,
} from "@/lib/modifiers/modifiers-service";
import {
  CreateModifierGroupInput,
  ModifierGroup,
  ModifierGroupKPIs,
  ModifierOption,
  ModifierStatus,
  UpdateModifierGroupInput,
} from "@/lib/modifiers/types";

export interface ModifiersActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getModifierGroupsAction(
  businessId: string
): Promise<ModifiersActionResult<{ groups: ModifierGroup[]; kpis: ModifierGroupKPIs }>> {
  try {
    const groups = await getModifierGroups(businessId);
    const kpis = getModifierGroupKPIs(groups);
    return {
      success: true,
      data: { groups, kpis },
    };
  } catch (err: any) {
    console.error("[getModifierGroupsAction] Error:", err);
    return {
      success: false,
      error: err.message || "Error al consultar los grupos de modificadores",
    };
  }
}

export async function createModifierGroupAction(
  businessId: string,
  input: CreateModifierGroupInput
): Promise<ModifiersActionResult<ModifierGroup>> {
  try {
    const group = await createModifierGroup(businessId, input);
    revalidatePath(`/workspace/${businessId}/productos`);
    return {
      success: true,
      data: group,
    };
  } catch (err: any) {
    console.error("[createModifierGroupAction] Error:", err);
    return {
      success: false,
      error: err.message || "Error al crear el grupo de modificadores",
    };
  }
}

export async function updateModifierGroupAction(
  businessId: string,
  groupId: string,
  input: UpdateModifierGroupInput
): Promise<ModifiersActionResult<ModifierGroup>> {
  try {
    const updated = await updateModifierGroup(businessId, groupId, input);
    revalidatePath(`/workspace/${businessId}/productos`);
    return {
      success: true,
      data: updated,
    };
  } catch (err: any) {
    console.error("[updateModifierGroupAction] Error:", err);
    return {
      success: false,
      error: err.message || "Error al actualizar el grupo de modificadores",
    };
  }
}

export async function deleteModifierGroupAction(
  businessId: string,
  groupId: string
): Promise<ModifiersActionResult<null>> {
  try {
    await deleteModifierGroup(businessId, groupId);
    revalidatePath(`/workspace/${businessId}/productos`);
    return {
      success: true,
      data: null,
    };
  } catch (err: any) {
    console.error("[deleteModifierGroupAction] Error:", err);
    return {
      success: false,
      error: err.message || "Error al eliminar el grupo de modificadores",
    };
  }
}

export async function addModifierOptionAction(
  businessId: string,
  groupId: string,
  data: { name: string; price: number; status?: ModifierStatus }
): Promise<ModifiersActionResult<ModifierOption>> {
  try {
    const option = await addModifierOption(businessId, groupId, data);
    revalidatePath(`/workspace/${businessId}/productos`);
    return {
      success: true,
      data: option,
    };
  } catch (err: any) {
    console.error("[addModifierOptionAction] Error:", err);
    return {
      success: false,
      error: err.message || "Error al agregar la opción",
    };
  }
}

export async function updateModifierOptionAction(
  businessId: string,
  optionId: string,
  updates: { name?: string; price?: number; status?: ModifierStatus }
): Promise<ModifiersActionResult<null>> {
  try {
    await updateModifierOption(businessId, optionId, updates);
    revalidatePath(`/workspace/${businessId}/productos`);
    return {
      success: true,
      data: null,
    };
  } catch (err: any) {
    console.error("[updateModifierOptionAction] Error:", err);
    return {
      success: false,
      error: err.message || "Error al actualizar la opción",
    };
  }
}

export async function deleteModifierOptionAction(
  businessId: string,
  optionId: string
): Promise<ModifiersActionResult<null>> {
  try {
    await deleteModifierOption(businessId, optionId);
    revalidatePath(`/workspace/${businessId}/productos`);
    return {
      success: true,
      data: null,
    };
  } catch (err: any) {
    console.error("[deleteModifierOptionAction] Error:", err);
    return {
      success: false,
      error: err.message || "Error al eliminar la opción",
    };
  }
}

export async function toggleModifierGroupStatusAction(
  businessId: string,
  groupId: string,
  targetStatus: ModifierStatus
): Promise<ModifiersActionResult<null>> {
  try {
    await toggleModifierGroupStatus(businessId, groupId, targetStatus);
    revalidatePath(`/workspace/${businessId}/productos`);
    return {
      success: true,
      data: null,
    };
  } catch (err: any) {
    console.error("[toggleModifierGroupStatusAction] Error:", err);
    return {
      success: false,
      error: err.message || "Error al cambiar el estado del grupo",
    };
  }
}
