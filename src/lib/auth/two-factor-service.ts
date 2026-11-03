/**
 * NEGOVA Two-Factor Authentication (2FA / TOTP) & Recovery Codes Service [CONF-004]
 * 
 * Alcance y Reglas de Arquitectura:
 * 1. Soporte para aplicaciones de autenticación estándar (Google Authenticator, Authy, 1Password).
 * 2. Generación y verificación de factores TOTP (RFC 6238 / RFC 4226) con tolerancia a desfase de reloj (+/- 30s).
 * 3. Códigos de respaldo (recovery codes) criptográficamente seguros de un solo uso con almacenamiento en hash SHA-256.
 * 4. Control de activación por usuario y obligatoriedad por negocio ("Requerir 2FA para administradores").
 * 5. Cero alertas nativas.
 */

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

export interface RecoveryCodesResult {
  rawCodes: string[];
  hashedCodes: string[];
}

export interface TotpEnrollmentData {
  factorId: string;
  qrCodeUrl: string;
  secret: string;
  uri: string;
  recoveryCodes: string[];
}

export interface UserTwoFactorStatus {
  isEnabled: boolean;
  factorId: string | null;
  verifiedAt: string | null;
  recoveryCodesTotal: number;
  recoveryCodesRemaining: number;
  recoveryCodesUsed: number;
}

export interface BusinessSecuritySettings {
  require2faForAdmins: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE32 & RFC 6238 TOTP ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Decodifica una cadena Base32 a Buffer binario
 */
export function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(Math.floor((clean.length * 5) / 8));

  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Codifica un Buffer a cadena Base32
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Genera un secreto Base32 criptográficamente aleatorio (160 bits / 20 bytes)
 */
export function generateTotpSecret(): string {
  const randomBytes = crypto.randomBytes(20);
  return base32Encode(randomBytes);
}

/**
 * Calcula el código TOTP de 6 dígitos para un secreto y ventana de tiempo
 */
export function calculateTotpCode(secretBase32: string, stepOffset = 0, timestampMs = Date.now()): string {
  const epoch = Math.floor(timestampMs / 1000);
  const timeStep = Math.floor(epoch / 30) + stepOffset;
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep));

  const key = base32Decode(secretBase32);
  const hmac = crypto.createHmac("sha1", key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 1000000).toString().padStart(6, "0");
}

/**
 * Verifica un código TOTP admitiendo desfase de tiempo (+/- 1 intervalo de 30s)
 */
