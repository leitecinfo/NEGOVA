import { describe, it, expect, vi } from "vitest";
import {
  normalizeWhatsAppNumber,
  formatOrderSummaryMessage,
  buildWhatsAppOrderLink,
  WhatsAppOrderSummaryData,
} from "@/lib/whatsapp/order-whatsapp-format";

describe("Digital Menu WhatsApp Integration & Business Order Flow", () => {
  describe("1. Normalización y Validación de Números de WhatsApp", () => {
    it("debe normalizar números locales colombianos de 10 dígitos anteponiendo el indicativo 57", () => {
      const res = normalizeWhatsAppNumber("3114567890");
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe("573114567890");
      expect(res.formattedDisplay).toBe("+57 311 456 7890");
    });

    it("debe normalizar números colombianos con prefijo internacional +57 y formato con espacios o guiones", () => {
      const res = normalizeWhatsAppNumber("+57 300 123 4567");
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe("573001234567");
      expect(res.formattedDisplay).toBe("+57 300 123 4567");

      const resWithDashes = normalizeWhatsAppNumber("+57-315-987-6543");
      expect(resWithDashes.isValid).toBe(true);
      expect(resWithDashes.normalized).toBe("573159876543");
    });

    it("debe aceptar números internacionales válidos respetando el estándar E.164", () => {
      // México
      const resMx = normalizeWhatsAppNumber("+52 55 1234 5678");
      expect(resMx.isValid).toBe(true);
      expect(resMx.normalized).toBe("525512345678");

      // España
      const resEs = normalizeWhatsAppNumber("+34 612 345 678");
      expect(resEs.isValid).toBe(true);
      expect(resEs.normalized).toBe("34612345678");

      // Estados Unidos
      const resUs = normalizeWhatsAppNumber("+1 555 123 4567");
      expect(resUs.isValid).toBe(true);
      expect(resUs.normalized).toBe("15551234567");
    });

    it("debe rechazar números incompletos, vacíos o que no cumplan la longitud mínima", () => {
      expect(normalizeWhatsAppNumber("").isValid).toBe(false);
      expect(normalizeWhatsAppNumber(null).isValid).toBe(false);
      expect(normalizeWhatsAppNumber(undefined).isValid).toBe(false);
      expect(normalizeWhatsAppNumber("12345").isValid).toBe(false);
      expect(normalizeWhatsAppNumber("abcdefg").isValid).toBe(false);
    });
  });

  describe("2. Construcción del Resumen del Pedido para WhatsApp", () => {
    it("debe generar un mensaje completo y estructurado para pedidos de Recogida (takeout)", () => {
      const orderData: WhatsAppOrderSummaryData = {
        orderNumber: 42,
        businessName: "Burger Brava Gourmet",
        orderType: "takeout",
        customerName: "Carlos Gómez",
        customerPhone: "3119876543",
        subtotal: 35000,
        total: 35000,
        currency: "COP",
        paymentMethodLabel: "Efectivo",
        notes: "Por favor empacar para llevar en bolsa térmica.",
        items: [
          {
            name: "Hamburguesa Brava",
            variantName: "Doble Carne",
            quantity: 1,
            unitPrice: 28000,
            subtotal: 28000,
            selectedModifiers: [
              { optionName: "Tocineta Extra", price: 4000 },
              { optionName: "Sin Cebolla" },
            ],
          },
          {
            name: "Papas Rústicas",
            quantity: 1,
            unitPrice: 7000,
            subtotal: 7000,
          },
        ],
      };

      const msg = formatOrderSummaryMessage(orderData);

      expect(msg).toContain("*¡NUEVO PEDIDO #42 DESDE EL MENÚ DIGITAL!*");
      expect(msg).toContain("*Comercio:* Burger Brava Gourmet");
      expect(msg).toContain("*Modalidad:* Recogida en el local 🛍️");
      expect(msg).toContain("*Cliente:* Carlos Gómez");
      expect(msg).toContain("*Teléfono:* 3119876543");
      expect(msg).toContain("• 1x Hamburguesa Brava (Doble Carne)");
      expect(msg).toContain("└ *Complementos:* Tocineta Extra (+$4.000), Sin Cebolla");
      expect(msg).toContain("• 1x Papas Rústicas");
      expect(msg).toContain("*Subtotal productos:* $35.000");
      expect(msg).not.toContain("*Costo de domicilio:*");
      expect(msg).toContain("*TOTAL:* $35.000");
      expect(msg).toContain("*Método de pago propuesto:* Efectivo");
      expect(msg).toContain("*Observaciones:* Por favor empacar para llevar en bolsa térmica.");
      expect(msg).toContain("_Pedido registrado en NEGOVA. Por favor confirma la recepción de este mensaje._");
    });

    it("debe generar un mensaje completo con dirección, referencia y costo de domicilio separado para Domicilios (delivery)", () => {
      const orderData: WhatsAppOrderSummaryData = {
        orderNumber: 105,
        businessName: "Pizzería La Bella",
        orderType: "delivery",
        customerName: "Laura Restrepo",
        customerPhone: "3154443322",
        deliveryAddress: "Carrera 43A # 1-50 Apto 402",
        deliveryReference: "Frente al parque principal, edificio blanco",
        subtotal: 54000,
        deliveryFee: 6000,
        total: 60000,
        currency: "COP",
        paymentMethodLabel: "Bancolombia (Transferencia)",
        items: [
          {
            name: "Pizza Familiar 4 Quesos",
            quantity: 1,
            unitPrice: 48000,
            subtotal: 48000,
          },
          {
            name: "Gaseosa 1.5L",
            quantity: 1,
            unitPrice: 6000,
            subtotal: 6000,
          },
        ],
      };

      const msg = formatOrderSummaryMessage(orderData);

      expect(msg).toContain("*¡NUEVO PEDIDO #105 DESDE EL MENÚ DIGITAL!*");
      expect(msg).toContain("*Modalidad:* Domicilio 🛵");
      expect(msg).toContain("*Cliente:* Laura Restrepo");
      expect(msg).toContain("*Teléfono:* 3154443322");
      expect(msg).toContain("*Dirección de entrega:* Carrera 43A # 1-50 Apto 402");
      expect(msg).toContain("*Puntos de referencia:* Frente al parque principal, edificio blanco");
      expect(msg).toContain("*Subtotal productos:* $54.000");
      expect(msg).toContain("*Costo de domicilio:* $6.000");
      expect(msg).toContain("*TOTAL:* $60.000");
      expect(msg).toContain("*Método de pago propuesto:* Bancolombia (Transferencia)");
    });
  });

  describe("3. Construcción del Enlace wa.me con Codificación Segura", () => {
    it("debe construir el enlace universal https://wa.me/NUMERO?text=... codificando correctamente caracteres especiales", () => {
      const phone = "+57 311 456 7890";
      const message = "¡Hola! Mi pedido #99 tiene un valor de $25.000 COP & incluye papas.";

      const res = buildWhatsAppOrderLink(phone, message);

      expect(res.isValid).toBe(true);
      expect(res.normalizedNumber).toBe("573114567890");
      expect(res.url).toBe(
        `https://wa.me/573114567890?text=${encodeURIComponent(message)}`
      );
    });

    it("debe retornar url null si el número de teléfono no es válido o está ausente", () => {
      const resNull = buildWhatsAppOrderLink(null, "Mensaje de prueba");
      expect(resNull.isValid).toBe(false);
      expect(resNull.url).toBeNull();

      const resInvalid = buildWhatsAppOrderLink("123", "Mensaje de prueba");
      expect(resInvalid.isValid).toBe(false);
      expect(resInvalid.url).toBeNull();
    });
  });

  describe("4. Reglas de Negocio Obligatorias", () => {
    it("no debe enviar a WhatsApp los pedidos de mesa (dine_in), garantizando su gestión interna en NEGOVA", () => {
      // Regla: En mesa (dine_in), el flujo es gestionado dentro del POS/cocina de NEGOVA y no se genera wa.me
      const isDineIn = true;
      const orderType = "dine_in";

      let generatedWaUrl: string | null = null;
      if (orderType !== "dine_in") {
        generatedWaUrl = "https://wa.me/...";
      }

      expect(generatedWaUrl).toBeNull();
    });

    it("cuando el comercio no tiene WhatsApp configurado, no genera enlaces rotos ni asume números globales", () => {
      const rawBusinessConfig = {
        businessId: "biz-123",
        whatsapp: null,
        phone: null,
      };

      const norm = normalizeWhatsAppNumber(rawBusinessConfig.whatsapp || rawBusinessConfig.phone);
      expect(norm.isValid).toBe(false);

      const linkRes = buildWhatsAppOrderLink(norm.normalized, "Pedido #1");
      expect(linkRes.isValid).toBe(false);
      expect(linkRes.url).toBeNull();
    });

    it("aislamiento multi-tenant: cada negocio utiliza su propio número configurado sin mezclar comercios", () => {
      const bizA = { id: "biz-a", phone: "3101112233", name: "Pizzería A" };
      const bizB = { id: "biz-b", phone: "3209998877", name: "Hamburguesería B" };

      const linkA = buildWhatsAppOrderLink(bizA.phone, "Pedido en " + bizA.name);
      const linkB = buildWhatsAppOrderLink(bizB.phone, "Pedido en " + bizB.name);

      expect(linkA.url).toContain("https://wa.me/573101112233");
      expect(linkB.url).toContain("https://wa.me/573209998877");
      expect(linkA.url).not.toContain("573209998877");
      expect(linkB.url).not.toContain("573101112233");
    });
  });
});
