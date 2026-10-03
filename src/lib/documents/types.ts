/**
 * Modelos y Tipos Canónicos para Documentos Comerciales de Negocios Clientes
 * 
 * Regla Fundamental de Aislamiento:
 * Toda configuración y todo documento pertenece estrictamente a un `businessId`.
 * Un negocio nunca puede ver ni modificar la configuración ni los documentos de otro.
 */

export interface BusinessDocumentConfig {
  businessId: string;
  tradeName: string;
  legalName?: string;
  taxId?: string; // NIT / Cédula
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  logoUrl?: string | null;
  primaryColor: string; // Hex color de marca (ej: #ED500A, #0284C7, #16A34A)
  documentTitleDefault: string; // "DOCUMENTO DE VENTA" | "CUENTA DE COBRO" | "ORDEN DE SERVICIO"
  headerText?: string | null;
  footerText?: string | null;
  thankYouNote?: string | null;
  termsAndConditions?: string | null;
  updatedAt: string;
}

export type BusinessDocumentType = "sale" | "service" | "order" | "receipt";
export type BusinessDocumentStatus = "completed" | "pending" | "cancelled";
export type BusinessPaymentMethod = "cash" | "transfer" | "credit" | "other";

export interface BusinessDocumentItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
}

export interface BusinessSaleDocument {
  id: string;
  businessId: string;
  documentNumber: string; // Formato: DOC-2026-0001
  documentType: BusinessDocumentType;
  
  // Cliente receptor
  customerName: string;
  customerId?: string | null; // Cédula / NIT del cliente
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  
  // Items y valores
  items: BusinessDocumentItem[];
  subtotal: number;
  discountTotal?: number;
  taxTotal?: number;
  total: number;
  currency: "COP";
  
  // Estado y pago
  paymentMethod: BusinessPaymentMethod;
  status: BusinessDocumentStatus;
  issuedAt: string;
  dueDate?: string | null;
  notes?: string | null;
  
  // Referencias de archivo y PDF
  pdfUrl?: string | null;
  pdfStoragePath?: string | null;
  
  createdAt: string;
  updatedAt: string;
}

export interface BusinessDocumentFilterParams {
  businessId: string; // Obligatorio para aislamiento multi-tenant
  search?: string;
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}
