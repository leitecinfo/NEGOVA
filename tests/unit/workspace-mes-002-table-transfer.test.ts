import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const mockState = vi.hoisted(() => ({
  tables: [] as Array<Record<string, unknown>>,
  orders: [] as Array<Record<string, unknown>>,
  orderItems: [] as Array<Record<string, unknown>>,
  auditLogs: [] as Array<Record<string, unknown>>,
}));

function matchesFilters(
  row: Record<string, unknown>,
  filters: Array<{ op: string; col: string; val: unknown }>
) {
  return filters.every((f) => {
    const val = row[f.col];
    if (f.op === "eq") return val === f.val;
    if (f.op === "neq") return val !== f.val;
    if (f.op === "in") return Array.isArray(f.val) && f.val.includes(val);
    return true;
  });
}

function hydrateOrderRelations(row: Record<string, unknown>) {
  const items = mockState.orderItems.filter((it) => it.order_id === row.id);
  const tbl = mockState.tables.find((t) => t.id === row.table_id) || null;
  return {
    ...row,
    restaurant_order_items: items,
    restaurant_tables: tbl ? { name_or_number: tbl.name_or_number } : null,
  };
}

function createMockQueryBuilder(table: string) {
  const filters: Array<{ op: string; col: string; val: unknown }> = [];
  let operation: "select" | "insert" | "update" | "delete" = "select";
  let payload: unknown = null;

  const getStore = () => {
    switch (table) {
      case "restaurant_tables":
        return mockState.tables;
      case "restaurant_orders":
        return mockState.orders;
      case "restaurant_order_items":
        return mockState.orderItems;
      case "audit_logs":
        return mockState.auditLogs;
      default:
        return [];
    }
  };

  const execute = () => {
    const store = getStore();

    if (operation === "insert") {
      const items = Array.isArray(payload) ? payload : [payload];
      const inserted = items.map((item, idx) => {
        const record = {
          id: (item as Record<string, unknown>).id || `${table}-${store.length + idx + 1}`,
          created_at: new Date().toISOString(),
          ...(item as Record<string, unknown>),
        };
        store.push(record);
        return record;
      });
      return {
        data: Array.isArray(payload) ? inserted : inserted[0],
        error: null,
      };
    }

    if (operation === "update") {
      const matched = store.filter((row) => matchesFilters(row, filters));
      matched.forEach((row) => {
        Object.assign(row, payload as Record<string, unknown>);
      });
      const resultRows =
        table === "restaurant_orders" ? matched.map(hydrateOrderRelations) : matched;
      return {
        data: resultRows,
        error: null,
      };
    }

    const matched = store.filter((row) => matchesFilters(row, filters));
    const resultRows =
      table === "restaurant_orders" ? matched.map(hydrateOrderRelations) : matched;
    return {
      data: resultRows,
      error: null,
    };
  };

  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: (data: unknown) => {
      operation = "insert";
      payload = data;
      return builder;
    },
    update: (data: unknown) => {
      operation = "update";
      payload = data;
      return builder;
    },
    delete: () => {
      operation = "delete";
      return builder;
    },
    eq: (col: string, val: unknown) => {
      filters.push({ op: "eq", col, val });
      return builder;
    },
    neq: (col: string, val: unknown) => {
      filters.push({ op: "neq", col, val });
      return builder;
    },
    in: (col: string, val: unknown) => {
      filters.push({ op: "in", col, val });
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => {
      const res = execute();
      const rows = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
      return { data: rows[0] ?? null, error: res.error };
    },
    single: async () => {
      const res = execute();
      const rows = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
      return { data: rows[0] ?? null, error: rows[0] ? null : { message: "Not found" } };
    },
    then: (onFulfilled: (value: { data: unknown; error: null }) => unknown) => {
      return Promise.resolve(execute()).then(onFulfilled);
    },
  };

  return builder;
}

const mockSupabaseClient = {
  from: (table: string) => createMockQueryBuilder(table),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
  createServerSupabaseClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/audit/audit-service", () => ({
  logAuditAction: vi.fn(async () => undefined),
}));

