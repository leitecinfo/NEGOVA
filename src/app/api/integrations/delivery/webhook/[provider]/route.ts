import { NextRequest, NextResponse } from "next/server";
import { ingestExternalDeliveryOrder } from "@/lib/delivery/delivery-integrations-service";
import { DeliveryProvider, SimulatedOrderPayload } from "@/lib/delivery/integration-types";

/**
 * GET: Verificación de salud y endpoint para validación de URLs por parte de Rappi o Justo
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (provider !== "rappi" && provider !== "justo") {
    return NextResponse.json(
      { error: `Proveedor '${provider}' no soportado. Debe ser 'rappi' o 'justo'.` },
      { status: 400 }
    );
  }

  const businessId = req.nextUrl.searchParams.get("businessId");
  return NextResponse.json({
    status: "ok",
    provider,
    businessId: businessId || null,
    timestamp: new Date().toISOString(),
    message: "Endpoint de webhook de delivery NEGOVA activo y listo para recibir eventos.",
  });
}

/**
 * POST: Ingesta de pedidos entrantes desde Webhooks de Rappi o Justo [DOM-005]
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (provider !== "rappi" && provider !== "justo") {
    return NextResponse.json(
      { error: `Proveedor '${provider}' no soportado. Debe ser 'rappi' o 'justo'.` },
      { status: 400 }
    );
  }

  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json(
      { error: "Parámetro 'businessId' requerido en la URL del webhook." },
      { status: 400 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud JSON inválido." }, { status: 400 });
  }

  const deliveryProvider = provider as DeliveryProvider;

  // Normalización según el proveedor de delivery
  let normalizedPayload: SimulatedOrderPayload;

  if (deliveryProvider === "rappi") {
    // Formato estándar de orden Rappi o payload simplificado
    const rappiOrder = body.order || body;
    const externalId = String(rappiOrder.id || rappiOrder.order_id || body.order_id || Date.now());
    const customer = rappiOrder.customer || {};
    const deliveryInfo = rappiOrder.delivery_information || {};

    const rawItems = Array.isArray(rappiOrder.items) ? rappiOrder.items : [];
    const items = rawItems.map((item: any, idx: number) => {
      const unitPrice = Number(item.unit_price || item.price || 10000);
      const quantity = Math.max(1, Number(item.quantity || 1));
      return {
        name: item.name || item.product_name || `Producto Rappi #${idx + 1}`,
        quantity,
        unitPrice,
        subtotal: unitPrice * quantity,
      };
    });

    const subtotal = Number(rappiOrder.subtotal || rappiOrder.totals?.subtotal || 30000);
    const deliveryFee = Number(rappiOrder.delivery_fee || rappiOrder.totals?.delivery_fee || 5000);
    const total = Number(rappiOrder.total || rappiOrder.totals?.total || subtotal + deliveryFee);

    normalizedPayload = {
      provider: "rappi",
      externalOrderId: externalId,
      customerName: customer.first_name ? `${customer.first_name} ${customer.last_name || ""}`.trim() : "Cliente Rappi",
      customerPhone: customer.phone_number || customer.phone || "No disponible (Rappi)",
      deliveryAddress: deliveryInfo.street_name || deliveryInfo.address || rappiOrder.delivery_address || "Dirección Rappi",
      deliveryNotes: deliveryInfo.complement || deliveryInfo.notes || rappiOrder.notes || "",
      items: items.length > 0 ? items : [
        {
          name: "Pedido Integración Rappi",
          quantity: 1,
          unitPrice: subtotal,
          subtotal,
        },
      ],
      subtotal,
      deliveryFee,
      total,
    };
  } else {
    // Formato estándar de orden Justo o payload simplificado
    const justoOrder = body.order || body;
    const externalId = String(justoOrder.id || justoOrder.order_id || Date.now());
    const client = justoOrder.client || justoOrder.customer || {};
    const addressObj = justoOrder.shipping_address || justoOrder.delivery_address || {};

    const rawProducts = Array.isArray(justoOrder.products || justoOrder.items)
      ? justoOrder.products || justoOrder.items
      : [];
    const items = rawProducts.map((p: any, idx: number) => {
      const unitPrice = Number(p.price || p.unit_price || 12000);
      const quantity = Math.max(1, Number(p.quantity || 1));
      return {
        name: p.name || `Ítem Justo #${idx + 1}`,
        quantity,
        unitPrice,
        subtotal: unitPrice * quantity,
      };
    });

    const subtotal = Number(justoOrder.subtotal || justoOrder.pricing?.subtotal || 35000);
    const deliveryFee = Number(justoOrder.shipping_cost || justoOrder.pricing?.shipping || 4000);
    const total = Number(justoOrder.total || justoOrder.pricing?.total || subtotal + deliveryFee);

    normalizedPayload = {
      provider: "justo",
      externalOrderId: externalId,
      customerName: client.name || client.full_name || "Cliente Justo DTC",
      customerPhone: client.phone || client.mobile || "+573000000000",
      deliveryAddress: typeof addressObj === "string" ? addressObj : (addressObj.address || addressObj.street || "Dirección Justo"),
      deliveryNotes: typeof addressObj === "object" ? addressObj.complement || addressObj.reference : "",
      items: items.length > 0 ? items : [
        {
          name: "Pedido Tienda Justo",
          quantity: 1,
          unitPrice: subtotal,
          subtotal,
        },
      ],
      subtotal,
      deliveryFee,
      total,
    };
  }

  const result = await ingestExternalDeliveryOrder(businessId, normalizedPayload);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Orden externa procesada con éxito desde ${provider.toUpperCase()}`,
    orderId: result.orderId,
    orderNumber: result.orderNumber,
  });
}
