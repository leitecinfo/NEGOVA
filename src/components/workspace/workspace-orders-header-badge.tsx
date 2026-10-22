"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { getRestaurantOrdersSummaryAction } from "@/app/workspace/[businessId]/pedidos/actions";

interface Props {
  businessId: string;
  canViewOrders: boolean;
}

export function WorkspaceOrdersHeaderBadge({ businessId, canViewOrders }: Props) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!canViewOrders) return;

    let isMounted = true;

    const fetchPendingOrders = async () => {
      try {
        const res = await getRestaurantOrdersSummaryAction(businessId);
        if (res.success && res.data && isMounted) {
          // Pendientes reales de atención: recibidos + en preparación + listos para entrega
          const activePending =
            (res.data.received || 0) +
            (res.data.inPreparation || 0) +
            (res.data.ready || 0);
          setPendingCount(activePending);
        }
      } catch {
        // En caso de error silencioso no mostramos badge erróneo
      }
    };

    fetchPendingOrders();

    // Sondeo suave cada 15 segundos para mantener actualizado el contador en tiempo real
    const interval = setInterval(fetchPendingOrders, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [businessId, canViewOrders]);

  if (!canViewOrders) return null;

  return (
    <Link
      href={`/workspace/${businessId}/pedidos`}
      className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors flex items-center justify-center"
      title="Acceso rápido a Pedidos"
    >
      <UtensilsCrossed className="w-5 h-5" />
      {typeof pendingCount === "number" && pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#ED500A] text-white text-[10px] font-black flex items-center justify-center animate-in zoom-in-50 shadow-xs">
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      )}
    </Link>
  );
}
