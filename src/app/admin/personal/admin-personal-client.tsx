"use client";

import React, { useState, useTransition } from "react";
import {
  Users,
  UserPlus,
  Wallet,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  Plus,
  FileText,
  XCircle,
  Building2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import {
  EmployeeModel,
  PayrollPeriodModel,
  UpsertEmployeeInput,
  PaymentMethod,
} from "@/lib/payroll/payroll-service";
import {
  getAdminEmployeesAction,
  createAdminEmployeeAction,
  getAdminPayrollPeriodsAction,
  createAdminPayrollPeriodAction,
  registerAdminPayrollPaymentAction,
} from "./actions";
import {
  AdminKpiGrid,
  AdminKpiCard,
  AdminTabs,
  AdminTableToolbar,
  AdminEmptyState,
} from "@/components/admin/ui";
import { ModalPortal } from "@/components/ui/modal-portal";

interface AdminPersonalClientProps {
  initialEmployees: {
    employees: EmployeeModel[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null;
  initialPeriods: PayrollPeriodModel[];
  isSuperAdmin: boolean;
  currentUserId: string;
}

export function AdminPersonalClient({
  initialEmployees,
  initialPeriods,
  isSuperAdmin,
  currentUserId,
}: AdminPersonalClientProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"employees" | "payroll">("employees");

  // Estados de Personal
  const [employees, setEmployees] = useState<EmployeeModel[]>(initialEmployees?.employees || []);
  const [total, setTotal] = useState(initialEmployees?.total || 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [createEmployeeModalOpen, setCreateEmployeeModalOpen] = useState(false);

  // Estados de Nómina
  const [periods, setPeriods] = useState<PayrollPeriodModel[]>(initialPeriods);
  const [createPeriodModalOpen, setCreatePeriodModalOpen] = useState(false);

  // Formulario empleado
  const [empForm, setEmpForm] = useState<UpsertEmployeeInput>({
    firstName: "",
    lastName: "",
    documentType: "CC",
    documentNumber: "",
    jobTitle: "",
    email: "",
    phone: "",
    baseSalary: 0,
    payFrequency: "monthly",
    paymentMethod: "bank_transfer",
    hireDate: new Date().toISOString().split("T")[0],
    status: "active",
  });

  // Formulario período
  const [periodForm, setPeriodForm] = useState({
    name: `Nómina NEGOVA ${new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" })}`,
    periodType: "monthly" as "monthly" | "biweekly" | "weekly",
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0],
  });

  const handleCreateEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createAdminEmployeeAction(empForm);
      if (res.success && "employee" in res && res.employee) {
        toast.success(`Empleado interno ${res.employee.fullName} registrado.`);
        setCreateEmployeeModalOpen(false);
        setEmployees((prev) => [res.employee!, ...prev]);
        setTotal((prev) => prev + 1);
      } else {
        toast.error(res.error || "Error al registrar empleado.");
      }
    });
  };

  const handleCreatePeriodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createAdminPayrollPeriodAction(periodForm);
      if (res.success && "period" in res && res.period) {
        toast.success(`Período "${res.period.name}" liquidado exitosamente.`);
        setCreatePeriodModalOpen(false);
        setPeriods((prev) => [res.period!, ...prev]);
      } else {
        toast.error(res.error || "Error al liquidar nómina interna.");
      }
    });
  };

  const handlePayReceipt = (receiptId: string, empName: string) => {
    startTransition(async () => {
      const res = await registerAdminPayrollPaymentAction({
        receiptId,
        paymentMethod: "bank_transfer",
        paymentReference: `NEGOVA-PAY-${receiptId.slice(0, 6).toUpperCase()}`,
      });

      if (res.success) {
        toast.success(`Pago asentado para ${empName}. Vinculado a gastos de plataforma.`);
        const pRes = await getAdminPayrollPeriodsAction();
        if (pRes.success && pRes.data) {
          setPeriods(pRes.data);
        }
      } else {
        toast.error(res.error || "Error al procesar pago.");
      }
    });
  };

  const totalMonthlyPayroll = employees.reduce((s, e) => s + (e.baseSalary || 0), 0);

  return (
    <div className="space-y-6 font-body">
      {/* 1. KPIS */}
      <AdminKpiGrid cols={3}>
        <AdminKpiCard
          title="Personal Interno NEGOVA"
          value={total}
          subtext="Equipo de operaciones Core"
          icon={<Users className="w-4 h-4" />}
          variant="purple"
          isSelected={activeTab === "employees"}
          onClick={() => setActiveTab("employees")}
        />

        <AdminKpiCard
          title="Nómina Mensual Plataforma"
          value={`$ ${totalMonthlyPayroll.toLocaleString("es-CO")}`}
          subtext="Egresos operativos NEGOVA"
          icon={<DollarSign className="w-4 h-4" />}
          variant="emerald"
        />

        <AdminKpiCard
          title="Períodos Liquidados"
          value={periods.length}
          subtext="Historial corporativo"
          icon={<Wallet className="w-4 h-4" />}
          variant="blue"
          isSelected={activeTab === "payroll"}
          onClick={() => setActiveTab("payroll")}
        />
      </AdminKpiGrid>

      {/* 2. PESTAÑAS */}
      <AdminTabs
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as any)}
        tabs={[
          { id: "employees", label: "Equipo Interno", count: employees.length },
          { id: "payroll", label: "Nómina Corporativa", count: periods.length },
        ]}
      />

      {/* TAB A: EMPLEADOS INTERNOS */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex-1">
              <AdminTableToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSearchSubmit={() => {}}
                searchPlaceholder="Buscar por nombre, cargo o documento..."
                onRefresh={() => {}}
                isPending={isPending}
              />
            </div>

            <button
              type="button"
              onClick={() => setCreateEmployeeModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Registrar Empleado Interno</span>
            </button>
          </div>

          {employees.length === 0 ? (
            <AdminEmptyState
              icon={Users}
              title="No hay empleados internos registrados"
              description="Registra a los ingenieros, soporte y personal operativo de NEGOVA Core."
              onReset={() => setCreateEmployeeModalOpen(true)}
              resetLabel="Registrar Primer Empleado"
            />
          ) : (
            <div className="rounded-3xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4">Empleado Interno</th>
                      <th className="py-3 px-4">Documento</th>
                      <th className="py-3 px-4">Cargo en NEGOVA</th>
                      <th className="py-3 px-4">Sueldo Base</th>
                      <th className="py-3 px-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {emp.fullName}
                          <span className="block text-[11px] text-slate-400 font-normal">{emp.email || "Sin correo"}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {emp.documentType} {emp.documentNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            {emp.jobTitle}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          $ {emp.baseSalary.toLocaleString("es-CO")}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600">
                            {emp.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB B: NÓMINA CORPORATIVA */}
      {activeTab === "payroll" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setCreatePeriodModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Liquidar Período Interno</span>
            </button>
          </div>

          {periods.length === 0 ? (
            <AdminEmptyState
              icon={Wallet}
              title="No hay nóminas liquidadas"
              description="Genera la liquidación mensual del personal interno de NEGOVA Core."
              onReset={() => setCreatePeriodModalOpen(true)}
              resetLabel="Liquidar Primer Período"
            />
          ) : (
            <div className="space-y-4">
              {periods.map((per) => (
                <div
                  key={per.id}
                  className="p-5 rounded-3xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {per.name}
                      </h4>
                      <span className="text-xs text-slate-400 font-mono">
                        {per.startDate} al {per.endDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                        Total Neto: $ {per.totalNet.toLocaleString("es-CO")}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600">
                        {per.status === "paid" ? "Pagado" : "Pendiente"}
                      </span>
                    </div>
                  </div>

                  {per.receipts && per.receipts.length > 0 && (
                    <div className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                      {per.receipts.map((rec) => (
                        <div key={rec.id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {rec.employeeName}
                            </span>
                            <span className="text-[10px] text-slate-400 block">{rec.jobTitle}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              $ {rec.netAmount.toLocaleString("es-CO")}
                            </span>
                            {rec.status === "pending" ? (
                              <button
                                type="button"
                                onClick={() => handlePayReceipt(rec.id, rec.employeeName)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px]"
                              >
                                Pagar
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-semibold text-[11px]">Pagado</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: REGISTRAR EMPLEADO */}
      {createEmployeeModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div
              className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Registrar Empleado Interno NEGOVA Core
                </h3>
                <button
                  type="button"
                  onClick={() => setCreateEmployeeModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateEmployeeSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={empForm.firstName}
                      onChange={(e) => setEmpForm({ ...empForm, firstName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                      placeholder="Ej. Ana María"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Apellido *</label>
                    <input
                      type="text"
                      required
                      value={empForm.lastName}
                      onChange={(e) => setEmpForm({ ...empForm, lastName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                      placeholder="Ej. Restrepo"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cédula / Documento *</label>
                    <input
                      type="text"
                      required
                      value={empForm.documentNumber}
                      onChange={(e) => setEmpForm({ ...empForm, documentNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cargo *</label>
                    <input
                      type="text"
                      required
                      value={empForm.jobTitle}
                      onChange={(e) => setEmpForm({ ...empForm, jobTitle: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                      placeholder="Ej. Desarrollador Backend"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sueldo Base ($ COP) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={empForm.baseSalary || ""}
                    onChange={(e) => setEmpForm({ ...empForm, baseSalary: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono"
                    placeholder="Ej. 4500000"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setCreateEmployeeModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL: LIQUIDAR NÓMINA INTERNA */}
      {createPeriodModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Liquidar Período Interno NEGOVA
                </h3>
                <button
                  type="button"
                  onClick={() => setCreatePeriodModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePeriodSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={periodForm.name}
                    onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Fecha Inicio</label>
                    <input
                      type="date"
                      required
                      value={periodForm.startDate}
                      onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Fecha Fin</label>
                    <input
                      type="date"
                      required
                      value={periodForm.endDate}
                      onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setCreatePeriodModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                  >
                    Calcular Nómina
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
