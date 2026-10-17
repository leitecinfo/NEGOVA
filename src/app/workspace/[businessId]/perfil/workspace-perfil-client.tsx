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
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  updateWorkspaceProfile,
  updateWorkspaceProfilePassword,
  sendWorkspaceProfilePasswordOtp,
  verifyWorkspaceProfilePasswordOtp,
} from "./actions";

interface WorkspacePerfilClientProps {
  businessId: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    phone: string | null;
    bio: string | null;
    roleCode: string;
    roleName: string;
    businessName: string;
    isOwner: boolean;
    createdAt?: string;
  };
}

export function WorkspacePerfilClient({
  businessId,
  user,
}: WorkspacePerfilClientProps) {
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

  // Restablecer al avatar geométrico
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
      const res = await updateWorkspaceProfile(businessId, formData);
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

  // 1. Solicitar código OTP al correo
  const handleRequestOtp = () => {
    startOtpTransition(async () => {
      const res = await sendWorkspaceProfilePasswordOtp(businessId);
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

  // 2. Validar código OTP
  const handleVerifyOtp = () => {
    if (!otpCode || otpCode.trim().length !== 6) {
      toast.error("Código incompleto", {
        description: "Por favor ingrese el código de 6 dígitos enviado a su correo.",
      });
      return;
    }

    startVerifyOtpTransition(async () => {
      const res = await verifyWorkspaceProfilePasswordOtp(businessId, otpCode.trim());
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

  // 3. Guardar nueva contraseña tras validar identidad
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
      toast.error("Contraseñas no coinciden", {
        description: "La confirmación de la contraseña no coincide con la nueva clave.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("currentPassword", currentPassword);
    formData.append("newPassword", newPassword);
    formData.append("confirmPassword", confirmPassword);
    formData.append("otpCode", verifiedOtpCode);

    startPasswordTransition(async () => {
      const res = await updateWorkspaceProfilePassword(businessId, formData);
      if (res.success) {
        toast.success("¡Contraseña actualizada con éxito!", {
          description: "Tu nueva clave de acceso ha sido establecida correctamente.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setOtpCode("");
        setVerifiedOtpCode("");
        setIsIdentityVerified(false);
        setSecurityStep("verify");
        setOtpSent(false);
      } else {
        toast.error("Error al cambiar contraseña", {
          description: res.error || "Verifica tu contraseña actual e inténtalo de nuevo.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header con Información de Identidad y Rol en Workspace */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <UserAvatar
              src={previewUrl}
              value={user.email}
              name={fullName || user.email}
              size={64}
              radius={16}
              style="shape"
            />
            {previewUrl && (
              <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full text-white ring-2 ring-white dark:ring-[#0D0F16]">
                <Check className="w-3 h-3" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold font-title text-slate-900 dark:text-white">
                {fullName || "Usuario del Comercio"}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                Cuenta Activa
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {user.email}
            </p>
            <div className="flex items-center gap-3 pt-0.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-orange-50 dark:bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20 text-[11px] font-mono font-semibold">
                <Shield className="w-3 h-3" />
                {user.roleName || (user.isOwner ? "Dueño / Propietario" : "Colaborador")}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <Store className="w-3 h-3 text-slate-400" />
                {user.businessName}
              </span>
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación del Perfil */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200/60 dark:border-white/[0.06] w-full sm:w-auto self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === "general"
                ? "bg-white dark:bg-[#1A1D27] text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Datos Personales</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("seguridad")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === "seguridad"
                ? "bg-white dark:bg-[#1A1D27] text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Seguridad y Clave</span>
          </button>
        </div>
      </div>

      {/* 2. Pestaña 1: Información Personal y Avatar */}
      {activeTab === "general" && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tarjeta de Gestión de Foto de Perfil */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#ED500A]" />
                  <span>Foto de Perfil</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sube tu foto personal para identificarte en comprobantes y comandas.
                </p>
              </div>

              {/* Zona de Arrastre / Previsualización */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                className={`relative p-6 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center gap-3 ${
                  isDragging
                    ? "border-[#ED500A] bg-orange-50/50 dark:bg-[#ED500A]/5"
                    : "border-slate-200 dark:border-white/[0.1] bg-slate-50/50 dark:bg-white/[0.02]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <UserAvatar
                  src={previewUrl}
                  value={user.email}
                  name={fullName || user.email}
                  size={80}
                  radius={20}
                  style="shape"
                />

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {previewUrl ? "Foto seleccionada" : "Sin foto personalizada"}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Arrastra una imagen o haz clic para examinar (Máx 5MB)
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Seleccionar Archivo</span>
                  </button>

                  {previewUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  Formatos admitidos:
                </p>
                <p>JPG, PNG, WEBP o GIF. Resolución óptima: 400x400 px.</p>
              </div>
            </div>

            {/* Formulario de Campos de Perfil */}
            <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-5">
              <div className="space-y-1 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title flex items-center gap-2">
                  <User className="w-4 h-4 text-[#ED500A]" />
                  <span>Información de Contacto</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Actualiza tus datos de identificación y comunicación en el comercio.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre Completo */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>Nombre completo</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej: Carlos Mendoza"
                      className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                    />
                  </div>
                </div>

                {/* Correo Electrónico (Solo Lectura) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Correo electrónico</span>
                    <span className="text-[10px] font-mono text-slate-400">Solo lectura</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      disabled
                      value={user.email}
                      className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed font-mono"
                    />
                  </div>
                </div>

                {/* Teléfono de Contacto */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Teléfono / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej: +57 300 123 4567"
                      className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                    />
                  </div>
                </div>

                {/* Biografía / Cargo breve */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Descripción / Cargo en tienda
                  </label>
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Ej: Administrador general de caja y compras en punto de venta..."
                      className="w-full p-3 text-xs sm:text-sm bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Botón de Guardar Cambios */}
              <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="submit"
                  disabled={isPendingProfile}
                  className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPendingProfile ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* 3. Pestaña 2: Seguridad y Cambio de Contraseña */}
      {activeTab === "seguridad" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tarjeta Informativa de Seguridad */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#ED500A]" />
                <span>Seguridad de la Cuenta</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tu clave de acceso está protegida mediante verificación en dos pasos (OTP).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <KeyRound className="w-4 h-4 text-[#ED500A]" />
                <span>Flujo de Seguridad:</span>
              </div>
              <ol className="text-[11px] text-slate-500 dark:text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
                <li>Solicitas un código de 6 dígitos que llega a tu correo institucional.</li>
                <li>Verificas tu identidad con el código antes de ingresar la nueva clave.</li>
                <li>Defines tu nueva contraseña cumpliendo las políticas de complejidad.</li>
              </ol>
            </div>
          </div>

          {/* Formulario / Flujo de Contraseña */}
          <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-5">
            {/* Paso 1: Validación de Identidad por OTP */}
            {securityStep === "verify" && (
              <div className="space-y-5">
                <div className="space-y-1 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#ED500A]" />
                    <span>Paso 1: Validar Identidad</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Para cambiar tu contraseña, primero debemos verificar que eres el titular de la cuenta.
                  </p>
                </div>

                {!otpSent ? (
                  <div className="p-6 text-center space-y-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04]">
                    <div className="w-12 h-12 mx-auto rounded-full bg-orange-50 dark:bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center">
                      <Send className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Solicitar código de seguridad
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Enviaremos un código numérico temporal de 6 dígitos a tu correo:{" "}
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">
                          {user.email}
                        </strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={isPendingOtp}
                      className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center gap-2 mx-auto disabled:opacity-50"
                    >
                      {isPendingOtp ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Enviando código...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Enviar Código al Correo</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-orange-50/50 dark:bg-[#ED500A]/5 border border-[#ED500A]/20 flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[#ED500A] shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        Código enviado a <strong>{user.email}</strong>. Revisa tu bandeja de
                        entrada o spam e ingrésalo a continuación.
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Código de verificación (6 dígitos)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="000000"
                          className="w-44 text-center tracking-widest font-mono text-lg py-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                        />

                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={isPendingVerifyOtp || otpCode.length !== 6}
                          className="px-4 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isPendingVerifyOtp ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Validando...</span>
                            </>
                          ) : (
                            <>
                              <span>Verificar Código</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-3 text-xs">
                      {resendCooldown > 0 ? (
                        <span className="text-slate-400 font-mono text-[11px]">
                          Reenviar código en {resendCooldown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestOtp}
                          disabled={isPendingOtp}
                          className="text-[#ED500A] hover:underline font-semibold text-xs flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reenviar nuevo código</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Paso 2: Configurar Nueva Contraseña */}
            {securityStep === "change" && (
              <form onSubmit={handleSavePassword} className="space-y-5">
                <div className="space-y-1 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#ED500A]" />
                      <span>Paso 2: Definir Nueva Contraseña</span>
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono">
                      <Check className="w-3 h-3" />
                      Identidad Verificada
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Introduce tu contraseña actual y la nueva clave que deseas utilizar.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Contraseña Actual */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Contraseña actual
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Nueva Contraseña */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nueva contraseña
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar Contraseña */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Confirmar nueva contraseña
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Reglas de Complejidad */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] space-y-2">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Requisitos de seguridad de la contraseña:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      {passwordRules.map((rule, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-1.5 ${
                            rule.valid
                              ? "text-emerald-600 dark:text-emerald-400 font-medium"
                              : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          <Check className={`w-3.5 h-3.5 ${rule.valid ? "opacity-100" : "opacity-30"}`} />
                          <span>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setSecurityStep("verify")}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isPendingPassword || !allRulesPassed || !passwordsMatch}
                    className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPendingPassword ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Actualizando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Establecer Nueva Contraseña</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
