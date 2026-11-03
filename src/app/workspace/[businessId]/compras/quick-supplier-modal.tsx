"use client";

import React, { useState, useMemo } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  Hash,
  Clock,
  Loader2,
  User,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { createQuickSupplierAction } from "./actions";
import { Supplier } from "@/lib/purchases/types";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSupplier: Supplier) => void;
}

export const PAYMENT_TERMS_OPTIONS = [
  { value: "none", label: "Sin definir (sin vencimiento programado)", days: 0 },
  { value: "0", label: "De contado (0 días)", days: 0 },
  { value: "8", label: "8 días", days: 8 },
  { value: "15", label: "15 días", days: 15 },
  { value: "30", label: "30 días (1 mes)", days: 30 },
  { value: "45", label: "45 días", days: 45 },
  { value: "60", label: "60 días (2 meses)", days: 60 },
  { value: "90", label: "90 días (3 meses)", days: 90 },
  { value: "custom", label: "Otro plazo personalizado...", days: 0 },
];

export function QuickSupplierModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  // Bloque 1: Identificación
  const [name, setName] = useState("");
  const [nitBase, setNitBase] = useState("");
  const [dv, setDv] = useState("");

  // Bloque 2: Contacto
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  // Bloque 3: Condiciones
  const [termSelection, setTermSelection] = useState("30");
  const [customDays, setCustomDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resumen del plazo para el pie del modal
  const resolvedTermLabel = useMemo(() => {
    switch (termSelection) {
      case "none":
        return "Sin definir";
      case "0":
        return "De contado";
      case "8":
        return "8 días";
      case "15":
        return "15 días";
      case "30":
        return "30 días";
      case "45":
        return "45 días";
      case "60":
        return "60 días";
      case "90":
        return "90 días";
      case "custom":
        return `${customDays.trim() || 0} días`;
      default:
        return "Sin definir";
    }
  }, [termSelection, customDays]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre o razón social del proveedor es obligatorio.");
      return;
    }

    // Armar NIT/Cédula con DV
    const cleanNit = nitBase.trim();
    const cleanDv = dv.trim();
    let combinedTaxId: string | undefined = undefined;
    if (cleanNit && cleanDv) {
      combinedTaxId = `${cleanNit}-${cleanDv}`;
    } else if (cleanNit) {
      combinedTaxId = cleanNit;
    }

    // Calcular días de crédito
    let calculatedDays = 0;
    if (termSelection === "none") {
      calculatedDays = 0;
    } else if (termSelection === "custom") {
      calculatedDays = Math.max(0, parseInt(customDays, 10) || 0);
    } else {
      calculatedDays = Math.max(0, parseInt(termSelection, 10) || 0);
    }

    setIsSubmitting(true);
    try {
      const res = await createQuickSupplierAction(businessId, {
        name: name.trim(),
        taxId: combinedTaxId,
        contactName: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        paymentTermsDays: calculatedDays,
        notes: notes.trim() || undefined,
      });

      if (!res.success || !res.data) {
        toast.error("Error al registrar proveedor", {
          description: res.error || "Verifica los datos e intenta nuevamente.",
        });
        return;
      }

      toast.success("Proveedor creado exitosamente", {
        description: `«${res.data.name}» se asoció automáticamente a la orden de compra.`,
      });

      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      toast.error("Error inesperado al crear proveedor", {
        description: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#ED500A]/10 text-[#ED500A]">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Crear Proveedor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Solo el nombre es obligatorio; el resto lo puedes completar después.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-6 overflow-y-auto text-xs"
          >
            {/* ============================================================== */}
            {/* BLOQUE 1: IDENTIFICACIÓN                                       */}
            {/* ============================================================== */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-white/[0.06]">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#ED500A]/10 text-[#ED500A] text-2xs font-bold">
                  1
                </span>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Bloque 1: Identificación
                </h4>
              </div>

              {/* Nombre o razón social (*) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nombre o razón social <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Distribuidora Avícola San Antonio S.A.S."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] font-medium"
                  />
                </div>
              </div>

              {/* NIT o cédula (opcional) con campo independiente para DV */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  NIT o cédula <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={nitBase}
                      onChange={(e) => setNitBase(e.target.value)}
                      placeholder="Ej: 901234567"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] font-mono"
                    />
                  </div>
                  <span className="text-slate-400 font-bold font-mono">-</span>
                  <div className="w-16">
                    <input
                      type="text"
                      maxLength={1}
                      value={dv}
                      onChange={(e) => setDv(e.target.value.replace(/\D/g, ""))}
                      placeholder="DV"
                      title="Dígito de verificación (1 dígito)"
                      className="w-full px-2.5 py-2 text-xs text-center rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] font-mono font-bold"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Número principal y dígito de verificación independiente.
                </p>
              </div>
            </div>

            {/* ============================================================== */}
            {/* BLOQUE 2: CONTACTO                                             */}
            {/* ============================================================== */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-white/[0.06]">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#ED500A]/10 text-[#ED500A] text-2xs font-bold">
                  2
                </span>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Bloque 2: Contacto
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Persona de contacto (opcional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Persona de contacto <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Ej: Laura Gómez (Asesora comercial)"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                    />
                  </div>
                </div>

                {/* Teléfono o celular (opcional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Teléfono o celular <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej: +57 310 123 4567"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Correo (opcional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Correo <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="pedidos@proveedor.com"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                    />
                  </div>
                </div>

                {/* Dirección física de entrega (opcional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Dirección física de entrega <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ej: Carrera 45 # 12-34 Bodega 3, Medellín"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* BLOQUE 3: CONDICIONES                                          */}
            {/* ============================================================== */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-white/[0.06]">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#ED500A]/10 text-[#ED500A] text-2xs font-bold">
                  3
                </span>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Bloque 3: Condiciones
                </h4>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Plazo de pago
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <select
                    value={termSelection}
                    onChange={(e) => setTermSelection(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] cursor-pointer"
                  >
                    {PAYMENT_TERMS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Automatiza el cálculo de vencimientos en compras a crédito.
                </p>
              </div>

              {/* Plazo personalizado */}
              {termSelection === "custom" && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Días de crédito pactados
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder="Ej: 21"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] font-mono"
                  />
                </div>
              )}

              {/* Notas adicionales */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Notas adicionales <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Cuentas bancarias de transferencia, horarios de entrega o descuentos pactados..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] resize-none"
                />
              </div>
            </div>

            {/* ============================================================== */}
            {/* PIE DEL MODAL: RESUMEN LATERAL Y BOTONES                       */}
            {/* ============================================================== */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200/80 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] -mx-6 -mb-6 p-4 sm:p-5">
              {/* Resumen lateral con nombre y plazo configurado */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-slate-400 text-2xs uppercase font-bold shrink-0">
                  Resumen:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span
                    className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[150px] sm:max-w-[200px]"
                    title={name.trim() || "Sin nombre aún"}
                  >
                    {name.trim() || "Sin nombre aún"}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20 shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>Plazo: {resolvedTermLabel}</span>
                  </span>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-all shadow-md shadow-[#ED500A]/20 disabled:opacity-50 cursor-pointer active:scale-98"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Crear proveedor</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
