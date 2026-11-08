"use client";

import React, { useEffect } from "react";
import { X, AlertTriangle, CheckCircle2, Info, AlertCircle } from "lucide-react";
import { ModalPortal } from "./modal-portal";
import { Button } from "./button";

export interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  type?: "info" | "warning" | "success" | "error";
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showConfirmButton?: boolean;
  showCancelButton?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  zIndex?: string;
  lockScroll?: boolean;
}

export function CustomModal({
  isOpen,
  onClose,
  title,
  description,
  type = "info",
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  showConfirmButton = true,
  showCancelButton = false,
  isLoading = false,
  children,
  maxWidth = "md",
  zIndex = "z-[9999]",
  lockScroll = true,
}: CustomModalProps) {
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

  const maxWidthClasses: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  };

  const iconVariants = {
    info: {
      icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
      buttonVariant: "primary" as const,
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
      buttonVariant: "warning" as const,
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
      bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20",
      buttonVariant: "destructive" as const,
    },
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
      buttonVariant: "success" as const,
    },
  };

  const currentVariant = iconVariants[type] || iconVariants.info;

  return (
    <ModalPortal lockScroll={lockScroll}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-modal-title"
        className={`fixed inset-0 m-0 p-4 ${zIndex} flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200`}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isLoading) {
            onClose();
          }
        }}
      >
        <div
          className={`w-full ${maxWidthClasses[maxWidth] || "max-w-md"} bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-150`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${currentVariant.bg}`}
              >
                {currentVariant.icon}
              </div>
              <div className="space-y-0.5 pt-0.5">
                <h3
                  id="custom-modal-title"
                  className="text-base font-bold font-title text-slate-900 dark:text-white"
                >
                  {title}
                </h3>
                {description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-body leading-relaxed">
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

          {/* Contenido / Cuerpo */}
          {children}

          {/* Botones de Acción */}
          {(showConfirmButton || showCancelButton) && (
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              {showCancelButton && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => {
                    if (onCancel) onCancel();
                    onClose();
                  }}
                >
                  {cancelText}
                </Button>
              )}
              {showConfirmButton && (
                <Button
                  variant={currentVariant.buttonVariant}
                  size="sm"
                  isLoading={isLoading}
                  onClick={() => {
                    if (onConfirm) onConfirm();
                    else onClose();
                  }}
                >
                  {confirmText}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

// Aliases para retrocompatibilidad
export const AdminCustomModal = CustomModal;
export type AdminCustomModalProps = CustomModalProps;
