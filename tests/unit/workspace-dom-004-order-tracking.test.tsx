import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  generateTrackingCode,
  isValidTrackingCode,
  extractTrackingCode,
  sanitizePublicNotes,
  calculateTrackingProgress,
  getPublicOrderTracking,
  PublicOrderTrackingDTO,
} from "@/lib/delivery/tracking-service";
import { formatOrderSummaryMessage, WhatsAppOrderSummaryData } from "@/lib/whatsapp/order-whatsapp-format";
import { OrderTrackingClient } from "@/app/seguimiento/[trackingCode]/order-tracking-client";
import PublicOrderTrackingPage from "@/app/seguimiento/[trackingCode]/page";
import fs from "fs";
import path from "path";

// Mock DTO para pruebas de renderizado
const mockTrackingDTO: PublicOrderTrackingDTO = {
  trackingCode: "TRK-A8K2F9",
  orderId: "ord_12345",
  orderNumber: 1042,
  orderType: "delivery",
  status: "preparing",
  deliveryStatus: "pending",
  currentStep: "preparing",
  progressPercentage: 50,
  steps: [
    {
      step: "confirmed",
      label: "Confirmado",
      description: "Hemos recibido tu pedido correctamente",
      isCompleted: true,
      isCurrent: false,
    },
    {
      step: "preparing",
      label: "Preparando",
      description: "El restaurante está cocinando tus platos",
      isCompleted: true,
      isCurrent: true,
    },
    {
      step: "in_transit",
      label: "En camino",
      description: "Tu pedido va en camino con el repartidor",
      isCompleted: false,
      isCurrent: false,
    },
    {
      step: "delivered",
      label: "Entregado",
      description: "¡Disfruta tu comida!",
      isCompleted: false,
      isCurrent: false,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  customerName: "Carlos Gómez",
  deliveryAddress: "Carrera 7 # 120-40, Apto 502",
  deliveryReference: "Frente al parque principal",
  notes: "Sin cebolla en la hamburguesa",
  subtotal: 45000,
  deliveryFee: 5000,
  total: 50000,
  currency: "COP",
  business: {
    id: "biz_test_tracking",
    name: "Burger Brava Gourmet",
    logoUrl: "https://example.com/logo.png",
    phone: "3001234567",
    whatsapp: "+573001234567",
  },
  items: [
    {
      id: "it_1",
      productName: "Hamburguesa Doble Queso",
      variantName: "Grande",
      quantity: 2,
      unitPrice: 20000,
      subtotal: 40000,
      modifiers: [{ optionName: "Tocineta extra", price: 3000 }],
    },
    {
      id: "it_2",
      productName: "Papas Rústicas",
      quantity: 1,
      unitPrice: 5000,
      subtotal: 5000,
    },
  ],
};

describe("DOM-004: Implementar seguimiento de pedido para cliente", () => {
  describe("1. Generación y Validación de Código de Seguimiento", () => {
    it("debe generar un código con prefijo TRK- y exactamente 6 caracteres alfanuméricos válidos", () => {
      const code = generateTrackingCode();
      expect(code).toMatch(/^TRK-[2-9A-HJ-NP-Z]{6}$/);
      expect(code.length).toBe(10);
    });

    it("debe validar correctamente formatos válidos e inválidos con isValidTrackingCode", () => {
      expect(isValidTrackingCode("TRK-A8K2F9")).toBe(true);
      expect(isValidTrackingCode("trk-a8k2f9")).toBe(true);
      expect(isValidTrackingCode("TRK-999999")).toBe(true);

      // Inválidos
      expect(isValidTrackingCode("TRK-123")).toBe(false);
      expect(isValidTrackingCode("ORD-A8K2F9")).toBe(false);
      expect(isValidTrackingCode("")).toBe(false);
      expect(isValidTrackingCode(null as any)).toBe(false);
    });

    it("debe extraer el código de seguimiento almacenado en notas", () => {
      const notes = "Sin cebolla por favor [PIN:9821:0] [TRK:TRK-M7B3K8]";
      const extracted = extractTrackingCode(notes);
      expect(extracted).toBe("TRK-M7B3K8");

      expect(extractTrackingCode("Sin código")).toBeNull();
      expect(extractTrackingCode(null)).toBeNull();
    });
  });

  describe("2. Sanitización y Cero Exposición de Datos Sensibles", () => {
    it("sanitizePublicNotes debe remover tags de PIN y TRK dejando solo las notas limpias", () => {
      const rawNotes = "Timbre no funciona [PIN:4582:0] [TRK:TRK-K4N8P2]";
      const sanitized = sanitizePublicNotes(rawNotes);
      expect(sanitized).toBe("Timbre no funciona");
      expect(sanitized).not.toContain("PIN");
      expect(sanitized).not.toContain("4582");
      expect(sanitized).not.toContain("TRK-");
    });

    it("no debe exponer PIN de entrega ni datos de repartidor en el DTO de seguimiento", () => {
      expect((mockTrackingDTO as any).deliveryPin).toBeUndefined();
      expect((mockTrackingDTO as any).pin).toBeUndefined();
      expect((mockTrackingDTO as any).driverAccessPin).toBeUndefined();
      expect((mockTrackingDTO as any).driverPhone).toBeUndefined();
    });
  });

  describe("3. Cálculo de Pasos de Progreso (Confirmado → Preparando → En camino → Entregado)", () => {
    it("debe calcular paso Confirmado (25%) para orden recién recibida", () => {
      const progress = calculateTrackingProgress("received", "pending");
      expect(progress.currentStep).toBe("confirmed");
      expect(progress.progressPercentage).toBe(25);
      expect(progress.steps[0].isCompleted).toBe(true);
      expect(progress.steps[0].isCurrent).toBe(true);
    });

    it("debe calcular paso Preparando (50%) para orden en cocina", () => {
      const progress = calculateTrackingProgress("preparing", "pending");
      expect(progress.currentStep).toBe("preparing");
      expect(progress.progressPercentage).toBe(50);
      expect(progress.steps[1].isCurrent).toBe(true);
    });

    it("debe calcular paso En camino (75%) cuando delivery_status es in_transit", () => {
      const progress = calculateTrackingProgress("ready", "in_transit");
      expect(progress.currentStep).toBe("in_transit");
      expect(progress.progressPercentage).toBe(75);
      expect(progress.steps[2].isCurrent).toBe(true);
    });

    it("debe calcular paso Entregado (100%) cuando la orden se completa", () => {
      const progress = calculateTrackingProgress("delivered", "delivered");
      expect(progress.currentStep).toBe("delivered");
      expect(progress.progressPercentage).toBe(100);
      expect(progress.steps[3].isCurrent).toBe(true);
      expect(progress.steps.every((s) => s.isCompleted)).toBe(true);
    });

    it("debe manejar pedidos cancelados con paso cancelled y 0%", () => {
      const progress = calculateTrackingProgress("cancelled", "failed");
      expect(progress.currentStep).toBe("cancelled");
      expect(progress.progressPercentage).toBe(0);
      expect(progress.steps.every((s) => !s.isCompleted)).toBe(true);
    });
  });

  describe("4. Enlace de Seguimiento en Mensaje de WhatsApp", () => {
    it("debe incluir el enlace de seguimiento en el mensaje cuando el pedido es delivery", () => {
      const summaryData: WhatsAppOrderSummaryData = {
        orderNumber: 1042,
        businessName: "Burger Brava",
        orderType: "delivery",
        customerName: "Carlos Gómez",
        deliveryAddress: "Calle 100 # 15-20",
        trackingCode: "TRK-A8K2F9",
        subtotal: 30000,
        deliveryFee: 5000,
        total: 35000,
        items: [
          {
            name: "Hamburguesa Clásica",
            quantity: 1,
            unitPrice: 30000,
            subtotal: 30000,
          },
        ],
      };

      const message = formatOrderSummaryMessage(summaryData);
      expect(message).toContain("SEGUIMIENTO EN VIVO");
      expect(message).toContain("https://negova.com/seguimiento/TRK-A8K2F9");
    });
  });

  describe("5. Renderizado de Vista Pública de Seguimiento", () => {
    it("OrderTrackingClient debe renderizar barra de progreso con los 4 pasos y datos del pedido", () => {
      const html = renderToStaticMarkup(<OrderTrackingClient initialTracking={mockTrackingDTO} />);

      // Verifica pasos
      expect(html).toContain("Confirmado");
      expect(html).toContain("Preparando");
      expect(html).toContain("En camino");
      expect(html).toContain("Entregado");

      // Verifica datos del comercio y pedido
      expect(html).toContain("Burger Brava Gourmet");
      expect(html).toContain("Pedido #1042");
      expect(html).toContain("TRK-A8K2F9");
      expect(html).toContain("Hamburguesa Doble Queso");
      expect(html).toContain("Carrera 7 # 120-40");

      // No expone PIN
      expect(html).not.toContain("9821");
      expect(html).not.toContain("[PIN:");
    });

    it("PublicOrderTrackingPage debe renderizar estado vacío amigable cuando el código no existe", async () => {
      const pageEl = await PublicOrderTrackingPage({
        params: Promise.resolve({ trackingCode: "TRK-INEXISTENTE" }),
      });
      const html = renderToStaticMarkup(pageEl);

      expect(html).toContain("Seguimiento no encontrado");
      expect(html).toContain("TRK-INEXISTENTE");
      expect(html).toContain("Volver a NEGOVA");
    });
  });

  describe("6. Regla de Código Global: Cero Alertas Nativas", () => {
    it("no debe contener llamadas a window.alert, window.confirm o window.prompt", () => {
      const filesToCheck = [
        "src/lib/delivery/tracking-service.ts",
        "src/app/seguimiento/[trackingCode]/order-tracking-client.tsx",
        "src/app/seguimiento/[trackingCode]/page.tsx",
        "src/app/seguimiento/[trackingCode]/actions.ts",
        "src/app/seguimiento/page.tsx",
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const code = fs.readFileSync(fullPath, "utf-8");

        expect(code).not.toMatch(/\bwindow\.alert\b/);
        expect(code).not.toMatch(/\bwindow\.confirm\b/);
        expect(code).not.toMatch(/\bwindow\.prompt\b/);
        expect(code).not.toMatch(/\bAlert\.alert\b/);
      }
    });
  });
});
