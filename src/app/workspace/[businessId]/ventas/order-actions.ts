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

export interface ActiveWaiterItem {
  id: string;
  name: string;
  code: string;
  phone?: string | null;
}

/**
 * Server Action: Consultar camareros y personal de servicio activos para asignación de pedidos en mesa
 */
export async function getActiveWaitersAction(
  businessId: string
): Promise<{ success: boolean; data?: ActiveWaiterItem[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success && !(await verifyWorkspaceAction(businessId, "sales.view")).success) {
    return { success: false, error: "No tienes autorización para consultar personal." };
  }

  try {
    const { getEmployeesList } = await import("@/lib/payroll/payroll-service");
    const res = await getEmployeesList({ businessId }, { status: "active", pageSize: 50 });
    
    const waiters: ActiveWaiterItem[] = (res.employees || []).map((emp) => {
      let code = `#CAM${emp.id.slice(0, 4).toUpperCase()}`;
      if (emp.notes) {
        const match = emp.notes.match(/\[CODE:([^\]]+)\]/);
        if (match && match[1]) {
          const raw = match[1].trim();
          code = raw.startsWith("#") ? raw : `#${raw}`;
        }
      } else if (emp.documentNumber && (emp.documentNumber.startsWith("#") || emp.documentNumber.startsWith("CAM-") || emp.documentNumber.length <= 8)) {
        code = emp.documentNumber.startsWith("#") ? emp.documentNumber : `#${emp.documentNumber}`;
      }

      return {
        id: emp.id,
        name: emp.fullName,
        code,
        phone: emp.phone || null,
      };
    });

    return { success: true, data: waiters };
  } catch (err: any) {
    console.error("[getActiveWaitersAction Error]:", err);
    return { success: false, error: err.message || "Error al consultar camareros del negocio." };
  }
}
