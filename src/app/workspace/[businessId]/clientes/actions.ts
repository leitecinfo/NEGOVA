"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerAddress,
  deleteCustomerAddress,
  searchCustomersForPos,
  setCustomerCreditLimit,
  createCreditSaleReceivable,
  registerCustomerPayment,
  getAccountsReceivableKPIs,
  getBusinessAccountsReceivable,
  getTopDebtors,
  getCustomerReceivables,
  getCustomerById,
} from "@/lib/customers/customers-service";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateCreditSaleReceivableInput,
  RegisterCustomerPaymentInput,
  AccountReceivableStatus,
} from "@/lib/customers/types";
import { revalidatePath } from "next/cache";

export async function createCustomerAction(
  businessId: string,
  input: CreateCustomerInput
) {
  const auth = await verifyWorkspaceAction(businessId, "customers.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar clientes." };
  }

  const result = await createCustomer(businessId, input);
  if (result.success) {
    revalidatePath(`/workspace/${businessId}/clientes`);
  }
  return result;
}

export async function updateCustomerAction(
  businessId: string,
  customerId: string,
  input: UpdateCustomerInput
) {
  const auth = await verifyWorkspaceAction(businessId, "customers.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para editar clientes." };
  }

  const result = await updateCustomer(businessId, customerId, input);
  if (result.success) {
    revalidatePath(`/workspace/${businessId}/clientes`);
    revalidatePath(`/workspace/${businessId}/clientes/${customerId}`);
  }
  return result;
}

export async function deleteCustomerAction(
  businessId: string,
  customerId: string
) {
  const auth = await verifyWorkspaceAction(businessId, "customers.delete");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para eliminar clientes." };
  }

  const result = await deleteCustomer(businessId, customerId);
  if (result.success) {
    revalidatePath(`/workspace/${businessId}/clientes`);
  }
  return result;
}

export async function addCustomerAddressAction(
  businessId: string,
  customerId: string,
  addressLine: string,
  reference?: string | null,
  label = "Principal",
  isDefault = false
) {
  const auth = await verifyWorkspaceAction(businessId, "customers.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para gestionar direcciones." };
  }

  const result = await addCustomerAddress(businessId, customerId, addressLine, reference, label, isDefault);
  if (result.success) {
    revalidatePath(`/workspace/${businessId}/clientes/${customerId}`);
  }
  return result;
}

export async function deleteCustomerAddressAction(
  businessId: string,
  customerId: string,
  addressId: string
) {
  const auth = await verifyWorkspaceAction(businessId, "customers.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para gestionar direcciones." };
  }

  const result = await deleteCustomerAddress(businessId, customerId, addressId);
  if (result.success) {
    revalidatePath(`/workspace/${businessId}/clientes/${customerId}`);
  }
  return result;
}

export async function searchCustomersForPosAction(businessId: string, term: string) {
  // Permitir búsqueda si tiene permiso de visualización de clientes (asignado a cajeros, meseros, auxiliares y owners)
  const auth = await verifyWorkspaceAction(businessId, "customers.view");
  if (!auth.success || !auth.context) {
    return [];
  }
  return await searchCustomersForPos(businessId, term);
}

/**
 * Configura el límite de crédito de un cliente.
 * Regla de negocio: Solo el owner/admin puede otorgar crédito (configurar credit_limit).
 */
export async function updateCustomerCreditLimitAction(
  businessId: string,
  customerId: string,
  creditLimit: number
) {
  const auth = await verifyWorkspaceAction(businessId, "customers.update");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para configurar límites de crédito.",
    };
  }

  const result = await setCustomerCreditLimit(businessId, customerId, creditLimit, {
    roleCode: auth.context.roleCode,
    isOwner: auth.context.isOwner,
  });

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/clientes`);
    revalidatePath(`/workspace/${businessId}/clientes/${customerId}`);
  }
  return result;
}

/**
 * Registra una venta a crédito generando una cuenta por cobrar (accounts_receivable)
 * e incrementando credit_used del cliente.
 */
export async function createCreditSaleReceivableAction(
  businessId: string,
  input: CreateCreditSaleReceivableInput
) {
  const auth = await verifyWorkspaceAction(businessId, "customers.update");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para registrar ventas a crédito.",
    };
  }

  const result = await createCreditSaleReceivable(
    businessId,
    input,
    auth.context.userId
  );

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/clientes`);
    revalidatePath(`/workspace/${businessId}/clientes/${input.customerId}`);
  }
  return result;
}

/**
 * Registra un abono de cliente a una cuenta por cobrar (customer_payments),
 * reduciendo el saldo de la cuenta y el credit_used del cliente.
 */
export async function registerCustomerPaymentAction(
  businessId: string,
  input: RegisterCustomerPaymentInput
) {
  const auth = await verifyWorkspaceAction(businessId, "customers.update");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para registrar abonos de cartera.",
    };
  }

  const result = await registerCustomerPayment(
    businessId,
    input,
    auth.context.userId
  );

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/clientes`);
    if (result.payment?.customerId) {
      revalidatePath(`/workspace/${businessId}/clientes/${result.payment.customerId}`);
    }
  }
  return result;
}

/**
 * Obtiene los KPIs de cartera (pagado vs por cobrar, antigüedad) del negocio.
 */
export async function getAccountsReceivableKPIsAction(businessId: string) {
  const auth = await verifyWorkspaceAction(businessId, "customers.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar indicadores de cartera.",
    };
  }

  const data = await getAccountsReceivableKPIs(businessId);
  return { success: true, data };
}

/**
 * [CLI-003] Consulta las cuentas por cobrar y próximos cobros del negocio.
 */
export async function getBusinessAccountsReceivableAction(
  businessId: string,
  filters?: {
    status?: AccountReceivableStatus | "all" | "active";
    customerId?: string;
    search?: string;
    limit?: number;
  }
) {
  const auth = await verifyWorkspaceAction(businessId, "customers.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar cuentas por cobrar.",
    };
  }

  const data = await getBusinessAccountsReceivable(businessId, filters);
  return { success: true, data };
}

/**
 * [CLI-003] Consulta los clientes que más deben (Top Deudores).
 */
export async function getTopDebtorsAction(businessId: string, limit: number = 5) {
  const auth = await verifyWorkspaceAction(businessId, "customers.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar deudores.",
    };
  }

  const data = await getTopDebtors(businessId, limit);
  return { success: true, data };
}

/**
 * [CLI-003] Consulta las cuentas por cobrar y abonos de un cliente específico.
 */
export async function getCustomerReceivablesAction(businessId: string, customerId: string) {
  const auth = await verifyWorkspaceAction(businessId, "customers.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar cuentas del cliente.",
    };
  }

  const data = await getCustomerReceivables(businessId, customerId);
  return { success: true, data };
}

/**
 * [POS-003] Consulta el cupo de crédito y disponibilidad de un cliente para cobro en POS.
 */
export async function getCustomerCreditInfoAction(businessId: string, customerId: string) {
  const auth = await verifyWorkspaceAction(businessId, "customers.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar clientes.",
    };
  }

  const customer = await getCustomerById(businessId, customerId);
  if (!customer) {
    return { success: false, error: "Cliente no encontrado." };
  }

  const limit = Number(customer.creditLimit || 0);
  const used = Number(customer.creditUsed || 0);
  const available = Math.max(0, Number((limit - used).toFixed(2)));

  return {
    success: true,
    customer: {
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
      creditLimit: limit,
      creditUsed: used,
      creditAvailable: available,
      hasCredit: limit > 0,
    },
  };
}
