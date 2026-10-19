"use client";

import React from "react";
import { X, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { ModalPortal } from "./modal-portal";

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  type?: "info" | "warning" | "success" | "error";
  confirmText?: string;
  onConfirm?: () => void;
  showConfirmButton?: boolean;
  children?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
}

export function CustomModal({
  isOpen,
  onClose,
  title,
  description,
  type = "info",
  confirmText = "Aceptar",
  onConfirm,
  showConfirmButton = true,
  children,
  maxWidth = "md",
}: CustomModalProps) {
  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  };

  const icons = {
    info: <Info className="w-6 h-6 text-blue-600" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-600" />,
    error: <AlertTriangle className="w-6 h-6 text-red-600" />,
    success: <CheckCircle className="w-6 h-6 text-emerald-600" />,
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className={`w-full ${maxWidthClasses[maxWidth] || "max-w-md"} bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/50 dark:border-white/[0.08]">
              {icons[type]}
            </div>
            <h3 className="text-lg font-bold font-title text-slate-900 dark:text-white">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {description && (
          <p className="text-sm text-slate-600 dark:text-slate-300 font-body leading-relaxed">
            {description}
          </p>
        )}

        {children}

        {showConfirmButton && (
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                onClose();
              }}
              className="px-4 py-2 rounded-md bg-[#ED500A] text-white hover:bg-[#ab3500] font-medium text-sm transition-colors shadow-sm"
            >
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

