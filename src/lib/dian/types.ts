/**
 * NEGOVA — Tipos y Definiciones Canónicas para Facturación Electrónica DIAN [DIAN-001]
 * 
 * Cumple con el Anexo Técnico de Factura Electrónica de Venta de la DIAN (Resolución 000042 y 000165).
 * Soporta arquitectura de adaptadores multi-proveedor (DEC-007):
 * - negova_dian (Motor nativo DIAN en ambiente de pruebas y producción)
 * - alegra (Alegra API)
 * - siigo (Siigo Nube API)
 * - facturapi (FacturAPI)
 */

export type DianProvider = "negova_dian" | "alegra" | "siigo" | "facturapi";
export type DianEnvironment = "test" | "production";

export type TaxRegime = "responsable_iva" | "no_responsable_iva" | "simple";

export type FiscalResponsibility =
  | "O-13" // Gran contribuyente
  | "O-15" // Autorretenedor
  | "O-23" // Agente de retención IVA
  | "O-47" // Régimen Simple de Tributación
  | "R-99-PN"; // No responsable / No aplica

export type ElectronicDocumentType = "invoice" | "credit_note" | "debit_note";
export type ElectronicDocumentStatus = "draft" | "sent" | "accepted" | "rejected" | "cancelled";

export interface DianIssuerConfig {
  nit: string; // NIT sin guiones ni DV
  dv: string; // Dígito de verificación (0-9)
  legalName: string; // Razón Social
  tradeName: string; // Nombre Comercial
  email: string; // Correo de recepción fiscal
  phone: string; // Teléfono de contacto
  address: string; // Dirección fiscal
  city: string; // Municipio (ej: Medellín, Bogotá)
  cityCode?: string; // Código DANE ciudad (ej: "05001")
  department: string; // Departamento (ej: Antioquia, Cundinamarca)
  departmentCode?: string; // Código DANE departamento (ej: "05")
  postalCode?: string;
  taxRegime: TaxRegime;
  fiscalResponsibility: FiscalResponsibility;
}

export interface DianResolutionConfig {
  resolutionNumber: string; // Número de Formulario 1876 DIAN
  prefix: string; // Prefijo autorizado (ej: "FE", "SETP")
  fromNumber: number; // Rango inicial autorizado
  toNumber: number; // Rango final autorizado
  currentNumber: number; // Consecutivo actual a emitir
  validFrom: string; // Fecha de inicio de vigencia (YYYY-MM-DD)
  validTo: string; // Fecha de fin de vigencia (YYYY-MM-DD)
  technicalKey: string; // Clave técnica DIAN para hash CUFE
}

export interface DianProviderConfig {
  provider: DianProvider;
  environment: DianEnvironment;
  apiKey: string;
  apiSecret?: string;
  softwareId?: string; // ID de software DIAN
  softwarePin?: string; // PIN de software DIAN
  testSetId?: string; // TestSetId para modo de pruebas / habilitación
  certificateExpiryDate?: string;
  isEnabled: boolean;
  autoSendOnSale: boolean;
}

export interface DianBillingConfig {
  businessId: string;
  issuer: DianIssuerConfig;
  resolution: DianResolutionConfig;
  providerConfig: DianProviderConfig;
  isConfigured: boolean;
  isTestMode: boolean;
  updatedAt: string;
}

export interface ElectronicInvoiceRecord {
  id: string;
  businessId: string;
  saleDocumentId: string;
  documentNumber: string; // Prefijo + Número (ej: "FE-1001")
  documentType: ElectronicDocumentType;
  cufe: string; // Código Único de Factura Electrónica (o CUDE para notas)
  qrUrl: string; // URL de validación en catálogo público de la DIAN
  xmlUrl?: string | null;
  pdfUrl?: string | null;
  provider: DianProvider;
  environment: DianEnvironment;
  status: ElectronicDocumentStatus;
  dianResponseCode?: string | null;
  dianResponseDescription?: string | null;
  customerName: string;
  customerIdentification: string;
  customerEmail?: string | null;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  issuedAt: string;
  originalInvoiceCufe?: string | null; // Referencia obligatoria para Notas Crédito
  creditNoteReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SendDianInvoiceInput {
  saleDocumentId: string;
  documentType?: ElectronicDocumentType;
  customerName?: string;
  customerIdentification?: string;
  customerEmail?: string;
  customerAddress?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate?: number; // 0.19, 0.08, 0.05, 0
    total: number;
  }>;
  subtotal?: number;
  taxTotal?: number;
  total?: number;
  paymentMethod?: string;
  notes?: string;
}

export interface SendDianCreditNoteInput {
  saleDocumentId: string;
  originalCufe: string;
  reason: string;
  creditNoteReasonCode?: "1" | "2" | "3" | "4" | "5"; // 1: Devolución parcial, 2: Anulación factura, 3: Rebaja, 4: Ajuste precio, 5: Otros
  actorUserId?: string;
}
