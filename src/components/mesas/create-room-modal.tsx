"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, Select } from "@/components/ui";
import { Layers, X, Loader2, AlertCircle, PlusCircle } from "lucide-react";
import { createRestaurantRoomAction } from "@/app/workspace/[businessId]/mesas/actions";
import { toast } from "sonner";
import { RestaurantRoom } from "@/lib/restaurant/types";

interface CreateRoomModalProps {
  isOpen: boolean;
  businessId: string;
  locations?: { id: string; name: string }[];
  onClose: () => void;
  onSuccess?: (room: RestaurantRoom) => void;
  onCreated?: (room: RestaurantRoom) => void;
}

export function CreateRoomModal({
  isOpen,
  businessId,
  locations = [],
  onClose,
  onSuccess,
  onCreated,
}: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickNames = ["Terraza", "Interior", "Barra", "VIP", "Jardín"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("El nombre de la sala o ambiente es obligatorio.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createRestaurantRoomAction(businessId, {
        name: cleanName,
        description: description.trim() || undefined,
        location_id: locationId || undefined,
        status: "active",
        sort_order: 0,
      });

      if (res.success && res.room) {
        toast.success(`Sala «${res.room.name}» creada exitosamente`);
        onSuccess?.(res.room);
        onCreated?.(res.room);
        onClose();
      } else {
        setError(res.error || "No se pudo registrar la sala.");
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado al crear la sala.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-body"
        >
          {/* HEADER */}
          <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Crear Nueva Sala
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ambiente o zona del restaurante para agrupar mesas
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* NOMBRE DE LA SALA */}
            <div className="space-y-1.5">
              <Input
                label="Nombre de la Sala / Ambiente *"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Terraza, Interior, Barra..."
              />

              {/* ATAJOS RÁPIDOS */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {quickNames.map((qn) => (
                  <button
                    key={qn}
                    type="button"
                    onClick={() => setName(qn)}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-[#ED500A] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5 transition-colors cursor-pointer"
                  >
                    {qn}
                  </button>
                ))}
              </div>
            </div>

            {/* UBICACIÓN ASOCIADA (OPCIONAL) */}
            {locations.length > 0 && (
              <div>
                <Select
                  label="Ubicación Física (Opcional)"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  <option value="">Ubicación Principal</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* DESCRIPCIÓN */}
            <div className="space-y-1.5">
              <label
                htmlFor="room-desc-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Descripción (Opcional)
              </label>
              <textarea
                id="room-desc-input"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Zona al aire libre para fumadores, mesas altas..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              />
            </div>

            {/* ACCIONES */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#ED500A] hover:bg-[#d64508] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando sala...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Crear Sala</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

