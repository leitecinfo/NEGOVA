"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  createRestaurantOrder,
  getRestaurantTables,
  CreateOrderResult,
} from "@/lib/restaurant/restaurant-service";
import { CreateRestaurantOrderInput, RestaurantTable } from "@/lib/restaurant/types";

/**
 * Server Action: Registrar un nuevo pedido / comanda en el POS (Etapa 3).
 * Valida la autorización del usuario en el negocio, permiso orders.create, recalcula precios y persiste atómicamente.
 */
export async function createRestaurantOrderAction(
  businessId: string,
  input: CreateRestaurantOrderInput
): Promise<CreateOrderResult> {
  // 1. Autorización multi-tenant y permiso RBAC
  // Se admite orders.create o sales.create (para personal de ventas/caja autorizado)
  let auth = await verifyWorkspaceAction(businessId, "orders.create");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "sales.create");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar pedidos en este negocio." };
  }

  // 2. Ejecutar creación en el servicio con recálculo en servidor
  return await createRestaurantOrder(businessId, input, auth.context.userId);
}

/**
 * Server Action: Consultar las mesas del negocio actual para asignación de pedidos.
 */
export async function getRestaurantTablesAction(
  businessId: string
): Promise<RestaurantTable[]> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success && !(await verifyWorkspaceAction(businessId, "sales.view")).success) {
    return [];
  }

  return await getRestaurantTables(businessId);
}
