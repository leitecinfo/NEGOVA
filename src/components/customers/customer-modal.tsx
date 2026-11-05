"use client";

import React, { useState, useEffect } from "react";
import { X, User, Building2, Phone, Mail, MapPin, FileText, Sparkles } from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Button } from "@/components/ui/button";
import { createCustomerAction, updateCustomerAction } from "@/app/workspace/[businessId]/clientes/actions";
import { Customer } from "@/lib/customers/types";
import { toast } from "sonner";

interface CustomerModalProps {
  isOpen: boolean;
  businessId: string;
  customerToEdit?: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CustomerModal({
  isOpen,
  businessId,
  customerToEdit,
  onClose,
  onSuccess,
}: CustomerModalProps) {
  const isEditing = Boolean(customerToEdit);

  const [customerType, setCustomerType] = useState<"individual" | "business">("individual");
  const [fullName, setFullName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [addressReference, setAddressReference] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (customerToEdit) {
      setCustomerType(customerToEdit.customerType || "individual");
      setFullName(customerToEdit.fullName || "");
      setContactName(customerToEdit.contactName || "");
      setPhone(customerToEdit.phone || "");
      setEmail(customerToEdit.email || "");
      setTaxId(customerToEdit.taxId || "");
      setNotes(customerToEdit.notes || "");
      setAddressLine("");
      setAddressReference("");
    } else {
      setCustomerType("individual");
      setFullName("");
      setContactName("");
      setPhone("");
      setEmail("");
      setTaxId("");
      setAddressLine("");
      setAddressReference("");
      setNotes("");
    }
    setErrorMessage(null);
  }, [customerToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage(
        customerType === "business"
          ? "Por favor ingresa la razón social o nombre de la empresa."
          : "Por favor ingresa el nombre completo del cliente."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEditing && customerToEdit) {
        const res = await updateCustomerAction(businessId, customerToEdit.id, {
          fullName: fullName.trim(),
          customerType,
          contactName: customerType === "business" ? contactName.trim() || null : null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          taxId: taxId.trim() || null,
          notes: notes.trim() || null,
        });

        if (!res.success) {
          setErrorMessage(res.error || "No se pudo actualizar el cliente.");
          setIsSubmitting(false);
          return;
        }

        toast.success("Cliente actualizado exitosamente");
      } else {
        const res = await createCustomerAction(businessId, {
          fullName: fullName.trim(),
          customerType,
          contactName: customerType === "business" ? contactName.trim() || null : null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          taxId: taxId.trim() || null,
          addressLine: addressLine.trim() || null,
          addressReference: addressReference.trim() || null,
          notes: notes.trim() || null,
        });

        if (!res.success) {
          setErrorMessage(res.error || "No se pudo registrar el cliente.");
          setIsSubmitting(false);
          return;
        }

        toast.success(
          customerType === "business"
            ? "Empresa registrada con éxito"
            : "Cliente registrado con éxito"
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Ocurrió un error inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#0D0F16] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-500/10 text-[#ED500A]">
                {customerType === "business" ? (
                  <Building2 className="w-5 h-5" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                  {isEditing ? "Editar cliente" : "Nuevo cliente"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-body">
                  {isEditing
                    ? "Actualiza los datos de contacto y notas del perfil"
                    : "Registra una persona o empresa para compras y domicilios"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Selector de Tipo: Persona Natural vs Empresa */}
          <div className="px-5 pt-4 pb-1">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-white/[0.05] rounded-xl border border-slate-200/80 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setCustomerType("individual")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  customerType === "individual"
                    ? "bg-white dark:bg-[#0D0F16] text-[#ED500A] shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <User className="w-4 h-4" />
                <span>Persona natural</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerType("business")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  customerType === "business"
                    ? "bg-white dark:bg-[#0D0F16] text-[#ED500A] shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Empresa</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 font-body">
            {errorMessage && (
              <div className="p-3 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl">
                {errorMessage}
              </div>
            )}

            {/* Nombre / Razón Social */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {customerType === "business" ? "Razón social / Empresa" : "Nombre completo"}
                <span className="text-[#ED500A] ml-1">*</span>
              </label>
              <div className="relative flex items-center">
                {customerType === "business" ? (
                  <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                ) : (
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                )}
                <input
                  type="text"
                  required
                  placeholder={
                    customerType === "business"
                      ? "Ej. Distribuidora del Norte S.A.S."
                      : "Ej. Andrés Ramírez"
                  }
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 pl-10 pr-3.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all"
                />
              </div>
            </div>

            {/* Persona de Contacto (exclusivo para Empresa) */}
            {customerType === "business" && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Persona de contacto / Representante{" "}
                  <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ej. Carlos Mendoza (Gerente de Compras)"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full h-10 pl-10 pr-3.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all"
                  />
                </div>
              </div>
            )}

            {/* Teléfono y Documento/NIT en 2 columnas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Teléfono / WhatsApp
                </label>
                <div className="relative flex items-center">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="tel"
                    placeholder="Ej. 300 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 pl-10 pr-3.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {customerType === "business" ? "NIT / RUT" : "Cédula / Documento"}{" "}
                  <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <div className="relative flex items-center">
                  <FileText className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={customerType === "business" ? "Ej. 901234567-1" : "Ej. 1045234890"}
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="w-full h-10 pl-10 pr-3.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Correo electrónico */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Correo electrónico <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  placeholder="contacto@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 pl-10 pr-3.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all"
                />
              </div>
            </div>

            {/* Si es creación nueva, pedir dirección inicial */}
            {!isEditing && (
              <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Dirección principal <span className="text-slate-400 font-normal">(Opcional)</span>
                </span>

                <div className="space-y-1.5">
                  <div className="relative flex items-center">
                    <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Ej. Calle 45 # 12-34 Oficina 301"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className="w-full h-10 pl-10 pr-3.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Punto de referencia o barrio (ej. Frente al parque, entrada norte)"
                    value={addressReference}
                    onChange={(e) => setAddressReference(e.target.value)}
                    className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all"
                  />
                </div>
              </div>
            )}

            {/* Notas / Preferencias */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Notas y observaciones <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Observaciones de entrega, preferencias comerciales o detalles clave..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all resize-none"
              />
            </div>

            {/* Footer con botones oficiales */}
            <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              >
                {isEditing ? "Guardar cambios" : "Registrar cliente"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
