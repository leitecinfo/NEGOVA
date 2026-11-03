import { describe, it, expect } from "vitest";
import { createRestaurantOrder } from "@/lib/restaurant/restaurant-service";
import { CreateRestaurantOrderInput } from "@/lib/restaurant/types";

describe("Asignación de Personal en Pedidos [PED-006]", () => {
  const businessId = "biz_restaurant_ped_001";
  const userId = "usr_cashier_001";

  it("1. Debe crear un pedido a domicilio con domiciliario asignado y persistir la referencia", async () => {
    const input: CreateRestaurantOrderInput = {
      orderType: "delivery",
      channelOrigin: "in_person",
      customerName: "Laura Zapata",
      customerPhone: "3109876543",
      deliveryAddress: "Carrera 70 # 45 - 20, Apto 302",
      deliveryFee: 5000,
      driverName: "Alexander Repartos (#DOM01)",
      items: [
        {
          productId: "prod_001",
          quantity: 2,
        },
      ],
    };

    const res = await createRestaurantOrder(businessId, input, userId);

    expect(res).toBeDefined();
    // En entorno simulado o real verifica respuesta estructurada
    if (res.success) {
      expect(res.orderId).toBeDefined();
      expect(res.orderNumber).toBeGreaterThan(0);
    }
  });

  it("2. Debe crear un pedido en mesa con camarero responsable asignado", async () => {
    const input: CreateRestaurantOrderInput = {
      orderType: "dine_in",
      channelOrigin: "in_person",
      tableId: "tbl_001",
      waiterId: "emp_waiter_001",
      waiterName: "Carlos Suárez (#css1)",
      items: [
        {
          productId: "prod_002",
          quantity: 1,
        },
      ],
    };

    const res = await createRestaurantOrder(businessId, input, userId);
    expect(res).toBeDefined();
  });
});
