"use client";

import React, { useState } from "react";
import {
  MapPin,
  Store,
  Warehouse,
  Building2,
  QrCode,
  Plus,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import { Location } from "@/lib/inventory/types";
import { LocationFormModal } from "./location-form-modal";
import { EmptyState } from "@/components/ui";

interface Props {
  businessId: string;
  locations: Location[];
  onRefresh: () => void;
}

export function InventoryLocationsTab({ businessId, locations, onRefresh }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const totalLocations = locations.length;
  const posCount = locations.filter((l) => l.type === "point_of_sale").length;
  const warehouseCount = locations.filter((l) => l.type === "warehouse").length;
  const qrVisibleCount = locations.filter((l) => l.isVisibleInMenu).length;

  const getLocationIcon = (type: string) => {
    switch (type) {
      case "point_of_sale":
        return <Store className="w-5 h-5 text-emerald-500" />;
      case "warehouse":
        return <Warehouse className="w-5 h-5 text-[#ED500A]" />;
      case "branch":
        return <Building2 className="w-5 h-5 text-indigo-500" />;
      default:
        return <MapPin className="w-5 h-5 text-slate-500" />;
    }
  };

  const getLocationTypeLabel = (type: string) => {
    switch (type) {
      case "point_of_sale":
        return "Punto de Venta";
      case "warehouse":
        return "Bodega / Almacén";
      case "branch":
        return "Sucursal";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs DE UBICACIONES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Ubicaciones
          </span>
          <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {totalLocations}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">
            Puntos de Venta
          </span>
          <h4 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {posCount}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">
            Bodegas / Depósitos
          </span>
          <h4 className="text-xl font-bold text-[#ED500A] mt-1">
            {warehouseCount}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">
            Visibles en Menú QR
          </span>
          <h4 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {qrVisibleCount}
          </h4>
        </div>
      </div>

      {/* ENCABEZADO Y BOTÓN CREAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Espacios Físicos y Almacenes
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define los puntos de despacho, almacenamiento y sucursales donde manejas inventario.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Ubicación</span>
        </button>
      </div>

      {/* TARJETAS DE UBICACIONES O ESTADO VACÍO [DS-002] */}
      {locations.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="No hay ubicaciones registradas"
          description="Crea bodegas, almacenes o puntos de venta para organizar el almacenamiento y control de inventario."
          actionLabel="Nueva Ubicación"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-white/[0.15] transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-center">
                      {getLocationIcon(loc.type)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {loc.name}
                      </h4>
                      <span className="inline-block text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 mt-0.5">
                        {getLocationTypeLabel(loc.type)}
                      </span>
                    </div>
                  </div>

                  {loc.isActive && (
                    <span className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Activa</span>
                    </span>
                  )}
                </div>

                {loc.address ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{loc.address}</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic mt-2">
                    Sin dirección física registrada
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {new Date(loc.createdAt).toLocaleDateString("es-CO", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>

                {loc.isVisibleInMenu ? (
                  <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                    <QrCode className="w-3 h-3" />
                    <span>En Menú QR</span>
                  </span>
                ) : (
                  <span className="text-slate-400">Uso interno</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <LocationFormModal
        businessId={businessId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={onRefresh}
      />
    </div>
  );
}

