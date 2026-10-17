import { headers } from "next/headers";

export interface RateLimitRecord {
  timestamps: number[];
  blockedUntil: number | null;
  consecutiveLockouts: number;
  isPermanentlyLocked?: boolean;
}

export interface SecurityCheckResult {
  isBlocked: boolean;
  isPermanentlyBlocked: boolean;
  secondsLeft: number;
  humanTimeLeft?: string;
  errorMessage?: string;
}

// Ventana de tiempo y umbrales de seguridad
export const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
export const MAX_ATTEMPTS = 5; // 5 intentos fallidos antes de bloqueo temporal
export const MAX_CONSECUTIVE_LOCKOUTS = 3; // 3 bloqueos consecutivos antes de suspensión permanente

// Caché en memoria de alta velocidad para respuesta instantánea
const securityMap = new Map<string, RateLimitRecord>();

/**
 * Convierte segundos a formato natural en español (nunca muestra números crudos como '900 segundos').
 */
export function formatSecondsToHumanReadable(seconds: number): string {
  if (seconds <= 0) return "unos momentos";
  if (seconds < 60) {
    return `${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }
  const hours = Math.ceil(minutes / 60);
  return `${hours} ${hours === 1 ? "hora" : "horas"}`;
}

/**
 * Obtiene la dirección IP del cliente de forma segura.
 */
export async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();
    const xForwardedFor = headersList.get("x-forwarded-for");
    if (xForwardedFor) {
      const firstIp = xForwardedFor.split(",")[0].trim();
      if (firstIp) return firstIp;
    }
    return headersList.get("x-real-ip") || "127.0.0.1";
  } catch {
    return "127.0.0.1";
  }
}

/**
 * Cliente de servicio de Supabase (Server-side)
 */
async function getSupabaseAdmin() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return null;
}

/**
 * Obtiene el registro de seguridad para un identificador (email o ip), consultando la base de datos como fuente de la verdad.
 */
async function getSecurityRecord(identifier: string): Promise<RateLimitRecord> {
  // 1. Consultar base de datos como fuente principal de verdad
  try {
    const admin = await getSupabaseAdmin();
    if (admin) {
      const { data, error } = await admin
        .from("platform_settings")
        .select("value")
        .eq("key", `security:lockout:${identifier}`)
        .maybeSingle();

      if (!error) {
        if (data && data.value && typeof data.value === "object") {
          const record = data.value as RateLimitRecord;
          if (!Array.isArray(record.timestamps)) {
            record.timestamps = [];
          }
          securityMap.set(identifier, record);
          return record;
        } else {
          // Si en la base de datos se eliminó el registro (DELETE FROM platform_settings),
          // limpiamos inmediatamente la memoria caché en Next.js.
          securityMap.delete(identifier);
          return {
            timestamps: [],
            blockedUntil: null,
            consecutiveLockouts: 0,
            isPermanentlyLocked: false,
          };
        }
      }
    }
  } catch (err) {
    console.error("Error leyendo registro de seguridad de base de datos:", err);
  }

  // 2. Si falló la conexión con la BD, revisar caché en memoria como respaldo
  const cached = securityMap.get(identifier);
  if (cached) {
    if (!Array.isArray(cached.timestamps)) {
      cached.timestamps = [];
    }
    return cached;
  }

  const newRecord: RateLimitRecord = {
    timestamps: [],
    blockedUntil: null,
    consecutiveLockouts: 0,
    isPermanentlyLocked: false,
  };
  securityMap.set(identifier, newRecord);
  return newRecord;
}

/**
 * Persiste el registro de seguridad en memoria y en la base de datos (platform_settings).
 */
async function saveSecurityRecord(identifier: string, record: RateLimitRecord): Promise<void> {
  if (!Array.isArray(record.timestamps)) {
    record.timestamps = [];
  }
  securityMap.set(identifier, record);

  try {
    const admin = await getSupabaseAdmin();
    if (admin) {
      await admin.from("platform_settings").upsert(
        {
          key: `security:lockout:${identifier}`,
          value: record,
          description: `Registro de seguridad y rate limit para ${identifier}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    }
  } catch (err) {
    console.error("Error persistiendo registro de seguridad en base de datos:", err);
  }
}

/**
 * Comprueba el estado de seguridad de un intento de login (por IP y por Cuenta/Email).
 */
