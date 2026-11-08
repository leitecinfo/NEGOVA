"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Supplier } from "@/lib/purchases/types";
import { deleteSupplierAction } from "./actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
}

export function ConfirmDeleteSupplierModal({
  businessId,
  isOpen,
  supplier,
  onClose,
  onSuccess,
}: Props) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !supplier) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteSupplierAction(businessId, supplier.id);
      if (!res.success) {
        toast.error("Error al eliminar proveedor", {
          description: res.error || "No se pudo archivar el proveedor.",
        });
        return;
      }
      toast.success(`Proveedor «${supplier.name}» archivado correctamente.`);
      onSuccess(supplier.id);
      onClose();
    } catch (err: any) {
      toast.error("Error inesperado al eliminar proveedor.", {
        description: err?.message || "Ocurrió un error en el servidor.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-foreground">
                ¿Archivar proveedor?
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Esta acción no se puede deshacer de forma directa.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1">
            <p>
              Estás a punto de archivar a <strong className="text-foreground">{supplier.name}</strong>
              {supplier.taxId ? ` (NIT: ${supplier.taxId})` : ""}.
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              El historial de compras y cuentas por pagar pasadas se conservará para el historial financiero y kardex.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Archivando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sí, archivar proveedor</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