import {
  transferRestaurantTable,
  getRestaurantOrderWithDetails,
} from "@/lib/restaurant/restaurant-service";

describe("[MES-002] Implementar traslado de mesas", () => {
  const businessId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const table1Id = "33333333-3333-4333-8333-333333333301";
  const table2Id = "33333333-3333-4333-8333-333333333302";
  const table3Id = "33333333-3333-4333-8333-333333333303";
  const orderId = "44444444-4444-4444-8444-444444444401";

  beforeEach(() => {
    mockState.tables = [
      {
        id: table1Id,
        business_id: businessId,
        name_or_number: "Mesa 1",
        capacity: 4,
        status: "occupied",
        current_order_id: orderId,
        sort_order: 1,
        created_at: "2026-10-30T12:00:00.000Z",
        updated_at: "2026-10-30T12:05:00.000Z",
      },
      {
        id: table2Id,
        business_id: businessId,
        name_or_number: "Mesa 2",
        capacity: 2,
        status: "occupied",
        current_order_id: "44444444-4444-4444-8444-444444444402",
        sort_order: 2,
        created_at: "2026-10-30T12:00:00.000Z",
        updated_at: "2026-10-30T12:05:00.000Z",
      },
      {
        id: table3Id,
        business_id: businessId,
        name_or_number: "Mesa 3",
        capacity: 6,
        status: "available",
        current_order_id: null,
        sort_order: 3,
        created_at: "2026-10-30T12:00:00.000Z",
        updated_at: "2026-10-30T12:00:00.000Z",
      },
    ];

    mockState.orders = [
      {
        id: orderId,
        business_id: businessId,
        order_number: 101,
        order_type: "dine_in",
        table_id: table1Id,
        customer_name: "Carlos Gómez",
        customer_phone: "3001234567",
        notes: "Sin cebolla",
        status: "in_kitchen",
        subtotal: 45000,
        discount: 0,
        tax: 0,
        total: 45000,
        sale_document_id: null,
        created_by: userId,
        created_at: "2026-10-30T12:05:00.000Z",
        updated_at: "2026-10-30T12:10:00.000Z",
      },
    ];

    mockState.orderItems = [
      {
        id: "55555555-5555-4555-8555-555555555501",
        order_id: orderId,
        business_id: businessId,
        product_id: "66666666-6666-4666-8666-666666666601",
        product_name: "Hamburguesa Artesanal",
        quantity: 2,
        unit_price: 18000,
        subtotal: 36000,
        notes: "Término medio",
        status: "preparing",
        created_at: "2026-10-30T12:05:00.000Z",
      },
      {
        id: "55555555-5555-4555-8555-555555555502",
        order_id: orderId,
        business_id: businessId,
        product_id: "66666666-6666-4666-8666-666666666602",
        product_name: "Limonada de Coco",
        quantity: 1,
        unit_price: 9000,
        subtotal: 9000,
        notes: null,
        status: "ready",
        created_at: "2026-10-30T12:05:00.000Z",
      },
    ];

    mockState.auditLogs = [];
  });

  it("traslada el pedido de Mesa 1 (ocupada) a Mesa 3 (libre), liberando Mesa 1 y ocupando Mesa 3", async () => {
    const result = await transferRestaurantTable(businessId, table1Id, table3Id, {
      userId,
      notes: "Cliente solicitó mesa más grande en terraza",
    });

    expect(result.success).toBe(true);
    expect(result.order?.id).toBe(orderId);
    expect(result.sourceTable?.id).toBe(table1Id);
    expect(result.sourceTable?.status).toBe("available");
    expect(result.sourceTable?.current_order_id).toBeNull();

    expect(result.targetTable?.id).toBe(table3Id);
    expect(result.targetTable?.status).toBe("occupied");
    expect(result.targetTable?.current_order_id).toBe(orderId);

    const table1InDb = mockState.tables.find((t) => t.id === table1Id);
    const table3InDb = mockState.tables.find((t) => t.id === table3Id);

    expect(table1InDb?.status).toBe("available");
    expect(table1InDb?.current_order_id).toBeNull();
    expect(table3InDb?.status).toBe("occupied");
    expect(table3InDb?.current_order_id).toBe(orderId);
  });

  it("el pedido conserva todos sus items, estado y totales tras el traslado a Mesa 3", async () => {
    const transferRes = await transferRestaurantTable(businessId, table1Id, table3Id, {
      userId,
    });
    expect(transferRes.success).toBe(true);

    const updatedOrder = await getRestaurantOrderWithDetails(businessId, orderId);
    expect(updatedOrder).not.toBeNull();
    expect(updatedOrder?.table_id).toBe(table3Id);
    expect(updatedOrder?.tableName).toBe("Mesa 3");
    expect(updatedOrder?.status).toBe("in_kitchen");
    expect(updatedOrder?.total).toBe(45000);
    expect(updatedOrder?.customer_name).toBe("Carlos Gómez");
    expect(updatedOrder?.items).toHaveLength(2);
    expect(updatedOrder?.items[0]?.product_name).toBe("Hamburguesa Artesanal");
    expect(updatedOrder?.items[0]?.quantity).toBe(2);
    expect(updatedOrder?.items[0]?.status).toBe("preparing");
    expect(updatedOrder?.items[1]?.product_name).toBe("Limonada de Coco");
    expect(updatedOrder?.items[1]?.status).toBe("ready");
  });

  it("registra el traslado en audit_logs con los datos de mesa origen, destino y pedido", async () => {
    const res = await transferRestaurantTable(businessId, table1Id, table3Id, {
      userId,
      notes: "Cambio a salón principal",
    });
    expect(res.success).toBe(true);

    expect(mockState.auditLogs).toHaveLength(1);
    const log = mockState.auditLogs[0];
    expect(log.business_id).toBe(businessId);
    expect(log.user_id).toBe(userId);
    expect(log.action).toBe("table.transfer");
    expect(log.entity).toBe("restaurant_table");
    expect(log.entity_id).toBe(table1Id);
    expect(log.details).toMatchObject({
      source_table_id: table1Id,
      source_table_name: "Mesa 1",
      target_table_id: table3Id,
      target_table_name: "Mesa 3",
      order_id: orderId,
      order_number: 101,
      notes: "Cambio a salón principal",
    });
  });

  it("rechaza trasladar hacia una mesa ocupada o desde una mesa libre", async () => {
    // Intentar trasladar de Mesa 1 (ocupada) a Mesa 2 (ocupada)
    const toOccupiedRes = await transferRestaurantTable(businessId, table1Id, table2Id, {
      userId,
    });
    expect(toOccupiedRes.success).toBe(false);
    expect(toOccupiedRes.error).toMatch(/libre/i);

    // Intentar trasladar desde Mesa 3 (libre) a Mesa 1
    const fromFreeRes = await transferRestaurantTable(businessId, table3Id, table1Id, {
      userId,
    });
    expect(fromFreeRes.success).toBe(false);
    expect(fromFreeRes.error).toMatch(/no está ocupada/i);

    // Intentar trasladar a la misma mesa
    const sameTableRes = await transferRestaurantTable(businessId, table1Id, table1Id, {
      userId,
    });
    expect(sameTableRes.success).toBe(false);
    expect(sameTableRes.error).toMatch(/distinta/i);
  });

  it("no utiliza alertas nativas (window.alert, window.confirm, window.prompt) en los archivos del módulo", () => {
    const filesToCheck = [
      "src/lib/restaurant/restaurant-service.ts",
      "src/app/workspace/[businessId]/mesas/actions.ts",
      "src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx",
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, "utf8");
      expect(content).not.toMatch(/\bwindow\.(alert|confirm|prompt)\s*\(/);
      expect(content).not.toMatch(/\bAlert\.alert\s*\(/);
    }
  });
});
