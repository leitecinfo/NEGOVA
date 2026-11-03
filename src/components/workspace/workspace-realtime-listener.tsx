"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChefHat, BellRing, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  initOrderAudioUnlock,
  playOrderSoundAlert,
  playOrderReadySoundAlert,
  unlockAudioContextManually,
  isAudioUnlockedState,
} from "@/lib/audio/order-sound-player";
import { syncOrderNotificationAction } from "@/app/workspace/[businessId]/notificaciones/actions";

interface WorkspaceRealtimeListenerProps {
  businessId: string;
}

export function WorkspaceRealtimeListener({ businessId }: WorkspaceRealtimeListenerProps) {
  const router = useRouter();
  const processedOrderIdsRef = useRef<Set<string>>(new Set());
  const processedReadyOrderIdsRef = useRef<Set<string>>(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(true);
  const [showAudioPrompt, setShowAudioPrompt] = useState<boolean>(false);

  // Inicializar desbloqueo acústico ante la primera interacción
  useEffect(() => {
    initOrderAudioUnlock();

    const isUnlocked = isAudioUnlockedState();
    setAudioUnlocked(isUnlocked);

    // Si aún no está desbloqueado tras 1.5s, mostrar discreto indicador para advertir al operador
    const timer = setTimeout(() => {
      if (!isAudioUnlockedState()) {
        setShowAudioPrompt(true);
      }
    }, 1500);

    const handleUnlocked = () => {
      setAudioUnlocked(true);
      setShowAudioPrompt(false);
    };

    window.addEventListener("negova:audio_unlocked", handleUnlocked);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("negova:audio_unlocked", handleUnlocked);
    };
  }, []);

  const handleManualUnlock = async () => {
    await unlockAudioContextManually();
    setAudioUnlocked(true);
    setShowAudioPrompt(false);
    toast.success("Alertas sonoras de comandas activadas");
  };

  useEffect(() => {
    if (!businessId) return;

    const supabase = createClient();
    const channelName = `realtime-orders:${businessId}`;

    const channel = supabase
      .channel(channelName)
      // 1. Escuchar NUEVOS PEDIDOS (INSERT)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "restaurant_orders",
          filter: `business_id=eq.${businessId}`,
        },
        async (payload: any) => {
          const newOrder = payload?.new;
          if (!newOrder || !newOrder.id) return;

          // Validación estricta multi-tenant
          if (newOrder.business_id !== businessId) return;

          // Modalidades autorizadas: dine_in, takeout, delivery
          const validTypes = ["dine_in", "takeout", "delivery"];
          if (!validTypes.includes(newOrder.order_type)) return;

          // Idempotencia: no procesar dos veces el mismo pedido por reconexión
          if (processedOrderIdsRef.current.has(newOrder.id)) return;
          processedOrderIdsRef.current.add(newOrder.id);

          // Alerta sonora inmediata para nuevo pedido (Web Audio API + fallback)
          await playOrderSoundAlert(newOrder.id);

          // Notificación visual con Sonner Toast en estilo NEGOVA
          const orderNum = `#${newOrder.order_number}`;
          const formattedTotal = `$${Number(newOrder.total || 0).toLocaleString("es-CO")}`;
          let modalityLabel = "Consumo en mesa";
          if (newOrder.order_type === "takeout") modalityLabel = "Para llevar";
          if (newOrder.order_type === "delivery") modalityLabel = "A domicilio";

          const clientName = newOrder.customer_name ? ` • ${newOrder.customer_name}` : "";

          toast(`Nuevo pedido ${orderNum}`, {
            icon: <ChefHat className="w-5 h-5 text-[#ED500A]" />,
            description: `${modalityLabel} • Total: ${formattedTotal}${clientName}`,
            duration: 8000,
            action: {
              label: "Ver Pedido",
              onClick: () => router.push(`/workspace/${businessId}/pedidos/${newOrder.id}`),
            },
          });

          // Asegurar persistencia de notificación de forma idempotente
          try {
            await syncOrderNotificationAction(businessId, {
              orderId: newOrder.id,
              orderNumber: newOrder.order_number,
              orderType: newOrder.order_type,
              customerName: newOrder.customer_name,
              total: Number(newOrder.total),
            });
          } catch (syncErr) {
            console.warn("[WorkspaceRealtimeListener] Advertencia en sync:", syncErr);
          }

          // Emitir evento en el navegador para actualizar vistas activas (Pedidos, Cocina, Mesas)
          try {
            window.dispatchEvent(
              new CustomEvent("negova:new_order", {
                detail: {
                  id: newOrder.id,
                  businessId: newOrder.business_id,
                  orderNumber: newOrder.order_number,
                  orderType: newOrder.order_type,
                  customerName: newOrder.customer_name,
                  total: Number(newOrder.total),
                  createdAt: newOrder.created_at || new Date().toISOString(),
                },
              })
            );
          } catch {}
        }
      )
      // 2. Escuchar CAMBIOS DE ESTADO A 'LISTO PARA ENTREGAR' (UPDATE)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "restaurant_orders",
          filter: `business_id=eq.${businessId}`,
        },
        async (payload: any) => {
          const updatedOrder = payload?.new;
          if (!updatedOrder || !updatedOrder.id) return;

          // Validación estricta multi-tenant
          if (updatedOrder.business_id !== businessId) return;

          // Detectar si el pedido pasó al estado 'ready' (Listo para entregar)
          if (updatedOrder.status === "ready") {
            const readyKey = `ready:${updatedOrder.id}`;
            if (processedReadyOrderIdsRef.current.has(readyKey)) return;
            processedReadyOrderIdsRef.current.add(readyKey);

            // Alerta sonora específica para comanda lista
            await playOrderReadySoundAlert(updatedOrder.id);

            // Notificación visual de aviso para meseros/despachadores
            const orderNum = `#${updatedOrder.order_number}`;
            let locationDesc = "Listo para entrega";
            if (updatedOrder.order_type === "dine_in") {
              locationDesc = updatedOrder.table_name
                ? `Mesa: ${updatedOrder.table_name}`
                : "Consumo en mesa";
            } else if (updatedOrder.order_type === "takeout") {
              locationDesc = "Para llevar";
            } else if (updatedOrder.order_type === "delivery") {
              locationDesc = "A domicilio";
            }

            const clientInfo = updatedOrder.customer_name ? ` • ${updatedOrder.customer_name}` : "";

            toast(`¡Pedido ${orderNum} listo para entregar!`, {
              icon: <BellRing className="w-5 h-5 text-emerald-500" />,
              description: `${locationDesc}${clientInfo}`,
              duration: 8000,
              action: {
                label: "Ver Pedido",
                onClick: () => router.push(`/workspace/${businessId}/pedidos/${updatedOrder.id}`),
              },
            });

            // Emitir evento en el navegador para actualizar vistas abiertas
            try {
              window.dispatchEvent(
                new CustomEvent("negova:order_ready", {
                  detail: {
                    id: updatedOrder.id,
                    businessId: updatedOrder.business_id,
                    orderNumber: updatedOrder.order_number,
                    orderType: updatedOrder.order_type,
                    status: updatedOrder.status,
                  },
                })
              );
            } catch {}
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn("[WorkspaceRealtimeListener] Error en suscripción Realtime:", err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, router]);

  // Si el navegador bloquea el audio y el usuario no ha interactuado aún, mostrar recordatorio flotante discreto
  if (showAudioPrompt && !audioUnlocked) {
    return (
      <aside
        aria-label="Notificación de sonido de pedidos"
        className="fixed bottom-4 right-4 z-[9990] animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-auto"
      >
        <button
          type="button"
          onClick={handleManualUnlock}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/95 dark:bg-[#121520]/95 text-white text-xs font-semibold shadow-xl border border-white/10 hover:border-[#ED500A]/50 hover:bg-[#1a1e2e] transition-all cursor-pointer backdrop-blur-md group"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ED500A] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ED500A]"></span>
          </span>
          <Volume2 className="w-4 h-4 text-[#ED500A] group-hover:scale-110 transition-transform" />
          <span>Toca aquí para activar sonido de comandas</span>
        </button>
      </aside>
    );
  }

  return null;
}
