"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  QrCode,
  Copy,
  Check,
  Download,
  RefreshCw,
  Lock,
  ArrowLeft,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Info,
  Building2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { AdminBadge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  SecurityConfigViewData,
  start2faEnrollmentAction,
  confirm2faEnrollmentAction,
  disable2faAction,
  regenerateRecoveryCodesAction,
  updateBusiness2faEnforcementAction,
} from "./actions";
import { TotpEnrollmentData } from "@/lib/auth/two-factor-service";

interface SecurityConfigClientProps {
  businessId: string;
  initialData: SecurityConfigViewData;
}

export function SecurityConfigClient({
  businessId,
  initialData,
}: SecurityConfigClientProps) {
  const [data, setData] = useState<SecurityConfigViewData>(initialData);
  const [isPending, startTransition] = useTransition();

  // Estados del Wizard de Enrolamiento 2FA
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<TotpEnrollmentData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Modal para desactivar 2FA
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);

  // Modal para ver códigos regenerados
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([]);

  // Estado del switch de negocio "Requerir 2FA para administradores"
  const [require2faForAdmins, setRequire2faForAdmins] = useState(
    data.businessSecurity.require2faForAdmins
  );
  const [isSavingBizPolicy, setIsSavingBizPolicy] = useState(false);

  // Iniciar proceso de activación de 2FA
  const handleStartEnrollment = () => {
    startTransition(async () => {
      try {
        const res = await start2faEnrollmentAction(businessId);
        if (res.success && res.data) {
          setEnrollmentData(res.data);
          setVerificationCode("");
          setCopiedSecret(false);
          setCopiedCodes(false);
          setIsEnrollModalOpen(true);
        } else {
          toast.error("Error al iniciar activación", {
            description: res.error || "No fue posible generar el código QR de seguridad.",
          });
        }
      } catch (err: any) {
        toast.error("Error de conexión", {
          description: err?.message || "Ocurrió un error inesperado.",
        });
      }
    });
  };

  // Confirmar código de 6 dígitos y activar 2FA
  const handleConfirmEnrollment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentData) return;

    const code = verificationCode.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      toast.warning("Código Incompleto", {
        description: "Por favor ingresa los 6 dígitos generados por tu aplicación de autenticación.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await confirm2faEnrollmentAction(
          businessId,
          enrollmentData.factorId,
          enrollmentData.secret,
          code,
          enrollmentData.recoveryCodes
        );

        if (res.success) {
          toast.success("¡2FA Activado Exitosamente!", {
            description: "Tu cuenta ahora cuenta con protección de doble factor.",
          });
          setIsEnrollModalOpen(false);
          setData((prev) => ({
            ...prev,
            userStatus: {
              ...prev.userStatus,
              isEnabled: true,
              verifiedAt: new Date().toISOString(),
              recoveryCodesTotal: 8,
              recoveryCodesRemaining: 8,
              recoveryCodesUsed: 0,
            },
          }));
        } else {
          toast.error("Código Incorrecto", {
            description: res.error || "El código ingresado no coincide o expiró. Inténtalo nuevamente.",
          });
        }
      } catch (err: any) {
        toast.error("Error de verificación", {
          description: err?.message || "No fue posible activar 2FA.",
        });
      }
    });
  };

  // Desactivar 2FA
  const handleDisable2fa = () => {
    startTransition(async () => {
      try {
        const res = await disable2faAction(businessId);
        if (res.success) {
          toast.info("Verificación en dos pasos desactivada", {
            description: "Se ha removido el factor TOTP y los códigos de respaldo de tu cuenta.",
          });
          setIsDisableModalOpen(false);
          setData((prev) => ({
            ...prev,
            userStatus: {
              ...prev.userStatus,
              isEnabled: false,
              verifiedAt: null,
              recoveryCodesTotal: 0,
              recoveryCodesRemaining: 0,
              recoveryCodesUsed: 0,
            },
          }));
        } else {
          toast.error("Error al desactivar", {
            description: res.error || "No fue posible desactivar 2FA.",
          });
        }
      } catch (err: any) {
        toast.error("Error", {
          description: err?.message || "No se pudo procesar la solicitud.",
        });
      }
    });
  };

  // Regenerar códigos de respaldo
  const handleRegenerateCodes = () => {
    startTransition(async () => {
      try {
        const res = await regenerateRecoveryCodesAction(businessId);
        if (res.success && res.rawCodes) {
          setNewRecoveryCodes(res.rawCodes);
          setIsRegenerateModalOpen(true);
          setData((prev) => ({
            ...prev,
            userStatus: {
              ...prev.userStatus,
              recoveryCodesTotal: 8,
              recoveryCodesRemaining: 8,
              recoveryCodesUsed: 0,
            },
          }));
          toast.success("Códigos de respaldo actualizados", {
            description: "Se han generado 8 códigos nuevos. Los códigos anteriores han sido invalidados.",
          });
        } else {
          toast.error("Error al regenerar", {
            description: res.error || "No se pudieron regenerar los códigos.",
          });
        }
      } catch (err: any) {
        toast.error("Error de conexión", {
          description: err?.message || "Error al solicitar nuevos códigos.",
        });
      }
    });
  };

  // Guardar política de obligatoriedad del negocio
  const handleSaveBusinessPolicy = async () => {
    setIsSavingBizPolicy(true);
    try {
      const res = await updateBusiness2faEnforcementAction(businessId, require2faForAdmins);
      if (res.success) {
        toast.success("Política de seguridad actualizada", {
          description: require2faForAdmins
            ? "2FA es ahora obligatorio para los roles administrativos del negocio."
            : "La obligatoriedad de 2FA ha sido desactivada para administradores.",
        });
        setData((prev) => ({
          ...prev,
          businessSecurity: {
            ...prev.businessSecurity,
            require2faForAdmins,
          },
        }));
      } else {
        toast.error("Error al guardar política", {
          description: res.error || "No se pudo actualizar la configuración.",
        });
      }
    } catch (err: any) {
      toast.error("Error", {
        description: err?.message || "Ocurrió un error inesperado.",
      });
    } finally {
      setIsSavingBizPolicy(false);
    }
  };

  // Copiar clave secreta
  const handleCopySecret = () => {
    if (!enrollmentData?.secret) return;
    navigator.clipboard.writeText(enrollmentData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
    toast.success("Clave copiada al portapapeles");
  };

  // Copiar códigos de respaldo
  const handleCopyCodes = (codes: string[]) => {
    const text = codes.join("\n");
    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
    toast.success("Códigos de respaldo copiados");
  };

  // Descargar códigos como archivo de texto
  const handleDownloadCodes = (codes: string[]) => {
    const text = `NEGOVA - Códigos de Respaldo 2FA\nFecha: ${new Date().toLocaleDateString()}\nUsuario: ${
      data.userEmail
    }\n\n${codes.join("\n")}\n\nNota: Cada código puede usarse una única vez en caso de perder acceso a tu app de autenticación.`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `negova-codigos-respaldo-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo descargado");
  };

  const isUser2faActive = data.userStatus.isEnabled;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-body">
      {/* ─── Encabezado con retorno a Configuración ─────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/workspace/${businessId}/configuracion`}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Configuración</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-xs font-semibold text-[#ED500A]">Seguridad y 2FA</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-title text-slate-900 dark:text-white flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-[#ED500A]" />
            <span>Seguridad y Autenticación en Dos Pasos (2FA)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Protege el acceso a tu cuenta con Google Authenticator, Authy y gestiona políticas para roles administrativos.
          </p>
        </div>
      </div>

      {/* ─── SECCIÓN 1: ESTADO PERSONAL DE 2FA ──────────────────────────── */}
      <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                  isUser2faActive
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                }`}
              >
                {isUser2faActive ? (
                  <ShieldCheck className="w-6 h-6 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-amber-500" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                    Tu Verificación en Dos Pasos (TOTP)
                  </h3>
                  <AdminBadge variant={isUser2faActive ? "emerald" : "amber"}>
                    {isUser2faActive ? "Activo y Protegido" : "Desactivado"}
                  </AdminBadge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isUser2faActive
                    ? "Tu cuenta requiere un código de 6 dígitos generado por tu teléfono para cada inicio de sesión."
                    : "Tu cuenta actualmente solo utiliza contraseña. Te recomendamos activar 2FA para mayor seguridad."}
                </p>
              </div>
            </div>

            {/* Botón de Acción Principal */}
            <div>
              {isUser2faActive ? (
                <button
                  type="button"
                  onClick={() => setIsDisableModalOpen(true)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 transition-all cursor-pointer"
                >
                  Desactivar 2FA
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEnrollment}
                  disabled={isPending}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#ED500A] hover:bg-[#ED500A]/90 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Activar Verificación en Dos Pasos</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Detalle del estado o Códigos de Respaldo */}
        <div className="p-6 space-y-6">
          {isUser2faActive ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta de Aplicación Vinculada */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  <span>Aplicación de Autenticación Activa</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Compatible con Google Authenticator, Authy, Microsoft Authenticator y 1Password.
                </p>
                {data.userStatus.verifiedAt && (
                  <p className="text-[11px] text-slate-400 font-mono">
                    Activado el {new Date(data.userStatus.verifiedAt).toLocaleDateString()} a las{" "}
                    {new Date(data.userStatus.verifiedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>

              {/* Tarjeta de Códigos de Respaldo */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                    <KeyRound className="w-4 h-4 text-blue-500" />
                    <span>Códigos de Respaldo</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {data.userStatus.recoveryCodesRemaining} de {data.userStatus.recoveryCodesTotal} disponibles
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Útiles si pierdes el acceso a tu teléfono o no puedes abrir tu app de autenticación.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleRegenerateCodes}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
                    <span>Regenerar Códigos de Respaldo</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-1">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold font-mono">
                  1
                </div>
                <p className="font-bold text-slate-800 dark:text-slate-200 pt-1">Escanea el código QR</p>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Usa Google Authenticator o Authy en tu celular para vincular tu cuenta.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-1">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold font-mono">
                  2
                </div>
                <p className="font-bold text-slate-800 dark:text-slate-200 pt-1">Guarda códigos de respaldo</p>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Recibes 8 códigos de recuperación de un solo uso para emergencias.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-1">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold font-mono">
                  3
                </div>
                <p className="font-bold text-slate-800 dark:text-slate-200 pt-1">Ingresa el código de 6 dígitos</p>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Confirma la sincronización para blindar el inicio de sesión.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── SECCIÓN 2: POLÍTICA DEL NEGOCIO (ADMINISTRADORES) ──────────── */}
      {data.isOwnerOrAdmin && (
        <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                  Políticas de Seguridad del Comercio
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Controla la obligatoriedad de autenticación multifactor para los miembros del equipo.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Requerir 2FA para administradores
                  </span>
                  {require2faForAdmins && (
                    <AdminBadge variant="purple">Obligatorio</AdminBadge>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Al activar esta opción, todos los usuarios con roles administrativos (Propietario, Administrador, Gerente) deberán activar y utilizar verificación en dos pasos obligatoriamente para iniciar sesión en este negocio.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={require2faForAdmins}
                    onChange={(e) => setRequire2faForAdmins(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#ED500A]"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveBusinessPolicy}
                disabled={isSavingBizPolicy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#ED500A] hover:bg-[#ED500A]/90 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingBizPolicy ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Guardar Políticas de Seguridad</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL WIZARD: ACTIVACIÓN DE 2FA ───────────────────────────── */}
      {isEnrollModalOpen && enrollmentData && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-orange-500/10 text-[#ED500A]">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Configurar Verificación en Dos Pasos
                    </h3>
                    <p className="text-xs text-slate-400">Paso a paso con Google Authenticator / Authy</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Paso 1: Escaneo de QR */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  <span className="w-5 h-5 rounded-full bg-[#ED500A] text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span>Escanea el código QR</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                  <div className="bg-white p-3 rounded-xl shadow-inner border border-slate-200 shrink-0">
                    <img
                      src={enrollmentData.qrCodeUrl}
                      alt="Código QR de autenticación 2FA"
                      className="w-36 h-36 object-contain"
                    />
                  </div>
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-600 dark:text-slate-300">
                      Abre tu aplicación de autenticación (Google Authenticator, Authy o Microsoft Authenticator) y escanea este código.
                    </p>
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-slate-400">¿No puedes escanear? Clave manual:</span>
                      <div className="flex items-center gap-1.5">
                        <code className="px-2 py-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-md font-mono text-[11px] text-[#ED500A] font-bold select-all break-all">
                          {enrollmentData.secret}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopySecret}
                          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-colors cursor-pointer"
                          title="Copiar clave"
                        >
                          {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Paso 2: Códigos de Respaldo */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                    <span className="w-5 h-5 rounded-full bg-[#ED500A] text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <span>Guarda tus códigos de respaldo</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyCodes(enrollmentData.recoveryCodes)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-[#ED500A] bg-slate-100 dark:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                      {copiedCodes ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>Copiar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadCodes(enrollmentData.recoveryCodes)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-[#ED500A] bg-slate-100 dark:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Descargar</span>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {enrollmentData.recoveryCodes.map((code, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-center font-mono text-xs font-semibold bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-md text-slate-800 dark:text-slate-200"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>Cada código sirve una sola vez si no puedes acceder a tu app móvil.</span>
                  </p>
                </div>
              </div>

              {/* Paso 3: Confirmación de Código */}
              <form onSubmit={handleConfirmEnrollment} className="space-y-4 pt-1">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                    <span className="w-5 h-5 rounded-full bg-[#ED500A] text-white flex items-center justify-center text-[10px]">
                      3
                    </span>
                    <span>Ingresa el código de 6 dígitos</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full text-center text-2xl font-mono tracking-widest font-bold py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 text-center">
                    Ingresa el código temporal mostrado en tu app para verificar la vinculación.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsEnrollModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || verificationCode.length !== 6}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#ED500A] hover:bg-[#ED500A]/90 shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Confirmar y Activar 2FA</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ─── MODAL: CÓDIGOS DE RESPALDO REGENERADOS ─────────────────────── */}
      {isRegenerateModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Nuevos Códigos de Respaldo
                    </h3>
                    <p className="text-xs text-slate-400">Guárdalos ahora; no se mostrarán de nuevo</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRegenerateModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {newRecoveryCodes.map((code, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1.5 text-center font-mono text-xs font-semibold bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-md text-slate-800 dark:text-slate-200"
                  >
                    {code}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleCopyCodes(newRecoveryCodes)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Todos</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadCodes(newRecoveryCodes)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar TXT</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegenerateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#ED500A] hover:bg-[#ED500A]/90 rounded-xl transition-all cursor-pointer"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ─── MODAL DE CONFIRMACIÓN PARA DESACTIVAR 2FA ─────────────────── */}
      <ConfirmModal
        isOpen={isDisableModalOpen}
        onClose={() => setIsDisableModalOpen(false)}
        onConfirm={handleDisable2fa}
        title="¿Desactivar la Verificación en Dos Pasos?"
        description="Tu cuenta perderá la capa de seguridad adicional y quedará protegida únicamente por tu contraseña. También se revocarán todos tus códigos de respaldo."
        confirmText="Sí, desactivar 2FA"
        cancelText="Conservar 2FA"
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}

