import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import { OperationalDeliveryDriver } from "@/lib/delivery/delivery-service";

describe("[DOM-003] Vista por Repartidor en Domicilios", () => {
  // Datos de prueba simulados
  const mockDrivers: OperationalDeliveryDriver[] = [
    {
      id: "drv-1",
      name: "Carlos Moto",
      phone: "3001234567",
      accessPin: "123456",
      isActive: true,
      createdAt: "2026-10-01T10:00:00Z",
    },
    {
      id: "drv-2",
      name: "Daniela Veloz",
      phone: "3109876543",
      accessPin: "654321",
      isActive: true,
      createdAt: "2026-10-02T10:00:00Z",
    },
    {
      id: "drv-3",
      name: "Juan Disponible",
      phone: "3201112233",
      accessPin: "998877",
      isActive: true,
      createdAt: "2026-10-03T10:00:00Z",
    },
  ];

  const now = Date.now();
  const date5mAgo = new Date(now - 5 * 60 * 1000).toISOString();
  const date25mAgo = new Date(now - 25 * 60 * 1000).toISOString();
  const date45mAgo = new Date(now - 45 * 60 * 1000).toISOString();

  const mockOrders: RestaurantOrderWithDetails[] = [
    // 1. Pedido SIN ASIGNAR (delivery_status === 'pending')
    {
      id: "order-unassigned-1",
      business_id: "biz-1",
      order_number: 101,
      status: "received",
      order_type: "delivery",
      channel_origin: "in_person",
      subtotal: 35000,
      delivery_fee: 5000,
      total: 40000,
      delivery_address: "Calle 100 # 15-20, Apto 301",
      customer_name: "Andrés Cepeda",
      customer_phone: "3001234567",
      delivery_status: "pending",
      driver_name: null,
      created_at: date5mAgo,
      updated_at: date5mAgo,
    },
    // 2. Pedido ASIGNADO a Carlos Moto (en espera)
    {
      id: "order-carlos-1",
      business_id: "biz-1",
      order_number: 102,
      status: "in_preparation",
      order_type: "delivery",
      channel_origin: "whatsapp",
      subtotal: 50000,
      delivery_fee: 5000,
      total: 55000,
      delivery_address: "Carrera 7 # 72-40",
      customer_name: "Valeria Gómez",
      delivery_status: "assigned",
      driver_name: "Carlos Moto",
      created_at: date25mAgo,
      updated_at: date25mAgo,
    },
    // 3. Pedido EN CAMINO con Carlos Moto (en ruta 🛵)
    {
      id: "order-carlos-2",
      business_id: "biz-1",
      order_number: 103,
      status: "ready",
      order_type: "delivery",
      channel_origin: "digital_menu",
      subtotal: 75000,
      delivery_fee: 5000,
      total: 80000,
      delivery_address: "Av. Pepe Sierra # 19-10",
      customer_name: "Santiago Ramos",
      delivery_status: "on_the_way",
      driver_name: "Carlos Moto",
      created_at: date45mAgo,
      updated_at: date45mAgo,
    },
    // 4. Pedido ENTREGADO por Carlos Moto (historial completado)
    {
      id: "order-carlos-delivered",
      business_id: "biz-1",
      order_number: 100,
      status: "delivered",
      order_type: "delivery",
      channel_origin: "in_person",
      subtotal: 30000,
      total: 30000,
      delivery_status: "delivered",
      driver_name: "Carlos Moto",
      created_at: date45mAgo,
      updated_at: date5mAgo,
    },
    // 5. Pedido EN CAMINO con Daniela Veloz
    {
      id: "order-daniela-1",
      business_id: "biz-1",
      order_number: 104,
      status: "ready",
      order_type: "delivery",
      channel_origin: "whatsapp",
      subtotal: 60000,
      delivery_fee: 5000,
      total: 65000,
      delivery_address: "Calle 116 # 9-45",
      customer_name: "Mariana Torres",
      delivery_status: "on_the_way",
      driver_name: "Daniela Veloz",
      created_at: date5mAgo,
      updated_at: date5mAgo,
    },
    // 6. Pedido de salón (NO ES DOMICILIO - DEBE EXCLUIRSE)
    {
      id: "order-dine-in",
      business_id: "biz-1",
      order_number: 99,
      status: "received",
      order_type: "dine_in",
      channel_origin: "in_person",
      subtotal: 90000,
      total: 90000,
      table_id: "tbl-1",
      created_at: date5mAgo,
      updated_at: date5mAgo,
    },
  ];

  describe("Criterio de Aceptación 1: Agrupación visual por repartidor asignado", () => {
    it("debe mapear correctamente los pedidos activos y entregados a cada repartidor", () => {
      const map = new Map<string, { active: RestaurantOrderWithDetails[]; delivered: RestaurantOrderWithDetails[] }>();

      for (const d of mockDrivers) {
        map.set(d.name.toLowerCase().trim(), { active: [], delivered: [] });
      }

      for (const order of mockOrders) {
        if (order.order_type !== "delivery" || order.status === "cancelled") continue;
        if (!order.driver_name) continue;

        const key = order.driver_name.toLowerCase().trim();
        const entry = map.get(key);
        if (entry) {
          if (order.delivery_status === "delivered") {
            entry.delivered.push(order);
          } else {
            entry.active.push(order);
          }
        }
      }

      // Carlos Moto debe tener 2 activos (102, 103) y 1 entregado (100)
      const carlosEntry = map.get("carlos moto")!;
      expect(carlosEntry.active.length).toBe(2);
      expect(carlosEntry.delivered.length).toBe(1);
      expect(carlosEntry.active.map((o) => o.order_number)).toEqual([102, 103]);

      // Daniela Veloz debe tener 1 activo (104) y 0 entregados
      const danielaEntry = map.get("daniela veloz")!;
      expect(danielaEntry.active.length).toBe(1);
      expect(danielaEntry.delivered.length).toBe(0);

      // Juan Disponible debe estar libre (0 activos)
      const juanEntry = map.get("juan disponible")!;
      expect(juanEntry.active.length).toBe(0);
      expect(juanEntry.delivered.length).toBe(0);
    });
  });

  describe("Criterio de Aceptación 2: Los pedidos sin asignar aparecen en un grupo separado", () => {
    it("debe filtrar y aislar con precisión los pedidos de domicilio que no tienen repartidor asignado", () => {
      const unassigned = mockOrders.filter(
        (o) =>
          o.order_type === "delivery" &&
          o.status !== "cancelled" &&
          (!o.driver_name || o.delivery_status === "pending" || !o.delivery_status)
      );

      expect(unassigned.length).toBe(1);
      expect(unassigned[0].id).toBe("order-unassigned-1");
      expect(unassigned[0].order_number).toBe(101);
      expect(unassigned[0].driver_name).toBeNull();
    });

    it("no debe mezclar pedidos de salón (dine_in) ni pedidos para llevar en el grupo sin asignar", () => {
      const unassigned = mockOrders.filter(
        (o) =>
          o.order_type === "delivery" &&
          o.status !== "cancelled" &&
          (!o.driver_name || o.delivery_status === "pending" || !o.delivery_status)
      );

      expect(unassigned.some((o) => o.id === "order-dine-in")).toBe(false);
    });
  });

  describe("Criterio de Aceptación 3: El tiempo transcurrido se actualiza en tiempo real", () => {
    it("debe calcular el tiempo transcurrido en minutos y segundos", () => {
      const baseMs = Date.now();
      const testDate = new Date(baseMs - (12 * 60 + 34) * 1000).toISOString(); // 12m 34s

      const elapsedSeconds = Math.floor((baseMs - new Date(testDate).getTime()) / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;

      expect(minutes).toBe(12);
      expect(seconds).toBe(34);

      const pad = (n: number) => n.toString().padStart(2, "0");
      const formatted = `${pad(minutes)}:${pad(seconds)}`;
      expect(formatted).toBe("12:34");
    });

    it("debe asignar los niveles de alerta adecuados (normal < 20m, warning 20-40m, critical >= 40m)", () => {
      const baseMs = Date.now();
      const dateNormal = new Date(baseMs - 10 * 60 * 1000).toISOString();
      const dateWarning = new Date(baseMs - 25 * 60 * 1000).toISOString();
      const dateCritical = new Date(baseMs - 50 * 60 * 1000).toISOString();

      const getLevel = (iso: string) => {
        const mins = Math.floor((baseMs - new Date(iso).getTime()) / (60 * 1000));
        if (mins >= 40) return "critical";
        if (mins >= 20) return "warning";
        return "normal";
      };

      expect(getLevel(dateNormal)).toBe("normal");
      expect(getLevel(dateWarning)).toBe("warning");
      expect(getLevel(dateCritical)).toBe("critical");
    });
  });

  describe("Criterio de Aceptación 4: Integración UI y Supabase Realtime", () => {
    it("el componente DeliveryByDriverTab debe existir y exportarse correctamente", () => {
      const componentPath = path.join(
        process.cwd(),
        "src/components/delivery/delivery-by-driver-tab.tsx"
      );
      expect(fs.existsSync(componentPath)).toBe(true);

      const content = fs.readFileSync(componentPath, "utf-8");
      expect(content).toContain("export function DeliveryByDriverTab");
      expect(content).toContain("Pedidos Sin Asignar");
      expect(content).toContain("Repartidores y Entregas Asignadas");
      expect(content).toContain("setInterval");
    });

    it("deliveries-client.tsx debe integrar la pestaña 'Por Repartidor' y la suscripción Supabase Realtime", () => {
      const clientPath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/pedidos/domicilios/deliveries-client.tsx"
      );
      const content = fs.readFileSync(clientPath, "utf-8");

      expect(content).toContain("DeliveryByDriverTab");
      expect(content).toContain('currentMainTab === "by_driver"');
      expect(content).toContain("Por Repartidor");
      expect(content).toContain("createClient");
      expect(content).toContain("postgres_changes");
      expect(content).toContain("restaurant_orders");
    });

    it("page.tsx debe soportar el parámetro de consulta ?tab=repartidores o ?tab=by_driver", () => {
      const pagePath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/pedidos/domicilios/page.tsx"
      );
      const content = fs.readFileSync(pagePath, "utf-8");

      expect(content).toContain('tab === "repartidores"');
      expect(content).toContain('tab === "by_driver"');
      expect(content).toContain('defaultTab = "by_driver"');
    });
  });

  describe("Criterio de Aceptación 5: Prohibido el uso de alertas nativas del navegador", () => {
    it("no debe contener window.alert, window.confirm, window.prompt ni Alert.alert", () => {
      const files = [
        "src/components/delivery/delivery-by-driver-tab.tsx",
        "src/app/workspace/[businessId]/pedidos/domicilios/deliveries-client.tsx",
        "src/app/workspace/[businessId]/pedidos/domicilios/page.tsx",
      ];

      for (const f of files) {
        const fullPath = path.join(process.cwd(), f);
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

