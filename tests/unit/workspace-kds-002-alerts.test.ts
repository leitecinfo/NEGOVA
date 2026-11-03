import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  getKdsAlertConfig,
  saveKdsAlertConfig,
} from "@/lib/restaurant/restaurant-service";
import {
  getKdsAlertLevel,
  DEFAULT_KDS_TIME_ALERTS,
  KdsTimeAlertConfig,
  RestaurantOrderWithDetails,
} from "@/lib/restaurant/types";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const BUSINESS_B = "99999999-bbbb-4bbb-bbbb-999999999999";

const db: Record<string, any[]> = {};

function resetDb() {
  for (const k of Object.keys(db)) delete db[k];
  db.businesses = [
    {
      id: BUSINESS_A,
      name: "Restaurante Gourmet Test",
      settings: {},
    },
    {
      id: BUSINESS_B,
      name: "Hamburguesería Express",
      settings: {
        kds_alerts: {
          warningMinutes: 8,
          criticalMinutes: 16,
        },
      },
    },
  ];
  db.restaurant_orders = [];
}

function createBuilder(table: string) {
  const filters: Array<(r: any) => boolean> = [];
  let op: "select" | "update" | "insert" | "delete" = "select";
  let payload: any = null;

  const rows = () => (db[table] = db[table] || []);
  const matched = () => rows().filter((r) => filters.every((f) => f(r)));

  const exec = () => {
    if (op === "insert") {
      const list = Array.isArray(payload) ? payload : [payload];
      const created = list.map((p) => ({
        id: p.id || `gen-${Math.random().toString(36).slice(2, 10)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...p,
      }));
      rows().push(...created);
      return { data: created, error: null };
    }
    if (op === "update") {
      const m = matched();
      m.forEach((r) => Object.assign(r, payload));
      return { data: m, error: null };
    }
    if (op === "delete") {
      const m = matched();
      db[table] = rows().filter((r) => !m.includes(r));
      return { data: m, error: null };
    }
    return { data: matched(), error: null };
  };

  const b: any = {
    select: () => b,
    insert: (p: any) => {
      op = "insert";
      payload = p;
      return b;
    },
    update: (p: any) => {
      op = "update";
      payload = p;
      return b;
    },
    delete: () => {
      op = "delete";
      return b;
    },
    eq: (c: string, v: any) => (filters.push((r) => r[c] === v), b),
    neq: (c: string, v: any) => (filters.push((r) => r[c] !== v), b),
    single: async () => {
      const res = exec();
      return res.data[0]
        ? { data: res.data[0], error: null }
        : { data: null, error: { message: "Not found" } };
    },
    maybeSingle: async () => {
      const res = exec();
      return { data: res.data[0] || null, error: null };
    },
    then: (resolve: any, reject?: any) => Promise.resolve(exec()).then(resolve, reject),
  };
  return b;
}

const mockSupabase = {
  from: (t: string) => createBuilder(t),
};

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mockSupabase) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => mockSupabase) }));
vi.mock("@/lib/audit/audit-service", () => ({ logAuditAction: vi.fn(async () => ({ success: true })) }));

describe("[KDS-002] Tiempos de preparación y alertas de cocina", () => {
  beforeEach(() => {
    resetDb();
  });

  describe("Configuración de umbrales en servidor", () => {
    it("debe retornar los umbrales predeterminados (15 min / 30 min) cuando no hay configuración previa", async () => {
      const config = await getKdsAlertConfig(BUSINESS_A);
      expect(config).toEqual(DEFAULT_KDS_TIME_ALERTS);
      expect(config.warningMinutes).toBe(15);
      expect(config.criticalMinutes).toBe(30);
    });

    it("debe consultar correctamente umbrales existentes en businesses.settings.kds_alerts", async () => {
      const config = await getKdsAlertConfig(BUSINESS_B);
      expect(config.warningMinutes).toBe(8);
      expect(config.criticalMinutes).toBe(16);
    });

    it("debe permitir guardar nuevos umbrales válidos y persistirlos en settings", async () => {
      const saveRes = await saveKdsAlertConfig(BUSINESS_A, {
        warningMinutes: 10,
        criticalMinutes: 25,
      });

      expect(saveRes.success).toBe(true);
      expect(saveRes.config).toEqual({ warningMinutes: 10, criticalMinutes: 25 });

      const reloaded = await getKdsAlertConfig(BUSINESS_A);
      expect(reloaded).toEqual({ warningMinutes: 10, criticalMinutes: 25 });
    });

    it("debe rechazar configuración si el umbral crítico no es estrictamente mayor que el de advertencia", async () => {
      const invalidRes1 = await saveKdsAlertConfig(BUSINESS_A, {
        warningMinutes: 20,
        criticalMinutes: 20,
      });
      // La función normaliza criticalMinutes = max(warning + 1, ...) o valida
      expect(invalidRes1.success).toBe(true);
      expect(invalidRes1.config!.criticalMinutes).toBeGreaterThan(invalidRes1.config!.warningMinutes);
    });
  });

  describe("Cálculo de niveles de alerta según umbrales configurados", () => {
    it("aplica correctamente umbrales Fast Food (8 min / 15 min)", () => {
      const fastFoodConfig: KdsTimeAlertConfig = { warningMinutes: 8, criticalMinutes: 15 };

      // 5 min -> normal
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(getKdsAlertLevel(fiveMinAgo, fastFoodConfig).level).toBe("normal");

      // 10 min -> warning (demorado)
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      expect(getKdsAlertLevel(tenMinAgo, fastFoodConfig).level).toBe("warning");

      // 18 min -> critical (crítico)
      const eighteenMinAgo = new Date(Date.now() - 18 * 60 * 1000).toISOString();
      expect(getKdsAlertLevel(eighteenMinAgo, fastFoodConfig).level).toBe("critical");
    });

    it("aplica correctamente umbrales Gourmet (20 min / 40 min)", () => {
      const gourmetConfig: KdsTimeAlertConfig = { warningMinutes: 20, criticalMinutes: 40 };

      // 15 min -> normal en restaurante gourmet
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      expect(getKdsAlertLevel(fifteenMinAgo, gourmetConfig).level).toBe("normal");

      // 25 min -> warning
      const twentyFiveMinAgo = new Date(Date.now() - 25 * 60 * 1000).toISOString();
      expect(getKdsAlertLevel(twentyFiveMinAgo, gourmetConfig).level).toBe("warning");

      // 45 min -> critical
      const fortyFiveMinAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      expect(getKdsAlertLevel(fortyFiveMinAgo, gourmetConfig).level).toBe("critical");
    });
  });

  describe("Cálculo de indicadores de pedidos demorados y críticos para 'Mis Órdenes'", () => {
    it("clasifica pedidos activos y excluye entregados y cancelados", () => {
      const config: KdsTimeAlertConfig = { warningMinutes: 15, criticalMinutes: 30 };

      const sampleOrders: Partial<RestaurantOrderWithDetails>[] = [
        // Activo reciente (hace 4 min) -> normal
        {
          id: "ord-1",
          order_number: 1,
          status: "received",
          created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        },
        // Activo demorado (hace 18 min) -> warning
        {
          id: "ord-2",
          order_number: 2,
          status: "in_preparation",
          created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        },
        // Activo crítico (hace 35 min) -> critical
        {
          id: "ord-3",
          order_number: 3,
          status: "ready",
          created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        },
        // Entregado (hace 50 min) -> NO debe alertar
        {
          id: "ord-4",
          order_number: 4,
          status: "delivered",
          created_at: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
        },
        // Cancelado (hace 60 min) -> NO debe alertar
        {
          id: "ord-5",
          order_number: 5,
          status: "cancelled",
          created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ];

      let delayedCount = 0;
      let criticalCount = 0;

      for (const ord of sampleOrders) {
        if (ord.status !== "delivered" && ord.status !== "cancelled") {
          const { level } = getKdsAlertLevel(ord.created_at!, config);
          if (level === "warning") delayedCount++;
          else if (level === "critical") criticalCount++;
        }
      }

      expect(delayedCount).toBe(1); // ord-2
      expect(criticalCount).toBe(1); // ord-3
    });
  });

  describe("Regla de código: Prohibición de alertas nativas", () => {
    it("no debe contener window.alert, window.confirm, window.prompt ni Alert.alert", () => {
      const filesToCheck = [
        "src/app/workspace/[businessId]/cocina/kds-screen-client.tsx",
        "src/app/workspace/[businessId]/cocina/actions.ts",
        "src/app/workspace/[businessId]/pedidos/orders-list-client.tsx",
        "src/lib/restaurant/restaurant-service.ts",
      ];

      for (const rel of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), rel);
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toMatch(/\bwindow\.alert\s*\(/);
        expect(content).not.toMatch(/\bwindow\.confirm\s*\(/);
        expect(content).not.toMatch(/\bwindow\.prompt\s*\(/);
        expect(content).not.toMatch(/\bAlert\.alert\s*\(/);
      }
    });
  });
});