export async function checkLoginSecurity(email: string, ip: string): Promise<SecurityCheckResult> {
  const now = Date.now();
  const sanitizedEmail = email.trim().toLowerCase();

  // 1. Verificar el estatus del usuario en public.users
  try {
    const admin = await getSupabaseAdmin();
    if (admin && sanitizedEmail) {
      const { data: user } = await admin
        .from("users")
        .select("id, status")
        .eq("email", sanitizedEmail)
        .maybeSingle();

      // Si el usuario en la base de datos está 'active', limpiar cualquier bloqueo en memoria
      if (user && user.status === "active") {
        securityMap.delete(sanitizedEmail);
        securityMap.delete(ip);
      } else if (user && user.status === "suspended") {
        return {
          isBlocked: true,
          isPermanentlyBlocked: true,
          secondsLeft: 0,
          errorMessage:
            "Tu cuenta ha sido bloqueada permanentemente por motivos de seguridad debido a múltiples bloqueos consecutivos por intentos fallidos. Por favor, comunícate con soporte técnico (soporte@negova.com) para verificar tu identidad y solicitar el desbloqueo.",
        };
      }
    }
  } catch (err) {
    console.error("Error verificando estatus de usuario en base de datos:", err);
  }

  // 2. Verificar estado de bloqueo para el email
  const emailRecord = await getSecurityRecord(sanitizedEmail);
  if (emailRecord.isPermanentlyLocked) {
    return {
      isBlocked: true,
      isPermanentlyBlocked: true,
      secondsLeft: 0,
      errorMessage:
        "Tu cuenta ha sido bloqueada permanentemente por motivos de seguridad debido a múltiples bloqueos consecutivos por intentos fallidos. Por favor, comunícate con soporte técnico (soporte@negova.com) para verificar tu identidad y solicitar el desbloqueo.",
    };
  }

  if (emailRecord.blockedUntil && emailRecord.blockedUntil > now) {
    const secondsLeft = Math.ceil((emailRecord.blockedUntil - now) / 1000);
    const humanTime = formatSecondsToHumanReadable(secondsLeft);
    return {
      isBlocked: true,
      isPermanentlyBlocked: false,
      secondsLeft,
      humanTimeLeft: humanTime,
      errorMessage: `Has superado el límite de intentos fallidos permitidos. Por seguridad, el acceso para esta cuenta está bloqueado temporalmente. Intenta nuevamente en ${humanTime}.`,
    };
  }

  // 3. Verificar estado de bloqueo para la IP
  const ipRecord = await getSecurityRecord(ip);
  if (ipRecord.blockedUntil && ipRecord.blockedUntil > now) {
    const secondsLeft = Math.ceil((ipRecord.blockedUntil - now) / 1000);
    const humanTime = formatSecondsToHumanReadable(secondsLeft);
    return {
      isBlocked: true,
      isPermanentlyBlocked: false,
      secondsLeft,
      humanTimeLeft: humanTime,
      errorMessage: `Demasiados intentos fallidos desde tu conexión. Por seguridad, el acceso está bloqueado temporalmente. Intenta nuevamente en ${humanTime}.`,
    };
  }

  return {
    isBlocked: false,
    isPermanentlyBlocked: false,
    secondsLeft: 0,
  };
}

/**
 * Registra un intento fallido para la cuenta (email) y la IP.
 * Aplica bloqueo temporal de 15 minutos al alcanzar 5 intentos.
 * Si acumula 3 bloqueos temporales consecutivos, suspende permanentemente la cuenta en la base de datos.
 */
