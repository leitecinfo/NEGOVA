"use client";

import React from "react";
import { AlertTriangle, Trash2, Info, Loader2 } from "lucide-react";
import { ModalPortal } from "./modal-portal";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  isLoading = false,
  children,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const iconVariants = {
    danger: (
      <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400">
        <Trash2 className="w-5 h-5" />
      </div>
    ),
    warning: (
      <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-5 h-5" />
      </div>
    ),
    default: (
      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
        <Info className="w-5 h-5" />
      </div>
    ),
  };

  const confirmButtonClasses = {
    danger:
      "bg-red-600 hover:bg-red-700 text-white shadow-sm focus:ring-red-500",
    warning:
      "bg-amber-600 hover:bg-amber-700 text-white shadow-sm focus:ring-amber-500",
    default:
      "bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-sm focus:ring-[#ED500A]",
  };

  const handleConfirm = async () => {
    if (isLoading) return;
    await onConfirm();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md bg-white dark:bg-[#10141d] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4"
        >
          <div className="flex items-start gap-4">
            {iconVariants[variant]}
            <div className="flex-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
                {title}
              </h3>
              {description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>

          {children}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${confirmButtonClasses[variant]}`}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
