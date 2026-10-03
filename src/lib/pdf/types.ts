/**
 * Tipos y Contratos para el Motor Universal de Generación de PDFs en NEGOVA
 * 
 * Soporta dos ámbitos aislados:
 * 1. Documentos Institucionales de la Plataforma NEGOVA (Cobros SaaS CMP-XXXX)
 * 2. Documentos Comerciales de Negocios Clientes (Ventas / Servicios DOC-XXXX)
 */

export type PdfDocumentType =
  | "negova_billing_document"
  | "business_sale_document"
  | "business_service_document";

/**
 * 1. DATOS PARA COMPROBANTE DE COBRO INSTITUCIONAL NEGOVA (Plataforma)
 */
export interface NegovaBillingPdfData {
  invoiceNumber: string; // CMP-2026-0001
  businessName: string;
  businessSlug?: string;
  businessNit?: string | null;
  businessEmail?: string | null;
  businessAddress?: string | null;
  businessCity?: string | null;
  
  planId: string;
  planName: string;
  billingInterval: "monthly" | "yearly";
  amount: number;
  currency: "COP";
  status: "paid" | "pending" | "void" | "failed";
  paymentMethod: "transfer" | "cash" | "manual";
  paymentReference?: string | null;
  
  issuedAt: string;
  dueDate: string;
  paidAt?: string | null;
  periodText?: string;
  notes?: string | null;
  logoBase64?: string;
}

/**
 * 2. DATOS PARA DOCUMENTO COMERCIAL DE NEGOCIO CLIENTE (Workspace)
 */
export interface BusinessSaleItemPdf {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
}

export interface BusinessSalePdfData {
  documentNumber: string; // DOC-2026-0001 / FAC-0001
  documentTitle?: string; // "DOCUMENTO DE VENTA" | "CUENTA DE COBRO" | "ORDEN DE SERVICIO"
  
  // Emisor (Negocio)
  businessId: string;
  tradeName: string;
  legalName?: string;
  taxId?: string; // NIT / CC
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  primaryColor?: string; // Hex, ej: #ED500A o #1E293B
  
  // Receptor (Cliente final del negocio)
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  
  // Archivos
  logoBase64?: string;

  
  // Fechas y detalles
  issuedAt: string;
  dueDate?: string;
  paymentMethod?: string;
  
  // Items y Totales
  items: BusinessSaleItemPdf[];
  subtotal: number;
  discountTotal?: number;
  taxTotal?: number;
  total: number;
  currency: string; // "COP"
  
  // Textos y pie de página
  notes?: string | null;
  thankYouNote?: string | null;
  footerText?: string | null;
}

/**
 * Resultado estandarizado de la generación
 */
export interface PdfGenerationResult {
  buffer: Buffer;
  base64: string;
  filename: string;
  sizeBytes: number;
}
