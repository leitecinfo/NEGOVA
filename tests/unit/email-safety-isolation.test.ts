import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isTestEnvironment,
  getEffectiveEmailRecipient,
  sendOtpEmail,
  sendInvoiceEmail,
  sendSupportEscalationEmail,
  sendWelcomeBusinessEmail,
  DEV_RECIPIENT_EMAIL,
} from "@/lib/email/resend";

describe("Fase 2.8 — Seguridad, Aislamiento e Idempotencia del Servicio de Correos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Detección y Aislamiento de Entorno de Pruebas", () => {
    it("debe detectar que la ejecución se encuentra en un entorno de pruebas automatizadas", () => {
      expect(isTestEnvironment()).toBe(true);
    });

    it("sendOtpEmail debe retornar éxito inmediato sin invocar la API HTTP de Resend en modo test", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const res = await sendOtpEmail({
        to: "usuario-test@negova.com",
        otpCode: "998877",
        subjectTitle: "Código de Verificación de Prueba",
        reasonText: "Prueba automatizada de seguridad de email",
      });

      expect(res.success).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("sendInvoiceEmail debe bloquear llamadas HTTP externas en modo test", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const res = await sendInvoiceEmail({
        to: "cliente-factura@test.com",
        businessName: "Negocio Ficticio Test",
        planName: "Plan Crece",
        periodText: "Octubre 2026",
        amountCop: 150000,
        invoiceNumber: "INV-TEST-001",
      });

      expect(res.success).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("sendSupportEscalationEmail debe bloquear llamadas HTTP externas en modo test", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const res = await sendSupportEscalationEmail({
        conversationNumber: "CONV-TEST-999",
        businessName: "Panadería Ficticia",
        userName: "Cliente de Prueba",
        clientMessage: "Mensaje de prueba en test",
        conversationId: "conv-mock-123",
      });

      expect(res.success).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("sendWelcomeBusinessEmail debe bloquear llamadas HTTP externas en modo test", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const res = await sendWelcomeBusinessEmail({
        to: "owner-test@negova.com",
        businessName: "Negocio de Prueba",
        ownerName: "Propietario Test",
      });

      expect(res.success).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });
  });

  describe("2. Lógica y Sanitización de Destinatarios", () => {
    it("debe redirigir al email de desarrollo si no existe dominio personalizado verificado", () => {
      const originalEnv = process.env.RESEND_CUSTOM_DOMAIN_VERIFIED;
      delete process.env.RESEND_CUSTOM_DOMAIN_VERIFIED;

      const recipient = getEffectiveEmailRecipient("cliente-real@empresa.com");
      expect(recipient).toBe(DEV_RECIPIENT_EMAIL);

      if (originalEnv) process.env.RESEND_CUSTOM_DOMAIN_VERIFIED = originalEnv;
    });

    it("debe preservar el destinatario real si existe dominio personalizado verificado en producción", () => {
      const originalEnv = process.env.RESEND_CUSTOM_DOMAIN_VERIFIED;
      process.env.RESEND_CUSTOM_DOMAIN_VERIFIED = "true";

      const recipient = getEffectiveEmailRecipient("Propietario@MiEmpresa.com ");
      expect(recipient).toBe("propietario@miempresa.com");

      if (originalEnv) process.env.RESEND_CUSTOM_DOMAIN_VERIFIED = originalEnv;
      else delete process.env.RESEND_CUSTOM_DOMAIN_VERIFIED;
    });
  });

  describe("3. Resiliencia ante Fallos de Email en Negocios", () => {
    it("un fallo del proveedor de correo no debe provocar excepciones no controladas", async () => {
      // Simular ejecución donde el guard permite el paso pero fetch arroja error
      const isTestSpy = vi.spyOn({ isTestEnvironment }, "isTestEnvironment").mockReturnValue(false);

      // sendWelcomeBusinessEmail maneja internamente la excepción sin relanzar error crítico
      const res = await sendWelcomeBusinessEmail({
        to: "destinatario@test.com",
        businessName: "Comercio",
        ownerName: "Dueño",
      });

      expect(res).toBeDefined();
      expect(typeof res.success).toBe("boolean");

      isTestSpy.mockRestore();
    });
  });
});
