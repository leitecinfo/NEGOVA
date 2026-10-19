"use client";

import React, { useState, useTransition } from "react";
import { BusinessDocumentConfig } from "@/lib/documents/types";
import { updateDocumentConfigAction, uploadBusinessLogoAction } from "./actions";
import { toast } from "sonner";
import { Save, Upload, Image as ImageIcon, Type, PaintBucket, Building2, Printer } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminInput } from "@/components/admin/ui/admin-input";

interface DocumentConfigClientProps {
  businessId: string;
  initialConfig: BusinessDocumentConfig;
}

export function DocumentConfigClient({ businessId, initialConfig }: DocumentConfigClientProps) {
  const [config, setConfig] = useState<BusinessDocumentConfig>(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateDocumentConfigAction(businessId, config);
      if (res.success) {
        toast.success("Configuración actualizada", {
          description: "Los cambios se guardaron y se reflejarán en los nuevos documentos PDF.",
        });
      } else {
        toast.error("Error al guardar", { description: res.error });
      }
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Formato inválido", { description: "Debe ser una imagen PNG, JPG o WEBP." });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("logo", file);

    const res = await uploadBusinessLogoAction(businessId, formData);
    if (res.success && res.url) {
      setConfig({ ...config, logoUrl: res.url });
      toast.success("Logotipo actualizado con éxito");
    } else {
      toast.error("Error al subir logo", { description: res.error });
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-8">
      {/* 1. Datos del Comercio en el Documento */}
      <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-xs">
        <div className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Identidad Comercial del Emisor</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Datos del comercio que se imprimirán en las ventas y recibos</p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre Comercial
            </label>
            <AdminInput
              name="tradeName"
              value={config.tradeName || ""}
              onChange={handleChange}
              placeholder="Ej. Mi Negocio"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Razón Social (Opcional)
            </label>
            <AdminInput
              name="legalName"
              value={config.legalName || ""}
              onChange={handleChange}
              placeholder="Ej. Inversiones Comerciales SAS"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              NIT / Identificación Fiscal
            </label>
            <AdminInput
              name="taxId"
              value={config.taxId || ""}
              onChange={handleChange}
              placeholder="Ej. 900.123.456-7"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Teléfono de Contacto
            </label>
            <AdminInput
              name="phone"
              value={config.phone || ""}
              onChange={handleChange}
              placeholder="Ej. +57 300 123 4567"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Correo Electrónico
            </label>
            <AdminInput
              type="email"
              name="email"
              value={config.email || ""}
              onChange={handleChange}
              placeholder="Ej. contacto@minegocio.com"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Dirección Física
            </label>
            <AdminInput
              name="address"
              value={config.address || ""}
              onChange={handleChange}
              placeholder="Ej. Calle 10 # 4-20"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Ciudad / Municipio
            </label>
            <AdminInput
              name="city"
              value={config.city || ""}
              onChange={handleChange}
              placeholder="Ej. Bogotá, Colombia"
            />
          </div>
        </div>
      </div>

      {/* 2. Identidad Visual */}
      <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-xs">
        <div className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
            <PaintBucket className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Identidad Visual</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Logotipo y color de marca para los comprobantes</p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Logo */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Logotipo del Negocio
            </label>
            <div className="flex items-start gap-6">
              <div className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center bg-slate-50 dark:bg-white/[0.02] overflow-hidden shrink-0 relative">
                {config.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center backdrop-blur-xs">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  disabled={isUploading}
                />
                <AdminButton
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Cambiar Logo
                </AdminButton>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Formatos soportados: PNG, JPG, WEBP.
                  <br />
                  Fondo transparente recomendado.
                </p>
              </div>
            </div>
          </div>

          {/* Color */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Color de marca
            </label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="color"
                  name="primaryColor"
                  value={config.primaryColor || "#ED500A"}
                  onChange={handleChange}
                  className="w-14 h-14 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                />
                <div
                  className="absolute inset-0 rounded-lg pointer-events-none shadow-sm ring-1 ring-inset ring-black/10 dark:ring-white/10"
                  style={{ backgroundColor: config.primaryColor || "#ED500A" }}
                ></div>
              </div>
              <AdminInput
                type="text"
                name="primaryColor"
                value={config.primaryColor?.toUpperCase() || "#ED500A"}
                onChange={handleChange}
                placeholder="#HEX"
                className="w-32 uppercase font-mono"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Color propio de tu negocio para encabezados de comprobantes y elementos comerciales impresos.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Textos y Personalización del Documento */}
      <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-xs">
        <div className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Type className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Textos del Comprobante</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Títulos, notas de pie y condiciones legales impresas</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Título del documento
              </label>
              <AdminInput
                name="documentTitleDefault"
                value={config.documentTitleDefault || ""}
                onChange={handleChange}
                placeholder="Ej. COMPROBANTE DE VENTA o RECIBO DE CAJA"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Subtítulo / leyenda
              </label>
              <AdminInput
                name="headerText"
                value={config.headerText || ""}
                onChange={handleChange}
                placeholder="Ej. No responsable de IVA — Régimen Simple"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Mensaje de agradecimiento
            </label>
            <AdminInput
              name="thankYouNote"
              value={config.thankYouNote || ""}
              onChange={handleChange}
              placeholder="Ej. ¡Gracias por su compra! Vuelva pronto."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Observaciones
            </label>
            <textarea
              name="documentObservations"
              value={config.documentObservations || ""}
              onChange={handleChange}
              placeholder="Ej. Conserve este documento como constancia..."
              rows={2}
              className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Términos y condiciones
            </label>
            <textarea
              name="termsAndConditions"
              value={config.termsAndConditions || ""}
              onChange={handleChange}
              placeholder="Ej. Condiciones generales de venta y entrega de productos..."
              rows={2}
              className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Política de cambios y devoluciones
              </label>
              <textarea
                name="returnPolicy"
                value={config.returnPolicy || ""}
                onChange={handleChange}
                placeholder="Ej. Los cambios de mercancía se aceptan dentro de los 30 días..."
                rows={2}
                className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Política de garantía
              </label>
              <textarea
                name="warrantyPolicy"
                value={config.warrantyPolicy || ""}
                onChange={handleChange}
                placeholder="Ej. Garantía de 90 días por defectos de fábrica..."
                rows={2}
                className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Pie de página
            </label>
            <textarea
              name="footerText"
              value={config.footerText || ""}
              onChange={handleChange}
              placeholder="Ej. Documento comercial de control interno."
              rows={2}
              className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* 3. Configuración de Impresión Térmica (Comprobante POS / Restaurante) */}
      <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-xs">
        <div className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Impresión Térmica de Comprobantes (POS y Domicilios)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecciona el ancho de rollo predeterminado para tus tiquetes en caja, salón y domicilios.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20">
            {config.paperWidth || "80mm"}
          </span>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setConfig({ ...config, paperWidth: "80mm" })}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                (config.paperWidth || "80mm") === "80mm"
                  ? "bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20"
                  : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  80 mm (Estándar Punto de Venta)
                </span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  80 mm
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Recomendado para impresoras de caja fijas (Epson TM-T20, Star Micronics, Xprinter 80mm). Permite ver columnas completas de Cantidad, P. Unitario e Importe alineados.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setConfig({ ...config, paperWidth: "58mm" })}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                config.paperWidth === "58mm"
                  ? "bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20"
                  : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  58 mm (Compacta / Portátil)
                </span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  58 mm
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Diseñado para impresoras térmicas pequeñas, Bluetooth o portátiles. Formato optimizado para rollos angostos sin recortes de texto ni desbordes.
              </p>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
            * Podrás alternar entre 58 mm y 80 mm en cualquier momento desde la vista previa de impresión antes de enviar el tiquete a la impresora.
          </p>
        </div>
      </div>

      {/* Guardar */}
      <div className="flex justify-end">
        <AdminButton
          size="lg"
          onClick={handleSave}
          isLoading={isPending}
        >
          <Save className="w-5 h-5 mr-2" />
          Guardar Configuración
        </AdminButton>
      </div>
    </div>
  );
}
