"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Edit3, X, Trash2, Check } from "lucide-react";

interface PosEditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  currentNotes?: string;
  onSaveNotes: (notes: string) => void;
}

const QUICK_SUGGESTIONS = [
  "Sin cebolla",
  "Sin salsa",
  "Salsa aparte",
  "Bien cocido",
  "Término medio",
  "Poco picante",
  "Para llevar",
  "Urgente",
];

export function PosEditNoteModal({
  isOpen,
  onClose,
  itemName,
  currentNotes = "",
  onSaveNotes,
}: PosEditNoteModalProps) {
  const [notes, setNotes] = useState<string>(currentNotes || "");

  useEffect(() => {
    if (isOpen) {
      setNotes(currentNotes || "");
    }
  }, [isOpen, currentNotes]);

  if (!isOpen) return null;

  const handleChipClick = (suggestion: string) => {
    setNotes((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return suggestion;
      if (trimmed.toLowerCase().includes(suggestion.toLowerCase())) return prev;
      return `${trimmed}, ${suggestion}`;
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveNotes(notes.trim());
    onClose();
  };

  const handleRemove = () => {
    onSaveNotes("");
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
                <Edit3 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  Instrucciones y notas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                  {itemName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0 ml-2"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
            {/* Sugerencias rápidas */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Sugerencias rápidas
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SUGGESTIONS.map((sug) => {
                  const isIncluded = notes.toLowerCase().includes(sug.toLowerCase());
                  return (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleChipClick(sug)}
                      className={`px-2.5 py-1 rounded-xl text-2xs font-medium transition-all cursor-pointer ${
                        isIncluded
                          ? "bg-[#ED500A] text-white shadow-xs font-semibold"
                          : "bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.08]"
                      }`}
                    >
                      {sug}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campo de notas */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Nota o instrucción para cocina / preparación
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Sin cebolla, término medio, salsa aparte..."
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] resize-none"
                autoFocus
              />
            </div>

            {/* Pie del modal */}
            <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
              {currentNotes ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Quitar nota</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white font-semibold shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar nota</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
