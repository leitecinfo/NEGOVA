"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Bike,
  KeyRound,
  MapPin,
  Phone,
  User,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Package,
  DollarSign,
  LogOut,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Lock,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  loginDriverAction,
  getDriverOrdersAction,
  takeDeliveryOrderAction,
  verifyAndCompleteDeliveryAction,
  confirmDeliveryWithExceptionByDriverAction,
  reportDeliveryIssueByDriverAction,
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

  // Modal de excepción supervisada
  const [exceptionModal, setExceptionModal] = useState<{
    isOpen: boolean;
    order: any | null;
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    order: null,
    reason: "",
    isSubmitting: false,
  });

  // Modal de reporte de novedad
  const [issueModal, setIssueModal] = useState<{
    isOpen: boolean;
    order: any | null;
    type: string;
    notes: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    order: null,
    type: "customer_absent",
    notes: "",
    isSubmitting: false,
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

  // Validar código de entrega con el servidor
  const handleConfirmDeliveryCode = async () => {
    if (!verifyModal.order || !driver || !pin) return;

    setVerifyModal((prev) => ({ ...prev, isSubmitting: true, errorMsg: null }));

    try {
      const res = await verifyAndCompleteDeliveryAction(
        businessId,
        pin,
        verifyModal.order.id,
        verifyModal.code
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
        setVerifyModal((prev) => ({
          ...prev,
          isSubmitting: false,
          errorMsg: res.error || "Código incorrecto.",
        }));
      }
    } catch (err: any) {
      setVerifyModal((prev) => ({
        ...prev,
        isSubmitting: false,
        errorMsg: err?.message || "Error al conectar con el servidor.",
      }));
    }
  };

  const handleConfirmException = async () => {
    if (!exceptionModal.order) return;
    if (!exceptionModal.reason.trim() || exceptionModal.reason.trim().length < 4) {
      toast.error("Ingresa un motivo válido para la excepción (mínimo 4 caracteres).");
      return;
    }

    setExceptionModal((prev) => ({ ...prev, isSubmitting: true }));
    const res = await confirmDeliveryWithExceptionByDriverAction(
      businessId,
      pin,
      exceptionModal.order.id,
      exceptionModal.reason.trim()
    );
    setExceptionModal((prev) => ({ ...prev, isSubmitting: false }));

    if (res.success) {
      toast.success(`Entrega autorizada por excepción para pedido #${exceptionModal.order.order_number}`);
      setExceptionModal({ isOpen: false, order: null, reason: "", isSubmitting: false });
      loadOrders(pin, tab);
    } else {
      toast.error(res.error || "Error al registrar la excepción.");
    }
  };

  const handleReportIssue = async () => {
    if (!issueModal.order) return;
    if (!issueModal.notes.trim() || issueModal.notes.trim().length < 3) {
      toast.error("Por favor describe el detalle de la novedad.");
      return;
    }

    setIssueModal((prev) => ({ ...prev, isSubmitting: true }));
    const res = await reportDeliveryIssueByDriverAction(
      businessId,
      pin,
      issueModal.order.id,
      issueModal.type,
      issueModal.notes.trim()
    );
    setIssueModal((prev) => ({ ...prev, isSubmitting: false }));

    if (res.success) {
      toast.success("Novedad reportada al comercio.");
      setIssueModal({ isOpen: false, order: null, type: "customer_absent", notes: "", isSubmitting: false });
      loadOrders(pin, tab);
    } else {
      toast.error(res.error || "Error al reportar la novedad.");
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
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
        <div className="w-full max-w-sm mx-auto my-auto space-y-5">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 mx-auto flex items-center justify-center shadow-xs">
              <Bike className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">{businessName}</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Portal Operativo de Reparto y Domicilios</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="space-y-1.5 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700/60">
                <Lock className="w-3.5 h-3.5" />
                Acceso Exclusivo Domiciliarios
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 pt-1">
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
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn || pin.length < 4}
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 text-xs font-semibold text-white bg-primary hover:bg-primary/90 active:scale-[0.98] rounded-xl shadow-xs transition-all disabled:opacity-50"
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

          <p className="text-[11px] text-center text-neutral-400">
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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans max-w-md mx-auto relative border-x border-neutral-200/80 dark:border-neutral-800 shadow-sm">
      {/* HEADER MÓVIL */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
              <span>{driver.name}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate max-w-[150px] sm:max-w-[200px]">
              {businessName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => loadOrders(pin, tab)}
            disabled={isLoadingOrders}
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Actualizar pedidos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingOrders ? "animate-spin text-primary" : ""}`} />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* SUB-HEADER CON TABS */}
      <div className="bg-white/60 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 p-2">
        <div className="grid grid-cols-2 gap-1.5 max-w-md mx-auto p-1 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/80 dark:border-neutral-700/50">
          <button
            type="button"
            onClick={() => {
              setTab("my_orders");
              loadOrders(pin, "my_orders");
            }}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              tab === "my_orders"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs font-bold"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
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
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              tab === "available"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs font-bold"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
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
          <div className="text-center py-16 text-neutral-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-xs">Cargando tus entregas...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-12 text-center shadow-xs my-6 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-2 text-neutral-400">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-sm text-neutral-900 dark:text-white">
              {tab === "my_orders" ? "No tienes entregas pendientes" : "No hay pedidos listos para tomar"}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
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
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
              >
                {/* CABECERA DE LA TARJETA */}
                <div className="flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-neutral-900 dark:text-white">
                        Pedido #{order.order_number}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {/* ESTADO DE PAGO */}
                    <div className="pt-1">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800/50">
                          <CheckCircle2 className="w-3 h-3" />
                          PAGADO PREVIAMENTE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40">
                          <DollarSign className="w-3 h-3" />
                          COBRAR: {formatCurrency(order.total)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-mono font-bold text-neutral-900 dark:text-white block">
                      {formatCurrency(order.total)}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {order.items?.length || 0} producto(s)
                    </span>
                  </div>
                </div>

                {/* DIRECCIÓN DE ENTREGA */}
                <div className="bg-neutral-50 dark:bg-neutral-800/30 rounded-xl p-3 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-neutral-900 dark:text-white leading-snug">
                        {order.delivery_address || "Sin dirección registrada"}
                      </p>
                      {order.delivery_reference && (
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          Indicaciones: {order.delivery_reference}
                        </p>
                      )}
                    </div>
                  </div>

                  {order.delivery_address && (
                    <div className="pt-1 flex items-center gap-3">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          order.delivery_address
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/90"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Google Maps</span>
                      </a>
                      <a
                        href={`https://waze.com/ul?q=${encodeURIComponent(order.delivery_address)}&navigate=yes`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 hover:text-cyan-700"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Waze</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* DATOS DE CONTACTO DEL DESTINATARIO */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-neutral-50/50 dark:bg-neutral-800/20 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                      {order.customer_name || "Cliente"}
                    </span>
                  </div>

                  {order.customer_phone ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <Phone className="w-3 h-3 text-primary" />
                        <span>Llamar</span>
                      </a>
                      <a
                        href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  ) : (
                    <span className="text-[11px] text-neutral-400">Sin teléfono</span>
                  )}
                </div>

                {/* RESUMEN DE PRODUCTOS */}
                <div className="space-y-1 text-xs pt-1">
                  <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    <span>Contenido del paquete:</span>
                  </div>
                  <div className="space-y-1 pl-2 border-l-2 border-neutral-200 dark:border-neutral-800">
                    {order.items?.map((item: any, i: number) => (
                      <div key={item.id || i} className="flex justify-between text-neutral-700 dark:text-neutral-300 text-[11px]">
                        <span>
                          <strong className="text-neutral-900 dark:text-white font-mono">{item.quantity}x</strong> {item.product_name}
                        </span>
                        <span className="font-mono text-neutral-500 dark:text-neutral-400">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ACCIONES DE ENTREGA */}
                <div className="pt-2">
                  {isDelivered ? (
                    <div className="w-full py-2.5 rounded-xl bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300 border border-green-200 dark:border-green-800/50 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span>Pedido Entregado</span>
                    </div>
                  ) : order.driver_name === driver.name ? (
                    <div className="space-y-2">
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
                        className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 text-xs font-semibold text-white bg-primary hover:bg-primary/90 active:scale-[0.98] rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Confirmar Entrega con Código</span>
                      </button>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setIssueModal({
                              isOpen: true,
                              order,
                              type: "customer_absent",
                              notes: "",
                              isSubmitting: false,
                            })
                          }
                          className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>Reportar Novedad</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setExceptionModal({
                              isOpen: true,
                              order,
                              reason: "",
                              isSubmitting: false,
                            })
                          }
                          className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:underline cursor-pointer"
                        >
                          Entrega sin código (Excepción)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleTakeOrder(order.id, order.order_number)}
                      disabled={isPending}
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 text-xs font-semibold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:opacity-90 active:scale-[0.98] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
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
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-neutral-900 dark:text-white">
                      Verificación de Entrega
                    </h3>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
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
                  className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-800/40 rounded-xl p-3 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1">
                <p className="text-neutral-700 dark:text-neutral-300">
                  Pide al cliente el <strong>código de 4 dígitos</strong> que recibió para validar la entrega.
                </p>
                <p className="text-[10px] text-neutral-400">
                  Si el cliente no lo tiene, comunícate con el negocio para una autorización de excepción.
                </p>
              </div>

              {verifyModal.errorMsg && (
                <div className="p-3 text-xs font-medium text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{verifyModal.errorMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
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
                  placeholder="PIN de entrega"
                  className="w-full text-center tracking-[0.4em] text-2xl font-mono py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                  className="flex-1 py-2 px-3 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeliveryCode}
                  disabled={verifyModal.isSubmitting || verifyModal.code.length < 4}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-semibold text-white bg-primary hover:bg-primary/90 active:scale-[0.98] rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {verifyModal.isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Validar</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL DE EXCEPCIÓN SUPERVISADA */}
      {exceptionModal.isOpen && exceptionModal.order && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2.5 text-amber-600">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm text-neutral-900 dark:text-white">
                    Entrega por Excepción
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Pedido #{exceptionModal.order.order_number}
                  </p>
                </div>
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Utiliza este flujo si el cliente perdió su código de 4 dígitos o su teléfono está descargado. Esta acción se auditará con tu nombre de repartidor.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Motivo de la excepción *
                </label>
                <textarea
                  rows={2}
                  value={exceptionModal.reason}
                  onChange={(e) =>
                    setExceptionModal((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="Ej. Cliente recibió personalmente, código no recibido por falla telefónica..."
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setExceptionModal({ isOpen: false, order: null, reason: "", isSubmitting: false })
                  }
                  className="flex-1 py-2 px-3 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={exceptionModal.isSubmitting || exceptionModal.reason.trim().length < 4}
                  onClick={handleConfirmException}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.98] rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {exceptionModal.isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Confirmar</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL DE REPORTE DE NOVEDAD */}
      {issueModal.isOpen && issueModal.order && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2.5 text-rose-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm text-neutral-900 dark:text-white">
                    Reportar Novedad en Ruta
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Pedido #{issueModal.order.order_number}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Tipo de Incidencia
                  </label>
                  <select
                    value={issueModal.type}
                    onChange={(e) =>
                      setIssueModal((prev) => ({ ...prev, type: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white"
                  >
                    <option value="customer_absent">Cliente ausente / No contesta</option>
                    <option value="address_not_found">Dirección no encontrada / Incompleta</option>
                    <option value="customer_rejected">Pedido rechazado por cliente</option>
                    <option value="accident_or_delay">Demora en ruta / Incidente vial</option>
                    <option value="other">Otra novedad</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Detalle de lo ocurrido *
                  </label>
                  <textarea
                    rows={3}
                    value={issueModal.notes}
                    onChange={(e) =>
                      setIssueModal((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Ej. Se llamó 3 veces sin respuesta..."
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setIssueModal({ isOpen: false, order: null, type: "customer_absent", notes: "", isSubmitting: false })
                  }
                  className="flex-1 py-2 px-3 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={issueModal.isSubmitting || issueModal.notes.trim().length < 3}
                  onClick={handleReportIssue}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {issueModal.isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>Reportar</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
