"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Bike,
  PackageCheck,
  XCircle,
  MapPin,
  ShoppingBag,
  Phone,
  MessageCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Store,
} from "lucide-react";
import { PublicOrderTrackingDTO } from "@/lib/delivery/tracking-service";
import { getOrderTrackingAction } from "./actions";
import { createClient } from "@/lib/supabase/client";

interface Props {
  initialTracking: PublicOrderTrackingDTO;
}

export function OrderTrackingClient({ initialTracking }: Props) {
  const [tracking, setTracking] = useState<PublicOrderTrackingDTO>(initialTracking);
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: tracking.currency || "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Función de actualización silenciosa
  const refreshTrackingData = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getOrderTrackingAction(tracking.trackingCode);
        if (res.success && res.tracking) {
          setTracking(res.tracking);
          setLastRefreshed(new Date());
        }
      } catch (err) {
        console.warn("[OrderTrackingClient] Fallo al refrescar seguimiento:", err);
      }
    });
  }, [tracking.trackingCode]);

  // 1. Suscripción en tiempo real con Supabase Realtime
  useEffect(() => {
    let supabase: any = null;
    let channel: any = null;

    try {
      supabase = createClient();
      if (supabase && tracking.orderId) {
        channel = supabase
          .channel(`order-tracking-${tracking.orderId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "restaurant_orders",
              filter: `id=eq.${tracking.orderId}`,
            },
            () => {
              // Disparar recarga reactiva cuando cambie la orden en la BD
              refreshTrackingData();
            }
          )
          .subscribe((status: string) => {
            if (status === "SUBSCRIBED") {
              setIsRealtimeActive(true);
            }
          });
      }
    } catch (e) {
      console.warn("[OrderTrackingClient] Realtime no disponible, usando polling:", e);
      setIsRealtimeActive(false);
    }

    // 2. Polling periódico de seguridad cada 8 segundos (respaldo resiliente)
    const intervalId = setInterval(() => {
      // Si la orden ya está entregada o cancelada, espaciar polling o detener
      if (tracking.currentStep !== "delivered" && tracking.currentStep !== "cancelled") {
        refreshTrackingData();
      }
    }, 8000);

    return () => {
      clearInterval(intervalId);
      if (supabase && channel) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [tracking.orderId, tracking.currentStep, refreshTrackingData]);

  const cleanWhatsapp = (tracking.business.whatsapp || tracking.business.phone || "").replace(
    /[^0-9]/g,
    ""
  );

  const getStepIcon = (step: string) => {
    switch (step) {
      case "confirmed":
        return <CheckCircle2 className="w-5 h-5" />;
      case "preparing":
        return <ChefHat className="w-5 h-5" />;
      case "in_transit":
        return <Bike className="w-5 h-5" />;
      case "delivered":
        return <PackageCheck className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const isCancelled = tracking.currentStep === "cancelled";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-[#ED500A]/30">
      {/* 1. HEADER PÚBLICO */}
      <header className="border-b border-white/[0.08] bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tracking.business.logoUrl ? (
              <img
                src={tracking.business.logoUrl}
                alt={tracking.business.name}
                className="w-10 h-10 rounded-xl object-cover border border-white/10 shadow-xs bg-slate-800"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#ED500A] flex items-center justify-center font-black text-sm">
                <Store className="w-5 h-5" />
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight line-clamp-1">
                {tracking.business.name}
              </h1>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Pedido #{tracking.orderNumber}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-slate-300 font-semibold">
                  {tracking.trackingCode}
                </span>
              </div>
            </div>
          </div>

          {/* Indicador en vivo y botón de refresco */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>En vivo</span>
            </div>
            <button
              onClick={refreshTrackingData}
              disabled={isPending}
              aria-label="Actualizar estado del pedido"
              className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all disabled:opacity-50"
              title="Refrescar estado"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. CONTENIDO PRINCIPAL */}
      <main className="max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6 flex-1">
        {/* BANNER DE ESTADO CANCELADO */}
        {isCancelled ? (
          <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20 text-center space-y-3 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
              <XCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Pedido Cancelado</h2>
            <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
              Este pedido ha sido cancelado por el comercio. Si tienes preguntas o realizaste un
              pago previo, por favor comunícate directamente con el restaurante.
            </p>
          </div>
        ) : (
          /* BARRA DE PROGRESO DE 4 PASOS */
          <div className="p-6 sm:p-7 rounded-3xl bg-slate-900 border border-white/[0.08] shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#ED500A]">
                  Estado del Domicilio
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  {tracking.currentStep === "delivered"
                    ? "¡Pedido Entregado!"
                    : tracking.currentStep === "in_transit"
                    ? "Tu pedido está en camino"
                    : tracking.currentStep === "preparing"
                    ? "En preparación"
                    : "Pedido Confirmado"}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-400">
                  {tracking.progressPercentage}%
                </span>
              </div>
            </div>

            {/* Barra de progreso continua horizontal */}
            <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ED500A] via-amber-500 to-emerald-500 rounded-full transition-all duration-700 ease-out shadow-lg"
                style={{ width: `${tracking.progressPercentage}%` }}
              />
            </div>

            {/* Grid de 4 Pasos Visuales */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              {tracking.steps.map((st, idx) => {
                const isDone = st.isCompleted;
                const isCurr = st.isCurrent;

                return (
                  <div key={st.step} className="flex flex-col items-center text-center space-y-2">
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all ${
                        isCurr
                          ? "bg-[#ED500A] text-white shadow-lg shadow-[#ED500A]/30 scale-105 ring-4 ring-[#ED500A]/20"
                          : isDone
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-500 border border-white/5"
                      }`}
                    >
                      {getStepIcon(st.step)}
                    </div>
                    <div>
                      <span
                        className={`text-[11px] sm:text-xs font-bold block ${
                          isCurr ? "text-white" : isDone ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {st.label}
                      </span>
                      <span className="hidden sm:block text-[10px] text-slate-400 mt-0.5 leading-tight line-clamp-2">
                        {st.description}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. DIRECCIÓN Y DETALLES DE ENTREGA */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-white/[0.08] shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <MapPin className="w-4 h-4 text-[#ED500A]" />
            <span>Datos de Entrega</span>
          </div>

          <div className="bg-slate-950/60 rounded-2xl p-4 border border-white/5 space-y-2 text-xs">
            {tracking.customerName && (
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500">Destinatario:</span>
                <span className="font-semibold text-white">{tracking.customerName}</span>
              </div>
            )}
            {tracking.deliveryAddress ? (
              <div className="flex items-start justify-between text-slate-300 pt-1">
                <span className="text-slate-500">Dirección:</span>
                <span className="font-semibold text-white text-right max-w-[240px]">
                  {tracking.deliveryAddress}
                </span>
              </div>
            ) : (
              <p className="text-slate-400 italic">Dirección coordinada con el comercio</p>
            )}
            {tracking.deliveryReference && (
              <div className="flex items-start justify-between text-slate-300 pt-1 border-t border-white/5">
                <span className="text-slate-500">Referencia:</span>
                <span className="text-slate-300 text-right max-w-[240px]">
                  {tracking.deliveryReference}
                </span>
              </div>
            )}
            {tracking.notes && (
              <div className="flex items-start justify-between text-slate-300 pt-1 border-t border-white/5">
                <span className="text-slate-500">Observaciones:</span>
                <span className="text-slate-300 text-right max-w-[240px]">{tracking.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. RESUMEN DE PRODUCTOS ORDENADOS */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-white/[0.08] shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <ShoppingBag className="w-4 h-4 text-[#ED500A]" />
              <span>Productos ({tracking.items.length})</span>
            </div>
            <span className="text-xs text-slate-400">Total: {formatPrice(tracking.total)}</span>
          </div>

          <div className="divide-y divide-white/5">
            {tracking.items.map((item) => (
              <div key={item.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#ED500A]">{item.quantity}x</span>
                    <span className="font-semibold text-white">{item.productName}</span>
                  </div>
                  {item.variantName && (
                    <span className="text-[11px] text-slate-400 block pl-5">
                      Variante: {item.variantName}
                    </span>
                  )}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="pl-5 text-[11px] text-slate-400">
                      {item.modifiers.map((m, i) => (
                        <span key={i} className="block text-slate-400">
                          + {m.optionName}{" "}
                          {m.price ? `(${formatPrice(m.price)})` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <span className="text-[11px] text-amber-300/80 block pl-5 italic">
                      Nota: {item.notes}
                    </span>
                  )}
                </div>
                <span className="font-mono text-slate-300 font-semibold">
                  {formatPrice(item.subtotal)}
                </span>
              </div>
            ))}
          </div>

          {/* Desglose Económico */}
          <div className="pt-3 border-t border-white/5 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal productos:</span>
              <span className="font-mono">{formatPrice(tracking.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Costo de envío:</span>
              <span className="font-mono">
                {tracking.deliveryFee > 0 ? formatPrice(tracking.deliveryFee) : "Gratis"}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/10">
              <span>Total a pagar:</span>
              <span className="font-mono text-[#ED500A]">{formatPrice(tracking.total)}</span>
            </div>
          </div>
        </div>

        {/* 5. CONTACTO DIRECTO CON EL COMERCIO */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-white/[0.08] shadow-xl space-y-4">
          <div className="text-center space-y-1">
            <h3 className="text-sm font-bold text-white">¿Tienes alguna pregunta sobre tu pedido?</h3>
            <p className="text-xs text-slate-400">
              Comunícate directamente con el equipo de {tracking.business.name}.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            {cleanWhatsapp && (
              <a
                href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
                  `Hola ${tracking.business.name}, tengo una consulta sobre mi pedido #${tracking.orderNumber} (Código: ${tracking.trackingCode}).`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold shadow-lg transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>Contactar por WhatsApp</span>
              </a>
            )}

            {tracking.business.phone && (
              <a
                href={`tel:${tracking.business.phone}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>Llamar al restaurante</span>
              </a>
            )}
          </div>
        </div>

        {/* 6. GARANTÍA DE PRIVACIDAD Y SEGURIDAD */}
        <div className="text-center py-4 space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Seguimiento seguro y encriptado por NEGOVA</span>
          </div>
          <p className="text-[10px] text-slate-600">
            Actualización automática periódica cada 8 segundos.
          </p>
        </div>
      </main>
    </div>
  );
}
