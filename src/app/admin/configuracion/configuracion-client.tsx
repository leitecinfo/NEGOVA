"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sliders,
  Lock,
  UserCheck,
  Bell,
  Cpu,
  Wallet,
  Gauge,
  History,
  Save,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Building2,
  User,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  ExternalLink,
  Eye,
  EyeOff,
  Server,
  Database,
  Globe,
  Mail,
  Smartphone,
  CreditCard,
  Key,
  Timer,
  Zap,
  Check,
  Sparkles,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  PlatformFullConfig,
  PlatformConfigSectionId,
  PlatformGeneralConfig,
  PlatformSecurityConfig,
  AdminSessionPolicy,
  BusinessSessionPolicy,
  PlatformUsersAccessConfig,
  PlatformBillingConfig,
  PlatformPlanLimitsConfig,
  PlatformAuditConfig,
  DEFAULT_PLATFORM_CONFIG,
  NEGOVA_INSTITUTIONAL_PROFILE,
} from "@/types/config/platform-config";
import { updatePlatformConfigSection } from "./actions";

interface ConfiguracionClientProps {
  initialConfig: PlatformFullConfig;
  userRole?: string;
}

interface SectionTab {
  id: PlatformConfigSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const CONFIG_TABS: SectionTab[] = [
  {
    id: "general",
    label: "General",
    icon: Sliders,
    description: "Identidad institucional, país, moneda base y parámetros globales",
  },
  {
    id: "seguridad",
    label: "Seguridad",
    icon: Lock,
    description: "Políticas de contraseñas, sesiones, MFA y control de fuerza bruta",
  },
  {
    id: "usuarios-acceso",
    label: "Usuarios y acceso",
    icon: UserCheck,
    description: "Roles internos de NEGOVA, permisos por defecto e invitaciones",
  },
  {
    id: "facturacion",
    label: "Facturación",
    icon: Wallet,
    description: "Modelo de cobro manual, moneda base COP y datos fiscales de la plataforma",
  },
  {
    id: "planes-limites",
    label: "Planes y límites",
    icon: Gauge,
    description: "Catálogo de planes oficiales y límites soportados (Inicio, Crece, Negocio)",
  },
  {
    id: "auditoria",
    label: "Auditoría",
    icon: History,
    description: "Políticas de retención de registros y filtros de severidad",
  },
];

export function ConfiguracionClient({ initialConfig, userRole }: ConfiguracionClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTabParam = searchParams.get("tab") as PlatformConfigSectionId | null;

  const isSuperAdmin = userRole === "super_admin";

  const [activeTab, setActiveTab] = useState<PlatformConfigSectionId>(
    currentTabParam && CONFIG_TABS.some((t) => t.id === currentTabParam)
      ? currentTabParam
      : "general"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const [generalConfig, setGeneralConfig] = useState<PlatformGeneralConfig>(() => ({
    ...DEFAULT_PLATFORM_CONFIG.general,
    ...(initialConfig.general || {}),
    naturalHolder: {
      ...DEFAULT_PLATFORM_CONFIG.general.naturalHolder,
      ...(initialConfig.general?.naturalHolder || {}),
    },
    legalHolder: {
      ...DEFAULT_PLATFORM_CONFIG.general.legalHolder,
      ...(initialConfig.general?.legalHolder || {}),
    },
  }));
  const [securityConfig, setSecurityConfig] = useState<PlatformSecurityConfig>(() => {
    const defaultAdmin: AdminSessionPolicy = {
      inactivityTimeoutMinutes: 60,
      maxSessionHours: 24,
      requireMfa: true,
      requireReauthForSensitive: true,
    };
    const defaultBusiness: BusinessSessionPolicy = {
      persistentSessionsEnabled: true,
      maxSessionDays: 30,
      inactivityTimeoutMinutes: null,
      requireReauthForSensitive: true,
      enforceImmediateRevocation: true,
    };
    return {
      ...initialConfig.seguridad,
      adminSession: {
        ...defaultAdmin,
        ...(initialConfig.seguridad?.adminSession || {}),
      },
      businessSession: {
        ...defaultBusiness,
        ...(initialConfig.seguridad?.businessSession || {}),
      },
    };
  });
  const [usersAccessConfig, setUsersAccessConfig] = useState<PlatformUsersAccessConfig>(() => {
    const defaultUsersAccess: PlatformUsersAccessConfig = {
      allowedRoles: ["super_admin", "staff", "auditor"],
      allowAdminInvitations: true,
      invitationExpiryHours: 48,
      whoCanInvite: "super_admin_only",
      defaultUserStatus: "active",
      enforceEmailVerification: true,
      accountActivationPolicy: "immediate",
      requireMfaForInternal: true,
      requireReauthForSensitive: true,
      inactivityTimeoutMinutes: 60,
      maxSessionHours: 24,
      allowAdminSelfRegistration: false,
    };
    return {
      ...defaultUsersAccess,
      ...(initialConfig.usuariosAcceso || {}),
    };
  });
  const [billingConfig, setBillingConfig] = useState<PlatformBillingConfig>(() => ({
    ...DEFAULT_PLATFORM_CONFIG.facturacion,
    ...(initialConfig.facturacion || {}),
  }));
  const [planLimitsConfig, setPlanLimitsConfig] = useState<PlatformPlanLimitsConfig>(initialConfig.planesLimites);
  const [auditConfig, setAuditConfig] = useState<PlatformAuditConfig>(initialConfig.auditoria);

  // Manejador de cambio de pestaña con sincronización de URL
  const handleTabChange = (tabId: PlatformConfigSectionId) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.replace(`/admin/configuracion?${params.toString()}`, { scroll: false });
  };

  // Guardar sección activa mediante Server Action
  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSuperAdmin) {
      toast.error("Permiso denegado", {
        description: "Se requiere rol de Superadministrador activo para modificar la configuración de plataforma.",
      });
      return;
    }

