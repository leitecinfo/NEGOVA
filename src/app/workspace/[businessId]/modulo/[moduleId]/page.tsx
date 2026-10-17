import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Hammer,
  Clock,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Receipt,
  Store,
  Settings,
  Bell,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import {
  getWorkspaceModuleById,
  isGastronomyBusiness,
} from "@/config/workspace-navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string; moduleId: string }>;
}): Promise<Metadata> {
  const { moduleId } = await params;
  const moduleDef = getWorkspaceModuleById(moduleId);

  if (!moduleDef || moduleDef.level === "global") {
    return {
      title: "Módulo no encontrado | Workspace NEGOVA",
      description: "El módulo solicitado no existe en NEGOVA.",
    };
  }

  return {
    title: `${moduleDef.label} (En construcción) | Workspace NEGOVA`,
    description: moduleDef.shortDescription || "Módulo en desarrollo para el comercio.",
  };
}

export default async function WorkspaceModulePlaceholderPage({
  params,
}: {
  params: Promise<{ businessId: string; moduleId: string }>;
}) {
  const { businessId, moduleId } = await params;

  // 1. Validar sesión del workspace y membresía activa del usuario en el comercio
  const session = await requireWorkspaceSession(businessId, "none");

  // 2. Obtener definición del módulo desde el catálogo centralizado
  const moduleDef = getWorkspaceModuleById(moduleId);

  // Si el módulo no existe o es un módulo exclusivo de nivel global (/admin), devolver 404 real
  if (!moduleDef || moduleDef.level === "global") {
    notFound();
  }

  // 3. Si es un módulo específico gastronómico y el comercio NO es gastronómico, devolver 404 real
  const isGastronomyModule = moduleDef.level === "specific" || moduleDef.group === "comida_rapida";
  if (isGastronomyModule && !isGastronomyBusiness(session.businessType)) {
    notFound();
  }

  // 4. Si el módulo ya está completamente implementado, redirigir a su ruta real correspondiente
  if (moduleDef.status === "implemented") {
    const targetPath = moduleDef.href
      ? `/workspace/${businessId}/${moduleDef.href}`
      : `/workspace/${businessId}`;
    redirect(targetPath);
  }

  const Icon = moduleDef.icon;
  const details = moduleDef.underConstructionDetails || {
    category: moduleDef.groupLabel,
    summary:
      "Este módulo se encuentra actualmente en fase de ingeniería y estará disponible próximamente con funcionalidades optimizadas para tu comercio.",
    plannedFeatures: [
      "Integración nativa con la base de datos de tu comercio.",
      "Métricas y registros en tiempo real.",
      "Seguridad multi-tenant y control de permisos por rol.",
    ],
  };

  return (
    <AppPageContainer
      title={moduleDef.label}
      description={moduleDef.shortDescription}
      maxWidth="5xl"
      badge={
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold font-mono">
          <Hammer className="w-3.5 h-3.5 animate-pulse text-amber-600 dark:text-amber-400" />
          <span>En construcción</span>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Banner Informativo Principal */}
        <div className="p-6 sm:p-8 rounded-3xl bg-linear-to-br from-white via-slate-50 to-orange-50/20 dark:from-[#0D0F16] dark:via-[#111420] dark:to-[#1a120b] border border-slate-200/80 dark:border-white/[0.08] shadow-sm relative overflow-hidden">
          {/* Fondo sutil */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
            <div className="p-4 rounded-2xl bg-orange-500/10 text-[#ED500A] border border-orange-500/20 shadow-xs shrink-0">
              <Icon className="w-10 h-10" />
            </div>

            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                  {details.category}
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  • Grupo: <strong className="text-slate-700 dark:text-slate-300">{moduleDef.groupLabel}</strong>
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold font-title text-slate-900 dark:text-white tracking-tight">
                Módulo en fase de desarrollo
              </h2>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-body max-w-3xl">
                {details.summary}
              </p>
            </div>
          </div>
        </div>

        {/* Capacidades y Funcionalidades Planificadas */}
        <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-title font-bold text-sm">
            <Sparkles className="w-4 h-4 text-[#ED500A]" />
            <h3>Capacidades planificadas para este módulo</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {details.plannedFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] flex items-start gap-3 transition-colors hover:border-slate-300 dark:hover:border-white/[0.08]"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-body">
                  {feat}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Accesos Rápidos a Módulos Operativos */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-white/[0.06] pb-3">
            <div>
              <h4 className="text-sm font-bold font-title text-slate-900 dark:text-white">
                Navegación del Comercio ({session.businessName})
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Accede a los módulos actualmente activos y operacionales dentro de tu espacio de trabajo.
              </p>
            </div>

            <Link
              href={`/workspace/${businessId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-xs font-semibold text-slate-800 dark:text-white transition-colors shrink-0"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#ED500A]" />
              <span>Ir al Inicio</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <Link
              href={`/workspace/${businessId}/pos`}
              className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] hover:border-orange-500/30 dark:hover:border-[#ED500A]/30 hover:bg-orange-50/20 dark:hover:bg-[#ED500A]/5 transition-all flex items-center gap-3 group"
            >
              <div className="p-2 rounded-xl bg-orange-500/10 text-[#ED500A] group-hover:scale-105 transition-transform">
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors">
                  Punto de venta
                </p>
                <p className="text-[11px] text-slate-400 truncate">Operación ágil y comandas</p>
              </div>
            </Link>

            <Link
              href={`/workspace/${businessId}/notificaciones`}
              className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] hover:border-orange-500/30 dark:hover:border-[#ED500A]/30 hover:bg-orange-50/20 dark:hover:bg-[#ED500A]/5 transition-all flex items-center gap-3 group"
            >
              <div className="p-2 rounded-xl bg-orange-500/10 text-[#ED500A] group-hover:scale-105 transition-transform">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors">
                  Notificaciones
                </p>
                <p className="text-[11px] text-slate-400 truncate">Alertas del comercio</p>
              </div>
            </Link>

            <Link
              href={`/workspace/${businessId}/configuracion`}
              className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] hover:border-orange-500/30 dark:hover:border-[#ED500A]/30 hover:bg-orange-50/20 dark:hover:bg-[#ED500A]/5 transition-all flex items-center gap-3 group"
            >
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-105 transition-transform">
                <Settings className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors">
                  Configuración
                </p>
                <p className="text-[11px] text-slate-400 truncate">Ajustes y comprobantes</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppPageContainer>
  );
}
