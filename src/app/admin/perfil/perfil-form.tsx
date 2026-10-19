"use client";

import React, { useState, useRef, useTransition } from "react";
import {
  User,
  Mail,
  Phone,
  FileText,
  Shield,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Save,
  Camera,
  Calendar,
  Check,
  UploadCloud,
  Trash2,
  Image as ImageIcon,
  Send,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  updateAdminProfile,
  updateAdminPassword,
  sendProfilePasswordOtp,
  verifyProfilePasswordOtp,
} from "./actions";

interface AdminPerfilFormProps {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    phone: string | null;
    bio: string | null;
    role: string;
    status: string;
    createdAt?: string;
  };
}

export function AdminPerfilForm({ user }: AdminPerfilFormProps) {
  const [activeTab, setActiveTab] = useState<"general" | "seguridad">("general");

  // Estado del formulario de perfil
  const [fullName, setFullName] = useState(user.fullName || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [bio, setBio] = useState(user.bio || "");

  // Manejo de archivo de imagen con Supabase Storage
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.avatarUrl || null);
  const [shouldRemoveAvatar, setShouldRemoveAvatar] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPendingProfile, startProfileTransition] = useTransition();

  // Flujo por Pasos de Seguridad: Paso 1 (Validar Identidad) -> Paso 2 (Cambiar Contraseña)
  const [securityStep, setSecurityStep] = useState<"verify" | "change">("verify");
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  const [verifiedOtpCode, setVerifiedOtpCode] = useState("");

  // Estado del formulario de contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPendingPassword, startPasswordTransition] = useTransition();

  // Estados para validación de OTP por correo
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isPendingOtp, startOtpTransition] = useTransition();
  const [isPendingVerifyOtp, startVerifyOtpTransition] = useTransition();

  // Temporizador para reenvío de código
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Validación de reglas de contraseña en vivo
  const passwordRules = [
    { label: "Mínimo 10 caracteres", valid: newPassword.length >= 10 },
    { label: "Una letra mayúscula", valid: /[A-Z]/.test(newPassword) },
    { label: "Una letra minúscula", valid: /[a-z]/.test(newPassword) },
    { label: "Un número (0-9)", valid: /[0-9]/.test(newPassword) },
    { label: "Un carácter especial (!@#$%...)", valid: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const allRulesPassed = passwordRules.every((rule) => rule.valid);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Manejador de selección de archivo de imagen
  const handleFileChange = (file: File) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato no compatible", {
        description: "Por favor seleccione una imagen en formato JPG, PNG, WEBP o GIF.",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Archivo muy pesado", {
        description: "El tamaño máximo permitido para la foto de perfil es de 5MB.",
      });
      return;
    }

    setSelectedFile(file);
    setShouldRemoveAvatar(false);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    toast.info("Foto cargada", {
      description: "Recuerda presionar 'Guardar Cambios' para aplicar la nueva foto.",
    });
  };

  // Restablecer al avatar automático de Avvvatars
  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setShouldRemoveAvatar(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.info("Modo Avvvatars activado", {
      description: "Se usará tu avatar geométrico único. Guarda los cambios para confirmar.",
    });
  };

  // Guardar datos de perfil y subir a Supabase Storage
  const handleSaveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("fullName", fullName);
    formData.append("phone", phone);
    formData.append("bio", bio);

    if (selectedFile) {
      formData.append("avatarFile", selectedFile);
    } else if (shouldRemoveAvatar) {
      formData.append("removeAvatar", "true");
    }

    startProfileTransition(async () => {
      const res = await updateAdminProfile(formData);
      if (res.success) {
        toast.success("¡Perfil guardado con éxito!", {
          description: selectedFile
            ? "Tu foto de perfil ha sido actualizada con éxito."
            : "Tus datos personales han sido actualizados.",
        });
        if (res.avatarUrl !== undefined) {
          setPreviewUrl(res.avatarUrl);
        }
        setSelectedFile(null);
        setShouldRemoveAvatar(false);
      } else {
        toast.error("Error al actualizar perfil", {
          description: res.error || "No se pudieron guardar los cambios.",
        });
      }
    });
  };

  // 1. Solicitar código OTP al correo (sin pedir contraseñas todavía)
  const handleRequestOtp = () => {
    startOtpTransition(async () => {
      const res = await sendProfilePasswordOtp();
      if (res.success) {
        setOtpSent(true);
        setResendCooldown(60);
        toast.success("¡Código de seguridad enviado!", {
          description: `Hemos enviado el código de 6 dígitos a tu correo (${user.email}).`,
        });
      } else {
        toast.error("No se pudo enviar el código", {
          description: res.error || "Intente nuevamente en unos instantes.",
        });
      }
    });
  };

  // 2. Validar código OTP para autorizar el cambio de clave
  const handleVerifyOtp = () => {
    if (!otpCode || otpCode.trim().length !== 6) {
      toast.error("Código incompleto", {
        description: "Por favor ingrese el código de 6 dígitos enviado a su correo.",
      });
      return;
    }

    startVerifyOtpTransition(async () => {
      const res = await verifyProfilePasswordOtp(otpCode.trim());
      if (res.success) {
        setIsIdentityVerified(true);
        setVerifiedOtpCode(otpCode.trim());
        setSecurityStep("change");
        toast.success("¡Identidad verificada con éxito!", {
          description: "Ahora puedes configurar y guardar tu nueva contraseña.",
        });
      } else {
        toast.error("Validación fallida", {
          description: res.error || "El código ingresado es incorrecto o ha expirado.",
        });
      }
    });
  };

  // 3. Guardar nueva contraseña tras haber validado identidad
  const handleSavePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isIdentityVerified || !verifiedOtpCode) {
      toast.error("Validación requerida", {
        description: "Primero debes validar el código de seguridad enviado a tu correo.",
      });
      setSecurityStep("verify");
      return;
    }

    if (!currentPassword || currentPassword.trim().length === 0) {
      toast.error("Contraseña actual requerida", {
        description: "Por favor ingresa tu contraseña actual para autorizar el cambio.",
      });
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("Contraseña idéntica", {
        description: "La nueva contraseña no puede ser igual a tu contraseña actual.",
      });
      return;
    }

    if (!allRulesPassed) {
      toast.error("Contraseña incompleta", {
        description: "Por favor cumpla con todas las reglas de complejidad requeridas.",
      });
      return;
    }

    if (!passwordsMatch) {
      toast.error("Las contraseñas no coinciden", {
        description: "Verifique que la confirmación de contraseña sea idéntica.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("currentPassword", currentPassword);
    formData.append("newPassword", newPassword);
    formData.append("confirmPassword", confirmPassword);
    formData.append("otpCode", verifiedOtpCode);

    startPasswordTransition(async () => {
      const res = await updateAdminPassword(formData);
      if (res.success) {
        toast.success("¡Contraseña actualizada con éxito!", {
          description: "Tu clave de acceso ha sido cambiada y protegida.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setOtpCode("");
        setVerifiedOtpCode("");
        setOtpSent(false);
        setIsIdentityVerified(false);
        setSecurityStep("verify");
      } else {
        toast.error("Error al actualizar contraseña", {
          description: res.error || "No se pudo actualizar la contraseña.",
        });
      }
    });
  };

  // 4. Reiniciar flujo de verificación
  const handleResetVerification = () => {
    setSecurityStep("verify");
    setIsIdentityVerified(false);
    setVerifiedOtpCode("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const roleLabel = user.role === "super_admin" ? "Super Administrador" : "Administrador";
  const formattedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Activo";

  return (
    <div className="space-y-6">
      {/* Input de archivo oculto para la cámara del Hero */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileChange(file);
        }}
      />

      {/* 1. Tarjeta Hero de Perfil */}
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        {/* Fondo decorativo con gradiente */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar principal interactivo */}
          <div className="relative group">
            <UserAvatar
              src={previewUrl}
              value={user.email}
              name={fullName || user.email}
              size={92}
              radius={24}
              style="shape"
              className="ring-4 ring-orange-500/20 shadow-md transition-transform duration-300 group-hover:scale-105"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Haga clic para subir una foto desde su dispositivo"
              className="absolute -bottom-1 -right-1 p-2.5 rounded-xl bg-[#ED500A] text-white hover:bg-[#d44508] shadow-md transition-transform active:scale-95 flex items-center justify-center cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Información y Badges */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h2 className="text-xl sm:text-2xl font-bold font-title text-slate-900 dark:text-white">
                {fullName || "Usuario Administrador"}
              </h2>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 dark:bg-[#ED500A]/10 border border-orange-200 dark:border-[#ED500A]/20 text-[#ED500A] text-xs font-mono font-medium self-center sm:self-auto">
                <Shield className="w-3.5 h-3.5" />
                <span>{roleLabel}</span>
              </div>
            </div>

            <p className="text-sm font-mono text-slate-500 dark:text-slate-400">
              {user.email}
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Estado: <strong className="text-slate-700 dark:text-slate-200 capitalize">{user.status}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Miembro desde: <strong className="text-slate-700 dark:text-slate-200">{formattedDate}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Pestañas de Navegación */}
        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === "general"
                ? "bg-[#ED500A] text-white shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Datos Personales</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("seguridad")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === "seguridad"
                ? "bg-[#ED500A] text-white shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Seguridad & Clave</span>
          </button>
        </div>
      </div>

      {/* 3. Contenido de la Pestaña: DATOS PERSONALES */}
      {activeTab === "general" && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                Información de Identidad
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Actualice su nombre público, datos de contacto y gestione su foto de perfil.
              </p>
            </div>

            {/* ZONA DE SUBIDA DE IMAGEN DE AVATAR */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Foto de Perfil</span>
                {previewUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-[11px] font-mono text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Quitar foto y usar Avvvatars</span>
                  </button>
                )}
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileChange(file);
                }}
                className={`p-4 sm:p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col sm:flex-row items-center gap-4 ${
                  isDragging
                    ? "border-[#ED500A] bg-orange-500/5 dark:bg-orange-500/10"
                    : "border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]"
                }`}
              >
                {/* Miniatura actual */}
                <div className="shrink-0">
                  <UserAvatar
                    src={previewUrl}
                    value={user.email}
                    name={fullName || user.email}
                    size={64}
                    radius={16}
                    style="shape"
                    className="shadow-sm ring-2 ring-slate-200 dark:ring-white/10"
                  />
                </div>

                {/* Explicación y acciones */}
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-white">
                      {selectedFile
                        ? `Archivo seleccionado: ${selectedFile.name}`
                        : previewUrl
                        ? "Foto personalizada activa"
                        : "Avatar geométrico de Avvvatars"}
                    </span>
                    {selectedFile && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        {(selectedFile.size / 1024).toFixed(1)} KB (Listo para guardar)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Arrastra una imagen aquí o haz clic en el botón. Formatos admitidos: JPG, PNG, WEBP o GIF (Máx. 5MB).
                  </p>
                </div>

                {/* Botones de acción */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-xs font-semibold text-slate-800 dark:text-white transition-all active:scale-95 cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-[#ED500A]" />
                    <span>{previewUrl ? "Cambiar foto" : "Subir foto"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* Nombre Completo */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nombre Completo <span className="text-[#ED500A]">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: Laura Gómez"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all font-body"
                  />
                </div>
              </div>

              {/* Correo Electrónico (Protegido) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Correo Electrónico
                  </label>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verificado
                  </span>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.04] text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  El correo principal está protegido y no puede ser modificado directamente.
                </p>
              </div>

              {/* Teléfono */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Teléfono / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+57 300 123 4567"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all font-body"
                  />
                </div>
              </div>

              {/* Estado de Cuenta */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Estado de Cuenta
                </label>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-100/60 dark:bg-white/[0.03] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 capitalize">
                      {user.status}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    Rol: {roleLabel}
                  </span>
                </div>
              </div>

              {/* Biografía / Notas */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Biografía / Rol interno
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Escriba una breve descripción sobre sus funciones o responsabilidades en la plataforma..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all font-body resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Botón Guardar */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isPendingProfile}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#d44508] text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isPendingProfile ? "Guardando cambios..." : "Guardar Cambios"}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 4. Contenido de la Pestaña: SEGURIDAD & CONTRASEÑA (FLUJO SECUENCIAL 2 PASOS) */}
      {activeTab === "seguridad" && (
        <div className="space-y-6">
          {/* Stepper Header Visual */}
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Paso 1 */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold font-mono transition-all ${
                    isIdentityVerified
                      ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                      : securityStep === "verify"
                      ? "bg-[#ED500A] text-white shadow-sm shadow-[#ED500A]/30"
                      : "bg-slate-100 dark:bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {isIdentityVerified ? <CheckCircle2 className="w-4 h-4" /> : "1"}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white font-title">
                    Paso 1: Validar Identidad
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isIdentityVerified ? "Verificación completada con éxito" : "Código OTP de 6 dígitos a su correo"}
                  </p>
                </div>
              </div>

              {/* Indicador de unión */}
              <div className="hidden sm:block flex-1 max-w-[80px] h-[1px] bg-slate-200 dark:bg-white/10" />

              {/* Paso 2 */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold font-mono transition-all ${
                    securityStep === "change"
                      ? "bg-[#ED500A] text-white shadow-sm shadow-[#ED500A]/30"
                      : "bg-slate-100 dark:bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {securityStep === "change" ? <KeyRound className="w-4 h-4" /> : <Lock className="w-4 h-4 text-slate-400" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white font-title">
                    Paso 2: Cambiar Contraseña
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {securityStep === "change" ? "Defina y confirme su nueva clave" : "Requiere validación previa del correo"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* PASO 1: VALIDACIÓN DE IDENTIDAD POR CORREO */}
          {securityStep === "verify" && (
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-orange-50 dark:bg-[#ED500A]/10 text-[#ED500A] shrink-0 border border-orange-200/60 dark:border-[#ED500A]/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                    Paso 1: Validación de Seguridad Obligatoria
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Por políticas de protección de la plataforma NEGOVA, antes de modificar tu contraseña debes validar tu identidad.
                    Te enviaremos un código temporal de 6 dígitos a tu correo registrado.
                  </p>
                </div>
              </div>

              {/* Tarjeta de Correo Destino */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                      Correo Electrónico Registrado
                    </span>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Destino: {user.email}
                  </span>
                </div>
              </div>

              {/* Botón de Enviar Código (si aún no se ha enviado) */}
              {!otpSent ? (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-white/[0.06]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Haz clic en el botón para generar y recibir tu código de validación.
                  </p>
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={isPendingOtp}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#d44508] text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isPendingOtp ? "Enviando código..." : "Enviar Código de Verificación al Correo"}</span>
                  </button>
                </div>
              ) : (
                /* Bloque de Introducción y Validación de Código OTP */
                <div className="pt-2 space-y-5 border-t border-slate-100 dark:border-white/[0.06] animate-in fade-in duration-200">
                  <div className="p-5 rounded-2xl bg-orange-50/70 dark:bg-[#ED500A]/10 border border-orange-200/80 dark:border-[#ED500A]/30 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white font-title flex items-center gap-2">
                          <span>Introduce el Código de 6 Dígitos</span>
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-body">
                          Revisa tu bandeja de entrada o spam. El código es válido por 10 minutos.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={resendCooldown > 0 || isPendingOtp}
                        className="text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-[#ED500A] dark:hover:text-[#ED500A] flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPendingOtp ? "animate-spin" : ""}`} />
                        <span>{resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Reenviar código"}</span>
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <input
                        type="text"
                        maxLength={6}
                        autoFocus
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        className="w-full sm:w-64 text-center text-2xl font-bold tracking-[10px] font-mono py-3 px-4 rounded-xl border border-orange-300 dark:border-orange-500/30 bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
                      />

                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isPendingVerifyOtp || otpCode.trim().length !== 6}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#ED500A] hover:bg-[#d44508] text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isPendingVerifyOtp ? "Validando..." : "Validar Código y Continuar"}</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 2: CAMBIAR CONTRASEÑA (SOLO TRAS HABER VALIDADO LA IDENTIDAD) */}
          {securityStep === "change" && (
            <form onSubmit={handleSavePassword} className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                {/* Banner de Verificación Exitosa */}
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 font-title">
                        Identidad Verificada Correctamente
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300/80">
                        Código validado para <strong>{user.email}</strong>. Ahora puedes establecer tu nueva clave de acceso.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetVerification}
                    className="text-xs font-mono text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 flex items-center gap-1 cursor-pointer underline shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reiniciar</span>
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                    Paso 2: Configurar Nueva Contraseña
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Asegure su cuenta con una contraseña robusta conforme a las políticas de seguridad de la plataforma.
                  </p>
                </div>

                <div className="space-y-4 max-w-xl">
                  {/* Contraseña Actual (Obligatoria) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Contraseña Actual <span className="text-[#ED500A]">*</span>
                      </label>
                      <span className="text-[10px] font-mono text-slate-400">Requerida para confirmar su identidad</span>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Nueva Contraseña */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Nueva Contraseña <span className="text-[#ED500A]">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Ingrese su nueva clave"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar Contraseña */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Confirmar Nueva Contraseña <span className="text-[#ED500A]">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita su nueva clave"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && !passwordsMatch && (
                      <p className="text-[11px] text-rose-500 font-mono">Las contraseñas no coinciden.</p>
                    )}
                  </div>

                  {/* Lista de Requisitos de Seguridad */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-title">
                      Requisitos de Seguridad de Contraseña:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {passwordRules.map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs font-mono">
                          {rule.valid ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-white/20 shrink-0" />
                          )}
                          <span className={rule.valid ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}>
                            {rule.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Botón Guardar Nueva Contraseña */}
                <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleResetVerification}
                    className="text-xs font-mono text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Volver al paso 1</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isPendingPassword || !allRulesPassed || !passwordsMatch}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#d44508] text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isPendingPassword ? "Actualizando contraseña..." : "Guardar Nueva Contraseña"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
