import { redirect } from "next/navigation";

/**
 * Redirección canónica de la ruta /workspace/[businessId]/proveedores
 * hacia la vista oficial del módulo en construcción /workspace/[businessId]/modulo/proveedores.
 */
export default async function WorkspaceProveedoresPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/workspace/${businessId}/modulo/proveedores`);
}
