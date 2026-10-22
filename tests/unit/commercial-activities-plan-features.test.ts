import { describe, it, expect } from "vitest";
import {
  CommercialActivity,
  PlanFeatureKey,
  getDefaultActivitiesForBusinessType,
  hasCommercialActivity,
  normalizeCommercialActivities,
  isFeatureAllowedForBusiness,
  getEnabledFeaturesForBusiness,
  getCatalogModuleLabel,
  PLAN_FEATURES_MATRIX,
  COMMERCIAL_ACTIVITIES,
} from "../../src/config/commercial-activities";
import { NEGOVA_PLANS } from "../../src/config/plans";
import { buildWorkspaceNavSections } from "../../src/config/workspace-navigation";

describe("NEGOVA — Arquitectura de Actividades Comerciales y Funcionalidades por Plan", () => {
  const businessId = "a8e2612f-4acc-4c84-a420-220131b70d66";

  describe("1. Separación de Tipo de Negocio y Actividades Comerciales", () => {
    it("debe inferir venta exclusiva de productos para restaurantes de comida rápida", () => {
      const activities = getDefaultActivitiesForBusinessType("fast_food");
      expect(activities).toEqual(["sell_products"]);
      expect(hasCommercialActivity(activities, "sell_products")).toBe(true);
      expect(hasCommercialActivity(activities, "provide_services")).toBe(false);
      expect(hasCommercialActivity(activities, "manage_appointments")).toBe(false);
    });

    it("debe inferir venta de productos para comercios minoristas y tiendas", () => {
      const retailActivities = getDefaultActivitiesForBusinessType("retail");
      const hardwareActivities = getDefaultActivitiesForBusinessType("hardware");
      const pharmacyActivities = getDefaultActivitiesForBusinessType("pharmacy");

      expect(retailActivities).toEqual(["sell_products"]);
      expect(hardwareActivities).toEqual(["sell_products"]);
      expect(pharmacyActivities).toEqual(["sell_products"]);
    });

    it("debe inferir servicios y citas como solución coherente para barberías y peluquerías", () => {
      const activities = getDefaultActivitiesForBusinessType("barbershop");
      expect(activities).toContain("provide_services");
      expect(activities).toContain("manage_appointments");
      expect(activities).not.toContain("sell_products");
    });

    it("debe inferir servicios y citas para odontología y salud profesional", () => {
      const activities = getDefaultActivitiesForBusinessType("odontology");
      expect(activities).toContain("provide_services");
      expect(activities).toContain("manage_appointments");
      expect(activities).not.toContain("sell_products");
    });

    it("debe garantizar coherencia de citas: si tiene citas, debe tener prestación de servicios", () => {
      const normalized = normalizeCommercialActivities(["manage_appointments"]);
      expect(normalized).toContain("manage_appointments");
      expect(normalized).toContain("provide_services");
    });
  });

  describe("2. Negocios Híbridos (Servicios + Citas + Venta de Productos)", () => {
    it("debe soportar una barbería híbrida que además vende productos de cuidado capilar", () => {
      const hybridActivities: CommercialActivity[] = [
        "provide_services",
        "manage_appointments",
        "sell_products",
      ];

      expect(hasCommercialActivity(hybridActivities, "provide_services")).toBe(true);
      expect(hasCommercialActivity(hybridActivities, "manage_appointments")).toBe(true);
      expect(hasCommercialActivity(hybridActivities, "sell_products")).toBe(true);

      const catalogLabel = getCatalogModuleLabel(hybridActivities, "barbershop");
      expect(catalogLabel).toBe("Productos y servicios");
    });

    it("debe adaptar la navegación para mostrar Citas, POS y Catálogo híbrido sin duplicar el workspace", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "barbershop",
        commercialActivities: ["provide_services", "manage_appointments", "sell_products"],
        isOwner: true,
      });

      const allItems = sections.flatMap((s) => s.items);
      const itemIds = allItems.map((item) => item.id);

      expect(itemIds).toContain("ventas");      // POS
      expect(itemIds).toContain("citas");       // Citas
      expect(itemIds).toContain("productos");   // Catálogo híbrido
      expect(itemIds).not.toContain("mesas");   // Oculto (no es gastronómico)
      expect(itemIds).not.toContain("pedidos"); // Oculto (no es restaurante)

      const catalogItem = allItems.find((i) => i.id === "productos");
      expect(catalogItem?.label).toBe("Productos y servicios");
    });
  });

  describe("3. Configuración del Negocio Existente (Restaurante de Comida Rápida)", () => {
    it("debe reflejar la venta exclusiva de productos gastronómicos y POS", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "fast_food",
        commercialActivities: ["sell_products"],
        isOwner: true,
      });

      const allItems = sections.flatMap((s) => s.items);
      const itemIds = allItems.map((item) => item.id);

      // Módulos gastronómicos y comerciales presentes
      expect(itemIds).toContain("ventas");     // POS
      expect(itemIds).toContain("productos");  // Menú / Productos
      expect(itemIds).toContain("pedidos");    // Comandas gastronómicas
      expect(itemIds).toContain("mesas");      // Salón gastronómico

      // Citas e inventario minorista NO deben estar habilitados
      expect(itemIds).not.toContain("citas");

      // La etiqueta del catálogo debe estar adaptada a gastronomía / inventario
      const catalogItem = allItems.find((i) => i.id === "productos");
      expect(catalogItem?.label).toBe("Inventario");
    });

    it("no debe permitir acceso a citas ni servicios en un restaurante de comida rápida", () => {
      const ctx = {
        businessType: "fast_food",
        commercialActivities: ["sell_products"] as CommercialActivity[],
        planId: "inicio" as const,
      };

      const servicesCheck = isFeatureAllowedForBusiness(ctx, "services");
      const appointmentsCheck = isFeatureAllowedForBusiness(ctx, "appointments");
      const posCheck = isFeatureAllowedForBusiness(ctx, "pos");
      const productsCheck = isFeatureAllowedForBusiness(ctx, "products");

      expect(servicesCheck.allowed).toBe(false);
      expect(servicesCheck.reason).toBe("activity_disabled");

      expect(appointmentsCheck.allowed).toBe(false);
      expect(appointmentsCheck.reason).toBe("activity_disabled");

      expect(posCheck.allowed).toBe(true);
      expect(productsCheck.allowed).toBe(true);
    });
  });

  describe("4. Matriz de Funcionalidades por Plan (Inicio, Crece, Negocio)", () => {
    it("el Plan Inicio debe permitir POS, productos, existencias y variantes operativas", () => {
      const ctx = {
        businessType: "fast_food",
        commercialActivities: ["sell_products"] as CommercialActivity[],
        planId: "inicio" as const,
      };

      expect(isFeatureAllowedForBusiness(ctx, "pos").allowed).toBe(true);
      expect(isFeatureAllowedForBusiness(ctx, "products").allowed).toBe(true);
      expect(isFeatureAllowedForBusiness(ctx, "variants_modifiers").allowed).toBe(true);
      expect(isFeatureAllowedForBusiness(ctx, "inventory").allowed).toBe(true);

      // Reportes avanzados y fiados restringidos en Inicio
      const advancedReportsCheck = isFeatureAllowedForBusiness(ctx, "advanced_reports");
      expect(advancedReportsCheck.allowed).toBe(false);
      expect(advancedReportsCheck.reason).toBe("plan_upgrade_required");

      const creditCheck = isFeatureAllowedForBusiness(ctx, "credit_and_debts");
      expect(creditCheck.allowed).toBe(false);
      expect(creditCheck.reason).toBe("plan_upgrade_required");
    });

    it("el Plan Crece debe desbloquear reportes avanzados, fiados y asistente IA", () => {
      const ctx = {
        businessType: "fast_food",
        commercialActivities: ["sell_products"] as CommercialActivity[],
        planId: "crece" as const,
      };

      expect(isFeatureAllowedForBusiness(ctx, "advanced_reports").allowed).toBe(true);
      expect(isFeatureAllowedForBusiness(ctx, "credit_and_debts").allowed).toBe(true);
      expect(isFeatureAllowedForBusiness(ctx, "ai_assistant").allowed).toBe(true);
      expect(isFeatureAllowedForBusiness(ctx, "multiple_roles").allowed).toBe(false);
    });

    it("el Plan Negocio debe desbloquear roles y permisos personalizados para colaboradores", () => {
      const ctx = {
        businessType: "fast_food",
        commercialActivities: ["sell_products"] as CommercialActivity[],
        planId: "negocio" as const,
      };

      expect(isFeatureAllowedForBusiness(ctx, "multiple_roles").allowed).toBe(true);
      expect(isFeatureAllowedForBusiness(ctx, "advanced_reports").allowed).toBe(true);
      expect(isFeatureAllowedForBusiness(ctx, "pos").allowed).toBe(true);
    });
  });

  describe("5. Conservación de Datos y Reglas de Negocio", () => {
    it("debe preservar los límites canónicos del Plan Inicio sin promesas no soportadas", () => {
      const inicio = NEGOVA_PLANS.inicio;
      expect(inicio.limits.maxUsers).toBe(2);
      expect(inicio.limits.maxProducts).toBe(200);
      expect(inicio.limits.canUsePos).toBe(true);
      expect(inicio.limits.canUseAdvancedReports).toBe(false);
    });

    it("debe listar correctamente todas las funcionalidades habilitadas para un negocio", () => {
      const ctx = {
        businessType: "fast_food",
        commercialActivities: ["sell_products"] as CommercialActivity[],
        planId: "inicio" as const,
      };

      const enabled = getEnabledFeaturesForBusiness(ctx);
      expect(enabled).toContain("pos");
      expect(enabled).toContain("products");
      expect(enabled).toContain("inventory");
      expect(enabled).toContain("variants_modifiers");
      expect(enabled).not.toContain("services");
      expect(enabled).not.toContain("appointments");
      expect(enabled).not.toContain("advanced_reports");
    });
  });
});
