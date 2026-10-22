export type PaymentMethodCode =
  | "cash"
  | "nequi"
  | "daviplata"
  | "bancolombia"
  | "davivienda"
  | "nu"
  | "bre_b";

export type LegacyPaymentMethod = "transfer" | "card" | "online" | "other";

export type PaymentDestinationType =
  | "phone"
  | "savings_account"
  | "checking_account"
  | "email"
  | "alphanumeric"
  | "merchant_code"
  | "id_number";

export type BreBKeyType = "phone" | "email" | "alphanumeric" | "merchant_code";

export interface BusinessPaymentMethodConfig {
  code: PaymentMethodCode;
  name: string;
  isEnabled: boolean;
  isConfigured: boolean;
  accountHolder?: string | null;
  destinationType?: PaymentDestinationType | null;
  destinationValue?: string | null;
  instructions?: string | null;
  breBKeyType?: BreBKeyType | null;
  qrUrl?: string | null;
  qrStoragePath?: string | null;
  updatedAt?: string;
}

export interface PaymentMethodMetadata {
  code: PaymentMethodCode;
  name: string;
  category: "cash" | "wallet" | "bank" | "account" | "key";
  categoryLabel: string;
  description: string;
  logoPath: string | null; // null si no existe en public/bancos
  supportsQr: boolean;
  allowedDestinationTypes: { value: PaymentDestinationType; label: string }[];
  defaultDestinationType: PaymentDestinationType;
  destinationValueLabel: string;
  destinationValuePlaceholder: string;
  requiresAccountHolder: boolean;
}

export interface PublicPaymentMethodDTO {
  code: PaymentMethodCode;
  name: string;
  category: string;
  logoPath: string | null;
  accountHolder: string | null;
  destinationType: PaymentDestinationType | null;
  destinationValue: string | null;
  instructions: string | null;
  breBKeyType: BreBKeyType | null;
  qrUrl: string | null;
}
