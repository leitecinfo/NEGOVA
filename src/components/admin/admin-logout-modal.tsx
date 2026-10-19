"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LogOut, Loader2 } from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";

interface AdminLogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

export function AdminLogoutModal({ isOpen, onClose, userEmail }: AdminLogoutModalProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Cerrar al presionar Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isLoggingOut) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoggingOut, onClose]);

  if (!isOpen) return null;

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Usar endpoint de logout de servidor
      await fetch("/api/logout", { credentials: "include" });
    } catch {
      // Continuar con redirección incluso si falla
    } finally {
      setIsLoggingOut(false);
      onClose();
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <ModalPortal>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-desc"
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 m-0"
      >
      {/* Backdrop */}
      <div
        className="absolute top-0 left-0 right-0 bottom-0 w-full h-full bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={() => !isLoggingOut && onClose()}
      />

      {/* Ventana Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl p-6 z-50 animate-in zoom-in-95 duration-150 space-y-5">
        {/* Cabecera con Icono de Advertencia */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 id="logout-title" className="text-base font-bold text-slate-900 dark:text-white font-title">
              ¿Cerrar sesión de administrador?
            </h2>
            <p id="logout-desc" className="text-xs text-slate-500 dark:text-slate-400 font-body leading-relaxed">
              Finalizarás la sesión activa de plataforma para{" "}
              <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{userEmail}</span>.
              Deberás autenticarte nuevamente para acceder al panel.
            </p>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isLoggingOut}
            onClick={handleConfirmLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-sm disabled:opacity-50"
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Cerrando sesión...</span>
              </>
            ) : (
              <>
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar sesión</span>
              </>
            )}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}
