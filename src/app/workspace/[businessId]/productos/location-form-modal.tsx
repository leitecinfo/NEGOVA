"use client";

import React, { useState } from "react";
import { X, MapPin, Store, Warehouse, Building2, QrCode, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { LocationType } from "@/lib/inventory/types";
import { createLocationAction } from "./inventory-actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LocationFormModal({ businessId, isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>("warehouse");
  const [address, setAddress] = useState("");
  const [isVisibleInMenu, setIsVisibleInMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("El nombre de la ubicación es obligatorio");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createLocationAction(businessId, {
        name: name.trim(),
        type,
        address: address.trim() || undefined,
        isVisibleInMenu,
        isActive: true,
      });

      if (!res.success || !res.data) {
        toast.error("Error al crear ubicación", {
          description: res.error || "No se pudo registrar la ubicación.",
        });
        return;
      }

      toast.success("Ubicación creada exitosamente", {
        description: `Se configuró "${res.data.name}" como ${
          type === "warehouse" ? "Bodega" : type === "point_of_sale" ? "Punto de Venta" : "Sucursal"
        }.`,
      });

      setName("");
      setAddress("");
      setIsVisibleInMenu(false);
      setType("warehouse");
      onClose();
      onSuccess?.();
    } catch (err: any) {
      toast.error("Error inesperado", {
        description: err.message || "Ocurrió un error al procesar la solicitud.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="px-6 py-4.5 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center border border-[#ED500A]/20">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Nueva Ubicación de Stock
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Puntos de venta, bodegas o almacenes de inventario.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5">
          {/* Nombre de la Ubicación */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nombre de la Ubicación <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Bodega Central, Barra Principal, Depósito 2..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
            />
          </div>

          {/* Tipo de Ubicación */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tipo de Espacio
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType("point_of_sale")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  type === "point_of_sale"
                    ? "bg-[#ED500A]/10 border-[#ED500A] text-[#ED500A]"
                    : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                }`}
              >
                <Store className="w-5 h-5 mb-1" />
                <span className="text-xs font-semibold">Punto Venta</span>
              </button>

              <button
                type="button"
                onClick={() => setType("warehouse")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  type === "warehouse"
                    ? "bg-[#ED500A]/10 border-[#ED500A] text-[#ED500A]"
                    : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                }`}
              >
                <Warehouse className="w-5 h-5 mb-1" />
                <span className="text-xs font-semibold">Bodega</span>
              </button>

              <button
                type="button"
                onClick={() => setType("branch")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  type === "branch"
                    ? "bg-[#ED500A]/10 border-[#ED500A] text-[#ED500A]"
                    : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                }`}
              >
                <Building2 className="w-5 h-5 mb-1" />
                <span className="text-xs font-semibold">Sucursal</span>
              </button>
            </div>
          </div>

          {/* Dirección o Referencia */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Dirección o Referencia Física (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Calle 10 # 4-20, Piso 2, Zona de Enfriamiento..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
            />
          </div>

          {/* Switch Visible en Carta QR */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <QrCode className="w-4 h-4 text-indigo-500" />
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Visible en Menú QR
                </p>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Permite consultar o despachar stock desde la carta digital.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isVisibleInMenu}
                onChange={(e) => setIsVisibleInMenu(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-[#ED500A]"></div>
            </label>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creando Ubicación...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Crear Ubicación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

