import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  DEFAULT_DELIVERY_BUSINESS_CONFIG,
  DeliveryBusinessConfig,
  normalizeDeliveryBusinessConfig,
  calculateDeliveryFeeForOrder,
} from "../../src/lib/delivery/types";

describe("DOM-002 — Configuración Completa de Domicilios", () => {
  describe("1. Normalización y Valores Predeterminados", () => {
    it("debe retornar los valores predeterminados seguros ante configuraciones vacías", () => {
      const config = normalizeDeliveryBusinessConfig(null);
      expect(config.enabled).toBe(true);
      expect(config.tariffMode).toBe("fixed");
      expect(config.fixedFee).toBe(5000);
      expect(config.payer).toBe("customer");
      expect(config.assignmentMode).toBe("manual");
      expect(config.timing.maxAcceptTimeMinutes).toBe(10);
      expect(config.timing.delayAlertMinutes).toBe(30);
      expect(config.bonuses.dailyDeliveryGoal).toBe(15);
    });

    it("debe preservar configuraciones personalizadas válidas", () => {
      const custom: Partial<DeliveryBusinessConfig> = {
        enabled: true,
        tariffMode: "distance",
        fixedFee: 7000,
        payer: "split_50_50",
        assignmentMode: "round_robin",
        minOrderAmount: 25000,
        freeDeliveryThreshold: 80000,
        timing: {
          maxAcceptTimeMinutes: 5,
          delayAlertMinutes: 25,
          autoReassignIfNotAccepted: true,
          reassignAfterMinutes: 5,
        },
        bonuses: {
          dailyDeliveryGoal: 20,
          goalBonusAmount: 30000,
          nightBonusEnabled: true,
          nightBonusStartTime: "21:00",
          nightBonusEndTime: "05:00",
          nightBonusAmount: 3500,
        },
      };

      const normalized = normalizeDeliveryBusinessConfig(custom);
      expect(normalized.tariffMode).toBe("distance");
      expect(normalized.payer).toBe("split_50_50");
      expect(normalized.assignmentMode).toBe("round_robin");
      expect(normalized.minOrderAmount).toBe(25000);
      expect(normalized.freeDeliveryThreshold).toBe(80000);
      expect(normalized.timing.delayAlertMinutes).toBe(25);
      expect(normalized.bonuses.nightBonusEnabled).toBe(true);
      expect(normalized.bonuses.nightBonusAmount).toBe(3500);
    });

    it("debe mantener compatibilidad hacia atrás con configuraciones planas heredadas { enabled, fee }", () => {
      const legacy = {
        enabled: true,
        fee: 6500,
      };

      const normalized = normalizeDeliveryBusinessConfig(legacy as any);
      expect(normalized.tariffMode).toBe("fixed");
      expect(normalized.fixedFee).toBe(6500);
    });
  });

  describe("2. Regla de Negocio: Quién asume la tarifa de entrega", () => {
    it("Criterio Aceptación: Se puede configurar tarifa fija de $5.000 que el cliente paga", () => {
      const config: DeliveryBusinessConfig = {
        ...DEFAULT_DELIVERY_BUSINESS_CONFIG,
        tariffMode: "fixed",
        fixedFee: 5000,
        payer: "customer",
      };

      const result = calculateDeliveryFeeForOrder(config, 40000);
      expect(result.grossDeliveryTariff).toBe(5000);
      expect(result.customerDeliveryFee).toBe(5000);
      expect(result.businessSubsidizedFee).toBe(0);
      expect(result.isFreeShipping).toBe(false);
    });

    it("debe aplicar subsidio del 100% (envío gratis) cuando el negocio asume la tarifa", () => {
      const config: DeliveryBusinessConfig = {
        ...DEFAULT_DELIVERY_BUSINESS_CONFIG,
        tariffMode: "fixed",
        fixedFee: 5000,
        payer: "business",
      };

      const result = calculateDeliveryFeeForOrder(config, 40000);
      expect(result.grossDeliveryTariff).toBe(5000);
      expect(result.customerDeliveryFee).toBe(0);
      expect(result.businessSubsidizedFee).toBe(5000);
      expect(result.isFreeShipping).toBe(true);
    });

    it("debe dividir exactamente 50/50 la tarifa entre cliente y comercio", () => {
      const config: DeliveryBusinessConfig = {
        ...DEFAULT_DELIVERY_BUSINESS_CONFIG,
        tariffMode: "fixed",
        fixedFee: 5000,
        payer: "split_50_50",
      };

      const result = calculateDeliveryFeeForOrder(config, 35000);
      expect(result.grossDeliveryTariff).toBe(5000);
      expect(result.customerDeliveryFee).toBe(2500);
      expect(result.businessSubsidizedFee).toBe(2500);
      expect(result.isFreeShipping).toBe(false);
    });

    it("debe otorgar envío gratis si el subtotal supera el umbral configurado", () => {
      const config: DeliveryBusinessConfig = {
        ...DEFAULT_DELIVERY_BUSINESS_CONFIG,
        tariffMode: "fixed",
        fixedFee: 6000,
        payer: "customer",
        freeDeliveryThreshold: 70000,
      };

      // Compra por debajo del umbral
      const belowResult = calculateDeliveryFeeForOrder(config, 65000);
      expect(belowResult.customerDeliveryFee).toBe(6000);
      expect(belowResult.isFreeShipping).toBe(false);

      // Compra igual o superior al umbral
      const aboveResult = calculateDeliveryFeeForOrder(config, 75000);
      expect(aboveResult.customerDeliveryFee).toBe(0);
      expect(aboveResult.businessSubsidizedFee).toBe(6000);
      expect(aboveResult.isFreeShipping).toBe(true);
    });
  });

  describe("3. Cálculo según Modalidad de Tarifa", () => {
    it("debe calcular tarifa por distancia basada en km base y costo por km extra", () => {
      const config: DeliveryBusinessConfig = {
        ...DEFAULT_DELIVERY_BUSINESS_CONFIG,
        tariffMode: "distance",
        distanceConfig: {
          baseTariff: 3000,
          baseDistanceKm: 2,
          additionalKmTariff: 1000,
        },
        payer: "customer",
      };

      // Dentro de la base (1.5 km <= 2 km)
      const baseTrip = calculateDeliveryFeeForOrder(config, 20000, { distanceKm: 1.5 });
      expect(baseTrip.customerDeliveryFee).toBe(3000);

      // Con 3 km extra (5 km total) -> 3000 + (3 * 1000) = 6000
      const extraTrip = calculateDeliveryFeeForOrder(config, 20000, { distanceKm: 5 });
      expect(extraTrip.customerDeliveryFee).toBe(6000);
    });

    it("debe aplicar la tarifa de la zona de cobertura y usar fallback si está fuera", () => {
      const config: DeliveryBusinessConfig = {
        ...DEFAULT_DELIVERY_BUSINESS_CONFIG,
        tariffMode: "zone",
        fallbackZoneFee: 7000,
        payer: "customer",
      };

      // Con zona identificada
      const inZone = calculateDeliveryFeeForOrder(config, 20000, { zoneTariff: 4500 });
      expect(inZone.customerDeliveryFee).toBe(4500);

      // Fuera de zona (sin zonaTariff)
      const outOfZone = calculateDeliveryFeeForOrder(config, 20000, { zoneTariff: null });
      expect(outOfZone.customerDeliveryFee).toBe(7000);
    });
  });

  describe("4. Tiempos y Alertas de Retraso", () => {
    it("Criterio Aceptación: Se puede configurar tiempo máximo de 30 minutos con alerta", () => {
      const config = normalizeDeliveryBusinessConfig({
        timing: {
          maxAcceptTimeMinutes: 10,
          delayAlertMinutes: 30,
          autoReassignIfNotAccepted: true,
          reassignAfterMinutes: 5,
        },
      });

      expect(config.timing.delayAlertMinutes).toBe(30);

      const delayThresholdMs = config.timing.delayAlertMinutes * 60 * 1000;
      const now = Date.now();

      // Pedido creado hace 20 min -> No demorado
      const order20MinAgo = new Date(now - 20 * 60 * 1000).toISOString();
      const isDelayed20 = now - new Date(order20MinAgo).getTime() >= delayThresholdMs;
      expect(isDelayed20).toBe(false);

      // Pedido creado hace 31 min -> Demorado
      const order31MinAgo = new Date(now - 31 * 60 * 1000).toISOString();
      const isDelayed31 = now - new Date(order31MinAgo).getTime() >= delayThresholdMs;
      expect(isDelayed31).toBe(true);
    });
  });

  describe("5. Regla Global: Prohibición Estricta de Alertas Nativas", () => {
    it("ningún archivo nuevo o modificado debe contener window.alert, window.confirm o Alert.alert", () => {
      const filesToCheck = [
        path.join(process.cwd(), "src/components/delivery/delivery-config-tab.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/pedidos/domicilios/deliveries-client.tsx"),
        path.join(process.cwd(), "src/components/pos/order-destination-modal.tsx"),
      ];

      const forbiddenPatterns = [
        /\bwindow\.alert\s*\(/,
        /\bwindow\.confirm\s*\(/,
        /\bwindow\.prompt\s*\(/,
        /\bAlert\.alert\s*\(/,
      ];

      for (const filePath of filesToCheck) {
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, "utf-8");
        for (const pattern of forbiddenPatterns) {
          expect(
            pattern.test(content),
            `El archivo ${path.basename(filePath)} NO debe contener llamadas a alertas nativas (${pattern})`
          ).toBe(false);
        }
      }
    });
  });
});
