"use client";

import React, { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  X,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  Calendar,
  Pencil,
  Trash2,
} from "lucide-react";
import { PlatformFinancialSummary, PlatformExpense, FinancialFilterParams } from "@/lib/finance/types";
import { formatCOP } from "@/config/plans";
import {
  AdminKpiGrid,
  AdminKpiCard,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui";
import { registerExpenseAction, fetchFinancialSummaryAction, updateExpenseAction, deleteExpenseAction } from "./actions";
import { toast } from "sonner";

interface FinanzasClientProps {
  initialData: PlatformFinancialSummary;
}

export function FinanzasClient({ initialData }: FinanzasClientProps) {
  const [data, setData] = useState<PlatformFinancialSummary>(initialData);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filtros
  const [filterPeriod, setFilterPeriod] = useState<FinancialFilterParams["period"]>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const applyFilters = () => {
    startTransition(async () => {
      const res = await fetchFinancialSummaryAction({
        period: filterPeriod,
        startDate: customStart || undefined,
        endDate: customEnd || undefined,
      });
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error("No se pudo filtrar la información financiera");
      }
    });
  };

  useEffect(() => {
    if (filterPeriod !== "custom") {
      applyFilters();
    }
  }, [filterPeriod]);

  // Modal Egreso
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    category: "infra" as PlatformExpense["category"],
    concept: "",
    amount: 0,
    receiptReference: "",
    date: "",
  });

  // Modal Borrar
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  const handleOpenNewExpense = () => {
    setEditingExpenseId(null);
    setExpenseForm({
      category: "infra",
      concept: "",
      amount: 0,
      receiptReference: "",
      date: new Date().toISOString().substring(0, 10),
    });
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (exp: any) => {
    setEditingExpenseId(exp.id);
    setExpenseForm({
      category: exp.entityName === "Infraestructura & Base de Datos" ? "infra" :
                exp.entityName === "APIs & Servicios Externos" ? "api_services" :
                exp.entityName === "Dominio & Alojamiento Web" ? "domain_hosting" :
                exp.entityName === "Comisiones Bancarias / Pasarela" ? "commissions" :
                exp.entityName === "Operaciones & Soporte Técnico" ? "operations" : "other",
      concept: exp.concept,
      amount: exp.amount,
      receiptReference: exp.reference || "",
      date: new Date(exp.date).toISOString().substring(0, 10),
    });
    setIsExpenseModalOpen(true);
  };

  const handleRegisterExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.concept.trim() || expenseForm.amount < 0) {
      toast.error("Por favor completa el concepto y un monto válido en COP.");
      return;
    }

    startTransition(async () => {
      let res;
      if (editingExpenseId) {
        res = await updateExpenseAction(editingExpenseId, expenseForm);
      } else {
        res = await registerExpenseAction(expenseForm);
      }

      if (res.success) {
        toast.success(editingExpenseId ? "Egreso actualizado." : "Costo operativo registrado exitosamente.");
        setIsExpenseModalOpen(false);
        applyFilters();
      } else {
        toast.error(res.error || "No fue posible guardar el gasto.");
      }
    });
  };

  const confirmDelete = (id: string) => {
    setExpenseToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteExpense = () => {
    if (!expenseToDelete) return;
    startTransition(async () => {
      const res = await deleteExpenseAction(expenseToDelete);
      if (res.success) {
        toast.success("Egreso eliminado.");
        setIsDeleteModalOpen(false);
        setExpenseToDelete(null);
        applyFilters();
      } else {
        toast.error(res.error || "Error al eliminar el egreso.");
      }
    });
  };

  return (
    <div className="space-y-6 font-body">
      
      {/* FILTROS */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Período:
          </label>
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value as any)}
            className="p-2 rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white"
          >
            <option value="all">Historico Completo</option>
            <option value="this_month">Este Mes</option>
            <option value="last_month">Mes Pasado</option>
            <option value="this_year">Este Año</option>
            <option value="custom">Rango Personalizado</option>
          </select>
        </div>

        {filterPeriod === "custom" && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Desde:
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="p-2 rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hasta:
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="p-2 rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <AdminButton variant="secondary" size="sm" onClick={applyFilters} isLoading={isPending}>
                Aplicar Filtro
              </AdminButton>
            </div>
          </>
        )}
      </div>

      {/* 1. KPIS FINANCIEROS: RECURRENTES VS FLUJO DE CAJA */}
      <AdminKpiGrid cols={4}>
        <AdminKpiCard
          title="MRR (Global)"
          value={`${formatCOP(data.mrrCOP)} COP`}
          subtext={`ARR: ${formatCOP(data.arrCOP)} COP (${data.activeSubscriptionsCount} suscripciones)`}
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          variant="emerald"
        />
        <AdminKpiCard
          title="Caja: Total Recaudado"
          value={`${formatCOP(data.totalRevenueCollectedCOP)} COP`}
          subtext="Pagos cobrados efectivamente (Período)"
          icon={<Wallet className="w-4 h-4 text-[#ED500A]" />}
          variant="orange"
        />
        <AdminKpiCard
          title="Caja: Gastos Operativos"
          value={`${formatCOP(data.totalExpensesPaidCOP)} COP`}
          subtext={`${data.expenses.length} egresos (Período)`}
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
        <div>
          <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white">
            Flujo de Caja y Rendimiento Financiero de NEGOVA
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Control de cobros recaudados de suscripciones y costos operativos.
          </p>
        </div>

        <AdminButton
          variant="primary"
          size="md"
          onClick={handleOpenNewExpense}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Registrar Costo Operativo
        </AdminButton>
      </div>

      {/* 3. TABLA DE MOVIMIENTOS RECIENTES DE CAJA */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] shadow-xs overflow-hidden">
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
            title="Sin movimientos financieros"
            description="Aún no se han recaudado pagos ni registrado egresos en este periodo."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-4">Entidad / Categoría</th>
                  <th className="py-3 px-4">Referencia</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
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
                          <span>{isIncome ? "Entrada" : "Salida"}</span>
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
                      <td className="py-3 px-4 text-right">
                        {!isIncome && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditExpense(mov)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors"
                              title="Editar Egreso"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => confirmDelete(mov.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                              title="Eliminar Egreso"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL: REGISTRAR/EDITAR COSTO OPERATIVO */}
      {mounted && isExpenseModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-title">
                    {editingExpenseId ? "Editar Egreso" : "Registrar Costo de Operación"}
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
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white"
                >
                  <option value="infra">Infraestructura & Base de Datos</option>
                  <option value="domain_hosting">Dominio & Alojamiento Web</option>
                  <option value="api_services">APIs & Servicios Externos</option>
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
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monto en COP:
                  </label>
                  <input
                    type="text"
                    value={expenseForm.amount === 0 ? "" : new Intl.NumberFormat("es-CO").format(expenseForm.amount)}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, "");
                      setExpenseForm({ ...expenseForm, amount: rawValue ? parseInt(rawValue, 10) : 0 });
                    }}
                    placeholder="Ej: 110.000"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha del Egreso:
                  </label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white font-mono"
                    required
                  />
                </div>
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
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <AdminButton variant="secondary" size="sm" type="button" onClick={() => setIsExpenseModalOpen(false)}>
                  Cancelar
                </AdminButton>
                <AdminButton variant="primary" size="sm" type="submit" isLoading={isPending}>
                  {editingExpenseId ? "Guardar Cambios" : "Guardar Egreso"}
                </AdminButton>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 5. MODAL: ELIMINAR/ANULAR EGRESO */}
      {mounted && isDeleteModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-red-200 dark:border-red-500/20 bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/10 text-red-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-title">
                ¿Eliminar Egreso?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Esta acción no se puede deshacer. Se mantendrá el registro en auditoría.
              </p>
            </div>
            
            <div className="flex justify-center gap-3 pt-4">
              <AdminButton variant="secondary" size="sm" type="button" onClick={() => setIsDeleteModalOpen(false)}>
                Cancelar
              </AdminButton>
              <button
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                onClick={handleDeleteExpense}
                disabled={isPending}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
