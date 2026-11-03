import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  calculatePointsEarned,
  calculateDiscountFromPoints,
  evaluatePointsRedemption,
} from "../../src/lib/loyalty/loyalty-service";
import {
  DEFAULT_LOYALTY_PROGRAM_CONFIG,
  type LoyaltyProgramConfig,
} from "../../src/lib/loyalty/types";

describe("[FID-001] Sistema de Puntos de Fidelización", () => {
  const activeConfig: LoyaltyProgramConfig = {
    ...DEFAULT_LOYALTY_PROGRAM_CONFIG,
    enabled: true,
    pointsPerSpentAmount: 1000, // 1 pt por cada $1.000 COP
    redemptionValuePerPoint: 10, // 1 pt = $10 COP
    minPointsToRedeem: 50,      // mínimo 50 pts
    maxDiscountPercentage: 50,  // máximo 50% de la venta
  };

  describe("1. Acumulación de Puntos", () => {
    it("Al vender $50.000 a un cliente con programa activo (1 pt/$1000), se acumulan 50 puntos", () => {
      const earned = calculatePointsEarned(50000, activeConfig);
      expect(earned).toBe(50);
    });

    it("Calcula correctamente acumulaciones proporcionales y redondea hacia abajo al entero", () => {
      expect(calculatePointsEarned(25500, activeConfig)).toBe(25);
      expect(calculatePointsEarned(999, activeConfig)).toBe(0);
      expect(calculatePointsEarned(100000, activeConfig)).toBe(100);
    });

    it("Retorna 0 puntos si el programa está desactivado en la configuración", () => {
      const disabledConfig: LoyaltyProgramConfig = {
        ...activeConfig,
        enabled: false,
      };
      expect(calculatePointsEarned(50000, disabledConfig)).toBe(0);
    });

    it("Respeta configuraciones personalizadas de tasa de acumulación (ej. 1 pt / $500 COP)", () => {
      const customConfig: LoyaltyProgramConfig = {
        ...activeConfig,
        pointsPerSpentAmount: 500,
      };
      expect(calculatePointsEarned(50000, customConfig)).toBe(100);
    });
  });

  describe("2. Conversión y Redención de Puntos como Descuento en POS", () => {
    it("Calcula correctamente el valor monetario de los puntos (1 pt = $10 COP)", () => {
      expect(calculateDiscountFromPoints(50, activeConfig)).toBe(500);
      expect(calculateDiscountFromPoints(100, activeConfig)).toBe(1000);
      expect(calculateDiscountFromPoints(500, activeConfig)).toBe(5000);
    });

    it("Permite redención válida cuando el saldo y la orden cumplen los requisitos", () => {
      const customerBalance = 200;
      const orderTotal = 40000;

      const result = evaluatePointsRedemption(100, customerBalance, orderTotal, activeConfig);

      expect(result.isValid).toBe(true);
      expect(result.pointsToRedeem).toBe(100);
      expect(result.discountAmount).toBe(1000); // 100 pts * $10 = $1.000 COP
      expect(result.remainingPoints).toBe(100);
      expect(result.errorMessage).toBeUndefined();
    });

    it("Rechaza redención si el saldo total del cliente no alcanza el mínimo configurado", () => {
      const customerBalance = 40; // Menos del mínimo de 50
      const orderTotal = 40000;

      const result = evaluatePointsRedemption(40, customerBalance, orderTotal, activeConfig);

      expect(result.isValid).toBe(false);
      expect(result.discountAmount).toBe(0);
      expect(result.errorMessage).toContain("al menos 50 puntos");
    });

    it("Rechaza redención si se solicitan más puntos de los que el cliente tiene", () => {
      const customerBalance = 80;
      const orderTotal = 40000;

      const result = evaluatePointsRedemption(100, customerBalance, orderTotal, activeConfig);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("solo dispone de 80 puntos");
    });

    it("Rechaza redención e indica el tope máximo permitido si los puntos exceden el porcentaje de venta configurado (ej. máx 50%)", () => {
      const customerBalance = 5000;
      const orderTotal = 20000;

      // Venta de $20.000 COP -> Máximo descuento 50% = $10.000 COP = 1.000 puntos
      const resultExceeded = evaluatePointsRedemption(3000, customerBalance, orderTotal, activeConfig);

      expect(resultExceeded.isValid).toBe(false);
      expect(resultExceeded.maxPointsAllowed).toBe(1000);
      expect(resultExceeded.errorMessage).toContain("El descuento máximo permitido por puntos para esta cuenta es de 50%");

      // Si se solicitan exactamente los 1.000 puntos permitidos, es válida y aplica el 50%
      const resultAllowed = evaluatePointsRedemption(1000, customerBalance, orderTotal, activeConfig);
      expect(resultAllowed.isValid).toBe(true);
      expect(resultAllowed.discountAmount).toBe(10000); // 50% de $20.000
      expect(resultAllowed.pointsToRedeem).toBe(1000);
      expect(resultAllowed.remainingPoints).toBe(4000);
    });
  });

  describe("3. Verificación de Migración y Atomicidad en Base de Datos", () => {
    const migrationPath = join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261101230000_loyalty_points_and_rewards_system.sql"
    );

    it("Existe el archivo de migración de base de datos para el sistema de fidelización", () => {
      expect(existsSync(migrationPath)).toBe(true);
    });

    it("La migración define tablas multi-inquilino loyalty_points y loyalty_transactions", () => {
      const sql = readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.loyalty_points");
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.loyalty_transactions");
      expect(sql).toContain("business_id");
      expect(sql).toContain("points_balance");
      expect(sql).toContain("total_earned");
      expect(sql).toContain("total_redeemed");
    });

    it("La migración implementa RPCs con bloqueo atómico FOR UPDATE para evitar condiciones de carrera", () => {
      const sql = readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("accumulate_loyalty_points_rpc");
      expect(sql).toContain("redeem_loyalty_points_rpc");
      expect(sql).toContain("FOR UPDATE");
    });

    it("La migración incluye políticas de seguridad Row Level Security (RLS) e índices", () => {
      const sql = readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain("idx_loyalty_points_business_customer");
      expect(sql).toContain("idx_loyalty_transactions_customer");
    });
  });

  describe("4. Regla Global de Código: Prohibición de Alertas Nativas", () => {
    const filesToCheck = [
      join(process.cwd(), "src", "lib", "loyalty", "loyalty-service.ts"),
      join(process.cwd(), "src", "app", "workspace", "[businessId]", "clientes", "loyalty-actions.ts"),
      join(process.cwd(), "src", "app", "workspace", "[businessId]", "clientes", "[id]", "customer-detail-client.tsx"),
      join(process.cwd(), "src", "components", "payments", "order-payment-modal.tsx"),
    ];

    it("Ningún archivo del sistema de fidelización o cobro POS utiliza alertas nativas prohibidas", () => {
      const nativeAlertRegex = /\b(window\.)?(alert|confirm|prompt)\s*\(|Alert\.alert\s*\(/;

      filesToCheck.forEach((filePath) => {
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, "utf-8");
          const hasNativeAlert = nativeAlertRegex.test(content);
          expect(
            hasNativeAlert,
            `Se encontró uso de alerta nativa prohibida en ${filePath}`
          ).toBe(false);
        }
      });
    });
  });
});
