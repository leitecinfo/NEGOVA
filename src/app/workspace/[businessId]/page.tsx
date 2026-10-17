import React from "react";
import Link from "next/link";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getWorkspaceDashboardData } from "@/lib/documents/document-service";
import {
  TrendingUp,
  Receipt,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Settings,
  Calendar,
  CreditCard,
  Banknote,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { AppPageContainer } from "@/components/layout/app-page-container";

export default async function WorkspaceDashboardPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización multi-tenant para el Dashboard (sales.view)
  const session = await requireWorkspaceSession(businessId, "sales.view");

  // 2. Obtener métricas reales y documentos recientes sin datos simulados
  const dashboardData = await getWorkspaceDashboardData(
    businessId,
    session.businessTimezone
  );

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-CO", {
        timeZone: session.businessTimezone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    switch (method) {
      case "cash":
        return { label: "Efectivo", icon: Banknote, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" };
      case "transfer":
        return { label: "Transferencia", icon: CreditCard, color: "text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20" };
      case "credit":
        return { label: "Crédito", icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20" };
      default:
        return { label: method || "Otro", icon: Receipt, color: "text-slate-600 bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20" };
    }
  };

  const actions = session.isOwner ? (
    <Link
      href={`/workspace/${businessId}/configuracion`}
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
    >
      <Settings className="w-3.5 h-3.5 text-slate-500" />
      <span>Configuración</span>
    </Link>
  ) : null;

  return (
    <AppPageContainer
      title={session.businessName}
      description="Resumen operativo y ventas reales registradas en la jornada."
      actions={actions}
      maxWidth="6xl"
    >
      {/* TARJETAS DE KPIS REALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* KPI 1: Ventas del Día */}
        <div className="bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ventas del Día
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {formatCOP(dashboardData.todaySalesTotal)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {dashboardData.todaySalesCount === 1
                  ? "1 comprobante hoy"
                  : `${dashboardData.todaySalesCount} comprobantes hoy`}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Comprobantes Históricos */}
        <div className="bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Histórico
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {formatCOP(dashboardData.allTimeSalesTotal)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{dashboardData.totalSalesCount} documentos emitidos en total</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Aislamiento & Rol */}
        <div className="bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Operación y Seguridad
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {session.roleName}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
              <p>Zona horaria: <strong className="text-slate-700 dark:text-slate-300 font-mono">{session.businessTimezone}</strong></p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Aislamiento por Tenant Activo</p>
            </div>
          </div>
        </div>

      </div>

      {/* SECCIÓN DE ACTIVIDAD O ESTADO VACÍO */}
      {dashboardData.totalSalesCount === 0 ? (
        
        /* ESTADO VACÍO (HONESTO, SIN DATOS MOCK) */
        <div className="bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-2xl p-10 lg:p-14 text-center max-w-xl mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-5 shadow-xs">
            <Receipt className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Aún no hay ventas registradas
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto mb-6">
            Cuando registres tu primera venta o emitas un comprobante comercial, aparecerá aquí el resumen de tu negocio.
          </p>

          {session.isOwner && (
            <Link
              href={`/workspace/${businessId}/configuracion/documentos`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm"
            >
              <span>Personalizar Documentos y Marca</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

      ) : (

        /* LISTADO DE COMPROBANTES RECIENTES REALES */
        <div className="bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
          
          <div className="p-6 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Comprobantes y Ventas Recientes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Últimos documentos comerciales emitidos para este comercio.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">
                {dashboardData.recentDocuments.length} de {dashboardData.totalSalesCount} documentos
              </span>
              <Link
                href={`/workspace/${businessId}/ventas`}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Ver todas</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-3.5 px-4">Comprobante</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4">Método de Pago</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                {dashboardData.recentDocuments.map((doc) => {
                  const payBadge = getPaymentMethodBadge(doc.paymentMethod);
                  const PayIcon = payBadge.icon;
                  const isCompleted = doc.status === "completed";

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        <Link
                          href={`/workspace/${businessId}/ventas/${doc.id}`}
                          className="hover:text-[#ED500A] dark:hover:text-[#ED500A] transition-colors"
                        >
                          {doc.documentNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {doc.customerName || "Cliente General"}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                        {formatDate(doc.issuedAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${payBadge.color}`}>
                          <PayIcon className="w-3 h-3" />
                          <span>{payBadge.label}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${
                            isCompleted
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                              : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                        {formatCOP(doc.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

      )}
    </AppPageContainer>
  );
}
