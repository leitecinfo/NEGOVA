import { z } from "zod";

// ==========================================
// PROVEEDORES (SUPPLIERS)
// ==========================================

export const SupplierStatusSchema = z.enum(["active", "inactive", "archived"]);
export type SupplierStatus = z.infer<typeof SupplierStatusSchema>;

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxId?: string | null;
  paymentTermsDays: number;
  notes?: string | null;
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
}

export const CreateSupplierInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre del proveedor es obligatorio"),
  contactName: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email("Correo electrónico no válido").nullable().optional().or(z.literal("")),
  address: z.string().trim().nullable().optional(),
  taxId: z.string().trim().nullable().optional(),
  paymentTermsDays: z.coerce.number().min(0).default(0),
  notes: z.string().trim().nullable().optional(),
});

export type CreateSupplierInput = z.infer<typeof CreateSupplierInputSchema>;

export const UpdateSupplierInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre del proveedor es obligatorio").optional(),
  contactName: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email("Correo electrónico no válido").nullable().optional().or(z.literal("")),
  address: z.string().trim().nullable().optional(),
  taxId: z.string().trim().nullable().optional(),
  paymentTermsDays: z.coerce.number().min(0).optional(),
  notes: z.string().trim().nullable().optional(),
  status: SupplierStatusSchema.optional(),
});

export type UpdateSupplierInput = z.infer<typeof UpdateSupplierInputSchema>;

// ==========================================
// ÍTEMS DE COMPRA (PURCHASE ITEMS)
// ==========================================

export type PurchaseItemCategory = "ingredient" | "resale" | "free";

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  businessId: string;
  productId?: string | null;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  locationId?: string | null;
  locationName?: string | null;
  isInventoryItem: boolean;
  itemCategory?: PurchaseItemCategory;
  purchaseUnit?: string | null;
  inventoryUnit?: string | null;
  conversionFactor?: number | null;
  inventoryQuantity?: number | null;
  discount?: number | null;
  createdAt: string;
}

export const PurchaseItemInputSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  itemName: z.string().trim().min(1, "El nombre del ítem es obligatorio"),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unitCost: z.coerce.number().min(0, "El costo unitario no puede ser negativo"),
  locationId: z.string().uuid().nullable().optional(),
  isInventoryItem: z.boolean().default(true),
  itemCategory: z.enum(["ingredient", "resale", "free"]).optional(),
  purchaseUnit: z.string().trim().optional(),
  inventoryUnit: z.string().trim().optional(),
  conversionFactor: z.coerce.number().positive().default(1).optional(),
  discount: z.coerce.number().min(0).default(0).optional(),
});

export type PurchaseItemInput = z.infer<typeof PurchaseItemInputSchema>;

// ==========================================
// RESUMEN DE IMPACTO OPERATIVO ('QUÉ PASÓ')
// ==========================================

export interface PurchaseItemImpact {
  productId?: string | null;
  itemName: string;
  itemCategory: PurchaseItemCategory;
  quantityAdded: number;
  previousStock: number;
  newStock: number;
  previousCost: number;
  newAverageCost: number;
  unit: string;
  locationName?: string | null;
}

export interface PurchaseCashImpact {
  deducted: boolean;
  amount: number;
  cashRegisterName?: string | null;
  sessionId?: string | null;
}

export interface PurchaseImpactSummary {
  inventoryImpacts: PurchaseItemImpact[];
  cashImpact: PurchaseCashImpact;
}

// ==========================================
// COMPRAS (PURCHASES)
// ==========================================

export const PaymentTypeSchema = z.enum(["cash", "credit"]);
export type PaymentType = z.infer<typeof PaymentTypeSchema>;

export const PurchaseStatusSchema = z.enum(["confirmed", "cancelled"]);
export type PurchaseStatus = z.infer<typeof PurchaseStatusSchema>;

export const PurchasePaymentStatusSchema = z.enum([
  "paid",
  "partially_paid",
  "pending",
  "cancelled",
]);
export type PurchasePaymentStatus = z.infer<typeof PurchasePaymentStatusSchema>;

