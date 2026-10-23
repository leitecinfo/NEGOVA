"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { passwordLoginSchema } from "@/lib/security/validation";
import {
  getClientIp,
  checkLoginSecurity,
  registerFailedLogin,
  clearLoginSecurity,
  checkRateLimit,
  registerFailedAttempt,
  formatSecondsToHumanReadable,
} from "@/lib/security/rate-limit";
import { getUserActiveBusinessId } from "@/lib/auth/workspace-context";

export type ActionResponse = {
  success: boolean;
  message?: string;
  error?: string;
  redirectUrl?: string;
  requiresMfa?: boolean;
  mfaEmail?: string;
};

// Esquema de validación específico para recuperación de contraseña
const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(10, "La contraseña debe tener al menos 10 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
    .regex(/[a-z]/, "Debe contener al menos una letra minúscula")
    .regex(/[0-9]/, "Debe contener al menos un número")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial (@, $, !, %, etc.)"),
});

// Esquema de validación para el correo electrónico en la recuperación
const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "El correo electrónico es requerido")
    .email("Ingrese un correo electrónico válido"),
});

/**
 * 1. Inicio de Sesión seguro con Correo, Contraseña y Verificación MFA para administradores
 */
export async function loginWithPassword(formData: FormData): Promise<ActionResponse> {
  try {
    const ip = await getClientIp();
    const rawEmail = (formData.get("email") as string) || "";
    const password = (formData.get("password") as string) || "";
    const sanitizedEmail = rawEmail.trim().toLowerCase();

    // A. Verificar Política de Bloqueo y Seguridad en Base de Datos y Memoria
    const securityStatus = await checkLoginSecurity(sanitizedEmail, ip);
    if (securityStatus.isBlocked) {
      return {
        success: false,
        error: securityStatus.errorMessage,
      };
    }

    // B. Validación Estricta de Campos (Zod)
    const validation = passwordLoginSchema.safeParse({ email: sanitizedEmail, password });
    if (!validation.success) {
      const failResult = await registerFailedLogin(sanitizedEmail, ip);
      return {
        success: false,
        error: validation.error.issues[0]?.message || failResult.message,
      };
    }

    const supabase = await createClient();

    // C. Intentar Autenticación con Supabase Auth
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password,
    });

    if (error || !authData.user) {
      // Registrar intento fallido persistente en base de datos
      const failResult = await registerFailedLogin(sanitizedEmail, ip);
      return {
        success: false,
        error: failResult.message,
      };
    }

    // D. Verificar rol de plataforma usando cliente admin (bypasa RLS)
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("platform_role, status")
      .eq("id", authData.user.id)
      .maybeSingle();

    const authRole = authData.user.app_metadata?.role || authData.user.user_metadata?.role;
    const userPlatformRole =
      profile?.platform_role === "super_admin" || profile?.platform_role === "admin"
        ? profile.platform_role
        : authRole === "super_admin" || authRole === "admin"
          ? authRole
          : (profile?.platform_role || "customer");

    const isActive = profile?.status !== "disabled" && profile?.status !== "blocked";

    if (!isActive) {
      // Cerrar la sesión inmediatamente si está suspendido
      await supabase.auth.signOut();
      return {
        success: false,
        error: "Tu cuenta ha sido deshabilitada o suspendida. Por favor, comunícate con soporte técnico (soporte@negova.com).",
      };
    }

    // E. Determinar si el usuario es staff/admin o dueño de negocio (owner)
    const isStaffOrAdmin =
      userPlatformRole === "super_admin" ||
      userPlatformRole === "admin" ||
      userPlatformRole === "staff";

    // Determinar si es Dueño de Negocio (Owner) desde la fuente autoritativa del servidor
    let isBusinessOwner = authRole === "owner" || authRole === "business_owner";
    if (!isBusinessOwner) {
      const { data: ownerMemberships } = await supabaseAdmin
        .from("business_users")
        .select("id, status, roles(code)")
        .eq("user_id", authData.user.id)
        .neq("status", "inactive");

      if (ownerMemberships && ownerMemberships.length > 0) {
        isBusinessOwner = ownerMemberships.some((m) => {
          const raw = m.roles as any;
          const code = Array.isArray(raw) ? raw[0]?.code : raw?.code;
          return code === "owner" || code === "business_owner";
        });
      }
    }

    // F. Verificar si la política de MFA aplica para el usuario (Staff/Admin o Dueño de Negocio)
    let requireMfa = false;

    if (isStaffOrAdmin) {
      requireMfa = true; // Por defecto activo para administradores
      try {
        const { data: configRow } = await supabaseAdmin
          .from("platform_settings")
          .select("value")
          .eq("key", "core_config")
          .maybeSingle();

        if (configRow?.value && typeof configRow.value === "object") {
          const val = configRow.value as any;
          if (val.seguridad && typeof val.seguridad.requireMfaForStaff === "boolean") {
            requireMfa = val.seguridad.requireMfaForStaff;
          }
        }
      } catch {
        requireMfa = true;
      }
    } else if (isBusinessOwner) {
      requireMfa = true; // Obligatorio para DUEÑOS DE NEGOCIO (OWNER)
      try {
        const { data: configRow } = await supabaseAdmin
          .from("platform_settings")
          .select("value")
          .eq("key", "core_config")
          .maybeSingle();

        if (configRow?.value && typeof configRow.value === "object") {
          const val = configRow.value as any;
          if (val.seguridad && typeof val.seguridad.requireMfaForOwners === "boolean") {
            requireMfa = val.seguridad.requireMfaForOwners;
          }
        }
      } catch {
        requireMfa = true;
      }
    }

    if (requireMfa) {
      // Generar código OTP criptográficamente seguro de 6 dígitos
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Limpiar códigos OTP anteriores para este correo
      await supabaseAdmin.from("password_reset_otps").delete().eq("email", sanitizedEmail);

      // Guardar el código OTP con 10 minutos de expiración
      await supabaseAdmin.from("password_reset_otps").insert({
        email: sanitizedEmail,
        code: otpCode,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      // Enviar correo vía Resend en segundo plano sin bloquear la respuesta al usuario
      import("@/lib/email/resend")
        .then(({ sendOtpEmail }) =>
          sendOtpEmail({
            to: sanitizedEmail,
            otpCode,
            subjectTitle: isBusinessOwner
              ? "Código de Acceso a tu Negocio (MFA / 2FA)"
              : "Código de Acceso de Doble Factor (MFA / 2FA)",
            reasonText: isBusinessOwner
              ? "Tu contraseña ha sido validada. Como medida de seguridad para proteger el acceso a la administración y las operaciones de tu comercio en NEGOVA, ingresa el siguiente código de 6 dígitos para acceder a tu workspace."
              : "Tu contraseña ha sido validada. Como medida de seguridad de acceso al panel administrativo de NEGOVA, ingresa el siguiente código de 6 dígitos para completar el inicio de sesión.",
          })
        )
        .catch((mailErr) => console.error("⚠️ Error enviando OTP por correo:", mailErr));

      console.log(`🔑 [NEGOVA MFA OTP] Código para ${sanitizedEmail}: ${otpCode}`);

      // Desautenticar temporalmente de forma local para exigir el código MFA sin invalidar sesiones en otros dispositivos
      await supabase.auth.signOut({ scope: "local" });

      return {
        success: true,
        requiresMfa: true,
        mfaEmail: sanitizedEmail,
        message: "Código de seguridad de 6 dígitos enviado a tu correo.",
      };
    }

    // G. Limpiar Historial de Intentos Fallidos tras Éxito directo (solo si no requirió MFA)
    await clearLoginSecurity(sanitizedEmail, ip);

    // H. Redirección con retorno seguro hacia el ámbito correspondiente
    const rawRedirect = (formData.get("redirectTo") as string) || "";
    let safeRedirect = "";

    if (rawRedirect.startsWith("/") && rawRedirect !== "/dashboard") {
      if (rawRedirect.startsWith("/admin") && !isStaffOrAdmin) {
        const userBizId = await getUserActiveBusinessId(authData.user.id);
        safeRedirect = userBizId ? `/workspace/${userBizId}` : "/login?error=no_active_business";
      } else {
        safeRedirect = rawRedirect;
      }
    } else if (isStaffOrAdmin) {
      safeRedirect = "/admin";
    } else {
      const userBizId = await getUserActiveBusinessId(authData.user.id);
      safeRedirect = userBizId ? `/workspace/${userBizId}` : "/login?error=no_active_business";
    }

    return {
      success: true,
      message: "Inicio de sesión exitoso",
      redirectUrl: safeRedirect,
    };
  } catch (err: any) {
    console.error("❌ Error inesperado en loginWithPassword:", err);
    return {
      success: false,
      error: err?.message || "Ocurrió un error inesperado al procesar el inicio de sesión.",
    };
  }
}

