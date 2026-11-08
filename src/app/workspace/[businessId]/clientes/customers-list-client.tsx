"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Users,
  User,
  Building2,
  Plus,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Eye,
  RotateCcw,
  CreditCard,
  Wallet,
  AlertTriangle,
  FileSpreadsheet,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Info,
  DollarSign,
  ShoppingBag,
  Award,
} from "lucide-react";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { Button, IconButton } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { CustomerModal } from "@/components/customers/customer-modal";
import { CustomerPortfolioTab } from "@/components/customers/customer-portfolio-tab";
import { deleteCustomerAction } from "./actions";
import {
  CustomerSummaryItem,
  Customer,
  CustomerCreditTab,
  CustomerDirectoryTab,
  AccountsReceivableKPIs,
  CustomerGlobalKPIs,
} from "@/lib/customers/types";
import { toast } from "sonner";

interface CustomersListClientProps {
  businessId: string;
  businessName: string;
  canCreateCustomer: boolean;
  canDeleteCustomer: boolean;
  customers: CustomerSummaryItem[];
  creditKpis?: AccountsReceivableKPIs;
  globalKpis?: CustomerGlobalKPIs;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  filters: {
    search: string;
    status: string;
    creditTab?: CustomerCreditTab;
    directoryTab?: CustomerDirectoryTab;
    period?: "all" | "today" | "7d" | "month" | "year";
    sortBy?: "sales_desc" | "orders_desc" | "name_asc" | "name_desc" | "recent";
  };
}

