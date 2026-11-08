"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Bike,
  MapPin,
  Phone,
  User,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Package,
  ChevronRight,
  RefreshCw,
  MessageSquare,
  Lock,
  ArrowLeft,
  Navigation,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  getDriverOrdersByTokenAction,
  confirmDeliveryByTokenAction,
} from "./actions";

interface DriverSessionPortalClientProps {
  token: string;
  initialBusinessName: string;
  initialDriverName: string;
  initialExpiresAt: string;
}

interface PinPadInputProps {
  digits: string[];
  onChange: (digits: string[]) => void;
  disabled?: boolean;
  hasError?: boolean;
}

function PinPadInput({ digits, onChange, disabled, hasError }: PinPadInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const onlyDigits = rawVal.replace(/\D/g, "");

    // Si se pegan o introducen múltiples dígitos a la vez en una sola casilla
    if (onlyDigits.length > 1) {
      const next = [...digits];
      for (let i = 0; i < 4; i++) {
        const offset = i - index;
        if (offset >= 0 && offset < onlyDigits.length) {
          next[i] = onlyDigits[offset];
        }
      }
      onChange(next);
      const nextFocus = Math.min(index + onlyDigits.length, 3);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = onlyDigits.slice(-1);
    onChange(next);

    if (onlyDigits.length > 0 && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        e.preventDefault();
        const next = [...digits];
        next[index - 1] = "";
        onChange(next);
        inputRefs.current[index - 1]?.focus();
      } else if (digits[index]) {
        e.preventDefault();
        const next = [...digits];
        next[index] = "";
        onChange(next);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 3) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;

    const next = ["", "", "", ""];
    for (let i = 0; i < pasted.length && i < 4; i++) {
      next[i] = pasted[i];
    }
    onChange(next);
    const targetIdx = Math.min(pasted.length - 1, 3);
    inputRefs.current[targetIdx]?.focus();
  };

  return (
    <div
      className="flex items-center justify-center gap-2.5 sm:gap-3 py-2"
      role="group"
      aria-label="PIN numérico de entrega de 4 dígitos"
    >
      {[0, 1, 2, 3].map((idx) => {
        const val = digits[idx] || "";
        return (
          <input
            key={idx}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={val}
            disabled={disabled}
            aria-label={`Dígito ${idx + 1} de 4 del PIN de confirmación`}
            onChange={(e) => handleDigitChange(idx, e)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`w-14 h-16 sm:w-16 sm:h-16 text-center text-2xl font-bold font-mono rounded-xl border transition-all outline-hidden ${
              hasError
                ? "border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20 text-red-900 dark:text-red-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                : val
                ? "border-primary/60 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white ring-2 ring-primary/20 shadow-xs"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          />
        );
      })}
    </div>
  );
}

export function DriverSessionPortalClient({
  token,
  initialBusinessName,
  initialDriverName,
  initialExpiresAt,
}: DriverSessionPortalClientProps) {
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [driverName, setDriverName] = useState(initialDriverName);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);

  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionRevoked, setIsSessionRevoked] = useState(false);
  const [sessionErrorMsg, setSessionErrorMsg] = useState<string | null>(null);

  // Orden seleccionada para ver el detalle / ficha completa
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Estado del PIN pad y confirmación en la ficha del pedido
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [deliveryErrorMsg, setDeliveryErrorMsg] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isDeliverySuccess, setIsDeliverySuccess] = useState(false);

  const [isPending, startTransition] = useTransition();

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const loadOrders = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await getDriverOrdersByTokenAction(token);
      if (res.success) {
        if (res.businessName) setBusinessName(res.businessName);
        if (res.driverName) setDriverName(res.driverName);
        if (res.expiresAt) setExpiresAt(res.expiresAt);
        setPendingOrders(res.pendingOrders || []);
        setCompletedOrders(res.completedOrders || []);
        setIsSessionRevoked(false);
        setSessionErrorMsg(null);
      } else {
        if (
          res.error?.includes("revocado") ||
          res.error?.includes("vencido") ||
          res.error?.includes("expirado") ||
          res.error?.includes("no disponible")
        ) {
          setIsSessionRevoked(true);
          setSessionErrorMsg(res.error);
        } else {
          toast.error(res.error || "No se pudieron actualizar los pedidos.");
        }
      }
    } catch {
      toast.error("Error de conexión al cargar entregas.");
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // Auto-recarga discreta cada 45 segundos
    const timer = setInterval(() => {
      loadOrders(true);
    }, 45000);
    return () => clearInterval(timer);
  }, [token]);

  // Selección de pedido para ver ficha
  const handleSelectOrder = (order: any) => {
    setSelectedOrder(order);
    setPinDigits(["", "", "", ""]);
    setDeliveryErrorMsg(null);
    setRemainingAttempts(order?.attemptsRemaining ?? null);
    setIsDeliverySuccess(false);
  };

  // Manejar confirmación de entrega desde la ficha con PIN
  const handleConfirmDelivery = async () => {
    if (!selectedOrder || isSubmittingDelivery) return;

    const enteredPin = pinDigits.join("").trim();

    if (selectedOrder.hasVerificationCode && enteredPin.length !== 4) {
      setDeliveryErrorMsg("Ingresa los 4 dígitos del código que te proporcionó el cliente.");
      return;
    }

    setIsSubmittingDelivery(true);
    setDeliveryErrorMsg(null);

    try {
      const res = await confirmDeliveryByTokenAction(
        token,
        selectedOrder.id,
        enteredPin
      );

      if (res.success) {
        toast.success(`¡Pedido #${selectedOrder.orderNumber} entregado con éxito!`);
        setIsDeliverySuccess(true);
        setTimeout(async () => {
          setSelectedOrder(null);
          setIsDeliverySuccess(false);
          setPinDigits(["", "", "", ""]);
          setDeliveryErrorMsg(null);
          await loadOrders(true);
        }, 1200);
      } else {
        setDeliveryErrorMsg(res.error || "Código o verificación no válida.");
        if (res.remainingAttempts !== undefined) {
          setRemainingAttempts(res.remainingAttempts);
        }
      }
    } catch {
      setDeliveryErrorMsg("Error de red al registrar entrega. Intenta nuevamente.");
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  // Si la sesión expiró o fue revocada
  if (isSessionRevoked) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-xs text-center space-y-4 animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-semibold text-neutral-900 dark:text-white">
              Enlace de Reparto no Disponible
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {sessionErrorMsg ||
                "Este enlace de reparto ha expirado o fue revocado por el restaurante. Si tienes entregas pendientes, solicita un nuevo enlace al comercio."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsSessionRevoked(false);
              loadOrders();
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl transition-colors cursor-pointer w-full"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Intentar nuevamente</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans max-w-md mx-auto relative border-x border-neutral-200/80 dark:border-neutral-800 shadow-sm">
      {/* HEADER MÓVIL SEGURO */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-neutral-900 dark:text-white truncate">{businessName}</h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium truncate flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Repartidor: {driverName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadOrders()}
            disabled={isLoading}
            className="p-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Actualizar pedidos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>

        {/* PESTAÑAS MÓVILES */}
        <div className="grid grid-cols-2 gap-1.5 mt-3.5 p-1 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/80 dark:border-neutral-700/50">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "pending"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs font-bold"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Por Entregar</span>
            {pendingOrders.length > 0 && (
              <span
                className={`px-1.5 py-0.2 text-[10px] font-extrabold rounded-full ${
                  activeTab === "pending"
                    ? "bg-primary/10 text-primary"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                }`}
              >
                {pendingOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "history"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs font-bold"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Historial</span>
            {completedOrders.length > 0 && (
              <span
                className={`px-1.5 py-0.2 text-[10px] font-extrabold rounded-full ${
                  activeTab === "history"
                    ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-400"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                }`}
              >
                {completedOrders.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-4 pb-20 space-y-3">
        {activeTab === "pending" ? (
          pendingOrders.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-12 text-center shadow-xs my-6">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">¡Todo entregado!</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                No tienes pedidos pendientes de entrega asignados en este momento.
              </p>
            </div>
          ) : (
            pendingOrders.map((order) => {
              const isPaid = order.paymentStatus === "paid";
              const isOnTheWay = order.deliveryStatus === "on_the_way";

              return (
                <div
                  key={order.id}
                  onClick={() => handleSelectOrder(order)}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 rounded-2xl p-4 shadow-xs space-y-3 transition-all cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-neutral-900 dark:text-white">
                        Pedido #{order.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isOnTheWay
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/50"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800/50"
                        }`}
                      >
                        {isOnTheWay ? "🛵 En camino" : "Asignado"}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-neutral-900 dark:text-white">
                        {formatCOP(order.total)}
                      </span>
                    </div>
                  </div>

                  {/* Nombre y Dirección */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">{order.customerName}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/30 p-2 rounded-xl">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{order.deliveryAddress}</span>
                    </div>
                  </div>

                  {/* Indicador de cobro */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-md text-[10px] border ${
                        isPaid
                          ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-800/50"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/40 font-bold"
                      }`}
                    >
                      {isPaid ? "✓ Ya pagado" : `Cobrar: ${formatCOP(order.total)}`}
                    </span>

                    <span className="text-xs font-semibold text-primary hover:text-primary/90 flex items-center gap-1">
                      <span>Ver entrega</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* HISTORIAL DE ENTREGAS COMPLETADAS */
          completedOrders.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-12 text-center shadow-xs my-6">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Sin entregas completadas</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                Los pedidos que entregues durante esta sesión aparecerán aquí.
              </p>
            </div>
          ) : (
            completedOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => handleSelectOrder(order)}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 rounded-xl p-3.5 space-y-2 text-xs cursor-pointer shadow-xs transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="font-bold text-neutral-900 dark:text-white">Pedido #{order.orderNumber}</span>
                    <span className="text-[10px] text-green-700 dark:text-green-400 font-semibold px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50">
                      Entregado
                    </span>
                  </div>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300 font-semibold">
                    {formatCOP(order.total)}
                  </span>
                </div>
                <div className="text-neutral-500 dark:text-neutral-400 text-[11px] truncate">{order.deliveryAddress}</div>
              </div>
            ))
          )
        )}
      </main>

      {/* MODAL / FICHA DETALLADA DE ENTREGA (Usando ModalPortal) */}
      {selectedOrder && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-t-3xl sm:rounded-2xl w-full max-w-md mx-auto max-h-[92vh] flex flex-col overflow-hidden text-neutral-900 dark:text-white shadow-2xl">
              {/* Cabecera de la ficha */}
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                      Pedido #{selectedOrder.orderNumber}
                    </h2>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Detalles de entrega y cobro</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                    selectedOrder.deliveryStatus === "delivered"
                      ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-800/50"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/50"
                  }`}
                >
                  {selectedOrder.deliveryStatus === "delivered" ? "Entregado" : "En camino"}
                </span>
              </div>

              {/* Cuerpo de la ficha */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                {/* DATOS DEL CLIENTE Y DIRECCIÓN */}
                <div className="p-3.5 rounded-xl bg-neutral-50/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-white">
                      <User className="w-4 h-4 text-primary" />
                      <span>{selectedOrder.customerName}</span>
                    </div>
                    {selectedOrder.customerPhone && (
                      <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                        {selectedOrder.customerPhone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{selectedOrder.deliveryAddress}</p>
                      {selectedOrder.deliveryReference && (
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Ref: {selectedOrder.deliveryReference}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ACCIONES RÁPIDAS (LLAMAR, WHATSAPP, GOOGLE MAPS, WAZE) */}
                <div className="grid grid-cols-4 gap-1.5">
                  {/* Llamar cliente */}
                  {selectedOrder.customerPhone ? (
                    <a
                      href={`tel:${selectedOrder.customerPhone.replace(/\D/g, "")}`}
                      className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 flex flex-col items-center justify-center gap-1 text-center transition-all shadow-xs"
                    >
                      <Phone className="w-4 h-4 text-primary" />
                      <span className="text-[10px] font-semibold">Llamar</span>
                    </a>
                  ) : (
                    <div className="p-2 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 text-neutral-400 flex flex-col items-center justify-center gap-1 text-center opacity-50">
                      <Phone className="w-4 h-4" />
                      <span className="text-[10px] font-medium">Sin tel</span>
                    </div>
                  )}

                  {/* WhatsApp con el cliente */}
                  {selectedOrder.customerPhone ? (
                    <a
                      href={`https://wa.me/${
                        selectedOrder.customerPhone.replace(/\D/g, "").startsWith("57")
                          ? selectedOrder.customerPhone.replace(/\D/g, "")
                          : selectedOrder.customerPhone.replace(/\D/g, "").length === 10
                          ? `57${selectedOrder.customerPhone.replace(/\D/g, "")}`
                          : selectedOrder.customerPhone.replace(/\D/g, "")
                      }?text=${encodeURIComponent(
                        `Hola ${selectedOrder.customerName}, soy tu domiciliario de ${businessName}. Voy en camino con tu pedido #${selectedOrder.orderNumber}.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="p-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 flex flex-col items-center justify-center gap-1 text-center transition-all shadow-xs"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-[10px] font-semibold">WhatsApp</span>
                    </a>
                  ) : (
                    <div className="p-2 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 text-neutral-400 flex flex-col items-center justify-center gap-1 text-center opacity-50">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-[10px] font-medium">Sin WApp</span>
                    </div>
                  )}

                  {/* Abrir en Google Maps */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      selectedOrder.deliveryAddress
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="p-2 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 flex flex-col items-center justify-center gap-1 text-center transition-all shadow-xs"
                  >
                    <Navigation className="w-4 h-4" />
                    <span className="text-[10px] font-semibold">Maps</span>
                  </a>

                  {/* Abrir en Waze */}
                  <a
                    href={`https://waze.com/ul?q=${encodeURIComponent(
                      selectedOrder.deliveryAddress
                    )}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="p-2 rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 flex flex-col items-center justify-center gap-1 text-center transition-all shadow-xs"
                  >
                    <Navigation className="w-4 h-4 text-cyan-600 rotate-45" />
                    <span className="text-[10px] font-semibold">Waze</span>
                  </a>
                </div>

                {/* COBRO E INFORMACIÓN FINANCIERA */}
                <div className="p-3.5 rounded-xl bg-neutral-50/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">Total comanda:</span>
                    <span className="font-bold font-mono text-neutral-900 dark:text-white">
                      {formatCOP(selectedOrder.total)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">Cobro en entrega:</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                        selectedOrder.paymentStatus === "paid"
                          ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-800/50"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/40 font-bold"
                      }`}
                    >
                      {selectedOrder.paymentStatus === "paid"
                        ? "Pagado previamente"
                        : `Cobrar: ${formatCOP(selectedOrder.total)}`}
                    </span>
                  </div>
                </div>

                {/* RESUMEN DE PRODUCTOS */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Productos del pedido ({selectedOrder.itemsCount || selectedOrder.items?.length || 0})
                  </h4>
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-3 space-y-2 text-xs">
                    {selectedOrder.items?.map((it: any) => (
                      <div key={it.id} className="pt-2 first:pt-0 flex items-start justify-between">
                        <div>
                          <span className="font-bold text-neutral-900 dark:text-white mr-1.5">{it.quantity}x</span>
                          <span className="text-neutral-700 dark:text-neutral-300">{it.productName}</span>
                          {it.notes && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 italic mt-0.5">
                              Nota: {it.notes}
                            </p>
                          )}
                        </div>
                        <span className="font-mono text-neutral-500 dark:text-neutral-400">
                          {formatCOP(it.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECCIÓN DE CONFIRMACIÓN DE ENTREGA EN LA FICHA */}
                {selectedOrder.deliveryStatus === "delivered" ? (
                  <div className="p-4 rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300 border border-green-200 dark:border-green-800/50 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">Entrega completada y verificada</h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Este pedido ya fue confirmado con el PIN de entrega.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-3.5 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">Confirmar Entrega</h4>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {selectedOrder.hasVerificationCode
                            ? "Pídele al cliente el código de 4 dígitos que recibió por WhatsApp."
                            : "Confirma la entrega física del pedido al cliente."}
                        </p>
                      </div>
                    </div>

                    {selectedOrder.isLocked || remainingAttempts === 0 ? (
                      <div className="p-3 text-xs font-medium text-amber-800 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div>
                          <p className="font-bold">Verificación bloqueada por seguridad</p>
                          <p className="text-[11px] mt-0.5 leading-relaxed">
                            Se ha alcanzado el límite de 5 intentos fallidos para este pedido. Comunícate con el restaurante para autorizar la entrega mediante el procedimiento de excepción.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* PIN PAD numérico de 4 casillas */}
                        {selectedOrder.hasVerificationCode && (
                          <div className="space-y-1.5">
                            <label className="block text-center text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                              Código PIN de 4 dígitos
                            </label>
                            <PinPadInput
                              digits={pinDigits}
                              onChange={(newDigits) => {
                                setPinDigits(newDigits);
                                setDeliveryErrorMsg(null);
                              }}
                              disabled={isSubmittingDelivery || isDeliverySuccess}
                              hasError={Boolean(deliveryErrorMsg)}
                            />
                          </div>
                        )}

                        {/* Mensaje de error / intentos restantes */}
                        {deliveryErrorMsg && (
                          <div className="p-3 text-xs font-medium text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-xl flex items-start gap-2 animate-in fade-in">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                            <div className="flex-1">
                              <p>{deliveryErrorMsg}</p>
                              {remainingAttempts !== null && remainingAttempts > 0 && (
                                <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-1 font-semibold">
                                  Intentos restantes: {remainingAttempts} de 5
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Notificación de éxito en entrega */}
                        {isDeliverySuccess && (
                          <div className="p-3 text-xs font-medium text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-300 border border-green-200 dark:border-green-800/50 rounded-xl flex items-center justify-center gap-2 animate-in zoom-in-95">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="font-bold">¡Entrega verificada exitosamente!</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* BOTÓN INFERIOR: CONFIRMAR ENTREGA */}
              {selectedOrder.deliveryStatus !== "delivered" && (
                <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                  <button
                    type="button"
                    disabled={
                      isSubmittingDelivery ||
                      isDeliverySuccess ||
                      Boolean(selectedOrder.isLocked) ||
                      remainingAttempts === 0 ||
                      (selectedOrder.hasVerificationCode && pinDigits.join("").trim().length !== 4)
                    }
                    onClick={handleConfirmDelivery}
                    className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 text-xs sm:text-sm font-semibold text-white bg-primary hover:bg-primary/90 active:scale-[0.98] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingDelivery ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Validando PIN y confirmando...</span>
                      </>
                    ) : isDeliverySuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>¡Entrega Confirmada!</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Confirmar entrega</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
