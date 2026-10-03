import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSubscriptionsList,
  resolveCanonicalPlanId,
  renewOrExtendSubscription,
  changeSubscriptionStatus,
  changeSubscriptionPlan,
} from "../../src/lib/subscriptions/subscriptions-service";
import { NEGOVA_PLANS, COMMERCIAL_PLANS_LIST } from "../../src/config/plans";
import { renewOrExtendSubscription as businessRenewDelegate } from "../../src/lib/businesses/businesses-service";

describe("Centralized Subscriptions Service & Canonical Plans Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Canonical Plans Definition & Plan Resolution", () => {
    it("debe contener exactamente los 3 planes oficiales: Inicio, Crece y Negocio", () => {
      expect(COMMERCIAL_PLANS_LIST.length).toBe(3);
      expect(COMMERCIAL_PLANS_LIST.map((p) => p.id)).toEqual(["inicio", "crece", "negocio"]);

      expect(NEGOVA_PLANS.inicio.pricing.monthly).toBe(29900);
      expect(NEGOVA_PLANS.crece.pricing.monthly).toBe(59900);
      expect(NEGOVA_PLANS.negocio.pricing.monthly).toBe(99900);
    });

    it("debe resolver correctamente códigos de planes a su PlanId canónico", () => {
      expect(resolveCanonicalPlanId("PLAN-INICIO-V1")).toBe("inicio");
      expect(resolveCanonicalPlanId("PLAN-CRECE-V1")).toBe("crece");
      expect(resolveCanonicalPlanId("PLAN-NEGOCIO-V1")).toBe("negocio");
      expect(resolveCanonicalPlanId(null)).toBe("inicio");
      expect(resolveCanonicalPlanId("desconocido")).toBe("inicio");
    });
  });

  describe("2. Single Source of Truth & Service Delegation", () => {
    it("businesses-service debe exponer renewOrExtendSubscription", () => {
      expect(typeof businessRenewDelegate).toBe("function");
    });
  });

  describe("3. Subscriptions List & KPI Aggregations", () => {
    it("debe retornar estructura completa con paginación y KPIs consolidados", async () => {
      const result = await getSubscriptionsList({ page: 1, pageSize: 15 });

      expect(result).toHaveProperty("subscriptions");
      expect(result).toHaveProperty("totalCount");
      expect(result).toHaveProperty("page");
      expect(result).toHaveProperty("kpis");

      expect(result.kpis).toHaveProperty("total");
      expect(result.kpis).toHaveProperty("active");
      expect(result.kpis).toHaveProperty("trial");
      expect(result.kpis).toHaveProperty("expiringSoon");
      expect(result.kpis).toHaveProperty("suspendedOrPastDue");
      expect(result.kpis).toHaveProperty("monthlyEstimatedRevenue");
    });
  });
});
