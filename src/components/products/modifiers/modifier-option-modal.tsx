"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { ModifierOption, ModifierStatus } from "@/lib/modifiers/types";
import { formatCOP } from "@/lib/pos/types";
import { X, Sparkles, Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface ModifierOptionModalProps {
  isOpen: boolean;
  groupId: string;
  groupName: string;
  option?: ModifierOption | null;
  onClose: () => void;
  onSave: (data: { name: string; price: number; status: ModifierStatus }) => Promise<void>;
}

export function ModifierOptionModal({
  isOpen,
  groupId,
  groupName,
  option,
  onClose,
  onSave,
}: ModifierOptionModalProps) {
  const isEditing = Boolean(option);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [status, setStatus] = useState<ModifierStatus>("active");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (option) {
        setName(option.name);
        setPrice(String(option.price ?? 0));
        setStatus(option.status || "active");
      } else {
        setName("");
        setPrice("0");
        setStatus("active");
      }
    }
  }, [isOpen, option]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("El nombre de la opción es obligatorio");
      return;
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      toast.error("El precio debe ser un número mayor o igual a $0");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        name: trimmedName,
        price: numericPrice,
        status,
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar la opción");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEditing ? "Editar Opción" : "Nueva Opción"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Grupo: <span className="font-semibold text-slate-700 dark:text-slate-300">«{groupName}»</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nombre de la opción *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej: Extra Queso, Término Medio, Papas Francesas"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Ajuste de Precio (COP)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Ingresa <strong>$0</strong> si no tiene costo adicional, o el valor del complemento (ej: +$2.500).
              </p>
            </div>

            {/* Estado */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] rounded-xl">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Estado de la opción
                </span>
                <span className="text-[11px] text-slate-500">
                  {status === "active" ? "Disponible para selección" : "Pausada o agotada"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStatus(status === "active" ? "inactive" : "active")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  status === "active"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400"
                }`}
              >
                {status === "active" ? "Activo" : "Inactivo"}
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isEditing ? "Guardar Cambios" : "Agregar Opción"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
