export interface LoyaltyProgramConfig {
  enabled: boolean;
  pointsPerSpentAmount: number; // Ej: 1000 => 1 punto por cada $1.000 gastados
  redemptionValuePerPoint: number; // Ej: 10 => 1 punto equivale a $10 COP de descuento
  minPointsToRedeem: number; // Ej: 50 => Mínimo 50 puntos acumulados para poder redimir
  maxDiscountPercentage: number; // Ej: 50 => Máximo el 50% de la cuenta se puede cubrir con puntos
}

export const DEFAULT_LOYALTY_PROGRAM_CONFIG: LoyaltyProgramConfig = {
  enabled: true,
  pointsPerSpentAmount: 1000,
  redemptionValuePerPoint: 10,
  minPointsToRedeem: 50,
  maxDiscountPercentage: 50,
};

export interface CustomerLoyaltyAccount {
  id?: string;
  businessId: string;
  customerId: string;
  pointsBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  equivalentMoneyValue: number; // Valor en COP de su saldo actual
  canRedeem: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type LoyaltyTransactionType = "earned" | "redeemed" | "adjusted" | "expired";
export type LoyaltyReferenceType = "order" | "sale_document" | "manual" | "reward";

export interface LoyaltyTransaction {
  id: string;
  businessId: string;
  customerId: string;
  points: number;
  type: LoyaltyTransactionType;
  referenceId?: string | null;
  referenceType: LoyaltyReferenceType;
  description?: string | null;
  balanceAfter: number;
  createdAt: string;
}

export interface PointsRedemptionCalculation {
  pointsToRedeem: number;
  discountAmount: number;
  remainingPoints: number;
  maxPointsAllowed: number;
  isValid: boolean;
  errorMessage?: string;
}

