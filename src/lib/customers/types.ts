export type AccountReceivableStatus =
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled";

export type CustomerCreditTab = "all" | "with_credit" | "receivable" | "overdue";

export type CustomerDirectoryTab =
  | "all"
  | "active"
  | "inactive"
  | "individual"
  | "business"
  | "with_discount"
  | "with_credit"
  | "receivable"
  | "overdue";

export interface CustomerGlobalKPIs {
  totalRegistered: number;
  activeCount: number;
  inactiveCount: number;
  hasPurchasedCount: number;
  neverPurchasedCount: number;
  totalSalesAmount: number;
  totalBalanceAmount: number;
  withCreditCount: number;
  totalReceivable: number;
  debtCustomersCount: number;
  overdueBalance: number;
  overdueCustomersCount: number;
}

export interface Customer {
  id: string;
  businessId: string;
  fullName: string;
  customerType?: "individual" | "business";
  contactName?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  email?: string | null;
  taxId?: string | null;
  notes?: string | null;
  status: "active" | "inactive";
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  businessId: string;
  customerId: string;
  addressLine: string;
  reference?: string | null;
  label: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSummaryItem {
  id: string;
  businessId: string;
  fullName: string;
  customerType?: "individual" | "business";
  contactName?: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  notes: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  totalOrdersCount: number;
  totalSpentAmount: number;
  lastActivityDate: string | null;
  primaryAddress?: string | null;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  hasOverdueReceivables?: boolean;
  overdueAmount?: number;
  topRank?: number | null;
  balanceAmount?: number;
  averageTicket?: number;
}

export interface CustomerPayment {
  id: string;
  businessId: string;
  customerId: string;
  receivableId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface AccountReceivable {
  id: string;
  businessId: string;
  customerId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  orderId?: string | null;
  saleDocumentId?: string | null;
  amount: number;
  paidAmount: number;
  balance: number;
  dueDate: string;
  status: AccountReceivableStatus;
  isOverdue: boolean;
  daysOverdue: number;
  daysUntilDue: number;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  payments?: CustomerPayment[];
}

export interface AccountsReceivableAgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  daysOver60: number;
}

export interface AccountsReceivableKPIs {
  totalCreditGranted: number;
  totalReceivable: number;
  totalCollected: number;
  overdueBalance: number;
  customersWithCreditCount: number;
  customersWithDebtCount: number;
  customersWithReceivableCount?: number;
  overdueCustomersCount: number;
  agingBuckets: AccountsReceivableAgingBuckets;
  collectionRate?: number;
  portfolioHealthRate?: number;
}

export interface TopDebtorItem {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  overdueAmount: number;
  hasOverdue: boolean;
}

export interface CreateCreditSaleReceivableInput {
  customerId: string;
  orderId?: string | null;
  saleDocumentId?: string | null;
  amount: number;
  dueDate?: string | null;
  dueDays?: number;
  notes?: string | null;
}

export interface RegisterCustomerPaymentInput {
  customerId?: string;
  receivableId: string;
  amount: number;
  paymentMethod: string;
  paymentDate?: string;
  reference?: string | null;
  notes?: string | null;
}

export interface CustomerDetailView extends Customer {
  addresses: CustomerAddress[];
  recentOrders: Array<{
    id: string;
    orderNumber: number;
    orderType: "dine_in" | "takeout" | "delivery";
    status: string;
    total: number;
    createdAt: string;
    itemsSummary?: string;
  }>;
  recentSales: Array<{
    id: string;
    documentNumber: string;
    total: number;
    paymentMethod: string;
    status: string;
    issuedAt: string;
  }>;
  receivables?: AccountReceivable[];
  payments?: CustomerPayment[];
  metrics: {
    totalOrders: number;
    totalSalesCount: number;
    totalSpent: number;
    averageTicket: number;
    lastOrderAt: string | null;
  };
}

export interface CustomerFilterParams {
  businessId: string;
  search?: string;
  status?: "all" | "active" | "inactive";
  creditTab?: CustomerCreditTab;
  directoryTab?: CustomerDirectoryTab;
  period?: "all" | "today" | "7d" | "month" | "year";
  sortBy?: "sales_desc" | "orders_desc" | "name_asc" | "name_desc" | "recent";
  page?: number;
  pageSize?: number;
}

export interface CreateCustomerInput {
  fullName: string;
  customerType?: "individual" | "business";
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  notes?: string | null;
  addressLine?: string | null;
  addressReference?: string | null;
  creditLimit?: number;
}

export interface UpdateCustomerInput {
  fullName?: string;
  customerType?: "individual" | "business";
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  notes?: string | null;
  status?: "active" | "inactive";
  creditLimit?: number;
}
