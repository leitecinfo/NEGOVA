"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ProfileActionResponse = {
  success: boolean;
  message?: string;
  error?: string;
  avatarUrl?: string | null;
};

// Esquema de validación para información personal
const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(150, "El nombre no puede exceder 150 caracteres"),
  phone: z
    .string()
    .trim()
    .max(25, "El teléfono no puede exceder 25 caracteres")
    .optional()
    .or(z.literal("")),
  bio: z
    .string()
    .trim()
    .max(300, "La biografía no puede exceder 300 caracteres")
    .optional()
    .or(z.literal("")),
});

// Esquema de validación para contraseña
const passwordUpdateSchema = z
  .object({
    currentPassword: z.string().min(1, "Debe ingresar su contraseña actual"),
    newPassword: z
      .string()
      .min(10, "La nueva contraseña debe tener al menos 10 caracteres")
      .regex(/[A-Z]/, "Debe incluir al menos una letra mayúscula")
      .regex(/[a-z]/, "Debe incluir al menos una letra minúscula")
      .regex(/[0-9]/, "Debe incluir al menos un número")
      .regex(/[^A-Za-z0-9]/, "Debe incluir al menos un carácter especial (@, $, !, %, etc.)"),
    confirmPassword: z.string().min(1, "Confirme su nueva contraseña"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "La nueva contraseña no puede ser idéntica a su contraseña actual",
    path: ["newPassword"],
  });

/**
 * Actualiza la información personal del perfil administrativo
 * y gestiona la subida de imagen de avatar a Supabase Storage
 */
export async function updateAdminProfile(formData: FormData): Promise<ProfileActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "Sesión no válida. Por favor, vuelva a iniciar sesión.",
      };
    }

    const rawData = {
      fullName: (formData.get("fullName") as string) || "",
      phone: (formData.get("phone") as string) || "",
      bio: (formData.get("bio") as string) || "",
    };

    const validation = profileUpdateSchema.safeParse(rawData);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Datos del perfil no válidos.",
      };
    }

    const { fullName, phone, bio } = validation.data;
    const avatarFile = formData.get("avatarFile") as File | null;
    const removeAvatar = formData.get("removeAvatar") === "true";

    // Cliente Admin para interactuar con Storage y bupasar RLS de perfiles
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Obtener avatar actual para conservar si no se subió uno nuevo ni se borró
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    let finalAvatarUrl: string | null = currentProfile?.avatar_url || null;

    // A. Subir nuevo archivo a Supabase Storage si fue proporcionado
    if (avatarFile && avatarFile.size > 0 && typeof avatarFile.arrayBuffer === "function") {
      const { uploadUserAvatarFile } = await import("@/lib/storage/supabase-storage");
      const uploadResult = await uploadUserAvatarFile(
        supabaseAdmin,
        user.id,
        avatarFile,
        currentProfile?.avatar_url
      );

      if (uploadResult.error || !uploadResult.url) {
        return {
          success: false,
          error: uploadResult.error || "No se pudo subir la imagen al almacenamiento.",
        };
      }

      finalAvatarUrl = uploadResult.url;
    } else if (removeAvatar) {
      // B. Eliminar imagen existente físicamente de Storage
      const { deleteUserAvatarFiles } = await import("@/lib/storage/supabase-storage");
      await deleteUserAvatarFiles(supabaseAdmin, user.id, currentProfile?.avatar_url);
      finalAvatarUrl = null;
    }

    // 1. Guardar en public.profiles (actualizando o eliminando la URL)
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: user.id,
        full_name: fullName,
        phone: phone || null,
        bio: bio || null,
        avatar_url: finalAvatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profileError) {
      return {
        success: false,
        error: `Error al guardar en perfiles: ${profileError.message}`,
      };
    }

    // 2. Sincronizar en public.users
    await supabaseAdmin
      .from("users")
      .update({
        full_name: fullName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // 3. Sincronizar en auth.users metadata
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          full_name: fullName,
          avatar_url: finalAvatarUrl,
        },
      });
    } catch (authMetaErr) {
      console.warn("Aviso al sincronizar metadata de autenticación:", authMetaErr);
    }

    // Revalidar rutas administrativas para reflejar el nuevo nombre/avatar en tiempo real
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/perfil");

    return {
      success: true,
      message: removeAvatar
        ? "Foto de perfil eliminada correctamente. Se ha restablecido el avatar por defecto."
        : "Perfil actualizado correctamente.",
      avatarUrl: finalAvatarUrl,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Ocurrió un error inesperado al actualizar el perfil.",
    };
  }
}

/**
 * Envía un código OTP de verificación por correo para autorizar el cambio de contraseña
 */
export async function sendProfilePasswordOtp(): Promise<ProfileActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return {
        success: false,
        error: "Sesión no válida. Por favor, vuelva a iniciar sesión.",
      };
    }

    const sanitizedEmail = user.email.trim().toLowerCase();

    // Cliente administrativo
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Generar código OTP de 6 dígitos aleatorio
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos de vigencia

    // Guardar en public.password_reset_otps
    await supabaseAdmin.from("password_reset_otps").delete().eq("email", sanitizedEmail);
    const { error: insertError } = await supabaseAdmin.from("password_reset_otps").insert({
      email: sanitizedEmail,
      code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      return {
        success: false,
        error: "No se pudo registrar el código de seguridad. Intente nuevamente.",
      };
    }

    // Enviar correo con Resend (redirigiendo a leitec.info@gmail.com en desarrollo)
    const { sendOtpEmail } = await import("@/lib/email/resend");
    const emailResult = await sendOtpEmail({
      to: sanitizedEmail,
      otpCode,
      subjectTitle: "Código de Autorización para Cambio de Contraseña",
      reasonText:
        "Has solicitado cambiar tu clave de acceso en el panel administrativo de NEGOVA. Introduce el siguiente código de seguridad para verificar tu identidad y aplicar la nueva contraseña.",
    });

    if (!emailResult.success) {
      return {
        success: false,
        error: emailResult.error || "No se pudo enviar el correo con el código.",
      };
    }

    return {
      success: true,
      message: "Código de verificación de 6 dígitos enviado exitosamente a tu correo.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Ocurrió un error inesperado al enviar el código de verificación.",
    };
  }
}

