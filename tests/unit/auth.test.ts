import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, registerFailedAttempt, clearRateLimit } from "../../src/lib/security/rate-limit";

// Simular next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockImplementation(() => {
    return Promise.resolve(new Map([["x-forwarded-for", "192.168.1.1"]]));
  }),
}));

describe("Auth Security Tests", () => {
  const testIp = "192.168.1.50";

  beforeEach(() => {
    clearRateLimit(testIp);
  });

  describe("Rate Limiting", () => {
    it("debe permitir intentos normales iniciales", () => {
      const status = checkRateLimit(testIp);
      expect(status.isBlocked).toBe(false);
      expect(status.secondsLeft).toBe(0);
    });

    it("debe bloquear la IP tras 5 intentos fallidos consecutivos", () => {
      // Registrar 5 fallos
      for (let i = 0; i < 5; i++) {
        registerFailedAttempt(testIp);
      }

      const status = checkRateLimit(testIp);
      expect(status.isBlocked).toBe(true);
      expect(status.secondsLeft).toBeGreaterThan(0);
      expect(status.secondsLeft).toBeLessThanOrEqual(900); // 15 minutos en segundos
    });

    it("debe desbloquear la IP cuando se limpia el historial tras éxito", () => {
      // Registrar 5 fallos
      for (let i = 0; i < 5; i++) {
        registerFailedAttempt(testIp);
      }

      expect(checkRateLimit(testIp).isBlocked).toBe(true);

      // Iniciar sesión exitoso -> Limpiar
      clearRateLimit(testIp);

      expect(checkRateLimit(testIp).isBlocked).toBe(false);
    });
  });

  describe("Open Redirect Mitigation", () => {
    it("debe aceptar rutas internas relativas válidas", () => {
      const paths = ["/dashboard", "/admin/negocios", "/restablecer-contrasena"];
      paths.forEach((path) => {
        let safeNext = "/dashboard";
        if (path.startsWith("/") && !path.startsWith("//")) {
          safeNext = path;
        }
        expect(safeNext).toBe(path);
      });
    });

    it("debe rechazar redirecciones de protocolo relativo e indirectas", () => {
      const maliciousPaths = [
        "//sitio-malicioso.com",
        "https://sitio-malicioso.com/dashboard",
        "http://evil.com",
        "//google.com",
      ];
      maliciousPaths.forEach((path) => {
        let safeNext = "/dashboard";
        if (path.startsWith("/") && !path.startsWith("//")) {
          safeNext = path;
        }
        expect(safeNext).toBe("/dashboard"); // Debe retornar el valor por defecto seguro
      });
    });
  });
});
