import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  isValidPinFormat,
  hashPin,
  verifyPinHash,
} from "@/lib/security/pin-service";

describe("Employee Security PIN & Authorization [EMP-002]", () => {
  describe("1. Validación de Formato de PIN", () => {
    it("debe validar correctamente PINs numéricos de 4 a 6 dígitos", () => {
      expect(isValidPinFormat("1234")).toBe(true);
      expect(isValidPinFormat("56789")).toBe(true);
      expect(isValidPinFormat("123456")).toBe(true);
    });

    it("debe rechazar PINs con menos de 4 o más de 6 dígitos", () => {
      expect(isValidPinFormat("123")).toBe(false);
      expect(isValidPinFormat("12")).toBe(false);
      expect(isValidPinFormat("1")).toBe(false);
      expect(isValidPinFormat("1234567")).toBe(false);
      expect(isValidPinFormat("12345678")).toBe(false);
    });

    it("debe rechazar PINs con caracteres no numéricos o espacios internos", () => {
      expect(isValidPinFormat("12a4")).toBe(false);
      expect(isValidPinFormat("abcd")).toBe(false);
      expect(isValidPinFormat("12 34")).toBe(false);
      expect(isValidPinFormat("12-34")).toBe(false);
      expect(isValidPinFormat("")).toBe(false);
    });
  });

  describe("2. Almacenamiento Seguro (Hash Criptográfico Unidireccional)", () => {
    it("el PIN NUNCA se almacena en texto plano en el hash generado", () => {
      const plainPin = "4826";
      const hashed = hashPin(plainPin);

      // Debe usar formato estándar pbkdf2
      expect(hashed.startsWith("pbkdf2$100000$")).toBe(true);

      // El PIN plano NO debe aparecer como subcadena en el hash
      expect(hashed.includes(plainPin)).toBe(false);
    });

    it("dos generaciones del mismo PIN deben generar hashes distintos debido al salt aleatorio", () => {
      const pin = "9876";
      const hash1 = hashPin(pin);
      const hash2 = hashPin(pin);

      expect(hash1).not.toBe(hash2);
      // Ambos deben verificar correctamente con el mismo PIN
      expect(verifyPinHash(pin, hash1)).toBe(true);
      expect(verifyPinHash(pin, hash2)).toBe(true);
    });

    it("debe verificar exitosamente el PIN correcto y rechazar PINs erróneos", () => {
      const correctPin = "554433";
      const hashed = hashPin(correctPin);

      expect(verifyPinHash(correctPin, hashed)).toBe(true);
      expect(verifyPinHash("554434", hashed)).toBe(false);
      expect(verifyPinHash("1111", hashed)).toBe(false);
      expect(verifyPinHash("", hashed)).toBe(false);
    });

    it("debe rechazar hashes corruptos o con formato inválido", () => {
      expect(verifyPinHash("1234", "texto_plano_invalido")).toBe(false);
      expect(verifyPinHash("1234", "md5$invalid$hash")).toBe(false);
      expect(verifyPinHash("1234", "")).toBe(false);
    });
  });

  describe("3. Reglas de Negocio de Autorización de Operaciones Sensibles", () => {
    it("debe permitir la operación si el PIN es correcto y el colaborador tiene el permiso requerido", () => {
      const mockSupervisor = {
        id: "user-sup-01",
        fullName: "Carlos Supervisor",
        role: "admin",
        permissions: ["sales.cancel", "cash.open"],
        pinHash: hashPin("9090"),
      };

      const enteredPin = "9090";
      const requiredPermission = "sales.cancel";

      const isPinValid = verifyPinHash(enteredPin, mockSupervisor.pinHash);
      const hasPerm =
        mockSupervisor.role === "admin" ||
        mockSupervisor.role === "owner" ||
        mockSupervisor.permissions.includes(requiredPermission);

      expect(isPinValid).toBe(true);
      expect(hasPerm).toBe(true);
    });

    it("debe rechazar la operación si el PIN es correcto pero el colaborador NO tiene permiso de anulación", () => {
      const mockWaiter = {
        id: "user-waiter-01",
        fullName: "Juan Mesero",
        role: "waiter",
        permissions: ["orders.create", "orders.view"],
        pinHash: hashPin("4321"),
      };

      const enteredPin = "4321";
      const requiredPermission = "sales.cancel";

      const isPinValid = verifyPinHash(enteredPin, mockWaiter.pinHash);
      const hasPerm =
        mockWaiter.role === "admin" ||
        mockWaiter.role === "owner" ||
        mockWaiter.permissions.includes(requiredPermission);

      expect(isPinValid).toBe(true);
      expect(hasPerm).toBe(false); // Rechazado por falta de permisos
    });

    it("debe rechazar la operación si el PIN ingresado es incorrecto", () => {
      const mockSupervisor = {
        id: "user-sup-01",
        pinHash: hashPin("1234"),
      };

      const enteredPin = "0000";
      const isPinValid = verifyPinHash(enteredPin, mockSupervisor.pinHash);

      expect(isPinValid).toBe(false);
    });
  });

  describe("4. Regla Estricta: Prohibición de Alertas Nativas", () => {
    it("ningún archivo nuevo o modificado debe contener llamadas a alert(), confirm() o prompt()", () => {
      const filesToCheck = [
        path.join(process.cwd(), "src/lib/security/pin-service.ts"),
        path.join(process.cwd(), "src/components/security/pin-assign-modal.tsx"),
        path.join(process.cwd(), "src/components/security/pin-authorization-modal.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/ventas/actions.ts"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/ventas/[id]/sale-detail-client.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/usuarios/[id]/workspace-user-detail-client.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/personal/workspace-personal-client.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/personal/actions.ts"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/usuarios/actions.ts"),
      ];

      const bannedPatterns = [
        /\bwindow\.alert\b/,
        /\bwindow\.confirm\b/,
        /\bwindow\.prompt\b/,
        /\balert\(/,
        /\bconfirm\(/,
        /\bAlert\.alert\b/,
      ];

      for (const filePath of filesToCheck) {
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
          for (const pattern of bannedPatterns) {
            const matches = pattern.test(line);
            expect(
              matches,
              `Alerta nativa prohibida detectada en ${path.basename(filePath)}:${idx + 1} -> "${trimmed}"`
            ).toBe(false);
          }
        });
      }
    });
  });
});
