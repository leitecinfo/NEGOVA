"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input } from "@/components/ui";
import { User, Phone, Mail, MapPin, X, Loader2, Sparkles } from "lucide-react";
import { createCustomerAction } from "@/app/workspace/[businessId]/clientes/actions";
import { toast } from "sonner";
import { PosCustomerItem } from "./pos-select-customer-modal";

interface PosQuickCreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  onCustomerCreated: (customer: PosCustomerItem) => void;
}

export function PosQuickCreateCustomerModal({
  isOpen,
  onClose,
  businessId,
  onCustomerCreated,
}: PosQuickCreateCustomerModalProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage("El nombre completo es obligatorio.");
      return;
    }
    if (!phone.trim()) {
      setErrorMessage("El teléfono de contacto es obligatorio.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await createCustomerAction(businessId, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        addressLine: addressLine.trim() || undefined,
        customerType: "individual",
      });

      if (!res.success || !res.customer) {
        setErrorMessage(res.error || "No se pudo registrar el cliente.");
        setIsSubmitting(false);
        return;
      }

      toast.success(`Cliente «${res.customer.fullName}» creado exitosamente.`);

      // Auto-seleccionar al nuevo cliente para el pedido actual en el POS
      onCustomerCreated({
        id: res.customer.id,
        name: res.customer.fullName,
        phone: res.customer.phone || null,
        documentNumber: res.customer.taxId || null,
      });

      // Limpiar formulario y cerrar modal
      setFullName("");
      setPhone("");
      setEmail("");
      setAddressLine("");
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Ocurrió un error inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  Nuevo cliente rápido
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Se asociará de inmediato al pedido actual.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] cursor-pointer transition-colors shrink-0 ml-2"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl">
                {errorMessage}
              </div>
            )}

            {/* Nombre completo */}
            <Input
              label="Nombre completo"
              required
              autoFocus
              placeholder="Ej. Valentina Morales"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />

            {/* Teléfono */}
            <Input
              label="Teléfono / WhatsApp"
              required
              type="tel"
              placeholder="Ej. 301 234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={<Phone className="w-4 h-4" />}
              className="font-mono"
            />

            {/* Correo */}
            <Input
              label="Correo electrónico (Opcional)"
              type="email"
              placeholder="cliente@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />

            {/* Dirección */}
            <Input
              label="Dirección de entrega (Opcional)"
              placeholder="Ej. Calle 10 # 5-20 Apto 402"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              leftIcon={<MapPin className="w-4 h-4" />}
            />

            {/* Acciones */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ED500A] text-white hover:bg-[#d94608] shadow-md shadow-[#ED500A]/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Crear y seleccionar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

