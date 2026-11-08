"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { X, Check, UtensilsCrossed, Users, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { assignReservationTableAction } from "./actions";
import type { ReservationWithDetails } from "@/lib/reservations/types";
import type { RestaurantRoom, RestaurantTableWithOrder } from "@/lib/restaurant/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  reservation: ReservationWithDetails | null;
  rooms: RestaurantRoom[];
  tables: RestaurantTableWithOrder[];
  onAssigned: (updated: ReservationWithDetails) => void;
}

export function AssignTableModal({
  isOpen,
  onClose,
  businessId,
  reservation,
  rooms,
  tables,
  onAssigned,
}: Props) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (reservation) {
      setSelectedRoomId(reservation.room_id || "all");
      setSelectedTableId(reservation.table_id || "");
    }
  }, [reservation]);

  if (!isOpen || !reservation) return null;

  const filteredTables = tables.filter((t) => {
    if (selectedRoomId !== "all" && t.room_id !== selectedRoomId) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await assignReservationTableAction(businessId, {
        reservationId: reservation.id,
        tableId: selectedTableId || null,
        roomId: selectedRoomId !== "all" ? selectedRoomId : null,
      });

      if (!res.success || !res.data) {
        toast.error("Error al asignar mesa", {
          description: res.error || "No se pudo actualizar la mesa de la reserva.",
        });
        return;
      }

      toast.success("Mesa asignada con éxito", {
        description: res.data.table_name_or_number
          ? `Reserva de «${reservation.customer_name}» asignada a Mesa ${res.data.table_name_or_number}.`
          : `Mesa desasignada de la reserva de «${reservation.customer_name}».`,
      });

      onAssigned(res.data);
      onClose();
    } catch (err: any) {
      toast.error("Error inesperado", {
        description: err.message || "Ocurrió un problema al guardar la asignación.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Asignar Mesa a Reserva
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {reservation.customer_name} • {reservation.party_size} personas • {reservation.time} ({reservation.date})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
            {/* Filtro de Sala */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Filtrar por Sala
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedRoomId("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                    selectedRoomId === "all"
                      ? "bg-[#ED500A] text-white shadow-xs"
                      : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.08]"
                  }`}
                >
                  Todas las Salas
                </button>
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                      selectedRoomId === room.id
                        ? "bg-[#ED500A] text-white shadow-xs"
                        : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.08]"
                    }`}
                  >
                    {room.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de Mesas en Cuadrícula */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Selecciona la Mesa
              </label>

              {filteredTables.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-400 text-xs">
                  No hay mesas configuradas en esta sala.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1 border border-slate-100 dark:border-white/[0.06] rounded-xl bg-slate-50/50 dark:bg-white/[0.01]">
                  {/* Opción de Sin Mesa Asignada */}
                  <button
                    type="button"
                    onClick={() => setSelectedTableId("")}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedTableId === ""
                        ? "border-[#ED500A] bg-[#ED500A]/5 text-[#ED500A] ring-1 ring-[#ED500A]"
                        : "border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-[#12151F] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-xs font-bold">Sin Mesa Asignada</span>
                    <span className="text-[10px] text-slate-400">Pendiente de ubicar</span>
                  </button>

                  {filteredTables.map((table) => {
                    const isSelected = selectedTableId === table.id;
                    const isOccupied = table.status === "occupied";
                    const isRecommended = (table.capacity || 4) >= reservation.party_size;

                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => setSelectedTableId(table.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between relative ${
                          isSelected
                            ? "border-[#ED500A] bg-[#ED500A]/5 text-[#ED500A] ring-1 ring-[#ED500A]"
                            : "border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-[#12151F] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/[0.12]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Mesa {table.name_or_number}
                          </span>
                          {isRecommended && (
                            <span title="Capacidad óptima para el grupo">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Cap: {table.capacity || 4}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase ${
                              isOccupied
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {isOccupied ? "Ocupada" : "Libre"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? "Guardando..." : "Confirmar Mesa"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

