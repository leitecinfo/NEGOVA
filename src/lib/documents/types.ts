/**
 * Modelos y Tipos Canónicos para Documentos Comerciales y Configuración de Negocios Clientes
 * 
 * Regla Fundamental de Aislamiento:
 * Toda configuración y todo documento pertenece estrictamente a un `businessId`.
 * Un negocio nunca puede ver ni modificar la configuración ni los documentos de otro.
 */

export interface BusinessDocumentConfig {
  businessId: string;

  // 1. Datos del negocio
  tradeName: string; // Nombre comercial *
  legalName?: string; // Razón social / titular legal
  taxId?: string; // NIT / identificación tributaria
  phone?: string; // Teléfono de contacto
  whatsapp?: string; // WhatsApp de atención
  email?: string; // Correo electrónico comercial
  address?: string; // Dirección física
  city?: string; // Ciudad / municipio
  department?: string; // Departamento
  postalCode?: string; // Código postal (opcional)

  // 2. Identidad visual
  logoUrl?: string | null; // Logotipo del negocio
  primaryColor: string; // Hex color de marca (ej: #ED500A, #2563EB)

  // 3. Comprobantes y documentos
  documentTitleDefault: string; // Título del documento (ej: "COMPROBANTE DE VENTA", "RECIBO DE CAJA")
  headerText?: string | null; // Subtítulo / leyenda
  thankYouNote?: string | null; // Mensaje de agradecimiento
  documentObservations?: string | null; // Observaciones
  termsAndConditions?: string | null; // Términos y condiciones
  /** @deprecated Alias de compatibilidad — usar termsAndConditions */
  termsConditions?: string | null;
  returnPolicy?: string | null; // Política de cambios y devoluciones
  warrantyPolicy?: string | null; // Política de garantía
  footerText?: string | null; // Pie de página

  updatedAt: string;
}

export type BusinessDocumentType = "sale" | "service" | "order" | "receipt";
export type BusinessDocumentStatus = "completed" | "pending" | "cancelled" | "issued" | "paid" | "refunded";
export type BusinessPaymentMethod = "cash" | "transfer" | "card" | "credit" | "other";

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
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}
