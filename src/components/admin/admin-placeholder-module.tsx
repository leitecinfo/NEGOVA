import React from "react";
import Link from "next/link";
import { LucideIcon, ArrowLeft, Terminal, Shield, Lock } from "lucide-react";
import { AdminPageContainer } from "./admin-page-container";

interface AdminPlaceholderModuleProps {
  title: string;
  description: string;
  icon: LucideIcon;
  route: string;
  requiredRole?: string;
  contextType?: "platform" | "tenant";
}

export function AdminPlaceholderModule({
  title,
  description,
  icon: Icon,
  route,
  requiredRole = "super_admin",
  contextType = "platform",
}: AdminPlaceholderModuleProps) {
  return (
    <AdminPageContainer
      title={title}
      description={description}
      badge={
        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
          En preparación
        </span>
      }
    >
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-8 sm:p-12 text-center space-y-8 max-w-3xl mx-auto shadow-xs">
        {/* Icono central */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-50 dark:bg-white/[0.03] border border-orange-200/60 dark:border-white/[0.08] flex items-center justify-center shadow-2xs">
          <Icon className="w-8 h-8 text-[#ED500A]" />
        </div>

        {/* Mensaje descriptivo */}
        <div className="space-y-2 max-w-md mx-auto">
          <h2 className="text-lg font-bold font-title text-slate-900 dark:text-white">
            Módulo de {title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-body">
            La infraestructura de navegación y permisos de este módulo ya se encuentra configurada en el Admin Layout. La lógica de negocio, consultas de datos y formularios se construirán en la siguiente fase.
          </p>
        </div>

        {/* Fichas técnicas de arquitectura */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-1">
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-[#ED500A]" />
              Ruta del Módulo
            </span>
            <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">{route}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-1">
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Rol Autorizado
            </span>
            <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">{requiredRole}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-1">
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              Contexto
            </span>
            <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 capitalize">{contextType}</p>
          </div>
        </div>

        {/* Botón de retorno al Dashboard */}
        <div className="pt-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Dashboard de Plataforma</span>
          </Link>
        </div>
      </div>
    </AdminPageContainer>
  );
}