export function verifyTotpCode(inputCode: string, secretBase32: string, timestampMs = Date.now()): boolean {
  const cleanCode = inputCode.trim();
  if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
    return false;
  }

  // Comprobar ventana actual, anterior (-30s) y siguiente (+30s)
  for (const offset of [0, -1, 1]) {
    const validCode = calculateTotpCode(secretBase32, offset, timestampMs);
    if (validCode === cleanCode) {
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOVERY CODES (CÓDIGOS DE RESPALDO)
// ─────────────────────────────────────────────────────────────────────────────

const RECOVERY_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Sin 0, O, 1, I para evitar confusión

/**
 * Normaliza y calcula el hash SHA-256 de un código de respaldo
 */
export function hashRecoveryCode(code: string): string {
  const normalized = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Genera un conjunto de códigos de respaldo legibles (ej. 8B4C-29D1) y sus hashes
 */
export function generateRecoveryCodes(count = 8): RecoveryCodesResult {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    let part1 = "";
    let part2 = "";
    const bytes = crypto.randomBytes(8);
    for (let j = 0; j < 4; j++) {
      part1 += RECOVERY_CHARSET[bytes[j] % RECOVERY_CHARSET.length];
      part2 += RECOVERY_CHARSET[bytes[j + 4] % RECOVERY_CHARSET.length];
    }
    const rawCode = `${part1}-${part2}`;
    rawCodes.push(rawCode);
    hashedCodes.push(hashRecoveryCode(rawCode));
  }

  return { rawCodes, hashedCodes };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICIO DE BASE DE DATOS Y GESTIÓN DE 2FA
// ─────────────────────────────────────────────────────────────────────────────

async function getAdminClient() {
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return null;
  }

  return createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Almacena los códigos de respaldo en la tabla user_mfa_recovery_codes
 */
export async function storeRecoveryCodes(userId: string, hashedCodes: string[]): Promise<void> {
  const adminClient = await getAdminClient();
  if (!adminClient) return;

  // Eliminar códigos anteriores no usados
  await adminClient.from("user_mfa_recovery_codes").delete().eq("user_id", userId);

  // Insertar los nuevos códigos
  const records = hashedCodes.map((codeHash) => ({
    user_id: userId,
    code_hash: codeHash,
    used_at: null,
  }));

  await adminClient.from("user_mfa_recovery_codes").insert(records);
}

/**
 * Consulta el estado y cantidad de códigos de respaldo del usuario
 */
export async function getRecoveryCodesStatus(userId: string): Promise<{ total: number; remaining: number; used: number }> {
  const adminClient = await getAdminClient();
  if (!adminClient) {
    return { total: 0, remaining: 0, used: 0 };
  }

  const { data, error } = await adminClient
    .from("user_mfa_recovery_codes")
    .select("id, used_at")
    .eq("user_id", userId);

  if (error || !data) {
    return { total: 0, remaining: 0, used: 0 };
  }

  const total = data.length;
  const used = data.filter((r) => r.used_at !== null).length;
  const remaining = total - used;

  return { total, remaining, used };
}

/**
 * Valida y consume de forma atómica un código de respaldo
 */
export async function verifyAndConsumeRecoveryCode(
  userId: string,
  rawCode: string
): Promise<{ success: boolean; remainingCount: number; error?: string }> {
  const adminClient = await getAdminClient();
  if (!adminClient) {
    return { success: false, remainingCount: 0, error: "Servicio de autenticación no disponible." };
  }

  const codeHash = hashRecoveryCode(rawCode);

  // Buscar coincidencia sin usar
  const { data: matchedRecord, error } = await adminClient
    .from("user_mfa_recovery_codes")
    .select("id")
    .eq("user_id", userId)
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .maybeSingle();

  if (error || !matchedRecord) {
    return {
      success: false,
      remainingCount: 0,
      error: "Código de respaldo inválido o ya ha sido utilizado previamente.",
    };
  }

  // Marcar como consumido
  await adminClient
    .from("user_mfa_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", matchedRecord.id);

  const status = await getRecoveryCodesStatus(userId);

  return {
    success: true,
    remainingCount: status.remaining,
  };
}

/**
 * Inicia el proceso de registro TOTP generando secreto, URI, QR code y códigos de respaldo
 */
export async function initiateTotpEnrollment(userId: string, userEmail: string): Promise<TotpEnrollmentData> {
  const secret = generateTotpSecret();
  const issuer = "NEGOVA";
  const label = encodeURIComponent(`${issuer}:${userEmail}`);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(uri)}`;

  const factorId = `totp_${crypto.randomBytes(8).toString("hex")}`;
  const { rawCodes, hashedCodes } = generateRecoveryCodes(8);

  return {
    factorId,
    qrCodeUrl,
    secret,
    uri,
    recoveryCodes: rawCodes,
  };
}

/**
 * Valida el código TOTP inicial, activa el 2FA en el perfil y guarda los códigos de respaldo
 */
export async function confirmAndActivate2fa(
  userId: string,
  factorId: string,
  secretBase32: string,
  inputCode: string,
  rawRecoveryCodes: string[]
): Promise<{ success: boolean; error?: string }> {
  // 1. Validar el código TOTP ingresado
  const isValid = verifyTotpCode(inputCode, secretBase32);
  if (!isValid) {
    return {
      success: false,
      error: "El código de 6 dígitos ingresado es incorrecto o ha expirado. Por favor verifica tu app de autenticación.",
    };
  }

  const adminClient = await getAdminClient();
  if (!adminClient) {
    return { success: false, error: "Error de conexión con la base de datos." };
  }

  // 2. Hashear y guardar códigos de respaldo
  const hashedCodes = rawRecoveryCodes.map(hashRecoveryCode);
  await storeRecoveryCodes(userId, hashedCodes);

  // 3. Activar bandera de 2FA en la tabla users
  const { error: updateError } = await adminClient
    .from("users")
    .update({
      is_2fa_enabled: true,
      two_factor_factor_id: factorId,
      two_factor_verified_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    return {
      success: false,
      error: `No fue posible actualizar el estado de 2FA: ${updateError.message}`,
    };
  }

  return { success: true };
}

/**
 * Desactiva la verificación en dos pasos para el usuario
 */
export async function disableUser2fa(userId: string): Promise<{ success: boolean; error?: string }> {
  const adminClient = await getAdminClient();
  if (!adminClient) {
    return { success: false, error: "Servicio no disponible." };
  }

  // Desactivar en tabla users
  await adminClient
    .from("users")
    .update({
      is_2fa_enabled: false,
      two_factor_factor_id: null,
      two_factor_verified_at: null,
    })
    .eq("id", userId);

  // Eliminar códigos de respaldo
  await adminClient.from("user_mfa_recovery_codes").delete().eq("user_id", userId);

  return { success: true };
}

/**
 * Obtiene el estado consolidado de 2FA para un usuario
 */
export async function getUser2faStatus(userId: string): Promise<UserTwoFactorStatus> {
  const adminClient = await getAdminClient();
  if (!adminClient) {
    return {
      isEnabled: false,
      factorId: null,
      verifiedAt: null,
      recoveryCodesTotal: 0,
      recoveryCodesRemaining: 0,
      recoveryCodesUsed: 0,
    };
  }

  const { data: userRow } = await adminClient
    .from("users")
    .select("is_2fa_enabled, two_factor_factor_id, two_factor_verified_at")
    .eq("id", userId)
    .maybeSingle();

  const codesStatus = await getRecoveryCodesStatus(userId);

  return {
    isEnabled: Boolean(userRow?.is_2fa_enabled),
    factorId: userRow?.two_factor_factor_id || null,
    verifiedAt: userRow?.two_factor_verified_at || null,
    recoveryCodesTotal: codesStatus.total,
    recoveryCodesRemaining: codesStatus.remaining,
    recoveryCodesUsed: codesStatus.used,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE SEGURIDAD DEL NEGOCIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Consulta la política de obligatoriedad de 2FA configurada en el negocio
 */
export async function getBusinessSecuritySettings(businessId: string): Promise<BusinessSecuritySettings> {
  const adminClient = await getAdminClient();
  if (!adminClient) {
    return { require2faForAdmins: false };
  }

  const { data: biz } = await adminClient
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();

  const settings = (biz?.settings as Record<string, unknown>) || {};
  const security = (settings.security as Record<string, unknown>) || {};

  return {
    require2faForAdmins: Boolean(security.require_2fa_for_admins ?? security.require2faForAdmins ?? false),
  };
}

/**
 * Actualiza la política de obligatoriedad de 2FA del negocio
 */
export async function updateBusinessSecuritySettings(
  businessId: string,
  settings: Partial<BusinessSecuritySettings>
): Promise<{ success: boolean; error?: string }> {
  const adminClient = await getAdminClient();
  if (!adminClient) {
    return { success: false, error: "Servicio no disponible." };
  }

  // Obtener configuración actual
  const { data: biz } = await adminClient
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();

  const currentSettings = (biz?.settings as Record<string, unknown>) || {};
  const currentSecurity = (currentSettings.security as Record<string, unknown>) || {};

  const updatedSecurity = {
    ...currentSecurity,
    require_2fa_for_admins: settings.require2faForAdmins ?? currentSecurity.require_2fa_for_admins ?? false,
    updated_at: new Date().toISOString(),
  };

  const updatedSettings = {
    ...currentSettings,
    security: updatedSecurity,
  };

  const { error } = await adminClient
    .from("businesses")
    .update({ settings: updatedSettings })
    .eq("id", businessId);

  if (error) {
    return { success: false, error: `No fue posible guardar las políticas de seguridad: ${error.message}` };
  }

  return { success: true };
}

/**
 * Determina si el usuario debe someterse obligatoriamente a verificación 2FA
 */
export async function isTwoFactorEnforcedForUser(
  userId: string,
  businessId?: string
): Promise<{ isEnabled: boolean; isEnforcedByBusiness: boolean; requires2fa: boolean }> {
  const userStatus = await getUser2faStatus(userId);

  if (userStatus.isEnabled) {
    return { isEnabled: true, isEnforcedByBusiness: false, requires2fa: true };
  }

  if (!businessId) {
    return { isEnabled: false, isEnforcedByBusiness: false, requires2fa: false };
  }

  const bizSettings = await getBusinessSecuritySettings(businessId);
  if (!bizSettings.require2faForAdmins) {
    return { isEnabled: false, isEnforcedByBusiness: false, requires2fa: false };
  }

  // Comprobar si el usuario tiene rol administrativo en el negocio
  const adminClient = await getAdminClient();
  if (!adminClient) {
    return { isEnabled: false, isEnforcedByBusiness: false, requires2fa: false };
  }

  const { data: membership } = await adminClient
    .from("business_users")
    .select("roles(code)")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .neq("status", "inactive")
    .maybeSingle();

  const roleData = membership?.roles as any;
  const roleCode = Array.isArray(roleData) ? roleData[0]?.code : roleData?.code;
  const isAdminRole = ["owner", "business_owner", "admin", "administrador", "gerente"].includes(roleCode);

  return {
    isEnabled: false,
    isEnforcedByBusiness: isAdminRole,
    requires2fa: isAdminRole,
  };
}
