import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateTableQrToken, verifyTableQrToken } from "@/lib/restaurant/table-qr-service";
import { validateTableQrAccess } from "@/lib/restaurant/restaurant-service";

describe("Menú Digital y Códigos QR por Mesa (Seguridad y Tokens)", () => {
  const businessId = "11111111-1111-4111-a111-111111111111";
  const businessId2 = "22222222-2222-4222-a222-222222222222";
  const tableId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
  const tableId2 = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

  it("1. Genera tokens consistentes y verificables para una misma mesa y versión", () => {
    const token = generateTableQrToken(businessId, tableId, 1);
    expect(token).toBeDefined();
    expect(token.startsWith("v1.")).toBe(true);

    const isValid = verifyTableQrToken(businessId, tableId, token, 1);
    expect(isValid).toBe(true);
  });

  it("2. Rechaza tokens alterados o manipulados en la firma", () => {
    const token = generateTableQrToken(businessId, tableId, 1);
    const tamperedToken = token + "xyz";
    const isValid = verifyTableQrToken(businessId, tableId, tamperedToken, 1);
    expect(isValid).toBe(false);
  });

  it("3. Aislamiento estricto: un token de un negocio no es válido para otro negocio", () => {
    const tokenBiz1 = generateTableQrToken(businessId, tableId, 1);
    const isValidForBiz2 = verifyTableQrToken(businessId2, tableId, tokenBiz1, 1);
    expect(isValidForBiz2).toBe(false);
  });

  it("4. Prevención de suplantación de mesa: un token no es válido para otra mesa del mismo negocio", () => {
    const tokenTable1 = generateTableQrToken(businessId, tableId, 1);
    const isValidForTable2 = verifyTableQrToken(businessId, tableId2, tokenTable1, 1);
    expect(isValidForTable2).toBe(false);
  });

  it("5. Revocación por versión: tras regenerar el QR (versión incrementada), el token anterior queda inválido", () => {
    const oldToken = generateTableQrToken(businessId, tableId, 1);
    // El negocio regeneró el QR incrementando a versión 2
    const isValidOnOldVersion = verifyTableQrToken(businessId, tableId, oldToken, 2);
    expect(isValidOnOldVersion).toBe(false);

    const newToken = generateTableQrToken(businessId, tableId, 2);
    expect(verifyTableQrToken(businessId, tableId, newToken, 2)).toBe(true);
  });
});
