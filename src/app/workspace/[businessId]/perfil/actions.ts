"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { logAuditAction } from "@/lib/audit/audit-service";

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
 * 1. ACTUALIZAR PERFIL EN CONTEXTO WORKSPACE
 */
export async function updateWorkspaceProfile(
  businessId: string,
  formData: FormData
): Promise<ProfileActionResponse> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "none");
    if (!auth.success || !auth.context) {
      return {
        success: false,
        error: auth.error || "No autorizado para actualizar el perfil en este comercio.",
      };
    }

    const userId = auth.context.userId;

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

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Obtener datos actuales de perfil
    const { data: currentProfile, error: fetchProfileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone, bio, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (fetchProfileError) {
      console.error("[Workspace Perfil] Error al consultar perfil previo:", fetchProfileError);
    }

    let finalAvatarUrl: string | null = currentProfile?.avatar_url || null;

    // Subida o eliminación de imagen
    if (avatarFile && avatarFile.size > 0 && typeof avatarFile.arrayBuffer === "function") {
      const { uploadUserAvatarFile } = await import("@/lib/storage/supabase-storage");
      const uploadResult = await uploadUserAvatarFile(
        supabaseAdmin,
        userId,
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
      const { deleteUserAvatarFiles } = await import("@/lib/storage/supabase-storage");
      await deleteUserAvatarFiles(supabaseAdmin, userId, currentProfile?.avatar_url);
      finalAvatarUrl = null;
    }

    // 1. Guardar en public.profiles
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName,
        phone: phone || null,
        bio: bio || null,
        avatar_url: finalAvatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error("[Workspace Perfil] Error al actualizar perfil en profiles:", profileError);
      return {
        success: false,
        error: "No fue posible actualizar la información del perfil.",
      };
    }

    // 2. Sincronizar timestamp en public.users
    await supabaseAdmin
      .from("users")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", userId);

    // 3. Sincronizar en auth.users metadata
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: fullName,
          avatar_url: finalAvatarUrl,
          phone: phone || null,
        },
      });
    } catch (authMetaErr) {
      console.warn("[Workspace Perfil] Aviso al sincronizar auth metadata:", authMetaErr);
    }

    // 4. Auditoría no bloqueante
    try {
      await logAuditAction({
        userId,
        businessId,
        action: "update",
        entityType: "profile",
        entityId: userId,
        oldData: {
          full_name: currentProfile?.full_name || null,
          phone: currentProfile?.phone || null,
          bio: currentProfile?.bio || null,
        },
        newData: {
          full_name: fullName,
          phone: phone || null,
          bio: bio || null,
        },
        metadata: {
          original_action: "update_workspace_profile",
          business_name: auth.context.businessName,
        },
      });

      if (finalAvatarUrl !== (currentProfile?.avatar_url || null)) {
        await logAuditAction({
          userId,
          businessId,
          action: "update",
          entityType: "profile",
          entityId: userId,
          metadata: {
            original_action: removeAvatar ? "delete_profile_avatar" : "update_profile_avatar",
          },
        });
      }
    } catch (auditErr) {
      console.error("[Workspace Perfil] Error no bloqueante al registrar auditoría:", auditErr);
    }

    revalidatePath(`/workspace/${businessId}/perfil`);
    revalidatePath(`/workspace/${businessId}`, "layout");

    return {
      success: true,
      message: removeAvatar
        ? "Foto de perfil eliminada. Se ha restablecido el avatar por defecto."
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
 * 2. SOLICITAR CÓDIGO OTP PARA CAMBIO DE CONTRASEÑA EN WORKSPACE
 */
export async function sendWorkspaceProfilePasswordOtp(
  businessId: string
): Promise<ProfileActionResponse> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "none");
    if (!auth.success || !auth.context) {
      return { success: false, error: "Sesión no válida o no autorizada." };
    }

    const sanitizedEmail = auth.context.userEmail.trim().toLowerCase();
    if (!sanitizedEmail) {
      return { success: false, error: "Correo electrónico no disponible en la sesión." };
    }

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await supabaseAdmin.from("password_reset_otps").delete().eq("email", sanitizedEmail);

    const { error: insertError } = await supabaseAdmin.from("password_reset_otps").insert({
      email: sanitizedEmail,
      code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error("[Workspace Perfil] Error al insertar OTP:", insertError);
      return {
        success: false,
        error: "No se pudo generar el código de seguridad. Intente nuevamente.",
      };
    }

    const { sendOtpEmail } = await import("@/lib/email/resend");
    const emailResult = await sendOtpEmail({
      to: sanitizedEmail,
      otpCode,
      subjectTitle: "Código de Autorización para Cambio de Contraseña",
      reasonText: `Has solicitado cambiar tu contraseña de acceso desde el Workspace de ${auth.context.businessName}. Introduce el siguiente código para verificar tu identidad.`,
    });

    if (!emailResult.success) {
      return {
        success: false,
        error: emailResult.error || "No se pudo enviar el correo de verificación.",
      };
    }

    return {
      success: true,
      message: `Código de verificación de 6 dígitos enviado exitosamente a ${sanitizedEmail}.`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Error al enviar el código de verificación.",
    };
  }
}

