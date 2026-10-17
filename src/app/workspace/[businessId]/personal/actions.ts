"use server";

import { verifyUserPermission, hasPermission } from "@/lib/auth/authorization";
import {
  getEmployeesList,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  createEmployeeNovelty,
  getEmployeeNovelties,
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
 * SERVER ACTION: OBTENER LISTADO DE TRABAJADORES DEL NEGOCIO
 */
export async function getWorkspaceEmployeesAction(
  businessId: string,
  filters: { search?: string; status?: string; page?: number; pageSize?: number } = {}
) {
  try {
    const actor = await verifyUserPermission("staff.view", { businessId });
    const canViewSalaries = await hasPermission(actor.userId, "staff.salaries.view", { businessId });
    const canViewBank = await hasPermission(actor.userId, "staff.bank.view", { businessId });

    const result = await getEmployeesList(
      { businessId },
      {
        ...filters,
        hideSensitiveData: !canViewBank,
      }
    );

    // Si no tiene permiso de ver salarios, ocultar la cifra económica
    if (!canViewSalaries) {
      result.employees = result.employees.map((e) => ({
        ...e,
        baseSalary: 0,
      }));
    }

    return { success: true, data: result };
  } catch (err: any) {
    console.error("[getWorkspaceEmployeesAction Error]:", err);
    return { success: false, error: err.message || "Error al consultar personal del negocio." };
  }
}

/**
 * SERVER ACTION: OBTENER FICHA DETALLADA DE UN TRABAJADOR
 */
export async function getWorkspaceEmployeeByIdAction(businessId: string, employeeId: string) {
  try {
    const actor = await verifyUserPermission("staff.view", { businessId });
    const canViewSalaries = await hasPermission(actor.userId, "staff.salaries.view", { businessId });
    const canViewBank = await hasPermission(actor.userId, "staff.bank.view", { businessId });

    const employee = await getEmployeeById(employeeId, { businessId }, { hideSensitiveData: !canViewBank });
    if (!employee) {
      return { success: false, error: "Trabajador no encontrado." };
    }

    if (!canViewSalaries) {
      employee.baseSalary = 0;
    }

    return { success: true, data: employee };
  } catch (err: any) {
    console.error("[getWorkspaceEmployeeByIdAction Error]:", err);
    return { success: false, error: err.message || "Error al consultar trabajador." };
  }
}

/**
 * SERVER ACTION: REGISTRAR NUEVO TRABAJADOR
 */
export async function createWorkspaceEmployeeAction(businessId: string, input: UpsertEmployeeInput) {
  try {
    const actor = await verifyUserPermission("staff.create", { businessId });
    const result = await createEmployee(input, actor.userId, { businessId });

    if (result.success) {
      revalidatePath(`/workspace/${businessId}/personal`);
      revalidatePath(`/workspace/${businessId}/nomina`);
    }

    return result;
  } catch (err: any) {
    console.error("[createWorkspaceEmployeeAction Error]:", err);
    return { success: false, error: err.message || "Error al crear trabajador." };
  }
}

/**
 * SERVER ACTION: EDITAR DATOS DEL TRABAJADOR
 */
export async function updateWorkspaceEmployeeAction(
  businessId: string,
  employeeId: string,
  input: Partial<UpsertEmployeeInput>
) {
  try {
    const actor = await verifyUserPermission("staff.update", { businessId });
    const result = await updateEmployee(employeeId, input, actor.userId, { businessId });

    if (result.success) {
      revalidatePath(`/workspace/${businessId}/personal`);
      revalidatePath(`/workspace/${businessId}/personal/${employeeId}`);
    }

    return result;
  } catch (err: any) {
    console.error("[updateWorkspaceEmployeeAction Error]:", err);
    return { success: false, error: err.message || "Error al actualizar trabajador." };
  }
}

/**
 * SERVER ACTION: REGISTRAR NOVEDAD LABORAL (HORAS EXTRA, BONOS, ANTICIPOS, DESCUENTOS)
 */
export async function createWorkspaceEmployeeNoveltyAction(
  businessId: string,
  params: {
    employeeId: string;
    noveltyType: NoveltyType;
    description: string;
    startDate: string;
    endDate?: string | null;
    amount: number;
  }
) {
  try {
    const actor = await verifyUserPermission("staff.update", { businessId });
    const result = await createEmployeeNovelty(params, actor.userId, { businessId });

    if (result.success) {
      revalidatePath(`/workspace/${businessId}/personal`);
      revalidatePath(`/workspace/${businessId}/personal/${params.employeeId}`);
    }

    return result;
  } catch (err: any) {
    console.error("[createWorkspaceEmployeeNoveltyAction Error]:", err);
    return { success: false, error: err.message || "Error al registrar novedad laboral." };
  }
}

/**
 * SERVER ACTION: CONSULTAR NOVEDADES DE UN TRABAJADOR
 */
export async function getWorkspaceEmployeeNoveltiesAction(businessId: string, employeeId: string) {
  try {
    await verifyUserPermission("staff.view", { businessId });
    const novelties = await getEmployeeNovelties(employeeId, { businessId });
    return { success: true, data: novelties };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al consultar novedades." };
  }
}

/**
 * SERVER ACTION: CONSULTAR PERÍODOS DE NÓMINA
 */
export async function getWorkspacePayrollPeriodsAction(businessId: string) {
  try {
    await verifyUserPermission("payroll.view", { businessId });
    const periods = await getPayrollPeriodsList({ businessId });
    return { success: true, data: periods };
  } catch (err: any) {
    console.error("[getWorkspacePayrollPeriodsAction Error]:", err);
    return { success: false, error: err.message || "Error al consultar períodos de nómina." };
  }
}

/**
 * SERVER ACTION: CONSULTAR DETALLE DE UN PERÍODO DE NÓMINA
 */
export async function getWorkspacePayrollPeriodDetailAction(businessId: string, periodId: string) {
  try {
    await verifyUserPermission("payroll.view", { businessId });
    const period = await getPayrollPeriodDetail(periodId, { businessId });
    if (!period) {
      return { success: false, error: "Período de nómina no encontrado." };
    }
    return { success: true, data: period };
  } catch (err: any) {
    console.error("[getWorkspacePayrollPeriodDetailAction Error]:", err);
    return { success: false, error: err.message || "Error al consultar período de nómina." };
  }
}

/**
 * SERVER ACTION: LIQUIDAR / CREAR PERÍODO DE NÓMINA
 */
export async function createWorkspacePayrollPeriodAction(
  businessId: string,
  params: {
    name: string;
    periodType: "monthly" | "biweekly" | "weekly" | "custom";
    startDate: string;
    endDate: string;
    notes?: string;
  }
) {
  try {
    const actor = await verifyUserPermission("payroll.calculate", { businessId });
    const result = await createPayrollPeriod(params, actor.userId, { businessId });

    if (result.success) {
      revalidatePath(`/workspace/${businessId}/nomina`);
    }

    return result;
  } catch (err: any) {
    console.error("[createWorkspacePayrollPeriodAction Error]:", err);
    return { success: false, error: err.message || "Error al liquidar período de nómina." };
  }
}

/**
 * SERVER ACTION: REGISTRAR PAGO EFECTIVO DE UN COMPROBANTE DE NÓMINA
 */
export async function registerWorkspacePayrollPaymentAction(
  businessId: string,
  params: {
    receiptId: string;
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    notes?: string;
  }
) {
  try {
    const actor = await verifyUserPermission("payroll.pay", { businessId });
    const result = await registerPayrollReceiptPayment(params, actor.userId, { businessId });

    if (result.success) {
      revalidatePath(`/workspace/${businessId}/nomina`);
      revalidatePath(`/workspace/${businessId}/modulo/gastos`);
    }

    return result;
  } catch (err: any) {
    console.error("[registerWorkspacePayrollPaymentAction Error]:", err);
    return { success: false, error: err.message || "Error al registrar pago de nómina." };
  }
}

/**
 * SERVER ACTION: ANULAR COMPROBANTE DE NÓMINA
 */
export async function cancelWorkspacePayrollReceiptAction(businessId: string, receiptId: string) {
  try {
    const actor = await verifyUserPermission("payroll.cancel", { businessId });
    const result = await cancelPayrollReceipt(receiptId, actor.userId, { businessId });

    if (result.success) {
      revalidatePath(`/workspace/${businessId}/nomina`);
      revalidatePath(`/workspace/${businessId}/modulo/gastos`);
    }

    return result;
  } catch (err: any) {
    console.error("[cancelWorkspacePayrollReceiptAction Error]:", err);
    return { success: false, error: err.message || "Error al anular comprobante de nómina." };
  }
}
