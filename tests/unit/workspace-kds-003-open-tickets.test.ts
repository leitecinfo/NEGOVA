import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { getKdsOpenTickets } from "@/lib/restaurant/restaurant-service";
import {
  OpenTicketDetails,
  OpenTicketsSummary,
  KdsTimeAlertConfig,
} from "@/lib/restaurant/types";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA PARA KDS-003
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const BUSINESS_B = "22222222-bbbb-4bbb-bbbb-222222222222";

const db: Record<string, any[]> = {};

function resetDb() {
  for (const k of Object.keys(db)) delete db[k];
  db.businesses = [
    {
      id: BUSINESS_A,
      name: "Restaurante Gourmet La Terraza",
      settings: {
        kds_alerts: {
          warningMinutes: 15,
          criticalMinutes: 30,
        },
      },
    },
    {
      id: BUSINESS_B,
      name: "Café Express Central",
      settings: {},
    },
  ];

  db.restaurant_rooms = [
    {
      id: "room-1",
      business_id: BUSINESS_A,
      name: "Salón Principal",
      status: "active",
      sort_order: 1,
    },
    {
      id: "room-2",
      business_id: BUSINESS_A,
      name: "Terraza Exterior",
      status: "active",
      sort_order: 2,
    },
  ];

  db.restaurant_tables = [
    {
      id: "tbl-1",
      business_id: BUSINESS_A,
      room_id: "room-1",
      name_or_number: "Mesa 1",
      capacity: 4,
      status: "occupied",
    },
    {
      id: "tbl-2",
      business_id: BUSINESS_A,
      room_id: "room-2",
      name_or_number: "Mesa 2",
      capacity: 6,
      status: "occupied",
    },
  ];

  db.profiles = [
    {
      id: "user-cashier-1",
      full_name: "Camila Restrepo (Cajera)",
    },
    {
      id: "user-waiter-1",
      full_name: "Mateo Ortiz (Mesero)",
    },
  ];

  // Fechas relativas
  const now = Date.now();
  const dateNormal = new Date(now - 5 * 60 * 1000).toISOString(); // 5 min ago (normal)
  const dateDelayed = new Date(now - 20 * 60 * 1000).toISOString(); // 20 min ago (warning >15m)
  const dateCritical = new Date(now - 45 * 60 * 1000).toISOString(); // 45 min ago (critical >30m)

  db.restaurant_orders = [
    // 1. Ticket abierto normal en mesa (Business A, pending, 5m ago)
    {
      id: "order-open-1",
      business_id: BUSINESS_A,
      order_number: 101,
      status: "received",
      order_type: "dine_in",
      channel_origin: "in_person",
      table_id: "tbl-1",
      subtotal: 50000,
      delivery_fee: 0,
      total: 50000,
      payment_status: "pending",
      customer_name: "Andrés Cepeda",
      customer_phone: "3001234567",
      created_by: "user-cashier-1",
      created_at: dateNormal,
      updated_at: dateNormal,
      restaurant_order_items: [
        {
          id: "item-1",
          product_name: "Hamburguesa Gourmet",
          quantity: 2,
          unit_price: 25000,
          subtotal: 50000,
        },
      ],
    },

    // 2. Ticket abierto demorado (Business A, partial payment, 20m ago)
    {
      id: "order-open-2",
      business_id: BUSINESS_A,
      order_number: 102,
      status: "in_preparation",
      order_type: "dine_in",
      channel_origin: "digital_menu",
      table_id: "tbl-2",
      subtotal: 90000,
      delivery_fee: 0,
      total: 90000,
      payment_status: "partial",
      customer_name: "Valeria Gómez",
      notes: "Mesa VIP - 4 personas",
      created_by: null, // Pedido desde menú QR
      created_at: dateDelayed,
      updated_at: dateDelayed,
      restaurant_order_items: [
        {
          id: "item-2",
          product_name: "Parrillada Mixta",
          quantity: 1,
          unit_price: 90000,
          subtotal: 90000,
        },
      ],
    },

    // 3. Ticket abierto crítico (Business A, pending, 45m ago, delivery)
    {
      id: "order-open-3",
      business_id: BUSINESS_A,
      order_number: 103,
      status: "ready",
      order_type: "delivery",
      channel_origin: "whatsapp",
      table_id: null,
      subtotal: 40000,
      delivery_fee: 5000,
      total: 45000,
      payment_status: "pending",
      customer_name: "Santiago Ramos",
      customer_phone: "3119876543",
      created_by: "user-waiter-1",
      created_at: dateCritical,
      updated_at: dateCritical,
      restaurant_order_items: [
        {
          id: "item-3",
          product_name: "Pizza Familiar",
          quantity: 1,
          unit_price: 40000,
          subtotal: 40000,
        },
      ],
    },

    // 4. Ticket YA PAGADO (Business A, payment_status === 'paid' - NO DEBE APARECER)
    {
      id: "order-paid",
      business_id: BUSINESS_A,
      order_number: 99,
      status: "delivered",
      order_type: "dine_in",
      channel_origin: "in_person",
      table_id: "tbl-1",
      subtotal: 60000,
      total: 60000,
      payment_status: "paid",
      created_at: dateDelayed,
      updated_at: dateDelayed,
    },

    // 5. Ticket CANCELADO (Business A, status === 'cancelled' - NO DEBE APARECER)
    {
      id: "order-cancelled",
      business_id: BUSINESS_A,
      order_number: 98,
      status: "cancelled",
      order_type: "takeout",
      channel_origin: "in_person",
      subtotal: 30000,
      total: 30000,
      payment_status: "pending",
      created_at: dateCritical,
      updated_at: dateCritical,
    },

    // 6. Ticket abierto de OTRO negocio (Business B - AISLAMIENTO MULTI-TENANT)
    {
      id: "order-biz-b",
      business_id: BUSINESS_B,
      order_number: 501,
      status: "received",
      order_type: "takeout",
      channel_origin: "in_person",
      subtotal: 100000,
      total: 100000,
      payment_status: "pending",
      created_at: dateDelayed,
      updated_at: dateDelayed,
    },
  ];
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
    in: (c: string, vals: any[]) => (filters.push((r) => vals.includes(r[c])), b),
    order: () => b,
    limit: () => b,
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

describe("[KDS-003] Vista de tickets abiertos", () => {
  beforeEach(() => {
    resetDb();
  });

  describe("Filtrado y consulta de tickets abiertos", () => {
    it("debe retornar únicamente órdenes abiertas (no cobradas ni canceladas) del comercio", async () => {
      const result = await getKdsOpenTickets(BUSINESS_A);

      expect(result.tickets.length).toBe(3);

      // IDs esperados
      const ids = result.tickets.map((t) => t.id);
      expect(ids).toContain("order-open-1");
      expect(ids).toContain("order-open-2");
      expect(ids).toContain("order-open-3");

      // Excluye pagados, cancelados y de otros negocios
      expect(ids).not.toContain("order-paid");
      expect(ids).not.toContain("order-cancelled");
      expect(ids).not.toContain("order-biz-b");
    });

    it("respeta aislamiento estricto multi-tenant por business_id", async () => {
      const resultBizB = await getKdsOpenTickets(BUSINESS_B);
      expect(resultBizB.tickets.length).toBe(1);
      expect(resultBizB.tickets[0].id).toBe("order-biz-b");
      expect(resultBizB.summary.totalAmount).toBe(100000);
    });
  });

  describe("Cálculo consolidado de KPIs en vista", () => {
    it("debe calcular correctamente los KPIs de total, demorados y críticos", async () => {
      const { summary } = await getKdsOpenTickets(BUSINESS_A);

      // Total general de tickets abiertos: 3 tickets (50.000 + 90.000 + 45.000 = 185.000)
      expect(summary.totalCount).toBe(3);
      expect(summary.totalAmount).toBe(185000);

      // Demorado: order-open-2 (20 min >= 15 min, subtotal 90.000)
      expect(summary.delayedCount).toBe(1);
      expect(summary.delayedAmount).toBe(90000);

      // Crítico: order-open-3 (45 min >= 30 min, subtotal 45.000)
      expect(summary.criticalCount).toBe(1);
      expect(summary.criticalAmount).toBe(45000);
    });
  });

  describe("Enriquecimiento completo de información por ticket", () => {
    it("debe incluir información de canal, servicio, mesa, comensales y cajero", async () => {
      const { tickets } = await getKdsOpenTickets(BUSINESS_A);

      const ticket1 = tickets.find((t) => t.id === "order-open-1")!;
      expect(ticket1.channel_origin).toBe("in_person");
      expect(ticket1.order_type).toBe("dine_in");
      expect(ticket1.tableName).toBe("Mesa 1");
      expect(ticket1.roomName).toBe("Salón Principal");
      expect(ticket1.customer_name).toBe("Andrés Cepeda");
      expect(ticket1.customer_phone).toBe("3001234567");
      expect(ticket1.cashierName).toBe("Camila Restrepo (Cajera)");
      expect(ticket1.dinersCount).toBe(4); // Capacidad de Mesa 1
      expect(ticket1.alertLevel).toBe("normal");

      const ticket2 = tickets.find((t) => t.id === "order-open-2")!;
      expect(ticket2.channel_origin).toBe("digital_menu");
      expect(ticket2.tableName).toBe("Mesa 2");
      expect(ticket2.roomName).toBe("Terraza Exterior");
      expect(ticket2.cashierName).toBe("Menú QR (Auto-pedido)");
      expect(ticket2.dinersCount).toBe(4); // Extraído de 'Mesa VIP - 4 personas'
      expect(ticket2.alertLevel).toBe("warning");

      const ticket3 = tickets.find((t) => t.id === "order-open-3")!;
      expect(ticket3.channel_origin).toBe("whatsapp");
      expect(ticket3.order_type).toBe("delivery");
      expect(ticket3.tableName).toBeNull();
      expect(ticket3.cashierName).toBe("Mateo Ortiz (Mesero)");
      expect(ticket3.alertLevel).toBe("critical");
    });
  });

  describe("Verificación de Enlaces Directos e Integridad de Archivos", () => {
    it("los componentes deben generar enlaces directos a 'Mis Órdenes' y facturación", () => {
      const panelPath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/cocina/open-tickets-panel.tsx"
      );
      const panelContent = fs.readFileSync(panelPath, "utf-8");

      // Enlace a Mis Órdenes
      expect(panelContent).toContain("/workspace/${businessId}/pedidos/${ticket.id}");
      // Enlace a Factura / Cobro de mesa o POS
      expect(panelContent).toContain("/workspace/${businessId}/mesas?mesaId=${ticket.table_id}");
      expect(panelContent).toContain("Mis Órdenes");
      expect(panelContent).toContain("Cobrar / Factura");
    });

    it("debe existir la ruta dedicada /workspace/[businessId]/cocina/tickets/page.tsx", () => {
      const routePath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/cocina/tickets/page.tsx"
      );
      expect(fs.existsSync(routePath)).toBe(true);

      const content = fs.readFileSync(routePath, "utf-8");
      expect(content).toContain("getKdsOpenTickets");
      expect(content).toContain('defaultView="open_tickets"');
    });

    it("REGLA ESTRICTA: prohibido el uso de alertas nativas (window.alert, confirm, prompt, Alert.alert)", () => {
      const filesToCheck = [
        "src/app/workspace/[businessId]/cocina/open-tickets-panel.tsx",
        "src/app/workspace/[businessId]/cocina/kds-screen-client.tsx",
        "src/app/workspace/[businessId]/cocina/tickets/page.tsx",
        "src/app/workspace/[businessId]/cocina/page.tsx",
        "src/app/workspace/[businessId]/cocina/actions.ts",
      ];

      for (const file of filesToCheck) {
        const fullPath = path.join(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          expect(content).not.toMatch(/\bwindow\.alert\b/);
          expect(content).not.toMatch(/\bwindow\.confirm\b/);
          expect(content).not.toMatch(/\bwindow\.prompt\b/);
          expect(content).not.toMatch(/\bAlert\.alert\b/);
        }
      }
    });
  });
});

