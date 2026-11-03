"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
  Percent,
  Plus,
  Trash2,
  ShieldCheck,
  Split,
  Layers,
  ArrowRight,
  CreditCard,
  Banknote,
  Receipt,
  HelpCircle,
  Search,
  User,
  AlertCircle,
  Calendar,
  Award,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { PaymentMethodLogo } from "@/components/payments/payment-method-logo";
import { RestaurantOrderWithDetails, ProcessOrderPaymentInput, SplitPaymentItem, PRESET_TABLE_DISCOUNTS } from "@/lib/restaurant/types";
import { PublicPaymentMethodDTO } from "@/lib/payments/types";
import { searchCustomersForPosAction, getCustomerCreditInfoAction } from "@/app/workspace/[businessId]/clientes/actions";
import { getCustomerLoyaltyAccountAction } from "@/app/workspace/[businessId]/clientes/loyalty-actions";
import { toast } from "sonner";

export interface SelectablePaymentOption {
  code: string;
  name: string;
  destinationType?: string | null;
  destinationValue?: string | null;
  accountHolder?: string | null;
  instructions?: string | null;
  isTransfer?: boolean;
}

export function parseOrderProposedPayment(notes: string | null | undefined): {
  proposedMethodLabel?: string;
  proposedMethodCode?: string;
  cashAmount?: number;
} {
  if (!notes) return {};

  const matchMethod = notes.match(/M[ée]todo de pago propuesto:\s*([^|\n\[]+)/i);
  const proposedMethodLabel = matchMethod ? matchMethod[1].trim() : undefined;

  let proposedMethodCode: string | undefined = undefined;
  if (proposedMethodLabel) {
    const lower = proposedMethodLabel.toLowerCase();
    if (lower.includes("efectivo") || lower === "cash") proposedMethodCode = "cash";
    else if (lower.includes("nequi")) proposedMethodCode = "nequi";
    else if (lower.includes("daviplata") || lower.includes("davi plata")) proposedMethodCode = "daviplata";
    else if (lower.includes("bancolombia")) proposedMethodCode = "bancolombia";
    else if (lower.includes("bre-b") || lower.includes("bre_b") || lower.includes("bre b")) proposedMethodCode = "bre_b";
    else if (lower.includes("davivienda")) proposedMethodCode = "davivienda";
    else if (lower.includes("nu")) proposedMethodCode = "nu";
    else if (lower.includes("tarjeta") || lower.includes("card")) proposedMethodCode = "card";
    else if (lower.includes("transferencia")) proposedMethodCode = "transfer";
  }

  const matchCash = notes.match(/Paga en efectivo con:\s*\$?\s*([\d\.,]+)/i);
  let cashAmount: number | undefined = undefined;
  if (matchCash) {
    const rawNum = matchCash[1].replace(/\./g, "").replace(/,/g, "");
    cashAmount = Number(rawNum) || undefined;
  }

  return { proposedMethodLabel, proposedMethodCode, cashAmount };
}

function formatDestinationType(type: string | null | undefined): string {
  switch (type) {
    case "phone":
      return "Celular";
    case "savings_account":
      return "Cta. Ahorros";
    case "current_account":
      return "Cta. Corriente";
    case "merchant_code":
      return "Código Bre-B";
    case "national_id":
      return "Cédula";
    case "email":
      return "Correo";
    default:
      return "Dato";
  }
}

interface SplitLineState {
  id: string;
  method: string;
  amount: number;
  receivedAmount?: number;
}

interface OrderPaymentModalProps {
  isOpen: boolean;
  order: RestaurantOrderWithDetails | null;
  paymentMethods?: PublicPaymentMethodDTO[];
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (paymentData: string | ProcessOrderPaymentInput) => Promise<void> | void;
  formatCOP?: (val: number) => string;
}

export function OrderPaymentModal({
  isOpen,
  order,
  paymentMethods = [],
  isSubmitting = false,
  onClose,
  onConfirm,
  formatCOP = (val) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val),
}: OrderPaymentModalProps) {
  // Construcción dinámica de métodos de pago combinando los configurados del comercio + opciones presenciales POS
  const availableOptions: SelectablePaymentOption[] = useMemo(() => {
    const list: SelectablePaymentOption[] = [];

    const sourceList =
      paymentMethods && paymentMethods.length > 0
        ? paymentMethods
        : [
            {
              code: "cash",
              name: "Efectivo",
              isEnabled: true,
              isConfigured: true,
              destinationType: "phone",
              destinationValue: null,
              accountHolder: null,
              instructions: null,
              breBKeyType: null,
              qrUrl: null,
            },
          ];

    for (const m of sourceList) {
      list.push({
        code: m.code,
        name: m.name,
        destinationType: m.destinationType,
        destinationValue: m.destinationValue,
        accountHolder: m.accountHolder,
        instructions: m.instructions,
        isTransfer: m.code !== "cash",
      });
    }

    if (!list.some((it) => it.code === "card")) {
      list.push({
        code: "card",
        name: "Tarjeta / Datáfono",
        isTransfer: false,
      });
    }

    if (!list.some((it) => it.code === "credit")) {
      list.push({
        code: "credit",
        name: "A crédito",
        isTransfer: false,
      });
    }

    if (!list.some((it) => it.code === "other")) {
      list.push({
        code: "other",
        name: "Otro medio",
        isTransfer: false,
      });
    }

    return list;
  }, [paymentMethods]);

  const proposedInfo = useMemo(() => {
    return parseOrderProposedPayment(order?.notes);
  }, [order?.notes]);

  // Modo de pago: único vs dividido [POS-002]
  const [isSplit, setIsSplit] = useState<boolean>(false);
  const [selectedSingleMethod, setSelectedSingleMethod] = useState<string>("cash");
  const [singleCashReceivedStr, setSingleCashReceivedStr] = useState<string>("");

  // Pagos divididos
  const [splitLines, setSplitLines] = useState<SplitLineState[]>([]);

  // Descuentos [POS-002 & MES-003]
  const [hasDiscount, setHasDiscount] = useState<boolean>(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValueStr, setDiscountValueStr] = useState<string>("");
  const [discountReason, setDiscountReason] = useState<string>("");
  const [selectedPresetDiscountId, setSelectedPresetDiscountId] = useState<string | null>(null);

  // Propinas [POS-002 & MES-003]
  const [tipSelection, setTipSelection] = useState<"none" | "5" | "10" | "15" | "20" | "custom">("none");
  const [customTipStr, setCustomTipStr] = useState<string>("");

  // Gestión de ventas a crédito [POS-003]
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(order?.customer_id || null);
  const [customerCreditInfo, setCustomerCreditInfo] = useState<{
    id: string;
    fullName: string;
    phone?: string | null;
    creditLimit: number;
    creditUsed: number;
    creditAvailable: number;
    hasCredit: boolean;
  } | null>(null);
  const [isLoadingCreditInfo, setIsLoadingCreditInfo] = useState<boolean>(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("");
  const [customerSearchResults, setCustomerSearchResults] = useState<
    Array<{
      id: string;
      fullName: string;
      phone: string | null;
      creditLimit?: number;
      creditUsed?: number;
      creditAvailable?: number;
      hasCredit?: boolean;
    }>
  >([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState<boolean>(false);
  const [creditDueDays, setCreditDueDays] = useState<number>(30);

  // Gestión de puntos de fidelización [FID-001]
  const [customerLoyalty, setCustomerLoyalty] = useState<{
    pointsBalance: number;
    equivalentMoneyValue: number;
    canRedeem: boolean;
  } | null>(null);
  const [isRedeemingPoints, setIsRedeemingPoints] = useState<boolean>(false);
  const [redeemedPointsInput, setRedeemedPointsInput] = useState<number>(0);

  // Inicialización al abrir modal
  useEffect(() => {
    if (order && isOpen) {
      const initialMethod = proposedInfo.proposedMethodCode || "cash";
      setSelectedSingleMethod(initialMethod);
      if (proposedInfo.cashAmount && proposedInfo.cashAmount > 0) {
        setSingleCashReceivedStr(String(proposedInfo.cashAmount));
      } else {
        setSingleCashReceivedStr(String(order.total));
      }
      setIsSplit(false);
      setHasDiscount(false);
      setDiscountType("percentage");
      setDiscountValueStr("");
      setDiscountReason("");
      setSelectedPresetDiscountId(null);
      setTipSelection("none");
      setCustomTipStr("");
      setSplitLines([
        { id: "line-1", method: "cash", amount: Math.round(order.total / 2) },
        { id: "line-2", method: "card", amount: Math.round(order.total / 2) },
      ]);

      const initialCustomerId = order.customer_id || null;
      setSelectedCustomerId(initialCustomerId);
      setCustomerSearchQuery("");
      setCustomerSearchResults([]);
      setCreditDueDays(30);
      setIsRedeemingPoints(false);
      setRedeemedPointsInput(0);

      const businessId = order.business_id;
      if (initialCustomerId && businessId) {
        setIsLoadingCreditInfo(true);
        getCustomerCreditInfoAction(businessId, initialCustomerId)
          .then((res) => {
            if (res.success && res.customer) {
              setCustomerCreditInfo({
                ...res.customer,
                phone: res.customer.phone || null,
              });
            } else {
              setCustomerCreditInfo(null);
            }
          })
          .catch(() => setCustomerCreditInfo(null))
          .finally(() => setIsLoadingCreditInfo(false));

        getCustomerLoyaltyAccountAction(businessId, initialCustomerId)
          .then((res) => {
            if (res.success && res.account) {
              setCustomerLoyalty({
                pointsBalance: res.account.pointsBalance,
                equivalentMoneyValue: res.account.equivalentMoneyValue,
                canRedeem: res.account.canRedeem,
              });
            } else {
              setCustomerLoyalty(null);
            }
          })
          .catch(() => setCustomerLoyalty(null));
      } else {
        setCustomerCreditInfo(null);
        setCustomerLoyalty(null);
      }
    }
  }, [order, isOpen, proposedInfo]);

  const handleCustomerSearch = async (term: string) => {
    setCustomerSearchQuery(term);
    if (!order?.business_id || term.trim().length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    setIsSearchingCustomers(true);
    try {
      const results = await searchCustomersForPosAction(order.business_id, term.trim());
      setCustomerSearchResults(results);
    } catch {
      setCustomerSearchResults([]);
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  const handleSelectCustomerForCredit = (c: {
    id: string;
    fullName: string;
    phone: string | null;
    creditLimit?: number;
    creditUsed?: number;
    creditAvailable?: number;
    hasCredit?: boolean;
  }) => {
    setSelectedCustomerId(c.id);
    const limit = Number(c.creditLimit || 0);
    const used = Number(c.creditUsed || 0);
    const available = Math.max(0, Number((limit - used).toFixed(2)));
    setCustomerCreditInfo({
      id: c.id,
      fullName: c.fullName,
      phone: c.phone || null,
      creditLimit: limit,
      creditUsed: used,
      creditAvailable: available,
      hasCredit: limit > 0,
    });
    setCustomerSearchResults([]);
    setCustomerSearchQuery("");

    if (order?.business_id && c.id) {
      getCustomerLoyaltyAccountAction(order.business_id, c.id)
        .then((res) => {
          if (res.success && res.account) {
            setCustomerLoyalty({
              pointsBalance: res.account.pointsBalance,
              equivalentMoneyValue: res.account.equivalentMoneyValue,
              canRedeem: res.account.canRedeem,
            });
          } else {
            setCustomerLoyalty(null);
          }
        })
        .catch(() => setCustomerLoyalty(null));
    }
  };

  // Cálculos matemáticos de la venta
  const baseOrderTotal = order?.total || 0;
  const baseSubtotal = order?.subtotal || baseOrderTotal;
  const deliveryFee = order?.delivery_fee || 0;
  const taxTotal = order?.tax_total || 0;

  // 1. Descuento comercial
  const discountNumericValue = Number(discountValueStr.replace(/\D/g, "")) || 0;
  const calculatedDiscountAmount = useMemo(() => {
    if (!hasDiscount || discountNumericValue <= 0) return 0;
    if (discountType === "percentage") {
      const clampedPct = Math.min(100, discountNumericValue);
      return Math.round(baseSubtotal * (clampedPct / 100));
    }
    return Math.min(baseSubtotal, discountNumericValue);
  }, [hasDiscount, discountType, discountNumericValue, baseSubtotal]);

  // 1.1 Descuento por puntos de fidelización [FID-001]
  const loyaltyDiscountAmount = useMemo(() => {
    if (!isRedeemingPoints || redeemedPointsInput <= 0 || !customerLoyalty) return 0;
    const maxDiscountAllowed = Math.round(baseSubtotal * 0.5); // máximo 50%
    const calculated = redeemedPointsInput * 10; // $10 COP por punto
    return Math.min(baseSubtotal - calculatedDiscountAmount, Math.min(maxDiscountAllowed, calculated));
  }, [isRedeemingPoints, redeemedPointsInput, customerLoyalty, baseSubtotal, calculatedDiscountAmount]);

  // 2. Total Venta tras descuentos
  const totalDiscounts = calculatedDiscountAmount + loyaltyDiscountAmount;
  const netSaleTotal = Math.max(0, baseSubtotal - totalDiscounts + taxTotal + deliveryFee);

  // 3. Propina voluntaria
  const calculatedTipAmount = useMemo(() => {
    if (tipSelection === "none") return 0;
    if (tipSelection === "5") return Math.round(netSaleTotal * 0.05);
    if (tipSelection === "10") return Math.round(netSaleTotal * 0.1);
    if (tipSelection === "15") return Math.round(netSaleTotal * 0.15);
    if (tipSelection === "20") return Math.round(netSaleTotal * 0.2);
    if (tipSelection === "custom") {
      return Number(customTipStr.replace(/\D/g, "")) || 0;
    }
    return 0;
  }, [tipSelection, netSaleTotal, customTipStr]);

  // 4. Total a Cobrar (Venta + Propina)
  const totalToCollect = netSaleTotal + calculatedTipAmount;

  // 5. Cálculos para Pagos Divididos
  const totalSplitCovered = useMemo(() => {
    return splitLines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
  }, [splitLines]);

  const splitRemaining = Math.max(0, totalToCollect - totalSplitCovered);
  const isSplitFullyCovered = totalSplitCovered >= totalToCollect;

  // 6. Cálculos de cambio / vueltas en efectivo
  const currentOption = availableOptions.find((opt) => opt.code === selectedSingleMethod);

  // Cambio en pago único
  const singleCashReceivedNum = Number(singleCashReceivedStr.replace(/\D/g, "")) || 0;
  const singleCashChange =
    selectedSingleMethod === "cash" && singleCashReceivedNum > totalToCollect
      ? singleCashReceivedNum - totalToCollect
      : 0;

  // Cambio en pago dividido (sobre la línea de efectivo si la hay)
  const splitCashLine = splitLines.find((l) => l.method === "cash");
  const splitCashChange = useMemo(() => {
    if (!splitCashLine) return 0;
    const received = splitCashLine.receivedAmount || 0;
    return received > splitCashLine.amount ? received - splitCashLine.amount : 0;
  }, [splitCashLine]);

  // Cambio efectivo total
  const finalCashChange = isSplit ? splitCashChange : singleCashChange;

  // Validación de si se puede confirmar
  const canConfirm = useMemo(() => {
    if (isSubmitting) return false;
    if (!isSplit) {
      if (selectedSingleMethod === "cash") {
        return singleCashReceivedNum >= totalToCollect;
      }
      if (selectedSingleMethod === "credit") {
        if (!selectedCustomerId || !customerCreditInfo) return false;
        if (!customerCreditInfo.hasCredit) return false;
        if (totalToCollect > customerCreditInfo.creditAvailable) return false;
        return true;
      }
      return Boolean(selectedSingleMethod);
    }
    // Si es dividido: debe cubrir el total y las líneas de efectivo deben tener recibido suficiente
    if (!isSplitFullyCovered) return false;
    if (splitLines.length === 0) return false;
    if (splitCashLine && splitCashLine.receivedAmount !== undefined) {
      if (splitCashLine.receivedAmount < splitCashLine.amount) return false;
    }
    const creditLine = splitLines.find((l) => l.method === "credit");
    if (creditLine) {
      if (!selectedCustomerId || !customerCreditInfo) return false;
      if (!customerCreditInfo.hasCredit) return false;
      if (creditLine.amount > customerCreditInfo.creditAvailable) return false;
    }
    return true;
  }, [
    isSubmitting,
    isSplit,
    selectedSingleMethod,
    singleCashReceivedNum,
    totalToCollect,
    isSplitFullyCovered,
    splitLines,
    splitCashLine,
    selectedCustomerId,
    customerCreditInfo,
  ]);

  if (!isOpen || !order) return null;

  // Handlers para split
  const handleAddSplitLine = () => {
    const unusedMethod =
      availableOptions.find((opt) => !splitLines.some((l) => l.method === opt.code))?.code ||
      "transfer";
    const newLine: SplitLineState = {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      method: unusedMethod,
      amount: splitRemaining,
    };
    setSplitLines((prev) => [...prev, newLine]);
  };

  const handleUpdateSplitLine = (id: string, updates: Partial<SplitLineState>) => {
    setSplitLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  const handleRemoveSplitLine = (id: string) => {
    setSplitLines((prev) => prev.filter((l) => l.id !== id));
  };

  // Confirmar cobro
  const handleConfirmSubmit = () => {
    if (!canConfirm) return;

    if (!isSplit) {
      if (selectedSingleMethod === "credit") {
        if (!selectedCustomerId || !customerCreditInfo) {
          toast.error("Debes seleccionar un cliente registrado para la venta a crédito.");
          return;
        }
        if (!customerCreditInfo.hasCredit) {
          toast.error(`El cliente «${customerCreditInfo.fullName}» no tiene cupo de crédito autorizado.`);
          return;
        }
        if (totalToCollect > customerCreditInfo.creditAvailable) {
          toast.error(
            `Cupo de crédito insuficiente. Disponible: ${formatCOP(customerCreditInfo.creditAvailable)}, solicitado: ${formatCOP(totalToCollect)}.`
          );
          return;
        }
      }

      const payload: ProcessOrderPaymentInput = {
        paymentMethod: selectedSingleMethod,
        customerId: selectedCustomerId || undefined,
        creditDueDays: selectedSingleMethod === "credit" ? creditDueDays : undefined,
        isSplit: false,
        discount: hasDiscount && calculatedDiscountAmount > 0
          ? {
              type: discountType,
              value: discountNumericValue,
              amount: calculatedDiscountAmount,
              reason: discountReason.trim() || undefined,
            }
          : undefined,
        loyaltyPointsRedeemed: isRedeemingPoints && redeemedPointsInput > 0 ? redeemedPointsInput : undefined,
        loyaltyDiscountAmount: loyaltyDiscountAmount > 0 ? loyaltyDiscountAmount : undefined,
        tip: calculatedTipAmount > 0
          ? {
              amount: calculatedTipAmount,
              percentage: tipSelection !== "custom" && tipSelection !== "none" ? Number(tipSelection) : undefined,
            }
          : undefined,
        cashChange: singleCashChange,
      };
      onConfirm(payload);
    } else {
      const splitItems: SplitPaymentItem[] = splitLines.map((l) => ({
        method: l.method,
        amount: Number(l.amount),
        receivedAmount: l.receivedAmount,
        change: l.method === "cash" ? splitCashChange : 0,
      }));

      const hasCreditInSplit = splitLines.some((l) => l.method === "credit");
      if (hasCreditInSplit && (!selectedCustomerId || !customerCreditInfo)) {
        toast.error("Debes seleccionar un cliente registrado para la parte a crédito.");
        return;
      }

      const payload: ProcessOrderPaymentInput = {
        isSplit: true,
        splitPayments: splitItems,
        customerId: selectedCustomerId || undefined,
        creditDueDays: hasCreditInSplit ? creditDueDays : undefined,
        discount: hasDiscount && calculatedDiscountAmount > 0
          ? {
              type: discountType,
              value: discountNumericValue,
              amount: calculatedDiscountAmount,
              reason: discountReason.trim() || undefined,
            }
          : undefined,
        loyaltyPointsRedeemed: isRedeemingPoints && redeemedPointsInput > 0 ? redeemedPointsInput : undefined,
        loyaltyDiscountAmount: loyaltyDiscountAmount > 0 ? loyaltyDiscountAmount : undefined,
        tip: calculatedTipAmount > 0
          ? {
              amount: calculatedTipAmount,
              percentage: tipSelection !== "custom" && tipSelection !== "none" ? Number(tipSelection) : undefined,
            }
          : undefined,
        cashChange: splitCashChange,
      };
      onConfirm(payload);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-body max-h-[92vh]"
        >
          {/* HEADER */}
          <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Registrar Cobro
                </h3>
                <p className="text-xs text-slate-500">
                  Pedido #{order.order_number}
                  {order.channel_origin === "digital_menu" && " · Menú Digital"}
                  {order.order_type === "delivery" && " · Domicilio"}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CONTENIDO SCROLLABLE */}
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* SELECTOR DE MODO: ÚNICO VS DIVIDIDO [POS-002] */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/60 dark:border-white/5">
              <button
                type="button"
                onClick={() => setIsSplit(false)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  !isSplit
                    ? "bg-white dark:bg-white/10 text-[#ED500A] shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pago único</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSplit(true);
                  if (splitLines.length === 0) {
                    setSplitLines([
                      { id: "line-1", method: "cash", amount: Math.round(totalToCollect / 2) },
                      { id: "line-2", method: "card", amount: Math.round(totalToCollect / 2) },
                    ]);
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSplit
                    ? "bg-white dark:bg-white/10 text-[#ED500A] shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>Dividir pago en múltiples métodos</span>
              </button>
            </div>

            {/* TARJETA TOTAL Y RESUMEN FINANCIERO */}
            <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Subtotal venta ({baseOrderTotal > 0 ? "original" : "base"}):</span>
                <span className="font-mono font-medium">{formatCOP(baseSubtotal)}</span>
              </div>

              {/* LÍNEA DE DESCUENTO */}
              {hasDiscount && calculatedDiscountAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    <span>Descuento ({discountReason || (discountType === "percentage" ? `${discountNumericValue}%` : "Monto fijo")}):</span>
                  </span>
                  <span className="font-mono font-bold">-{formatCOP(calculatedDiscountAmount)}</span>
                </div>
              )}

              {/* LÍNEA DE DESCUENTO PUNTOS DE FIDELIZACIÓN [FID-001] */}
              {isRedeemingPoints && loyaltyDiscountAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    <span>Puntos redimidos ({redeemedPointsInput} pts):</span>
                  </span>
                  <span className="font-mono font-bold">-{formatCOP(loyaltyDiscountAmount)}</span>
                </div>
              )}

              {/* LÍNEA DE PROPINA */}
              {calculatedTipAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Propina sugerida ({tipSelection !== "custom" ? `${tipSelection}%` : "Personalizada"}):</span>
                  </span>
                  <span className="font-mono font-bold">+{formatCOP(calculatedTipAmount)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 dark:border-white/5 flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total a Cobrar
                  </span>
                  {calculatedTipAmount > 0 && (
                    <span className="text-[10px] text-slate-400">
                      (Venta: {formatCOP(netSaleTotal)} + Propina: {formatCOP(calculatedTipAmount)})
                    </span>
                  )}
                </div>
                <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[#ED500A]">
                  {formatCOP(totalToCollect)}
                </div>
              </div>

              {order.customer_name && (
                <p className="text-[11px] text-slate-500 border-t border-slate-200/50 dark:border-white/5 pt-1.5">
                  Cliente: <span className="text-slate-900 dark:text-white font-semibold">{order.customer_name}</span>
                  {order.customer_phone && ` (${order.customer_phone})`}
                </p>
              )}
            </div>

            {/* SECCIÓN DESCUENTOS Y PROPINAS [POS-002] */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* BLOQUE DESCUENTO */}
              <div className="p-3 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-[#ED500A]" />
                    <span>Descuento</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (hasDiscount) {
                        setHasDiscount(false);
                        setSelectedPresetDiscountId(null);
                      } else {
                        setHasDiscount(true);
                      }
                    }}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                      hasDiscount
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                        : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    {hasDiscount ? "Activo" : "+ Aplicar"}
                  </button>
                </div>

                {/* Descuentos Preestablecidos [MES-003] */}
                <div className="flex flex-wrap gap-1">
                  {PRESET_TABLE_DISCOUNTS.map((preset) => {
                    const isSelected = hasDiscount && selectedPresetDiscountId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setHasDiscount(false);
                            setSelectedPresetDiscountId(null);
                            setDiscountValueStr("");
                            setDiscountReason("");
                          } else {
                            setHasDiscount(true);
                            setSelectedPresetDiscountId(preset.id);
                            setDiscountType("percentage");
                            setDiscountValueStr(String(preset.percentage));
                            setDiscountReason(preset.reason);
                          }
                        }}
                        className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#ED500A]/10 border-[#ED500A] text-[#ED500A] shadow-2xs"
                            : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {hasDiscount && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType("percentage");
                          setSelectedPresetDiscountId(null);
                        }}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                          discountType === "percentage"
                            ? "bg-[#ED500A]/10 border-[#ED500A] text-[#ED500A]"
                            : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        % Porcentaje
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType("fixed");
                          setSelectedPresetDiscountId(null);
                        }}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                          discountType === "fixed"
                            ? "bg-[#ED500A]/10 border-[#ED500A] text-[#ED500A]"
                            : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        $ Valor fijo
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={
                            discountType === "percentage"
                              ? discountValueStr
                              : discountValueStr
                              ? new Intl.NumberFormat("es-CO").format(Number(discountValueStr.replace(/\D/g, "")) || 0)
                              : ""
                          }
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            setDiscountValueStr(raw);
                            setSelectedPresetDiscountId(null);
                          }}
                          placeholder={discountType === "percentage" ? "Ej. 10%" : "Ej. $5.000"}
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      value={discountReason}
                      onChange={(e) => {
                        setDiscountReason(e.target.value);
                        setSelectedPresetDiscountId(null);
                      }}
                      placeholder="Motivo (ej. Adulto Mayor 10%, Estudiante 15%)"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                    />
                  </div>
                )}
              </div>

              {/* BLOQUE PUNTOS DE FIDELIZACIÓN [FID-001] */}
              {customerLoyalty && (
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/60 dark:border-emerald-500/20 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Puntos de Fidelización</span>
                    </label>
                    <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      Saldo: {customerLoyalty.pointsBalance} pts ({formatCOP(customerLoyalty.equivalentMoneyValue)})
                    </span>
                  </div>

                  {customerLoyalty.pointsBalance > 0 ? (
                    <div className="space-y-2 pt-1 border-t border-emerald-100 dark:border-emerald-900/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          ¿Redimir puntos en esta compra?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isRedeemingPoints) {
                              setIsRedeemingPoints(true);
                              const maxDiscountAllowed = Math.round(baseSubtotal * 0.5);
                              const maxPtsByTotal = Math.floor(maxDiscountAllowed / 10);
                              const ptsToRedeem = Math.min(customerLoyalty.pointsBalance, maxPtsByTotal);
                              setRedeemedPointsInput(ptsToRedeem);
                            } else {
                              setIsRedeemingPoints(false);
                              setRedeemedPointsInput(0);
                            }
                          }}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                            isRedeemingPoints
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/80"
                          }`}
                        >
                          {isRedeemingPoints ? "Activo (Quitar)" : "+ Redimir Puntos"}
                        </button>
                      </div>

                      {isRedeemingPoints && (
                        <div className="space-y-1.5 p-2 bg-white/80 dark:bg-black/20 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              Pts a redimir:
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={customerLoyalty.pointsBalance}
                              value={redeemedPointsInput || ""}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                const clamped = Math.min(customerLoyalty.pointsBalance, val);
                                setRedeemedPointsInput(clamped);
                              }}
                              className="w-20 px-2 py-1 text-xs font-mono font-bold rounded border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-black/40 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <div className="flex gap-1">
                              {[50, 100, 200].map((preset) => (
                                preset <= customerLoyalty.pointsBalance && (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setRedeemedPointsInput(preset)}
                                    className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                                  >
                                    {preset}
                                  </button>
                                )
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  const maxDiscountAllowed = Math.round(baseSubtotal * 0.5);
                                  const maxPtsByTotal = Math.floor(maxDiscountAllowed / 10);
                                  const maxUsable = Math.min(customerLoyalty.pointsBalance, maxPtsByTotal);
                                  setRedeemedPointsInput(maxUsable);
                                }}
                                className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-200 cursor-pointer"
                              >
                                Máx
                              </button>
                            </div>
                          </div>
                          {loyaltyDiscountAmount > 0 && (
                            <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              Descuento aplicado: <span className="font-mono font-bold">-{formatCOP(loyaltyDiscountAmount)}</span> (1 pt = $10 COP, máx 50% de la venta)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">
                      El cliente acumulará puntos automáticamente al registrarse este pago.
                    </p>
                  )}
                </div>
              )}

              {/* BLOQUE PROPINA */}
              <div className="p-3 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>Propina voluntaria</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Separada de venta</span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {(["none", "5", "10", "15", "custom"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setTipSelection(opt)}
                      className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                        tipSelection === opt
                          ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 shadow-2xs"
                          : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      {opt === "none" ? "0%" : opt === "custom" ? "Personalizado" : `${opt}%`}
                    </button>
                  ))}
                </div>

                {tipSelection === "custom" && (
                  <div className="pt-1 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={
                        customTipStr
                          ? new Intl.NumberFormat("es-CO").format(Number(customTipStr.replace(/\D/g, "")) || 0)
                          : ""
                      }
                      onChange={(e) => setCustomTipStr(e.target.value.replace(/\D/g, ""))}
                      placeholder="Monto voluntario ($ COP)"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* MODO 1: PAGO ÚNICO */}
            {!isSplit && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Método de pago recibido
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {availableOptions.length} disponibles
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {availableOptions.map((opt) => {
                    const isSel = selectedSingleMethod === opt.code;
                    const isProposed =
                      proposedInfo.proposedMethodCode === opt.code ||
                      (opt.isTransfer && proposedInfo.proposedMethodCode === "transfer");

                    return (
                      <button
                        key={opt.code}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setSelectedSingleMethod(opt.code)}
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-all cursor-pointer relative ${
                          isSel
                            ? "bg-[#ED500A]/10 text-[#ED500A] border-[#ED500A] ring-1 ring-[#ED500A] shadow-2xs"
                            : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <PaymentMethodLogo code={opt.code} size="md" />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold truncate">{opt.name}</span>
                          </div>
                          {opt.destinationValue ? (
                            <p className="text-[10px] text-slate-400 font-mono truncate">
                              {formatDestinationType(opt.destinationType)}: {opt.destinationValue}
                            </p>
                          ) : opt.code === "cash" ? (
                            <p className="text-[10px] text-slate-400 truncate">
                              Contra entrega / caja
                            </p>
                          ) : null}
                        </div>

                        {isProposed && (
                          <span className="absolute top-1 right-1 px-1 py-0.2 rounded text-[8px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300">
                            Cliente
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* SI ES EFECTIVO: CÁLCULO DE VUELTAS / CAMBIO */}
                {selectedSingleMethod === "cash" && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Efectivo recibido del cliente:
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setSingleCashReceivedStr(String(totalToCollect))}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 cursor-pointer"
                        >
                          Exacto
                        </button>
                        {[50000, 100000].map((quick) => (
                          quick > totalToCollect && (
                            <button
                              key={quick}
                              type="button"
                              onClick={() => setSingleCashReceivedStr(String(quick))}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 cursor-pointer"
                            >
                              ${new Intl.NumberFormat("es-CO").format(quick)}
                            </button>
                          )
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                        $
                      </div>
                      <input
                        type="text"
                        value={
                          singleCashReceivedStr
                            ? new Intl.NumberFormat("es-CO").format(Number(singleCashReceivedStr.replace(/\D/g, "")) || 0)
                            : ""
                        }
                        onChange={(e) => setSingleCashReceivedStr(e.target.value.replace(/\D/g, ""))}
                        placeholder="Monto entregado"
                        className="w-full pl-7 pr-3 py-1.5 text-base font-mono font-bold text-slate-900 dark:text-white rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {singleCashChange > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t border-emerald-200/50 dark:border-emerald-500/20">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          Cambio a entregar en efectivo:
                        </span>
                        <span className="text-base font-mono font-black text-emerald-700 dark:text-emerald-400">
                          {formatCOP(singleCashChange)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* [POS-003] SI ES A CRÉDITO: GESTIÓN DE CLIENTE Y CUPO */}
                {selectedSingleMethod === "credit" && (
                  <div className="p-3 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/30 rounded-xl space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>Venta a Crédito (Cartera de Clientes)</span>
                      </span>
                      {selectedCustomerId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(null);
                            setCustomerCreditInfo(null);
                            setCustomerSearchQuery("");
                            setCustomerSearchResults([]);
                          }}
                          className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                          Cambiar cliente
                        </button>
                      )}
                    </div>

                    {/* Si no hay cliente seleccionado o se desea buscar otro */}
                    {!selectedCustomerId ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Selecciona un cliente con cupo de crédito para cargar esta venta:
                        </p>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            value={customerSearchQuery}
                            onChange={(e) => handleCustomerSearch(e.target.value)}
                            placeholder="Buscar por nombre o teléfono..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-purple-200 dark:border-purple-800/40 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                          />
                        </div>

                        {isSearchingCustomers && (
                          <p className="text-[11px] text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Buscando clientes...
                          </p>
                        )}

                        {customerSearchResults.length > 0 && (
                          <div className="divide-y divide-slate-100 dark:divide-white/5 border border-purple-100 dark:border-purple-900/40 rounded-lg overflow-hidden max-h-36 overflow-y-auto bg-white dark:bg-[#12151f]">
                            {customerSearchResults.map((cust) => (
                              <button
                                key={cust.id}
                                type="button"
                                onClick={() => handleSelectCustomerForCredit(cust)}
                                className="w-full text-left p-2 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors flex items-center justify-between text-xs cursor-pointer"
                              >
                                <div>
                                  <p className="font-bold text-slate-900 dark:text-white">{cust.fullName}</p>
                                  <p className="text-[10px] text-slate-500">{cust.phone || "Sin teléfono"}</p>
                                </div>
                                {cust.hasCredit ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                                    Cupo: {formatCOP(cust.creditAvailable || 0)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-100 dark:bg-white/10 text-slate-500">
                                    Sin crédito
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {/* Ficha del cliente y estado de crédito */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-white/5 border border-purple-100 dark:border-purple-800/20">
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {customerCreditInfo?.fullName || "Cliente"}
                            </p>
                            <p className="text-[10px] text-slate-500">{customerCreditInfo?.phone || "Sin teléfono"}</p>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              customerCreditInfo?.hasCredit
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300"
                            }`}
                          >
                            {customerCreditInfo?.hasCredit ? "Crédito habilitado" : "Sin crédito"}
                          </span>
                        </div>

                        {/* Indicadores de cupo */}
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="p-1.5 rounded-lg bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-900/30">
                            <span className="text-[9px] text-slate-500 block uppercase">Cupo total</span>
                            <span className="text-[11px] font-mono font-bold text-slate-900 dark:text-white">
                              {formatCOP(customerCreditInfo?.creditLimit || 0)}
                            </span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-900/30">
                            <span className="text-[9px] text-slate-500 block uppercase">Usado</span>
                            <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                              {formatCOP(customerCreditInfo?.creditUsed || 0)}
                            </span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-purple-100/70 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700/40">
                            <span className="text-[9px] text-purple-800 dark:text-purple-300 block uppercase font-bold">Disponible</span>
                            <span className="text-[11px] font-mono font-bold text-purple-700 dark:text-purple-300">
                              {formatCOP(customerCreditInfo?.creditAvailable || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Criterio 1: Cliente sin crédito autorizado */}
                        {customerCreditInfo && !customerCreditInfo.hasCredit && (
                          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 flex items-start gap-2 text-rose-800 dark:text-rose-300">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                            <div className="text-[11px]">
                              <p className="font-bold">Cliente sin crédito habilitado</p>
                              <p>El cliente «{customerCreditInfo.fullName}» no tiene cupo de crédito autorizado.</p>
                            </div>
                          </div>
                        )}

                        {/* Criterio 2: Cupo insuficiente */}
                        {customerCreditInfo &&
                          customerCreditInfo.hasCredit &&
                          totalToCollect > (customerCreditInfo.creditAvailable || 0) && (
                            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-start gap-2 text-amber-800 dark:text-amber-300">
                              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                              <div className="text-[11px]">
                                <p className="font-bold">Cupo de crédito insuficiente</p>
                                <p>
                                  Disponible: {formatCOP(customerCreditInfo.creditAvailable || 0)} | Total venta:{" "}
                                  {formatCOP(totalToCollect)}.
                                </p>
                              </div>
                            </div>
                          )}

                        {/* Selector de plazo */}
                        <div className="pt-1 flex items-center justify-between text-xs">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Plazo de vencimiento:
                          </span>
                          <div className="flex gap-1">
                            {[15, 30, 45, 60].map((days) => (
                              <button
                                key={days}
                                type="button"
                                onClick={() => setCreditDueDays(days)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                  creditDueDays === days
                                    ? "bg-purple-600 text-white shadow-2xs"
                                    : "bg-white dark:bg-white/5 border border-purple-200 dark:border-purple-800/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100/50"
                                }`}
                              >
                                {days}d
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* MODO 2: DIVIDIR PAGO EN MÚLTIPLES MÉTODOS [POS-002] */}
            {isSplit && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Desglose por método
                    </label>
                    {isSplitFullyCovered ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Pago completo</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                        <span>Faltan {formatCOP(splitRemaining)}</span>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSplitLine}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#ED500A]/10 text-[#ED500A] hover:bg-[#ED500A]/20 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar método</span>
                  </button>
                </div>

                {/* LISTA DE MÉTODOS DIVIDIDOS */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {splitLines.map((line, idx) => {
                    const isCash = line.method === "cash";
                    return (
                      <div
                        key={line.id}
                        className="p-3 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          {/* SELECTOR DE MÉTODO */}
                          <div className="w-44 shrink-0">
                            <select
                              value={line.method}
                              onChange={(e) => handleUpdateSplitLine(line.id, { method: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                            >
                              {availableOptions.map((opt) => (
                                <option key={opt.code} value={opt.code}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* MONTO ASIGNADO AL MÉTODO */}
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                              $
                            </div>
                            <input
                              type="text"
                              value={
                                line.amount
                                  ? new Intl.NumberFormat("es-CO").format(line.amount)
                                  : ""
                              }
                              onChange={(e) => {
                                const raw = Number(e.target.value.replace(/\D/g, "")) || 0;
                                handleUpdateSplitLine(line.id, { amount: raw });
                              }}
                              placeholder="0"
                              className="w-full pl-6 pr-2 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                            />
                          </div>

                          {/* BOTÓN ELIMINAR LÍNEA */}
                          {splitLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSplitLine(line.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Eliminar método"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* SI ES EFECTIVO: PAGA CON Y CAMBIO */}
                        {isCash && (
                          <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs gap-2">
                            <span className="text-[11px] text-slate-500">Paga en efectivo con:</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={
                                  line.receivedAmount
                                    ? new Intl.NumberFormat("es-CO").format(line.receivedAmount)
                                    : ""
                                }
                                onChange={(e) => {
                                  const raw = Number(e.target.value.replace(/\D/g, "")) || 0;
                                  handleUpdateSplitLine(line.id, { receivedAmount: raw });
                                }}
                                placeholder={formatCOP(line.amount)}
                                className="w-28 px-2 py-1 text-xs font-mono font-bold rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                              />
                              {line.receivedAmount && line.receivedAmount > line.amount && (
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                  Cambio: {formatCOP(line.receivedAmount - line.amount)}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* BARRA DE PROGRESO DE COBERTURA */}
                <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Total Cubierto:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatCOP(totalSplitCovered)} / {formatCOP(totalToCollect)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isSplitFullyCovered ? "bg-emerald-500" : "bg-[#ED500A]"
                      }`}
                      style={{
                        width: `${Math.min(100, (totalSplitCovered / (totalToCollect || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div>
              {finalCashChange > 0 && (
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-mono">
                  <Banknote className="w-4 h-4" />
                  <span>Cambio en efectivo: {formatCOP(finalCashChange)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={!canConfirm}
                onClick={handleConfirmSubmit}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed min-h-[44px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registrando pago...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Cobro · {formatCOP(totalToCollect)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
