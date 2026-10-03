import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculatePeriodDates,
  calculateRemainingDays,
  getVigenciaStatusBadge,
  formatVigenciaDate,
} from "../../src/config/plans";
import {
  createBusiness,
  getBusinessDetail,
  renewOrExtendSubscription,
  changeBusinessStatus,
} from "../../src/lib/businesses/businesses-service";
import { hasPermission } from "../../src/lib/auth/authorization";

describe("Subscription Vigencia, Billing Intervals & Access Gating", () => {
  const SUPER_ADMIN_ID = "fb3dd639-2033-4ee4-8208-88cbfb665a36";
  const TEST_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
  const TEST_USER_ID = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Canonical Date & Vigencia Calculations (src/config/plans.ts)", () => {
    it("debe calcular exactamente N meses para la modalidad mensual", () => {
      const start = new Date("2026-09-09T00:00:00.000Z");
      const { startDate, endDate, monthsContracted, durationFormatted } = calculatePeriodDates(start, "monthly", 6);

      expect(new Date(startDate).toISOString()).toBe(start.toISOString());
      expect(monthsContracted).toBe(6);
      expect(durationFormatted).toBe("6 meses");

      const end = new Date(endDate);
      expect(end.getUTCFullYear()).toBe(2027);
      expect(end.getUTCMonth()).toBe(2); // Marzo (0-indexed: 2)
      expect(end.getUTCDate()).toBe(9);
    });

    it("debe calcular exactamente N años para la modalidad anual", () => {
      const start = new Date("2026-09-09T00:00:00.000Z");
      const { startDate, endDate, monthsContracted, durationFormatted } = calculatePeriodDates(start, "annual", 2);

      expect(monthsContracted).toBe(24);
      expect(durationFormatted).toBe("2 años");

      const end = new Date(endDate);
      expect(end.getUTCFullYear()).toBe(2028);
      expect(end.getUTCMonth()).toBe(8); // Septiembre (0-indexed: 8)
      expect(end.getUTCDate()).toBe(9);
    });

    it("debe calcular dinámicamente los días restantes según la fecha actual", () => {
      const now = new Date("2026-09-09T00:00:00.000Z");
      const in30Days = new Date("2026-10-09T00:00:00.000Z");
      const in5Days = new Date("2026-09-14T00:00:00.000Z");
      const inPast = new Date("2026-09-01T00:00:00.000Z");

      expect(calculateRemainingDays(in30Days, now)).toBe(30);
      expect(calculateRemainingDays(in5Days, now)).toBe(5);
      expect(calculateRemainingDays(inPast, now)).toBeLessThanOrEqual(0);
      expect(calculateRemainingDays(null, now)).toBe(0);
    });

    it("debe asignar los colores y semáforo visual correcto según los días restantes", () => {
      // > 15 días: Verde (Emerald / Normal)
      const normal = getVigenciaStatusBadge(25, "active", false);
      expect(normal.badgeVariant).toBe("emerald");
      expect(normal.isExpired).toBe(false);
      expect(normal.isUrgent).toBe(false);

      // 6 a 15 días: Naranja (Amber / Advertencia)
      const warning = getVigenciaStatusBadge(10, "active", false);
      expect(warning.badgeVariant).toBe("amber");
      expect(warning.isExpired).toBe(false);
      expect(warning.isUrgent).toBe(false);

      // 1 a 5 días: Rojo (Red / Muy próximo a vencer)
      const critical = getVigenciaStatusBadge(3, "active", false);
      expect(critical.badgeVariant).toBe("red");
      expect(critical.isUrgent).toBe(true);
      expect(critical.isExpired).toBe(false);

      // 0 o menos días: Vencido (Red / Vencido)
      const expired = getVigenciaStatusBadge(0, "active", false);
      expect(expired.badgeVariant).toBe("red");
      expect(expired.isExpired).toBe(true);
      expect(expired.label).toContain("Vencido");

      // Negocio suspendido o inactivo
      const suspended = getVigenciaStatusBadge(20, "suspended", false);
      expect(suspended.badgeVariant).toBe("gray");
      expect(suspended.label).toBe("Suspendido");

      // Período de prueba gratuita activa
      const trialActive = getVigenciaStatusBadge(30, "trial", true);
      expect(trialActive.badgeVariant).toBe("amber");
      expect(trialActive.label).toBe("30 días de prueba");
      expect(trialActive.text).toBe("Prueba gratuita activa (30 días)");

      // Período de prueba gratuita vencida
      const trialExpired = getVigenciaStatusBadge(0, "trial", true);
      expect(trialExpired.badgeVariant).toBe("red");
      expect(trialExpired.label).toBe("Prueba vencida");
      expect(trialExpired.text).toBe("Período de prueba finalizado");
    });

    it("debe formatear fechas legibles en formato DD/MM/AAAA", () => {
      expect(formatVigenciaDate("2026-09-09T12:00:00.000Z")).toContain("/09/2026");
      expect(formatVigenciaDate(null)).toBe("Sin registrar");
    });
  });

  describe("2. Operational Access Gating on Expired / Inactive Tenants (hasPermission)", () => {
    it("usuarios de plataforma (super_admin) mantienen acceso global independiente de los negocios", async () => {
      const hasView = await hasPermission(SUPER_ADMIN_ID, "businesses.view", { scope: "platform" });
      expect(hasView).toBe(true);
    });

    it("un usuario de negocio asociado a un negocio inexistente o suspendido no debe obtener permisos de tenant", async () => {
      const nonExistentBiz = "00000000-0000-0000-0000-000000000099";
      const hasBizPerm = await hasPermission(TEST_USER_ID, "products.create", {
        scope: "business",
        businessId: nonExistentBiz,
      });

      expect(hasBizPerm).toBe(false);
    });
  });
});
