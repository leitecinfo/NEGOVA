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
  Split,
  CreditCard,
  Banknote,
  UtensilsCrossed,
  User,
  Receipt,
  AlertCircle,
  Armchair,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  RestaurantTableWithOrder,
  RestaurantOrderWithDetails,
  ProcessOrderPaymentInput,
  SplitPaymentItem,
  PRESET_TABLE_DISCOUNTS,
  PRESET_TIP_PERCENTAGES,
} from "@/lib/restaurant/types";
import {
  getTableActiveOrderDetailsAction,
  closeTableOrderWithPaymentAction,
} from "@/app/workspace/[businessId]/mesas/actions";

interface CloseTableOrderModalProps {
  isOpen: boolean;
  businessId: string;
  occupiedTables: RestaurantTableWithOrder[];
  initialTableId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface SplitPaymentRow {
  id: string;
  method: "cash" | "card" | "transfer";
  amount: number;
  receivedAmount?: number;
}

const PAYMENT_METHOD_OPTIONS = [
  { code: "cash" as const, label: "Efectivo" },
  { code: "card" as const, label: "Tarjeta / Datáfono" },
  { code: "transfer" as const, label: "Transferencia / Nequi / QR" },
];

export function CloseTableOrderModal({
  isOpen,
  businessId,
  occupiedTables,
  initialTableId,
  onClose,
  onSuccess,
}: CloseTableOrderModalProps) {
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [orderDetails, setOrderDetails] = useState<RestaurantOrderWithDetails | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Descuentos preestablecidos o personalizados [MES-003]
  const [discountMode, setDiscountMode] = useState<"none" | "preset" | "custom">("none");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("senior_10");
  const [customDiscountType, setCustomDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [customDiscountValueStr, setCustomDiscountValueStr] = useState<string>("");
  const [customDiscountReason, setCustomDiscountReason] = useState<string>("");

  // Propinas (5%, 10%, 15% o personalizado) [MES-003]
  const [tipMode, setTipMode] = useState<"none" | "5" | "10" | "15" | "custom">("none");
  const [customTipAmountStr, setCustomTipAmountStr] = useState<string>("");

  // Pagos múltiples vs Pago único [MES-003]
  const [isSplitPayment, setIsSplitPayment] = useState<boolean>(false);
  const [singleMethod, setSingleMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [singleCashReceivedStr, setSingleCashReceivedStr] = useState<string>("");
  const [splitRows, setSplitRows] = useState<SplitPaymentRow[]>([]);

  const formatCOP = (val: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);

  // Inicializar mesa seleccionada al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const targetId =
        initialTableId && occupiedTables.some((t) => t.id === initialTableId)
          ? initialTableId
          : occupiedTables[0]?.id || "";
      setSelectedTableId(targetId);
      setDiscountMode("none");
      setSelectedPresetId("senior_10");
      setCustomDiscountType("percentage");
      setCustomDiscountValueStr("");
      setCustomDiscountReason("");
      setTipMode("none");
      setCustomTipAmountStr("");
      setIsSplitPayment(false);
      setSingleMethod("cash");
      setErrorMessage(null);
    }
  }, [isOpen, initialTableId, occupiedTables]);

  const selectedTable = useMemo(
    () => occupiedTables.find((t) => t.id === selectedTableId) || null,
    [occupiedTables, selectedTableId]
  );

