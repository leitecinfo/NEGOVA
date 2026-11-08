"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Power, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { Supplier } from "@/lib/purchases/types";
import { toggleSupplierStatusAction } from "./actions";
import { toast } from "sonner";

interface Props {
  businessId: string;
  isOpen: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onSuccess: (updated: Supplier) => void;
}

export function ConfirmToggleStatusModal({
  businessId,
  isOpen,
  supplier,
  onClose,
  onSuccess,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !supplier) return null;

  const willDeactivate = supplier.status === "active";

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const nextStatus = willDeactivate ? "inactive" : "active";
      const res = await toggleSupplierStatusAction(businessId, supplier.id, nextStatus);
      if (!res.success || !res.data) {
        toast.error("Error al cambiar el estado del proveedor", {
          description: res.error || "No se pudo actualizar el estado.",
        });
        return;
      }

      toast.success(
        willDeactivate
          ? `Proveedor «${supplier.name}» desactivado.`
          : `Proveedor «${supplier.name}» reactivado correctamente.`
      );
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      toast.error("Error inesperado al cambiar estado", {
        description: err?.message || "Ocurrió un error en el servidor.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                willDeactivate
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              }`}
            >
              {willDeactivate ? (
                <Power className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-foreground">
                {willDeactivate ? "¿Desactivar proveedor?" : "¿Reactivar proveedor?"}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {supplier.name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-2">
            {willDeactivate ? (
              <>
                <p>
                  El proveedor <strong className="text-foreground">{supplier.name}</strong>{" "}
                  dejará de aparecer como opción sugerida para nuevas compras.
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Importante: Las compras históricas y cuentas por pagar pasadas asociadas se mantendrán intactas. Podrás reactivarlo en cualquier momento.
                </p>
              </>
            ) : (
              <p>
                El proveedor volverá a estar disponible como opción activa para registrar nuevas compras en tu negocio.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white transition-all shadow-md disabled:opacity-50 cursor-pointer ${
                willDeactivate
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{willDeactivate ? "Sí, desactivar" : "Sí, reactivar"}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
