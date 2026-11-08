"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, Button } from "@/components/ui";
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
      <div
        className="fixed inset-0 z-[10100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting) {
            onClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        >
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
            <Input
              label="Nombre de la opción"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Extra Queso, Término Medio, Papas Francesas"
            />

            <Input
              label="Ajuste de Precio (COP)"
              type="number"
              min="0"
              step="50"
              startAdornment={<span className="text-slate-400 text-sm font-semibold">$</span>}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              helperText="Ingresa $0 si no tiene costo adicional, o el valor del complemento (ej: +$2.500)."
            />

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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
              >
                {isEditing ? "Guardar Cambios" : "Agregar Opción"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
