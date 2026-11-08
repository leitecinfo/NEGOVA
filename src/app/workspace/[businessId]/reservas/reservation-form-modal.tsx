"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, Select } from "@/components/ui";
import {
  X,
  Calendar,
  Clock,
  Users,
  User,
  Phone,
  Mail,
  UtensilsCrossed,
  Sparkles,
  AlertCircle,
  FileText,
  Check,
  Building2,
  Receipt,
  FileCheck,
  AlertTriangle,
  Armchair,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { createReservationAction, updateReservationAction } from "./actions";
import type {
  ReservationWithDetails,
  CreateReservationInput,
  ReservationStatus,
  ReservationOrigin,
} from "@/lib/reservations/types";
import type { RestaurantRoom, RestaurantTableWithOrder } from "@/lib/restaurant/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  reservation?: ReservationWithDetails | null;
  rooms: RestaurantRoom[];
  tables: RestaurantTableWithOrder[];
  initialDate?: string;
  onSuccess: (saved: ReservationWithDetails) => void;
}

const HOURS_PRESETS = [
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
];

export function ReservationFormModal({
  isOpen,
  onClose,
  businessId,
  reservation,
  rooms,
  tables,
  initialDate,
  onSuccess,
}: Props) {
  const isEditing = Boolean(reservation);

  // 3 Pestañas según especificación exacta: [ Información Básica ] [ Detalles ] [ Facturación ]
  const [activeTab, setActiveTab] = useState<"info" | "details" | "billing">("info");

  // Pestaña 1: Información Básica
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState<number>(2);
  const [date, setDate] = useState(initialDate || new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("13:00");
  const [roomId, setRoomId] = useState<string>("");
  const [origin, setOrigin] = useState<ReservationOrigin>("direct");
  const [tableId, setTableId] = useState<string>("");
  const [status, setStatus] = useState<ReservationStatus>("confirmed");

  // Pestaña 2: Detalles
  const [specialRequests, setSpecialRequests] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");

  // Pestaña 3: Facturación
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState(""); // RUC / NIT
  const [fiscalAddress, setFiscalAddress] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (reservation) {
      setCustomerName(reservation.customer_name);
      setPhone(reservation.phone || "");
      setEmail(reservation.email || "");
      setPartySize(reservation.party_size || 2);
      setOrigin(reservation.origin || "direct");
      setDate(reservation.date);
      setTime(reservation.time ? reservation.time.slice(0, 5) : "13:00");
      setRoomId(reservation.room_id || "");
      setTableId(reservation.table_id || "");
      setStatus(reservation.status);
      setSpecialRequests(reservation.special_requests || "");
      setAllergies(reservation.allergies || "");

      // Extraer datos de facturación si están guardados en notes
      const notesRaw = reservation.notes || "";
      const billingMatch = notesRaw.match(/\[FACTURACION:([^\]]+)\]/);
      if (billingMatch && billingMatch[1]) {
        try {
          const parsed = JSON.parse(billingMatch[1]);
          setCompanyName(parsed.companyName || "");
          setTaxId(parsed.taxId || "");
          setFiscalAddress(parsed.fiscalAddress || "");
        } catch {
          // Fallback
        }
        setNotes(notesRaw.replace(/\[FACTURACION:[^\]]+\]/, "").trim());
      } else {
        setNotes(notesRaw);
        setCompanyName("");
        setTaxId("");
        setFiscalAddress("");
      }
    } else {
      setCustomerName("");
      setPhone("");
      setEmail("");
      setPartySize(2);
      setOrigin("direct");
      setDate(initialDate || new Date().toISOString().split("T")[0]);
      setTime("13:00");
      setRoomId("");
      setTableId("");
      setStatus("confirmed");
      setSpecialRequests("");
      setAllergies("");
      setNotes("");
      setCompanyName("");
      setTaxId("");
      setFiscalAddress("");
      setActiveTab("info");
    }
  }, [reservation, initialDate, isOpen]);

  const filteredModalTables = useMemo(() => {
    if (!roomId) return tables;
    return tables.filter((t) => t.room_id === roomId);
  }, [tables, roomId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error("El nombre del cliente es obligatorio.");
      setActiveTab("info");
      return;
    }

    if (partySize < 1) {
      toast.error("La reserva debe ser para al menos 1 persona.");
      setActiveTab("info");
      return;
    }

    if (!date || !time) {
      toast.error("Indica la fecha y hora de la reserva.");
      setActiveTab("info");
      return;
    }

    setIsSubmitting(true);
    try {
      // Ensamblar notas con datos de facturación si fueron suministrados
      let combinedNotes = notes.trim();
      if (companyName.trim() || taxId.trim() || fiscalAddress.trim()) {
        const billingPayload = JSON.stringify({
          companyName: companyName.trim(),
          taxId: taxId.trim(),
          fiscalAddress: fiscalAddress.trim(),
        });
        combinedNotes = combinedNotes
          ? `${combinedNotes} [FACTURACION:${billingPayload}]`
          : `[FACTURACION:${billingPayload}]`;
      }

      const payload: CreateReservationInput = {
        customer_name: customerName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        party_size: partySize,
        date,
        time,
        room_id: roomId || null,
        table_id: tableId || null,
        status,
        origin,
        special_requests: specialRequests.trim() || null,
        allergies: allergies.trim() || null,
        notes: combinedNotes || null,
        min_spend: 0,
        deposit_amount: 0,
      };

      if (isEditing && reservation) {
        const res = await updateReservationAction(businessId, reservation.id, payload);
        if (!res.success || !res.data) {
          toast.error(res.error || "No se pudo actualizar la reserva.");
          return;
        }

        toast.success(`Reserva de «${res.data.customer_name}» actualizada exitosamente.`);
        onSuccess(res.data);
        onClose();
      } else {
        const res = await createReservationAction(businessId, payload);
        if (!res.success || !res.data) {
          toast.error(res.error || "No fue posible registrar la reserva.");
          return;
        }

        toast.success(`Reserva para ${res.data.party_size} personas a nombre de «${res.data.customer_name}» confirmada a las ${res.data.time}.`);
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Error al procesar la reserva.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEditing ? "Modificar Reserva" : "Nueva Reserva"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isEditing
                    ? "Actualiza los datos o comensales de la reserva."
                    : "Registra una reserva o comensales para el restaurante."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Selector de tres pestañas superiores: [ Información Básica ] [ Detalles ] [ Facturación ] */}
          <div className="flex items-center border-b border-slate-200/80 dark:border-white/[0.06] bg-slate-100/50 dark:bg-white/[0.02] px-6">
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
                activeTab === "info"
                  ? "border-[#ED500A] text-[#ED500A]"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Información Básica
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
                activeTab === "details"
                  ? "border-[#ED500A] text-[#ED500A]"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Detalles
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("billing")}
              className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
                activeTab === "billing"
                  ? "border-[#ED500A] text-[#ED500A]"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Facturación
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* PESTAÑA 1: INFORMACIÓN BÁSICA */}
            {activeTab === "info" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Nombre del cliente */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre del Cliente *
                  </label>
                  <Input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej. Carolina Montoya"
                    startAdornment={<User className="w-4 h-4 text-slate-400" />}
                    inputSize="md"
                  />
                </div>

                {/* Teléfono y Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Teléfono / WhatsApp
                    </label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej. +57 300 123 4567"
                      startAdornment={<Phone className="w-4 h-4 text-slate-400" />}
                      inputSize="md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="cliente@ejemplo.com"
                      startAdornment={<Mail className="w-4 h-4 text-slate-400" />}
                      inputSize="md"
                    />
                  </div>
                </div>

                {/* Número de Personas, Fecha y Hora */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Número de personas */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Número de Personas *
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={partySize}
                      onChange={(e) => setPartySize(Math.max(1, parseInt(e.target.value) || 1))}
                      startAdornment={<Users className="w-4 h-4 text-slate-400" />}
                      inputSize="md"
                      className="font-mono font-bold"
                    />
                  </div>

                  {/* Fecha */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Fecha de Reserva *
                    </label>
                    <Input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      startAdornment={<Calendar className="w-4 h-4 text-slate-400" />}
                      inputSize="md"
                      className="font-mono"
                    />
                  </div>

                  {/* Hora */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Hora *
                    </label>
                    <Select
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      selectSize="md"
                    >
                      {HOURS_PRESETS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Sala y Mesa asignada */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sala / Salón (Opcional)
                    </label>
                    <Select
                      value={roomId}
                      onChange={(e) => {
                        setRoomId(e.target.value);
                        setTableId("");
                      }}
                      selectSize="md"
                    >
                      <option value="">Cualquier sala / Sin asignar</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Mesa Asignada (Opcional)
                    </label>
                    <Select
                      value={tableId}
                      onChange={(e) => {
                        const tId = e.target.value;
                        setTableId(tId);
                        if (tId) {
                          const tbl = tables.find((t) => t.id === tId);
                          if (tbl?.room_id) setRoomId(tbl.room_id);
                        }
                      }}
                      selectSize="md"
                    >
                      <option value="">Sin mesa asignada (asignar después)</option>
                      {filteredModalTables.map((tbl: RestaurantTableWithOrder) => (
                        <option key={tbl.id} value={tbl.id}>
                          Mesa {tbl.name_or_number} (Capacidad: {tbl.capacity} comensales)
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Origen de la Reserva y Estado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Origen de la Reserva
                    </label>
                    <Select
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value as ReservationOrigin)}
                      selectSize="md"
                    >
                      <option value="direct">Manual / Directo</option>
                      <option value="phone">Teléfono</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="web">Online / Web</option>
                      <option value="walk_in">Walk-in (Sin reserva previa)</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Estado Inicial
                    </label>
                    <Select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ReservationStatus)}
                      selectSize="md"
                    >
                      <option value="confirmed">Confirmada</option>
                      <option value="pending">Pendiente</option>
                      <option value="checked_in">Check-in (Llegó al local)</option>
                      <option value="seated">En Mesa (Sentado)</option>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* PESTAÑA 2: DETALLES */}
            {activeTab === "details" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Solicitudes especiales */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Solicitudes Especiales
                  </label>
                  <textarea
                    rows={2}
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="Ubicación preferida, celebración especial, silla para bebé..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                  />
                </div>

                {/* Alergias e intolerancias destacadas */}
                <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                  <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Alergias e Intolerancias</span>
                  </label>
                  <textarea
                    rows={2}
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Detallar alergias alimentarias o intolerancias (maní, mariscos, gluten, lactosa)..."
                    className="w-full p-2.5 rounded-xl border border-amber-500/30 bg-white dark:bg-[#0D0F16] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                {/* Notas adicionales */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Notas Adicionales
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observaciones internas del equipo de servicio..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                  />
                </div>
              </div>
            )}

            {/* PESTAÑA 3: FACTURACIÓN */}
            {activeTab === "billing" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
                  <Receipt className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Información para facturación (opcional)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Datos fiscales del cliente o empresa para emisión de comprobante y facturación electrónica.
                    </p>
                  </div>
                </div>

                {/* Nombre de la empresa */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre de la Empresa
                  </label>
                  <Input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Razón social o nombre corporativo"
                    startAdornment={<Building2 className="w-4 h-4 text-slate-400" />}
                    inputSize="md"
                  />
                </div>

                {/* RUC / NIT */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    RUC / NIT
                  </label>
                  <Input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="Número de identificación fiscal o tributario"
                    startAdornment={<FileCheck className="w-4 h-4 text-slate-400" />}
                    inputSize="md"
                    className="font-mono"
                  />
                </div>

                {/* Dirección fiscal */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dirección Fiscal
                  </label>
                  <textarea
                    rows={2}
                    value={fiscalAddress}
                    onChange={(e) => setFiscalAddress(e.target.value)}
                    placeholder="Dirección de despacho o domicilio tributario..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                  />
                </div>
              </div>
            )}

            {/* Acciones de Cierre del Modal: Navegación de Pestañas + Confirmar */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-3">
              <div>
                {activeTab === "details" && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("info")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                )}
                {activeTab === "billing" && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("details")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                {activeTab === "info" && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("details")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-[#ED500A] text-xs font-bold hover:bg-orange-500/20 transition-all cursor-pointer"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {activeTab === "details" && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("billing")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-[#ED500A] text-xs font-bold hover:bg-orange-500/20 transition-all cursor-pointer"
                  >
                    <span>Facturación</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white text-xs font-semibold transition-all shadow-md shadow-orange-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Guardando..."
                    : isEditing
                    ? "Guardar Cambios"
                    : "Crear Reserva"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
