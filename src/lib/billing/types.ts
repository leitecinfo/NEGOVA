import { PlanId, BillingInterval } from "@/config/plans";

export type InvoiceStatus = "paid" | "pending" | "void" | "failed";
export type PaymentMethod = "transfer" | "cash" | "manual";

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string; // Formato interno: CMP-2026-0001
  businessId: string;
  businessName: string;
  businessSlug: string;
  planId: PlanId;
  planName: string;
  billingInterval: BillingInterval;
  amount: number;
  currency: "COP";
  status: InvoiceStatus;
  paymentMethod: PaymentMethod;
  paymentReference?: string | null;
  issuedAt: string;
  dueDate: string;
  paidAt?: string | null;
  notes?: string | null;
  pdfUrl?: string | null;
  pdfStoragePath?: string | null;
  lastEmailSentAt?: string | null;
  lastSentToEmail?: string | null;
}

export interface BillingFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  planId?: string;
  businessId?: string;
}

export interface BillingListResult {
  invoices: InvoiceRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    totalBilledCOP: number;
    totalPaidCOP: number;
    totalPendingCOP: number;
    paidCount: number;
    pendingCount: number;
    voidCount: number;
  };
}