export const DocumentTypeSchema = z.enum([
  "factura",
  "remision",
  "cuenta_cobro",
  "ticket",
  "documento_equivalente",
  "otro",
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type PurchaseDocumentType = DocumentType;

export interface Purchase {
  id: string;
  businessId: string;
  purchaseNumber: string; // e.g. COMP-00001
  supplierId?: string | null;
  supplierName?: string | null;
  supplierTaxId?: string | null;
  invoiceNumber?: string | null;
  documentType?: DocumentType | string | null;
  purchaseDate: string;
  dueDate?: string | null;
  subtotal: number;
  discountAmount?: number;
  taxAmount: number;
  retentionAmount?: number;
  total: number;
  paidAmount: number;
  balance: number;
  paymentType: PaymentType;
  paymentMethod: string;
  paymentStatus: PurchasePaymentStatus;
  status: PurchaseStatus;
  itemsCount?: number;
  notes?: string | null;
  deductFromCashRegister?: boolean;
  cashRegisterName?: string | null;
  createdBy?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseItem[];
  accountPayable?: AccountsPayable | null;
  impactSummary?: PurchaseImpactSummary | null;
}

export const CreatePurchaseInputSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  invoiceNumber: z.string().trim().nullable().optional(),
  documentType: z.string().trim().default("factura").optional(),
  purchaseDate: z.string().optional(),
  paymentType: PaymentTypeSchema.default("cash"),
  paymentMethod: z.string().trim().default("cash"),
  dueDate: z.string().optional(), // Para compras a crédito
  discountAmount: z.coerce.number().min(0).default(0).optional(),
  taxPercentage: z.coerce.number().min(0).max(100).default(0), // e.g. 19%
  retentionPercentage: z.coerce.number().min(0).max(100).default(0),
  initialPaymentAmount: z.coerce.number().min(0).default(0).optional(),
  initialPaymentMethod: z.string().trim().optional(),
  notes: z.string().trim().nullable().optional(),
  items: z.array(PurchaseItemInputSchema).min(1, "La compra debe incluir al menos un artículo"),
  deductFromCashRegister: z.boolean().optional(),
});

export type CreatePurchaseInput = z.infer<typeof CreatePurchaseInputSchema>;

// ==========================================
// CUENTAS POR PAGAR (ACCOUNTS PAYABLE) [PROV-003]
// ==========================================

export const AccountPayableStatusSchema = z.enum([
  "pending",
  "partial",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
]);
export type AccountPayableStatus = z.infer<typeof AccountPayableStatusSchema>;

export interface AccountsPayable {
  id: string;
  businessId: string;
  purchaseId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  purchaseNumber?: string | null;
  amount?: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  dueDate: string;
  status: AccountPayableStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountPayablePayment {
  id: string;
  businessId: string;
  accountPayableId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string | null;
  notes?: string | null;
  deductFromCashRegister?: boolean;
  cashRegisterName?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export const RegisterPaymentInputSchema = z.object({
  accountPayableId: z.string().uuid("ID de cuenta por pagar inválido"),
  amount: z.coerce.number().positive("El monto a abonar debe ser mayor a 0"),
  paymentMethod: z.string().trim().min(1, "El método de pago es obligatorio").default("cash"),
  paymentDate: z.string().optional(),
  reference: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export type RegisterPaymentInput = z.infer<typeof RegisterPaymentInputSchema>;

export interface AccountsPayableWithDetails extends AccountsPayable {
  amount: number;
  supplierContact?: string | null;
  supplierPhone?: string | null;
  supplierTaxId?: string | null;
  purchaseInvoiceNumber?: string | null;
  payments?: AccountPayablePayment[];
  isOverdue: boolean;
  daysUntilDue: number;
}

export interface AccountsPayableKPIs {
  totalBalance: number;
  overdueBalance: number;
  upcomingBalance: number;
  pendingAccountsCount: number;
  overdueAccountsCount: number;
}

export interface AccountsPayableFilters {
  status?: "all" | "pending" | "partial" | "paid" | "overdue";
  supplierId?: string;
  dueDateRange?: "today" | "next_7d" | "this_month" | "overdue" | "all";
  search?: string;
}

// ==========================================
// KPIS Y FILTROS DE COMPRAS
// ==========================================

export type PurchasePeriodPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "this_week"
  | "30d"
  | "this_month"
  | "last_month"
  | "all"
  | "custom";

export interface PurchaseKPIs {
  totalPurchased: number;
  totalPurchasesCount: number;
  totalPaid: number;
  paidPurchasesCount: number;
  totalPendingBalance: number;
  pendingPurchasesCount: number;
  uniqueSuppliersCount: number;
  totalCash: number;
  totalCredit: number;
  dueTodayOrOverdue: number;
}

export interface PurchaseFilters {
  period?: PurchasePeriodPreset;
  startDate?: string;
  endDate?: string;
  supplierId?: string;
  paymentType?: "cash" | "credit" | "all";
  paymentMethod?: string;
  paymentStatus?: "all" | "paid" | "partially_paid" | "pending";
  purchaseStatus?: "all" | "confirmed" | "cancelled";
  statusTab?: "all" | "cash" | "credit" | "pending" | "overdue";
  search?: string;
  documentType?: string;
}

