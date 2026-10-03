"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  RefreshCw,
  Send,
  ArrowLeft,
  KeyRound,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import {
  loginWithPassword,
  verifyLoginMfaOtp,
  resendLoginMfaOtp,
} from "@/app/(auth)/actions";
import { Suspense } from "react";
import { CustomModal } from "@/components/ui/custom-modal";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const redirectToParam = searchParams.get("redirectTo");

  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Estados del Flujo de Autenticación en 2 Pasos (MFA / 2FA)
  const [isMfaStep, setIsMfaStep] = useState(false);
  const [mfaEmail, setMfaEmail] = useState("");
  const [cachedPassword, setCachedPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Estado del Modal de Alerta
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: "info" | "warning" | "error" | "success";
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info",
  });

  const showAlert = (
    title: string,
    description: string,
    type: "info" | "warning" | "error" | "success" = "info"
  ) => {
    setModalState({ isOpen: true, title, description, type });
  };

  // Notificación amigable según parámetros de URL (Ej. Sesión expirada)
  useEffect(() => {
    if (!errorParam) return;

    if (errorParam === "session_timeout") {
      toast.warning("Sesión Expirada", {
        description: "Tu sesión administrativa ha expirado por inactividad. Inicia sesión nuevamente para continuar.",
        duration: 7000,
      });
    } else if (errorParam === "account_disabled") {
      showAlert(
        "Cuenta Deshabilitada",
        "Esta cuenta de usuario se encuentra temporalmente deshabilitada o suspendida. Comunícate con el administrador del sistema.",
        "warning"
      );
    } else if (errorParam === "unauthorized" || errorParam === "no_access") {
      showAlert(
        "Acceso no Autorizado",
        "No dispones de los permisos necesarios para acceder al espacio solicitado.",
        "warning"
      );
    }

    // Limpiar el parámetro de la URL para que no reaparezca en el paso de MFA o recargas
    if (typeof window !== "undefined") {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("error");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [errorParam]);

  // Temporizador para reenvío de código OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Paso 1: Enviar correo y contraseña
  const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (redirectToParam) {
      formData.append("redirectTo", redirectToParam);
    }
    const email = (formData.get("email") as string) || "";
    const password = (formData.get("password") as string) || "";

    startTransition(async () => {
      try {
        const res = await loginWithPassword(formData);

        // Caso A: Se requiere verificación de doble factor (MFA)
        if (res && res.success && res.requiresMfa) {
          setMfaEmail(res.mfaEmail || email);
          setCachedPassword(password);
          setIsMfaStep(true);
          setResendCooldown(60);
          toast.info("Verificación de Seguridad Requerida", {
            description: "Hemos enviado un código de 6 dígitos a tu correo registrado.",
          });
          return;
        }

        // Caso B: Inicio de sesión directo exitoso (sin MFA)
        if (res && res.success) {
          toast.success("¡Bienvenido a NEGOVA!", {
            description: "Inicio de sesión exitoso. Redirigiendo a tu espacio de trabajo...",
          });
          const targetUrl = res.redirectUrl || "/admin";
          window.location.href = targetUrl;
          return;
        }

        // Caso C: Error en credenciales
        if (res && !res.success && res.error) {
          showAlert("Error de Inicio de Sesión", res.error, "error");
        }
      } catch (err: unknown) {
        const errorDigest = (err as { digest?: string })?.digest;
        if (typeof errorDigest === "string" && errorDigest.startsWith("NEXT_REDIRECT")) {
          return;
        }
        showAlert(
          "Error de Conexión",
          "No se pudo comunicar con el servidor. Intente nuevamente.",
          "error"
        );
      }
    });
  };

  // Paso 2: Validar código OTP de 6 dígitos
  const handleMfaSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      showAlert("Código Incompleto", "Por favor ingresa los 6 dígitos del código de seguridad.", "warning");
      return;
    }

    const formData = new FormData();
    formData.append("email", mfaEmail);
    formData.append("otpCode", otpCode);
    formData.append("password", cachedPassword);
    if (redirectToParam) {
      formData.append("redirectTo", redirectToParam);
    }

    startTransition(async () => {
      try {
        const res = await verifyLoginMfaOtp(formData);
        if (res && res.success) {
          toast.success("¡Identidad Verificada!", {
            description: "Código de acceso correcto. Redirigiendo...",
          });
          const targetUrl = res.redirectUrl || "/admin";
          window.location.href = targetUrl;
          return;
        }

        if (res && !res.success && res.error) {
          showAlert("Código Incorrecto", res.error, "error");
        }
      } catch (err: unknown) {
        const errorDigest = (err as { digest?: string })?.digest;
        if (typeof errorDigest === "string" && errorDigest.startsWith("NEXT_REDIRECT")) {
          return;
        }
        showAlert(
          "Error de Verificación",
          "No se pudo validar el código. Intente nuevamente.",
          "error"
        );
      }
    });
  };

  // Reenviar código OTP
  const handleResendOtp = () => {
    if (resendCooldown > 0 || isPending) return;

    startTransition(async () => {
      const res = await resendLoginMfaOtp(mfaEmail);
      if (res && res.success) {
        setResendCooldown(60);
        toast.success("Nuevo código enviado", {
          description: "Revisa tu bandeja de entrada o spam.",
        });
      } else {
        showAlert("Error al Reenviar", res?.error || "No se pudo enviar el código.", "error");
      }
    });
  };

  // Regresar al Paso 1
  const handleCancelMfa = () => {
    setIsMfaStep(false);
    setOtpCode("");
    setCachedPassword("");
  };

  return (
    <div className="flex min-h-[100dvh] w-full font-body bg-[#F8F9FD] text-[#0B0E14] transition-colors duration-300">
      {/* Modal Personalizado */}
      <CustomModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        description={modalState.description}
        type={modalState.type}
      />

      {/* LADO IZQUIERDO (En Desktop): Presentación Comercial Centrada en Beneficios */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#F1F3F9] relative overflow-hidden flex-col justify-between p-16 border-r border-slate-200">
        {/* Retícula de ingeniería de color naranja sutil (estilo Home) */}
        <div className="absolute inset-0 pointer-events-none opacity-45 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(237, 80, 10, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(237, 80, 10, 0.05) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Orbe decorativo difuso en naranja muy suave de fondo */}
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-[#ED500A]/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Banner Superior */}
        <div className="relative z-10 flex items-center gap-2 text-xs font-mono text-[#ED500A] bg-[#ED500A]/10 px-4 py-1.5 rounded-full w-fit border border-[#ED500A]/20">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>Gestión de Ventas y Caja para tu Comercio</span>
        </div>

        {/* Mensaje Principal Comercial */}
        <div className="relative z-10 space-y-6 max-w-lg my-auto">
          <h2 className="text-4xl font-extrabold font-title leading-tight tracking-tight text-[#0B0E14]">
            La forma más sencilla de controlar tu negocio.
          </h2>
          <p className="text-slate-600 font-body text-base leading-relaxed">
            Una plataforma diseñada para ayudarte a registrar tus ventas, gestionar tu inventario sin complicaciones y saber exactamente cuánto dinero entra a tu caja.
          </p>

          <div className="space-y-4 pt-4">
            {[
              "Tus datos están 100% seguros. Nadie más podrá ver la información comercial de tu negocio.",
              "Control de empleados. Define con claridad qué puede registrar o ver cada persona de tu equipo.",
              "Cuentas claras al instante. Lleva el arqueo de tu caja y registra cada gasto sin usar papel.",
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3.5 text-sm text-slate-600">
                <CheckCircle2 className="w-5 h-5 text-[#ED500A] shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Isotipo & Tagline */}
        <div className="relative z-10 flex items-center justify-between border-t border-slate-200/80 pt-6">
          <div className="flex items-center gap-3">
            <Image
              src="/imagotipo.png"
              alt="NEGOVA Logo"
              width={120}
              height={36}
              className="object-contain mix-blend-multiply opacity-85 hover:opacity-100 transition-opacity"
            />
          </div>
          <span className="text-xs font-mono text-slate-400">
            Versión 1.0.0 Core
          </span>
        </div>
      </div>

      {/* LADO DERECHO (En Desktop): Formulario de Inicio de Sesión */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-white shadow-sm z-10 animate-fade-in">
        {/* Header / Logo Brand */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3.5 group focus:outline-none">
            <div className="relative w-9 h-9 flex items-center justify-center transform transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/isotipo.png"
                alt="Isotipo NEGOVA"
                width={36}
                height={36}
                className="object-contain rounded-[4px]"
                priority
              />
            </div>
            <span className="font-title font-extrabold text-xl tracking-tight text-[#0B0E14] uppercase transition-colors group-hover:text-[#ED500A]">
              NEGOVA
            </span>
          </Link>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono bg-[#F8F9FD] px-3.5 py-2 rounded-full border border-slate-200 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1" />
            <span>Conexión 100% Segura</span>
          </div>
        </div>

        {/* Bloque Principal del Formulario */}
        <div className="max-w-md w-full mx-auto my-auto py-10 space-y-8">
          {/* Encabezado según el paso */}
          {!isMfaStep ? (
            <div className="space-y-2.5">
              <h1 className="text-3xl font-extrabold font-title tracking-tight text-[#0B0E14]">
                Iniciar Sesión
              </h1>
              <p className="text-sm text-slate-500">
                Ingresa tus datos autorizados para acceder a tu plataforma administrativa.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#ED500A] text-xs font-mono font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Autenticación de 2 Factores (MFA)</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold font-title tracking-tight text-[#0B0E14]">
                Verifica tu Identidad
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Hemos enviado un código de 6 dígitos al correo:{" "}
                <strong className="text-slate-800 font-mono">{mfaEmail}</strong>
              </p>
            </div>
          )}

          {/* ARQUITECTURA DOPPELRAND CONTAINER */}
          <div className="p-1.5 bg-[#F8F9FD]/90 ring-1 ring-slate-200/50 rounded-[2.5rem] shadow-sm">
            <div className="bg-white p-8 sm:p-10 rounded-[calc(2.5rem-0.375rem)] border border-slate-100/80 shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
              {/* PASO 1: Formulario de Correo y Contraseña */}
              {!isMfaStep ? (
                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                  {/* Campo Email */}
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-xs font-mono font-medium text-slate-600">
                      Correo Electrónico
                    </label>
                    <div className="relative group">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-[#ED500A] transition-colors" />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="usuario@negova.com"
                        className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 bg-[#F8F9FD]/60 text-sm focus:ring-2 focus:ring-[#ED500A] focus:border-transparent outline-none transition-all duration-300 placeholder-slate-400 text-[#0B0E14]"
                      />
                    </div>
                  </div>

                  {/* Campo Contraseña */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="text-xs font-mono font-medium text-slate-600">
                        Contraseña
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-xs font-mono text-[#ED500A] hover:underline focus:outline-none focus:ring-1 focus:ring-[#ED500A] rounded-sm px-1 transition-colors"
                      >
                        ¿La olvidaste?
                      </Link>
                    </div>
                    <div className="relative group">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-[#ED500A] transition-colors" />
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-[#F8F9FD]/60 text-sm focus:ring-2 focus:ring-[#ED500A] focus:border-transparent outline-none transition-all duration-300 placeholder-slate-400 text-[#0B0E14]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Botón Ingresar */}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="group relative w-full py-3.5 pl-6 pr-4 rounded-xl bg-[#ED500A] hover:bg-[#d64505] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-title font-bold text-sm shadow-md active:scale-[0.98] transition-all duration-300 flex items-center justify-between cursor-pointer"
                  >
                    {isPending ? (
                      <span className="w-full text-center tracking-wide">Validando credenciales...</span>
                    ) : (
                      <>
                        <span className="tracking-wide">Ingresar a la plataforma</span>
                        <div className="w-8 h-8 rounded-lg bg-black/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* PASO 2: Formulario de Código OTP de Doble Factor */
                <form onSubmit={handleMfaSubmit} className="space-y-5 animate-in fade-in-50 duration-200">
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-medium text-slate-700">
                      Código de Seguridad (6 Dígitos)
                    </label>
                    <div className="relative group">
                      <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-[#ED500A] transition-colors" />
                      <input
                        type="text"
                        maxLength={6}
                        autoFocus
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        className="w-full pl-10 pr-3 py-3 text-center text-xl tracking-[0.4em] font-mono font-bold rounded-xl border border-slate-200 bg-[#F8F9FD]/60 focus:ring-2 focus:ring-[#ED500A] focus:border-transparent outline-none transition-all placeholder-slate-300 text-[#0B0E14]"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono text-center">
                      Código de uso único con vigencia de 10 minutos.
                    </p>
                  </div>

                  {/* Acciones de reenvío */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={handleCancelMfa}
                      className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Cambiar cuenta</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || isPending}
                      className="text-[#ED500A] hover:underline disabled:text-slate-400 disabled:no-underline flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>
                        {resendCooldown > 0
                          ? `Reenviar en ${resendCooldown}s`
                          : "Reenviar código"}
                      </span>
                    </button>
                  </div>

                  {/* Botón Validar OTP */}
                  <button
                    type="submit"
                    disabled={isPending || otpCode.length !== 6}
                    className="group relative w-full py-3.5 pl-6 pr-4 rounded-xl bg-[#ED500A] hover:bg-[#d64505] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-title font-bold text-sm shadow-md active:scale-[0.98] transition-all duration-300 flex items-center justify-between cursor-pointer"
                  >
                    {isPending ? (
                      <div className="w-full flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verificando código...</span>
                      </div>
                    ) : (
                      <>
                        <span className="tracking-wide">Completar inicio de sesión</span>
                        <div className="w-8 h-8 rounded-lg bg-black/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Footer Derecho */}
        <div className="text-xs text-slate-400 text-center font-mono py-2">
          &copy; {new Date().getFullYear()} NEGOVA Precision Logic. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#08090D] flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-[#ED500A] animate-spin" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
