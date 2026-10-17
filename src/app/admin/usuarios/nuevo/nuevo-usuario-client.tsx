"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Shield,
  Building2,
  KeyRound,
  Mail,
  Phone,
  Sparkles,
  ShieldCheck,
  Check,
  Copy,
  ArrowRight,
  Info,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { UserType, UserStatus } from "@/lib/auth/users-service";
import { RoleDefinitionMeta } from "@/lib/auth/permissions";
import { createUserAction } from "../actions";
import {
  AdminInput,
  AdminSelect,
  AdminButton,
} from "@/components/admin/ui";
import { ModalPortal } from "@/components/ui/modal-portal";

interface NuevoUsuarioClientProps {
  platformRoles: RoleDefinitionMeta[];
  businessRoles: RoleDefinitionMeta[];
}

export function NuevoUsuarioClient({
  platformRoles,
  businessRoles,
}: NuevoUsuarioClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Tipo de cuenta
  const [userType, setUserType] = useState<UserType>("platform");

  // Datos Personales
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Rol y Estado
  const [selectedRoleCode, setSelectedRoleCode] = useState(
    platformRoles.find((r) => r.code === "admin")?.code || platformRoles[0]?.code || "admin"
  );
  const [status, setStatus] = useState<UserStatus>("active");

  // Modo de Contraseña
  const [passwordMode, setPasswordMode] = useState<"generate" | "custom">("generate");
  const [customPassword, setCustomPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);

  // Modal de Credenciales Generadas (One-Time Display)
  const [credentialsModal, setCredentialsModal] = useState<{
    isOpen: boolean;
    userId: string;
    email: string;
    fullName: string;
    temporaryPassword?: string;
    roleName: string;
    userType: UserType;
  }>({
    isOpen: false,
    userId: "",
    email: "",
    fullName: "",
    roleName: "",
    userType: "business",
  });

  const [copiedPass, setCopiedPass] = useState(false);

  // Manejar cambio de tipo de usuario
  const handleTypeChange = (type: UserType) => {
    setUserType(type);
    if (type === "platform") {
      setSelectedRoleCode(platformRoles.find((r) => r.code === "admin")?.code || platformRoles[0]?.code || "admin");
    } else {
      setSelectedRoleCode(businessRoles.find((r) => r.code === "owner")?.code || businessRoles[0]?.code || "owner");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName) {
      toast.error("Por favor ingresa el nombre del usuario.");
      return;
    }

    if (!email || !email.includes("@")) {
      toast.error("Por favor ingresa un correo electrónico válido.");
      return;
    }

    if (passwordMode === "custom" && customPassword.length < 8) {
      toast.error("La contraseña manual debe tener al menos 8 caracteres.");
      return;
    }

    startTransition(async () => {
      const res = await createUserAction({
        email,
        fullName,
        phone: phone.trim() || undefined,
        type: userType,
        status,
        roleCode: selectedRoleCode,
        password: passwordMode === "custom" ? customPassword : undefined,
        mustChangePassword,
      });

      if (res.success && res.user) {
        toast.success("Usuario creado exitosamente.");
        const roleInfo =
          userType === "platform"
            ? platformRoles.find((r) => r.code === selectedRoleCode)?.name
            : businessRoles.find((r) => r.code === selectedRoleCode)?.name;

        setCredentialsModal({
          isOpen: true,
          userId: res.user.id,
          email: res.user.email,
          fullName: res.user.fullName,
          temporaryPassword: res.temporaryPassword,
          roleName: roleInfo || selectedRoleCode,
          userType,
        });
      } else {
        toast.error(res.error || "No fue posible crear el usuario.");
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPass(true);
    toast.success("Contraseña copiada al portapapeles.");
    setTimeout(() => setCopiedPass(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl font-body">
      {/* 1. SELECTOR DE TIPO DE CUENTA */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title">
            1. Selecciona el Tipo de Cuenta
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Diferenciación estricta entre colaboradores internos de NEGOVA y usuarios de negocios.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Opción A: Equipo NEGOVA */}
          <button
            type="button"
            onClick={() => handleTypeChange("platform")}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              userType === "platform"
                ? "bg-[#ED500A]/5 border-[#ED500A] dark:bg-[#ED500A]/10 shadow-xs ring-1 ring-[#ED500A]/30"
                : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-slate-300"
            }`}
          >
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                userType === "platform"
                  ? "bg-[#ED500A] text-white"
                  : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              <Shield className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                Equipo NEGOVA (Plataforma Core)
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Personal administrativo y técnico interno (Super Admin, Administrador de soporte, Auditor).
              </p>
            </div>
          </button>

          {/* Opción B: Usuario de Negocio */}
          <button
            type="button"
            onClick={() => handleTypeChange("business")}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              userType === "business"
                ? "bg-purple-500/5 border-purple-500 dark:bg-purple-500/10 shadow-xs ring-1 ring-purple-500/30"
                : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-slate-300"
            }`}
          >
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                userType === "business"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                Usuario de Negocio (Comercio)
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Crea el usuario para un comercio (Dueño, Administrador, Cajero, etc.). La vinculación al negocio se realiza posteriormente.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 2. FORMULARIO PRINCIPAL */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloque A: Datos Personales */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title">
            2. Datos de Identidad y Contacto
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AdminInput
              label="Nombre(s)"
              required
              placeholder="Ej. Carlos"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              leftIcon={<User className="w-4 h-4 text-slate-400" />}
            />

            <AdminInput
              label="Apellido(s)"
              required
              placeholder="Ej. Rodríguez"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />

            <AdminInput
              label="Correo Electrónico"
              type="email"
              required
              placeholder="usuario@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
            />

            <AdminInput
              label="Teléfono de Contacto (Opcional)"
              type="tel"
              placeholder="300 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
            />
          </div>
        </div>

        {/* Bloque B: Rol y Estado */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title">
              3. Rol Inicial y Estado de Cuenta
            </h3>
          </div>

          {userType === "business" && (
            <div className="p-3 rounded-2xl text-xs bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
              <p>
                Este usuario se creará como cuenta de negocio independiente. Podrás asociarlo a uno o varios comercios posteriormente desde su ficha de usuario o al registrar un negocio.
              </p>
            </div>
          )}

          {/* Selector de Rol */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Rol Inicial Asignado <span className="text-red-500">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(userType === "platform" ? platformRoles : businessRoles).map((role) => {
                const isSelected = selectedRoleCode === role.code;

                return (
                  <div
                    key={role.code}
                    onClick={() => setSelectedRoleCode(role.code)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? userType === "platform"
                          ? "bg-[#ED500A]/5 border-[#ED500A] dark:bg-[#ED500A]/10 shadow-xs ring-1 ring-[#ED500A]/30"
                          : "bg-purple-500/5 border-purple-500 dark:bg-purple-500/10 shadow-xs ring-1 ring-purple-500/30"
                        : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold text-xs ${isSelected ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-200"}`}>
                        {role.name}
                      </span>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-md border ${role.badgeColor}`}>
                        {role.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {role.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selector de Estado */}
          <div className="pt-2">
            <AdminSelect
              label="Estado Inicial de la Cuenta"
              value={status}
              onChange={(val) => setStatus(val as UserStatus)}
              options={[
                { value: "active", label: "Activo (Acceso habilitado)" },
                { value: "disabled", label: "Deshabilitado (Sin acceso temporal)" },
              ]}
            />
          </div>
        </div>

        {/* Bloque C: Seguridad y Contraseña */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title">
            4. Seguridad y Credenciales de Acceso
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPasswordMode("generate")}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                passwordMode === "generate"
                  ? "bg-[#ED500A]/5 border-[#ED500A] dark:bg-[#ED500A]/10 shadow-xs"
                  : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                <Sparkles className="w-4 h-4 text-[#ED500A]" />
                Autogenerar Contraseña Temporal
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Genera una clave aleatoria de 14 caracteres de alta entropía.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPasswordMode("custom")}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                passwordMode === "custom"
                  ? "bg-[#ED500A]/5 border-[#ED500A] dark:bg-[#ED500A]/10 shadow-xs"
                  : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                <KeyRound className="w-4 h-4 text-slate-500" />
                Definir Contraseña Manual
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Establecer una clave temporal específica (mínimo 8 caracteres).
              </p>
            </button>
          </div>

          {passwordMode === "custom" && (
            <div className="pt-2">
              <AdminInput
                label="Contraseña Temporal"
                type={showPassword ? "text" : "password"}
                required
                placeholder="Mínimo 8 caracteres..."
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                leftIcon={<KeyRound className="w-4 h-4 text-slate-400" />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="mustChangePassword"
              checked={mustChangePassword}
              onChange={(e) => setMustChangePassword(e.target.checked)}
              className="w-4 h-4 rounded text-[#ED500A] focus:ring-[#ED500A] accent-[#ED500A]"
            />
            <label htmlFor="mustChangePassword" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
              Exigir cambio obligatorio de contraseña en el primer inicio de sesión
            </label>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <AdminButton
            variant="ghost"
            size="md"
            disabled={isPending}
            onClick={() => router.push("/admin/usuarios")}
          >
            Cancelar
          </AdminButton>
          <AdminButton
            type="submit"
            variant="primary"
            size="md"
            isLoading={isPending}
          >
            Crear Usuario
          </AdminButton>
        </div>
      </form>

      {/* MODAL DE CREDENCIALES GENERADAS */}
      {credentialsModal.isOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.12] rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                    Usuario Creado Exitosamente
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Credenciales de acceso provisional
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] space-y-3">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">
                    Nombre Completo
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {credentialsModal.fullName}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">
                    Correo de Acceso
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    {credentialsModal.email}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">
                    Rol Inicial
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {credentialsModal.roleName}
                  </p>
                </div>

                {credentialsModal.temporaryPassword && (
                  <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08]">
                    <span className="text-[10px] uppercase font-mono text-[#ED500A] block font-bold">
                      Contraseña Temporal
                    </span>
                    <div className="flex items-center justify-between gap-2 mt-1 p-2.5 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 font-mono text-xs text-slate-900 dark:text-white">
                      <span className="select-all font-bold tracking-wider">{credentialsModal.temporaryPassword}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(credentialsModal.temporaryPassword || "")}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        title="Copiar contraseña"
                      >
                        {copiedPass ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Aviso informativo y acción de asignación de negocio */}
              {credentialsModal.userType === "business" && (
                <div className="p-3.5 rounded-2xl text-xs bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Usuario sin negocio asignado todavía</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                    El usuario fue creado correctamente en el sistema. Puedes vincularlo a un negocio ahora mismo desde su vista de detalle o hacerlo más tarde.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCredentialsModal((prev) => ({ ...prev, isOpen: false }));
                    router.push("/admin/usuarios");
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-xs font-semibold text-slate-800 dark:text-white transition-colors text-center"
                >
                  Volver a Usuarios
                </button>

                {credentialsModal.userType === "business" ? (
                  <Link
                    href="/admin/negocios/nuevo"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-xs font-semibold text-white transition-colors text-center flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Crear / Asignar Negocio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <Link
                    href={`/admin/usuarios/${credentialsModal.userId}`}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-xs font-semibold text-white transition-colors text-center flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Ver Perfil</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
