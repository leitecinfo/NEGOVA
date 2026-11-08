"use client";

import React, { useEffect } from "react";
import { AlertTriangle, Trash2, Ban, Info, CheckCircle2, X } from "lucide-react";
import { ModalPortal } from "./modal-portal";
import { Button } from "./button";

export type ConfirmModalVariant =
  | "danger"
  | "destructive"
  | "warning"
  | "default"
  | "primary"
  | "success";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  variant?: ConfirmModalVariant;
  isLoading?: boolean;
  children?: React.ReactNode;
  itemDetails?: { label: string; value: string }[];
  lockScroll?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  variant = "danger",
  isLoading = false,
  children,
  itemDetails,
  lockScroll = true,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const effectiveConfirmText = confirmText || confirmLabel || "Confirmar";
  const effectiveCancelText = cancelText || cancelLabel || "Cancelar";

  const isDestructive = variant === "danger" || variant === "destructive";
  const isWarning = variant === "warning";
  const isSuccess = variant === "success";

  const buttonVariant = isDestructive
    ? "destructive"
    : isWarning
    ? "warning"
    : isSuccess
    ? "success"
    : "primary";

  const iconVariants = {
    danger: (
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400">
        <Trash2 className="w-5 h-5" />
      </div>
    ),
    destructive: (
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400">
        <Ban className="w-5 h-5" />
      </div>
    ),
    warning: (
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-5 h-5" />
      </div>
    ),
    success: (
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-5 h-5" />
      </div>
    ),
    default: (
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-[#ED500A]">
        <Info className="w-5 h-5" />
      </div>
    ),
    primary: (
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-[#ED500A]">
        <Info className="w-5 h-5" />
      </div>
    ),
  };

  const currentIcon = iconVariants[variant] || iconVariants.danger;

  const handleConfirm = async () => {
    if (isLoading) return;
    await onConfirm();
  };

  return (
    <ModalPortal lockScroll={lockScroll}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isLoading) {
            onClose();
          }
        }}
      >
        <div
          className="w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {currentIcon}
              <div className="space-y-0.5 pt-0.5">
                <h3
                  id="confirm-modal-title"
                  className="text-base font-bold font-title text-slate-900 dark:text-white leading-snug"
                >
                  {title}
                </h3>
                {description && (
                  <p
                    id="confirm-modal-desc"
                    className="text-xs text-slate-500 dark:text-slate-400 font-body leading-relaxed"
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-30 shrink-0"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Desglose de ítems para auditoría si aplica */}
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

          {/* Contenido personalizado */}
          {children}

          {/* Botones de acción canónicos */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={onClose}
            >
              {effectiveCancelText}
            </Button>
            <Button
              type="button"
              variant={buttonVariant}
              size="sm"
              isLoading={isLoading}
              onClick={handleConfirm}
            >
              {effectiveConfirmText}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

