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
