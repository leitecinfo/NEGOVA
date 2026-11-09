"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { SearchSelect } from "@/components/ui";
import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Loader2,
  User,
  FileText,
  CreditCard,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { Supplier, CreateSupplierInput, UpdateSupplierInput } from "@/lib/purchases/types";
import { createSupplierAction, updateSupplierAction } from "./actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  supplier?: Supplier | null;
  onClose: () => void;
  onSuccess: (supplier: Supplier) => void;
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

const CREDIT_TERMS_OPTIONS = [
  { value: "0", label: "De contado (0 días)" },
  { value: "8", label: "8 días" },
  { value: "15", label: "15 días" },
  { value: "30", label: "30 días (1 mes)" },
  { value: "45", label: "45 días" },
  { value: "60", label: "60 días (2 meses)" },
  { value: "90", label: "90 días (3 meses)" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Activo (habilitado para compras)" },
  { value: "inactive", label: "Inactivo (en pausa)" },
];

export function SupplierFormModal({
  businessId,
  isOpen,
  supplier,
  onClose,
  onSuccess,
}: Props) {
  const isEditing = Boolean(supplier);

  // Campos principales
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");

  // Información de contacto
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  // Información adicional y comercial
  const [paymentTermsDays, setPaymentTermsDays] = useState("0");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inicializar o resetear formulario
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (supplier) {
        setName(supplier.name || "");
        setTaxId(supplier.taxId || "");
        setContactName(supplier.contactName || "");
        setPhone(supplier.phone || "");
        setEmail(supplier.email || "");
        setAddress(supplier.address || "");
        setPaymentTermsDays(String(supplier.paymentTermsDays ?? 0));
        setNotes(supplier.notes || "");
        setStatus(supplier.status === "inactive" ? "inactive" : "active");
      } else {
        setName("");
        setTaxId("");
        setContactName("");
        setPhone("");
        setEmail("");
        setAddress("");
        setPaymentTermsDays("0");
        setNotes("");
        setStatus("active");
      }
    }
  }, [isOpen, supplier]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage("El nombre o razón social del proveedor es obligatorio.");
      return;
    }

    const cleanTaxId = taxId.trim() || undefined;
    const cleanContact = contactName.trim() || undefined;
    const cleanPhone = phone.trim() || undefined;
    const cleanEmail = email.trim() || undefined;
    const cleanAddress = address.trim() || undefined;
    const cleanNotes = notes.trim() || undefined;
    const days = Math.max(0, parseInt(paymentTermsDays, 10) || 0);

    setIsSubmitting(true);
    try {
      if (isEditing && supplier) {
        const updatePayload: UpdateSupplierInput = {
          name: cleanName,
          taxId: cleanTaxId || null,
          contactName: cleanContact || null,
          phone: cleanPhone || null,
          email: cleanEmail || null,
          address: cleanAddress || null,
          paymentTermsDays: days,
          notes: cleanNotes || null,
          status,
        };

        const res = await updateSupplierAction(businessId, supplier.id, updatePayload);
        if (!res.success || !res.data) {
          const errText = res.error || "No se pudo actualizar el proveedor.";
          setErrorMessage(errText);
          toast.error("Error al actualizar proveedor", { description: errText });
          return;
        }

        toast.success(`Proveedor «${res.data.name}» actualizado.`);
        onSuccess(res.data);
        onClose();
      } else {
        const createPayload: CreateSupplierInput = {
          name: cleanName,
          taxId: cleanTaxId,
          contactName: cleanContact,
          phone: cleanPhone,
          email: cleanEmail,
          address: cleanAddress,
          paymentTermsDays: days,
          notes: cleanNotes,
        };

        const res = await createSupplierAction(businessId, createPayload);
        if (!res.success || !res.data) {
          const errText = res.error || "No se pudo registrar el proveedor.";
          setErrorMessage(errText);
          toast.error("Error al registrar proveedor", { description: errText });
          return;
        }

        toast.success(`Proveedor «${res.data.name}» registrado exitosamente.`);
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      const errText = err?.message || "Ocurrió un error inesperado en el servidor.";
      setErrorMessage(errText);
      toast.error("Error al guardar proveedor", { description: errText });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header del Modal */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEditing ? "Editar Proveedor" : "Registrar Proveedor"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Solo el nombre es obligatorio; los demás datos son opcionales.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto text-xs">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            {/* SECCIÓN 1: INFORMACIÓN PRINCIPAL */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block border-b border-slate-200/80 dark:border-white/[0.08] pb-1">
                Información Principal
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre o Razón Social <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Ej. Distribuidora El Sol S.A.S."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0D14] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#ED500A] transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Identificación o NIT <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="Ej. 900.123.456-1 o Cédula"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0D14] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#ED500A] transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: INFORMACIÓN DE CONTACTO */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block border-b border-slate-200/80 dark:border-white/[0.08] pb-1">
                Información de Contacto
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Persona de Contacto <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Ej. Carlos Restrepo"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0D14] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#ED500A] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej. 300 123 4567"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0D14] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#ED500A] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Correo Electrónico <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ventas@proveedor.com"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0D14] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#ED500A] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ciudad o Dirección <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ej. Carrera 15 # 40-20"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0D14] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#ED500A] transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: INFORMACIÓN ADICIONAL Y CONDICIONES */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block border-b border-slate-200/80 dark:border-white/[0.08] pb-1">
                Condiciones y Observaciones
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Plazo de crédito habitual <span className="text-slate-400 font-normal">(Días)</span>
                  </label>
                  <SearchSelect
                    options={CREDIT_TERMS_OPTIONS}
                    value={paymentTermsDays}
                    onChange={(val) => setPaymentTermsDays(val)}
                    selectSize="sm"
                    searchable={false}
                    clearable={false}
                  />
                </div>

                {isEditing && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Estado comercial
                    </label>
                    <SearchSelect
                      options={STATUS_OPTIONS}
                      value={status}
                      onChange={(val) => setStatus(val as "active" | "inactive")}
                      selectSize="sm"
                      searchable={false}
                      clearable={false}
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Observaciones o notas <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Condiciones de despacho, horario de entrega, descuentos por pronto pago..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0D14] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#ED500A] transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer de Acciones del Formulario */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-all shadow-md shadow-[#ED500A]/20 disabled:opacity-50 cursor-pointer active:scale-98"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isEditing ? "Guardar cambios" : "Registrar proveedor"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
