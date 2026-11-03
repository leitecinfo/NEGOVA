"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Clock,
  Loader2,
  Calendar,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Receipt,
  ShoppingCart,
  Award,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  MoreVertical,
  ExternalLink,
  Edit,
  Trash2,
  Power,
  ShieldCheck,
  Check,
  Filter,
  X,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Supplier,
  Purchase,
  AccountsPayableWithDetails,
} from "@/lib/purchases/types";
import { Product, Category } from "@/lib/products/types";
import { Location } from "@/lib/inventory/types";
import { formatCOP } from "@/config/plans";
import { SupplierFormModal } from "./supplier-form-modal";
import { ConfirmDeleteSupplierModal } from "./confirm-delete-supplier-modal";
import { PurchaseFormModal } from "../compras/purchase-form-modal";
import { PaymentModal } from "../compras/payment-modal";
import {
  getSuppliersAction,
  updateSupplierAction,
} from "./actions";
import {
  getPurchasesAction,
  getAccountsPayableAction,
} from "../compras/actions";

interface Props {
  businessId: string;
  initialSuppliers: Supplier[];
  initialPurchases: Purchase[];
  initialAccountsPayable: AccountsPayableWithDetails[];
  products: Product[];
  locations: Location[];
  categories: Category[];
}

type StatusTab = "active" | "with_balance" | "overdue" | "inactive" | "all";
type SortOption = "sales_desc" | "debt_desc" | "name_asc" | "name_desc" | "recent";

