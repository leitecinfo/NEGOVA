"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  CheckCircle2,
  User,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Supplier } from "@/lib/purchases/types";
import { createSupplierAction, updateSupplierAction, SupplierInput } from "./actions";

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

export function SupplierFormModal({
  businessId,
  isOpen,
  supplier,
  onClose,
  onSuccess,
}: Props) {
  const isEditing = Boolean(supplier);

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
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicialización y reseteo de datos
  useEffect(() => {
    if (isOpen) {
      if (supplier) {
        setName(supplier.name || "");
        if (supplier.taxId) {
          if (supplier.taxId.includes("-")) {
            const parts = supplier.taxId.split("-");
            setNitBase(parts[0] || "");
            setDv(parts.slice(1).join("-") || "");
          } else {
            setNitBase(supplier.taxId);
            setDv("");
          }
        } else {
          setNitBase("");
          setDv("");
        }

        setContactName(supplier.contactName || "");
        setPhone(supplier.phone || "");
        setEmail(supplier.email || "");
        setAddress(supplier.address || "");

        const days = supplier.paymentTermsDays ?? 0;
        const matchingPreset = PAYMENT_TERMS_OPTIONS.find(
          (o) => o.value !== "none" && o.value !== "custom" && o.days === days
        );
        if (matchingPreset) {
          setTermSelection(matchingPreset.value);
        } else if (days === 0 && !supplier.paymentTermsDays) {
          setTermSelection("none");
        } else {
          setTermSelection("custom");
          setCustomDays(String(days));
        }

        setStatus(supplier.status === "inactive" ? "inactive" : "active");
        setNotes(supplier.notes || "");
      } else {
        setName("");
        setNitBase("");
        setDv("");
        setContactName("");
        setPhone("");
        setEmail("");
        setAddress("");
        setTermSelection("30");
        setCustomDays("30");
        setStatus("active");
        setNotes("");
      }
    }
  }, [isOpen, supplier]);

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

    // Armar NIT/Cédula con dígito de verificación independiente
    const cleanNit = nitBase.trim();
    const cleanDv = dv.trim();
    let combinedTaxId: string | undefined = undefined;
    if (cleanNit && cleanDv) {
      combinedTaxId = `${cleanNit}-${cleanDv}`;
    } else if (cleanNit) {
      combinedTaxId = cleanNit;
    }

    // Calcular días de crédito según selección
    let calculatedTerms = 0;
    if (termSelection === "none") {
      calculatedTerms = 0;
    } else if (termSelection === "custom") {
      calculatedTerms = Math.max(0, parseInt(customDays, 10) || 0);
    } else {
      calculatedTerms = Math.max(0, parseInt(termSelection, 10) || 0);
    }

    const payload: SupplierInput = {
      name: name.trim(),
      taxId: combinedTaxId,
      contactName: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      paymentTermsDays: calculatedTerms,
      status,
      notes: notes.trim() || undefined,
    };

    setIsSubmitting(true);
    try {
      if (isEditing && supplier) {
        const res = await updateSupplierAction(businessId, supplier.id, payload);
        if (!res.success || !res.data) {
          toast.error("Error al actualizar proveedor", {
            description: res.error || "Verifica los datos e intenta nuevamente.",
          });
          return;
        }
        toast.success(`Proveedor «${res.data.name}» actualizado.`);
        onSuccess(res.data);
      } else {
        const res = await createSupplierAction(businessId, payload);
        if (!res.success || !res.data) {
          toast.error("Error al registrar proveedor", {
            description: res.error || "Verifica los datos e intenta nuevamente.",
          });
          return;
        }
        toast.success(`Proveedor «${res.data.name}» registrado exitosamente.`);
        onSuccess(res.data);
      }
      onClose();
    } catch (err: any) {
      toast.error("Error inesperado al guardar el proveedor.", {
        description: err?.message || "Ocurrió un error en el servidor.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header del Modal */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {isEditing ? "Editar Proveedor" : "Crear Proveedor"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Solo el nombre es obligatorio; el resto lo puedes completar después.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto text-xs">
            {/* ============================================================== */}
            {/* BLOQUE 1: IDENTIFICACIÓN                                       */}
            {/* ============================================================== */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-2xs font-bold">
                  1
                </span>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Bloque 1: Identificación
                </h4>
              </div>

              {/* Nombre o razón social (*) */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Nombre o razón social <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Distribuidora Avícola San Antonio S.A.S."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  />
                </div>
              </div>

              {/* NIT o cédula (opcional) con campo independiente para DV */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  NIT o cédula <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={nitBase}
                      onChange={(e) => setNitBase(e.target.value)}
                      placeholder="Ej: 901234567"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                  <span className="text-muted-foreground font-bold font-mono">-</span>
                  <div className="w-16">
                    <input
                      type="text"
                      maxLength={1}
                      value={dv}
                      onChange={(e) => setDv(e.target.value.replace(/\D/g, ""))}
                      placeholder="DV"
                      title="Dígito de verificación (1 dígito)"
                      className="w-full px-2.5 py-2 text-xs text-center rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Número principal y dígito de verificación independiente.
                </p>
              </div>
            </div>

            {/* ============================================================== */}
            {/* BLOQUE 2: CONTACTO                                             */}
            {/* ============================================================== */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-2xs font-bold">
                  2
                </span>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Bloque 2: Contacto
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Persona de contacto (opcional) */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Persona de contacto <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Ej: Laura Gómez (Asesora comercial)"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Teléfono o celular (opcional) */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Teléfono o celular <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej: +57 310 123 4567"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Correo (opcional) */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Correo <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="pedidos@proveedor.com"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Dirección física de entrega (opcional) */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Dirección física de entrega <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ej: Carrera 45 # 12-34 Bodega 3, Medellín"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* BLOQUE 3: CONDICIONES                                          */}
            {/* ============================================================== */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-2xs font-bold">
                  3
                </span>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Bloque 3: Condiciones
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Plazo de pago desplegable */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Plazo de pago
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <select
                      value={termSelection}
                      onChange={(e) => setTermSelection(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {PAYMENT_TERMS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Automatiza el cálculo de vencimientos en compras a crédito.
                  </p>
                </div>

                {/* Estado en Directorio */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Estado en el Directorio
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="active">Activo (Habilitado para compras)</option>
                    <option value="inactive">Inactivo (Oculto en compras)</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Visibilidad en selectores de compras del workspace.
                  </p>
                </div>
              </div>

              {/* Plazo personalizado */}
              {termSelection === "custom" && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    Días de crédito pactados
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder="Ej: 21"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              )}

              {/* Notas y Condiciones Comerciales adicionales */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Notas adicionales <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Cuentas bancarias de transferencia, horarios de entrega o descuentos pactados..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>

            {/* ============================================================== */}
            {/* PIE DEL MODAL: RESUMEN LATERAL Y BOTONES                       */}
            {/* ============================================================== */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border bg-muted/10 -mx-6 -mb-6 p-4 sm:p-5">
              {/* Resumen lateral con nombre y plazo configurado */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-muted-foreground text-2xs uppercase font-bold shrink-0">
                  Resumen:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span
                    className="font-bold text-foreground text-xs truncate max-w-[150px] sm:max-w-[200px]"
                    title={name.trim() || "Sin nombre aún"}
                  >
                    {name.trim() || "Sin nombre aún"}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
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
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 cursor-pointer active:scale-98"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isEditing ? "Guardar cambios" : "Crear proveedor"}</span>
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
