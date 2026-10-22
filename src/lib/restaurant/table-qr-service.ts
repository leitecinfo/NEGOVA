import crypto from "crypto";

const QR_SECRET = process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "negova_table_qr_salt_key_default";

/**
 * Payload estructurado codificado dentro del token de la mesa
 */
export interface TableQrPayload {
  businessId: string;
  tableId: string;
  version: number;
  createdAt: number;
}

/**
 * Genera un token HMAC criptográfico, compacto y seguro para identificar una mesa.
 * - No expone secretos del sistema.
 * - Incluye businessId, tableId y una versión numérica de rotación.
 * - Permite regenerar/revocar incrementando la versión de la mesa.
 */
export function generateTableQrToken(
  businessId: string,
  tableId: string,
  version: number = 1
): string {
  const payloadData = `${businessId}:${tableId}:${version}`;
  const signature = crypto
    .createHmac("sha256", QR_SECRET)
    .update(payloadData)
    .digest("base64url");

  // Formato: v{version}.{signature}
  return `v${version}.${signature}`;
}

/**
 * Valida la firma del token de una mesa en el servidor de forma segura contra timing attacks.
 */
export function verifyTableQrToken(
  businessId: string,
  tableId: string,
  token: string,
  expectedVersion: number = 1
): boolean {
  if (!token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [versionPrefix, clientSignature] = parts;
  const tokenVersion = parseInt(versionPrefix.replace(/^v/, ""), 10);

  if (isNaN(tokenVersion) || tokenVersion !== expectedVersion) {
    return false;
  }

  const payloadData = `${businessId}:${tableId}:${expectedVersion}`;
  const expectedSignature = crypto
    .createHmac("sha256", QR_SECRET)
    .update(payloadData)
    .digest("base64url");

  try {
    const clientBuf = Buffer.from(clientSignature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (clientBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(clientBuf, expectedBuf);
  } catch {
    return false;
  }
}
