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
  KeyRound,
  Trash2,
  Calendar,
  LayoutGrid,
  ListFilter,
  Hash,
  Sparkles,
  ToggleLeft,
  ToggleRight,
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
  deleteWorkspaceEmployeeAction,
  createWorkspaceEmployeeNoveltyAction,
  getWorkspaceEmployeeNoveltiesAction,
  assignEmployeePinAction,
} from "./actions";
import { PinAssignModal } from "@/components/security/pin-assign-modal";
import { DataTable } from "@/components/ui/data-table";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { KpiGrid, KpiCard } from "@/components/ui";
import { ModalPortal } from "@/components/ui/modal-portal";
import { ConfirmModal } from "@/components/ui/confirm-modal";

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

/**
 * Extrae o genera el código interno del colaborador / camarero (ej: #css1, #CAM001)
 */
function getEmployeeDisplayCode(emp: EmployeeModel): string {
  if (emp.notes) {
    const match = emp.notes.match(/\[CODE:([^\]]+)\]/);
    if (match && match[1]) {
      const code = match[1].trim();
      return code.startsWith("#") ? code : `#${code}`;
    }
  }

  if (emp.documentNumber && (emp.documentNumber.startsWith("#") || emp.documentNumber.startsWith("CAM-") || emp.documentNumber.length <= 8)) {
    return emp.documentNumber.startsWith("#") ? emp.documentNumber : `#${emp.documentNumber}`;
  }

  return `#CAM${emp.id.slice(0, 4).toUpperCase()}`;
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Modales
  const [camareroModalOpen, setCamareroModalOpen] = useState(false);
  const [fullCreateModalOpen, setFullCreateModalOpen] = useState(false);
  const [editEmployeeModalOpen, setEditEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeModel | null>(null);

  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeModel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeModel | null>(null);
  const [isEmployeePinModalOpen, setIsEmployeePinModalOpen] = useState(false);
  const [noveltyModalOpen, setNoveltyModalOpen] = useState(false);
  const [noveltyEmployee, setNoveltyEmployee] = useState<EmployeeModel | null>(null);
  const [employeeNovelties, setEmployeeNovelties] = useState<EmployeeNoveltyModel[]>([]);

  // Formulario rápido de Camarero
  const [camareroForm, setCamareroForm] = useState({
    code: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    jobTitle: "Camarero",
  });

  // Formulario de edición
  const [editForm, setEditForm] = useState({
    code: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    jobTitle: "",
    status: "active" as EmployeeStatus,
  });

  // Formulario completo de trabajador
  const [fullFormData, setFullFormData] = useState<UpsertEmployeeInput>({
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
        pageSize: 50,
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

  // Filtrado reactivo en tiempo real al escribir (debounce 300ms)
  const isSearchInitialMount = React.useRef(true);
  useEffect(() => {
    if (isSearchInitialMount.current) {
      isSearchInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      fetchEmployees(1, statusFilter, searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleClearSearch = () => {
    setSearchQuery("");
    fetchEmployees(1, statusFilter, "");
  };

  // 1. Alta rápida de camarero
  const handleCreateCamareroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!camareroForm.firstName.trim() || !camareroForm.lastName.trim()) {
      toast.error("El nombre y el apellido son obligatorios.");
      return;
    }

    const cleanCode = camareroForm.code.trim();
    const formattedCode = cleanCode ? (cleanCode.startsWith("#") ? cleanCode : `#${cleanCode}`) : "";
    const notesWithCode = formattedCode ? `[CODE:${formattedCode}]` : "";

    const payload: UpsertEmployeeInput = {
      firstName: camareroForm.firstName.trim(),
      lastName: camareroForm.lastName.trim(),
      documentType: "CC",
      documentNumber: formattedCode || `CAM-${Date.now().toString().slice(-4)}`,
      email: camareroForm.email.trim() || undefined,
      phone: camareroForm.phone.trim() || undefined,
      jobTitle: camareroForm.jobTitle.trim() || "Camarero",
      contractType: "indefinido",
      status: "active",
      compensationType: "fixed_salary",
      baseSalary: 0,
      payFrequency: "monthly",
      paymentMethod: "cash",
      notes: notesWithCode,
      hireDate: new Date().toISOString().split("T")[0],
    };

    startTransition(async () => {
      const res = await createWorkspaceEmployeeAction(businessId, payload);
      if (res.success) {
        toast.success(`Camarero ${camareroForm.firstName} agregado con éxito.`);
        setCamareroModalOpen(false);
        setCamareroForm({
          code: "",
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          jobTitle: "Camarero",
        });
        fetchEmployees();
      } else {
        toast.error(res.error || "No fue posible agregar al camarero.");
      }
    });
  };

  // 2. Abrir modal de edición
  const handleOpenEdit = (emp: EmployeeModel) => {
    setEditingEmployee(emp);
    const code = getEmployeeDisplayCode(emp);
    setEditForm({
      code,
      firstName: emp.firstName,
      lastName: emp.lastName,
      phone: emp.phone || "",
      email: emp.email || "",
      jobTitle: emp.jobTitle || "Camarero",
      status: emp.status,
    });
    setEditEmployeeModalOpen(true);
  };

  // 3. Guardar cambios de edición
  const handleEditEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      toast.error("El nombre y el apellido son obligatorios.");
      return;
    }

    const cleanCode = editForm.code.trim();
    const formattedCode = cleanCode ? (cleanCode.startsWith("#") ? cleanCode : `#${cleanCode}`) : "";
    
    // Mantener otras notas existentes pero reemplazar [CODE:...]
    let newNotes = editingEmployee.notes || "";
    if (/\[CODE:[^\]]+\]/.test(newNotes)) {
      newNotes = newNotes.replace(/\[CODE:[^\]]+\]/, formattedCode ? `[CODE:${formattedCode}]` : "");
    } else if (formattedCode) {
      newNotes = `${newNotes} [CODE:${formattedCode}]`.trim();
    }

    const payload: Partial<UpsertEmployeeInput> = {
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      phone: editForm.phone.trim() || undefined,
      email: editForm.email.trim() || undefined,
      jobTitle: editForm.jobTitle.trim(),
      status: editForm.status,
      notes: newNotes,
    };

    startTransition(async () => {
      const res = await updateWorkspaceEmployeeAction(businessId, editingEmployee.id, payload);
      if (res.success) {
        toast.success("Información del colaborador actualizada.");
        setEditEmployeeModalOpen(false);
        setEditingEmployee(null);
        fetchEmployees();
      } else {
        toast.error(res.error || "No se pudo actualizar el colaborador.");
      }
    });
  };

  // 4. Toggle activo / inactivo directo
  const handleToggleStatus = (emp: EmployeeModel) => {
    const nextStatus: EmployeeStatus = emp.status === "active" ? "inactive" : "active";
    const statusLabel = nextStatus === "active" ? "activado" : "desactivado";

    // Optimistic update
    setEmployees((prev) =>
      prev.map((item) => (item.id === emp.id ? { ...item, status: nextStatus } : item))
    );

    startTransition(async () => {
      const res = await updateWorkspaceEmployeeAction(businessId, emp.id, {
        status: nextStatus,
      });

      if (res.success) {
        toast.success(`Colaborador ${emp.fullName} ${statusLabel}.`);
      } else {
        // Rollback
        setEmployees((prev) =>
          prev.map((item) => (item.id === emp.id ? { ...item, status: emp.status } : item))
        );
        toast.error(res.error || "No se pudo cambiar el estado del colaborador.");
      }
    });
  };

  // 5. Confirmar y ejecutar eliminación (CERO alertas nativas)
  const handleConfirmDelete = async () => {
    if (!employeeToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteWorkspaceEmployeeAction(businessId, employeeToDelete.id);
      if (res.success) {
        toast.success(`Colaborador ${employeeToDelete.fullName} eliminado exitosamente.`);
        setEmployees((prev) => prev.filter((item) => item.id !== employeeToDelete.id));
        setTotal((prev) => Math.max(0, prev - 1));
        setEmployeeToDelete(null);
      } else {
        toast.error(res.error || "No se pudo eliminar al colaborador.");
      }
    } catch {
      toast.error("Ocurrió un error al procesar la eliminación.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 6. Registro de novedad
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
  const inactiveCount = employees.filter((e) => e.status !== "active").length;
  const totalSalaries = employees.reduce((sum, e) => sum + (e.baseSalary || 0), 0);

  // Filtrado local según estado seleccionado en pestañas
  const filteredEmployees = employees.filter((emp) => {
    if (statusFilter === "active") return emp.status === "active";
    if (statusFilter === "inactive") return emp.status !== "active";
    return true;
  });

  return (
    <div className="space-y-6 font-body">
      {/* 1. KPIS RESUMEN */}
      <KpiGrid cols={3}>
        <KpiCard
          title="Personal Registrado"
          value={total}
          subtext="Equipo y camareros en total"
          icon={<Users className="w-4 h-4" />}
          variant="blue"
          isSelected={statusFilter === "all"}
          onClick={() => {
            setStatusFilter("all");
            fetchEmployees(1, "all");
          }}
        />

        <KpiCard
          title="Personal Activo"
          value={activeCount}
          subtext="En servicio y turnos activos"
          icon={<CheckCircle2 className="w-4 h-4" />}
          variant="emerald"
          isSelected={statusFilter === "active"}
          onClick={() => {
            setStatusFilter("active");
            fetchEmployees(1, "active");
          }}
        />

        {canViewSalaries ? (
          <KpiCard
            title="Masa Salarial Mensual"
            value={`$ ${totalSalaries.toLocaleString("es-CO")}`}
            subtext="Suma de salarios base"
            icon={<DollarSign className="w-4 h-4" />}
            variant="purple"
          />
        ) : (
          <KpiCard
            title="Personal Inactivo"
            value={inactiveCount}
            subtext="Fuera de turno o suspendidos"
            icon={<XCircle className="w-4 h-4" />}
            variant="amber"
            isSelected={statusFilter === "inactive"}
            onClick={() => {
              setStatusFilter("inactive");
              fetchEmployees(1, "inactive");
            }}
          />
        )}
      </KpiGrid>

      {/* 2. BARRA DE CONTROL: BÚSQUEDA, FILTROS Y ACCIÓN PRINCIPAL "+ AGREGAR CAMARERO" */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Pestañas de estado rápido */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200/60 dark:border-white/[0.06] overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              fetchEmployees(1, "all");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === "all"
                ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Todos ({total})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("active");
              fetchEmployees(1, "active");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "active"
                ? "bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Activos ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("inactive");
              fetchEmployees(1, "inactive");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "inactive"
                ? "bg-white dark:bg-white/10 text-slate-700 dark:text-slate-200 shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Inactivos ({inactiveCount})
          </button>
        </div>

        {/* Buscador y selector de vista */}
        <div className="flex flex-1 max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, código (#css1), teléfono..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle de vistas: Tarjetas / Tabla */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200/60 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              title="Vista en tarjetas de personal"
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === "cards"
                  ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Vista en tabla detallada"
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === "table"
                  ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <ListFilter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2 shrink-0">
          {canCreateEmployee && (
            <>
              <button
                type="button"
                onClick={() => setCamareroModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Agregar Camarero</span>
              </button>

              <button
                type="button"
                onClick={() => setFullCreateModalOpen(true)}
                title="Registrar con ficha laboral y cuenta bancaria"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 font-semibold text-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Ficha Completa</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 3. VISTA EN TARJETAS DE EMPLEADO (ESPECIFICACIÓN PRINCIPAL) */}
      {viewMode === "cards" ? (
        filteredEmployees.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#0D0F16] border border-dashed border-slate-200 dark:border-white/[0.08] space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 mx-auto flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <div className="max-w-sm mx-auto space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No hay camareros ni personal encontrado
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {searchQuery
                  ? "No se encontraron colaboradores que coincidan con la búsqueda."
                  : "Comienza agregando al equipo de camareros y atención para asignarles mesas y pedidos."}
              </p>
            </div>
            {canCreateEmployee && (
              <button
                type="button"
                onClick={() => setCamareroModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Agregar Primer Camarero</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredEmployees.map((emp) => {
              const code = getEmployeeDisplayCode(emp);
              const isActive = emp.status === "active";

              return (
                <div
                  key={emp.id}
                  className={`group relative rounded-2xl bg-white dark:bg-[#0D0F16] border transition-all duration-200 flex flex-col justify-between p-4.5 ${
                    isActive
                      ? "border-slate-200/90 dark:border-white/[0.08] hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5"
                      : "border-slate-200/50 dark:border-white/[0.04] opacity-80 bg-slate-50/50 dark:bg-white/[0.01]"
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Cabecera de la tarjeta: Avatar, Nombre y Código */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm tracking-tight shadow-xs ${
                            isActive
                              ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                              : "bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {emp.firstName.slice(0, 1)}
                          {emp.lastName.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {emp.fullName}
                          </h4>
                          <span className="inline-block text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                            {emp.jobTitle || "Camarero / Servicio"}
                          </span>
                        </div>
                      </div>

                      {/* Badge de Código Interno (ej. #css1 / #CAM001) */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/[0.08] shrink-0">
                        <Hash className="w-3 h-3 text-blue-500" />
                        {code}
                      </span>
                    </div>

                    {/* Información de Contacto y Fecha de Registro */}
                    <div className="space-y-1.5 pt-1 text-xs border-t border-slate-100 dark:border-white/[0.04]">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {emp.phone ? (
                            <a
                              href={`tel:${emp.phone}`}
                              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              {emp.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">Sin teléfono</span>
                          )}
                        </span>
                      </div>

                      {emp.email && (
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {emp.email}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Registrado:{" "}
                          {new Date(emp.createdAt || emp.hireDate).toLocaleDateString("es-CO", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pie de tarjeta: Toggle Activo/Inactivo + Acciones (Editar, PIN, Eliminar) */}
                  <div className="pt-3.5 mt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
                    {/* Switch / Toggle Activo - Inactivo */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(emp)}
                      className="inline-flex items-center gap-1.5 cursor-pointer select-none group/toggle"
                      title={isActive ? "Desactivar colaborador" : "Activar colaborador"}
                    >
                      <span
                        className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                          isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-white/20"
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                            isActive ? "translate-x-3.5" : "translate-x-0"
                          }`}
                        />
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          isActive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {isActive ? "Activo" : "Inactivo"}
                      </span>
                    </button>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-1">
                      {/* Botón PIN */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setIsEmployeePinModalOpen(true);
                        }}
                        className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          emp.hasSecurityPin
                            ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                            : "text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                        }`}
                        title={emp.hasSecurityPin ? "PIN asignado (cambiar)" : "Asignar PIN de servicio"}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>

                      {/* Botón Editar */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(emp)}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
                        title="Editar datos del colaborador"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Botón Eliminar con Modal de Confirmación */}
                      <button
                        type="button"
                        onClick={() => setEmployeeToDelete(emp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Eliminar colaborador"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* 4. VISTA EN TABLA DETALLADA */
        <DataTable<EmployeeModel>
          data={filteredEmployees}
          columns={[
            {
              header: "Personal / Camarero",
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
              header: "Código Interno",
              className: "whitespace-nowrap font-mono text-xs font-bold text-slate-700 dark:text-slate-300",
              render: (emp) => (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10">
                  {getEmployeeDisplayCode(emp)}
                </span>
              ),
            },
            {
              header: "Cargo / Función",
              className: "whitespace-nowrap",
              render: (emp) => (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200">
                  {emp.jobTitle || "Camarero"}
                </span>
              ),
            },
            {
              header: "Teléfono",
              className: "whitespace-nowrap font-mono text-xs text-slate-600 dark:text-slate-300",
              render: (emp) => emp.phone || "—",
            },
            {
              header: "Estado",
              className: "whitespace-nowrap",
              render: (emp) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStatus(emp);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${
                    emp.status === "active"
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20"
                      : "bg-slate-200/60 dark:bg-white/10 text-slate-500 hover:bg-slate-300 dark:hover:bg-white/20"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      emp.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  {emp.status === "active" ? "Activo" : "Inactivo"}
                </button>
              ),
            },
            {
              header: "Acciones",
              className: "whitespace-nowrap text-right",
              align: "right",
              render: (emp) => (
                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(emp)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployee(emp);
                      setIsEmployeePinModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    title="Asignar PIN"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmployeeToDelete(emp)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ),
            },
          ]}
          keyExtractor={(emp) => emp.id}
          onRowClick={(emp) => handleOpenEdit(emp)}
          minWidth="min-w-[700px]"
          emptyState={{
            icon: Users,
            title: "No hay colaboradores registrados",
            description: "Comienza registrando al personal de servicio para administrar sus accesos.",
            onReset: () => setCamareroModalOpen(true),
            resetLabel: "+ Agregar Camarero",
          }}
        />
      )}

      {/* MODAL 1: AGREGAR CAMARERO (ESPECIFICACIÓN EXACTA DEL USUARIO) */}
      {camareroModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-2xl p-6 sm:p-7 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Agregar Camarero
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Personal de atención en mesas y servicio.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCamareroModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCamareroSubmit} className="space-y-4 text-xs">
                {/* Código de empleado (opcional) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Código de empleado (opcional)
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={camareroForm.code}
                      onChange={(e) => setCamareroForm({ ...camareroForm, code: e.target.value })}
                      placeholder="Ej. #css1 o #CAM001"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono placeholder:font-sans focus:outline-blue-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Identificador corto para asociar órdenes y comandas rápidamente.
                  </p>
                </div>

                {/* Nombre y Apellido */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      required
                      value={camareroForm.firstName}
                      onChange={(e) => setCamareroForm({ ...camareroForm, firstName: e.target.value })}
                      placeholder="Ej. Juan"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      value={camareroForm.lastName}
                      onChange={(e) => setCamareroForm({ ...camareroForm, lastName: e.target.value })}
                      placeholder="Ej. Pérez"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={camareroForm.phone}
                      onChange={(e) => setCamareroForm({ ...camareroForm, phone: e.target.value })}
                      placeholder="+57 300 123 4567"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={camareroForm.email}
                      onChange={(e) => setCamareroForm({ ...camareroForm, email: e.target.value })}
                      placeholder="camarero@negocio.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setCamareroModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? "Guardando..." : "Agregar Camarero"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 2: EDITAR CAMARERO / EMPLEADO */}
      {editEmployeeModalOpen && editingEmployee && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
            <div
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-2xl p-6 sm:p-7 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <Edit className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Editar Personal
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Actualiza datos de contacto o código de servicio.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditEmployeeModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditEmployeeSubmit} className="space-y-4 text-xs">
                {/* Código */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Código de empleado
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={editForm.code}
                      onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono focus:outline-blue-500"
                    />
                  </div>
                </div>

                {/* Nombre y Apellido */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                </div>

                {/* Cargo */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cargo / Rol
                  </label>
                  <input
                    type="text"
                    value={editForm.jobTitle}
                    onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                  />
                </div>

                {/* Teléfono y Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Estado en el negocio
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as EmployeeStatus })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                  >
                    <option value="active">Activo (Disponible para turnos)</option>
                    <option value="inactive">Inactivo (Fuera de turno)</option>
                    <option value="on_leave">En permiso / Licencia</option>
                    <option value="terminated">Retirado</option>
                  </select>
                </div>

                {/* Botones */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setEditEmployeeModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? "Guardando..." : "Guardar Cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 3: CONFIRMAR ELIMINACIÓN (SIN ALERTAS NATIVAS) */}
      <ConfirmModal
        isOpen={Boolean(employeeToDelete)}
        onClose={() => setEmployeeToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar colaborador?"
        description={`¿Estás seguro de que deseas eliminar a ${employeeToDelete?.fullName}? Esta acción revocará sus accesos y desvinculará sus turnos activos.`}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* MODAL 4: PIN DE SEGURIDAD POS */}
      {selectedEmployee && (
        <PinAssignModal
          isOpen={isEmployeePinModalOpen}
          onClose={() => setIsEmployeePinModalOpen(false)}
          onSuccess={() => {
            setSelectedEmployee((prev) => (prev ? { ...prev, hasSecurityPin: true } : null));
            fetchEmployees();
          }}
          employeeName={selectedEmployee.fullName}
          hasExistingPin={Boolean(selectedEmployee.hasSecurityPin)}
          onSavePin={(pin) => assignEmployeePinAction(businessId, selectedEmployee.id, pin)}
        />
      )}

      {/* MODAL 5: FICHA COMPLETA (CREAR TRABAJADOR DETALLADO) */}
      {fullCreateModalOpen && (
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
                      Registrar Ficha Laboral Completa
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Datos personales, contractuales y remuneración base.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFullCreateModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!fullFormData.firstName || !fullFormData.lastName || !fullFormData.documentNumber || !fullFormData.jobTitle) {
                    toast.error("Por favor completa los campos obligatorios (*).");
                    return;
                  }
                  startTransition(async () => {
                    const res = await createWorkspaceEmployeeAction(businessId, fullFormData);
                    if (res.success) {
                      toast.success(`Colaborador ${fullFormData.firstName} registrado.`);
                      setFullCreateModalOpen(false);
                      fetchEmployees();
                    } else {
                      toast.error(res.error || "No fue posible registrar al trabajador.");
                    }
                  });
                }}
                className="space-y-6 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Nombre(s) *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullFormData.firstName}
                      onChange={(e) => setFullFormData({ ...fullFormData, firstName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Apellido(s) *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullFormData.lastName}
                      onChange={(e) => setFullFormData({ ...fullFormData, lastName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Documento Identidad *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullFormData.documentNumber}
                      onChange={(e) => setFullFormData({ ...fullFormData, documentNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Cargo / Puesto *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullFormData.jobTitle}
                      onChange={(e) => setFullFormData({ ...fullFormData, jobTitle: e.target.value })}
                      placeholder="Ej. Camarero / Jefe de Salón"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setFullCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? "Guardando..." : "Guardar Ficha"}
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
