"use server";

import {
  getWorkspacePayrollPeriodsAction as _getWorkspacePayrollPeriodsAction,
  getWorkspacePayrollPeriodDetailAction as _getWorkspacePayrollPeriodDetailAction,
  createWorkspacePayrollPeriodAction as _createWorkspacePayrollPeriodAction,
  approveWorkspacePayrollPeriodAction as _approveWorkspacePayrollPeriodAction,
  registerWorkspacePayrollPaymentAction as _registerWorkspacePayrollPaymentAction,
  cancelWorkspacePayrollReceiptAction as _cancelWorkspacePayrollReceiptAction,
} from "../personal/actions";

export async function getWorkspacePayrollPeriodsAction(...args: Parameters<typeof _getWorkspacePayrollPeriodsAction>) {
  return _getWorkspacePayrollPeriodsAction(...args);
}

export async function getWorkspacePayrollPeriodDetailAction(...args: Parameters<typeof _getWorkspacePayrollPeriodDetailAction>) {
  return _getWorkspacePayrollPeriodDetailAction(...args);
}

export async function createWorkspacePayrollPeriodAction(...args: Parameters<typeof _createWorkspacePayrollPeriodAction>) {
  return _createWorkspacePayrollPeriodAction(...args);
}

export async function approveWorkspacePayrollPeriodAction(...args: Parameters<typeof _approveWorkspacePayrollPeriodAction>) {
  return _approveWorkspacePayrollPeriodAction(...args);
}

export async function registerWorkspacePayrollPaymentAction(...args: Parameters<typeof _registerWorkspacePayrollPaymentAction>) {
  return _registerWorkspacePayrollPaymentAction(...args);
}

export async function cancelWorkspacePayrollReceiptAction(...args: Parameters<typeof _cancelWorkspacePayrollReceiptAction>) {
  return _cancelWorkspacePayrollReceiptAction(...args);
}
