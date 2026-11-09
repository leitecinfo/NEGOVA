"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, Textarea } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Layers, X, AlertCircle, PlusCircle } from "lucide-react";
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
  onClose,
  onSuccess,
  onCreated,
}: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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
                {quickNames.map((qn) => {
                  const isSelected = name.trim().toLowerCase() === qn.toLowerCase();
                  return (
                    <button
                      key={qn}
                      type="button"
                      onClick={() => setName(qn)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#ED500A]/15 text-[#ED500A] border-[#ED500A]/30 shadow-2xs font-bold"
                          : "bg-slate-100 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-[#ED500A] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/5"
                      }`}
                    >
                      {qn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DESCRIPCIÓN */}
            <Textarea
              label="Descripción (Opcional)"
              id="room-desc-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Zona al aire libre para fumadores, mesas altas..."
            />

            {/* ACCIONES */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-white/5">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!name.trim()}
                isLoading={isSubmitting}
                leftIcon={<PlusCircle className="w-4 h-4" />}
              >
                Crear Sala
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

