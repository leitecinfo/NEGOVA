"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  MapPin,
  DollarSign,
  Clock,
  ShieldAlert,
  Palette,
  Layers,
  Sparkles,
  Loader2,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import {
  DeliveryZone,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  DeliveryZoneGeometry,
  DELIVERY_ZONE_PRESET_COLORS,
} from "@/lib/delivery/types";

interface ZoneFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  zoneToEdit?: DeliveryZone | null;
  draftGeometry?: DeliveryZoneGeometry | null;
  onSave: (
    input: CreateDeliveryZoneInput | UpdateDeliveryZoneInput
  ) => Promise<{ success: boolean; error?: string }>;
}

export function ZoneFormModal({
  isOpen,
  onClose,
  zoneToEdit,
  draftGeometry,
  onSave,
}: ZoneFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tariff, setTariff] = useState("5000");
  const [minOrder, setMinOrder] = useState("0");
  const [estimatedTimeMin, setEstimatedTimeMin] = useState("35");
  const [priority, setPriority] = useState("1");
  const [color, setColor] = useState("#ED500A");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [geometry, setGeometry] = useState<DeliveryZoneGeometry | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (zoneToEdit) {
      setName(zoneToEdit.name);
      setDescription(zoneToEdit.description || "");
      setTariff(String(zoneToEdit.tariff));
      setMinOrder(String(zoneToEdit.min_order));
      setEstimatedTimeMin(String(zoneToEdit.estimated_time_min));
      setPriority(String(zoneToEdit.priority));
      setColor(zoneToEdit.color);
      setStatus(zoneToEdit.status);
      setGeometry(zoneToEdit.geometry);
    } else {
      setName("");
      setDescription("");
      setTariff("5000");
      setMinOrder("0");
      setEstimatedTimeMin("35");
      setPriority("1");
      setColor("#ED500A");
      setStatus("active");
      setGeometry(
        draftGeometry || {
          type: "radius",
          center: { lat: 4.60971, lng: -74.08175 },
          radiusMeters: 3000,
        }
      );
    }
  }, [zoneToEdit, draftGeometry, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("El nombre de la zona es obligatorio.");
      return;
    }

    const numTariff = parseFloat(tariff);
    if (isNaN(numTariff) || numTariff < 0) {
      toast.error("Ingresa una tarifa válida (0 o superior).");
      return;
    }

    const numMinOrder = parseFloat(minOrder);
    if (isNaN(numMinOrder) || numMinOrder < 0) {
      toast.error("Ingresa un pedido mínimo válido.");
      return;
    }

    const numTime = parseInt(estimatedTimeMin, 10);
    if (isNaN(numTime) || numTime <= 0) {
      toast.error("Ingresa un tiempo estimado en minutos mayor a 0.");
      return;
    }

    const numPriority = parseInt(priority, 10);

    if (!geometry) {
      toast.error("La zona requiere una forma geográfica válida (radio o polígono).");
      return;
    }

    if (geometry.type === "polygon") {
      if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 3) {
        toast.error("El polígono requiere al menos 3 vértices dibujados en el mapa.");
        return;
      }
    } else if (geometry.type === "radius") {
      if (!geometry.center || typeof geometry.radiusMeters !== "number" || geometry.radiusMeters <= 0) {
        toast.error("El radio debe tener un punto central y una distancia válida.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const basePayload: CreateDeliveryZoneInput = {
        name: name.trim(),
        description: description.trim() || null,
        tariff: numTariff,
        min_order: numMinOrder,
        estimated_time_min: numTime,
        priority: isNaN(numPriority) ? 1 : numPriority,
        color,
        geometry,
        status,
      };

      const result = zoneToEdit
        ? await onSave({ ...basePayload, id: zoneToEdit.id })
        : await onSave(basePayload);

      if (result.success) {
        toast.success(
          zoneToEdit
            ? `Zona "${name}" actualizada con éxito.`
            : `Zona "${name}" creada con éxito.`
        );
        onClose();
      } else {
        toast.error(result.error || "No fue posible guardar la zona.");
      }
    } catch (err: any) {
      toast.error("Ocurrió un error inesperado al guardar la zona.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] rounded-3xl border border-slate-200 dark:border-white/[0.08] shadow-2xl overflow-hidden my-8">
        {/* ENCABEZADO */}
        <div className="p-5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: color }}
            >
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {zoneToEdit ? "Editar Zona de Entrega" : "Nueva Zona de Entrega"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configura tarifas de envío y tiempos estimados por cuadrante.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* NOMBRE Y DESCRIPCIÓN */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nombre de la zona *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Zona 1 - Centro / Chapinero"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descripción o notas (opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Desde Calle 26 hasta Calle 72"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
            />
          </div>

          {/* TARIFA Y PEDIDO MÍNIMO */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tarifa de domicilio (COP) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={tariff}
                  onChange={(e) => setTariff(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pedido mínimo (COP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-xs font-mono bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                />
              </div>
            </div>
          </div>

          {/* TIEMPO ESTIMADO Y PRIORIDAD */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tiempo estimado (min) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="5"
                  max="180"
                  required
                  value={estimatedTimeMin}
                  onChange={(e) => setEstimatedTimeMin(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                  min
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Prioridad de solapamiento
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                title="Si dos zonas se cruzan, aplica la de mayor prioridad"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
              />
            </div>
          </div>

          {/* COLOR DISTINTIVO */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Color en el mapa
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {DELIVERY_ZONE_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-xl transition-all flex items-center justify-center ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-[#ED500A] scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <CheckCircle2 className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* TIPO DE GEOMETRÍA & RESUMEN */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#ED500A]" />
                Geometría asignada:
              </span>
              <span className="font-bold text-[#ED500A] uppercase text-[11px]">
                {geometry?.type === "radius" ? "Radio Circular" : "Polígono Libre"}
              </span>
            </div>
            {geometry?.type === "radius" && (
              <p className="text-slate-500 dark:text-slate-400">
                Radio de{" "}
                <strong>{((geometry.radiusMeters || 3000) / 1000).toFixed(1)} km</strong>{" "}
                alrededor de [{geometry.center?.lat.toFixed(4)},{" "}
                {geometry.center?.lng.toFixed(4)}]
              </p>
            )}
            {geometry?.type === "polygon" && (
              <p className="text-slate-500 dark:text-slate-400">
                Polígono cerrado con{" "}
                <strong>{geometry.coordinates?.length || 0} vértices</strong> dibujados.
              </p>
            )}
          </div>

          {/* ESTADO ACTIVA / INACTIVA */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08]">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Estado de la zona
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {status === "active"
                  ? "Zona habilitada para calcular tarifas en POS y pedidos."
                  : "Zona inactiva (no se aplicará en ventas)."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStatus(status === "active" ? "inactive" : "active")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                status === "active"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400"
              }`}
            >
              {status === "active" ? "Activa" : "Inactiva"}
            </button>
          </div>

          {/* BOTONES */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-md active:scale-98 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{zoneToEdit ? "Actualizar Zona" : "Crear Zona"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
