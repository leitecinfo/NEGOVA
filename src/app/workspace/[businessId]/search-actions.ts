"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { searchWorkspaceEntities } from "@/lib/search/workspace-search-service";
import { WorkspaceGlobalSearchResult } from "@/lib/search/types";

/**
 * Server Action: Búsqueda global en el workspace [NAV-001].
 * Consulta productos, clientes y comandas/pedidos recientes del comercio.
 * Retorna en <500ms y aísla multi-tenant estrictamente por businessId.
 */
export async function searchWorkspaceGlobalAction(
  businessId: string,
  query: string
): Promise<{ success: boolean; data?: WorkspaceGlobalSearchResult; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "none");
    if (!auth.success || !auth.context) {
      return {
        success: false,
        error: auth.error || "No tienes autorización para buscar en este comercio.",
      };
    }

    const data = await searchWorkspaceEntities(businessId, query);
    return { success: true, data };
  } catch (err: any) {
    console.error("[searchWorkspaceGlobalAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al realizar la búsqueda en el workspace.",
    };
  }
}

