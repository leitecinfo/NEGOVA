"use client";

import React, { useState, useTransition } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  X,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  Server,
  Wallet,
} from "lucide-react";
import { PlatformFinancialSummary, PlatformExpense } from "@/lib/finance/types";
import { formatCOP } from "@/config/plans";
import {
  AdminKpiGrid,
  AdminKpiCard,
  AdminButton,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import { registerExpenseAction, fetchFinancialSummaryAction } from "./actions";
import { toast } from "sonner";

interface FinanzasClientProps {
  initialData: PlatformFinancialSummary;
}

export function FinanzasClient({ initialData }: FinanzasClientProps) {
  const [data, setData] = useState<PlatformFinancialSummary>(initialData);
  const [isPending, startTransition] = useTransition();

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: "infra" as PlatformExpense["category"],
    concept: "",
    amount: 0,
    receiptReference: "",
    notes: "",
  });

  const handleRegisterExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.concept.trim() || expenseForm.amount <= 0) {
      toast.error("Por favor completa el concepto y un monto válido en COP.");
      return;
    }

    startTransition(async () => {
      const res = await registerExpenseAction(expenseForm);
      if (res.success) {
        toast.success("Costo operativo registrado exitosamente.");
        setIsExpenseModalOpen(false);
        setExpenseForm({
          category: "infra",
          concept: "",
          amount: 0,
          receiptReference: "",
          notes: "",
        });
        const summaryRes = await fetchFinancialSummaryAction();
        if (summaryRes.success && summaryRes.data) {
          setData(summaryRes.data);
        }
      } else {
        toast.error(res.error || "No fue posible registrar el gasto.");
      }
    });
  };

  return (
    <div className="space-y-6 font-body">
      {/* 1. KPIS FINANCIEROS: RECURRENTES VS FLUJO DE CAJA */}
      <AdminKpiGrid cols={4}>
        <AdminKpiCard
          title="MRR (Recurrente Mensual)"
          value={`${formatCOP(data.mrrCOP)} COP`}
          subtext={`ARR: ${formatCOP(data.arrCOP)} COP (${data.activeSubscriptionsCount} suscripciones)`}
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          variant="emerald"
        />
        <AdminKpiCard
          title="Caja: Total Recaudado"
          value={`${formatCOP(data.totalRevenueCollectedCOP)} COP`}
          subtext="Pagos cobrados efectivamente"
          icon={<Wallet className="w-4 h-4 text-[#ED500A]" />}
          variant="orange"
        />
        <AdminKpiCard
          title="Caja: Gastos Operativos"
          value={`${formatCOP(data.totalExpensesPaidCOP)} COP`}
          subtext={`${data.expenses.length} egresos de plataforma registrados`}
          icon={<TrendingDown className="w-4 h-4 text-red-500" />}
          variant="red"
        />
        <AdminKpiCard
          title="Flujo Neto de Caja"
          value={`${data.netCashFlowCOP < 0 ? "-" : ""}${formatCOP(Math.abs(data.netCashFlowCOP))} COP`}
          subtext="Recaudos en caja menos gastos pagados"
          icon={<CheckCircle2 className={`w-4 h-4 ${data.netCashFlowCOP >= 0 ? "text-emerald-500" : "text-amber-500"}`} />}
          variant={data.netCashFlowCOP >= 0 ? "emerald" : "amber"}
        />
      </AdminKpiGrid>

      {/* 2. ACCIONES Y BOTÓN REGISTRAR GASTO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
        <div>
          <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white">
            Flujo de Caja y Rendimiento Financiero de NEGOVA
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Control de cobros recaudados de suscripciones y costos operativos de la infraestructura interna.
          </p>
        </div>

        <AdminButton
          variant="primary"
          size="md"
          onClick={() => setIsExpenseModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Registrar Costo Operativo
        </AdminButton>
      </div>

      {/* 3. TABLA DE MOVIMIENTOS RECIENTES DE CAJA */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <span className="font-bold text-xs text-slate-900 dark:text-white font-title">
            Libro de Movimientos de Caja
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Moneda oficial: Pesos Colombianos (COP)
          </span>
        </div>

        {data.recentMovements.length === 0 ? (
          <AdminEmptyState
            icon={DollarSign}
            title="Sin movimientos financieros registrados"
            description="Aún no se han recaudado pagos de suscripciones ni registrado egresos operativos."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-4">Entidad / Categoría</th>
                  <th className="py-3 px-4">Referencia</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {data.recentMovements.map((mov) => {
                  const isIncome = mov.type === "income";
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isIncome
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                          }`}
                        >
                          {isIncome ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          <span>{isIncome ? "Entrada (Recaudo)" : "Salida (Gasto)"}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {mov.concept}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {mov.entityName || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {mov.reference || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(mov.date).toLocaleDateString("es-CO")}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold ${
                          isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {isIncome ? `+${formatCOP(mov.amount)}` : `-${formatCOP(mov.amount)}`} COP
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL: REGISTRAR COSTO OPERATIVO */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-title">
                    Registrar Costo de Operación
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Egreso de infraestructura, servicios o herramientas de NEGOVA
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Categoría del Gasto:
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as PlatformExpense["category"] })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white"
                >
                  <option value="infra">Infraestructura & Base de Datos (Supabase)</option>
                  <option value="domain_hosting">Dominio & Alojamiento Web</option>
                  <option value="api_services">APIs & Mensajería (Resend/IA)</option>
                  <option value="commissions">Comisiones Bancarias / Pasarela</option>
                  <option value="operations">Operaciones & Soporte Técnico</option>
                  <option value="other">Otros Costos Operativos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Concepto / Detalle:
                </label>
                <input
                  type="text"
                  value={expenseForm.concept}
                  onChange={(e) => setExpenseForm({ ...expenseForm, concept: e.target.value })}
                  placeholder="Ej: Suscripción mensual infraestructura Supabase Pro"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monto en COP:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={expenseForm.amount || ""}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseInt(e.target.value, 10) || 0 })}
                    placeholder="Ej: 110000"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Referencia / Factura:
                  </label>
                  <input
                    type="text"
                    value={expenseForm.receiptReference}
                    onChange={(e) => setExpenseForm({ ...expenseForm, receiptReference: e.target.value })}
                    placeholder="Ej: INV-SUP-9821"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <AdminButton variant="secondary" size="sm" type="button" onClick={() => setIsExpenseModalOpen(false)}>
                  Cancelar
                </AdminButton>
                <AdminButton variant="primary" size="sm" type="submit" isLoading={isPending}>
                  Guardar Egreso
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
