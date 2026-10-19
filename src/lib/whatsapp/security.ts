import crypto from "crypto";

/**
 * Módulo de Criptografía y Seguridad para WhatsApp Business Platform (NEGOVA)
 * Garantiza:
 * 1. Verificación timing-safe de firmas HMAC-SHA256 de webhooks de Meta.
 * 2. Cifrado simétrico AES-256-GCM para tokens de acceso por negocio (At-Rest).
 * 3. Sanitización estricta de registros y errores para prevenir filtración de credenciales.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recomendado para GCM
export const DEFAULT_KEY_ID = "v1";
const MIN_KEY_LENGTH = 32;

/**
 * Resuelve y valida el material criptográfico para la versión de clave especificada.
 * Reglas de seguridad (SEC-01 y SEC-02):
 * 1. NUNCA utiliza claves de respaldo hardcodeadas en el código fuente.
 * 2. NUNCA utiliza WHATSAPP_APP_SECRET como clave de cifrado (estricta separación criptográfica).
 * 3. Falla de inmediato de forma controlada si la clave no está configurada o no tiene la longitud requerida (mínimo 32 caracteres/bytes).
 * 4. Resuelve la clave según el identificador de versión (`keyId`) para soporte de rotación de claves.
 * 5. Derivación: Se utiliza SHA-256 sobre el material de clave configurado para garantizar exactamente 32 bytes (256 bits)
 *    para AES-256-GCM, preservando compatibilidad determinista sin exponer el material original.
 */
export function resolveEncryptionKey(
  keyId: string = DEFAULT_KEY_ID,
  keyOptions?: string | Record<string, string>
): Buffer {
  let rawKey: string | undefined;

  if (typeof keyOptions === "string" && keyOptions.trim().length > 0) {
    rawKey = keyOptions.trim();
  } else if (keyOptions && typeof keyOptions === "object") {
    rawKey = keyOptions[keyId];
  } else {
    // 1. Intentar mapa JSON de claves en variables de entorno (p.ej. {"v1": "...", "v2": "..."})
    if (process.env.WHATSAPP_ENCRYPTION_KEYS) {
      try {
        const keyring = JSON.parse(process.env.WHATSAPP_ENCRYPTION_KEYS);
        if (keyring && typeof keyring === "object" && keyring[keyId]) {
          rawKey = keyring[keyId];
        }
      } catch {
        // Formato JSON inválido en env; continúa búsqueda por variables individuales
      }
    }

    // 2. Intentar variable de entorno específica para este keyId
    if (!rawKey) {
      const envKeyName = `WHATSAPP_TOKEN_ENCRYPTION_KEY_${keyId.toUpperCase()}`;
      if (process.env[envKeyName]) {
        rawKey = process.env[envKeyName];
      }
    }

    // 3. Si es la versión por defecto ('v1'), intentar clave principal estándar
    if (!rawKey && (keyId === DEFAULT_KEY_ID || keyId === (process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_ID || DEFAULT_KEY_ID))) {
      rawKey = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
    }
  }

  if (!rawKey || !rawKey.trim()) {
    throw new Error(
      `Clave de cifrado de WhatsApp no configurada o versión '${keyId}' desconocida o no autorizada.`
    );
  }

  const cleanKey = rawKey.trim();

  // Validación de longitud y entropía mínima (al menos 32 caracteres o bytes)
  if (cleanKey.length < MIN_KEY_LENGTH) {
    throw new Error(
      `Clave de cifrado inválida para la versión '${keyId}': longitud insuficiente (debe tener al menos ${MIN_KEY_LENGTH} caracteres o bytes).`
    );
  }

  // Derivación determinista a 32 bytes exactos (256 bits) mediante SHA-256
  return crypto.createHash("sha256").update(cleanKey).digest();
}

/**
 * Valida la firma `x-hub-signature-256` enviada por Meta en las cabeceras HTTP.
 * Previene ataques de timing usando `crypto.timingSafeEqual`.
 */
export function verifyMetaWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const parts = signatureHeader.trim().split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const expectedSignatureHex = parts[1].toLowerCase();

  const hmac = crypto.createHmac("sha256", appSecret);
  const calculatedHex = hmac.update(rawBody).digest("hex").toLowerCase();

  const expectedBuffer = Buffer.from(expectedSignatureHex, "hex");
  const calculatedBuffer = Buffer.from(calculatedHex, "hex");

  if (expectedBuffer.length !== calculatedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
  } catch {
    return false;
  }
}

/**
 * Cifra un token de acceso mediante AES-256-GCM con IV único y tag de autenticación.
 * Formato de salida estandarizado: enc:<keyId>:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */
export function encryptWhatsAppToken(
  token: string,
  keyOverride?: string,
  keyId: string = DEFAULT_KEY_ID
): { encrypted: string; keyId: string } {
  if (!token || typeof token !== "string") {
    throw new Error("El token a cifrar debe ser una cadena de texto válida.");
  }

  const key = resolveEncryptionKey(keyId, keyOverride);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(token, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  const encrypted = `enc:${keyId}:${ivHex}:${authTag}:${ciphertext}`;

  return {
    encrypted,
    keyId,
  };
}

/**
 * Descifra un token protegido previamente con `encryptWhatsAppToken`.
 * Resuelve la clave criptográfica correspondiente al `keyId` contenido en el payload.
 * Falla de forma controlada si el payload fue manipulado (autenticación GCM) o si la versión es desconocida.
 */
export function decryptWhatsAppToken(
  encryptedPayload: string,
  keyOptions?: string | Record<string, string>
): string {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    throw new Error("El payload cifrado es inválido.");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 5 || parts[0] !== "enc") {
    throw new Error("El formato del token cifrado no es reconocido.");
  }

  const [, keyId, ivHex, authTagHex, ciphertextHex] = parts;

  if (!keyId || !ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("El payload cifrado contiene componentes incompletos.");
  }

  const key = resolveEncryptionKey(keyId, keyOptions);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Vector de inicialización (IV) inválido en el payload cifrado.");
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch {
    throw new Error(
      "Fallo de autenticación en descifrado: el payload ha sido alterado o la clave es incorrecta."
    );
  }
}

/**
 * Elimina o enmascara datos sensibles de un objeto antes de enviarlo a logs.
 */
export function sanitizeLog(data: any): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  const sensitiveKeys = new Set([
    "access_token",
    "encrypted_access_token",
    "encryptedaccesstoken",
    "webhook_verify_token",
    "webhookverifytoken",
    "app_secret",
    "appsecret",
    "secret",
    "authorization",
    "cookie",
    "password",
    "token",
    "encryption_key",
    "encryptionkey",
    "key",
    "private_key",
  ]);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLog(item));
  }

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.has(lowerKey) || lowerKey.includes("secret") || lowerKey.includes("token")) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeLog(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
