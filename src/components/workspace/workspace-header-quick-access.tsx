"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { getRestaurantOrdersSummaryAction } from "@/app/workspace/[businessId]/pedidos/actions";
import {
  AppNavSection,
  resolveQuickAccessItem,
} from "@/config/workspace-navigation";
import { CommercialActivity } from "@/config/commercial-activities";

export interface WorkspaceHeaderQuickAccessProps {
  businessId: string;
  navSections: AppNavSection[];
  initialModuleId?: string | null;
  businessType?: string | null;
  commercialActivities?: CommercialActivity[];
  canViewOrders?: boolean;
}

export function WorkspaceHeaderQuickAccess({
  businessId,
  navSections,
  initialModuleId,
  businessType,
  commercialActivities,
  canViewOrders = true,
}: WorkspaceHeaderQuickAccessProps) {
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(
    initialModuleId || null
  );
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number | null>(null);

  // Sincronizar si cambia el prop del servidor
  useEffect(() => {
    setCurrentModuleId(initialModuleId || null);
  }, [initialModuleId]);

  // Escuchar eventos en vivo del navegador para actualización inmediata sin recarga
  useEffect(() => {
    const handleQuickAccessUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setCurrentModuleId(customEvent.detail);
      }
    };

    window.addEventListener("negova:header-quick-access-updated", handleQuickAccessUpdate);
    return () => {
      window.removeEventListener("negova:header-quick-access-updated", handleQuickAccessUpdate);
    };
  }, []);

  // Resolver el elemento activo considerando preferencias, tipo de negocio y permisos
  const activeItem = resolveQuickAccessItem(
    navSections,
    currentModuleId,
    businessType,
    commercialActivities
  );

  const isPedidosModule = activeItem?.id === "pedidos";

  // Polling de pedidos pendientes solo si el módulo activo es 'pedidos' y tiene permisos
  useEffect(() => {
    if (!isPedidosModule || !canViewOrders) {
      setPendingOrdersCount(null);
      return;
    }

    let isMounted = true;

    const fetchPendingOrders = async () => {
      try {
        const res = await getRestaurantOrdersSummaryAction(businessId);
        if (res.success && res.data && isMounted) {
          const activePending =
            (res.data.received || 0) +
            (res.data.inPreparation || 0) +
            (res.data.ready || 0);
          setPendingOrdersCount(activePending);
        }
      } catch {
        // En caso de error silencioso se omite el conteo
      }
    };

    fetchPendingOrders();
    const interval = setInterval(fetchPendingOrders, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [businessId, isPedidosModule, canViewOrders]);

  if (!activeItem) return null;

  const IconComponent = activeItem.icon || UtensilsCrossed;

  return (
    <Link
      href={activeItem.href}
      className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 dark:text-slate-200 dark:hover:text-white dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200/80 dark:border-white/[0.08] transition-colors shadow-2xs group focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
      title={`Acceso rápido a ${activeItem.label}`}
      data-testid="header-quick-access"
      data-module-id={activeItem.id}
    >
      <IconComponent className="w-4 h-4 text-[#ED500A] shrink-0 transition-transform group-hover:scale-105" />
      <span className="text-xs font-semibold tracking-tight text-slate-800 dark:text-slate-200 whitespace-nowrap">
        {activeItem.label}
      </span>
      {isPedidosModule && typeof pendingOrdersCount === "number" && pendingOrdersCount > 0 && (
        <span className="min-w-4 h-4 px-1 rounded-full bg-[#ED500A] text-white text-[10px] font-black flex items-center justify-center animate-in zoom-in-50 shadow-xs">
          {pendingOrdersCount > 99 ? "99+" : pendingOrdersCount}
        </span>
      )}
    </Link>
  );
}

/**
 * Re-export retrocompatible para componentes y pruebas existentes
 */
export const WorkspaceOrdersHeaderBadge = WorkspaceHeaderQuickAccess;
