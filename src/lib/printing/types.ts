export interface PrintableDocumentItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
}

export interface PrintableDocument {
  documentType: "sale" | "invoice" | "receipt" | "other";
  documentNumber: string;
  issuedAt: string; // ISO Date
  business: {
    id: string;
    name: string;
    legalName?: string;
    taxId?: string;
    address?: string;
    phone?: string;
  };
  customer?: {
    name: string;
    id?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  items: PrintableDocumentItem[];
  subtotal: number;
  discountTotal?: number;
  taxTotal?: number;
  total: number;
  paymentMethod: string;
  notes?: string;
}

// ============================================================================
// CONFIGURACIÓN DE IMPRESIÓN, ESTACIONES Y DISPOSITIVOS [CONF-002]
// ============================================================================

export type PrinterType = "thermal_80mm" | "thermal_58mm" | "sheet_letter";
export type PrinterConnectionType = "usb" | "network" | "bluetooth";
export type PrinterStatus = "active" | "inactive";
export type PrintingArea = "caja" | "cocina" | "barra" | "despacho";
export type PrintDriverType = "browser" | "qz_tray";

export interface PrinterConfig {
  id: string;
  name: string;
  type: PrinterType;
  connection: PrinterConnectionType;
  ipAddress?: string;
  port?: number;
  status: PrinterStatus;
  isDefault?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PrintingStation {
  id: string;
  name: string;
  area: PrintingArea;
  printerId: string | null;
  cashRegisterId?: string | null; // Vinculación a public.cash_registers
  cashRegisterName?: string | null;
  autoPrintReceipt: boolean;
  autoPrintOrderCommand: boolean;
  openCashDrawerOnCashSale: boolean;
  copies: number;
  createdAt: string;
  updatedAt?: string;
}

export interface TicketTemplateConfig {
  showLogo: boolean;
  businessName: string;
  tradeName?: string;
  legalName?: string;
  taxId: string;
  address: string;
  phone: string;
  whatsapp?: string;
  headerText: string;
  footerText: string;
  thankYouNote: string;
  paperWidth: "80mm" | "58mm";
  showCustomerInfo: boolean;
  showWaiterInfo: boolean;
  showPaymentDetails: boolean;
  customLogoUrl?: string | null;
}

export interface KitchenCommandTemplateConfig {
  format: "compact" | "detailed";
  showPrices: boolean; // default false (Cocina no muestra precios)
  highlightModifiers: boolean; // default true (Modificadores resaltados)
  groupItemsByCategory: boolean;
  fontSize: "sm" | "md" | "lg";
  showDinersCount: boolean;
  showWaiterName: boolean;
  showTableNumber: boolean;
  paperWidth: "80mm" | "58mm";
  headerTitle: string; // ej. "*** COMANDA DE COCINA ***"
}

export interface CashDrawerConfig {
  autoOpenOnCashSale: boolean;
  openOnSaleEnd: boolean;
  drawerKickCode: string; // ej. "ESC p 0 25 250"
  targetPrinterId: string | null;
}

export interface PrintingSettings {
  printers: PrinterConfig[];
  stations: PrintingStation[];
  ticketTemplate: TicketTemplateConfig;
  kitchenCommandTemplate: KitchenCommandTemplateConfig;
  cashDrawer: CashDrawerConfig;
  printDriver: PrintDriverType;
  updatedAt?: string;
}

export interface AvailableCashRegister {
  id: string;
  name: string;
  isActive: boolean;
  locationId?: string | null;
}

