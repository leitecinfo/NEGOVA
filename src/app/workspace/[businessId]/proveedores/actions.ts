"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { revalidatePath } from "next/cache";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  toggleSupplierStatus,
  deleteSupplier,
} from "@/lib/purchases/purchases-service";
import {
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
} from "@/lib/purchases/types";

export type { SupplierInput } from "./types-compat";

/**
 * Consulta el directorio de proveedores del comercio.
 * Permiso requerido: suppliers.view
 */
export async function getSuppliersAction(businessId: string): Promise<{
  success: boolean;
  data: Supplier[];
  error?: string;
}> {
  const auth = await verifyWorkspaceAction(businessId, "suppliers.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para ver proveedores.",
      data: [],
    };
  }

  try {
    const data = await getSuppliers(businessId);
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al consultar proveedores.",
      data: [],
    };
  }
}

/**
 * Registra un nuevo proveedor en el comercio.
 * Permiso requerido: suppliers.create
 */
export async function createSupplierAction(
  businessId: string,
  input: CreateSupplierInput
): Promise<{ success: boolean; data?: Supplier; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "suppliers.create");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para registrar proveedores.",
    };
  }

  if (!input.name || input.name.trim().length === 0) {
    return { success: false, error: "El nombre del proveedor es obligatorio." };
  }

  try {
    const data = await createSupplier(businessId, input);
    revalidatePath(`/workspace/${businessId}/proveedores`);
    revalidatePath(`/workspace/${businessId}/compras`);
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al registrar el proveedor.",
    };
  }
}

/**
 * Modifica la información de un proveedor.
 * Permiso requerido: suppliers.update
 */
export async function updateSupplierAction(
  businessId: string,
  supplierId: string,
  input: UpdateSupplierInput
): Promise<{ success: boolean; data?: Supplier; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "suppliers.update");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para editar proveedores.",
    };
  }

  try {
    const data = await updateSupplier(businessId, supplierId, input);
    revalidatePath(`/workspace/${businessId}/proveedores`);
    revalidatePath(`/workspace/${businessId}/compras`);
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al actualizar el proveedor.",
    };
  }
}

/**
 * Activa o desactiva lógicamente un proveedor.
 * Permiso requerido: suppliers.update
 */
export async function toggleSupplierStatusAction(
  businessId: string,
  supplierId: string,
  status: "active" | "inactive"
): Promise<{ success: boolean; data?: Supplier; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "suppliers.update");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para cambiar el estado del proveedor.",
    };
  }

  try {
    const data = await toggleSupplierStatus(businessId, supplierId, status);
    revalidatePath(`/workspace/${businessId}/proveedores`);
    revalidatePath(`/workspace/${businessId}/compras`);
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al cambiar el estado del proveedor.",
    };
  }
}

/**
 * Archiva o elimina un proveedor lógicamente sin eliminar histórico.
 * Permiso requerido: suppliers.delete (exclusivo de Dueño / Admin)
 */
export async function deleteSupplierAction(
  businessId: string,
  supplierId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "suppliers.delete");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para eliminar proveedores.",
    };
  }

  try {
    await deleteSupplier(businessId, supplierId);
    revalidatePath(`/workspace/${businessId}/proveedores`);
    revalidatePath(`/workspace/${businessId}/compras`);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al archivar el proveedor.",
    };
  }
}