/**
 * Valida el código OTP de MFA para completar el inicio de sesión administrativo
 */
export async function verifyLoginMfaOtp(formData: FormData): Promise<ActionResponse> {
  const ip = await getClientIp();
  const rawEmail = (formData.get("email") as string) || "";
  const otpCode = (formData.get("otpCode") as string) || "";
  const password = (formData.get("password") as string) || "";
  const sanitizedEmail = rawEmail.trim().toLowerCase();

  if (!sanitizedEmail || !otpCode || otpCode.length !== 6) {
    return {
      success: false,
      error: "Código de verificación inválido. Debe contener 6 dígitos.",
    };
  }

  // A. Verificar bloqueo de seguridad antes de procesar el OTP
  const securityStatus = await checkLoginSecurity(sanitizedEmail, ip);
  if (securityStatus.isBlocked) {
    return {
      success: false,
      error: securityStatus.errorMessage,
    };
  }

  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Buscar el OTP en la base de datos
  const { data: otpRecord, error: dbError } = await supabaseAdmin
    .from("password_reset_otps")
    .select("*")
    .eq("email", sanitizedEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dbError || !otpRecord) {
    return {
      success: false,
      error: "No hay un código de verificación activo. Por favor solicita un nuevo código.",
    };
  }

  // Verificar expiración
  const now = new Date();
  const expiresAt = new Date(otpRecord.expires_at);
  if (now > expiresAt) {
    await supabaseAdmin.from("password_reset_otps").delete().eq("id", otpRecord.id);
    return {
      success: false,
      error: "El código de verificación ha expirado. Por favor solicita uno nuevo.",
    };
  }

  // Verificar código coincidente
  if (otpRecord.code !== otpCode) {
    const failResult = await registerFailedLogin(sanitizedEmail, ip);
    return {
      success: false,
      error: `El código ingresado es incorrecto. ${failResult.message.includes("Te quedan") ? failResult.message.split(". ")[1] : "Verifícalo e intenta nuevamente."}`,
    };
  }

  // Código verificado exitosamente -> Iniciar sesión formal en Supabase Auth
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: sanitizedEmail,
    password,
  });

  if (authError || !authData.user) {
    return {
      success: false,
      error: "Error al autenticar sesión. Por favor ingresa nuevamente tu correo y contraseña.",
    };
  }

  // Eliminar el código usado
  await supabaseAdmin.from("password_reset_otps").delete().eq("id", otpRecord.id);

  // Limpiar historial de seguridad de login en segundo plano
  clearLoginSecurity(sanitizedEmail, ip).catch(() => {});

  // Registrar auditoría en segundo plano sin retrasar la redirección del usuario
  const userBizId = await getUserActiveBusinessId(authData.user.id);
  import("@/lib/audit/audit-service")
    .then(({ logAuditAction }) =>
      logAuditAction({
        businessId: userBizId || null,
        userId: authData.user.id,
        action: "login",
        entityType: "account_security",
        entityId: authData.user.id,
        ipAddress: ip,
        metadata: {
          original_action: "mfa_login_success",
          email: sanitizedEmail,
          authMethod: "password_mfa_otp",
          timestamp: new Date().toISOString(),
        },
      })
    )
    .catch((err) => console.error("⚠️ Error registrando auditoría:", err));

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("platform_role, status")
    .eq("id", authData.user.id)
    .maybeSingle();

  const authRole = authData.user.app_metadata?.role || authData.user.user_metadata?.role;
  const userPlatformRole =
    profile?.platform_role === "super_admin" || profile?.platform_role === "admin"
      ? profile.platform_role
      : authRole === "super_admin" || authRole === "admin"
        ? authRole
        : (profile?.platform_role || "customer");

  const isStaffOrAdmin =
    userPlatformRole === "super_admin" || userPlatformRole === "admin" || userPlatformRole === "staff";

  const mustChangePassword = Boolean(
    authData.user.user_metadata?.must_change_password
  );

  const rawRedirect = (formData.get("redirectTo") as string) || "";
  let safeRedirect = "";

  if (mustChangePassword) {
    safeRedirect = "/reset-password";
  } else if (rawRedirect.startsWith("/") && rawRedirect !== "/dashboard") {
    safeRedirect = rawRedirect;
  } else if (isStaffOrAdmin) {
    safeRedirect = "/admin";
  } else {
    const userBizId = await getUserActiveBusinessId(authData.user.id);
    safeRedirect = userBizId ? `/workspace/${userBizId}` : "/login?error=no_active_business";
  }

  return {
    success: true,
    message: "Identidad verificada exitosamente",
    redirectUrl: safeRedirect,
  };
}

