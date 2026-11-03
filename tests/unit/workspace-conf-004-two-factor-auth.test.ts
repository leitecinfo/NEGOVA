import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  calculateTotpCode,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "@/lib/auth/two-factor-service";

describe("[CONF-004] Autenticación en Dos Pasos (2FA / TOTP) y Códigos de Respaldo", () => {
  describe("Motor TOTP RFC 6238 y Base32", () => {
    it("codifica y decodifica Base32 preservando los datos binarios exactos", () => {
      const original = Buffer.from("NEGOVA-SECURE-AUTH-2026", "utf-8");
      const encoded = base32Encode(original);
      const decoded = base32Decode(encoded);

      expect(decoded.toString("utf-8")).toBe("NEGOVA-SECURE-AUTH-2026");
    });

    it("genera un secreto Base32 criptográfico válido de al menos 32 caracteres", () => {
      const secret = generateTotpSecret();
      expect(typeof secret).toBe("string");
      expect(secret.length).toBeGreaterThanOrEqual(32);
      expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
    });

    it("calcula códigos de 6 dígitos con dynamic truncation conforme a RFC 6238", () => {
      const secret = "JBSWY3DPEHPK3PXP"; // Test standard secret "Hello!"
      const code1 = calculateTotpCode(secret, 0, 1600000000000);
      const code2 = calculateTotpCode(secret, 0, 1600000030000);

      expect(code1).toMatch(/^\d{6}$/);
      expect(code2).toMatch(/^\d{6}$/);
      // Tras 30 segundos, el código debe cambiar
      expect(code1).not.toBe(code2);
    });

    it("verifica el código TOTP dentro de la ventana de tiempo y con tolerancia de +/- 30 segundos", () => {
      const secret = generateTotpSecret();
      const now = Date.now();
      const currentCode = calculateTotpCode(secret, 0, now);

      // Código actual es válido
      expect(verifyTotpCode(currentCode, secret, now)).toBe(true);

      // Código con 25s de desfase aún se valida correctamente
      expect(verifyTotpCode(currentCode, secret, now + 25000)).toBe(true);

      // Código erróneo o de más de 60s es rechazado
      expect(verifyTotpCode("000000", secret, now)).toBe(false);
      expect(verifyTotpCode(currentCode, secret, now + 70000)).toBe(false);
    });
  });

  describe("Códigos de Respaldo (Recovery Codes)", () => {
    it("genera la cantidad solicitada (8 códigos) con formato legible XXXX-XXXX", () => {
      const { rawCodes, hashedCodes } = generateRecoveryCodes(8);

      expect(rawCodes).toHaveLength(8);
      expect(hashedCodes).toHaveLength(8);

      for (const code of rawCodes) {
        expect(code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
      }
    });

    it("hashea los códigos de forma determinista usando SHA-256 insensible a espacios y guiones", () => {
      const raw = "8B4C-29D1";
      const hash1 = hashRecoveryCode(raw);
      const hash2 = hashRecoveryCode("8b4c 29d1");
      const hash3 = hashRecoveryCode("8B4C29D1");

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });
  });

  describe("Integración de Navegación y Rutas del Workspace", () => {
    it("verifica que el módulo configuracion_seguridad está registrado en workspace-navigation.ts", () => {
      const navFile = path.resolve(process.cwd(), "src/config/workspace-navigation.ts");
      const content = fs.readFileSync(navFile, "utf-8");

      expect(content).toContain("configuracion_seguridad");
      expect(content).toContain("configuracion/seguridad");
      expect(content).toContain("Seguridad y 2FA");
    });

    it("verifica que la tarjeta de acceso rápido existe en workspace-configuracion-client.tsx", () => {
      const clientFile = path.resolve(
        process.cwd(),
        "src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx"
      );
      const content = fs.readFileSync(clientFile, "utf-8");

      expect(content).toContain("/workspace/${businessId}/configuracion/seguridad");
      expect(content).toContain("Seguridad y 2FA");
      expect(content).toContain("TOTP y códigos de respaldo");
    });
  });

  describe("Cumplimiento Estricto de Cero Alertas Nativas", () => {
    it("garantiza que ningún archivo de 2FA use window.alert, window.confirm, window.prompt o Alert.alert", () => {
      const filesToCheck = [
        path.resolve(process.cwd(), "src/lib/auth/two-factor-service.ts"),
        path.resolve(process.cwd(), "src/app/workspace/[businessId]/configuracion/seguridad/actions.ts"),
        path.resolve(process.cwd(), "src/app/workspace/[businessId]/configuracion/seguridad/security-config-client.tsx"),
        path.resolve(process.cwd(), "src/app/workspace/[businessId]/configuracion/seguridad/page.tsx"),
        path.resolve(process.cwd(), "src/app/(auth)/login/page.tsx"),
        path.resolve(process.cwd(), "src/app/(auth)/actions.ts"),
      ];

      const forbiddenPatterns = [
        /\bwindow\.alert\s*\(/,
        /\bwindow\.confirm\s*\(/,
        /\bwindow\.prompt\s*\(/,
        /\bAlert\.alert\s*\(/,
      ];

      for (const file of filesToCheck) {
        const content = fs.readFileSync(file, "utf-8");
        for (const pattern of forbiddenPatterns) {
          expect(pattern.test(content)).toBe(false);
        }
      }
    });
  });
});

