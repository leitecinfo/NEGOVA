"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { revalidatePath } from "next/cache";

export interface SupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays?: number;
  notes?: string;
  status?: "active" | "inactive" | "archived";
}

/**
 * Consulta el directorio de proveedores del comercio.
 * Permiso requerido: suppliers.view
 */
export async function getSuppliersAction(businessId: string) {
  const auth = await verifyWorkspaceAction(businessId, "suppliers.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver proveedores.", data: [] };
  }

  try {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("business_id", businessId)
      .neq("status", "archived")
      .order("name", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar proveedores.", data: [] };
  }
}

/**
 * Registra un nuevo proveedor en el comercio.
 * Permiso requerido: suppliers.create
 */
export async function createSupplierAction(businessId: string, input: SupplierInput) {
  const auth = await verifyWorkspaceAction(businessId, "suppliers.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar proveedores." };
  }

  if (!input.name || input.name.trim().length === 0) {
    return { success: false, error: "El nombre del proveedor es obligatorio." };
  }

  try {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        business_id: businessId,
        name: input.name.trim(),
        contact_name: input.contactName?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        tax_id: input.taxId?.trim() || null,
        payment_terms_days: input.paymentTermsDays || 0,
        notes: input.notes?.trim() || null,
        status: input.status || "active",
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath(`/workspace/${businessId}/proveedores`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al registrar el proveedor." };
  }
}

/**
 * Modifica la información de un proveedor.
 * Permiso requerido: suppliers.update
 */
export async function updateSupplierAction(
  businessId: string,
  supplierId: string,
  input: Partial<SupplierInput>
) {
  const auth = await verifyWorkspaceAction(businessId, "suppliers.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para editar proveedores." };
  }

  try {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.contactName !== undefined) updatePayload.contact_name = input.contactName.trim();
    if (input.phone !== undefined) updatePayload.phone = input.phone.trim();
    if (input.email !== undefined) updatePayload.email = input.email.trim();
    if (input.address !== undefined) updatePayload.address = input.address.trim();
    if (input.taxId !== undefined) updatePayload.tax_id = input.taxId.trim();
    if (input.paymentTermsDays !== undefined) updatePayload.payment_terms_days = input.paymentTermsDays;
    if (input.notes !== undefined) updatePayload.notes = input.notes.trim();
    if (input.status !== undefined) updatePayload.status = input.status;

    const { data, error } = await supabase
      .from("suppliers")
      .update(updatePayload)
      .eq("id", supplierId)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) throw error;
    revalidatePath(`/workspace/${businessId}/proveedores`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar el proveedor." };
  }
}

/**
 * Archiva o elimina un proveedor.
 * Permiso requerido: suppliers.delete (exclusivo de Dueño / Admin)
 */
export async function deleteSupplierAction(businessId: string, supplierId: string) {
  const auth = await verifyWorkspaceAction(businessId, "suppliers.delete");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para eliminar proveedores." };
  }

  try {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabase
      .from("suppliers")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", supplierId)
      .eq("business_id", businessId);

    if (error) throw error;
    revalidatePath(`/workspace/${businessId}/proveedores`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al archivar el proveedor." };
  }
}
