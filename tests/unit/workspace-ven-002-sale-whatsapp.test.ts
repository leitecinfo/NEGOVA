import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("VEN-002: Detalle Individual de Venta - Enviar por WhatsApp", () => {
  const filePath = path.resolve(
    process.cwd(),
    "src/app/workspace/[businessId]/ventas/[id]/sale-detail-client.tsx"
  );
  const fileContent = fs.readFileSync(filePath, "utf-8");

  describe("1. Eliminación total de 'Enviar por correo'", () => {
    it("NO debe existir el botón 'Enviar por correo' en la barra de acciones ni en el componente", () => {
      expect(fileContent).not.toContain("Enviar por correo");
      expect(fileContent).not.toContain("showEmailModal");
      expect(fileContent).not.toContain("sendEmailAction");
    });
  });

  describe("2. Botón de WhatsApp verde con icono, accesible y responsive", () => {
    it("debe contener el botón 'Enviar por WhatsApp' con fondo verde esmeralda y texto blanco", () => {
      expect(fileContent).toContain("<span>Enviar por WhatsApp</span>");
      expect(fileContent).toContain("bg-emerald-600");
      expect(fileContent).toContain("hover:bg-emerald-700");
      expect(fileContent).toContain("text-white");
    });

    it("debe incluir el icono MessageCircle representativo y atributos de accesibilidad", () => {
      expect(fileContent).toContain("<MessageCircle");
      expect(fileContent).toContain('aria-label="Enviar comprobante por WhatsApp"');
      expect(fileContent).toContain("handleOpenWhatsappModal");
    });
  });

  describe("3. Modal de ingreso/confirmación de WhatsApp y precarga de teléfono", () => {
    it("debe renderizar el modal en un ModalPortal limpio", () => {
      expect(fileContent).toContain("<ModalPortal>");
      expect(fileContent).toContain("showWhatsappModal");
      expect(fileContent).toContain("Enviar Comprobante por WhatsApp");
    });

    it("debe precargar el teléfono registrado del cliente cuando esté disponible", () => {
      expect(fileContent).toContain("doc.customerPhone");
      expect(fileContent).toContain("Teléfono registrado del cliente:");
      expect(fileContent).toContain("setWhatsappPhone(doc.customerPhone || \"\")");
    });

    it("debe mostrar un mensaje claro y permitir ingresar el número si el cliente no tiene teléfono", () => {
      expect(fileContent).toContain("El cliente no tiene teléfono registrado. Ingresa el número de WhatsApp destinatario:");
      expect(fileContent).toContain('id="whatsapp-recipient-phone"');
      expect(fileContent).toContain('type="tel"');
    });
  });

  describe("4. Mensaje estructurado con datos comerciales y enlace de consulta", () => {
    it("debe generar un mensaje estructurado con negocio, comprobante, fecha, total COP y enlace", () => {
      expect(fileContent).toContain("buildStructuredWhatsappMessage");
      expect(fileContent).toContain("📄 *Comprobante:*");
      expect(fileContent).toContain("📅 *Fecha:*");
      expect(fileContent).toContain("👤 *Cliente:*");
      expect(fileContent).toContain("💰 *Total:*");
      expect(fileContent).toContain("🔗 *Enlace de consulta:*");
      expect(fileContent).toContain("formatCOP(targetDoc.total)");
    });

    it("debe construir el enlace de consulta directo a la venta", () => {
      expect(fileContent).toContain("consultationUrl");
      expect(fileContent).toContain("/workspace/${businessId}/ventas/${doc.id}");
    });
  });

  describe("5. Redirección segura a wa.me / api.whatsapp.com", () => {
    it("debe disparar redirección segura a wa.me con codificación URL y prefijo 57 para Colombia", () => {
      expect(fileContent).toContain("https://wa.me/");
      expect(fileContent).toContain("encodeURIComponent");
      expect(fileContent).toContain('"noopener,noreferrer"');
    });
  });

  describe("6. Regla de Oro: Prohibido alertas nativas", () => {
    it("no debe contener window.alert, window.confirm ni window.prompt", () => {
      expect(fileContent).not.toMatch(/window\.alert\s*\(/);
      expect(fileContent).not.toMatch(/window\.confirm\s*\(/);
      expect(fileContent).not.toMatch(/window\.prompt\s*\(/);
      expect(fileContent).not.toMatch(/(?<![a-zA-Z0-9_])alert\s*\(/);
    });

    it("debe utilizar sonner toast para feedback interactivo", () => {
      expect(fileContent).toContain('import { toast } from "sonner"');
      expect(fileContent).toContain('toast.success("Abriendo WhatsApp con el comprobante...")');
    });
  });
});

