"use client";

import React, { useState, useTransition } from "react";
import { BusinessDocumentConfig } from "@/lib/documents/types";
import { updateDocumentConfigAction, uploadBusinessLogoAction } from "./actions";
import { toast } from "sonner";
import { Save, Upload, FileText, Image as ImageIcon, CheckCircle2, Type, PaintBucket } from "lucide-react";
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
          description: "Los cambios se reflejarán en los nuevos documentos PDF.",
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
      toast.success("Logotipo actualizado");
    } else {
      toast.error("Error al subir logo", { description: res.error });
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-8">
      {/* 1. Identidad Visual */}
      <div className="bg-white dark:bg-[#0B0E14] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-xs">
        <div className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
            <PaintBucket className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Identidad Visual</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Logo y colores para el documento</p>
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
              Color Principal (Marca)
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
              Este color se usará en el encabezado y elementos destacados del PDF.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Textos y Personalización */}
      <div className="bg-white dark:bg-[#0B0E14] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-xs">
        <div className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Type className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Textos del Documento</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Mensajes y títulos del comprobante</p>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Título del Documento
              </label>
              <AdminInput
                name="documentTitleDefault"
                value={config.documentTitleDefault || ""}
                onChange={handleChange}
                placeholder="Ej. DOCUMENTO DE VENTA"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Mensaje de Agradecimiento (Pie de tabla)
              </label>
              <AdminInput
                name="thankYouNote"
                value={config.thankYouNote || ""}
                onChange={handleChange}
                placeholder="Ej. ¡Gracias por su compra!"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Términos y Condiciones / Observaciones
              </label>
              <textarea
                name="termsAndConditions"
                value={config.termsAndConditions || ""}
                onChange={handleChange}
                placeholder="Ej. Los cambios se aceptan en un plazo de 30 días..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-[#12141A] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Texto al Pie de Página (Footer)
              </label>
              <textarea
                name="footerText"
                value={config.footerText || ""}
                onChange={handleChange}
                placeholder="Ej. Documento sin validez fiscal."
                rows={3}
                className="w-full bg-slate-50 dark:bg-[#12141A] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
              />
            </div>
          </div>
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
