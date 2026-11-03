"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  FileText,
  MapPin,
  Calendar,
  ShoppingBag,
  Receipt,
  Plus,
  Trash2,
  Edit2,
  Clock,
  TrendingUp,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Search,
  Eye,
  CreditCard,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Banknote,
  Award,
  Sparkles,
} from "lucide-react";
import { CustomerLoyaltyAccount, LoyaltyTransaction } from "@/lib/loyalty/types";
import { adjustCustomerLoyaltyPointsAction } from "../loyalty-actions";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { Button, IconButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { CustomerDetailView, AccountReceivable } from "@/lib/customers/types";
import { CustomerModal } from "@/components/customers/customer-modal";
import { CustomerPaymentModal } from "@/components/customers/customer-payment-modal";
import {
  addCustomerAddressAction,
  deleteCustomerAddressAction,
  deleteCustomerAction,
  updateCustomerCreditLimitAction,
  createCreditSaleReceivableAction,
} from "../actions";
import { ModalPortal } from "@/components/ui/modal-portal";
import { toast } from "sonner";

interface CustomerDetailClientProps {
  businessId: string;
  businessName: string;
  customer: CustomerDetailView;
  initialLoyaltyAccount?: CustomerLoyaltyAccount;
  initialLoyaltyTransactions?: LoyaltyTransaction[];
  canEditCustomer: boolean;
  canDeleteCustomer: boolean;
  canManageCredit?: boolean;
}

export function CustomerDetailClient({
  businessId,
  businessName,
  customer,
  initialLoyaltyAccount,
  initialLoyaltyTransactions = [],
  canEditCustomer,
  canDeleteCustomer,
  canManageCredit = false,
}: CustomerDetailClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"orders" | "sales" | "credit" | "loyalty">("orders");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Estados de Fidelización [FID-001]
  const [loyaltyAccount, setLoyaltyAccount] = useState<CustomerLoyaltyAccount>(
    initialLoyaltyAccount || {
      businessId,
      customerId: customer.id,
      pointsBalance: 0,
      totalEarned: 0,
      totalRedeemed: 0,
      equivalentMoneyValue: 0,
      canRedeem: false,
    }
  );
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>(
    initialLoyaltyTransactions
  );
  const [isAdjustPointsModalOpen, setIsAdjustPointsModalOpen] = useState(false);
  const [adjustPointsDelta, setAdjustPointsDelta] = useState("");
  const [adjustPointsReason, setAdjustPointsReason] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Estados para modales de Crédito y Cartera
  const [isCreditLimitModalOpen, setIsCreditLimitModalOpen] = useState(false);
  const [creditLimitInput, setCreditLimitInput] = useState(
    String(customer.creditLimit || 0)
  );
  const [isSavingCreditLimit, setIsSavingCreditLimit] = useState(false);

  const [isCreditSaleModalOpen, setIsCreditSaleModalOpen] = useState(false);
  const [creditSaleAmount, setCreditSaleAmount] = useState("");
  const [creditSaleDueDate, setCreditSaleDueDate] = useState("");
  const [isSavingCreditSale, setIsSavingCreditSale] = useState(false);

  const [selectedReceivableForPayment, setSelectedReceivableForPayment] =
    useState<AccountReceivable | null>(null);

  // Paginación y filtros para Historial de Pedidos
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(5);
  const [ordersFilterStatus, setOrdersFilterStatus] = useState<string>("all");
  const [ordersSearch, setOrdersSearch] = useState("");

  // Paginación y filtros para Historial de Ventas
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(5);
  const [salesFilterStatus, setSalesFilterStatus] = useState<string>("all");
  const [salesSearch, setSalesSearch] = useState("");

  const filteredOrders = useMemo(() => {
    return (customer.recentOrders || []).filter((ord) => {
      const matchesStatus =
        ordersFilterStatus === "all" || ord.status === ordersFilterStatus;
      const matchesSearch =
        !ordersSearch.trim() ||
        String(ord.orderNumber).includes(ordersSearch.trim()) ||
        (ord.itemsSummary &&
          ord.itemsSummary.toLowerCase().includes(ordersSearch.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [customer.recentOrders, ordersFilterStatus, ordersSearch]);

  const totalOrdersPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPageSize));
  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ordersPageSize;
    return filteredOrders.slice(start, start + ordersPageSize);
  }, [filteredOrders, ordersPage, ordersPageSize]);

  const filteredSales = useMemo(() => {
    return (customer.recentSales || []).filter((sale) => {
      const matchesStatus =
        salesFilterStatus === "all" || sale.status === salesFilterStatus;
      const matchesSearch =
        !salesSearch.trim() ||
        sale.documentNumber.toLowerCase().includes(salesSearch.toLowerCase()) ||
        sale.paymentMethod.toLowerCase().includes(salesSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [customer.recentSales, salesFilterStatus, salesSearch]);

  const totalSalesPages = Math.max(1, Math.ceil(filteredSales.length / salesPageSize));
  const paginatedSales = useMemo(() => {
    const start = (salesPage - 1) * salesPageSize;
    return filteredSales.slice(start, start + salesPageSize);
  }, [filteredSales, salesPage, salesPageSize]);

  const handleNavigateToOrder = (orderId: string) => {
    router.push(`/workspace/${businessId}/pedidos/${orderId}`);
  };

  const handleNavigateToSale = (saleId: string) => {
    router.push(`/workspace/${businessId}/ventas/${saleId}`);
  };

  // Modal para agregar dirección
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [newAddressLine, setNewAddressLine] = useState("");
  const [newAddressReference, setNewAddressReference] = useState("");
  const [newAddressLabel, setNewAddressLabel] = useState("Casa");
  const [isNewAddressDefault, setIsNewAddressDefault] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Modal confirmación eliminar cliente (ConfirmModal oficial)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressLine.trim()) {
      toast.error("Por favor ingresa la dirección");
      return;
    }

    setIsSavingAddress(true);
    try {
      const res = await addCustomerAddressAction(
        businessId,
        customer.id,
        newAddressLine.trim(),
        newAddressReference.trim() || null,
        newAddressLabel.trim() || "Principal",
        isNewAddressDefault
      );

      if (!res.success) {
        toast.error(res.error || "No se pudo agregar la dirección");
        return;
      }

      toast.success("Dirección agregada exitosamente");
      setIsAddAddressOpen(false);
      setNewAddressLine("");
      setNewAddressReference("");
      router.refresh();
    } catch {
      toast.error("Error al guardar la dirección");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      const res = await deleteCustomerAddressAction(businessId, customer.id, addressId);
      if (!res.success) {
        toast.error(res.error || "No se pudo eliminar la dirección");
        return;
      }
      toast.success("Dirección eliminada");
      router.refresh();
    } catch {
      toast.error("Error al eliminar la dirección");
    }
  };

  const handleDeleteCustomer = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteCustomerAction(businessId, customer.id);
      if (!res.success) {
        toast.error(res.error || "No se pudo eliminar el cliente");
        return;
      }
      toast.success("Cliente eliminado exitosamente");
      router.push(`/workspace/${businessId}/clientes`);
    } catch {
      toast.error("Error al eliminar cliente");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveCreditLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericLimit = Number(creditLimitInput);
    if (!Number.isFinite(numericLimit) || numericLimit < 0) {
      toast.error("Ingresa un límite de crédito válido mayor o igual a 0.");
      return;
    }

    setIsSavingCreditLimit(true);
    try {
      const res = await updateCustomerCreditLimitAction(
        businessId,
        customer.id,
        numericLimit
      );
      if (!res.success) {
        toast.error(res.error || "No se pudo actualizar el límite de crédito");
        return;
      }
      toast.success("Límite de crédito actualizado exitosamente");
      setIsCreditLimitModalOpen(false);
      router.refresh();
    } catch {
      toast.error("Error al actualizar el límite de crédito");
    } finally {
      setIsSavingCreditLimit(false);
    }
  };

  const handleSaveCreditSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(creditSaleAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Ingresa un monto de venta a crédito mayor a $0.");
      return;
    }

    setIsSavingCreditSale(true);
    try {
      const res = await createCreditSaleReceivableAction(businessId, {
        customerId: customer.id,
        amount: numericAmount,
        dueDate: creditSaleDueDate ? new Date(creditSaleDueDate).toISOString() : undefined,
      });

      if (!res.success) {
        toast.error(res.error || "No se pudo registrar la venta a crédito");
        return;
      }

      toast.success("Venta a crédito y cuenta por cobrar registradas");
      setIsCreditSaleModalOpen(false);
      setCreditSaleAmount("");
      setCreditSaleDueDate("");
      setActiveTab("credit");
      router.refresh();
    } catch {
      toast.error("Error al registrar la venta a crédito");
    } finally {
      setIsSavingCreditSale(false);
    }
  };

  const handleAdjustPointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const delta = parseInt(adjustPointsDelta, 10);
    if (isNaN(delta) || delta === 0) {
      toast.error("Ingresa una cantidad de puntos válida diferente de 0.");
      return;
    }
    if (!adjustPointsReason || adjustPointsReason.trim().length < 5) {
      toast.error("Debes indicar un motivo de al menos 5 caracteres.");
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const res = await adjustCustomerLoyaltyPointsAction(
        businessId,
        customer.id,
        delta,
        adjustPointsReason.trim()
      );
      if (res.success && typeof res.newBalance === "number") {
        toast.success(`Saldo de puntos actualizado a ${res.newBalance} pts`);
        setLoyaltyAccount((prev) => ({
          ...prev,
          pointsBalance: res.newBalance!,
          totalEarned: delta > 0 ? prev.totalEarned + delta : prev.totalEarned,
          equivalentMoneyValue: res.newBalance! * 10,
        }));
        setLoyaltyTransactions((prev) => [
          {
            id: "local-" + Date.now(),
            businessId,
            customerId: customer.id,
            points: delta,
            type: "adjusted",
            referenceType: "manual",
            description: `Ajuste manual: ${adjustPointsReason.trim()}`,
            balanceAfter: res.newBalance!,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setIsAdjustPointsModalOpen(false);
        setAdjustPointsDelta("");
        setAdjustPointsReason("");
      } else {
        toast.error(res.error || "Error al ajustar puntos.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al procesar el ajuste de puntos.");
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const formatCOP = (val?: number | null) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val || 0);

  return (
    <AppPageContainer
      title={customer.fullName}
      description={`Ficha y perfil del cliente registrado en ${businessName}.`}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/workspace/${businessId}/clientes`}>
            <Button
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Volver a lista
            </Button>
          </Link>

          {canEditCustomer && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => setIsEditModalOpen(true)}
            >
              Editar perfil
            </Button>
          )}

          {canDeleteCustomer && (
            <IconButton
              icon={<Trash2 className="w-4 h-4" />}
              title="Eliminar cliente"
              variant="destructive"
              size="md"
              onClick={() => setIsDeleteConfirmOpen(true)}
            />
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Tarjetas de Métricas Fiables */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1 font-body">
              <ShoppingBag className="w-4 h-4 text-[#ED500A]" />
              <span className="font-semibold">Órdenes realizadas</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-title text-slate-900 dark:text-white">
              {customer.metrics.totalOrders}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Total pedidos registrados</span>
          </div>

          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1 font-body">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold">Total Comprado</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {formatCOP(customer.metrics.totalSpent)}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">En ventas completadas</span>
          </div>

          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1 font-body">
              <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold">Ticket promedio</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {formatCOP(customer.metrics.averageTicket)}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Por compra pagada</span>
          </div>

          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1 font-body">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="font-semibold">Última actividad</span>
            </div>
            <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate font-body">
              {customer.metrics.lastOrderAt
                ? new Date(customer.metrics.lastOrderAt).toLocaleDateString("es-CO", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Sin compras"}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Fecha de último pedido</span>
          </div>
        </div>

        {/* Distribución 2 columnas: Ficha/Direcciones + Historial */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Columna Izquierda: Datos y Direcciones */}
          <div className="space-y-4">
            {/* Datos de contacto */}
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-3">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Información del perfil
                </h3>
                <StatusBadge
                  status={customer.status}
                  label={customer.status === "active" ? "Activo" : "Inactivo"}
                  variant={customer.status === "active" ? "emerald" : "slate"}
                />
              </div>

              <div className="space-y-3 text-xs font-body">
                <div className="flex items-start gap-2.5">
                  <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Nombre completo</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {customer.fullName}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Celular / WhatsApp</span>
                    <span className="font-mono text-slate-900 dark:text-white font-medium">
                      {customer.phone || "No registrado"}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Correo electrónico</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {customer.email || "No registrado"}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Cédula / NIT</span>
                    <span className="text-slate-800 dark:text-slate-200 font-mono">
                      {customer.taxId || "No especificado"}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Fecha de registro</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {new Date(customer.createdAt).toLocaleDateString("es-CO", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {customer.notes && (
                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1 font-mono">
                    Preferencias / Observaciones
                  </span>
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 text-xs font-body">
                    {customer.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Sección de Crédito y Cartera del Cliente */}
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#ED500A]" />
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                    Crédito y Cartera
                  </h3>
                </div>
                {canManageCredit && (
                  <button
                    type="button"
                    onClick={() => {
                      setCreditLimitInput(String(customer.creditLimit || 0));
                      setIsCreditLimitModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#ED500A] hover:text-[#D44405] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Configurar cupo</span>
                  </button>
                )}
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Límite de crédito</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCOP(customer.creditLimit)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Crédito usado</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {formatCOP(customer.creditUsed)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">
                    Crédito disponible
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {formatCOP(customer.creditAvailable)}
                  </span>
                </div>

                {(customer.creditLimit || 0) > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="w-full h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (customer.creditUsed || 0) / (customer.creditLimit || 1) >= 0.9
                            ? "bg-red-500"
                            : (customer.creditUsed || 0) / (customer.creditLimit || 1) >= 0.7
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(((customer.creditUsed || 0) / (customer.creditLimit || 1)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Uso del cupo</span>
                      <span>
                        {Math.min(
                          100,
                          Math.round(((customer.creditUsed || 0) / (customer.creditLimit || 1)) * 100)
                        )}
                        %
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {canEditCustomer && (customer.creditLimit || 0) > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setIsCreditSaleModalOpen(true)}
                  >
                    Registrar venta a crédito
                  </Button>
                </div>
              )}
            </div>

            {/* Direcciones Guardadas */}
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#ED500A]" />
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                    Direcciones frecuentes
                  </h3>
                </div>
                {canEditCustomer && (
                  <button
                    onClick={() => setIsAddAddressOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#ED500A] hover:text-[#D44405] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                )}
              </div>

              {customer.addresses.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 italic bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-dashed border-slate-200 dark:border-white/[0.06]">
                  Sin direcciones registradas aún.
                </div>
              ) : (
                <div className="space-y-2">
                  {customer.addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-3 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0 text-xs space-y-0.5 font-body">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {addr.label}
                          </span>
                          {addr.isDefault && (
                            <span className="px-1.5 py-0.2 bg-orange-500/10 text-[#ED500A] text-[9px] font-bold rounded-md">
                              Principal
                            </span>
                          )}
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          {addr.addressLine}
                        </div>
                        {addr.reference && (
                          <div className="text-[11px] text-slate-400">
                            Ref: {addr.reference}
                          </div>
                        )}
                      </div>
                      {canEditCustomer && (
                        <button
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors shrink-0"
                          title="Eliminar dirección"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Pestañas de Historial */}
          <div className="lg:col-span-2 space-y-4">
            {/* Selector de Pestañas con diseño oficial NEGOVA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 shrink-0">
                <button
                  onClick={() => {
                    setActiveTab("orders");
                    setOrdersPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    activeTab === "orders"
                      ? "bg-[#ED500A] text-white font-semibold shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <UtensilsCrossed className="w-3.5 h-3.5" />
                  <span>Historial de Pedidos ({customer.recentOrders.length})</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("sales");
                    setSalesPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    activeTab === "sales"
                      ? "bg-[#ED500A] text-white font-semibold shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Comprobantes de Venta ({customer.recentSales.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab("credit")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    activeTab === "credit"
                      ? "bg-[#ED500A] text-white font-semibold shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>
                    Cuentas por Cobrar ({(customer.receivables || []).length})
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("loyalty")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    activeTab === "loyalty"
                      ? "bg-[#ED500A] text-white font-semibold shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>
                    Puntos de Fidelización ({loyaltyAccount.pointsBalance} pts)
                  </span>
                </button>
              </div>

              {/* Filtro y buscador contextual según la pestaña activa */}
              {activeTab === "orders" ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por # o detalle..."
                      value={ordersSearch}
                      onChange={(e) => {
                        setOrdersSearch(e.target.value);
                        setOrdersPage(1);
                      }}
                      className="h-8 pl-8 pr-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                    />
                  </div>

                  <select
                    value={ordersFilterStatus}
                    onChange={(e) => {
                      setOrdersFilterStatus(e.target.value);
                      setOrdersPage(1);
                    }}
                    className="h-8 px-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="received">Recibidos</option>
                    <option value="in_preparation">En preparación</option>
                    <option value="ready">Listos</option>
                    <option value="delivered">Entregados</option>
                    <option value="cancelled">Cancelados</option>
                  </select>
                </div>
              ) : activeTab === "sales" ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar # factura o medio..."
                      value={salesSearch}
                      onChange={(e) => {
                        setSalesSearch(e.target.value);
                        setSalesPage(1);
                      }}
                      className="h-8 pl-8 pr-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                    />
                  </div>

                  <select
                    value={salesFilterStatus}
                    onChange={(e) => {
                      setSalesFilterStatus(e.target.value);
                      setSalesPage(1);
                    }}
                    className="h-8 px-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="completed">Completada</option>
                    <option value="paid">Pagada</option>
                    <option value="pending">Pendiente</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>
              ) : null}
            </div>

            {/* Contenido Pestaña Pedidos (Tabla estructurada y paginada) */}
            {activeTab === "orders" && (
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-xs">
                {filteredOrders.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400 font-body">
                    {customer.recentOrders.length === 0
                      ? "No hay pedidos registrados para este cliente."
                      : "No se encontraron pedidos con los filtros aplicados."}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            <th className="py-2.5 px-4 font-semibold">Fecha / Hora</th>
                            <th className="py-2.5 px-3 font-semibold"># Pedido</th>
                            <th className="py-2.5 px-3 font-semibold">Canal / Tipo</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                            <th className="py-2.5 px-3 font-semibold text-center">Estado</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                          {paginatedOrders.map((ord) => (
                            <tr
                              key={ord.id}
                              onClick={() => handleNavigateToOrder(ord.id)}
                              className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                              title="Hacer clic para ver detalle del pedido"
                            >
                              <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {new Date(ord.createdAt).toLocaleString("es-CO", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </td>
                              <td className="py-3 px-3 font-bold font-mono text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors whitespace-nowrap">
                                #{ord.orderNumber}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
                                  {ord.orderType === "delivery"
                                    ? "Domicilio"
                                    : ord.orderType === "takeout"
                                    ? "Para llevar"
                                    : "Mesa / Salón"}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap">
                                {formatCOP(ord.total)}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-lg uppercase ${
                                    ord.status === "delivered"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                                      : ord.status === "cancelled"
                                      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20"
                                      : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                                  }`}
                                >
                                  {ord.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#ED500A] group-hover:translate-x-0.5 transition-transform">
                                  Ver comanda
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Barra de Paginación para Pedidos */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.01] text-xs text-slate-500">
                      <span>
                        Mostrando {(ordersPage - 1) * ordersPageSize + 1} a{" "}
                        {Math.min(ordersPage * ordersPageSize, filteredOrders.length)} de{" "}
                        {filteredOrders.length} pedidos
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={ordersPageSize}
                          onChange={(e) => {
                            setOrdersPageSize(Number(e.target.value));
                            setOrdersPage(1);
                          }}
                          className="h-7 px-1.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-[11px]"
                        >
                          <option value={5}>5 / pág</option>
                          <option value={10}>10 / pág</option>
                          <option value={20}>20 / pág</option>
                        </select>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                            disabled={ordersPage <= 1}
                            className="p-1 rounded-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Página anterior"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono text-slate-800 dark:text-slate-200 text-xs px-1">
                            {ordersPage} / {totalOrdersPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOrdersPage((p) => Math.min(totalOrdersPages, p + 1))}
                            disabled={ordersPage >= totalOrdersPages}
                            className="p-1 rounded-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Página siguiente"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Contenido Pestaña Ventas (Tabla estructurada y paginada) */}
            {activeTab === "sales" && (
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-xs">
                {filteredSales.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400 font-body">
                    {customer.recentSales.length === 0
                      ? "No hay facturas o recibos emitidos a nombre de este cliente."
                      : "No se encontraron comprobantes con los filtros aplicados."}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            <th className="py-2.5 px-4 font-semibold">Fecha Emisión</th>
                            <th className="py-2.5 px-3 font-semibold"># Comprobante</th>
                            <th className="py-2.5 px-3 font-semibold">Medio de Pago</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                            <th className="py-2.5 px-3 font-semibold text-center">Estado</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                          {paginatedSales.map((sale) => (
                            <tr
                              key={sale.id}
                              onClick={() => handleNavigateToSale(sale.id)}
                              className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                              title="Hacer clic para ver detalle del comprobante de venta"
                            >
                              <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {new Date(sale.issuedAt).toLocaleString("es-CO", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </td>
                              <td className="py-3 px-3 font-bold font-mono text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors whitespace-nowrap">
                                {sale.documentNumber}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
                                  {sale.paymentMethod}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap">
                                {formatCOP(sale.total)}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-lg uppercase ${
                                    sale.status === "paid" || sale.status === "completed"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                                      : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 border border-slate-200 dark:border-white/10"
                                  }`}
                                >
                                  {sale.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#ED500A] group-hover:translate-x-0.5 transition-transform">
                                  Ver venta
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Barra de Paginación para Ventas */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.01] text-xs text-slate-500">
                      <span>
                        Mostrando {(salesPage - 1) * salesPageSize + 1} a{" "}
                        {Math.min(salesPage * salesPageSize, filteredSales.length)} de{" "}
                        {filteredSales.length} comprobantes
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={salesPageSize}
                          onChange={(e) => {
                            setSalesPageSize(Number(e.target.value));
                            setSalesPage(1);
                          }}
                          className="h-7 px-1.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-[11px]"
                        >
                          <option value={5}>5 / pág</option>
                          <option value={10}>10 / pág</option>
                          <option value={20}>20 / pág</option>
                        </select>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSalesPage((p) => Math.max(1, p - 1))}
                            disabled={salesPage <= 1}
                            className="p-1 rounded-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Página anterior"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono text-slate-800 dark:text-slate-200 text-xs px-1">
                            {salesPage} / {totalSalesPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSalesPage((p) => Math.min(totalSalesPages, p + 1))}
                            disabled={salesPage >= totalSalesPages}
                            className="p-1 rounded-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Página siguiente"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Contenido Pestaña Cuentas por Cobrar y Abonos */}
            {activeTab === "credit" && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-xs">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                      Cuentas por cobrar ({(customer.receivables || []).length})
                    </span>
                    {canEditCustomer && (customer.creditLimit || 0) > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                        onClick={() => setIsCreditSaleModalOpen(true)}
                      >
                        Nueva cuenta a crédito
                      </Button>
                    )}
                  </div>

                  {(customer.receivables || []).length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-body">
                      No hay cuentas por cobrar registradas para este cliente.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            <th className="py-2.5 px-4 font-semibold">Fecha</th>
                            <th className="py-2.5 px-3 font-semibold">Vencimiento</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Monto</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Abonado</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Saldo</th>
                            <th className="py-2.5 px-3 font-semibold text-center">Estado</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                          {(customer.receivables || []).map((rec) => {
                            const statusLabel =
                              rec.status === "paid"
                                ? "Pagada"
                                : rec.status === "overdue"
                                ? "Vencida"
                                : rec.status === "partial"
                                ? "Parcial"
                                : "Pendiente";
                            const statusStyle =
                              rec.status === "paid"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                : rec.status === "overdue"
                                ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20"
                                : rec.status === "partial"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20";

                            return (
                              <tr
                                key={rec.id}
                                className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors"
                              >
                                <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {new Date(rec.createdAt).toLocaleDateString("es-CO")}
                                </td>
                                <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                  {rec.dueDate
                                    ? new Date(rec.dueDate).toLocaleDateString("es-CO")
                                    : "Sin fecha"}
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-slate-900 dark:text-white whitespace-nowrap">
                                  {formatCOP(rec.amount)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                  {formatCOP(rec.paidAmount)}
                                </td>
                                <td className="py-3 px-3 text-right font-bold font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                  {formatCOP(rec.balance)}
                                </td>
                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-lg border uppercase ${statusStyle}`}
                                  >
                                    {statusLabel}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  {rec.balance > 0 && canEditCustomer ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      leftIcon={<Banknote className="w-3.5 h-3.5" />}
                                      onClick={() => {
                                        setSelectedReceivableForPayment(rec);
                                      }}
                                    >
                                      Abonar
                                    </Button>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      Saldada
                                    </span>
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

                {/* Historial de Abonos */}
                <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-xs">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                      Historial de Abonos ({(customer.payments || []).length})
                    </span>
                  </div>
                  {(customer.payments || []).length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 font-body">
                      Aún no se han registrado abonos para este cliente.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {(customer.payments || []).map((pmt) => (
                        <div
                          key={pmt.id}
                          className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-900 dark:text-white font-mono">
                              +{formatCOP(pmt.amount)}{" "}
                              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 ml-1">
                                {pmt.paymentMethod}
                              </span>
                            </div>
                            {pmt.notes && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {pmt.notes}
                              </div>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {new Date(pmt.createdAt).toLocaleString("es-CO", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contenido Pestaña Puntos de Fidelización [FID-001] */}
            {activeTab === "loyalty" && (
              <div className="space-y-4">
                {/* TARJETAS RESUMEN DE PUNTOS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Saldo de Puntos</span>
                      <Award className="w-4 h-4 text-[#ED500A]" />
                    </div>
                    <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
                      {loyaltyAccount.pointsBalance.toLocaleString("es-CO")} <span className="text-xs font-sans text-[#ED500A]">pts</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                      ≈ {formatCOP(loyaltyAccount.equivalentMoneyValue)} de descuento
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Acumulado</span>
                    <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
                      +{loyaltyAccount.totalEarned.toLocaleString("es-CO")} <span className="text-xs font-sans text-slate-400">pts</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Por compras identificadas
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Redimido</span>
                    <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
                      -{loyaltyAccount.totalRedeemed.toLocaleString("es-CO")} <span className="text-xs font-sans text-slate-400">pts</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Canjeado en comandas POS
                    </span>
                  </div>
                </div>

                {/* HISTORIAL DE MOVIMIENTOS Y ACCIONES */}
                <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-xs">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                      Historial de Puntos ({loyaltyTransactions.length})
                    </span>

                    {canEditCustomer && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAdjustPointsModalOpen(true)}
                        className="text-xs h-7 gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#ED500A]" />
                        <span>Ajustar puntos</span>
                      </Button>
                    )}
                  </div>

                  {loyaltyTransactions.length === 0 ? (
                    <div className="p-10 text-center text-xs text-slate-400 font-body">
                      No hay transacciones de puntos registradas para este cliente aún.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {loyaltyTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-3.5 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                tx.type === "earned"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                                  : tx.type === "redeemed"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                              }`}
                            >
                              {tx.type === "earned" ? "Acumulado" : tx.type === "redeemed" ? "Redimido" : "Ajuste"}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {tx.description || (tx.type === "earned" ? "Compra en restaurante" : "Redención de puntos")}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Saldo posterior: {tx.balanceAfter} pts
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`font-mono font-bold text-sm ${
                                tx.points > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {new Date(tx.createdAt).toLocaleString("es-CO", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Configurar Cupo de Crédito (Solo Owner/Admin) */}
      {isCreditLimitModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-sm bg-white dark:bg-[#0D0F16] rounded-2xl p-5 shadow-2xl border border-slate-200/80 dark:border-white/[0.08] space-y-4 font-body"
            >
              <h4 className="text-sm font-bold font-title text-slate-900 dark:text-white">
                Configurar límite de crédito
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Define el cupo máximo de cartera para {customer.fullName}. Crédito usado actual:{" "}
                <strong className="font-mono">{formatCOP(customer.creditUsed)}</strong>.
              </p>

              <form onSubmit={handleSaveCreditLimit} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Cupo máximo autorizado (COP) <span className="text-[#ED500A]">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="1000"
                    required
                    value={creditLimitInput}
                    onChange={(e) => setCreditLimitInput(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 font-mono focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreditLimitModalOpen(false)}
                    disabled={isSavingCreditLimit}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSavingCreditLimit}
                    isLoading={isSavingCreditLimit}
                  >
                    Guardar cupo
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Registrar Venta a Crédito */}
      {isCreditSaleModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-sm bg-white dark:bg-[#0D0F16] rounded-2xl p-5 shadow-2xl border border-slate-200/80 dark:border-white/[0.08] space-y-4 font-body"
            >
              <h4 className="text-sm font-bold font-title text-slate-900 dark:text-white">
                Registrar venta a crédito
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cupo disponible:{" "}
                <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCOP(customer.creditAvailable)}
                </strong>
              </p>

              <form onSubmit={handleSaveCreditSale} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Monto a crédito (COP) <span className="text-[#ED500A]">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    required
                    placeholder="Ej. 150000"
                    value={creditSaleAmount}
                    onChange={(e) => setCreditSaleAmount(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 font-mono focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Fecha de vencimiento (Opcional)
                  </label>
                  <input
                    type="date"
                    value={creditSaleDueDate}
                    onChange={(e) => setCreditSaleDueDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 font-mono focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreditSaleModalOpen(false)}
                    disabled={isSavingCreditSale}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSavingCreditSale}
                    isLoading={isSavingCreditSale}
                  >
                    Registrar cargo
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Registrar Abono a Cuenta por Cobrar (CustomerPaymentModal) */}
      <CustomerPaymentModal
        isOpen={Boolean(selectedReceivableForPayment)}
        initialReceivable={selectedReceivableForPayment}
        availableReceivables={customer.receivables || []}
        businessId={businessId}
        onClose={() => setSelectedReceivableForPayment(null)}
        onSuccess={() => {
          setSelectedReceivableForPayment(null);
          router.refresh();
        }}
      />

      {/* Modal Editar Perfil */}
      <CustomerModal
        isOpen={isEditModalOpen}
        businessId={businessId}
        customerToEdit={customer}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => router.refresh()}
      />

      {/* Modal Agregar Dirección */}
      {isAddAddressOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-sm bg-white dark:bg-[#0D0F16] rounded-2xl p-5 shadow-2xl border border-slate-200/80 dark:border-white/[0.08] space-y-4 font-body"
            >
              <h4 className="text-sm font-bold font-title text-slate-900 dark:text-white">
                Nueva dirección frecuente
              </h4>

              <form onSubmit={handleAddAddress} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Etiqueta (Ej. Casa, Trabajo, Pareja)
                  </label>
                  <input
                    type="text"
                    value={newAddressLabel}
                    onChange={(e) => setNewAddressLabel(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Dirección completa <span className="text-[#ED500A]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Calle 45 # 23-10"
                    value={newAddressLine}
                    onChange={(e) => setNewAddressLine(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Referencia / Indicaciones
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Apto 401, edificio azul"
                    value={newAddressReference}
                    onChange={(e) => setNewAddressReference(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isDefaultAddr"
                    checked={isNewAddressDefault}
                    onChange={(e) => setIsNewAddressDefault(e.target.checked)}
                    className="rounded text-[#ED500A] focus:ring-[#ED500A]"
                  />
                  <label htmlFor="isDefaultAddr" className="text-[11px] text-slate-600 dark:text-slate-400">
                    Establecer como dirección predeterminada
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddAddressOpen(false)}
                    disabled={isSavingAddress}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSavingAddress}
                    isLoading={isSavingAddress}
                  >
                    Guardar dirección
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Ajuste Manual de Puntos [FID-001] */}
      {isAdjustPointsModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-sm bg-white dark:bg-[#0D0F16] rounded-2xl p-5 shadow-2xl border border-slate-200/80 dark:border-white/[0.08] space-y-4 font-body"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#ED500A]/10 text-[#ED500A] rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold font-title text-slate-900 dark:text-white">
                    Ajustar puntos de fidelización
                  </h4>
                  <p className="text-xs text-slate-500">
                    Saldo actual: <strong className="font-mono text-[#ED500A]">{loyaltyAccount.pointsBalance} pts</strong>
                  </p>
                </div>
              </div>

              <form onSubmit={handleAdjustPointsSubmit} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Puntos (+ para sumar, - para restar) <span className="text-[#ED500A]">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    placeholder="Ej. 100 o -50"
                    value={adjustPointsDelta}
                    onChange={(e) => setAdjustPointsDelta(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 font-mono focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Motivo del ajuste <span className="text-[#ED500A]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    placeholder="Ej. Bonificación cortesía por aniversario"
                    value={adjustPointsReason}
                    onChange={(e) => setAdjustPointsReason(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAdjustPointsModalOpen(false)}
                    disabled={isSubmittingAdjust}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmittingAdjust}
                    isLoading={isSubmittingAdjust}
                  >
                    Guardar ajuste
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Confirmación Eliminación Cliente (ConfirmModal Oficial) */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteCustomer}
        title="¿Eliminar cliente?"
        description="Se desactivará este perfil. Todo el historial de órdenes anteriores permanecerá intacto."
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </AppPageContainer>
  );
}
