"use client";

import React, { useState, useTransition } from "react";
import {
  Wallet,
  Calendar,
  DollarSign,
  Plus,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  AlertTriangle,
  XCircle,
  Eye,
  ShieldCheck,
  Building2,
  ArrowRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  PayrollPeriodModel,
  PayrollReceiptModel,
  PaymentMethod,
} from "@/lib/payroll/payroll-service";
import {
  getWorkspacePayrollPeriodsAction,
  getWorkspacePayrollPeriodDetailAction,
  createWorkspacePayrollPeriodAction,
  registerWorkspacePayrollPaymentAction,
  cancelWorkspacePayrollReceiptAction,
} from "../personal/actions";
import {
  AdminDataTable,
  AdminDataTableColumn,
  AdminKpiCard,
  AdminKpiGrid,
  AdminConfirmDialog,
} from "@/components/admin/ui";
import { ModalPortal } from "@/components/ui/modal-portal";

interface WorkspaceNominaClientProps {
  initialPeriods: PayrollPeriodModel[];
  businessId: string;
  businessName: string;
  isOwner: boolean;
  canCalculate: boolean;
  canPay: boolean;
  canCancel: boolean;
}

export function WorkspaceNominaClient({
  initialPeriods,
  businessId,
  businessName,
  isOwner,
  canCalculate,
  canPay,
  canCancel,
}: WorkspaceNominaClientProps) {
  const [isPending, startTransition] = useTransition();

  const [periods, setPeriods] = useState<PayrollPeriodModel[]>(initialPeriods);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriodModel | null>(
    initialPeriods[0] || null
  );

  // Modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PayrollReceiptModel | null>(null);
  const [voucherReceipt, setVoucherReceipt] = useState<PayrollReceiptModel | null>(null);

  // Formulario nuevo período
  const [newPeriodData, setNewPeriodData] = useState({
    name: `Nómina ${new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" })}`,
    periodType: "biweekly" as "biweekly" | "monthly" | "weekly",
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString().split("T")[0],
    notes: "",
  });

  // Formulario registrar pago
  const [paymentForm, setPaymentForm] = useState<{
    paymentMethod: PaymentMethod;
    paymentReference: string;
  }>({
    paymentMethod: "bank_transfer",
    paymentReference: "",
  });

  const refreshPeriods = () => {
    startTransition(async () => {
      const res = await getWorkspacePayrollPeriodsAction(businessId);
      if (res.success && res.data) {
        setPeriods(res.data);
        if (selectedPeriod) {
          const updated = res.data.find((p) => p.id === selectedPeriod.id);
          if (updated) {
            loadPeriodDetail(updated.id);
          }
        }
      }
    });
  };

  const loadPeriodDetail = (periodId: string) => {
    startTransition(async () => {
      const res = await getWorkspacePayrollPeriodDetailAction(businessId, periodId);
      if (res.success && res.data) {
        setSelectedPeriod(res.data);
      }
    });
  };

  const handleCreatePeriodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createWorkspacePayrollPeriodAction(businessId, newPeriodData);
      if (res.success && "period" in res && res.period) {
        toast.success(`Período "${res.period.name}" liquidado exitosamente.`);
        setCreateModalOpen(false);
        setPeriods((prev) => [res.period!, ...prev]);
        setSelectedPeriod(res.period!);
      } else {
        toast.error(res.error || "No fue posible liquidar la nómina.");
      }
    });
  };

  const handleRegisterPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceipt) return;

    startTransition(async () => {
      const res = await registerWorkspacePayrollPaymentAction(businessId, {
        receiptId: selectedReceipt.id,
        paymentMethod: paymentForm.paymentMethod,
        paymentReference: paymentForm.paymentReference || undefined,
      });

      if (res.success) {
        toast.success(
          `Pago registrado exitosamente para ${selectedReceipt.employeeName}. Egreso vinculado en finanzas.`
        );
        setPaymentModalOpen(false);
        if (selectedPeriod) {
          loadPeriodDetail(selectedPeriod.id);
        }
      } else {
        toast.error(res.error || "No fue posible registrar el pago.");
      }
    });
  };

  const handleCancelReceipt = (receiptId: string, empName: string) => {
    startTransition(async () => {
      const res = await cancelWorkspacePayrollReceiptAction(businessId, receiptId);
      if (res.success) {
        toast.success(`Comprobante de ${empName} anulado. Egreso cancelado.`);
        if (selectedPeriod) {
          loadPeriodDetail(selectedPeriod.id);
        }
      } else {
        toast.error(res.error || "Error al anular comprobante.");
      }
    });
  };

  const totalCalculatedNet = selectedPeriod?.totalNet || 0;
  const receipts = selectedPeriod?.receipts || [];
  const paidCount = receipts.filter((r) => r.status === "paid").length;
  const pendingCount = receipts.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6 font-body">
      {/* 1. KPIS DEL PERÍODO ACTIVO */}
      <AdminKpiGrid cols={3}>
        <AdminKpiCard
          title="Total a Pagar en Período"
          value={`$ ${totalCalculatedNet.toLocaleString("es-CO")}`}
          subtext={selectedPeriod?.name || "Sin período seleccionado"}
          icon={<DollarSign className="w-4 h-4" />}
          variant="purple"
        />

        <AdminKpiCard
          title="Comprobantes Pagados"
          value={paidCount}
          subtext="Egresos asentados en finanzas"
          icon={<CheckCircle2 className="w-4 h-4" />}
          variant="emerald"
        />

        <AdminKpiCard
          title="Obligaciones Pendientes"
          value={pendingCount}
          subtext="Por desembolsar"
          icon={<Clock className="w-4 h-4" />}
          variant="amber"
        />
      </AdminKpiGrid>

      {/* AVISO DE ALCANCE OPERATIVO */}
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 text-xs text-blue-900 dark:text-blue-200">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="font-semibold">Control Operativo de Remuneraciones:</strong> Este módulo administra salarios acordados, horas extras, bonificaciones, deducciones y anticipos para el control del negocio y su registro en gastos. No constituye una liquidación legal completa con seguridad social (PILA) ni aportes parafiscales automatizados.
        </p>
      </div>

      {/* 2. SELECTOR DE PERÍODOS Y ACCIONES */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-slate-400" />
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              Período de Liquidación:
            </label>
            <select
              value={selectedPeriod?.id || ""}
              onChange={(e) => loadPeriodDetail(e.target.value)}
              className="text-xs font-bold text-slate-900 dark:text-white bg-transparent border-0 focus:ring-0 p-0 cursor-pointer"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id} className="dark:bg-[#0D0F16]">
                  {p.name} ({p.startDate} a {p.endDate}) — {p.status === "paid" ? "Pagado" : "Pendiente"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {canCalculate && (
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Liquidar Nuevo Período</span>
          </button>
        )}
      </div>

      {/* 3. TABLA DE COMPROBANTES / LIQUIDACIONES */}
      {!selectedPeriod || receipts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#0D0F16] border border-dashed border-slate-200 dark:border-white/[0.08] space-y-3">
          <Wallet className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            No hay liquidaciones registradas en este período
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Calcula un nuevo período quincenal o mensual a partir del directorio de colaboradores activos.
          </p>
          {canCalculate && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              Liquidar Primer Período
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Comprobantes de Pago del Período ({receipts.length})
            </h4>
            <span className="text-[11px] font-mono text-slate-400">
              Total Neto: <strong className="text-slate-900 dark:text-white">$ {totalCalculatedNet.toLocaleString("es-CO")}</strong>
            </span>
          </div>

          <AdminDataTable<PayrollReceiptModel>
            data={receipts}
            columns={[
              {
                header: "Colaborador",
                render: (rec) => (
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{rec.employeeName}</span>
                    <span className="block text-[10px] text-slate-400 font-normal">
                      {rec.jobTitle || "Trabajador"}
                    </span>
                  </div>
                ),
              },
              {
                header: "Base Período",
                headerClassName: "whitespace-nowrap",
                className: "whitespace-nowrap font-mono text-slate-600 dark:text-slate-300",
                render: (rec) => `$ ${rec.baseSalary.toLocaleString("es-CO")}`,
              },
              {
                header: "Bonos / Extras (+)",
                headerClassName: "whitespace-nowrap",
                className: "whitespace-nowrap font-mono text-emerald-600 dark:text-emerald-400",
                render: (rec) => `+ $ ${rec.bonusesAmount.toLocaleString("es-CO")}`,
              },
              {
                header: "Deducciones (-)",
                headerClassName: "whitespace-nowrap",
                className: "whitespace-nowrap font-mono text-red-500 dark:text-red-400",
                render: (rec) => `- $ ${(rec.deductionsAmount + rec.advancesAmount).toLocaleString("es-CO")}`,
              },
              {
                header: "Neto a Pagar",
                headerClassName: "whitespace-nowrap",
                className: "whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white",
                render: (rec) => `$ ${rec.netAmount.toLocaleString("es-CO")}`,
              },
              {
                header: "Estado",
                headerClassName: "whitespace-nowrap",
                className: "whitespace-nowrap",
                render: (rec) => (
                  <>
                    {rec.status === "paid" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Pagado
                      </span>
                    ) : rec.status === "cancelled" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600">
                        Anulado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        <Clock className="w-3 h-3" />
                        Pendiente
                      </span>
                    )}
                  </>
                ),
              },
              {
                header: "Acciones",
                headerClassName: "whitespace-nowrap text-right",
                className: "whitespace-nowrap text-right",
                align: "right",
                render: (rec) => (
                  <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    {rec.status === "pending" && canPay && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReceipt(rec);
                          setPaymentForm({
                            paymentMethod: (rec.paymentMethod as any) || "bank_transfer",
                            paymentReference: `NOM-${rec.id.slice(0, 6).toUpperCase()}`,
                          });
                          setPaymentModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        Pagar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setVoucherReceipt(rec)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                      title="Ver Comprobante de Pago"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    {rec.status === "paid" && canCancel && (
                      <button
                        type="button"
                        onClick={() => handleCancelReceipt(rec.id, rec.employeeName)}
                        className="text-[11px] text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                        title="Revertir y anular comprobante"
                      >
                        Anular
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            keyExtractor={(rec) => rec.id}
            minWidth="min-w-[850px]"
          />
        </div>
      )}

      {/* MODAL: LIQUIDAR NUEVO PERÍODO */}
      {createModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-2xl p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Liquidar Período de Nómina
                </h3>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePeriodSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Nombre del Período *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPeriodData.name}
                    onChange={(e) => setNewPeriodData({ ...newPeriodData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Periodicidad
                  </label>
                  <select
                    value={newPeriodData.periodType}
                    onChange={(e) => setNewPeriodData({ ...newPeriodData, periodType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                  >
                    <option value="biweekly">Quincenal (Calcula mitad del salario base)</option>
                    <option value="monthly">Mensual (Calcula salario base completo)</option>
                    <option value="weekly">Semanal</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Fecha Inicio *
                    </label>
                    <input
                      type="date"
                      required
                      value={newPeriodData.startDate}
                      onChange={(e) => setNewPeriodData({ ...newPeriodData, startDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Fecha Fin *
                    </label>
                    <input
                      type="date"
                      required
                      value={newPeriodData.endDate}
                      onChange={(e) => setNewPeriodData({ ...newPeriodData, endDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {isPending ? "Calculando..." : "Calcular Período"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL: REGISTRAR PAGO DE COMPROBANTE */}
      {paymentModalOpen && selectedReceipt && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-2xl p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Registrar Desembolso de Nómina
                  </h3>
                  <p className="text-xs text-slate-400">
                    Colaborador: <strong>{selectedReceipt.employeeName}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-center">
                <span className="text-[10px] text-slate-400 font-mono block">Monto Neto a Pagar:</span>
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  $ {selectedReceipt.netAmount.toLocaleString("es-CO")}
                </span>
              </div>

              <form onSubmit={handleRegisterPaymentSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                  >
                    <option value="bank_transfer">Transferencia Bancaria</option>
                    <option value="cash">Efectivo (Caja Menor)</option>
                    <option value="nequi">Nequi</option>
                    <option value="daviplata">Daviplata</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Número de Comprobante / Referencia Bancaria
                  </label>
                  <input
                    type="text"
                    value={paymentForm.paymentReference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono"
                    placeholder="Ej. TRANSF-902182"
                  />
                </div>

                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-[11px] text-blue-900 dark:text-blue-300">
                  ℹ Al confirmar, se creará automáticamente el registro de egreso correspondiente en Finanzas/Gastos bajo la categoría &quot;payroll&quot; para evitar duplicar pagos.
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {isPending ? "Procesando..." : "Confirmar y Asentar Pago"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL: COMPROBANTE DE PAGO (RECIBO) */}
      {voucherReceipt && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div
              className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-2xl p-6 sm:p-8 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Comprobante de Pago de Nómina
                    </h3>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {businessName} • {voucherReceipt.employeeDoc}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVoucherReceipt(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* CUERPO DEL COMPROBANTE */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-500">Colaborador:</span>
                  <strong className="text-slate-900 dark:text-white">{voucherReceipt.employeeName}</strong>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-500">Cargo:</span>
                  <span className="text-slate-800 dark:text-slate-200">{voucherReceipt.jobTitle || "Trabajador"}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-500">Sueldo Base del Período:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    $ {voucherReceipt.baseSalary.toLocaleString("es-CO")}
                  </span>
                </div>
                {voucherReceipt.bonusesAmount > 0 && (
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-white/5 text-emerald-600 dark:text-emerald-400">
                    <span>Bonificaciones / Horas Extras:</span>
                    <span className="font-mono">+ $ {voucherReceipt.bonusesAmount.toLocaleString("es-CO")}</span>
                  </div>
                )}
                {voucherReceipt.deductionsAmount + voucherReceipt.advancesAmount > 0 && (
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-white/5 text-red-500">
                    <span>Deducciones / Anticipos:</span>
                    <span className="font-mono">
                      - $ {(voucherReceipt.deductionsAmount + voucherReceipt.advancesAmount).toLocaleString("es-CO")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 text-sm font-bold text-slate-900 dark:text-white">
                  <span>Total Neto Pagado:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    $ {voucherReceipt.netAmount.toLocaleString("es-CO")}
                  </span>
                </div>
              </div>

              {voucherReceipt.paymentReference && (
                <div className="text-[11px] text-slate-400 font-mono text-center">
                  Ref de Pago: <strong>{voucherReceipt.paymentReference}</strong> • Método: {voucherReceipt.paymentMethod}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setVoucherReceipt(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
