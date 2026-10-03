"use client";

import React, { useState } from "react";
import { X, Building2, Plus, Loader2, CheckCircle2, Globe, Mail, Store, Utensils, ShoppingBag, Briefcase } from "lucide-react";

interface AdminCreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTenantCreated?: (tenant: any) => void;
}

export function AdminCreateTenantModal({ isOpen, onClose, onTenantCreated }: AdminCreateTenantModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [businessType, setBusinessType] = useState("restaurant");
  const [plan, setPlan] = useState("pro");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Autogenerar slug a partir del nombre
  const handleNameChange = (val: string) => {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simular registro en base de datos o llamada a API
      await new Promise((resolve) => setTimeout(resolve, 800));

      const newTenant = {
        id: `tenant-${Date.now()}`,
        name,
        slug: slug || "nuevo-tenant",
        business_type: businessType,
        email: email || "admin@tenant.co",
        status: "active",
        created_at: new Date().toISOString(),
        city: "Colombia",
      };

      if (onTenantCreated) {
        onTenantCreated(newTenant);
      }

      setSuccessMessage(`Tenant "${name}" creado e inicializado con subdominio negova.app/${slug}`);
      setTimeout(() => {
        setSuccessMessage(null);
        setName("");
        setSlug("");
        setEmail("");
        onClose();
      }, 1500);
    } catch {
      // Manejo de error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tenant-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Ventana Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.12] rounded-2xl shadow-2xl p-6 z-50 animate-in zoom-in-95 duration-150 space-y-5">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-50 text-[#ED500A] dark:bg-[#ED500A]/10 dark:text-[#ED500A]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="tenant-modal-title" className="text-base font-bold font-title text-slate-900 dark:text-white">
                Registrar Nuevo Tenant / Negocio
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aprovisionamiento instantáneo de esquema con aislamiento RLS.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mensaje de Éxito */}
        {successMessage ? (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-body">
            {/* Nombre del Negocio */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Nombre Comercial del Negocio *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej. Restaurante Sabor Criollo"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
              />
            </div>

            {/* Subdominio / Slug */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                Subdominio en Plataforma
              </label>
              <div className="flex items-center rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-3.5 py-2">
                <span className="text-slate-400 font-mono text-[11px]">negova.app/</span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="sabor-criollo"
                  className="w-full bg-transparent text-slate-900 dark:text-white font-mono text-xs focus:outline-hidden font-semibold pl-1"
                />
              </div>
            </div>

            {/* Tipo de Negocio y Plan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Categoría de Comercio
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                >
                  <option value="restaurant">Restaurante de Comida Rápida</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Plan de Suscripción Inicial
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                >
                  <option value="crece">Plan Crece ($59.900 COP/mes)</option>
                  <option value="inicio">Plan Inicio ($29.900 COP/mes)</option>
                  <option value="negocio">Plan Negocio ($99.900 COP/mes)</option>
                  <option value="trial">Prueba Gratuita (30 días)</option>
                </select>
              </div>
            </div>

            {/* Email del Administrador Principal */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Correo Electrónico del Propietario
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="gerencia@negocio.co"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
              />
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/[0.08]">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#ED500A] hover:bg-[#d94608] transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Aprovisionando...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear Tenant</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
