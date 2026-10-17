"use server";

import { requireAdminSession } from "@/lib/auth/admin-context";
import {
  getEmployeesList,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  createEmployeeNovelty,
  getPayrollPeriodsList,
  getPayrollPeriodDetail,
  createPayrollPeriod,
  registerPayrollReceiptPayment,
  cancelPayrollReceipt,
  UpsertEmployeeInput,
  NoveltyType,
  PaymentMethod,
} from "@/lib/payroll/payroll-service";
import { revalidatePath } from "next/cache";

/**
 * SERVER ACTION: OBTENER LISTADO DE EMPLEADOS INTERNOS DE NEGOVA CORE
 */
export async function getAdminEmployeesAction(filters: { search?: string; status?: string; page?: number; pageSize?: number } = {}) {
  try {
    const session = await requireAdminSession();
    const result = await getEmployeesList({ isPlatform: true }, filters);
    return { success: true, data: result };
  } catch (err: any) {
    console.error("[getAdminEmployeesAction Error]:", err);
    return { success: false, error: err.message || "Error al consultar empleados de plataforma." };
  }
}

/**
 * SERVER ACTION: REGISTRAR EMPLEADO INTERNO DE NEGOVA CORE
 */
export async function createAdminEmployeeAction(input: UpsertEmployeeInput) {
  try {
    const session = await requireAdminSession();
    const result = await createEmployee(input, session.id, { isPlatform: true });

    if (result.success) {
      revalidatePath("/admin/personal");
    }

    return result;
  } catch (err: any) {
    console.error("[createAdminEmployeeAction Error]:", err);
    return { success: false, error: err.message || "Error al crear empleado interno." };
  }
}

/**
 * SERVER ACTION: EDITAR EMPLEADO INTERNO DE NEGOVA CORE
 */
export async function updateAdminEmployeeAction(employeeId: string, input: Partial<UpsertEmployeeInput>) {
  try {
    const session = await requireAdminSession();
    const result = await updateEmployee(employeeId, input, session.id, { isPlatform: true });

    if (result.success) {
      revalidatePath("/admin/personal");
      revalidatePath(`/admin/personal/${employeeId}`);
    }

    return result;
  } catch (err: any) {
    console.error("[updateAdminEmployeeAction Error]:", err);
    return { success: false, error: err.message || "Error al actualizar empleado interno." };
  }
}

/**
 * SERVER ACTION: CONSULTAR NÓMINA DE PLATAFORMA
 */
export async function getAdminPayrollPeriodsAction() {
  try {
    const session = await requireAdminSession();
    const periods = await getPayrollPeriodsList({ isPlatform: true });
    return { success: true, data: periods };
  } catch (err: any) {
    console.error("[getAdminPayrollPeriodsAction Error]:", err);
    return { success: false, error: err.message || "Error al consultar períodos de nómina interna." };
  }
}

/**
 * SERVER ACTION: CONSULTAR DETALLE DE NÓMINA DE PLATAFORMA
 */
export async function getAdminPayrollPeriodDetailAction(periodId: string) {
  try {
    const session = await requireAdminSession();
    const period = await getPayrollPeriodDetail(periodId, { isPlatform: true });
    return { success: true, data: period };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al consultar período." };
  }
}

/**
 * SERVER ACTION: CREAR / LIQUIDAR NÓMINA DE PLATAFORMA
 */
export async function createAdminPayrollPeriodAction(params: {
  name: string;
  periodType: "monthly" | "biweekly" | "weekly" | "custom";
  startDate: string;
  endDate: string;
  notes?: string;
}) {
  try {
    const session = await requireAdminSession();
    const result = await createPayrollPeriod(params, session.id, { isPlatform: true });

    if (result.success) {
      revalidatePath("/admin/personal");
    }

    return result;
  } catch (err: any) {
    console.error("[createAdminPayrollPeriodAction Error]:", err);
    return { success: false, error: err.message || "Error al liquidar nómina de plataforma." };
  }
}

/**
 * SERVER ACTION: REGISTRAR PAGO DE NÓMINA DE PLATAFORMA
 */
export async function registerAdminPayrollPaymentAction(params: {
  receiptId: string;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  notes?: string;
}) {
  try {
    const session = await requireAdminSession();
    const result = await registerPayrollReceiptPayment(params, session.id, { isPlatform: true });

    if (result.success) {
      revalidatePath("/admin/personal");
      revalidatePath("/admin/finanzas");
    }

    return result;
  } catch (err: any) {
    console.error("[registerAdminPayrollPaymentAction Error]:", err);
    return { success: false, error: err.message || "Error al registrar pago de nómina interna." };
  }
}
