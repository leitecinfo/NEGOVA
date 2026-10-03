/**
 * Tipos y Definiciones Canónicas de Suscripciones
 * Seguro para importar tanto en Server Components como en Client Components (zero side-effects).
 */

import {
  PlanId,
  BillingInterval,
  VigenciaBadgeInfo,
  PlanLimits,
} from "@/config/plans";

export type SubscriptionStatus =
  | "active"
  | "trial"
  | "suspended"
  | "past_due"
  | "canceled"
  | "inactive";

export interface AnnualDiscountConfig {
  isEnabled: boolean;
  percentage: number;
}

export interface SubscriptionOwnerSummary {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
}

export interface SubscriptionModel {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessType: string;
  businessStatus: string;
  owner: SubscriptionOwnerSummary | null;
  planId: PlanId;
  planName: string;
  planCode: string;
  planPrice: number;
  currentPrice: number;
  price: number;
  currency: string;
  billingInterval: BillingInterval;
  contractDuration: number;
  durationFormatted: string;
  monthsContracted: number;
  status: SubscriptionStatus;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  remainingDays: number;
  trialRemainingDays: number | null;
  isExpired: boolean;
  isTrial: boolean;
  vigenciaBadge: VigenciaBadgeInfo;
  limits: PlanLimits;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  planId?: string;
  billingInterval?: string;
  sortBy?: "business_name" | "current_period_end" | "created_at" | "remaining_days";
  sortDirection?: "asc" | "desc";
}

export interface SubscriptionKPIs {
  total: number;
  active: number;
  trial: number;
  expiringSoon: number;
  suspendedOrPastDue: number;
  monthlyEstimatedRevenue: number;
}

export interface SubscriptionsListResult {
  subscriptions: SubscriptionModel[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis: SubscriptionKPIs;
}

/**
 * Normaliza un código de plan a PlanId canónico
 */
export function resolveCanonicalPlanId(planCodeOrId: string | null | undefined): PlanId {
  if (!planCodeOrId) return "inicio";
  const lower = planCodeOrId.toLowerCase();
  if (lower.includes("negocio")) return "negocio";
  if (lower.includes("crece")) return "crece";
  return "inicio";
}
