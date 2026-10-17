import { redirect } from "next/navigation";

/**
 * La configuración de documentos y comprobantes fue consolidada en la pestaña
 * "Comprobantes" dentro de /configuracion para eliminar la duplicidad.
 * Esta ruta redirige automáticamente a la pestaña correcta.
 */
export default async function WorkspaceDocumentConfigPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/workspace/${businessId}/configuracion?tab=comprobantes`);
}
