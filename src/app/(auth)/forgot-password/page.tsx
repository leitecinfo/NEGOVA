"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import {
  sendRecoveryOtp,
  verifyRecoveryOtpAction,
  updatePasswordWithOtpAction,
} from "@/app/(auth)/actions";
import { CustomModal } from "@/components/ui/custom-modal";

export default function RecuperarContrasenaPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [passwordValue, setPasswordValue] = useState("");

  const passwordRules = [
    { label: "Mínimo 10 caracteres", valid: passwordValue.length >= 10 },
    { label: "Una letra mayúscula", valid: /[A-Z]/.test(passwordValue) },
    { label: "Una letra minúscula", valid: /[a-z]/.test(passwordValue) },
    { label: "Un número", valid: /[0-9]/.test(passwordValue) },
    { label: "Un carácter especial (!@#$%...)", valid: /[^A-Za-z0-9]/.test(passwordValue) },
  ];

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

  // PASO 1: Enviar Correo con el código OTP
  const handleSendEmail = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const enteredEmail = formData.get("email") as string;

    startTransition(async () => {
      try {
        const res = await sendRecoveryOtp(formData);
        if (res.success) {
          setEmail(enteredEmail);
          setStep(2);
          showAlert("Código Enviado", "Hemos enviado un código OTP de 6 dígitos a tu bandeja de correo.", "success");
        } else {
          showAlert("Error", res.error || "No se pudo enviar el correo de verificación.", "error");
        }
      } catch (err) {
        showAlert("Error de Conexión", "No se pudo comunicar con el servidor.", "error");
      }
    });
  };

  // PASO 2: Verificar el código OTP
  const handleVerifyOtp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const enteredCode = formData.get("otp") as string;

    startTransition(async () => {
      try {
        const res = await verifyRecoveryOtpAction(email, enteredCode);
        if (res.success) {
          setOtpCode(enteredCode);
          setStep(3);
        } else {
          showAlert("Código Inválido", res.error || "El código ingresado es incorrecto o ha expirado.", "warning");
        }
      } catch (err) {
        showAlert("Error de Conexión", "No se pudo comunicar con el servidor.", "error");
      }
    });
  };

  // PASO 3: Guardar la nueva contraseña
  const handleUpdatePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      showAlert("Error de Validación", "Las contraseñas ingresadas no coinciden.", "warning");
      return;
    }

    // Agregar el email y el código OTP válidos al formData del envío
    formData.append("email", email);
    formData.append("code", otpCode);

    startTransition(async () => {
      try {
        const res = await updatePasswordWithOtpAction(formData);
        if (res.success) {
          showAlert("Contraseña Actualizada", "Tu contraseña ha sido restablecida con éxito. Redirigiendo...", "success");
          setTimeout(() => {
            router.push("/login");
          }, 3000);
        } else {
          showAlert("Error al Actualizar", res.error || "Ocurrió un error al actualizar la contraseña.", "error");
        }
      } catch (err) {
        showAlert("Error de Conexión", "No se pudo comunicar con el servidor.", "error");
      }
    });
  };

  // Reenviar el código de forma rápida
  const handleResendCode = () => {
    const formData = new FormData();
    formData.append("email", email);

    startTransition(async () => {
      try {
        const res = await sendRecoveryOtp(formData);
        if (res.success) {
          showAlert("Código Reenviado", "Se ha enviado un nuevo código OTP de 6 dígitos a tu bandeja de correo.", "success");
        }
      } catch (err) {
        showAlert("Error de Conexión", "No se pudo comunicar con el servidor.", "error");
      }
    });
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

      {/* LADO IZQUIERDO: Presentación Comercial (Consistente en Light Mode) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#F1F3F9] relative overflow-hidden flex-col justify-between p-16 border-r border-slate-200">
        <div className="absolute inset-0 pointer-events-none opacity-45 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(237, 80, 10, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(237, 80, 10, 0.05) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-[#ED500A]/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-2 text-xs font-mono text-[#ED500A] bg-[#ED500A]/10 px-5 py-1.5 rounded-full w-fit border border-[#ED500A]/20">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>Gestión de Ventas y Caja para tu Comercio</span>
        </div>

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

        <div className="relative z-10 flex items-center justify-between border-t border-slate-200/80 pt-6">
          <div className="flex items-center gap-3">
            <Image
              src="/imagotipo.png"
              alt="NEGOVA Logo"
              width={120}
              height={36}
              className="object-contain opacity-85 hover:opacity-100 transition-opacity"
            />
          </div>
          <span className="text-xs font-mono text-slate-400">
            Versión 1.0.0 Core
          </span>
        </div>
      </div>

      {/* LADO DERECHO: Contenedor del Formulario (Cambia dinámicamente según el paso) */}
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
            <span>Verificación OTP Activa</span>
          </div>
        </div>

        {/* CONTENEDOR MULTI-PASO DE FORMULARIO */}
        <div className="max-w-md w-full mx-auto my-auto py-10 space-y-8">
          
          {/* PASO 1: Ingreso de correo electrónico */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2.5">
                <h1 className="text-3xl font-extrabold font-title tracking-tight text-[#0B0E14]">
                  Recuperar Contraseña
                </h1>
                <p className="text-sm text-slate-500">
                  Ingresa tu correo registrado. Te enviaremos un código de seguridad OTP para verificar tu identidad.
                </p>
              </div>

              <div className="p-1.5 bg-[#F8F9FD]/90 ring-1 ring-slate-200/50 rounded-[2.5rem] shadow-sm">
                <div className="bg-white p-8 sm:p-10 rounded-[calc(2.5rem-0.375rem)] border border-slate-100/80 shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
                  <form onSubmit={handleSendEmail} className="space-y-6">
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-xs font-mono font-medium text-slate-600">
                        Correo Electrónico Registrado
                      </label>
                      <div className="relative group">
                        <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-[#ED500A] transition-colors" />
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          defaultValue={email}
                          placeholder="usuario@negova.com"
                          className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 bg-[#F8F9FD]/60 text-sm focus:ring-2 focus:ring-[#ED500A] focus:border-transparent outline-none transition-all duration-300 placeholder-slate-400 text-[#0B0E14]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isPending}
                      className="group relative w-full py-3.5 pl-6 pr-4 rounded-xl bg-[#ED500A] hover:bg-[#d64505] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-title font-bold text-sm shadow-md active:scale-[0.98] transition-all duration-300 flex items-center justify-between"
                    >
                      {isPending ? (
                        <span className="w-full text-center tracking-wide">Enviando código...</span>
                      ) : (
                        <>
                          <span className="tracking-wide">Enviar Código OTP</span>
                          <div className="w-8 h-8 rounded-lg bg-black/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </>
                      )}
                    </button>

                    <div className="text-center pt-2">
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-xs font-mono text-slate-500 hover:text-slate-800 focus:outline-none transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Volver al inicio de sesión</span>
                      </Link>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: Ingreso de código OTP de 6 dígitos */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2.5">
                <h1 className="text-3xl font-extrabold font-title tracking-tight text-[#0B0E14]">
                  Ingresar Código OTP
                </h1>
                <p className="text-sm text-slate-500">
                  Ingresa el código de 6 dígitos enviado a <strong className="text-slate-850 font-semibold">{email}</strong>.
                </p>
              </div>

              <div className="p-1.5 bg-[#F8F9FD]/90 ring-1 ring-slate-200/50 rounded-[2.5rem] shadow-sm">
                <div className="bg-white p-8 sm:p-10 rounded-[calc(2.5rem-0.375rem)] border border-slate-100/80 shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="space-y-2">
                      <label htmlFor="otp" className="text-xs font-mono font-medium text-slate-600">
                        Código de 6 dígitos
                      </label>
                      <div className="relative group">
                        <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-[#ED500A] transition-colors" />
                        <input
                          id="otp"
                          name="otp"
                          type="text"
                          required
                          maxLength={6}
                          placeholder="000000"
                          className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 bg-[#F8F9FD]/60 text-center tracking-[0.75em] font-mono text-lg focus:ring-2 focus:ring-[#ED500A] focus:border-transparent outline-none transition-all duration-300 placeholder-slate-300 text-[#0B0E14]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isPending}
                      className="group relative w-full py-3.5 pl-6 pr-4 rounded-xl bg-[#ED500A] hover:bg-[#d64505] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-title font-bold text-sm shadow-md active:scale-[0.98] transition-all duration-300 flex items-center justify-between"
                    >
                      {isPending ? (
                        <span className="w-full text-center tracking-wide">Verificando...</span>
                      ) : (
                        <>
                          <span className="tracking-wide">Verificar Código</span>
                          <div className="w-8 h-8 rounded-lg bg-black/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-slate-800 transition-colors focus:outline-none"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Cambiar correo</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-[#ED500A] hover:text-[#d64505] disabled:text-slate-300 transition-colors focus:outline-none"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                        <span>Reenviar código</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: Nueva Contraseña */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2.5">
                <h1 className="text-3xl font-extrabold font-title tracking-tight text-[#0B0E14]">
                  Nueva Contraseña
                </h1>
                <p className="text-sm text-slate-500">
                  Código verificado correctamente. Define tu nueva contraseña de acceso.
                </p>
              </div>

              <div className="p-1.5 bg-[#F8F9FD]/90 ring-1 ring-slate-200/50 rounded-[2.5rem] shadow-sm">
                <div className="bg-white p-8 sm:p-10 rounded-[calc(2.5rem-0.375rem)] border border-slate-100/80 shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
                  <form onSubmit={handleUpdatePassword} className="space-y-5">
                    
                    {/* Contraseña */}
                    <div className="space-y-2">
                      <label htmlFor="password" className="text-xs font-mono font-medium text-slate-600">
                        Nueva Contraseña
                      </label>
                      <div className="relative group">
                        <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-[#ED500A] transition-colors" />
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="••••••••••••"
                          value={passwordValue}
                          onChange={(e) => setPasswordValue(e.target.value)}
                          className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-[#F8F9FD]/60 text-sm focus:ring-2 focus:ring-[#ED500A] focus:border-transparent outline-none transition-all duration-300 placeholder-slate-400 text-[#0B0E14]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Checklist de requisitos en tiempo real */}
                      {passwordValue.length > 0 ? (
                        <ul className="mt-2 space-y-1.5">
                          {passwordRules.map((rule, i) => (
                            <li
                              key={i}
                              className={`flex items-center gap-2 text-[11px] font-mono transition-colors duration-200 ${
                                rule.valid ? "text-emerald-600" : "text-rose-500"
                              }`}
                            >
                              <span className="text-base leading-none">{rule.valid ? "✓" : "✗"}</span>
                              <span>{rule.label}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] font-mono text-slate-400 leading-normal mt-1">
                          Escribe tu contraseña para ver los requisitos.
                        </p>
                      )}
                    </div>

                    {/* Confirmar Contraseña */}
                    <div className="space-y-2">
                      <label htmlFor="confirmPassword" className="text-xs font-mono font-medium text-slate-600">
                        Confirmar Nueva Contraseña
                      </label>
                      <div className="relative group">
                        <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-[#ED500A] transition-colors" />
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          placeholder="••••••••••••"
                          className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-[#F8F9FD]/60 text-sm focus:ring-2 focus:ring-[#ED500A] focus:border-transparent outline-none transition-all duration-300 placeholder-slate-400 text-[#0B0E14]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isPending}
                      className="group relative w-full py-3.5 pl-6 pr-4 rounded-xl bg-[#ED500A] hover:bg-[#d64505] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-title font-bold text-sm shadow-md active:scale-[0.98] transition-all duration-300 flex items-center justify-between"
                    >
                      {isPending ? (
                        <span className="w-full text-center tracking-wide">Restableciendo contraseña...</span>
                      ) : (
                        <>
                          <span className="tracking-wide">Guardar Contraseña</span>
                          <div className="w-8 h-8 rounded-lg bg-black/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Derecho */}
        <div className="text-xs text-slate-400 text-center font-mono py-2">
          &copy; {new Date().getFullYear()} NEGOVA Precision Logic. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
}
