"use client";

import React, { useState, useTransition, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Building2,
  DollarSign,
  Plus,
  Eye,
  Edit,
  Clock,
  Briefcase,
  CreditCard,
  FileText,
  AlertCircle,
  Shield,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  EmployeeModel,
  EmployeeNoveltyModel,
  DocumentType,
  ContractType,
  EmployeeStatus,
  CompensationType,
  PayFrequency,
  PaymentMethod,
  NoveltyType,
  UpsertEmployeeInput,
} from "@/lib/payroll/payroll-service";
import {
  getWorkspaceEmployeesAction,
  createWorkspaceEmployeeAction,
  updateWorkspaceEmployeeAction,
  createWorkspaceEmployeeNoveltyAction,
  getWorkspaceEmployeeNoveltiesAction,
} from "./actions";
import {
  AdminDataTable,
  AdminDataTableColumn,
  AdminTableToolbar,
  AdminEmptyState,
  AdminSelect,
  AdminKpiGrid,
  AdminKpiCard,
  AdminConfirmDialog,
} from "@/components/admin/ui";
import { ModalPortal } from "@/components/ui/modal-portal";

interface WorkspacePersonalClientProps {
  initialData: {
    employees: EmployeeModel[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null;
  businessId: string;
  businessName: string;
  isOwner: boolean;
  canCreateEmployee: boolean;
  canViewSalaries: boolean;
}

export function WorkspacePersonalClient({
  initialData,
  businessId,
  businessName,
  isOwner,
  canCreateEmployee,
  canViewSalaries,
}: WorkspacePersonalClientProps) {
  const [isPending, startTransition] = useTransition();

  const [employees, setEmployees] = useState<EmployeeModel[]>(initialData?.employees || []);
  const [total, setTotal] = useState(initialData?.total || 0);
  const [page, setPage] = useState(initialData?.page || 1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeModel | null>(null);
  const [noveltyModalOpen, setNoveltyModalOpen] = useState(false);
  const [noveltyEmployee, setNoveltyEmployee] = useState<EmployeeModel | null>(null);
  const [employeeNovelties, setEmployeeNovelties] = useState<EmployeeNoveltyModel[]>([]);

  // Formulario nuevo trabajador
  const [formData, setFormData] = useState<UpsertEmployeeInput>({
    firstName: "",
    lastName: "",
    documentType: "CC",
    documentNumber: "",
    birthDate: "",
    email: "",
    phone: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    jobTitle: "",
    department: "",
    hireDate: new Date().toISOString().split("T")[0],
    contractType: "indefinido",
    status: "active",
    compensationType: "fixed_salary",
    baseSalary: 0,
    payFrequency: "monthly",
    paymentMethod: "bank_transfer",
    bankName: "",
    accountType: "ahorros",
    accountNumber: "",
    notes: "",
  });

  // Formulario novedad laboral
  const [noveltyData, setNoveltyData] = useState<{
    noveltyType: NoveltyType;
    description: string;
    startDate: string;
    amount: number;
  }>({
    noveltyType: "bonus",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    amount: 0,
  });

  const fetchEmployees = (currentPage = page, status = statusFilter, search = searchQuery) => {
    startTransition(async () => {
      const res = await getWorkspaceEmployeesAction(businessId, {
        page: currentPage,
        pageSize: 20,
        status: status === "all" ? undefined : status,
        search: search.trim() || undefined,
      });

      if (res.success && res.data) {
        setEmployees(res.data.employees);
        setTotal(res.data.total);
        setPage(res.data.page);
      }
    });
  };

  const handleCreateEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.documentNumber || !formData.jobTitle) {
      toast.error("Por favor completa los campos obligatorios (*).");
      return;
    }

    startTransition(async () => {
      const res = await createWorkspaceEmployeeAction(businessId, formData);
      if (res.success) {
        toast.success(`Trabajador ${formData.firstName} ${formData.lastName} registrado exitosamente.`);
        setCreateModalOpen(false);
        setFormData({
          firstName: "",
          lastName: "",
          documentType: "CC",
          documentNumber: "",
          birthDate: "",
          email: "",
          phone: "",
          address: "",
          emergencyContactName: "",
          emergencyContactPhone: "",
          jobTitle: "",
          department: "",
          hireDate: new Date().toISOString().split("T")[0],
          contractType: "indefinido",
          status: "active",
          compensationType: "fixed_salary",
          baseSalary: 0,
          payFrequency: "monthly",
          paymentMethod: "bank_transfer",
          bankName: "",
          accountType: "ahorros",
          accountNumber: "",
          notes: "",
        });
        fetchEmployees();
      } else {
        toast.error(res.error || "No fue posible registrar al trabajador.");
      }
    });
  };

  const handleCreateNoveltySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noveltyEmployee || !noveltyData.description) {
      toast.error("Por favor ingresa la descripción de la novedad.");
      return;
    }