  // Cargar detalle de la orden activa cuando cambia la mesa seleccionada
  useEffect(() => {
    if (!isOpen || !selectedTable?.activeOrder?.id) {
      setOrderDetails(null);
      return;
    }

    let cancelled = false;
    setIsLoadingOrder(true);
    setErrorMessage(null);

    getTableActiveOrderDetailsAction(businessId, selectedTable.activeOrder.id)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.order) {
          setOrderDetails(res.order);
        } else {
          setOrderDetails(null);
        }
      })
      .catch(() => {
        if (!cancelled) setOrderDetails(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOrder(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, businessId, selectedTable?.activeOrder?.id]);

  // Cálculos matemáticos de subtotal, descuento, propina y total a cobrar
  const baseSubtotal = useMemo(() => {
    if (orderDetails) {
      return Number(orderDetails.subtotal || orderDetails.total || 0);
    }
    return Number(selectedTable?.activeOrder?.total || 0);
  }, [orderDetails, selectedTable]);

  const taxTotal = Number(orderDetails?.tax_total || 0);
  const deliveryFee = Number(orderDetails?.delivery_fee || 0);

  const activePreset = useMemo(
    () => PRESET_TABLE_DISCOUNTS.find((p) => p.id === selectedPresetId) || PRESET_TABLE_DISCOUNTS[0],
    [selectedPresetId]
  );

  const discountCalculation = useMemo(() => {
    if (discountMode === "none") {
      return { amount: 0, percentage: 0, reason: "" };
    }
    if (discountMode === "preset" && activePreset) {
      const amount = Math.round(baseSubtotal * (activePreset.percentage / 100));
      return {
        amount,
        percentage: activePreset.percentage,
        reason: activePreset.reason,
      };
    }
    const val = Number(customDiscountValueStr.replace(/\D/g, "")) || 0;
    if (val <= 0) {
      return { amount: 0, percentage: 0, reason: customDiscountReason.trim() };
    }
    if (customDiscountType === "percentage") {
      const pct = Math.min(100, val);
      return {
        amount: Math.round(baseSubtotal * (pct / 100)),
        percentage: pct,
        reason: customDiscountReason.trim() || `Descuento ${pct}%`,
      };
    }
    return {
      amount: Math.min(baseSubtotal, val),
      percentage: 0,
      reason: customDiscountReason.trim() || "Descuento fijo",
    };
  }, [discountMode, activePreset, baseSubtotal, customDiscountType, customDiscountValueStr, customDiscountReason]);

  const netSaleTotal = Math.max(
    0,
    baseSubtotal - discountCalculation.amount + taxTotal + deliveryFee
  );

  const tipCalculation = useMemo(() => {
    if (tipMode === "none") {
      return { amount: 0, percentage: undefined as number | undefined };
    }
    if (tipMode === "5" || tipMode === "10" || tipMode === "15") {
      const pct = Number(tipMode);
      return {
        amount: Math.round(netSaleTotal * (pct / 100)),
        percentage: pct,
      };
    }
    const customAmt = Number(customTipAmountStr.replace(/\D/g, "")) || 0;
    return {
      amount: customAmt,
      percentage: undefined,
    };
  }, [tipMode, netSaleTotal, customTipAmountStr]);

  const totalToCollect = netSaleTotal + tipCalculation.amount;

  // Sincronizar montos sugeridos cuando cambia totalToCollect
  useEffect(() => {
    setSingleCashReceivedStr(String(totalToCollect));
    if (isSplitPayment) {
      const half = Math.floor(totalToCollect / 2);
      const remainder = totalToCollect - half;
      setSplitRows([
        { id: "split-1", method: "cash", amount: half },
        { id: "split-2", method: "card", amount: remainder },
      ]);
    }
  }, [totalToCollect, isSplitPayment]);

  const totalSplitCovered = useMemo(
    () => splitRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [splitRows]
  );

  const splitDifference = totalToCollect - totalSplitCovered;
  const isSplitValid = splitRows.length > 0 && totalSplitCovered >= totalToCollect;

  const singleCashReceived = Number(singleCashReceivedStr.replace(/\D/g, "")) || 0;
  const singleCashChange =
    !isSplitPayment && singleMethod === "cash" && singleCashReceived > totalToCollect
      ? singleCashReceived - totalToCollect
      : 0;

  const canConfirm = useMemo(() => {
    if (isSubmitting || !selectedTableId || !selectedTable?.activeOrder) return false;
    if (!isSplitPayment) {
      if (singleMethod === "cash") {
        return singleCashReceived >= totalToCollect;
      }
      return true;
    }
    return isSplitValid;
  }, [
    isSubmitting,
    selectedTableId,
    selectedTable,
    isSplitPayment,
    singleMethod,
    singleCashReceived,
    totalToCollect,
    isSplitValid,
  ]);

  if (!isOpen) return null;

  const handleAddSplitRow = () => {
    const used = new Set(splitRows.map((r) => r.method));
    const nextMethod =
      PAYMENT_METHOD_OPTIONS.find((m) => !used.has(m.code))?.code || "transfer";
    setSplitRows((prev) => [
      ...prev,
      {
        id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        method: nextMethod,
        amount: Math.max(0, splitDifference),
      },
    ]);
  };

  const handleUpdateSplitRow = (id: string, patch: Partial<SplitPaymentRow>) => {
    setSplitRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleRemoveSplitRow = (id: string) => {
    setSplitRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleConfirmPayment = async () => {
    if (!canConfirm || !selectedTable) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const splitItems: SplitPaymentItem[] | undefined = isSplitPayment
        ? splitRows.map((r) => ({
            method: r.method,
            amount: Number(r.amount) || 0,
            receivedAmount: r.receivedAmount,
          }))
        : undefined;

      const payload: ProcessOrderPaymentInput = {
        paymentMethod: isSplitPayment ? splitRows[0]?.method || "cash" : singleMethod,
        isSplit: isSplitPayment,
        splitPayments: splitItems,
        discount:
          discountCalculation.amount > 0
            ? {
                type: discountMode === "custom" ? customDiscountType : "percentage",
                value:
                  discountMode === "preset"
                    ? activePreset.percentage
                    : Number(customDiscountValueStr.replace(/\D/g, "")) || 0,
                amount: discountCalculation.amount,
                presetId: discountMode === "preset" ? activePreset.id : undefined,
                reason: discountCalculation.reason,
              }
            : undefined,
        tip:
          tipCalculation.amount > 0
            ? {
                amount: tipCalculation.amount,
                percentage: tipCalculation.percentage,
              }
            : undefined,
        cashChange: singleCashChange > 0 ? singleCashChange : undefined,
        closeTableOrder: true,
      };

      const res = await closeTableOrderWithPaymentAction(
        businessId,
        selectedTable.id,
        payload
      );

      if (!res.success) {
        setErrorMessage(res.error || "No se pudo confirmar el cobro de la mesa.");
        toast.error(res.error || "Error al cobrar la mesa.");
        return;
      }

      toast.success(
        `Pago confirmado en «${selectedTable.name_or_number}» (${formatCOP(
          totalToCollect
        )}). La mesa ha quedado libre automáticamente.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || "Error inesperado al procesar el cobro de la mesa.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-xs animate-in fade-in duration-150 font-body">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* CABECERA */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                  Cerrar Órdenes y Cobrar Mesa
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecciona la mesa ocupada, aplica descuentos o propina y confirma el pago para liberarla
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CUERPO SCROLLABLE */}
          <div className="p-5 space-y-5 overflow-y-auto">
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {occupiedTables.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Armchair className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No hay mesas ocupadas pendientes de cobro
                </p>
                <p className="text-xs text-slate-500">
                  Todas las mesas del salón se encuentran libres actualmente.
                </p>
              </div>
            ) : (
              <>
                {/* 1. SELECCIONAR MESA Y VER TOTAL */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Seleccionar Mesa a Cerrar ({occupiedTables.length}{" "}
                        {occupiedTables.length === 1 ? "ocupada" : "ocupadas"})
                      </label>
                      <select
                        value={selectedTableId}
                        onChange={(e) => setSelectedTableId(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
                      >
                        {occupiedTables.map((tbl) => (
                          <option key={tbl.id} value={tbl.id}>
                            {tbl.name_or_number}
                            {tbl.roomName ? ` (${tbl.roomName})` : ""} — Comanda #
                            {tbl.activeOrder?.order_number} · {formatCOP(tbl.activeOrder?.total || 0)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Subtotal Comanda
                      </span>
                      <span className="text-xl font-mono font-black text-slate-900 dark:text-white">
                        {formatCOP(baseSubtotal)}
                      </span>
                    </div>
                  </div>

                  {/* Detalle resumido de productos de la mesa */}
                  {isLoadingOrder ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ED500A]" />
                      <span>Cargando detalle de consumo de la mesa...</span>
                    </div>
                  ) : orderDetails?.items && orderDetails.items.length > 0 ? (
                    <div className="pt-2 border-t border-slate-200/70 dark:border-white/5 space-y-1 max-h-28 overflow-y-auto pr-1">
                      {orderDetails.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300"
                        >
                          <span className="truncate pr-2">
                            <strong className="font-mono">{item.quantity}x</strong> {item.product_name}
                          </span>
                          <span className="font-mono font-semibold shrink-0">
                            {formatCOP(Number(item.subtotal || 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : selectedTable?.activeOrder ? (
                    <div className="pt-2 border-t border-slate-200/70 dark:border-white/5 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{selectedTable.activeOrder.customer_name || "Comensal de mesa"}</span>
                      </span>
                      <span>
                        {selectedTable.activeOrder.items_count}{" "}
                        {selectedTable.activeOrder.items_count === 1 ? "artículo" : "artículos"}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* 2. DESCUENTOS PREESTABLECIDOS Y PROPINAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* DESCUENTOS PREESTABLECIDOS */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-[#ED500A]" />
                        <span>Descuentos Preestablecidos</span>
                      </label>
                      {discountCalculation.amount > 0 && (
                        <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                          -{formatCOP(discountCalculation.amount)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDiscountMode("none")}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          discountMode === "none"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent"
                            : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                        }`}
                      >
                        Sin descuento
                      </button>

                      {PRESET_TABLE_DISCOUNTS.map((preset) => {
                        const isSelected =
                          discountMode === "preset" && selectedPresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setDiscountMode("preset");
                              setSelectedPresetId(preset.id);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[#ED500A]/15 border-[#ED500A] text-[#ED500A] shadow-2xs"
                                : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setDiscountMode("custom")}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          discountMode === "custom"
                            ? "bg-[#ED500A]/15 border-[#ED500A] text-[#ED500A]"
                            : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                        }`}
                      >
                        Otro % / $
                      </button>
                    </div>

                    {discountMode === "custom" && (
                      <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                        <div className="flex gap-1.5">
                          <select
                            value={customDiscountType}
                            onChange={(e) =>
                              setCustomDiscountType(e.target.value as "percentage" | "fixed")
                            }
                            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white"
                          >
                            <option value="percentage">% Porcentaje</option>
                            <option value="fixed">$ Valor fijo</option>
                          </select>
                          <input
                            type="text"
                            value={customDiscountValueStr}
                            onChange={(e) =>
                              setCustomDiscountValueStr(e.target.value.replace(/\D/g, ""))
                            }
                            placeholder={customDiscountType === "percentage" ? "Ej. 10" : "Ej. 5000"}
                            className="flex-1 px-3 py-1.5 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                          />
                        </div>
                        <input
                          type="text"
                          value={customDiscountReason}
                          onChange={(e) => setCustomDiscountReason(e.target.value)}
                          placeholder="Motivo del descuento..."
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* PROPINAS (5%, 10%, 15% O PERSONALIZADO) */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                        <span>Propina Voluntaria</span>
                      </label>
                      {tipCalculation.amount > 0 ? (
                        <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                          +{formatCOP(tipCalculation.amount)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Separada en reportes</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTipMode("none")}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          tipMode === "none"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent"
                            : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                        }`}
                      >
                        Sin propina
                      </button>

                      {PRESET_TIP_PERCENTAGES.map((pct) => {
                        const modeKey = String(pct) as "5" | "10" | "15";
                        const isSelected = tipMode === modeKey;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setTipMode(modeKey)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-2xs"
                                : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                            }`}
                          >
                            {pct}%
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setTipMode("custom")}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          tipMode === "custom"
                            ? "bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400"
                            : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                        }`}
                      >
                        Personalizado
                      </button>
                    </div>

                    {tipMode === "custom" && (
                      <div className="pt-1 animate-in fade-in duration-150">
                        <input
                          type="text"
                          value={
                            customTipAmountStr
                              ? new Intl.NumberFormat("es-CO").format(
                                  Number(customTipAmountStr.replace(/\D/g, "")) || 0
                                )
                              : ""
                          }
                          onChange={(e) =>
                            setCustomTipAmountStr(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="Valor de propina ($ COP)"
                          className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                        />
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      La propina se calcula sobre la venta neta ({formatCOP(netSaleTotal)}) y se registra por separado en los reportes.
                    </p>
                  </div>
                </div>

                {/* 3. RESUMEN DE LIQUIDACIÓN DE LA MESA */}
                <div className="p-4 rounded-2xl bg-slate-900 dark:bg-white/[0.04] text-white border border-slate-800 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Subtotal de la mesa:</span>
                    <span className="font-mono">{formatCOP(baseSubtotal)}</span>
                  </div>

                  {discountCalculation.amount > 0 && (
                    <div className="flex items-center justify-between text-xs text-amber-400">
                      <span>Descuento ({discountCalculation.reason}):</span>
                      <span className="font-mono font-bold">
                        -{formatCOP(discountCalculation.amount)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Venta neta (registrada en ventas):</span>
                    <span className="font-mono font-semibold">{formatCOP(netSaleTotal)}</span>
                  </div>

                  {tipCalculation.amount > 0 && (
                    <div className="flex items-center justify-between text-xs text-blue-400">
                      <span>
                        Propina voluntaria
                        {tipCalculation.percentage ? ` (${tipCalculation.percentage}%)` : ""} (separada en reportes):
                      </span>
                      <span className="font-mono font-bold">
                        +{formatCOP(tipCalculation.amount)}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/10 flex items-baseline justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                      Total a Pagar
                    </span>
                    <span className="text-2xl font-mono font-black text-[#ED500A]">
                      {formatCOP(totalToCollect)}
                    </span>
                  </div>
                </div>

                {/* 4. MODALIDAD DE PAGO: ÚNICO VS PAGOS MÚLTIPLES (MIXTO) */}
                <div className="space-y-3">
                  <div className="flex items-center p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200/70 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsSplitPayment(false)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        !isSplitPayment
                          ? "bg-white dark:bg-[#0D0F16] text-[#ED500A] shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pago Único</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsSplitPayment(true)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSplitPayment
                          ? "bg-white dark:bg-[#0D0F16] text-[#ED500A] shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <Split className="w-3.5 h-3.5" />
                      <span>Pagos Múltiples (Pago Mixto)</span>
                    </button>
                  </div>

                  {!isSplitPayment ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {PAYMENT_METHOD_OPTIONS.map((opt) => (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => setSingleMethod(opt.code)}
                            className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer text-center ${
                              singleMethod === opt.code
                                ? "bg-[#ED500A]/10 border-[#ED500A] text-[#ED500A] ring-1 ring-[#ED500A]"
                                : "bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {singleMethod === "cash" && (
                        <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                              Efectivo recibido ($ COP):
                            </span>
                            <input
                              type="text"
                              value={
                                singleCashReceivedStr
                                  ? new Intl.NumberFormat("es-CO").format(
                                      Number(singleCashReceivedStr.replace(/\D/g, "")) || 0
                                    )
                                  : ""
                              }
                              onChange={(e) =>
                                setSingleCashReceivedStr(e.target.value.replace(/\D/g, ""))
                              }
                              className="w-full px-3 py-1.5 text-sm font-mono font-bold rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white"
                            />
                          </div>

                          {singleCashChange > 0 && (
                            <div className="sm:text-right">
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block">
                                Cambio a devolver:
                              </span>
                              <span className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-400">
                                {formatCOP(singleCashChange)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* PAGOS MÚLTIPLES (MIXTO) */
                    <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Distribución del pago mixto
                        </span>
                        <button
                          type="button"
                          onClick={handleAddSplitRow}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#ED500A]/10 text-[#ED500A] hover:bg-[#ED500A]/20 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar método</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {splitRows.map((row) => (
                          <div
                            key={row.id}
                            className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/10"
                          >
                            <select
                              value={row.method}
                              onChange={(e) =>
                                handleUpdateSplitRow(row.id, {
                                  method: e.target.value as "cash" | "card" | "transfer",
                                })
                              }
                              className="w-48 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                            >
                              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                                <option key={opt.code} value={opt.code}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>

                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                $
                              </span>
                              <input
                                type="text"
                                value={
                                  row.amount
                                    ? new Intl.NumberFormat("es-CO").format(row.amount)
                                    : ""
                                }
                                onChange={(e) => {
                                  const raw = Number(e.target.value.replace(/\D/g, "")) || 0;
                                  handleUpdateSplitRow(row.id, { amount: raw });
                                }}
                                placeholder="0"
                                className="w-full pl-6 pr-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                              />
                            </div>

                            {splitRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSplitRow(row.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                title="Quitar línea"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-white/5 text-xs">
                        <span className="text-slate-500">
                          Cubierto:{" "}
                          <strong className="font-mono text-slate-900 dark:text-white">
                            {formatCOP(totalSplitCovered)}
                          </strong>{" "}
                          de {formatCOP(totalToCollect)}
                        </span>
                        {splitDifference > 0 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            Faltan {formatCOP(splitDifference)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Total cubierto</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* PIE CON BOTÓN "CONFIRMAR PAGO" */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {selectedTable && (
                <span>
                  Al confirmar, <strong>{selectedTable.name_or_number}</strong> quedará{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">Libre</strong> automáticamente.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={!canConfirm}
                onClick={handleConfirmPayment}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-md shadow-[#ED500A]/20 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirmando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Pago · {formatCOP(totalToCollect)}</span>
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

