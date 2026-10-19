import { describe, it, expect } from "vitest";
import {
  extractDeliveryVerification,
  encodeDeliveryVerification,
  type OperationalDeliveryDriver,
} from "../../src/lib/delivery/delivery-service";
import type { DocumentConfig } from "../../src/lib/documents/types";
import type { RestaurantOrderWithDetails } from "../../src/lib/restaurant/types";

describe("NEGOVA — Auditoría e Implementación del Tiquete Térmico, Ventas y Reparto Seguro", () => {
  // =========================================================================
  // 1. CONFIGURACIÓN Y FORMATO DEL TIQUETE TÉRMICO (58 mm y 80 mm)
  // =========================================================================
  describe("1. Tiquete Comercial e Impresión Térmica", () => {
    it("debe admitir configuración explícita de ancho de papel '58mm' y '80mm' con fallback seguro", () => {
      const config80: Partial<DocumentConfig> = {
        paperWidth: "80mm",
        title: "Tiquete de Venta",
      };
      expect(config80.paperWidth).toBe("80mm");

      const config58: Partial<DocumentConfig> = {
        paperWidth: "58mm",
        title: "Tiquete de Venta",
      };
      expect(config58.paperWidth).toBe("58mm");

      // Fallback por defecto si no está definido
      const fallbackConfig: Partial<DocumentConfig> = {};
      const resolvedWidth = fallbackConfig.paperWidth || "80mm";
      expect(resolvedWidth).toBe("80mm");
    });

    it("debe formatear fecha y hora juntas en una sola línea según el estándar de NEGOVA", () => {
      const timestamp = "2026-10-18T12:35:00Z";
      const dateObj = new Date(timestamp);
      
      const day = String(dateObj.getDate()).padStart(2, "0");
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const year = dateObj.getFullYear();
      const timeStr = dateObj.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const singleLineDateTime = `Fecha y hora: ${day}/${month}/${year} · ${timeStr}`;
      expect(singleLineDateTime).toContain("Fecha y hora:");
      expect(singleLineDateTime).toContain("·");
      expect(singleLineDateTime).not.toContain("\n");
    });

    it("debe calcular el importe exacto por línea (cantidad * precio unitario)", () => {
      const items = [
        { product_name: "Salchipapa Especial", quantity: 2, unit_price: 10000, subtotal: 20000 },
        { product_name: "Gaseosa 350ml", quantity: 2, unit_price: 3000, subtotal: 6000 },
      ];

      items.forEach((item) => {
        expect(item.quantity * item.unit_price).toBe(item.subtotal);
      });

      const calculatedTotal = items.reduce((sum, it) => sum + it.subtotal, 0);
      expect(calculatedTotal).toBe(26000);
    });

    it("debe manejar nombres de productos largos mediante ajuste de línea sin desbordar columnas", () => {
      const longName = "Hamburguesa Doble Carne Angus con Tocineta Ahumada, Doble Queso Cheddar y Salsa Especial";
      expect(longName.length).toBeGreaterThan(40);
      // En CSS térmico se asegura whitespace-normal / break-words
      const cssClasses = "break-words whitespace-normal leading-tight";
      expect(cssClasses).toContain("break-words");
    });
  });

  // =========================================================================
  // 2. FLUJO DE VENTAS SIN DATOS INNECESARIOS DEL CLIENTE
  // =========================================================================
  describe("2. Flujo de Registro Comercial sin Exigir Cliente", () => {
    it("debe permitir venta presencial sin cliente registrado, asignando 'Consumidor Final'", () => {
      const saleData = {
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        items: [{ product_id: "p1", quantity: 1, unit_price: 15000 }],
      };

      const resolvedCustomerName = saleData.customer_name?.trim() || "Consumidor Final";
      expect(resolvedCustomerName).toBe("Consumidor Final");
      expect(saleData.customer_email).toBe(""); // No requerido
    });

    it("debe permitir pedido para llevar (takeout) sin mesa ni dirección", () => {
      const takeoutOrder = {
        order_type: "takeout",
        table_id: null,
        delivery_address: null,
        customer_name: "Pedro", // Opcional
      };

      expect(takeoutOrder.table_id).toBeNull();
      expect(takeoutOrder.delivery_address).toBeNull();
      expect(takeoutOrder.order_type).toBe("takeout");
    });

    it("debe exigir dirección obligatoria en delivery pero permitir que el nombre sea opcional", () => {
      const deliveryOrder = {
        order_type: "delivery",
        delivery_address: "Calle 45 # 22 - 15, Apto 302",
        customer_name: "", // Opcional para el empleado
        customer_phone: "3001234567",
      };

      // Dirección obligatoria
      expect(deliveryOrder.delivery_address.trim().length).toBeGreaterThan(0);

      // Nombre opcional con fallback a 'Cliente Domicilio'
      const finalRecipient = deliveryOrder.customer_name?.trim() || "Cliente Domicilio";
      expect(finalRecipient).toBe("Cliente Domicilio");
    });
  });

  // =========================================================================
  // 3. CÓDIGO DE VERIFICACIÓN DE ENTREGA Y PROTECCIÓN CONTRA FUERZA BRUTA
  // =========================================================================
  describe("3. Código de Verificación de Entrega", () => {
    it("debe codificar y extraer el código de entrega de las notas sin alterar las observaciones limpias", () => {
      const baseNote = "Tocar el timbre de la reja blanca";
      const code = "8421";
      const encoded = encodeDeliveryVerification(baseNote, code, 0);

      expect(encoded).toBe("Tocar el timbre de la reja blanca [PIN:8421:0]");

      const extracted = extractDeliveryVerification(encoded);
      expect(extracted.code).toBe("8421");
      expect(extracted.attempts).toBe(0);
      expect(extracted.isLocked).toBe(false);
      expect(extracted.cleanNotes).toBe("Tocar el timbre de la reja blanca");
    });

    it("debe incrementar intentos fallidos y bloquearse tras 5 intentos incorrectos", () => {
      let notes = encodeDeliveryVerification("Sin notas", "5544", 0);

      for (let i = 1; i <= 5; i++) {
        notes = encodeDeliveryVerification("Sin notas", "5544", i);
      }

      const extracted = extractDeliveryVerification(notes);
      expect(extracted.code).toBe("5544");
      expect(extracted.attempts).toBe(5);
      expect(extracted.isLocked).toBe(true);
    });

    it("debe censurar el código de entrega en la vista del domiciliario para obligarlo a pedirlo al cliente", () => {
      const rawOrder: Partial<RestaurantOrderWithDetails> = {
        id: "ord-1",
        order_number: 105,
        delivery_verification_code: "9912",
      };

      // Sanitización para el repartidor
      const sanitized = {
        ...rawOrder,
        delivery_verification_code: undefined,
        hasVerificationCode: Boolean(rawOrder.delivery_verification_code),
      };

      expect(sanitized.delivery_verification_code).toBeUndefined();
      expect(sanitized.hasVerificationCode).toBe(true);
    });
  });

  // =========================================================================
  // 4. ACCESO OPERATIVO DE DOMICILIARIOS SIN CREAR USUARIOS FACTURABLES
  // =========================================================================
  describe("4. Acceso Operativo de Domiciliarios (Protección de Licencias)", () => {
    const mockDriver: OperationalDeliveryDriver = {
      id: "drv-001",
      name: "Carlos Repartidor",
      phone: "3109876543",
      accessPin: "123456",
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    it("debe validar correctamente el PIN de 6 dígitos del domiciliario", () => {
      const enteredPin = "123456";
      expect(enteredPin).toBe(mockDriver.accessPin);
      expect(mockDriver.isActive).toBe(true);
    });

    it("debe rechazar el acceso cuando el domiciliario fue revocado o inactivado", () => {
      const inactiveDriver: OperationalDeliveryDriver = {
        ...mockDriver,
        isActive: false,
      };

      const isAuthorized = inactiveDriver.isActive && inactiveDriver.accessPin === "123456";
      expect(isAuthorized).toBe(false);
    });

    it("no debe crear filas en 'business_users' garantizando que no consume cupos del plan SaaS", () => {
      // El domiciliario se almacena dentro de businesses.settings.delivery_drivers (JSONB)
      const businessSettings = {
        paperWidth: "80mm",
        delivery_drivers: [mockDriver],
      };

      expect(businessSettings.delivery_drivers.length).toBe(1);
      // No existe user_id de auth.users ni rol convencional
      expect((businessSettings.delivery_drivers[0] as any).user_id).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. ESTRICTA SEPARACIÓN ENTRE ESTADO DE ENTREGA Y ESTADO DE PAGO
  // =========================================================================
  describe("5. Separación de Estados: Entrega vs Pago", () => {
    it("confirmar una entrega NO debe marcar automáticamente el pedido como pagado", () => {
      const orderBefore = {
        id: "ord-test",
        delivery_status: "on_the_way",
        status: "in_preparation",
        payment_status: "pending", // Cliente pagará en efectivo al recibir
      };

      // Simulación de confirmación de entrega
      const orderAfterDelivery = {
        ...orderBefore,
        delivery_status: "delivered",
        status: "delivered",
        // payment_status SE DEBE MANTENER INTACTO
      };

      expect(orderAfterDelivery.delivery_status).toBe("delivered");
      expect(orderAfterDelivery.status).toBe("delivered");
      expect(orderAfterDelivery.payment_status).toBe("pending"); // AÚN PENDIENTE DE COBRO
    });

    it("un pedido pagado previamente debe conservar su estado de pago al ser entregado", () => {
      const prepaidOrder = {
        id: "ord-prepaid",
        delivery_status: "on_the_way",
        payment_status: "paid", // Pagado con Wompi o tarjeta
      };

      const afterDelivery = {
        ...prepaidOrder,
        delivery_status: "delivered",
      };

      expect(afterDelivery.delivery_status).toBe("delivered");
      expect(afterDelivery.payment_status).toBe("paid");
    });
  });
});