export function WorkspaceProveedoresClient({
  businessId,
  initialSuppliers,
  initialPurchases,
  initialAccountsPayable,
  products,
  locations,
  categories,
}: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
  const [accountsPayable, setAccountsPayable] = useState<AccountsPayableWithDetails[]>(initialAccountsPayable);

  // Estados de filtros y búsqueda
  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("sales_desc");

  // Estados de modales
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedSupplierForPurchase, setSelectedSupplierForPurchase] = useState<string | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedAccountForPayment, setSelectedAccountForPayment] = useState<AccountsPayableWithDetails | null>(null);

  // Menú de acciones desplegado (por ID de proveedor)
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // =========================================================================
  // CÁLCULOS ANALÍTICOS Y ESTADÍSTICAS POR PROVEEDOR
  // =========================================================================
  const now = useMemo(() => new Date(), []);
  const twelveMonthsAgo = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, []);

  // Mapeo detallado de cada proveedor con compras y cuentas por pagar
  const supplierAnalytics = useMemo(() => {
    return suppliers.map((supplier) => {
      // 1. Compras asociadas a este proveedor
      const suppPurchases = purchases.filter(
        (p) => p.supplierId === supplier.id && p.status !== "cancelled"
      );

      // Compras en últimos 12 meses
      const purchases12m = suppPurchases.filter(
        (p) => new Date(p.purchaseDate) >= twelveMonthsAgo
      );
      const totalSpent12m = purchases12m.reduce((acc, p) => acc + p.total, 0);
      const purchasesCount12m = purchases12m.length;

      // Última compra
      let lastPurchaseDate: string | null = null;
      if (suppPurchases.length > 0) {
        const sorted = [...suppPurchases].sort(
          (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
        );
        lastPurchaseDate = sorted[0].purchaseDate;
      }

      // 2. Cuentas por pagar asociadas
      const suppAccounts = accountsPayable.filter(
        (ap) => ap.supplierId === supplier.id && ap.status !== "paid" && ap.status !== "cancelled"
      );
      const totalBalance = suppAccounts.reduce((acc, ap) => acc + ap.balance, 0);

      const overdueAccounts = suppAccounts.filter(
        (ap) => ap.isOverdue || (new Date(ap.dueDate) < now && ap.balance > 0)
      );
      const overdueBalance = overdueAccounts.reduce((acc, ap) => acc + ap.balance, 0);
      const overdueCount = overdueAccounts.length;

      return {
        ...supplier,
        purchasesCount12m,
        totalSpent12m,
        lastPurchaseDate,
        totalBalance,
        overdueBalance,
        overdueCount,
        pendingAccounts: suppAccounts,
      };
    });
  }, [suppliers, purchases, accountsPayable, now, twelveMonthsAgo]);

  // =========================================================================
  // KPIS SUPERIORES
  // =========================================================================
  const kpis = useMemo(() => {
    // 1. Proveedores activos
    const activeSuppliersCount = suppliers.filter((s) => s.status !== "inactive").length;

    // 2. Por pagar total
    const pendingAccounts = accountsPayable.filter(
      (ap) => ap.status !== "paid" && ap.status !== "cancelled" && ap.balance > 0
    );
    const totalBalance = pendingAccounts.reduce((acc, ap) => acc + ap.balance, 0);

    // 3. Vencido total
    const overdueAccounts = pendingAccounts.filter(
      (ap) => ap.isOverdue || (new Date(ap.dueDate) < now && ap.balance > 0)
    );
    const overdueBalance = overdueAccounts.reduce((acc, ap) => acc + ap.balance, 0);

    // 4. Comprado este mes
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const thisMonthPurchases = purchases.filter((p) => {
      if (p.status === "cancelled") return false;
      const d = new Date(p.purchaseDate);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
    const totalThisMonth = thisMonthPurchases.reduce((acc, p) => acc + p.total, 0);

    return {
      activeSuppliersCount,
      totalSuppliersCount: suppliers.length,
      inactiveSuppliersCount: suppliers.length - activeSuppliersCount,
      totalBalance,
      pendingCount: pendingAccounts.length,
      overdueBalance,
      overdueCount: overdueAccounts.length,
      totalThisMonth,
      thisMonthPurchasesCount: thisMonthPurchases.length,
    };
  }, [suppliers, accountsPayable, purchases, now]);

  // =========================================================================
  // BLOQUE ANALÍTICO 1: RANKING TOP 12 MESES ("¿A quién le compras más?")
  // =========================================================================
  const topSuppliersRanking = useMemo(() => {
    const withPurchases = supplierAnalytics
      .filter((s) => s.totalSpent12m > 0)
      .sort((a, b) => b.totalSpent12m - a.totalSpent12m);

    const maxSpent = withPurchases[0]?.totalSpent12m || 1;

    return withPurchases.slice(0, 5).map((s, idx) => ({
      rank: idx + 1,
      id: s.id,
      name: s.name,
      taxId: s.taxId,
      totalSpent12m: s.totalSpent12m,
      purchasesCount12m: s.purchasesCount12m,
      percentage: Math.min(100, Math.round((s.totalSpent12m / maxSpent) * 100)),
    }));
  }, [supplierAnalytics]);

  // =========================================================================
  // BLOQUE ANALÍTICO 2: MONITOR DE PAGOS PENDIENTES
  // =========================================================================
  const pendingDebtsMonitor = useMemo(() => {
    const list = accountsPayable
      .filter((ap) => ap.status !== "paid" && ap.status !== "cancelled" && ap.balance > 0)
      .sort((a, b) => {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

    return list.slice(0, 5);
  }, [accountsPayable]);

  // =========================================================================
  // FILTRADO Y ORDENAMIENTO DE LA TABLA
  // =========================================================================
  const filteredAndSortedSuppliers = useMemo(() => {
    let list = supplierAnalytics;

    // 1. Filtrado por Pestaña de Estado
    if (statusTab === "active") {
      list = list.filter((s) => s.status !== "inactive");
    } else if (statusTab === "with_balance") {
      list = list.filter((s) => s.totalBalance > 0);
    } else if (statusTab === "overdue") {
      list = list.filter((s) => s.overdueCount > 0);
    } else if (statusTab === "inactive") {
      list = list.filter((s) => s.status === "inactive");
    }

    // 2. Búsqueda por texto (Nombre, NIT, Contacto, Teléfono)
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((s) => {
        return (
          s.name.toLowerCase().includes(q) ||
          (s.taxId && s.taxId.toLowerCase().includes(q)) ||
          (s.contactName && s.contactName.toLowerCase().includes(q)) ||
          (s.phone && s.phone.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q))
        );
      });
    }

    // 3. Ordenamiento
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "sales_desc":
          return b.totalSpent12m - a.totalSpent12m;
        case "debt_desc":
          return b.totalBalance - a.totalBalance;
        case "name_asc":
          return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
        case "name_desc":
          return b.name.localeCompare(a.name, "es", { sensitivity: "base" });
        case "recent":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });
  }, [supplierAnalytics, statusTab, search, sortBy]);

  // Conteos para los badges de las pestañas
  const tabCounts = useMemo(() => {
    return {
      active: supplierAnalytics.filter((s) => s.status !== "inactive").length,
      with_balance: supplierAnalytics.filter((s) => s.totalBalance > 0).length,
      overdue: supplierAnalytics.filter((s) => s.overdueCount > 0).length,
      inactive: supplierAnalytics.filter((s) => s.status === "inactive").length,
      all: supplierAnalytics.length,
    };
  }, [supplierAnalytics]);

  // =========================================================================
  // MANEJADORES DE ACCIONES Y MODALES
  // =========================================================================
  const handleOpenCreateModal = () => {
    setSupplierToEdit(null);
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditModal = (supplier: Supplier) => {
    setSupplierToEdit(supplier);
    setIsSupplierModalOpen(true);
    setOpenActionMenuId(null);
  };

  const handleOpenDeleteModal = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setIsDeleteModalOpen(true);
    setOpenActionMenuId(null);
  };

  const handleOpenPurchaseModal = (supplierId?: string) => {
    setSelectedSupplierForPurchase(supplierId || null);
    setIsPurchaseModalOpen(true);
    setOpenActionMenuId(null);
  };

  const handleOpenPaymentModal = (account: AccountsPayableWithDetails) => {
    setSelectedAccountForPayment(account);
    setIsPaymentModalOpen(true);
  };

  // Toggle Activo / Inactivo
  const handleToggleStatus = async (supplier: Supplier) => {
    setOpenActionMenuId(null);
    const newStatus = supplier.status === "inactive" ? "active" : "inactive";
    startTransition(async () => {
      try {
        const res = await updateSupplierAction(businessId, supplier.id, {
          status: newStatus,
        });
        if (!res.success) {
          toast.error("Error al cambiar estado del proveedor", {
            description: res.error,
          });
          return;
        }
        setSuppliers((prev) =>
          prev.map((s) => (s.id === supplier.id ? { ...s, status: newStatus } : s))
        );
        toast.success(
          newStatus === "active"
            ? `Proveedor «${supplier.name}» reactivado.`
            : `Proveedor «${supplier.name}» marcado como inactivo.`
        );
      } catch (err: any) {
        toast.error("Error inesperado al actualizar el proveedor.");
      }
    });
  };

  // Recargas tras acciones exitosas
  const refreshAllData = async () => {
    try {
      const [supRes, purRes, apRes] = await Promise.all([
        getSuppliersAction(businessId),
        getPurchasesAction(businessId, { period: "all" }),
        getAccountsPayableAction(businessId, { status: "all" }),
      ]);
      if (supRes.success && supRes.data) setSuppliers(supRes.data);
      if (purRes.success && purRes.data) setPurchases(purRes.data);
      if (apRes.success && apRes.data) setAccountsPayable(apRes.data);
    } catch {
      // Sincronización en segundo plano silenciosa
    }
  };

  const handleSupplierFormSuccess = (updatedSupplier: Supplier) => {
    setSuppliers((prev) => {
      const exists = prev.some((s) => s.id === updatedSupplier.id);
      if (exists) {
        return prev.map((s) => (s.id === updatedSupplier.id ? updatedSupplier : s));
      }
      return [updatedSupplier, ...prev];
    });
  };

  const handleDeleteSuccess = (deletedId: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== deletedId));
  };

  const handlePurchaseSuccess = (newPurchase: Purchase) => {
    setPurchases((prev) => [newPurchase, ...prev]);
    refreshAllData();
  };

  const handlePaymentSuccess = () => {
    refreshAllData();
  };

  // Generador de iniciales y color distintivo para avatar
  const getAvatarInfo = (name: string) => {
    const initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "PR";

    const colors = [
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    ];
    const index = name.length % colors.length;
    return { initials, colorClass: colors[index] };
  };

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* 1. ENCABEZADO PRINCIPAL                                               */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                Proveedores
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Directorio & Créditos
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Gestiona tu directorio de distribuidores, condiciones comerciales, historial de compras y cuentas por pagar.
            </p>
          </div>
        </div>

        {/* Botones de acción del encabezado */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href={`/workspace/${businessId}/compras`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-border bg-card hover:bg-muted text-foreground transition-all shadow-xs"
          >
            <ShoppingCart className="w-4 h-4 text-primary" />
            <span>Compras</span>
          </Link>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo proveedor</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. KPIS SUPERIORES                                                    */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Proveedores activos */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Proveedores activos
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {kpis.activeSuppliersCount}
            </span>
            <span className="text-xs text-muted-foreground">
              de {kpis.totalSuppliersCount} registrados
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {kpis.inactiveSuppliersCount > 0
              ? `${kpis.inactiveSuppliersCount} inactivos en el catálogo`
              : "100% de proveedores habilitados"}
          </p>
        </div>

        {/* KPI 2: Por pagar */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Por pagar
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            {kpis.totalBalance === 0 ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Al día</span>
              </div>
            ) : (
              <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                {formatCOP(kpis.totalBalance)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {kpis.totalBalance === 0
              ? "Sin compromisos financieros pendientes"
              : `${kpis.pendingCount} facturas a crédito por saldar`}
          </p>
        </div>

        {/* KPI 3: Vencido */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Vencido
            </span>
            <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            {kpis.overdueBalance === 0 ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Sin mora activa</span>
              </div>
            ) : (
              <span className="text-2xl font-black font-mono text-red-600 dark:text-red-400">
                {formatCOP(kpis.overdueBalance)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {kpis.overdueBalance === 0
              ? "Plazos de pago en curso sin retrasos"
              : `${kpis.overdueCount} compras con fecha límite superada`}
          </p>
        </div>

        {/* KPI 4: Comprado este mes */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Comprado este mes
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-foreground">
              {formatCOP(kpis.totalThisMonth)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {kpis.thisMonthPurchasesCount} compras registradas este mes
          </p>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. BLOQUES ANALÍTICOS SUPERIORES (RANKING Y MONITOR)                  */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* BLOQUE A: '¿A quién le compras más?' (Ranking top 12 meses) */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-1 border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  ¿A quién le compras más?
                </h3>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Últimos 12 meses
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Top de proveedores con mayor volumen facturado de compras e insumos.
            </p>
          </div>

          <div className="space-y-3 my-auto">
            {topSuppliersRanking.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground space-y-1">
                <Receipt className="w-8 h-8 mx-auto text-muted-foreground/40" />
                <p className="text-xs font-semibold text-foreground">
                  Aún no hay compras registradas en los últimos 12 meses
                </p>
                <p className="text-[11px]">
                  Al registrar compras a proveedores verás aquí el ranking analítico de compras.
                </p>
              </div>
            ) : (
              topSuppliersRanking.map((top) => {
                const avatar = getAvatarInfo(top.name);
                return (
                  <div key={top.id} className="space-y-1.5 p-2 rounded-xl hover:bg-muted/30 transition-all">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Posición */}
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                            top.rank === 1
                              ? "bg-amber-500 text-white shadow-xs"
                              : top.rank === 2
                              ? "bg-slate-400 text-white shadow-xs"
                              : top.rank === 3
                              ? "bg-amber-700 text-white shadow-xs"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {top.rank}
                        </span>

                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold border shrink-0 ${avatar.colorClass}`}
                        >
                          {avatar.initials}
                        </div>

                        <div className="truncate">
                          <span className="font-bold text-foreground block truncate">
                            {top.name}
                          </span>
                          {top.taxId && (
                            <span className="text-[10px] font-mono text-muted-foreground block">
                              NIT: {top.taxId}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-foreground block">
                          {formatCOP(top.totalSpent12m)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {top.purchasesCount12m} {top.purchasesCount12m === 1 ? "compra" : "compras"}
                        </span>
                      </div>
                    </div>

                    {/* Barra porcentual */}
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        style={{ width: `${top.percentage}%` }}
                        className="h-full bg-primary rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-border flex justify-between items-center text-[11px] text-muted-foreground">
            <span>Ranking basado en órdenes confirmadas</span>
            <Link
              href={`/workspace/${businessId}/compras`}
              className="font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>Ver todas las compras</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* BLOQUE B: 'Pagos pendientes' (Monitor de deudas activas) */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-1 border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Pagos pendientes
                </h3>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {kpis.pendingCount} obligaciones activas
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Monitor de deudas activas por compras a crédito y fechas de vencimiento.
            </p>
          </div>

          <div className="space-y-2.5 my-auto">
            {pendingDebtsMonitor.length === 0 ? (
              <div className="p-6 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    ¡Al día con todos los proveedores!
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    No tienes cuentas por pagar vencidas ni saldos pendientes de liquidación.
                  </p>
                </div>
              </div>
            ) : (
              pendingDebtsMonitor.map((debt) => {
                const dueDate = new Date(debt.dueDate);
                const isOverdue = debt.isOverdue || dueDate < now;
                const diffTime = dueDate.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                return (
                  <div
                    key={debt.id}
                    className="p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-foreground block truncate">
                        {debt.supplierName || "Proveedor"}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span className="font-mono">
                          {debt.purchaseInvoiceNumber || debt.purchaseNumber || "Compra a crédito"}
                        </span>
                        <span>•</span>
                        {isOverdue ? (
                          <span className="text-red-500 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Vencido ({Math.abs(diffDays)}d)</span>
                          </span>
                        ) : diffDays === 0 ? (
                          <span className="text-amber-500 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Vence hoy</span>
                          </span>
                        ) : (
                          <span className="text-blue-500 font-medium">
                            Vence en {diffDays}d
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-mono font-bold text-foreground block">
                          {formatCOP(debt.balance)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          de {formatCOP(debt.totalAmount)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenPaymentModal(debt)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
                        title="Registrar abono o pago"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Abonar</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-border flex justify-between items-center text-[11px] text-muted-foreground">
            <span>Deducción de caja física o bancaria</span>
            <Link
              href={`/workspace/${businessId}/compras`}
              className="font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>Ver todas las cuentas por pagar</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. FILTROS Y CONTROLES DE LA TABLA                                    */}
      {/* ===================================================================== */}
      <div className="space-y-3">
        {/* Pestañas por estado */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setStatusTab("active")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              statusTab === "active"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Activos</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusTab === "active"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-card text-muted-foreground"
              }`}
            >
              {tabCounts.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusTab("with_balance")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              statusTab === "with_balance"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Con saldo</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusTab === "with_balance"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-card text-muted-foreground"
              }`}
            >
              {tabCounts.with_balance}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusTab("overdue")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              statusTab === "overdue"
                ? "bg-red-600 text-white shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Vencidos</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusTab === "overdue"
                  ? "bg-white/20 text-white"
                  : "bg-card text-muted-foreground"
              }`}
            >
              {tabCounts.overdue}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusTab("inactive")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              statusTab === "inactive"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Inactivos</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusTab === "inactive"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-card text-muted-foreground"
              }`}
            >
              {tabCounts.inactive}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              statusTab === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Todos</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusTab === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-card text-muted-foreground"
              }`}
            >
              {tabCounts.all}
            </span>
          </button>
        </div>

        {/* Barra de búsqueda y selector de ordenamiento */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Buscador */}
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, NIT, contacto, teléfono..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 p-0.5 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selector de ordenamiento */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Ordenar por:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
            >
              <option value="sales_desc">Mayor compra (12 meses)</option>
              <option value="debt_desc">Mayor saldo por pagar</option>
              <option value="name_asc">Nombre (A - Z)</option>
              <option value="name_desc">Nombre (Z - A)</option>
              <option value="recent">Más recientes</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 5. TABLA DE PROVEEDORES                                               */}
      {/* ===================================================================== */}
      <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
        {filteredAndSortedSuppliers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 text-muted-foreground mx-auto flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">
                No se encontraron proveedores
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {search.trim()
                  ? `No hay proveedores que coincidan con la búsqueda «${search}».`
                  : "Aún no has registrado proveedores en este estado o filtro."}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Limpiar búsqueda
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 shadow-xs cursor-pointer"
              >
                + Registrar nuevo proveedor
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Plazo de Pago</th>
                  <th className="px-4 py-3">Compras 12 Meses</th>
                  <th className="px-4 py-3 text-right">Por Pagar</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAndSortedSuppliers.map((supplier) => {
                  const avatar = getAvatarInfo(supplier.name);
                  const isMenuOpen = openActionMenuId === supplier.id;

                  return (
                    <tr
                      key={supplier.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* 1. Proveedor (Avatar y NIT) */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs border shrink-0 ${avatar.colorClass}`}
                          >
                            {avatar.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground truncate block max-w-[220px]">
                                {supplier.name}
                              </span>
                              {supplier.status === "inactive" && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                                  Inactivo
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-muted-foreground block mt-0.5">
                              {supplier.taxId ? `NIT: ${supplier.taxId}` : "Sin NIT"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Contacto (Teléfono, nombre y WhatsApp) */}
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="space-y-0.5">
                          {supplier.contactName && (
                            <span className="text-foreground font-medium block truncate max-w-[180px]">
                              {supplier.contactName}
                            </span>
                          )}
                          {supplier.phone ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={`tel:${supplier.phone}`}
                                className="font-mono text-[11px] text-foreground hover:text-primary flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3 text-muted-foreground" />
                                <span>{supplier.phone}</span>
                              </a>
                              <a
                                href={`https://wa.me/${supplier.phone.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-0.5 rounded text-emerald-600 hover:bg-emerald-500/10"
                                title="Abrir chat de WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/60 italic">
                              Sin teléfono
                            </span>
                          )}
                          {supplier.email && (
                            <span className="text-[10px] text-muted-foreground block truncate max-w-[180px]">
                              {supplier.email}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Plazo de pago */}
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted/40 border border-border text-foreground">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>
                            {supplier.paymentTermsDays > 0
                              ? `${supplier.paymentTermsDays} días`
                              : "Contado"}
                          </span>
                        </div>
                      </td>

                      {/* 4. Compras 12 meses (monto, cantidad y última fecha) */}
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-foreground block">
                            {formatCOP(supplier.totalSpent12m)}
                          </span>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                            <span>{supplier.purchasesCount12m} compras</span>
                            {supplier.lastPurchaseDate && (
                              <>
                                <span>•</span>
                                <span>
                                  Última:{" "}
                                  {new Date(supplier.lastPurchaseDate + "T12:00:00").toLocaleDateString(
                                    "es-CO",
                                    { day: "numeric", month: "short" }
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. Por pagar */}
                      <td className="px-4 py-3 text-right">
                        {supplier.totalBalance === 0 ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Al día</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span
                              className={`font-mono font-bold text-xs block ${
                                supplier.overdueCount > 0
                                  ? "text-red-500"
                                  : "text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {formatCOP(supplier.totalBalance)}
                            </span>
                            {supplier.overdueCount > 0 && (
                              <span className="inline-block text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.2 rounded">
                                {supplier.overdueCount} vencida(s)
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 6. Menú de acciones */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5 relative">
                          {/* Botón directo: '+ Compra' */}
                          <button
                            type="button"
                            onClick={() => handleOpenPurchaseModal(supplier.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20 cursor-pointer"
                            title="Registrar nueva compra a este proveedor"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Compra</span>
                          </button>

                          {/* Botón directo: 'Abonar' si tiene saldo */}
                          {supplier.totalBalance > 0 && supplier.pendingAccounts[0] && (
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(supplier.pendingAccounts[0])}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/20 cursor-pointer"
                              title="Registrar abono de cuenta por pagar"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Abonar</span>
                            </button>
                          )}

                          {/* Menú desplegable */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenActionMenuId(isMenuOpen ? null : supplier.id)
                              }
                              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                              title="Más opciones"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                              <div
                                className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-border bg-card shadow-xl p-1 z-20 animate-in fade-in zoom-in-95 text-left"
                                onMouseLeave={() => setOpenActionMenuId(null)}
                              >
                                <Link
                                  href={`/workspace/${businessId}/compras?supplierId=${supplier.id}`}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted transition-colors"
                                  onClick={() => setOpenActionMenuId(null)}
                                >
                                  <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>Ver compras</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(supplier)}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted transition-colors cursor-pointer"
                                >
                                  <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>Editar datos</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(supplier)}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted transition-colors cursor-pointer"
                                >
                                  <Power className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>
                                    {supplier.status === "inactive" ? "Activar" : "Desactivar"}
                                  </span>
                                </button>

                                <div className="h-px bg-border my-1" />

                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteModal(supplier)}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Archivar proveedor</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 6. MODALES INTEGRADOS                                                 */}
      {/* ===================================================================== */}

      {/* Modal Crear / Editar Proveedor */}
      <SupplierFormModal
        businessId={businessId}
        isOpen={isSupplierModalOpen}
        supplier={supplierToEdit}
        onClose={() => setIsSupplierModalOpen(false)}
        onSuccess={handleSupplierFormSuccess}
      />

      {/* Modal Confirmar Archivar Proveedor (Cero alertas nativas) */}
      <ConfirmDeleteSupplierModal
        businessId={businessId}
        isOpen={isDeleteModalOpen}
        supplier={supplierToDelete}
        onClose={() => setIsDeleteModalOpen(false)}
        onSuccess={handleDeleteSuccess}
      />

      {/* Modal Registrar Compra Rápida (Formato 2 columnas con selector trifásico) */}
      <PurchaseFormModal
        businessId={businessId}
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSuccess={handlePurchaseSuccess}
        products={products}
        locations={locations}
        categories={categories}
        initialSupplierId={selectedSupplierForPurchase}
      />

      {/* Modal Registrar Abono a Cuenta por Pagar */}
      <PaymentModal
        businessId={businessId}
        isOpen={isPaymentModalOpen}
        account={selectedAccountForPayment}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
