"use client";

import React, { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Ban, X, Info } from "lucide-react";
import { AdminButton } from "./admin-button";
import { ModalPortal } from "@/components/ui/modal-portal";

export type AdminConfirmVariant = "destructive" | "warning" | "primary" | "success";

export interface AdminConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: AdminConfirmVariant;
  isLoading?: boolean;
  itemDetails?: { label: string; value: string }[];
  reasonValue?: string;
  onReasonChange?: (reason: string) => void;
  reasonLabel?: string;
  reasonPlaceholder?: string;
}

const variantConfig: Record<
  AdminConfirmVariant,
  { icon: React.ReactNode; iconBg: string; buttonVariant: "destructive" | "primary" | "success" }
> = {
  destructive: {
    icon: <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />,
    iconBg: "bg-red-50 dark:bg-red-500/10",
    buttonVariant: "destructive",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
    iconBg: "bg-amber-50 dark:bg-amber-500/10",
    buttonVariant: "destructive",
  },
  primary: {
    icon: <Info className="w-5 h-5 text-[#ED500A]" />,
    iconBg: "bg-orange-50 dark:bg-orange-500/10",
    buttonVariant: "primary",
  },
  success: {
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
    buttonVariant: "success",
  },
};

export function AdminConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "destructive",
  isLoading = false,
  itemDetails,
  reasonValue,
  onReasonChange,
  reasonLabel = "Motivo / Justificación (Opcional):",
  reasonPlaceholder = "Ingresa el motivo de auditoría...",
}: AdminConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const config = variantConfig[variant];

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${config.iconBg}`}>
                {config.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white">
                  {title}
                </h3>
              </div>
            </div>
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-body">
            {description}
          </p>

          {itemDetails && itemDetails.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/5 space-y-1 font-mono text-xs">
              {itemDetails.map((detail, idx) => (
                <div key={idx} className="flex justify-between gap-2 text-slate-500 dark:text-slate-400">
                  <span>{detail.label}:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {onReasonChange && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 font-body">
                {reasonLabel}
              </label>
              <textarea
                value={reasonValue || ""}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder={reasonPlaceholder}
                rows={3}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.04] text-xs font-body text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <AdminButton
              variant="ghost"
              size="sm"
              disabled={isLoading}
              onClick={onClose}
            >
              {cancelLabel}
            </AdminButton>
            <AdminButton
              variant={config.buttonVariant}
              size="sm"
              isLoading={isLoading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AdminButton>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