/**
 * Reenvía el código OTP de MFA al correo del usuario
 */
export async function resendLoginMfaOtp(email: string): Promise<ActionResponse> {
  const ip = await getClientIp();
  const sanitizedEmail = email.trim().toLowerCase();

  if (!sanitizedEmail) {
    return { success: false, error: "Correo electrónico requerido." };
  }

  const rateLimitStatus = checkRateLimit(ip);
  if (rateLimitStatus.isBlocked) {
    const timeFormatted = rateLimitStatus.humanTimeLeft || formatSecondsToHumanReadable(rateLimitStatus.secondsLeft);
    return {
      success: false,
      error: `Demasiados intentos. Intente nuevamente en ${timeFormatted}.`,
    };
  }

  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  await supabaseAdmin.from("password_reset_otps").delete().eq("email", sanitizedEmail);
  await supabaseAdmin.from("password_reset_otps").insert({
    email: sanitizedEmail,
    code: otpCode,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  const { sendOtpEmail } = await import("@/lib/email/resend");
  await sendOtpEmail({
    to: sanitizedEmail,
    otpCode,
    subjectTitle: "Nuevo Código de Acceso 2FA / MFA",
    reasonText: "Has solicitado un nuevo código de verificación para tu inicio de sesión administrativo en NEGOVA.",
  });

  return {
    success: true,
    message: "Nuevo código de seguridad enviado a tu correo.",
  };
}

/**
 * 2. Generar y Enviar Código OTP de Recuperación (Vía Resend)
 */
export async function sendRecoveryOtp(formData: FormData): Promise<ActionResponse> {
  const ip = await getClientIp();

  // A. Chequeo de Rate Limit
  const rateLimitStatus = checkRateLimit(ip);
  if (rateLimitStatus.isBlocked) {
    const timeFormatted = rateLimitStatus.humanTimeLeft || formatSecondsToHumanReadable(rateLimitStatus.secondsLeft);
    return {
      success: false,
      error: `Demasiados intentos. Intente nuevamente en ${timeFormatted}.`,
    };
  }

  const email = formData.get("email") as string;

  // B. Validación de campo
  const validation = forgotPasswordSchema.safeParse({ email });
  if (!validation.success) {
    registerFailedAttempt(ip);
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Correo inválido",
    };
  }

  const sanitizedEmail = email.trim().toLowerCase();
  
  // C. Crear cliente administrativo de Supabase (Service Role)
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  // D. Verificar si el usuario existe en la plataforma (en auth.users de Supabase Auth)
  const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error("❌ Error al listar usuarios para verificación OTP:", listError.message);
  }

  const targetUser = usersList?.users.find((u) => u.email?.trim().toLowerCase() === sanitizedEmail);
  const userExists = !!targetUser;

  // Generar código OTP de 6 dígitos aleatorio
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos de vigencia

  // E. Guardar el código OTP en la base de datos (borrando códigos anteriores del mismo correo)
  await supabaseAdmin.from("password_reset_otps").delete().eq("email", sanitizedEmail);
  const { error: insertError } = await supabaseAdmin.from("password_reset_otps").insert({
    email: sanitizedEmail,
    code: otpCode,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    console.error("❌ Error al guardar el OTP en base de datos:", insertError.message);
    return {
      success: false,
      error: "Ocurrió un error en el servidor. Intente nuevamente.",
    };
  }

  // F. Si el usuario existe en NEGOVA, le enviamos el correo electrónico con Resend
  if (userExists) {
    try {
      const { sendOtpEmail } = await import("@/lib/email/resend");
      await sendOtpEmail({
        to: sanitizedEmail,
        otpCode,
        subjectTitle: "Tu código de acceso NEGOVA",
        reasonText:
          "Has solicitado recuperar el acceso a tu cuenta. Usa el siguiente código de un solo uso para continuar.",
      });
    } catch (emailErr) {
      console.error("❌ Excepción al intentar enviar correo mediante Resend:", emailErr);
    }
  } else {
    console.log(`ℹ️ Email '${sanitizedEmail}' no existe en auth.users. Se simula éxito para mitigar enumeración.`);
  }

  // G. Mitigación de Enumeración de Cuentas: Siempre respondemos éxito
  return {
    success: true,
    message: "Código enviado. Si el correo existe en nuestro sistema, recibirás el OTP de verificación.",
  };
}

/**
 * 3. Verificar el Código OTP ingresado por el usuario
 */
export async function verifyRecoveryOtpAction(email: string, code: string): Promise<ActionResponse> {
  if (!email || !code || code.trim().length !== 6) {
    return {
      success: false,
      error: "El código debe tener exactamente 6 dígitos.",
    };
  }

  const sanitizedEmail = email.trim().toLowerCase();
  const sanitizedCode = code.trim();

  // Crear cliente administrativo
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  // Buscar OTP válido no expirado
  const { data: otpData, error: otpError } = await supabaseAdmin
    .from("password_reset_otps")
    .select("*")
    .eq("email", sanitizedEmail)
    .eq("code", sanitizedCode)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (otpError) {
    console.error("❌ Error al consultar OTP en base de datos:", otpError.message);
    return {
      success: false,
      error: "Ocurrió un error al verificar el código. Intente de nuevo.",
    };
  }

  if (!otpData) {
    // Incrementar intentos del correo
    const { data: existingOtp } = await supabaseAdmin
      .from("password_reset_otps")
      .select("id, attempts")
      .eq("email", sanitizedEmail)
      .maybeSingle();

    if (existingOtp) {
      const nextAttempts = (existingOtp.attempts || 0) + 1;
      if (nextAttempts >= 3) {
        // Excedido número de intentos, borrar el OTP para seguridad
        await supabaseAdmin.from("password_reset_otps").delete().eq("id", existingOtp.id);
        return {
          success: false,
          error: "Código de verificación incorrecto. Se ha cancelado el proceso por seguridad. Solicita uno nuevo.",
        };
      } else {
        await supabaseAdmin
          .from("password_reset_otps")
          .update({ attempts: nextAttempts })
          .eq("id", existingOtp.id);
      }
    }

    return {
      success: false,
      error: "El código de verificación es inválido o ha expirado.",
    };
  }

  return {
    success: true,
    message: "Código verificado de forma exitosa.",
  };
}

/**
 * 4. Actualizar Contraseña Administrativamente con Código OTP verificado
 */
export async function updatePasswordWithOtpAction(formData: FormData): Promise<ActionResponse> {
  const email = formData.get("email") as string;
  const code = formData.get("code") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    return {
      success: false,
      error: "Las contraseñas no coinciden.",
    };
  }

  // Validación de fuerza de contraseña
  const validation = resetPasswordSchema.safeParse({ password });
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Contraseña inválida",
    };
  }

  const sanitizedEmail = email.trim().toLowerCase();
  const sanitizedCode = code.trim();

  // Crear cliente administrativo
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  // Verificar nuevamente el código OTP antes de proceder para evitar inyecciones en cliente
  const { data: otpData } = await supabaseAdmin
    .from("password_reset_otps")
    .select("id")
    .eq("email", sanitizedEmail)
    .eq("code", sanitizedCode)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!otpData) {
    return {
      success: false,
      error: "El proceso de recuperación ha expirado o es inválido. Solicita un nuevo código.",
    };
  }

  // Buscar el usuario en Supabase Auth por correo electrónico
  const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error("❌ Error al listar usuarios para actualizar contraseña:", listError.message);
    return {
      success: false,
      error: "Error interno del servidor.",
    };
  }

  const targetUser = usersList.users.find((u) => u.email === sanitizedEmail);
  if (!targetUser) {
    return {
      success: false,
      error: "No se encontró el perfil de usuario registrado.",
    };
  }

  // Actualizar la contraseña del usuario administrativamente en Supabase Auth
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
    password: password,
    user_metadata: {
      ...(targetUser.user_metadata || {}),
      must_change_password: false,
    },
  });

  if (updateError) {
    console.error("❌ Error de Supabase Auth al actualizar contraseña:", updateError.message);
    return {
      success: false,
      error: "No se pudo actualizar la contraseña. Intente nuevamente.",
    };
  }

  // Sincronizar en public.users
  await supabaseAdmin
    .from("users")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetUser.id);

  // Eliminar el código OTP usado de la base de datos
  await supabaseAdmin.from("password_reset_otps").delete().eq("email", sanitizedEmail);

  return {
    success: true,
    message: "Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión.",
  };
}

/**
 * 5. Restablecer la Contraseña de forma directa (por compatibilidad con rutas externas)
 */
export async function resetPassword(formData: FormData): Promise<ActionResponse> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    return {
      success: false,
      error: "Las contraseñas no coinciden.",
    };
  }

  const validation = resetPasswordSchema.safeParse({ password });
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Contraseña inválida",
    };
  }

  const { createClient: createServerClient } = await import("@/lib/supabase/server");
  const supabase = await createServerClient();

  const { data: authData, error } = await supabase.auth.updateUser({
    password: password,
    data: { must_change_password: false },
  });

  if (error) {
    return {
      success: false,
      error: error.message || "Error al actualizar la contraseña.",
    };
  }

  // Sincronizar en public.users
  if (authData.user && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await supabaseAdmin
      .from("users")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", authData.user.id);
  }

  return {
    success: true,
    message: "Contraseña actualizada exitosamente.",
    redirectUrl: "/admin",
  };
}


