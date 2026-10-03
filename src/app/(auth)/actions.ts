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

  // E. Verificar si la política de MFA para Staff / Administradores está activa
  const isStaffOrAdmin = userPlatformRole === "super_admin" || userPlatformRole === "admin" || userPlatformRole === "staff";
  
  if (isStaffOrAdmin) {
    // Leer configuración de la plataforma
    let requireMfa = true;
    try {
      const { data: configRow } = await supabaseAdmin
        .from("platform_settings")
        .select("config_json")
        .eq("id", "core_config")
        .maybeSingle();

      if (configRow?.config_json?.seguridad) {
        requireMfa = configRow.config_json.seguridad.requireMfaForStaff ?? true;
      }
    } catch {
      // Si la tabla no existe en local, se asume activo por seguridad
      requireMfa = true;
    }

    if (requireMfa) {
      // Generar código OTP de 6 dígitos
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Limpiar códigos OTP anteriores para este correo
      await supabaseAdmin.from("password_reset_otps").delete().eq("email", sanitizedEmail);

      // Guardar el código OTP con 10 minutos de expiración
      await supabaseAdmin.from("password_reset_otps").insert({
        email: sanitizedEmail,
        code: otpCode,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      // Enviar correo vía Resend
      const { sendOtpEmail } = await import("@/lib/email/resend");
      await sendOtpEmail({
        to: sanitizedEmail,
        otpCode,
        subjectTitle: "Código de Acceso de Doble Factor (MFA / 2FA)",
        reasonText: "Tu contraseña ha sido validada. Como medida de seguridad de acceso al panel administrativo de NEGOVA, ingresa el siguiente código de 6 dígitos para completar el inicio de sesión.",
      });

      // Desautenticar temporalmente para exigir la verificación del código
      await supabase.auth.signOut();

      return {
        success: true,
        requiresMfa: true,
        mfaEmail: sanitizedEmail,
        message: "Código de seguridad de 6 dígitos enviado a tu correo.",
      };
    }
  }

  // F. Limpiar Historial de Intentos Fallidos tras Éxito directo
  await clearLoginSecurity(sanitizedEmail, ip);

  // G. Redirección con retorno seguro
  const rawRedirect = (formData.get("redirectTo") as string) || "";
  const safeRedirect = rawRedirect.startsWith("/")
    ? rawRedirect
    : isStaffOrAdmin
    ? "/admin"
    : "/dashboard";

  return {
    success: true,
    message: "Inicio de sesión exitoso",
    redirectUrl: safeRedirect,
  };
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
    return {
      success: false,
      error: "El código ingresado es incorrecto. Verifícalo e intenta nuevamente.",
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

  // Limpiar historial de seguridad de login
  await clearLoginSecurity(sanitizedEmail, ip);

  // Registrar auditoría
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: authData.user.id,
      user_email: sanitizedEmail,
      action: "mfa_login_success",
      resource_type: "auth",
      resource_id: authData.user.id,
      details: {
        ip,
        timestamp: new Date().toISOString(),
        authMethod: "password_mfa_otp",
      },
    });
  } catch {
    // Continuar si la tabla audit_logs no está disponible
  }

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
  const safeRedirect = mustChangePassword
    ? "/reset-password"
    : rawRedirect.startsWith("/")
    ? rawRedirect
    : isStaffOrAdmin
    ? "/admin"
    : "/dashboard";

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