    if (activeTab === "general" || activeTab === "planes-limites") {
      return;
    }

    startTransition(async () => {
      let res: { success: boolean; error?: string; message?: string };

      switch (activeTab) {
        case "seguridad":
          res = await updatePlatformConfigSection("seguridad", securityConfig);
          break;
        case "usuarios-acceso":
          res = await updatePlatformConfigSection("usuariosAcceso", usersAccessConfig);
          break;
        case "facturacion":
          res = await updatePlatformConfigSection("facturacion", billingConfig);
          break;
        case "auditoria":
          res = await updatePlatformConfigSection("auditoria", auditConfig);
          break;
        default:
          res = { success: false, error: "Esta sección es solo informativa y no requiere guardado." };
      }

      if (res.success) {
        toast.success("Configuración guardada exitosamente", {
          description: res.message || "Los parámetros han sido aplicados y registrados en auditoría.",
        });
      } else {
        toast.error("Error al guardar", {
          description: res.error || "No se pudo actualizar la configuración.",
        });
      }
    });
  };

  // Filtrado de pestañas según búsqueda rápida
  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return CONFIG_TABS;
    const q = searchQuery.toLowerCase();
    return CONFIG_TABS.filter(
      (tab) => tab.label.toLowerCase().includes(q) || tab.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const activeTabMeta = CONFIG_TABS.find((t) => t.id === activeTab) || CONFIG_TABS[0];
  const ActiveIcon = activeTabMeta.icon;

  return (
    <div className="space-y-6">
      {/* 1. INDICADOR DISCRETO DE ÁMBITO DE PLATAFORMA */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-title text-slate-900 dark:text-white">
              Configuración Global NEGOVA Core
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ajustes de infraestructura y seguridad que rigen toda la plataforma.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-semibold flex items-center gap-1.5 border border-[#ED500A]/20">
            <Server className="w-3.5 h-3.5" />
            <span>Ámbito Plataforma</span>
          </span>
        </div>
      </div>

      {/* 2. LAYOUT PRINCIPAL DE CONFIGURACIÓN: NAVEGACIÓN LATERAL + PANEL DE EDICIÓN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* NAVEGACIÓN COMPACTA EN MÓVIL (HORIZONTAL SCROLL BAR) */}
        <div className="lg:hidden col-span-1 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-3 shadow-xs space-y-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar sección..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all font-body"
            />
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-1.5 pb-1">
            {filteredTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#ED500A] text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200/70 dark:bg-white/[0.04] dark:text-slate-300"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PANEL IZQUIERDO: LISTADO DE SUBSECCIONES (DESKTOP) */}
        <div className="hidden lg:block lg:col-span-4 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl p-4 shadow-xs space-y-3">
          {/* Buscador de ajustes */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar sección o parámetro..."
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all font-body"
            />
          </div>

          <div className="space-y-1">
            {filteredTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-all cursor-pointer ${
                    isActive
                      ? "bg-orange-50 border border-orange-200/80 text-[#ED500A] dark:bg-[#ED500A]/10 dark:border-[#ED500A]/20 dark:text-white font-semibold shadow-xs"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      isActive
                        ? "bg-[#ED500A] text-white"
                        : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-title truncate">{tab.label}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 font-body mt-0.5">
                      {tab.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PANEL DERECHO: FORMULARIO ACTIVO SEGÚN LA PESTAÑA SELECCIONADA */}
        <div className="lg:col-span-8 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xs">
          <form onSubmit={handleSaveSection} className="space-y-6">
            {/* Header de la Subsección Activa */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl bg-orange-50 dark:bg-[#ED500A]/15 text-[#ED500A] border border-orange-200 dark:border-[#ED500A]/30 shrink-0">
                  <ActiveIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-bold font-title text-slate-900 dark:text-white">
                    {activeTabMeta.label}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 sm:line-clamp-none">
                    {activeTabMeta.description}
                  </p>
                </div>
              </div>

              {/* Badges y botón de guardado según permisos y sección */}
              {activeTab === "general" && (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-mono font-medium flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                  <Check className="w-3.5 h-3.5" />
                  <span>Ficha Institucional Fija</span>
                </span>
              )}

              {activeTab === "planes-limites" && (
                <span className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-mono font-medium flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                  <Gauge className="w-3.5 h-3.5" />
                  <span>Catálogo Canónico Informativo</span>
                </span>
              )}

              {activeTab !== "general" && activeTab !== "planes-limites" && !isSuperAdmin && (
                <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-mono font-medium flex items-center gap-1.5 self-start sm:self-auto shrink-0" title="Solo el Superadministrador activo puede modificar la configuración de plataforma">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Solo Lectura (Superadmin Requerido)</span>
                </span>
              )}

              {activeTab !== "general" && activeTab !== "planes-limites" && isSuperAdmin && (
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#d44508] text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer shrink-0"
                >
                  {isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isPending ? "Guardando..." : "Guardar Cambios"}</span>
                </button>
              )}
            </div>

            {/* SECCIÓN 1: GENERAL */}
            {activeTab === "general" && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                {/* 1. IDENTIDAD DE LA PLATAFORMA (ESTÁTICA) */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold font-title text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-[#ED500A]" />
                        <span>Identidad Institucional</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Marca, posicionamiento y canales de contacto oficiales de la plataforma.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400 font-medium self-start sm:self-auto">
                      Definición Core
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Nombre de la Plataforma */}
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs">
                        <span className="text-[11px] text-slate-500 block font-medium">Nombre de la Plataforma</span>
                        <span className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 block font-title">
                          {NEGOVA_INSTITUTIONAL_PROFILE.platformName}
                        </span>
                      </div>

                      {/* Eslogan / Propuesta de Valor */}
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs">
                        <span className="text-[11px] text-slate-500 block font-medium">Eslogan / Propuesta de Valor</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                          {NEGOVA_INSTITUTIONAL_PROFILE.tagline}
                        </span>
                      </div>

                      {/* Correo de Soporte */}
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs">
                        <span className="text-[11px] text-slate-500 block font-medium">Correo de Soporte Institucional</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                          {NEGOVA_INSTITUTIONAL_PROFILE.supportEmail}
                        </span>
                      </div>

                      {/* Correo de Facturación */}
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs">
                        <span className="text-[11px] text-slate-500 block font-medium">Correo de Facturación y Finanzas</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                          {NEGOVA_INSTITUTIONAL_PROFILE.billingSupportEmail}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. FICHA DE INFORMACIÓN LEGAL Y FISCAL (NEGOVA CORE - ESTÁTICA) */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold font-title text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-[#ED500A]" />
                        <span>Ficha Legal y Fiscal (NEGOVA Core)</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Identidad legal y tributaria institucional del titular y la plataforma.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                        Titular Oficial
                      </span>
                    </div>
                  </div>

                  {/* FICHA TÉCNICA INSTITUCIONAL ESTÁTICA */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#ED500A]" />
                        <h4 className="text-xs font-bold font-title text-slate-900 dark:text-white uppercase tracking-wider">
                          Titular / Persona Natural Responsable
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-medium">
                        {NEGOVA_INSTITUTIONAL_PROFILE.holderType}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {/* Nombre Completo */}
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs sm:col-span-2 lg:col-span-3">
                        <span className="text-[11px] text-slate-500 block font-medium">Nombre Completo del Titular</span>
                        <span className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 block font-title">
                          {NEGOVA_INSTITUTIONAL_PROFILE.fullName}
                        </span>
                      </div>

                      {/* Tipo y Número de Documento */}
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs sm:col-span-1 lg:col-span-2">
                        <span className="text-[11px] text-slate-500 block font-medium">Documento de Identidad</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-semibold text-slate-900 dark:text-white font-mono">
                            {NEGOVA_INSTITUTIONAL_PROFILE.documentType}
                          </span>
                          <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                            {NEGOVA_INSTITUTIONAL_PROFILE.documentNumber}
                          </span>
                        </div>
                      </div>

                      {/* NIT / DIAN */}
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs">
                        <span className="text-[11px] text-slate-500 block font-medium">Identificación Tributaria (DIAN)</span>
                        <span className="font-bold font-mono text-[#ED500A] text-xs mt-0.5 block">
                          NIT {NEGOVA_INSTITUTIONAL_PROFILE.fullNit}
                        </span>
                      </div>

                      {/* Domicilio Fiscal */}
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs sm:col-span-2 lg:col-span-3">
                        <span className="text-[11px] text-slate-500 block font-medium">Domicilio Fiscal / Dirección Tributaria (RUT)</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                          {NEGOVA_INSTITUTIONAL_PROFILE.taxAddress}
                        </span>
                      </div>

                      {/* Dirección Comercial */}
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs sm:col-span-2 lg:col-span-3">
                        <span className="text-[11px] text-slate-500 block font-medium">Dirección Comercial / Sede de NEGOVA</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                          {NEGOVA_INSTITUTIONAL_PROFILE.commercialAddress}
                        </span>
                      </div>

                      {/* Régimen Tributario */}
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs sm:col-span-1 lg:col-span-2">
                        <span className="text-[11px] text-slate-500 block font-medium">Régimen Tributario</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {NEGOVA_INSTITUTIONAL_PROFILE.taxRegime}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400">
                            {NEGOVA_INSTITUTIONAL_PROFILE.holderType}
                          </span>
                        </div>
                      </div>

                      {/* IVA / Impuestos */}
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs">
                        <span className="text-[11px] text-slate-500 block font-medium">IVA / Impuestos</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5 block">
                          {NEGOVA_INSTITUTIONAL_PROFILE.taxStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. PARÁMETROS REGIONALES */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-4">
                  <h3 className="text-xs font-bold font-title text-slate-900 dark:text-white uppercase tracking-wider">
                    Parámetros Regionales
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          País Base
                        </label>
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400">
                          Fijo
                        </span>
                      </div>
                      <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.04] text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-3.5 rounded-xs overflow-hidden flex flex-col shadow-2xs border border-black/10 shrink-0">
                            <div className="h-[50%] bg-[#FCD116]" />
                            <div className="h-[25%] bg-[#003893]" />
                            <div className="h-[25%] bg-[#CE1126]" />
                          </div>
                          <span className="font-semibold">Colombia</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">CO (+57)</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Moneda Oficial
                        </label>
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-orange-50 text-[#ED500A] dark:bg-[#ED500A]/10 dark:text-[#ED500A] font-semibold">
                          Core
                        </span>
                      </div>
                      <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.04] text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center justify-between font-mono">
                        <span>COP</span>
                        <span className="text-xs font-bold text-[#ED500A]">$ COP</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Zona Horaria
                        </label>
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400">
                          UTC-5
                        </span>
                      </div>
                      <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.04] text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center justify-between font-mono">
                        <span>Bogota</span>
                        <span className="text-[11px] text-slate-500">UTC -05:00</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* SECCIÓN 2: SEGURIDAD Y POLÍTICAS DE SESIÓN */}
            {activeTab === "seguridad" && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                {/* 1. POLÍTICAS DE SESIÓN DIFERENCIADAS */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white flex items-center gap-2">
                        <Timer className="w-4 h-4 text-[#ED500A] shrink-0" />
                        <span>Políticas de Sesión Diferenciadas</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Configuración independiente de caducidad y persistencia para personal interno de NEGOVA vs. usuarios de comercio.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#ED500A]/10 text-[#ED500A] font-semibold whitespace-nowrap shrink-0 self-start sm:self-auto">
                      Multi-Tenant Security
                    </span>
                  </div>

                  <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
                    {/* BLOQUE A: USUARIOS INTERNOS DE NEGOVA */}
                    <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-50/80 dark:bg-white/[0.02] border border-orange-200/60 dark:border-orange-500/20 space-y-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />

                      {/* Header espacioso con jerarquía vertical */}
                      <div className="space-y-3 pb-3 border-b border-orange-200/40 dark:border-white/[0.04]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 shrink-0">
                              <ShieldAlert className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              Personal NEGOVA
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap shrink-0">
                            Seguridad Estricta
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm sm:text-base font-bold font-title text-slate-900 dark:text-white">
                            Usuarios Internos de NEGOVA
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Superadmin, Soporte, Finanzas y Administración
                          </p>
                        </div>
                      </div>

                      {/* Timeout de inactividad */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                          <span>Timeout por Inactividad</span>
                          <span className="text-[11px] font-mono text-[#ED500A] font-semibold">
                            {securityConfig.adminSession.inactivityTimeoutMinutes} min
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                          {[15, 30, 60, 120].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() =>
                                setSecurityConfig({
                                  ...securityConfig,
                                  adminSession: {
                                    ...securityConfig.adminSession,
                                    inactivityTimeoutMinutes: mins,
                                  },
                                })
                              }
                              className={`py-2 px-1 sm:px-2 rounded-xl text-[11px] sm:text-xs font-mono font-semibold transition-all cursor-pointer flex items-center justify-center ${
                                securityConfig.adminSession.inactivityTimeoutMinutes === mins
                                  ? "bg-[#ED500A] text-white shadow-xs"
                                  : "bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-[#ED500A]/40"
                              }`}
                            >
                              {mins}m
                            </button>
                          ))}
                          <div className="relative">
                            <input
                              type="number"
                              min={5}
                              max={720}
                              placeholder="Pers."
                              value={
                                [15, 30, 60, 120].includes(securityConfig.adminSession.inactivityTimeoutMinutes)
                                  ? ""
                                  : securityConfig.adminSession.inactivityTimeoutMinutes
                              }
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if (val > 0) {
                                  setSecurityConfig({
                                    ...securityConfig,
                                    adminSession: {
                                      ...securityConfig.adminSession,
                                      inactivityTimeoutMinutes: val,
                                    },
                                  });
                                }
                              }}
                              className={`w-full py-2 px-1 sm:px-2 rounded-xl text-[11px] sm:text-xs font-mono text-center border transition-all ${
                                ![15, 30, 60, 120].includes(securityConfig.adminSession.inactivityTimeoutMinutes)
                                  ? "bg-orange-50 dark:bg-[#ED500A]/10 border-[#ED500A] text-[#ED500A] font-bold"
                                  : "bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                              }`}
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-body">
                          La sesión administrativa se cerrará automáticamente al superar este tiempo sin actividad.
                        </p>
                      </div>

                      {/* Duración máxima de sesión administrativa */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                          <span>Duración Máxima de Sesión</span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {securityConfig.adminSession.maxSessionHours} horas
                          </span>
                        </div>
                        <select
                          value={securityConfig.adminSession.maxSessionHours}
                          onChange={(e) =>
                            setSecurityConfig({
                              ...securityConfig,
                              adminSession: {
                                ...securityConfig.adminSession,
                                maxSessionHours: Number(e.target.value) as 12 | 24 | 48,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-xs text-slate-900 dark:text-white font-mono"
                        >
                          <option value={12}>12 Horas (Jornada Administrativa)</option>
                          <option value={24}>24 Horas (1 Día - Recomendado)</option>
                          <option value={48}>48 Horas (2 Días)</option>
                        </select>
                      </div>

                      {/* Toggles de seguridad estricta para staff */}
                      <div className="space-y-2.5 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={securityConfig.adminSession.requireReauthForSensitive}
                            onChange={(e) =>
                              setSecurityConfig({
                                ...securityConfig,
                                adminSession: {
                                  ...securityConfig.adminSession,
                                  requireReauthForSensitive: e.target.checked,
                                },
                              })
                            }
                            className="w-4 h-4 accent-[#ED500A] mt-0.5 shrink-0"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              Reautenticación para acciones críticas
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Exige confirmar contraseña o 2FA antes de cambiar configuraciones globales o roles.
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={securityConfig.adminSession.requireMfa}
                            onChange={(e) =>
                              setSecurityConfig({
                                ...securityConfig,
                                adminSession: {
                                  ...securityConfig.adminSession,
                                  requireMfa: e.target.checked,
                                },
                                requireMfaForStaff: e.target.checked,
                              })
                            }
                            className="w-4 h-4 accent-[#ED500A] mt-0.5 shrink-0"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              MFA / 2FA obligatorio para staff
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Código de verificación al iniciar sesión en el panel de plataforma.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* BLOQUE B: USUARIOS DE NEGOCIOS (TENANTS) */}
                    <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-50/80 dark:bg-white/[0.02] border border-emerald-200/60 dark:border-emerald-500/20 space-y-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

                      {/* Header espacioso con jerarquía vertical */}
                      <div className="space-y-3 pb-3 border-b border-emerald-200/40 dark:border-white/[0.04]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              Tenants / Clientes
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap shrink-0">
                            Operación Continua
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm sm:text-base font-bold font-title text-slate-900 dark:text-white">
                            Usuarios de Negocios (Tenants)
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Propietarios, Administradores, Cajeros y Vendedores
                          </p>
                        </div>
                      </div>

                      {/* Explicación de sesión persistente */}
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-emerald-950 dark:text-emerald-200">
                          <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Sesión Persistente y Renovación Automática</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          Sin expulsiones por inactividad durante la jornada laboral. El usuario puede cerrar y reabrir el navegador sin perder su sesión de trabajo.
                        </p>
                      </div>

                      {/* Duración máxima configurable */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                          <span>Duración Máxima de Sesión</span>
                          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {securityConfig.businessSession.maxSessionDays} Días
                          </span>
                        </div>
                        <select
                          value={securityConfig.businessSession.maxSessionDays}
                          onChange={(e) =>
                            setSecurityConfig({
                              ...securityConfig,
                              businessSession: {
                                ...securityConfig.businessSession,
                                maxSessionDays: Number(e.target.value) as 7 | 14 | 30,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-xs text-slate-900 dark:text-white font-mono"
                        >
                          <option value={7}>7 Días (Rotación Semanal)</option>
                          <option value={14}>14 Días (Quincenal)</option>
                          <option value={30}>30 Días (1 Mes - Recomendado para Negocios)</option>
                        </select>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-body">
                          Tiempo total antes de requerir un nuevo inicio de sesión completo.
                        </p>
                      </div>

                      {/* Toggles de revocación y acciones sensibles en negocio */}
                      <div className="space-y-2.5 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={securityConfig.businessSession.enforceImmediateRevocation}
                            onChange={(e) =>
                              setSecurityConfig({
                                ...securityConfig,
                                businessSession: {
                                  ...securityConfig.businessSession,
                                  enforceImmediateRevocation: e.target.checked,
                                },
                              })
                            }
                            className="w-4 h-4 accent-emerald-600 mt-0.5 shrink-0"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              Revocación inmediata en suspensión o bloqueo
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Si el negocio o usuario se suspende, se bloquea el acceso en tiempo real sin eliminar datos.
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={securityConfig.businessSession.requireReauthForSensitive}
                            onChange={(e) =>
                              setSecurityConfig({
                                ...securityConfig,
                                businessSession: {
                                  ...securityConfig.businessSession,
                                  requireReauthForSensitive: e.target.checked,
                                },
                              })
                            }
                            className="w-4 h-4 accent-emerald-600 mt-0.5 shrink-0"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              Reautenticación para cambios críticos del comercio
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Solicita confirmación al editar datos fiscales, cambiar contraseña o roles de empleados.
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={securityConfig.requireMfaForOwners ?? true}
                            onChange={(e) =>
                              setSecurityConfig({
                                ...securityConfig,
                                requireMfaForOwners: e.target.checked,
                              })
                            }
                            className="w-4 h-4 accent-emerald-600 mt-0.5 shrink-0"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              MFA / 2FA obligatorio para Dueños de Negocio (Owner)
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Exige validación de código de seguridad de 6 dígitos enviado por correo al acceder al workspace.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. POLÍTICAS GLOBALES DE CONTRASEÑA Y CONTROL DE FUERZA BRUTA */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-4">
                  <div>
                    <h3 className="text-xs font-bold font-title text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Políticas de Contraseña y Control de Acceso</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Reglas de complejidad y protección contra ataques de fuerza bruta.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Longitud Mínima Clave
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={32}
                        value={securityConfig.minPasswordLength}
                        onChange={(e) => setSecurityConfig({ ...securityConfig, minPasswordLength: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Caducidad de Clave (Días)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={securityConfig.passwordExpirationDays}
                        onChange={(e) => setSecurityConfig({ ...securityConfig, passwordExpirationDays: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Máx. Intentos Fallidos
                      </label>
                      <input
                        type="number"
                        min={3}
                        max={10}
                        value={securityConfig.maxLoginAttempts}
                        onChange={(e) => setSecurityConfig({ ...securityConfig, maxLoginAttempts: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Bloqueo Temporal (Minutos)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={securityConfig.lockoutDurationMinutes}
                        onChange={(e) => setSecurityConfig({ ...securityConfig, lockoutDurationMinutes: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN 3: POLÍTICAS DE USUARIOS Y ACCESO */}
            {activeTab === "usuarios-acceso" && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                {/* 1. ROLES INTERNOS PREDETERMINADOS (RESUMEN Y ENLACE AL MÓDULO DE PERMISOS) */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-[#ED500A]" />
                        <span>Roles Internos Predeterminados</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Roles base autorizados para acceder al panel de administración central de NEGOVA.
                      </p>
                    </div>

                    <Link
                      href="/admin/roles"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ED500A] hover:underline self-start sm:self-auto"
                    >
                      <span>Gestionar matriz de permisos</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-[#ED500A]">super_admin</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">Total</span>
                      </div>
                      <p className="text-[11px] text-slate-500">Control total, finanzas, infraestructura y auditoría.</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">staff</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Operativo</span>
                      </div>
                      <p className="text-[11px] text-slate-500">Supervisión de comercios y mesa de ayuda técnica.</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-sky-600 dark:text-sky-400">auditor</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">Lectura</span>
                      </div>
                      <p className="text-[11px] text-slate-500">Acceso de solo lectura a logs y registros de trazabilidad.</p>
                    </div>
                  </div>
                </div>

                {/* 2. INVITACIONES ADMINISTRATIVAS */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-4">
                  <h3 className="text-xs font-bold font-title text-slate-900 dark:text-white uppercase tracking-wider">
                    Invitaciones Administrativas
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Quién puede emitir invitaciones
                      </label>
                      <select
                        value={usersAccessConfig.whoCanInvite}
                        onChange={(e) =>
                          setUsersAccessConfig({
                            ...usersAccessConfig,
                            whoCanInvite: e.target.value as "super_admin_only" | "super_admin_and_staff",
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-xs text-slate-900 dark:text-white font-mono"
                      >
                        <option value="super_admin_only">Solo Super Administrador (Recomendado)</option>
                        <option value="super_admin_and_staff">Super Administrador y Staff Autorizado</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Caducidad del Enlace de Invitación
                      </label>
                      <select
                        value={usersAccessConfig.invitationExpiryHours}
                        onChange={(e) =>
                          setUsersAccessConfig({
                            ...usersAccessConfig,
                            invitationExpiryHours: Number(e.target.value),
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-xs text-slate-900 dark:text-white font-mono"
                      >
                        <option value={24}>24 Horas (Alta Seguridad)</option>
                        <option value={48}>48 Horas (Estándar)</option>
                        <option value={72}>72 Horas (3 Días)</option>
                        <option value={168}>168 Horas (7 Días)</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={usersAccessConfig.allowAdminInvitations}
                      onChange={(e) =>
                        setUsersAccessConfig({
                          ...usersAccessConfig,
                          allowAdminInvitations: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-[#ED500A] mt-0.5 shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Habilitar emisión de invitaciones al panel interno
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Permite enviar enlaces de alta temporal por correo para incorporar nuevos miembros del staff.
                      </p>
                    </div>
                  </label>
                </div>

                {/* 3. NUEVOS USUARIOS Y POLÍTICA DE ACTIVACIÓN */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-4">
                  <h3 className="text-xs font-bold font-title text-slate-900 dark:text-white uppercase tracking-wider">
                    Nuevos Usuarios y Activación de Cuentas
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Estado Inicial de la Cuenta
                      </label>
                      <select
                        value={usersAccessConfig.defaultUserStatus}
                        onChange={(e) =>
                          setUsersAccessConfig({
                            ...usersAccessConfig,
                            defaultUserStatus: e.target.value as "active" | "pending_verification",
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-xs text-slate-900 dark:text-white font-mono"
                      >
                        <option value="active">Activo (Acceso Inmediato)</option>
                        <option value="pending_verification">Pendiente de Verificación</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Política de Activación
                      </label>
                      <select
                        value={usersAccessConfig.accountActivationPolicy}
                        onChange={(e) =>
                          setUsersAccessConfig({
                            ...usersAccessConfig,
                            accountActivationPolicy: e.target.value as "immediate" | "manual_approval",
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-xs text-slate-900 dark:text-white font-mono"
                      >
                        <option value="immediate">Activación Inmediata tras verificar email</option>
                        <option value="manual_approval">Aprobación manual requerida por Superadmin</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={usersAccessConfig.enforceEmailVerification}
                      onChange={(e) =>
                        setUsersAccessConfig({
                          ...usersAccessConfig,
                          enforceEmailVerification: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-[#ED500A] mt-0.5 shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Requerir verificación de correo electrónico obligatoria
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        El usuario debe confirmar el enlace enviado a su bandeja antes de poder ingresar.
                      </p>
                    </div>
                  </label>
                </div>

                {/* 4. POLÍTICAS DE ACCESO Y SEGURIDAD INTERNA */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-4">
                  <h3 className="text-xs font-bold font-title text-slate-900 dark:text-white uppercase tracking-wider">
                    Políticas de Acceso y MFA Interno
                  </h3>

                  <div className="space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usersAccessConfig.requireMfaForInternal}
                        onChange={(e) =>
                          setUsersAccessConfig({
                            ...usersAccessConfig,
                            requireMfaForInternal: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#ED500A] mt-0.5 shrink-0"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          Exigir MFA / 2FA obligatorio a personal administrativo
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Solicita código OTP de 6 dígitos enviado por correo en cada nuevo inicio de sesión.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usersAccessConfig.requireReauthForSensitive}
                        onChange={(e) =>
                          setUsersAccessConfig({
                            ...usersAccessConfig,
                            requireReauthForSensitive: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#ED500A] mt-0.5 shrink-0"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          Reautenticación requerida para acciones críticas
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Exige confirmar contraseña antes de alterar configuraciones de plataforma o roles.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN 4: FACTURACIÓN DE LA PLATAFORMA (REAL Y SIMPLE) */}
            {activeTab === "facturacion" && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                {/* 1. MODELO REAL ACTUAL DE COBRO */}
                <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#ED500A]" />
                      <h3 className="text-xs font-bold font-title text-slate-900 dark:text-white uppercase tracking-wider">
                        Modelo de Cobro Actual de NEGOVA
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                      Gestión Manual Activa
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    NEGOVA opera actualmente bajo un modelo de <strong>acuerdo directo con el cliente</strong> (vía WhatsApp o contacto directo). Los pagos se coordinan y verifican directamente, y la activación de planes o accesos se realiza de forma manual por el administrador desde el panel.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs">
                      <span className="text-slate-500 block text-[11px]">Método de Cobro</span>
                      <span className="font-semibold text-slate-900 dark:text-white">Gestión Manual Directa</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 text-xs">
                      <span className="text-slate-500 block text-[11px]">Pasarelas Automáticas</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">No configuradas</span>
                    </div>
                  </div>
                </div>

                {/* 2. FACTURACIÓN A CLIENTES DE NEGOVA */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] space-y-4">
                  <div>
                    <h3 className="text-xs font-bold font-title text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>Facturación Emitida por NEGOVA</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Parámetros para la generación de comprobantes o facturas que NEGOVA entrega a sus clientes.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Prefijo de Facturas (Referencial)
                        </label>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400">
                          Serie activa: CMP-
                        </span>
                      </div>
                      <input
                        type="text"
                        value={billingConfig.invoicePrefix || "NEG-"}
                        onChange={(e) => setBillingConfig({ ...billingConfig, invoicePrefix: e.target.value })}
                        placeholder="NEG-"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-xs font-mono text-slate-900 dark:text-white"
                      />
                      <p className="text-[10px] text-slate-400">
                        Prefijo de serie institucional configurado en plataforma. Nota: La emisión operativa de comprobantes SaaS actualmente genera con la serie oficial CMP-YYYY-XXXX.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Tratamiento de Impuestos
                      </label>
                      <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-xs text-slate-600 dark:text-slate-300">
                        No configurado / Sin impuestos definidos
                      </div>
                      <p className="text-[10px] text-slate-400">
                        La situación tributaria de NEGOVA se definirá posteriormente; no se asumen tasas automáticas de IVA.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. VINCULACIÓN DE IDENTIDAD FISCAL */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Datos Fiscales y Legales del SaaS</p>
                      <p className="text-[11px] text-slate-500">
                        La razón social, NIT, dirección fiscal y correos institucionales de NEGOVA se administran centralizadamente en la pestaña <strong>General</strong>.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTabChange("general")}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-xs font-semibold text-[#ED500A] hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
                  >
                    Ver en General →
                  </button>
                </div>
              </div>
            )}

            {/* SECCIÓN 7: PLANES Y LÍMITES (CANÓNICO Y HONESTO) */}
            {activeTab === "planes-limites" && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                {/* Nota de Política de Infraestructura */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold font-title text-slate-900 dark:text-white">
                        Política de Capacidades e Infraestructura
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Los planes reflejan capacidades reales sostenibles en Supabase. No se prometen cuotas arbitrarias de almacenamiento (GB) ni niveles Enterprise ficticios.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap self-start sm:self-auto">
                    Fuente Única de Verdad
                  </span>
                </div>

                {/* Grid de los 3 Planes Oficiales */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* 1. PLAN INICIO */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                          <h4 className="text-sm font-bold font-title text-slate-900 dark:text-white uppercase">
                            Plan Inicio
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                          30 Días Gratis
                        </span>
                      </div>

                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold font-title text-slate-900 dark:text-white">$29.900</span>
                          <span className="text-[11px] font-mono text-slate-500">COP / mes</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Para pequeños negocios que inician su orden operativo.</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.04] space-y-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Usuarios:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">1 Usuario</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Catálogo:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">Hasta 200 productos</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Sucursales:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">1 Sede (Monosede)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Registro POS & Gastos:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Incluido</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">NEGOVA AI:</span>
                          <span className="text-slate-400">No disponible</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Soporte:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">Estándar</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. PLAN CRECE */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border-2 border-[#ED500A]/40 dark:border-[#ED500A]/40 shadow-xs space-y-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0">
                      <span className="inline-block bg-[#ED500A] text-white font-mono text-[9px] font-extrabold uppercase px-3 py-1 rounded-bl-xl shadow-xs">
                        Recomendado
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ED500A]" />
                        <h4 className="text-sm font-bold font-title text-[#ED500A] uppercase">
                          Plan Crece
                        </h4>
                      </div>

                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold font-title text-slate-900 dark:text-white">$59.900</span>
                          <span className="text-[11px] font-mono text-slate-500">COP / mes</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Control de fiados, compras, variantes y estadísticas.</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.04] space-y-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Usuarios:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">Hasta 3 Usuarios</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Catálogo:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">Hasta 1.000 productos</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Sucursales:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">1 Sede (Monosede)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Fiados & Cuentas x Cobrar:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Incluido</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">NEGOVA AI:</span>
                          <span className="text-[#ED500A] font-semibold">Incluido</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Soporte:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">Prioritario</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. PLAN NEGOCIO */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                          <h4 className="text-sm font-bold font-title text-slate-900 dark:text-white uppercase">
                            Plan Negocio
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                          Equipos
                        </span>
                      </div>

                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold font-title text-slate-900 dark:text-white">$99.900</span>
                          <span className="text-[11px] font-mono text-slate-500">COP / mes</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Operación completa con colaboradores, roles y reportes avanzados.</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.04] space-y-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Usuarios:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">Hasta 6 Usuarios</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Catálogo:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">Hasta 3.000 productos</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Roles y Permisos:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Incluido</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Múltiples Puntos de Cobro:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Incluido</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">NEGOVA AI:</span>
                          <span className="text-[#ED500A] font-semibold">Avanzado</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Soporte:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">Directo</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bloque Informativo sobre Enterprise y Storage */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-white font-title flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      Plan Enterprise (Diferido)
                    </span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      No se comercializa actualmente. Se habilitará cuando el SaaS cuente con infraestructura dedicada, SLAs corporativos y soporte 24/7 para grandes empresas.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-white font-title flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      Almacenamiento de Archivos
                    </span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      El almacenamiento de comprobantes e imágenes se respalda en Supabase Storage sin prometer cuotas comerciales arbitrarias (ej. 50 GB) que comprometan la infraestructura.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN 8: AUDITORÍA */}
            {activeTab === "auditoria" && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Política de Retención de Logs Administrativos
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400">
                      Informativo
                    </span>
                  </div>
                  <select
                    value={auditConfig.retentionDays}
                    onChange={(e) => setAuditConfig({ ...auditConfig, retentionDays: Number(e.target.value) as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-xs text-slate-900 dark:text-white font-mono"
                  >
                    <option value={30}>30 Días (Estándar)</option>
                    <option value={60}>60 Días</option>
                    <option value={90}>90 Días (Recomendado)</option>
                    <option value={180}>180 Días (Semestral)</option>
                    <option value={365}>365 Días (1 Año - Cumplimiento)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-body">
                    Parámetro institucional registrado en plataforma. Actualmente no se ejecutan eliminaciones automáticas destructivas sobre el registro histórico de auditoría.
                  </p>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
