import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import {
  DeliveryBusinessConfig,
  DeliverySettlementSummary,
} from "./types";

export interface OperationalDeliveryDriver {
  id: string;
  name: string;
  phone?: string | null;
  accessPin: string; // PIN numérico de 6 dígitos
  isActive: boolean;
  createdAt: string;
  lastAccessAt?: string | null;
}

/**
 * Calcula los totales y montos por liquidar para cada repartidor operativo
 */
export function calculateDeliverySettlements(
  orders: RestaurantOrderWithDetails[],
  drivers: OperationalDeliveryDriver[],
  deliveryConfig?: DeliveryBusinessConfig,
  settledOrderIds: string[] = []
): DeliverySettlementSummary[] {
  const settledSet = new Set(settledOrderIds);

  return drivers.map((driver) => {
    const driverKey = driver.name.toLowerCase().trim();

    // Órdenes asignadas y entregadas a este domiciliario
    const driverOrders = orders.filter(
      (o) =>
        o.order_type === "delivery" &&
        o.status !== "cancelled" &&
        (o.delivery_status === "delivered" || o.status === "delivered") &&
        o.driver_name?.toLowerCase().trim() === driverKey
    );

    let totalCashCollected = 0;
    let totalDigitalCollected = 0;
    let cashOrdersCount = 0;
    let digitalOrdersCount = 0;
    let pendingCashToSettle = 0;
    let driverTips = 0;
    let totalRevenue = 0;
    const orderIds: string[] = [];

    for (const order of driverOrders) {
      orderIds.push(order.id);
      const orderPaymentMethod = (order as any).payment_method;
      const isPaidBefore = order.payment_status === "paid" && orderPaymentMethod !== "cash";
      const total = Number(order.total || 0);
      totalRevenue += total;

      // Si el pago es en efectivo o pendiente por cobrar al entregar
      if (!isPaidBefore && (orderPaymentMethod === "cash" || !orderPaymentMethod || order.payment_status !== "paid")) {
        cashOrdersCount += 1;
        totalCashCollected += total;
        if (!settledSet.has(order.id)) {
          pendingCashToSettle += total;
        }
      } else {
        digitalOrdersCount += 1;
        totalDigitalCollected += total;
      }

      // Propinas si existen
      const tip = Number((order as any).tip_amount || (order as any).tip || 0);
      driverTips += tip;
    }

    // Flete de reparto
    const grossDeliveryFee = driverOrders.reduce((acc, o) => acc + Number(o.delivery_fee || 0), 0);
    const driverDeliveryFeeShare = grossDeliveryFee;
    const businessDeliveryFeeShare = 0;

    const isSettled = driverOrders.length > 0 && pendingCashToSettle === 0;

    return {
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      totalOrdersDelivered: driverOrders.length,
      cashOrdersCount,
      digitalOrdersCount,
      totalCashCollected,
      totalDigitalCollected,
      totalRevenue,
      driverTips,
      driverDeliveryFeeShare,
      businessDeliveryFeeShare,
      pendingCashToSettle,
      isSettled,
      orderIds,
    };
  });
}

