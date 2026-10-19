"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Bike,
  KeyRound,
  MapPin,
  Phone,
  User,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Package,
  DollarSign,
  ChevronRight,
  LogOut,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  loginDriverAction,
  getDriverOrdersAction,
  takeDeliveryOrderAction,
  verifyAndCompleteDeliveryAction,
} from "./actions";

interface DriverAppClientProps {
  businessId: string;
  businessName: string;
}

export function DriverAppClient({ businessId, businessName }: DriverAppClientProps) {
  // Estado de autenticación
  const [pin, setPin] = useState<string>("");
  const [driver, setDriver] = useState<{ id: string; name: string; phone?: string | null } | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Pedidos
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [tab, setTab] = useState<"my_orders" | "available">("my_orders");

  // Modal de verificación de código de entrega
  const [verifyModal, setVerifyModal] = useState<{
    isOpen: boolean;
    order: any | null;
    code: string;
    isSubmitting: boolean;
    errorMsg: string | null;
  }>({
    isOpen: false,
    order: null,
    code: "",
    isSubmitting: false,
    errorMsg: null,
  });

  const [isPending, startTransition] = useTransition();

  // Restaurar PIN si estaba guardado en sessionStorage de esta sesión
  useEffect(() => {
    const savedPin = sessionStorage.getItem(`negova_driver_pin_${businessId}`);
    if (savedPin) {
      setPin(savedPin);
      handleLoginWithPin(savedPin);
    }
  }, [businessId]);

  const handleLoginWithPin = async (inputPin: string) => {
    if (!inputPin.trim()) {
      toast.error("Por favor ingresa tu PIN de 6 dígitos.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await loginDriverAction(businessId, inputPin);
      if (res.success && res.driver) {
        setDriver(res.driver);
        sessionStorage.setItem(`negova_driver_pin_${businessId}`, inputPin);
        toast.success(`¡Bienvenido, ${res.driver.name}!`);
        loadOrders(inputPin, tab);
      } else {
        toast.error(res.error || "PIN incorrecto o no autorizado.");
        sessionStorage.removeItem(`negova_driver_pin_${businessId}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al autenticar.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(`negova_driver_pin_${businessId}`);
    setDriver(null);
    setPin("");
    setOrders([]);
    toast.info("Sesión de reparto cerrada.");
  };

  const loadOrders = async (currentPin: string, currentTab: "my_orders" | "available") => {
    setIsLoadingOrders(true);
    try {
      const res = await getDriverOrdersAction(businessId, currentPin, currentTab);
      if (res.success) {
        setOrders(res.orders);
      } else {
        toast.error(res.error || "No se pudieron obtener las órdenes.");
        if (res.error?.includes("inválida") || res.error?.includes("revocado")) {
          handleLogout();
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al cargar pedidos.");
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Tomar un pedido disponible
  const handleTakeOrder = async (orderId: string, orderNumber: number) => {
    if (!driver || !pin) return;

    startTransition(async () => {
      try {
        const res = await takeDeliveryOrderAction(businessId, pin, orderId);
        if (res.success) {
          toast.success(`Pedido #${orderNumber} tomado. ¡Buen viaje!`);
          loadOrders(pin, tab);
        } else {
          toast.error(res.error || "No se pudo tomar el pedido.");
        }
      } catch (err: any) {
        toast.error(err?.message || "Error al asignar pedido.");
      }
    });
  };

  // Confirmar código de entrega
  const handleConfirmDeliveryCode = async () => {
    if (!verifyModal.order || !pin) return;
    if (!verifyModal.code.trim()) {
      setVerifyModal((prev) => ({ ...prev, errorMsg: "Ingresa el código que te proporcionó el cliente." }));
      return;
    }

    setVerifyModal((prev) => ({ ...prev, isSubmitting: true, errorMsg: null }));
    try {
      const res = await verifyAndCompleteDeliveryAction(
        businessId,
        pin,
        verifyModal.order.id,
        verifyModal.code.trim()
      );

      if (res.success) {
        toast.success(`¡Pedido #${verifyModal.order.order_number} entregado con éxito!`);
        setVerifyModal({
          isOpen: false,
          order: null,
          code: "",
          isSubmitting: false,
          errorMsg: null,
        });
        loadOrders(pin, tab);
      } else {
        const remaining = (res as any).remainingAttempts;
        const attemptsMsg = remaining !== undefined
          ? ` (Te quedan ${remaining} intentos)`
          : "";
        setVerifyModal((prev) => ({
          ...prev,
          errorMsg: (res.error || "Código incorrecto") + attemptsMsg,
          isSubmitting: false,
        }));
      }
    } catch (err: any) {
      setVerifyModal((prev) => ({
        ...prev,
        errorMsg: err?.message || "Error al validar la entrega.",
        isSubmitting: false,
      }));
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // ==========================================
  // PANTALLA 1: ACCESO RESTRINGIDO POR PIN
  // ==========================================
  if (!driver) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 font-sans">
        <div className="w-full max-w-sm mx-auto my-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#ED500A] to-amber-500 mx-auto flex items-center justify-center shadow-lg shadow-[#ED500A]/30">
              <Bike className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">{businessName}</h1>
            <p className="text-xs text-slate-400">Portal Operativo de Reparto y Domicilios</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-5">
            <div className="space-y-1.5 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Lock className="w-3 h-3" />
                Acceso Exclusivo Domiciliarios
              </div>
              <p className="text-xs text-slate-400 pt-1">
                Ingresa el PIN de 6 dígitos configurado por la administración de {businessName}.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLoginWithPin(pin);
              }}
              className="space-y-4"
            >
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="• • • • • •"
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono py-4 rounded-2xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#ED500A] focus:border-transparent transition-all"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn || pin.length < 4}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#ED500A] hover:bg-[#d94608] disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-[#ED500A]/20 transition-all flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                <span>Entrar a Mis Entregas</span>
              </button>
            </form>
          </div>

          <p className="text-[11px] text-center text-slate-500">
            NEGOVA Reparto Seguro · No comparte credenciales ni datos administrativos.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // PANTALLA 2: VISTA MÓVIL DEL DOMICILIARIO
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* HEADER MÓVIL */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#ED500A] flex items-center justify-center shadow-md">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>{driver.name}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px]">
              {businessName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => loadOrders(pin, tab)}
            disabled={isLoadingOrders}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Actualizar pedidos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingOrders ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* SUB-HEADER CON TABS */}
      <div className="bg-slate-900 border-b border-slate-800 p-2">
        <div className="grid grid-cols-2 gap-1.5 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => {
              setTab("my_orders");
              loadOrders(pin, "my_orders");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              tab === "my_orders"
                ? "bg-[#ED500A] text-white shadow-md shadow-[#ED500A]/20"
                : "bg-slate-800/60 text-slate-400 hover:text-white"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Mis Asignados</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("available");
              loadOrders(pin, "available");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              tab === "available"
                ? "bg-[#ED500A] text-white shadow-md shadow-[#ED500A]/20"
                : "bg-slate-800/60 text-slate-400 hover:text-white"
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Por Entregar</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: LISTADO DE DOMICILIOS */}
      <main className="flex-1 p-3 sm:p-4 max-w-md w-full mx-auto space-y-3 pb-24">
        {isLoadingOrders && orders.length === 0 ? (
          <div className="text-center py-16 text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#ED500A]" />
            <p className="text-xs">Cargando tus entregas...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-3">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
            <h3 className="font-bold text-sm text-white">
              {tab === "my_orders" ? "No tienes entregas pendientes" : "No hay pedidos listos para tomar"}
            </h3>
            <p className="text-xs text-slate-400">
              {tab === "my_orders"
                ? "Revisa la pestaña «Por Entregar» o espera que el restaurante te asigne nuevos pedidos."
                : "Todos los pedidos listos ya tienen domiciliario asignado o están en camino."}
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const isDelivered = order.delivery_status === "delivered" || order.status === "delivered";
            const isPaid = order.payment_status === "paid";

            return (
              <div
                key={order.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md"
              >
                {/* CABECERA DE LA TARJETA */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-base text-white">
                        #{order.order_number}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {/* ESTADO DE PAGO (CRÍTICO: SEPARADO DE ENTREGA) */}
                    <div className="pt-1">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          PAGADO PREVIAMENTE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <DollarSign className="w-3 h-3" />
                          COBRAR AL CLIENTE: {formatCurrency(order.total)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-white block">
                      {formatCurrency(order.total)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {order.items?.length || 0} producto(s)
                    </span>
                  </div>
                </div>

                {/* DIRECCIÓN DE ENTREGA (DESTACADA) */}
                <div className="bg-slate-800/70 rounded-xl p-3 border border-slate-700/60 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#ED500A] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-white leading-snug">
                        {order.delivery_address || "Sin dirección registrada"}
                      </p>
                      {order.delivery_reference && (
                        <p className="text-[11px] text-amber-300/90 mt-0.5 font-medium">
                          Indicaciones: {order.delivery_reference}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ENLACE DIRECTO A MAPS / WAZE */}
                  {order.delivery_address && (
                    <div className="pt-1 flex items-center gap-2">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          order.delivery_address
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Abrir en Google Maps</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* DATOS DE CONTACTO DEL DESTINATARIO */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-200 truncate">
                      {order.customer_name || "Cliente Final"}
                    </span>
                  </div>

                  {order.customer_phone ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Llamar</span>
                      </a>
                      <a
                        href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500">Sin teléfono</span>
                  )}
                </div>

                {/* RESUMEN DE PRODUCTOS */}
                <div className="space-y-1 text-xs pt-1">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    <span>Contenido del paquete:</span>
                  </div>
                  <div className="space-y-1 pl-2 border-l-2 border-slate-800">
                    {order.items?.map((item: any, i: number) => (
                      <div key={item.id || i} className="flex justify-between text-slate-300 text-[11px]">
                        <span>
                          <strong className="text-white font-mono">{item.quantity}x</strong> {item.product_name}
                        </span>
                        <span className="font-mono text-slate-400">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ACCIONES DE ENTREGA */}
                <div className="pt-2">
                  {isDelivered ? (
                    <div className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Pedido Entregado</span>
                    </div>
                  ) : order.driver_name === driver.name ? (
                    <button
                      type="button"
                      onClick={() =>
                        setVerifyModal({
                          isOpen: true,
                          order,
                          code: "",
                          isSubmitting: false,
                          errorMsg: null,
                        })
                      }
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirmar Entrega con Código</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleTakeOrder(order.id, order.order_number)}
                      disabled={isPending}
                      className="w-full py-3 rounded-xl bg-[#ED500A] hover:bg-[#d94608] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#ED500A]/20 transition-all"
                    >
                      <Bike className="w-4 h-4" />
                      <span>Tomar Este Pedido y Salir</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* MODAL DE CONFIRMACIÓN CON CÓDIGO DEL CLIENTE */}
      {verifyModal.isOpen && verifyModal.order && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">
                    Verificación de Entrega
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Pedido #{verifyModal.order.order_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setVerifyModal({
                    isOpen: false,
                    order: null,
                    code: "",
                    isSubmitting: false,
                    errorMsg: null,
                  })
                }
                className="text-slate-400 hover:text-white text-xs font-bold p-1"
              >
                Cerrar
              </button>
            </div>

            <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60 text-xs space-y-1">
              <p className="text-slate-300">
                Pide al cliente el <strong>código de 4 dígitos</strong> que recibió para validar la entrega.
              </p>
              <p className="text-[10px] text-slate-500">
                Si el cliente no lo tiene, comunícate con el negocio para una autorización de excepción.
              </p>
            </div>

            {verifyModal.errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{verifyModal.errorMsg}</span>
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verifyModal.code}
                onChange={(e) =>
                  setVerifyModal((prev) => ({
                    ...prev,
                    code: e.target.value.replace(/\D/g, ""),
                    errorMsg: null,
                  }))
                }
                placeholder="Ingresar PIN"
                className="w-full text-center tracking-[0.4em] text-2xl font-mono py-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setVerifyModal({
                    isOpen: false,
                    order: null,
                    code: "",
                    isSubmitting: false,
                    errorMsg: null,
                  })
                }
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeliveryCode}
                disabled={verifyModal.isSubmitting || verifyModal.code.length < 4}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all"
              >
                {verifyModal.isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Validar y Entregar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
