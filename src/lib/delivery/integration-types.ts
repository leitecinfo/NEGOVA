export type DeliveryProvider = "rappi" | "justo";

export type DeliveryIntegrationStatus = "not_configured" | "active" | "testing" | "disabled";

export interface DeliveryProviderCredentials {
  appId?: string;
  clientSecret?: string;
  storeId?: string;
  apiKey?: string;
  webhookSecret?: string;
  environment: "sandbox" | "production";
}

export interface DeliveryProviderConfig {
  provider: DeliveryProvider;
  enabled: boolean;
  status: DeliveryIntegrationStatus;
  commissionPercent: number;
  autoAcceptOrders: boolean;
  credentials: DeliveryProviderCredentials;
  webhookUrl: string;
  lastSyncAt?: string | null;
  updatedAt?: string | null;
}

export interface DeliveryIntegrationsState {
  rappi: DeliveryProviderConfig;
  justo: DeliveryProviderConfig;
}

export interface FinancialComparisonItem {
  channel: "negova_direct" | "rappi" | "justo";
  label: string;
  badge: string;
  commissionRate: number; // Porcentaje e.g. 0, 0.20, 0.10
  sampleTicket: number;
  cogsRate: number; // Costo ingredientes e.g. 0.35 (35%)
  cogsAmount: number;
  commissionAmount: number;
  commissionVat: number; // IVA 19% sobre la comisión
  netProfit: number;
  netMarginPercent: number;
  customerDataOwnership: string;
  settlementDays: string;
  posIntegrationLevel: string;
}

export interface IntegrationStepItem {
  id: string;
  title: string;
  description: string;
  requirement: string;
  docLink?: string;
}

export interface SimulatedOrderPayload {
  provider: DeliveryProvider;
  externalOrderId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
}