export async function registerFailedLogin(
  email: string,
  ip: string
): Promise<{
  isPermanent: boolean;
  isTemporary: boolean;
  message: string;
}> {
  const now = Date.now();
  const sanitizedEmail = email.trim().toLowerCase();
  const admin = await getSupabaseAdmin();

  // Actualizar registro del email
  const record = await getSecurityRecord(sanitizedEmail);

  // Filtrar timestamps fuera de la ventana
  record.timestamps = record.timestamps.filter((ts) => now - ts < WINDOW_MS);
  record.timestamps.push(now);

  // También registrar en IP
  const ipRecord = await getSecurityRecord(ip);
  ipRecord.timestamps = ipRecord.timestamps.filter((ts) => now - ts < WINDOW_MS);
  ipRecord.timestamps.push(now);

  // Verificar si alcanzó los 5 intentos
  if (record.timestamps.length >= MAX_ATTEMPTS) {
    record.consecutiveLockouts = (record.consecutiveLockouts || 0) + 1;
    record.timestamps = []; // Reiniciar conteo para la nueva ventana

    // A. ¿Alcanzó 3 bloqueos temporales consecutivos? -> BLOQUEO PERMANENTE
    if (record.consecutiveLockouts >= MAX_CONSECUTIVE_LOCKOUTS) {
      record.isPermanentlyLocked = true;
      record.blockedUntil = null;
      await saveSecurityRecord(sanitizedEmail, record);

      // Actualizar estado del usuario en public.users a 'suspended'
      if (admin) {
        try {
          await admin
            .from("users")
            .update({ status: "suspended", updated_at: new Date().toISOString() })
            .eq("email", sanitizedEmail);

          // Registrar en auditoría (Plataforma: business_id = null)
          const { logAuditAction } = await import("@/lib/audit/audit-service");
          await logAuditAction({
            businessId: null,
            action: "status_change",
            entityType: "account_security",
            ipAddress: ip,
            metadata: {
              original_action: "security_permanent_lockout",
              event: "permanent_lockout",
              reason: "exceeded_3_consecutive_lockouts",
              email: sanitizedEmail,
              ip,
              timestamp: new Date().toISOString(),
            },
          });
        } catch (e) {
          console.error("Error suspendiendo usuario permanentemente en base de datos:", e);
        }
      }

      return {
        isPermanent: true,
        isTemporary: false,
        message:
          "Tu cuenta ha sido bloqueada permanentemente por seguridad debido a múltiples bloqueos consecutivos por intentos fallidos. Por favor, comunícate con soporte técnico (soporte@negova.com) para verificar tu identidad y solicitar el desbloqueo.",
      };
    }

    // B. BLOQUEO TEMPORAL (15 minutos)
    const blockedUntil = now + WINDOW_MS;
    record.blockedUntil = blockedUntil;
    ipRecord.blockedUntil = blockedUntil;

    await Promise.all([
      saveSecurityRecord(sanitizedEmail, record),
      saveSecurityRecord(ip, ipRecord),
    ]);

    // Registrar en auditoría (Plataforma: business_id = null)
    if (admin) {
      const { logAuditAction } = await import("@/lib/audit/audit-service");
      await logAuditAction({
        businessId: null,
        action: "login",
        entityType: "account_security",
        ipAddress: ip,
        metadata: {
          original_action: "security_temporary_lockout",
          event: "temporary_lockout",
          lockout_number: record.consecutiveLockouts,
          max_lockouts: MAX_CONSECUTIVE_LOCKOUTS,
          duration: "15 minutos",
          email: sanitizedEmail,
          ip,
        },
      });
    }

    return {
      isPermanent: false,
      isTemporary: true,
      message: `Has superado el límite de 5 intentos fallidos. Por tu seguridad, el acceso ha sido bloqueado temporalmente durante 15 minutos (bloqueo ${record.consecutiveLockouts} de ${MAX_CONSECUTIVE_LOCKOUTS} antes de suspensión permanente).`,
    };
  }

  // Guardar intentos acumulados
  await Promise.all([
    saveSecurityRecord(sanitizedEmail, record),
    saveSecurityRecord(ip, ipRecord),
  ]);

  const remainingAttempts = MAX_ATTEMPTS - record.timestamps.length;
  return {
    isPermanent: false,
    isTemporary: false,
    message: `El correo o la contraseña no son correctos. Te quedan ${remainingAttempts} ${
      remainingAttempts === 1 ? "intento" : "intentos"
    } antes del bloqueo temporal de 15 minutos.`,
  };
}

/**
 * Limpia el estado de bloqueo e intentos fallidos tras un inicio de sesión exitoso.
 */
export async function clearLoginSecurity(email: string, ip: string): Promise<void> {
  const sanitizedEmail = email.trim().toLowerCase();
  securityMap.delete(sanitizedEmail);
  securityMap.delete(ip);

  try {
    const admin = await getSupabaseAdmin();
    if (admin) {
      await admin
        .from("platform_settings")
        .delete()
        .in("key", [`security:lockout:${sanitizedEmail}`, `security:lockout:${ip}`]);

      // Actualizar último login
      await admin
        .from("users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("email", sanitizedEmail);
    }
  } catch (err) {
    console.error("Error limpiando estado de seguridad en base de datos:", err);
  }
}

// -----------------------------------------------------------------------------
// Funciones de compatibilidad hacia atrás (ej. sendRecoveryOtp)
// -----------------------------------------------------------------------------

export function checkRateLimit(ip: string): { isBlocked: boolean; secondsLeft: number; humanTimeLeft: string } {
  const now = Date.now();
  let record = securityMap.get(ip);

  if (!record) {
    return { isBlocked: false, secondsLeft: 0, humanTimeLeft: "" };
  }

  if (record.blockedUntil && record.blockedUntil > now) {
    const secondsLeft = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      isBlocked: true,
      secondsLeft,
      humanTimeLeft: formatSecondsToHumanReadable(secondsLeft),
    };
  }

  if (record.blockedUntil && record.blockedUntil <= now) {
    record.blockedUntil = null;
    record.timestamps = [];
    securityMap.set(ip, record);
  }

  record.timestamps = record.timestamps.filter((ts) => now - ts < WINDOW_MS);
  securityMap.set(ip, record);

  if (record.timestamps.length >= MAX_ATTEMPTS) {
    const blockedUntil = now + WINDOW_MS;
    record.blockedUntil = blockedUntil;
    securityMap.set(ip, record);
    const secondsLeft = Math.ceil(WINDOW_MS / 1000);
    return {
      isBlocked: true,
      secondsLeft,
      humanTimeLeft: formatSecondsToHumanReadable(secondsLeft),
    };
  }

  return { isBlocked: false, secondsLeft: 0, humanTimeLeft: "" };
}

export function registerFailedAttempt(ip: string): void {
  const now = Date.now();
  let record = securityMap.get(ip);

  if (!record) {
    record = {
      timestamps: [now],
      blockedUntil: null,
      consecutiveLockouts: 0,
    };
  } else {
    record.timestamps.push(now);
  }

  securityMap.set(ip, record);
}

export function clearRateLimit(ip: string): void {
  securityMap.delete(ip);
}