/**
 * 3. VALIDAR CÓDIGO OTP EN WORKSPACE
 */
export async function verifyWorkspaceProfilePasswordOtp(
  businessId: string,
  otpCode: string
): Promise<ProfileActionResponse> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "none");
    if (!auth.success || !auth.context) {
      return { success: false, error: "Sesión no válida o no autorizada." };
    }

    const sanitizedOtp = (otpCode || "").trim();
    if (!sanitizedOtp || sanitizedOtp.length !== 6) {
      return { success: false, error: "Debe ingresar el código completo de 6 dígitos." };
    }

    const sanitizedEmail = auth.context.userEmail.trim().toLowerCase();

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
        error: "No hay ningún código de seguridad activo. Solicite uno nuevo.",
      };
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return {
        success: false,
        error: "El código de verificación ha expirado. Solicite un nuevo código.",
      };
    }

    if (otpRecord.code !== sanitizedOtp) {
      const nextAttempts = (otpRecord.attempts || 0) + 1;
      if (nextAttempts >= 3) {
        await supabaseAdmin.from("password_reset_otps").delete().eq("id", otpRecord.id);
        return {
          success: false,
          error: "Código incorrecto. Límite de intentos superado. Solicite un nuevo código.",
        };
      } else {
        await supabaseAdmin
          .from("password_reset_otps")
          .update({ attempts: nextAttempts })
          .eq("id", otpRecord.id);
        return {
          success: false,
          error: `Código incorrecto. Intentos restantes: ${3 - nextAttempts}.`,
        };
      }
    }

    return {
      success: true,
      message: "¡Identidad verificada exitosamente! Puedes definir tu nueva contraseña.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Error al validar el código.",
    };
  }
}

/**
 * 4. ACTUALIZAR CONTRASEÑA EN WORKSPACE
 */
export async function updateWorkspaceProfilePassword(
  businessId: string,
  formData: FormData
): Promise<ProfileActionResponse> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "none");
    if (!auth.success || !auth.context) {
      return { success: false, error: "Sesión no válida o no autorizada." };
    }

    const userId = auth.context.userId;
    const userEmail = auth.context.userEmail;

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
    const sanitizedEmail = userEmail.trim().toLowerCase();

    if (!sanitizedOtp || sanitizedOtp.length !== 6) {
      return { success: false, error: "Debe incluir el código OTP verificado de 6 dígitos." };
    }

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Verificar OTP en DB
    const { data: otpRecord, error: otpFetchError } = await supabaseAdmin
      .from("password_reset_otps")
      .select("id, code, expires_at")
      .eq("email", sanitizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpFetchError || !otpRecord || otpRecord.code !== sanitizedOtp) {
      return { success: false, error: "Sesión de verificación inválida o código no coincide." };
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return { success: false, error: "El código de verificación ha expirado." };
    }

    // 2. Validar contraseña actual contra Supabase Auth
    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (verifyError) {
      return {
        success: false,
        error: "La contraseña actual es incorrecta. Verifíquela e intente nuevamente.",
      };
    }

    // 3. Actualizar contraseña en Auth
    const { error: adminUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
      user_metadata: {
        must_change_password: false,
      },
    });

    if (adminUpdateError) {
      console.error("[Workspace Perfil] Error al actualizar contraseña:", adminUpdateError);
      return { success: false, error: "No se pudo actualizar la contraseña. Intente de nuevo." };
    }

    // 4. Limpiar OTP
    await supabaseAdmin.from("password_reset_otps").delete().eq("email", sanitizedEmail);

    // 5. Auditoría
    try {
      await logAuditAction({
        userId,
        businessId,
        action: "update",
        entityType: "user_security",
        entityId: userId,
        metadata: {
          original_action: "change_workspace_user_password",
          business_name: auth.context.businessName,
        },
      });
    } catch (auditErr) {
      console.error("[Workspace Perfil] Error no bloqueante al auditar contraseña:", auditErr);
    }

    return {
      success: true,
      message: "Contraseña actualizada exitosamente.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Ocurrió un error inesperado al actualizar la contraseña.",
    };
  }
}