export function CustomersListClient({
  businessId,
  businessName,
  canCreateCustomer,
  canDeleteCustomer,
  customers,
  creditKpis,
  globalKpis,
  totalCount,
  totalPages,
  currentPage,
  pageSize,
  filters,
}: CustomersListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(filters.search);
  const [directoryTab, setDirectoryTab] = useState<CustomerDirectoryTab>(
    filters.directoryTab || "all"
  );
  const [periodFilter, setPeriodFilter] = useState<string>(
    filters.period || "all"
  );
  const [sortFilter, setSortFilter] = useState<string>(
    filters.sortBy || "sales_desc"
  );

  const [mainTab, setMainTab] = useState<"directory" | "portfolio">("directory");

  // Dropdown contextual activo por fila de cliente
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sincronizar estado local si cambian los props del servidor
  useEffect(() => {
    setSearchTerm(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (filters.directoryTab) {
      setDirectoryTab(filters.directoryTab);
    }
  }, [filters.directoryTab]);

  useEffect(() => {
    if (filters.period) {
      setPeriodFilter(filters.period);
    }
  }, [filters.period]);

  useEffect(() => {
    if (filters.sortBy) {
      setSortFilter(filters.sortBy);
    }
  }, [filters.sortBy]);

  // Estados de Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  // Modal de confirmación de eliminación
  const [customerToDelete, setCustomerToDelete] = useState<CustomerSummaryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatCOP = (val: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val || 0);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Sin compras";
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(d);
    } catch {
      return "Sin compras";
    }
  };

  const applyFilters = (
    newSearch?: string,
    newTab?: CustomerDirectoryTab,
    newPeriod?: string,
    newSort?: string,
    newPage?: number
  ) => {
    const s = newSearch !== undefined ? newSearch : searchTerm;
    const tab = newTab !== undefined ? newTab : directoryTab;
    const per = newPeriod !== undefined ? newPeriod : periodFilter;
    const sort = newSort !== undefined ? newSort : sortFilter;
    const p = newPage !== undefined ? newPage : 1;

    const params = new URLSearchParams();
    if (s.trim()) params.set("search", s.trim());
    if (tab && tab !== "all") params.set("tab", tab);
    if (per && per !== "all") params.set("period", per);
    if (sort && sort !== "sales_desc") params.set("sortBy", sort);
    if (p > 1) params.set("page", String(p));

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Filtrado reactivo en tiempo real con debounce al escribir (300ms)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (searchTerm === filters.search) return;

    const timer = setTimeout(() => {
      applyFilters(searchTerm, directoryTab, periodFilter, sortFilter, 1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(searchTerm, directoryTab, periodFilter, sortFilter, 1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    applyFilters("", directoryTab, periodFilter, sortFilter, 1);
  };

  const handleTabChange = (newTab: CustomerDirectoryTab) => {
    setDirectoryTab(newTab);
    applyFilters(searchTerm, newTab, periodFilter, sortFilter, 1);
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriodFilter(newPeriod);
    applyFilters(searchTerm, directoryTab, newPeriod, sortFilter, 1);
  };

  const handleSortChange = (newSort: string) => {
    setSortFilter(newSort);
    applyFilters(searchTerm, directoryTab, periodFilter, newSort, 1);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setDirectoryTab("all");
    setPeriodFilter("all");
    setSortFilter("sales_desc");
    applyFilters("", "all", "all", "sales_desc", 1);
  };

  const handlePageChange = (newPage: number) => {
    applyFilters(searchTerm, directoryTab, periodFilter, sortFilter, newPage);
  };

  // Exportar Excel completo consolidado (con BOM UTF-8)
  const handleExportExcel = () => {
    if (customers.length === 0) {
      toast.info("No hay clientes en el listado para exportar.");
      return;
    }

    const headers = [
      "Top",
      "Cliente / Nombre",
      "Documento / NIT",
      "Teléfono",
      "Correo Electrónico",
      "Dirección Principal",
      "Total Comprado ($ COP)",
      "Número de Pedidos",
      "Ticket Promedio ($ COP)",
      "Última Compra",
      "Saldo Registrado ($ COP)",
      "Cupo de Crédito ($ COP)",
      "Por Cobrar ($ COP)",
      "Crédito Disponible ($ COP)",
      "Estado",
      "Notas",
      "Fecha de Registro",
    ];

    const rows = customers.map((c) => [
      c.topRank ? `#${c.topRank}` : "-",
      `"${(c.fullName || "").replace(/"/g, '""')}"`,
      `"${c.taxId || ""}"`,
      `"${c.phone || ""}"`,
      `"${c.email || ""}"`,
      `"${(c.primaryAddress || "").replace(/"/g, '""')}"`,
      c.totalSpentAmount || 0,
      c.totalOrdersCount || 0,
      c.averageTicket || 0,
      c.lastActivityDate ? formatDate(c.lastActivityDate) : "Sin compras",
      c.balanceAmount || 0,
      c.creditLimit || 0,
      c.creditUsed || 0,
      c.creditAvailable || 0,
      c.status === "active" ? "Activo" : "Inactivo",
      `"${(c.notes || "").replace(/"/g, '""')}"`,
      formatDate(c.createdAt),
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const cleanBusiness = businessName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    link.href = url;
    link.setAttribute("download", `clientes_${cleanBusiness}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Base de datos de clientes exportada con éxito.");
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteCustomerAction(businessId, customerToDelete.id);
      if (!res.success) {
        toast.error(res.error || "No se pudo eliminar el cliente");
        return;
      }
      toast.success("Cliente eliminado exitosamente");
      setCustomerToDelete(null);
      router.refresh();
    } catch {
      toast.error("Ocurrió un error al intentar eliminar el cliente");
    } finally {
      setIsDeleting(false);
    }
  };

  // KPIs calculados
  const totalReg = globalKpis?.totalRegistered ?? totalCount;
  const activeReg = globalKpis?.activeCount ?? totalCount;
  const inactiveReg = globalKpis?.inactiveCount ?? 0;
  const hasPurchased = globalKpis?.hasPurchasedCount ?? 0;
  const neverPurchased = globalKpis?.neverPurchasedCount ?? Math.max(0, totalReg - hasPurchased);
  const totalSalesAmt = globalKpis?.totalSalesAmount ?? 0;
  const totalBalanceAmt = globalKpis?.totalBalanceAmount ?? 0;

  const withCreditCount = globalKpis?.withCreditCount ?? (creditKpis?.customersWithCreditCount || 0);
  const totalReceivable = globalKpis?.totalReceivable ?? (creditKpis?.totalReceivable || 0);
  const debtCustomersCount = globalKpis?.debtCustomersCount ?? (creditKpis?.customersWithDebtCount || 0);
  const overdueBalance = globalKpis?.overdueBalance ?? (creditKpis?.overdueBalance || 0);
  const overdueCustomersCount = globalKpis?.overdueCustomersCount ?? (creditKpis?.overdueCustomersCount || 0);

  const hasActiveFilters =
    Boolean(searchTerm) ||
    directoryTab !== "all" ||
    periodFilter !== "all" ||
    sortFilter !== "sales_desc";

  return (
    <AppPageContainer
      title="Clientes"
      description="Conoce quién te compra, sus datos de contacto y los beneficios que le ofreces."
      actions={
        <div className="flex items-center gap-2">
          {/* Botón Excel completo */}
          <Button
            variant="outline"
            size="md"
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            onClick={handleExportExcel}
            title="Exportar base completa de clientes consolidada a Excel"
          >
            Excel completo
          </Button>

          {/* Botón + Nuevo cliente */}
          {canCreateCustomer && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setCustomerToEdit(null);
                setIsModalOpen(true);
              }}
            >
              + Nuevo cliente
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Sección superior breadcrumb / pill */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Link
            href={`/workspace/${businessId}`}
            className="hover:text-slate-900 dark:hover:text-white transition"
          >
            Inicio
          </Link>
          <span>/</span>
          <span className="text-[#ED500A] font-bold">Clientes</span>
        </div>

        {/* ============================================================== */}
        {/* 2. MÉTRICAS Y KPIS DE CLIENTES (3 COLUMNAS LIMPIAS)            */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Clientes registrados */}
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-2xs transition-all hover:border-slate-300 dark:hover:border-white/[0.15]">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span className="font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Users className="w-4 h-4 text-blue-500" />
                Clientes registrados
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white">
              {totalReg}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1 font-medium">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{activeReg} activos</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-400">{inactiveReg} inactivos</span>
            </div>
          </div>

          {/* 2. Ya han comprado */}
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-2xs transition-all hover:border-slate-300 dark:hover:border-white/[0.15]">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span className="font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <ShoppingBag className="w-4 h-4 text-emerald-500" />
                Ya han comprado
              </span>
              {totalReg > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                  {Math.round((hasPurchased / (totalReg || 1)) * 100)}%
                </span>
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {hasPurchased}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              {neverPurchased === 1
                ? "1 aún no compra"
                : `${neverPurchased} aún no compran`}
            </div>
          </div>

          {/* 3. Ventas a clientes */}
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-2xs transition-all hover:border-slate-300 dark:hover:border-white/[0.15]">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span className="font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <DollarSign className="w-4 h-4 text-[#ED500A]" />
                Ventas a clientes
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white">
              {formatCOP(totalSalesAmt)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 truncate">
              Historial total vendido a clientes registrados
            </div>
          </div>
        </div>

        <div className="space-y-4">
            {/* ============================================================== */}
            {/* 3. DIRECTORIO DE CLIENTES: ENCABEZADO Y PESTAÑAS              */}
            {/* ============================================================== */}
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-white/[0.06] pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Directorio de clientes
                    </h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-[#ED500A] font-bold">
                      {totalCount} {totalCount === 1 ? "cliente" : "clientes"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Contacto, compras y beneficios en un solo lugar.
                  </p>
                </div>
              </div>

              {/* Pestañas de filtrado del directorio */}
              <Tabs<CustomerDirectoryTab>
                tabs={[
                  { id: "all", label: "Todos" },
                  { id: "active", label: "Activos" },
                  { id: "individual", label: "Persona natural" },
                  { id: "business", label: "Empresa" },
                  { id: "inactive", label: "Inactivos" },
                ]}
                activeTab={directoryTab}
                onChange={handleTabChange}
                size="sm"
              />

              {/* Barra de Filtros y Búsqueda */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                {/* Buscador textual con placeholder exacto */}
                <div className="sm:col-span-6">
                  <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    onSubmit={handleSearchSubmit}
                    onClear={handleClearSearch}
                    placeholder="Nombre, teléfono, correo o documento..."
                    isLoading={isPending}
                    showSubmitButton={false}
                  />
                </div>

                {/* Filtro de período/actividad */}
                <div className="sm:col-span-3">
                  <Select
                    value={periodFilter}
                    onChange={handlePeriodChange}
                    options={[
                      { value: "all", label: "Toda la actividad" },
                      { value: "today", label: "Hoy" },
                      { value: "7d", label: "Últimos 7 días" },
                      { value: "month", label: "Este mes" },
                      { value: "year", label: "Este año" },
                    ]}
                    containerClassName="space-y-0"
                  />
                </div>

                {/* Criterio de ordenamiento */}
                <div className="sm:col-span-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <Select
                      value={sortFilter}
                      onChange={handleSortChange}
                      options={[
                        { value: "sales_desc", label: "Mayor valor comprado" },
                        { value: "orders_desc", label: "Más compras" },
                        { value: "name_asc", label: "Nombre (A–Z)" },
                        { value: "name_desc", label: "Nombre (Z–A)" },
                        { value: "recent", label: "Más recientes" },
                      ]}
                      containerClassName="space-y-0"
                    />
                  </div>

                  {hasActiveFilters && (
                    <IconButton
                      icon={<RotateCcw className="w-4 h-4" />}
                      title="Restablecer filtros"
                      variant="outline"
                      size="md"
                      onClick={handleResetFilters}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* TABLA DEL DIRECTORIO DE CLIENTES                                */}
            {/* ============================================================== */}
            {isPending ? (
              <TableSkeleton rows={5} cols={9} />
            ) : customers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No se encontraron clientes"
                description={
                  searchTerm
                    ? `No hay coincidencias para "${searchTerm}". Intenta buscar por otro nombre, teléfono o documento.`
                    : directoryTab !== "all"
                    ? "No hay clientes en esta pestaña de filtrado."
                    : "Aún no tienes clientes registrados. Crea el primero para comenzar a registrar su historial."
                }
                actionLabel={canCreateCustomer ? "+ Nuevo cliente" : undefined}
                onAction={
                  canCreateCustomer
                    ? () => {
                        setCustomerToEdit(null);
                        setIsModalOpen(true);
                      }
                    : undefined
                }
                resetLabel={hasActiveFilters ? "Restablecer filtros" : undefined}
                onReset={hasActiveFilters ? handleResetFilters : undefined}
              />
            ) : (
              <div className="space-y-4">
                {/* Vista Móvil: Tarjetas (360px a 640px) */}
                <div className="grid grid-cols-1 gap-3 sm:hidden">
                  {customers.map((c) => (
                    <div
                      key={c.id}
                      className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {c.topRank ? (
                            <span className="w-6 h-6 rounded-lg bg-orange-500/10 text-[#ED500A] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                              #{c.topRank}
                            </span>
                          ) : (
                            <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/[0.05] text-slate-400 font-mono text-xs flex items-center justify-center shrink-0">
                              -
                            </span>
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/workspace/${businessId}/clientes/${c.id}`}
                              className="text-sm font-bold text-slate-900 dark:text-white hover:text-[#ED500A] transition-colors truncate block"
                            >
                              {c.fullName}
                            </Link>
                            <span className="text-[11px] text-slate-400 font-mono block">
                              {c.taxId ? `NIT/CC: ${c.taxId}` : "Sin documento"}
                            </span>
                          </div>
                        </div>

                        <StatusBadge
                          status={c.status}
                          label={c.status === "active" ? "Activo" : "Inactivo"}
                          variant={c.status === "active" ? "emerald" : "slate"}
                        />
                      </div>

                      {/* Contacto en móvil */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-mono">
                        {c.phone ? (
                          <a
                            href={`tel:${c.phone}`}
                            className="flex items-center gap-1 hover:text-[#ED500A]"
                          >
                            <Phone className="w-3.5 h-3.5 text-[#ED500A]" />
                            <span>{c.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Sin teléfono</span>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate max-w-[180px]">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </div>
                        )}
                      </div>

                      {/* Métricas de compras en móvil */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.05] text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">
                            Compras registradas
                          </span>
                          <span className="font-bold font-mono text-slate-900 dark:text-white">
                            {formatCOP(c.totalSpentAmount)}
                          </span>
                          <span className="text-[10px] text-slate-500 block font-mono">
                            {c.totalOrdersCount} {c.totalOrdersCount === 1 ? "compra" : "compras"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">
                            Última compra
                          </span>
                          <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                            {formatDate(c.lastActivityDate)}
                          </span>
                          {c.averageTicket && c.averageTicket > 0 ? (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Prom: {formatCOP(c.averageTicket)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Crédito y saldo en móvil */}
                      {((c.creditLimit || 0) > 0 || (c.creditUsed || 0) > 0) && (
                        <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-mono">
                          <span>Por cobrar: {formatCOP(c.creditUsed || 0)}</span>
                          <span>Cupo: {formatCOP(c.creditLimit || 0)}</span>
                        </div>
                      )}

                      {/* Acciones móvil */}
                      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2">
                        <Link href={`/workspace/${businessId}/clientes/${c.id}`}>
                          <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                            Ver perfil
                          </Button>
                        </Link>
                        <IconButton
                          icon={<Edit2 className="w-3.5 h-3.5" />}
                          title="Editar datos"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCustomerToEdit({
                              id: c.id,
                              businessId: c.businessId,
                              fullName: c.fullName,
                              customerType: c.customerType || "individual",
                              contactName: c.contactName || null,
                              phone: c.phone,
                              email: c.email,
                              taxId: c.taxId,
                              notes: c.notes,
                              status: c.status,
                              creditLimit: c.creditLimit,
                              creditUsed: c.creditUsed,
                              creditAvailable: c.creditAvailable,
                              createdAt: c.createdAt,
                              updatedAt: c.updatedAt,
                            });
                            setIsModalOpen(true);
                          }}
                        />
                        {canDeleteCustomer && (
                          <IconButton
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            title="Eliminar"
                            variant="destructive"
                            size="sm"
                            onClick={() => setCustomerToDelete(c)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vista Desktop / Tablet: Tabla estructurada */}
                <div className="hidden sm:block bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-visible shadow-2xs">
                  <div className="overflow-x-auto overflow-y-visible">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-mono text-[11px] font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="px-3.5 py-3.5 text-center w-12">Top</th>
                          <th className="px-4 py-3.5">Cliente</th>
                          <th className="px-4 py-3.5">Tipo</th>
                          <th className="px-4 py-3.5">Contacto</th>
                          <th className="px-4 py-3.5">Compras registradas</th>
                          <th className="px-4 py-3.5">Última compra</th>
                          <th className="px-3.5 py-3.5 text-center">Estado</th>
                          <th className="px-3.5 py-3.5 text-right w-16">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                        {customers.map((c) => {
                          const isDropdownOpen = activeDropdownId === c.id;
                          return (
                            <tr
                              key={c.id}
                              className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                            >
                              {/* 1. Columna Top */}
                              <td className="px-3.5 py-3 text-center">
                                {c.topRank ? (
                                  <span
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-mono text-[11px] font-bold ${
                                      c.topRank === 1
                                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                        : c.topRank === 2
                                        ? "bg-slate-200/80 dark:bg-white/[0.1] text-slate-700 dark:text-slate-200"
                                        : "bg-orange-500/10 text-[#ED500A]"
                                    }`}
                                  >
                                    #{c.topRank}
                                  </span>
                                ) : (
                                  <span className="font-mono text-slate-400 text-xs">-</span>
                                )}
                              </td>

                              {/* 2. Columna Cliente */}
                              <td className="px-4 py-3">
                                <Link
                                  href={`/workspace/${businessId}/clientes/${c.id}`}
                                  className="group flex items-center gap-2.5 max-w-[220px]"
                                >
                                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-[#ED500A] dark:text-orange-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-[#ED500A] group-hover:text-white transition-colors">
                                    {c.customerType === "business" ? (
                                      <Building2 className="w-4 h-4" />
                                    ) : (
                                      c.fullName.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="truncate font-bold text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors block">
                                      {c.fullName}
                                    </span>
                                    {c.customerType === "business" && c.contactName ? (
                                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                                        Contacto: {c.contactName}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 font-mono block truncate">
                                        {c.taxId ? `NIT/CC: ${c.taxId}` : "Sin documento"}
                                      </span>
                                    )}
                                  </div>
                                </Link>
                              </td>

                              {/* 3. Columna Tipo */}
                              <td className="px-4 py-3">
                                {c.customerType === "business" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                                    <Building2 className="w-3 h-3" />
                                    <span>Empresa</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-white/[0.05] dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08]">
                                    <User className="w-3 h-3" />
                                    <span>Persona natural</span>
                                  </span>
                                )}
                              </td>

                              {/* 4. Columna Contacto */}
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                <div className="space-y-0.5 max-w-[190px]">
                                  {c.phone ? (
                                    <div className="flex items-center gap-1.5 font-mono text-xs text-slate-800 dark:text-slate-200">
                                      <Phone className="w-3 h-3 text-[#ED500A] shrink-0" />
                                      <span>{c.phone}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">
                                      Sin teléfono
                                    </span>
                                  )}
                                  {c.email ? (
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="truncate">{c.email}</span>
                                    </div>
                                  ) : null}
                                </div>
                              </td>

                              {/* 5. Columna Compras registradas */}
                              <td className="px-4 py-3 font-mono">
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white text-xs block">
                                    {formatCOP(c.totalSpentAmount)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    {c.totalOrdersCount} {c.totalOrdersCount === 1 ? "compra" : "compras"}
                                    {c.averageTicket && c.averageTicket > 0
                                      ? ` · Ticket: ${formatCOP(c.averageTicket)}`
                                      : ""}
                                  </span>
                                </div>
                              </td>

                              {/* 6. Columna Última compra */}
                              <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 text-xs">
                                {formatDate(c.lastActivityDate)}
                              </td>

                              {/* 8. Columna Estado */}
                              <td className="px-3.5 py-3 text-center">
                                <StatusBadge
                                  status={c.status}
                                  label={c.status === "active" ? "Activo" : "Inactivo"}
                                  variant={c.status === "active" ? "emerald" : "slate"}
                                />
                              </td>

                              {/* 9. Columna Acciones con Menú Contextual (...) */}
                              <td className="px-3.5 py-3 text-right relative">
                                <div className="inline-block text-left" ref={isDropdownOpen ? dropdownRef : undefined}>
                                  <IconButton
                                    icon={<MoreVertical className="w-4 h-4" />}
                                    title="Más opciones"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setActiveDropdownId(isDropdownOpen ? null : c.id)
                                    }
                                  />

                                  {isDropdownOpen && (
                                    <div className="absolute right-3.5 top-11 z-50 w-44 rounded-xl bg-white dark:bg-[#121620] border border-slate-200 dark:border-white/[0.1] shadow-xl py-1 text-xs divide-y divide-slate-100 dark:divide-white/[0.06] animate-in fade-in zoom-in-95 duration-100">
                                      <div className="py-1">
                                        <Link
                                          href={`/workspace/${businessId}/clientes/${c.id}`}
                                          className="flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] font-medium"
                                          onClick={() => setActiveDropdownId(null)}
                                        >
                                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                                          <span>Ver perfil</span>
                                        </Link>

                                        <button
                                          type="button"
                                          className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] font-medium text-left cursor-pointer"
                                          onClick={() => {
                                            setActiveDropdownId(null);
                                            setCustomerToEdit({
                                              id: c.id,
                                              businessId: c.businessId,
                                              fullName: c.fullName,
                                              customerType: c.customerType || "individual",
                                              contactName: c.contactName || null,
                                              phone: c.phone,
                                              email: c.email,
                                              taxId: c.taxId,
                                              notes: c.notes,
                                              status: c.status,
                                              creditLimit: c.creditLimit,
                                              creditUsed: c.creditUsed,
                                              creditAvailable: c.creditAvailable,
                                              createdAt: c.createdAt,
                                              updatedAt: c.updatedAt,
                                            });
                                            setIsModalOpen(true);
                                          }}
                                        >
                                          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                          <span>Editar datos</span>
                                        </button>

                                        <button
                                          type="button"
                                          className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] font-medium text-left cursor-pointer"
                                          onClick={() => {
                                            setActiveDropdownId(null);
                                            setCustomerToEdit({
                                              id: c.id,
                                              businessId: c.businessId,
                                              fullName: c.fullName,
                                              customerType: c.customerType || "individual",
                                              contactName: c.contactName || null,
                                              phone: c.phone,
                                              email: c.email,
                                              taxId: c.taxId,
                                              notes: c.notes,
                                              status: c.status,
                                              creditLimit: c.creditLimit,
                                              creditUsed: c.creditUsed,
                                              creditAvailable: c.creditAvailable,
                                              createdAt: c.createdAt,
                                              updatedAt: c.updatedAt,
                                            });
                                            setIsModalOpen(true);
                                          }}
                                        >
                                          <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                                          <span>Asignar crédito</span>
                                        </button>
                                      </div>

                                      {canDeleteCustomer && (
                                        <div className="py-1">
                                          <button
                                            type="button"
                                            className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-medium text-left cursor-pointer"
                                            onClick={() => {
                                              setActiveDropdownId(null);
                                              setCustomerToDelete(c);
                                            }}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Eliminar</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ============================================================== */}
                {/* PAGINADOR Y NOTAS AL PIE                                       */}
                {/* ============================================================== */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  currentCount={customers.length}
                  pageSize={pageSize}
                  itemLabel="clientes"
                  onPageChange={handlePageChange}
                  isPending={isPending}
                />

                {/* Nota informativa contable solicitada */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] text-xs text-slate-500 dark:text-slate-400">
                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong className="text-slate-700 dark:text-slate-300">Nota contable:</strong>{" "}
                    El saldo registrado corresponde a anticipos o saldos a favor asignados directamente en la ficha del cliente, mientras que las cuentas por cobrar reflejan ventas a crédito pendientes de pago.
                  </p>
                </div>
              </div>
            )}
          </div>
      </div>

      {/* Modal para Crear / Editar Cliente */}
      <CustomerModal
        isOpen={isModalOpen}
        businessId={businessId}
        customerToEdit={customerToEdit}
        onClose={() => {
          setIsModalOpen(false);
          setCustomerToEdit(null);
        }}
        onSuccess={() => {
          router.refresh();
        }}
      />

      {/* Modal de confirmación para eliminar cliente (ConfirmModal Oficial) */}
      <ConfirmModal
        isOpen={Boolean(customerToDelete)}
        onClose={() => setCustomerToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="¿Eliminar cliente?"
        description={
          customerToDelete
            ? `Se desactivará el perfil de «${customerToDelete.fullName}». Su historial de pedidos anteriores permanecerá intacto.`
            : ""
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </AppPageContainer>
  );
}