    startTransition(async () => {
      const res = await createWorkspaceEmployeeNoveltyAction(businessId, {
        employeeId: noveltyEmployee.id,
        noveltyType: noveltyData.noveltyType,
        description: noveltyData.description,
        startDate: noveltyData.startDate,
        amount: Number(noveltyData.amount || 0),
      });

      if (res.success) {
        toast.success("Novedad laboral registrada exitosamente.");
        setNoveltyModalOpen(false);
        setNoveltyData({
          noveltyType: "bonus",
          description: "",
          startDate: new Date().toISOString().split("T")[0],
          amount: 0,
        });
        if (selectedEmployee && selectedEmployee.id === noveltyEmployee.id) {
          loadEmployeeNovelties(noveltyEmployee.id);
        }
      } else {
        toast.error(res.error || "Error al registrar novedad.");
      }
    });
  };

  const loadEmployeeNovelties = async (empId: string) => {
    const res = await getWorkspaceEmployeeNoveltiesAction(businessId, empId);
    if (res.success && res.data) {
      setEmployeeNovelties(res.data);
    }
  };

  const activeCount = employees.filter((e) => e.status === "active").length;
  const totalSalaries = employees.reduce((sum, e) => sum + (e.baseSalary || 0), 0);

  return (
    <div className="space-y-6 font-body">
      {/* 1. KPIS */}
      <AdminKpiGrid cols={3}>
        <AdminKpiCard
          title="Total Trabajadores"
          value={total}
          subtext="Colaboradores registrados"
          icon={<Users className="w-4 h-4" />}
          variant="blue"
          isSelected={statusFilter === "all"}
          onClick={() => {
            setStatusFilter("all");
            fetchEmployees(1, "all");
          }}
        />

        <AdminKpiCard
          title="Colaboradores Activos"
          value={activeCount}
          subtext="En nómina regular"
          icon={<CheckCircle2 className="w-4 h-4" />}
          variant="emerald"
          isSelected={statusFilter === "active"}
          onClick={() => {
            setStatusFilter("active");
            fetchEmployees(1, "active");
          }}
        />

        {canViewSalaries ? (
          <AdminKpiCard
            title="Masa Salarial Mensual"
            value={`$ ${totalSalaries.toLocaleString("es-CO")}`}
            subtext="Suma de salarios base"
            icon={<DollarSign className="w-4 h-4" />}
            variant="purple"
          />
        ) : (
          <AdminKpiCard
            title="Seguridad de Salarios"
            value="Confidencial"
            subtext="Acceso restringido a Dueño"
            icon={<Shield className="w-4 h-4" />}
            variant="amber"
          />
        )}
      </AdminKpiGrid>

      {/* 2. BARRA DE HERRAMIENTAS Y BOTÓN AGREGAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex-1">
          <AdminTableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={() => fetchEmployees(1, statusFilter, searchQuery)}
            searchPlaceholder="Buscar por nombre, documento, cargo o correo..."
            onRefresh={() => fetchEmployees()}
            isPending={isPending}
            filters={
              <AdminSelect
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  fetchEmployees(1, val);
                }}
                options={[
                  { value: "all", label: "Todos los estados" },
                  { value: "active", label: "Activo" },
                  { value: "inactive", label: "Inactivo" },
                  { value: "on_leave", label: "En permiso / Licencia" },
                  { value: "terminated", label: "Retirado" },
                ]}
              />
            }
          />
        </div>

        {canCreateEmployee && (
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Registrar Trabajador</span>
          </button>
        )}
      </div>

      {/* 3. LISTADO DE TRABAJADORES (TABLA UNIFICADA CON ADMIN-DATA-TABLE) */}
      <AdminDataTable<EmployeeModel>
        data={employees}
        columns={[
          {
            header: "Trabajador",
            render: (emp) => (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-xs">
                  {emp.firstName.slice(0, 1)}
                  {emp.lastName.slice(0, 1)}
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block group-hover:text-blue-600 transition-colors">
                    {emp.fullName}
                  </span>
                  <span className="text-[11px] text-slate-400 block">{emp.email || emp.phone || "Sin contacto"}</span>
                </div>
              </div>
            ),
          },
          {
            header: "Documento",
            headerClassName: "whitespace-nowrap",
            className: "whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-300",
            render: (emp) => `${emp.documentType} ${emp.documentNumber}`,
          },
          {
            header: "Cargo / Función",
            headerClassName: "whitespace-nowrap",
            className: "whitespace-nowrap",
            render: (emp) => (
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200">
                {emp.jobTitle}
              </span>
            ),
          },
          {
            header: "Remuneración",
            headerClassName: "whitespace-nowrap",
            className: "whitespace-nowrap font-mono",
            render: (emp) =>
              canViewSalaries ? (
                <span className="font-bold text-slate-900 dark:text-white">
                  $ {emp.baseSalary.toLocaleString("es-CO")}
                </span>
              ) : (
                <span className="text-slate-400 font-sans text-[11px]">••••••</span>
              ),
          },
          {
            header: "Periodicidad",
            headerClassName: "whitespace-nowrap",
            className: "whitespace-nowrap capitalize text-slate-600 dark:text-slate-300",
            render: (emp) => (emp.payFrequency === "biweekly" ? "Quincenal" : emp.payFrequency === "monthly" ? "Mensual" : emp.payFrequency),
          },
          {
            header: "Estado",
            headerClassName: "whitespace-nowrap",
            className: "whitespace-nowrap",
            render: (emp) => (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  emp.status === "active"
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-slate-200/60 dark:bg-white/10 text-slate-500"
                }`}
              >
                {emp.status === "active" ? "Activo" : emp.status}
              </span>
            ),
          },
          {
            header: "Acciones",
            headerClassName: "whitespace-nowrap text-right",
            className: "whitespace-nowrap text-right",
            align: "right",
            render: (emp) => (
              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    setNoveltyEmployee(emp);
                    setNoveltyModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
                  title="Registrar horas extra, bonos o anticipos"
                >
                  + Novedad
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmployee(emp);
                    loadEmployeeNovelties(emp.id);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            ),
          },
        ]}
        keyExtractor={(emp) => emp.id}
        onRowClick={(emp) => {
          setSelectedEmployee(emp);
          loadEmployeeNovelties(emp.id);
        }}
        minWidth="min-w-[800px]"
        emptyState={{
          icon: Users,
          title: "No hay trabajadores registrados",
          description: "Comienza registrando a los colaboradores de tu negocio para gestionar su información y nómina.",
          onReset: () => setCreateModalOpen(true),
          resetLabel: "Registrar Primer Trabajador",
        }}
      />

      {/* MODAL: REGISTRAR TRABAJADOR */}
      {createModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-2xl p-6 sm:p-8 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Registrar Nuevo Trabajador
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Crea la ficha laboral del colaborador para este negocio.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateEmployeeSubmit} className="space-y-6 text-xs">
                {/* 1. DATOS PERSONALES */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider font-mono text-blue-600 dark:text-blue-400">
                    1. Información Personal
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Nombre(s) *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                        placeholder="Ej. Juan Carlos"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Apellido(s) *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                        placeholder="Ej. Gómez Díaz"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Tipo de Documento *
                      </label>
                      <select
                        value={formData.documentType}
                        onChange={(e) => setFormData({ ...formData, documentType: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                      >
                        <option value="CC">Cédula de Ciudadanía (CC)</option>
                        <option value="CE">Cédula de Extranjería (CE)</option>
                        <option value="NIT">NIT</option>
                        <option value="PASAPORTE">Pasaporte</option>
                        <option value="PEP">PEP / PPT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Número de Documento *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.documentNumber}
                        onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                        placeholder="Ej. 1020304050"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Correo Electrónico (Opcional)
                      </label>
                      <input
                        type="email"
                        value={formData.email || ""}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                        placeholder="colaborador@negocio.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Teléfono / Móvil
                      </label>
                      <input
                        type="tel"
                        value={formData.phone || ""}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                        placeholder="Ej. 3001234567"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. DATOS LABORALES */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider font-mono text-blue-600 dark:text-blue-400">
                    2. Información Laboral & Remuneración
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Cargo / Función *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.jobTitle}
                        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                        placeholder="Ej. Cajero, Cocinero, Mesero"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Salario o Remuneración Mensual ($ COP) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formData.baseSalary || ""}
                        onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500 font-mono"
                        placeholder="Ej. 1400000"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Periodicidad de Pago
                      </label>
                      <select
                        value={formData.payFrequency}
                        onChange={(e) => setFormData({ ...formData, payFrequency: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                      >
                        <option value="biweekly">Quincenal (Cada 15 días)</option>
                        <option value="monthly">Mensual</option>
                        <option value="weekly">Semanal</option>
                        <option value="daily">Diario</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Fecha de Ingreso
                      </label>
                      <input
                        type="date"
                        value={formData.hireDate}
                        onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. DATOS DE PAGO BANCARIO */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider font-mono text-blue-600 dark:text-blue-400">
                    3. Información para Pagos (Opcional)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Método de Pago
                      </label>
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                      >
                        <option value="bank_transfer">Transferencia Bancaria</option>
                        <option value="cash">Efectivo</option>
                        <option value="nequi">Nequi</option>
                        <option value="daviplata">Daviplata</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Banco / Entidad
                      </label>
                      <input
                        type="text"
                        value={formData.bankName || ""}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                        placeholder="Ej. Bancolombia, Nequi"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Número de Cuenta / Teléfono
                      </label>
                      <input
                        type="text"
                        value={formData.accountNumber || ""}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500 font-mono"
                        placeholder="Ej. 123456789"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isPending ? "Guardando..." : "Guardar Trabajador"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL: REGISTRAR NOVEDAD */}
      {noveltyModalOpen && noveltyEmployee && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-2xl p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Registrar Novedad Laboral
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Colaborador: <strong>{noveltyEmployee.fullName}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNoveltyModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateNoveltySubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Tipo de Novedad
                  </label>
                  <select
                    value={noveltyData.noveltyType}
                    onChange={(e) => setNoveltyData({ ...noveltyData, noveltyType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                  >
                    <option value="bonus">Bonificación / Incentivo (+)</option>
                    <option value="overtime">Horas Extras (+)</option>
                    <option value="advance">Anticipo de Sueldo (-)</option>
                    <option value="deduction">Deducción / Descuento (-)</option>
                    <option value="sick_leave">Incapacidad</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Descripción o Concepto *
                  </label>
                  <input
                    type="text"
                    required
                    value={noveltyData.description}
                    onChange={(e) => setNoveltyData({ ...noveltyData, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    placeholder="Ej. Bono por ventas del fin de semana"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Monto Económico ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={noveltyData.amount || ""}
                      onChange={(e) => setNoveltyData({ ...noveltyData, amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500 font-mono"
                      placeholder="Ej. 50000"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Fecha
                    </label>
                    <input
                      type="date"
                      required
                      value={noveltyData.startDate}
                      onChange={(e) => setNoveltyData({ ...noveltyData, startDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setNoveltyModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isPending ? "Guardando..." : "Registrar Novedad"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL: FICHA DETALLADA DEL TRABAJADOR */}
      {selectedEmployee && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-2xl p-6 sm:p-8 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-base">
                    {selectedEmployee.firstName.slice(0, 1)}
                    {selectedEmployee.lastName.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {selectedEmployee.fullName}
                    </h3>
                    <span className="text-xs text-slate-400">
                      {selectedEmployee.jobTitle} • {selectedEmployee.documentType} {selectedEmployee.documentNumber}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmployee(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400">Remuneración Base:</span>
                  <span className="font-bold text-slate-900 dark:text-white block text-sm font-mono">
                    {canViewSalaries
                      ? `$ ${selectedEmployee.baseSalary.toLocaleString("es-CO")}`
                      : "Confidencial"}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400">Periodicidad de Pago:</span>
                  <span className="font-semibold text-slate-900 dark:text-white block capitalize">
                    {selectedEmployee.payFrequency === "biweekly" ? "Quincenal" : selectedEmployee.payFrequency}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400">Contacto Móvil:</span>
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    {selectedEmployee.phone || "No registrado"}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400">Método de Pago / Banco:</span>
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    {selectedEmployee.bankName || selectedEmployee.paymentMethod} (
                    {selectedEmployee.accountNumberMasked || "Efectivo"})
                  </span>
                </div>
              </div>

              {/* HISTORIAL DE NOVEDADES */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    Novedades Registradas ({employeeNovelties.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setNoveltyEmployee(selectedEmployee);
                      setNoveltyModalOpen(true);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    + Registrar Novedad
                  </button>
                </div>

                {employeeNovelties.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/[0.08] text-center">
                    No hay novedades registradas para este colaborador.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/[0.06] rounded-xl border border-slate-200 dark:border-white/[0.08] overflow-hidden text-xs">
                    {employeeNovelties.map((nov) => (
                      <div key={nov.id} className="p-3 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {nov.description}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{nov.startDate}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          $ {nov.amount.toLocaleString("es-CO")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedEmployee(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Cerrar Ficha
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
