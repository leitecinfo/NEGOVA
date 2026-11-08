"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, LogOut } from "lucide-react";
import { ModalPortal } from "./modal-portal";
import { Button } from "./button";

export interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  title?: string;
  description?: string;
  lockScroll?: boolean;
}

export function LogoutModal({
  isOpen,
  onClose,
  userEmail,
  title = "¿Cerrar sesión?",
  description,
  lockScroll = true,
}: LogoutModalProps) {
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
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      // 1. Limpiar sesión en Supabase del lado del cliente sin bloquear si hay latencia
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await Promise.race([
          supabase.auth.signOut({ scope: "local" }),
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
      } catch {
        // Continuar independientemente
      }

      // 2. Notificar al endpoint de servidor para purgar cookies de sesión
      await fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
    } catch {
      // Continuar con redirección incluso si la red falla
    } finally {
      // 3. Redirección inmediata y limpia reseteando el estado de la aplicación
      window.location.href = "/login";
    }
  };

  return (
    <ModalPortal lockScroll={lockScroll}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-desc"
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isLoggingOut) {
            onClose();
          }
        }}
      >
        {/* Ventana Modal */}
        <div
          className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl shadow-2xl p-6 z-10 animate-in zoom-in-95 duration-200 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera con Icono de Advertencia */}
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 id="logout-title" className="text-base font-bold text-slate-900 dark:text-white font-title">
                {title}
              </h2>
              <p id="logout-desc" className="text-xs text-slate-500 dark:text-slate-400 font-body leading-relaxed">
                {description || (
                  <>
                    Finalizarás la sesión activa
                    {userEmail ? (
                      <>
                        {" "}para{" "}
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{userEmail}</span>
                      </>
                    ) : null}
                    . Deberás autenticarte nuevamente para acceder al sistema.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Botones de Acción Canónicos */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoggingOut}
              onClick={onClose}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              isLoading={isLoggingOut}
              onClick={handleConfirmLogout}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// Retrocompatibilidad
export {
  LogoutModal as AdminLogoutModal,
  type LogoutModalProps as AdminLogoutModalProps,
};