/**
 * Valida el código OTP de verificación antes de permitir definir la nueva contraseña
 */
export async function verifyProfilePasswordOtp(otpCode: string): Promise<ProfileActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return {
        success: false,
        error: "Sesión no válida. Por favor, vuelva a iniciar sesión.",
      };
    }

    const sanitizedOtp = (otpCode || "").trim();
    if (!sanitizedOtp || sanitizedOtp.length !== 6) {
      return {
        success: false,
        error: "Debe ingresar el código de verificación completo de 6 dígitos.",
      };
    }

    const sanitizedEmail = user.email.trim().toLowerCase();

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: otpRecord, error: dbError } = await supabaseAdmin
      .from("password_reset_otps")
      .select("id, code, expires_at, attempts")
      .eq("email", sanitizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbError || !otpRecord) {
      return {
        success: false,
        error: "No se encontró ningún código de seguridad activo. Por favor solicita uno nuevo.",
      };
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return {
        success: false,
        error: "El código de verificación ha expirado. Por favor solicita un nuevo código.",
      };
    }

    if (otpRecord.code !== sanitizedOtp) {
      const nextAttempts = (otpRecord.attempts || 0) + 1;
      if (nextAttempts >= 3) {
        await supabaseAdmin.from("password_reset_otps").delete().eq("id", otpRecord.id);
        return {
          success: false,
          error: "Código incorrecto. Se superó el límite de intentos permitidos. Solicite un nuevo código.",
        };
      } else {
        await supabaseAdmin
          .from("password_reset_otps")
          .update({ attempts: nextAttempts })
          .eq("id", otpRecord.id);
        return {
          success: false,
          error: `El código ingresado es incorrecto. Intentos restantes: ${3 - nextAttempts}.`,
        };
      }
    }

    return {
      success: true,
      message: "¡Identidad verificada exitosamente! Ahora puedes definir tu nueva contraseña.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Ocurrió un error inesperado al validar el código.",
    };
  }
}

/**
 * Actualiza la contraseña del usuario tras validar su código OTP previamente verificado
 */
export async function updateAdminPassword(formData: FormData): Promise<ProfileActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return {
        success: false,
        error: "Sesión no válida. Por favor, vuelva a iniciar sesión.",
      };
    }

    const rawData = {
      currentPassword: (formData.get("currentPassword") as string) || "",
      newPassword: (formData.get("newPassword") as string) || "",
      confirmPassword: (formData.get("confirmPassword") as string) || "",
      otpCode: (formData.get("otpCode") as string) || "",
    };

    const validation = passwordUpdateSchema.safeParse(rawData);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Datos de contraseña no válidos.",
      };
    }

    const { currentPassword, newPassword } = validation.data;
    const sanitizedOtp = rawData.otpCode.trim();
    const sanitizedEmail = user.email.trim().toLowerCase();

    if (!sanitizedOtp || sanitizedOtp.length !== 6) {
      return {
        success: false,
        error: "Debe incluir el código OTP verificado de 6 dígitos.",
      };
    }

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Verificar el código OTP en la base de datos
    const { data: otpRecord } = await supabaseAdmin
      .from("password_reset_otps")
      .select("id, code, expires_at")
      .eq("email", sanitizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      return {
        success: false,
        error: "No hay sesión de verificación activa. Por favor solicite y valide un nuevo código.",
      };
    }

    if (otpRecord.code !== sanitizedOtp) {
      return {
        success: false,
        error: "El código de verificación no coincide.",
      };
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return {
        success: false,
        error: "El código de verificación ha expirado. Solicite uno nuevo.",
      };
    }

    // 2. Validar obligatoriamente la contraseña actual contra Supabase Auth
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      return {
        success: false,
        error: "La contraseña actual es incorrecta. Verifíquela e intente nuevamente.",
      };
    }

    // 3. Actualizar la contraseña en Supabase Auth
    const { error: adminUpdateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
      user_metadata: {
        ...(user.user_metadata || {}),
        must_change_password: false,
      },
    });

    if (adminUpdateError) {
      return {
        success: false,
        error: adminUpdateError.message || "No se pudo actualizar la contraseña. Intente nuevamente.",
      };
    }

    // 4. Sincronizar en public.users
    await supabaseAdmin
      .from("users")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    await supabase.auth.updateUser({ password: newPassword }).catch(() => {});

    // 5. Limpiar el OTP usado
    await supabaseAdmin
      .from("password_reset_otps")
      .delete()
      .eq("email", sanitizedEmail);

    return {
      success: true,
      message: "Contraseña actualizada exitosamente. Tu nueva clave está activa.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Ocurrió un error inesperado al actualizar la contraseña.",
    };
  }
}
