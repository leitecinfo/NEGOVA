"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  Copy,
  ExternalLink,
  Eye,
  CheckCircle2,
  XCircle,
  Sparkles,
  LayoutTemplate,
  Palette,
  FileUp,
  Smartphone,
  Monitor,
  Flame,
  Crown,
  Store,
  Utensils,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Info,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  BusinessDigitalMenu,
  DigitalMenuModality,
  DigitalMenuTemplateId,
  DigitalMenuCustomSettings,
  DIGITAL_MENU_TEMPLATES,
  DEFAULT_DIGITAL_MENU_SETTINGS,
  DigitalMenuPublicBusiness,
} from "@/lib/menu/types";
import { Product, Category } from "@/lib/products/types";
import { TemplateRenderer } from "@/components/menu/template-renderer";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  saveDigitalMenuConfigAction,
  uploadDigitalMenuFileAction,
  removeDigitalMenuFileAction,
  togglePublishDigitalMenuAction,
} from "./actions";

interface Props {
  businessId: string;
  business: DigitalMenuPublicBusiness;
  initialMenu: BusinessDigitalMenu;
  categories: Category[];
  products: Product[];
}

export function DigitalMenuClient({
  businessId,
  business,
  initialMenu,
  categories,
  products,
}: Props) {
  const router = useRouter();
  const [menu, setMenu] = useState<BusinessDigitalMenu>(initialMenu);

  // Estados locales para edición en tiempo real
  const [modality, setModality] = useState<DigitalMenuModality>(initialMenu.modality);
  const [templateId, setTemplateId] = useState<DigitalMenuTemplateId>(initialMenu.template_id);
  const [settings, setSettings] = useState<DigitalMenuCustomSettings>({
    ...DEFAULT_DIGITAL_MENU_SETTINGS,
    ...(initialMenu.custom_settings || {}),
  });
  const [isPublished, setIsPublished] = useState<boolean>(initialMenu.is_published);

  // Vista previa responsiva
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  const [mobileTab, setMobileTab] = useState<"editor" | "preview">("editor");

  // Estados de carga y modales
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Archivo local en caso de carga
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const previewIframeUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("preview", "true");
    params.set("template", templateId);
    params.set("modality", modality);
    if (settings.layoutStyle) params.set("layout", settings.layoutStyle);
    if (settings.primaryColor) params.set("primary", settings.primaryColor);
    if (settings.secondaryColor) params.set("sec", settings.secondaryColor);
    if (settings.accentColor) params.set("accent", settings.accentColor);
    params.set("photos", String(settings.showPhotos ?? true));
    params.set("desc", String(settings.showDescriptions ?? true));
    params.set("prices", String(settings.showPrices ?? true));
    params.set("contact", String(settings.showContactInfo ?? true));
    params.set("address", String(settings.showAddress ?? true));
    if (settings.bannerTitle !== undefined) params.set("title", settings.bannerTitle);
    if (settings.bannerSubtitle !== undefined) params.set("subtitle", settings.bannerSubtitle);
    if (settings.deliveryFee !== undefined) params.set("fee", String(settings.deliveryFee));

    return `/menu/${business.slug || business.id}?${params.toString()}`;
  }, [business.slug, business.id, templateId, modality, settings]);

  const publicMenuUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/menu/${business.slug || business.id}`
      : `/menu/${business.slug || business.id}`;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(publicMenuUrl);
      toast.success("Enlace público copiado al portapapeles", {
        description: publicMenuUrl,
      });
    }
  };

  const handleOpenPublicView = () => {
    if (typeof window !== "undefined") {
      window.open(publicMenuUrl, "_blank");
    }
  };

  const handleTogglePublish = async () => {
    const nextState = !isPublished;
    setIsPublished(nextState);

    startTransition(async () => {
      const res = await togglePublishDigitalMenuAction(businessId, nextState);
      if (!res.success) {
        setIsPublished(!nextState);
        toast.error("Error al cambiar estado de publicación", {
          description: res.error,
        });
      } else {
        setMenu(res.data!);
        toast.success(
          nextState ? "Menú digital publicado con éxito" : "Menú digital pausado"
        );
      }
    });
  };

  // Guardar cambio de modalidad o plantilla
  const handleSelectTemplate = async (selectedTpl: DigitalMenuTemplateId) => {
    setTemplateId(selectedTpl);
    setModality("template");

    // Aplicar colores recomendados de esa plantilla
    const meta = DIGITAL_MENU_TEMPLATES.find((t) => t.id === selectedTpl);
    if (meta) {
      setSettings((prev) => ({
        ...prev,
        primaryColor: meta.defaultColors.primary,
        secondaryColor: meta.defaultColors.secondary,
        accentColor: meta.defaultColors.accent,
      }));
    }

    setIsSaving(true);
    const res = await saveDigitalMenuConfigAction(businessId, {
      modality: "template",
      template_id: selectedTpl,
      custom_settings: meta
        ? {
            ...settings,
            primaryColor: meta.defaultColors.primary,
            secondaryColor: meta.defaultColors.secondary,
            accentColor: meta.defaultColors.accent,
          }
        : settings,
    });
    setIsSaving(false);

    if (!res.success) {
      toast.error("Error al seleccionar plantilla", { description: res.error });
    } else {
      setMenu(res.data!);
      toast.success(`Plantilla "${meta?.name || selectedTpl}" activada`);
    }
  };

  const handleSelectLayout = async (layout: "grid" | "list" | "text") => {
    const newSettings = { ...settings, layoutStyle: layout };
    setSettings(newSettings);
    setIsSaving(true);
    const res = await saveDigitalMenuConfigAction(businessId, {
      modality,
      template_id: templateId,
      custom_settings: newSettings,
    });
    setIsSaving(false);

    if (!res.success) {
      toast.error("Error al cambiar formato", { description: res.error });
    } else {
      setMenu(res.data!);
      const label =
        layout === "grid"
          ? "Tarjetas (▦)"
          : layout === "list"
          ? "Lista horizontal (☰)"
          : "Solo texto (≡)";
      toast.success(`Formato visual actualizado: ${label}`);
    }
  };

  // Al elegir un estilo base en la personalización, aplicar de inmediato el estilo Y sus colores puros oficiales
  const handleSelectBaseTemplateInCustom = (t: (typeof DIGITAL_MENU_TEMPLATES)[0]) => {
    setTemplateId(t.id);
    setSettings((prev) => ({
      ...prev,
      primaryColor: t.defaultColors.primary,
      secondaryColor: t.defaultColors.secondary,
      accentColor: t.defaultColors.accent,
    }));
    toast.success(`Estilo "${t.name}" aplicado con sus colores oficiales`);
  };

  const handleResetTemplateColors = () => {
    const currentMeta = DIGITAL_MENU_TEMPLATES.find((t) => t.id === templateId);
    if (currentMeta) {
      setSettings((prev) => ({
        ...prev,
        primaryColor: currentMeta.defaultColors.primary,
        secondaryColor: currentMeta.defaultColors.secondary,
        accentColor: currentMeta.defaultColors.accent,
      }));
      toast.success(`Colores restablecidos a los de "${currentMeta.name}"`);
    }
  };

  const handleSaveCustomSettings = async () => {
    setIsSaving(true);
    const res = await saveDigitalMenuConfigAction(businessId, {
      modality: "custom",
      template_id: templateId,
      custom_settings: settings,
    });
    setIsSaving(false);

    if (!res.success) {
      toast.error("Error al guardar personalización", { description: res.error });
    } else {
      setMenu(res.data!);
      setModality("custom");
      toast.success("Personalización del menú guardada con éxito");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación local inmediata
    const validMimes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (!validMimes.includes(file.type)) {
      toast.error("Formato no compatible", {
        description: "Utilice únicamente archivos PDF, JPEG, PNG o WEBP.",
      });
      return;
    }

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("Archivo demasiado grande", {
        description: "El límite máximo permitido es de 10 MB.",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress("Subiendo archivo a Supabase Storage y optimizando...");

    const formData = new FormData();
    formData.append("file", file);

    const res = await uploadDigitalMenuFileAction(businessId, formData);
    setIsUploading(false);
    setUploadProgress(null);

    if (!res.success) {
      toast.error("Error al cargar archivo", { description: res.error });
    } else {
      setMenu(res.data!);
      setModality("file");
      toast.success("Archivo de menú publicado correctamente", {
        description: "El archivo anterior fue sustituido y liberado de almacenamiento.",
      });
    }
  };

  const handleConfirmRemoveFile = async () => {
    setIsSaving(true);
    const res = await removeDigitalMenuFileAction(businessId);
    setIsSaving(false);
    setIsConfirmDeleteOpen(false);

    if (!res.success) {
      toast.error("Error al retirar archivo", { description: res.error });
    } else {
      setMenu(res.data!);
      setModality("template");
      toast.success("Archivo retirado y espacio de almacenamiento liberado");
    }
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return "0 KB";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Barra de Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0D0F16] p-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href={`/workspace/${businessId}/productos`}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
            title="Volver a Inventario"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Presencia Digital — Menú Digital
              </h1>
              {isPublished ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Publicado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                  Pausado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Administra la exposición pública de tu oferta comercial, carta digital y compártela mediante enlace web o código QR.
            </p>
          </div>
        </div>

        {/* Acciones del Menú */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            title="Copiar enlace público"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar Enlace</span>
          </button>

          <button
            onClick={handleOpenPublicView}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            title="Ver menú público en una pestaña nueva"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir Menú</span>
          </button>

          <button
            onClick={handleTogglePublish}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              isPublished
                ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPublished ? (
              <XCircle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>{isPublished ? "Pausar Menú" : "Publicar Menú"}</span>
          </button>
        </div>
      </div>

      {/* Switcher de las 3 Modalidades */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Modalidad A */}
        <button
          onClick={() => {
            setModality("template");
            saveDigitalMenuConfigAction(businessId, { modality: "template" });
          }}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
            modality === "template"
              ? "bg-[#ED500A]/5 border-[#ED500A] shadow-md ring-2 ring-[#ED500A]/20"
              : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20"
          }`}
        >
          {modality === "template" && (
            <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-bold text-[#ED500A] bg-[#ED500A]/10 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> Activa
            </span>
          )}
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2.5 rounded-xl ${
                modality === "template"
                  ? "bg-[#ED500A] text-white"
                  : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400"
              }`}
            >
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Modalidad A
              </span>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Plantillas Prediseñadas
              </h3>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Selecciona uno de los estilos predefinidos (Urbana, Elegante, Comercial, Visual). Se alimenta en automático de tu catálogo.
          </p>
        </button>

        {/* Modalidad B */}
        <button
          onClick={() => {
            setModality("custom");
            saveDigitalMenuConfigAction(businessId, { modality: "custom" });
          }}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
            modality === "custom"
              ? "bg-[#ED500A]/5 border-[#ED500A] shadow-md ring-2 ring-[#ED500A]/20"
              : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20"
          }`}
        >
          {modality === "custom" && (
            <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-bold text-[#ED500A] bg-[#ED500A]/10 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> Activa
            </span>
          )}
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2.5 rounded-xl ${
                modality === "custom"
                  ? "bg-[#ED500A] text-white"
                  : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400"
              }`}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Modalidad B
              </span>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Menú Personalizado
              </h3>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Personaliza colores de marca, tipografías, tamaño de texto y qué datos mostrar con vista previa en tiempo real.
          </p>
        </button>

        {/* Modalidad C */}
        <button
          onClick={() => {
            setModality("file");
            saveDigitalMenuConfigAction(businessId, { modality: "file" });
          }}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
            modality === "file"
              ? "bg-[#ED500A]/5 border-[#ED500A] shadow-md ring-2 ring-[#ED500A]/20"
              : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20"
          }`}
        >
          {modality === "file" && (
            <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-bold text-[#ED500A] bg-[#ED500A]/10 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> Activa
            </span>
          )}
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2.5 rounded-xl ${
                modality === "file"
                  ? "bg-[#ED500A] text-white"
                  : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400"
              }`}
            >
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Modalidad C
              </span>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Subir PDF o Imagen
              </h3>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Sube tu menú diseñado en PDF, PNG o JPG. Ahorra espacio: cada nuevo archivo sustituye el anterior de inmediato.
          </p>
        </button>
      </div>

      {/* Selector móvil de pestaña (Editor vs Vista previa) */}
      <div className="flex lg:hidden bg-slate-200 dark:bg-white/5 p-1 rounded-xl">
        <button
          onClick={() => setMobileTab("editor")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mobileTab === "editor"
              ? "bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          Opciones y Ajustes
        </button>
        <button
          onClick={() => setMobileTab("preview")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mobileTab === "preview"
              ? "bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          Vista Previa en Vivo
        </button>
      </div>

      {/* Área Principal de Configuración + Vista Previa Dividida */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL IZQUIERDO: CONFIGURADOR DE LA MODALIDAD ACTIVA */}
        <div
          className={`lg:col-span-6 space-y-6 ${
            mobileTab === "preview" ? "hidden lg:block" : "block"
          }`}
        >
          {/* ======================================================== */}
          {/* MODALIDAD A: CATÁLOGO DE PLANTILLAS PREDISEÑADAS */}
          {/* ======================================================== */}
          {modality === "template" && (
            <div className="bg-white dark:bg-[#0D0F16] p-6 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Plantillas Prediseñadas
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Haz clic sobre una plantilla para aplicarla a tu menú digital.
                </p>
              </div>

              {/* Selector de Disposición de los Productos (Tarjetas, Lista horizontal, Solo texto) */}
              <div className="bg-slate-50 dark:bg-white/[0.03] p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Disposición de los Productos
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Elige cómo se presentarán los platillos en el menú
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#ED500A]">
                    {settings.layoutStyle === "list"
                      ? "☰ Lista horizontal"
                      : settings.layoutStyle === "text" || settings.layoutStyle === "compact"
                      ? "≡ Solo texto"
                      : "▦ Tarjetas"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectLayout("grid")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      settings.layoutStyle === "grid" || !settings.layoutStyle
                        ? "border-[#ED500A] bg-[#ED500A] text-white shadow-xs"
                        : "border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 bg-white dark:bg-[#0D0F16]"
                    }`}
                  >
                    <span className="text-sm">▦</span>
                    <span>Tarjetas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLayout("list")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      settings.layoutStyle === "list"
                        ? "border-[#ED500A] bg-[#ED500A] text-white shadow-xs"
                        : "border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 bg-white dark:bg-[#0D0F16]"
                    }`}
                  >
                    <span className="text-sm">☰</span>
                    <span>Lista horizontal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLayout("text")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      settings.layoutStyle === "text" || settings.layoutStyle === "compact"
                        ? "border-[#ED500A] bg-[#ED500A] text-white shadow-xs"
                        : "border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 bg-white dark:bg-[#0D0F16]"
                    }`}
                  >
                    <span className="text-sm">≡</span>
                    <span>Solo texto</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DIGITAL_MENU_TEMPLATES.map((tpl) => {
                  const isCurrent = templateId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl.id)}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all flex flex-col justify-between gap-3 ${
                        isCurrent
                          ? "border-[#ED500A] bg-[#ED500A]/5 ring-2 ring-[#ED500A]/20 shadow-md"
                          : "border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20"
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Fila superior: Indicadores de color y badge si está seleccionada */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                              style={{ backgroundColor: tpl.defaultColors.primary }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                              style={{ backgroundColor: tpl.defaultColors.secondary }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                              style={{ backgroundColor: tpl.defaultColors.accent }}
                            />
                          </div>

                          {isCurrent && (
                            <span className="text-[10px] font-bold text-white bg-[#ED500A] px-2.5 py-0.5 rounded-full shrink-0 shadow-xs">
                              Seleccionada
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {tpl.category}
                          </p>
                          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-0.5">
                            {tpl.name}
                          </h3>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400 italic">
                          {tpl.recommendedFor.split(",")[0]}
                        </span>
                        <button
                          type="button"
                          className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                            isCurrent
                              ? "bg-[#ED500A] text-white"
                              : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {isCurrent ? "Activa" : "Elegir"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* MODALIDAD B: MENÚ PERSONALIZADO */}
          {/* ======================================================== */}
          {modality === "custom" && (
            <div className="bg-white dark:bg-[#0D0F16] p-6 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Personalización Visual del Menú
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ajusta la paleta de colores, tipografía y elementos visuales. La vista previa se actualiza inmediatamente.
                </p>
              </div>

              {/* Selector de plantilla base */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Estilo o Estructura Base
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Aplica tipografía, estructura y paleta original
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DIGITAL_MENU_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectBaseTemplateInCustom(t)}
                      className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
                        templateId === t.id
                          ? "border-[#ED500A] bg-[#ED500A]/10 text-[#ED500A] shadow-xs ring-1 ring-[#ED500A]/30"
                          : "border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <span>{t.name.split(" ")[0]}</span>
                      <div className="flex items-center gap-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20"
                          style={{ backgroundColor: t.defaultColors.primary }}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20"
                          style={{ backgroundColor: t.defaultColors.secondary }}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20"
                          style={{ backgroundColor: t.defaultColors.accent }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector de Disposición de los Productos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Disposición de los Productos
                  </label>
                  <span className="text-xs font-bold text-[#ED500A]">
                    {settings.layoutStyle === "list"
                      ? "☰ Lista horizontal"
                      : settings.layoutStyle === "text" || settings.layoutStyle === "compact"
                      ? "≡ Solo texto"
                      : "▦ Tarjetas"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, layoutStyle: "grid" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      settings.layoutStyle === "grid" || !settings.layoutStyle
                        ? "border-[#ED500A] bg-[#ED500A] text-white shadow-xs"
                        : "border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 bg-slate-50 dark:bg-white/[0.02]"
                    }`}
                  >
                    <span className="text-sm">▦</span>
                    <span>Tarjetas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, layoutStyle: "list" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      settings.layoutStyle === "list"
                        ? "border-[#ED500A] bg-[#ED500A] text-white shadow-xs"
                        : "border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 bg-slate-50 dark:bg-white/[0.02]"
                    }`}
                  >
                    <span className="text-sm">☰</span>
                    <span>Lista horizontal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, layoutStyle: "text" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      settings.layoutStyle === "text" || settings.layoutStyle === "compact"
                        ? "border-[#ED500A] bg-[#ED500A] text-white shadow-xs"
                        : "border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 bg-slate-50 dark:bg-white/[0.02]"
                    }`}
                  >
                    <span className="text-sm">≡</span>
                    <span>Solo texto</span>
                  </button>
                </div>
              </div>

              {/* Colores */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Colores del Menú
                  </label>
                  <button
                    type="button"
                    onClick={handleResetTemplateColors}
                    className="text-[11px] font-bold text-[#ED500A] hover:underline cursor-pointer"
                    title="Restablece los colores a la paleta oficial de este estilo"
                  >
                    ↺ Restaurar colores del estilo
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                      Color Principal
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.primaryColor}
                        onChange={(e) =>
                          setSettings({ ...settings, primaryColor: e.target.value })
                        }
                        className="w-9 h-9 rounded-lg border border-slate-300 dark:border-white/[0.08] cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={settings.primaryColor}
                        onChange={(e) =>
                          setSettings({ ...settings, primaryColor: e.target.value })
                        }
                        className="text-xs font-mono uppercase px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 w-24"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                      Color de Fondo
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.secondaryColor}
                        onChange={(e) =>
                          setSettings({ ...settings, secondaryColor: e.target.value })
                        }
                        className="w-9 h-9 rounded-lg border border-slate-300 dark:border-white/[0.08] cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={settings.secondaryColor}
                        onChange={(e) =>
                          setSettings({ ...settings, secondaryColor: e.target.value })
                        }
                        className="text-xs font-mono uppercase px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 w-24"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                      Color de Acento
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.accentColor}
                        onChange={(e) =>
                          setSettings({ ...settings, accentColor: e.target.value })
                        }
                        className="w-9 h-9 rounded-lg border border-slate-300 dark:border-white/[0.08] cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={settings.accentColor}
                        onChange={(e) =>
                          setSettings({ ...settings, accentColor: e.target.value })
                        }
                        className="text-xs font-mono uppercase px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 w-24"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Textos del Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Título en Cabecera
                  </label>
                  <input
                    type="text"
                    value={settings.bannerTitle || ""}
                    placeholder={business.name}
                    onChange={(e) =>
                      setSettings({ ...settings, bannerTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Subtítulo o Slogan
                  </label>
                  <input
                    type="text"
                    value={settings.bannerSubtitle || ""}
                    placeholder="Ej. Sazón casero y comida rápida"
                    onChange={(e) =>
                      setSettings({ ...settings, bannerSubtitle: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5"
                  />
                </div>
              </div>

              {/* Visibilidad de Elementos */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Visibilidad de Elementos
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                    <input
                      type="checkbox"
                      checked={settings.showPhotos}
                      onChange={(e) =>
                        setSettings({ ...settings, showPhotos: e.target.checked })
                      }
                      className="rounded text-[#ED500A] focus:ring-[#ED500A]"
                    />
                    <span>Mostrar fotos de platos</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                    <input
                      type="checkbox"
                      checked={settings.showDescriptions}
                      onChange={(e) =>
                        setSettings({ ...settings, showDescriptions: e.target.checked })
                      }
                      className="rounded text-[#ED500A] focus:ring-[#ED500A]"
                    />
                    <span>Mostrar descripciones</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                    <input
                      type="checkbox"
                      checked={settings.showPrices}
                      onChange={(e) =>
                        setSettings({ ...settings, showPrices: e.target.checked })
                      }
                      className="rounded text-[#ED500A] focus:ring-[#ED500A]"
                    />
                    <span>Mostrar precios vigentes</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                    <input
                      type="checkbox"
                      checked={settings.showContactInfo}
                      onChange={(e) =>
                        setSettings({ ...settings, showContactInfo: e.target.checked })
                      }
                      className="rounded text-[#ED500A] focus:ring-[#ED500A]"
                    />
                    <span>Mostrar WhatsApp y teléfono</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                    <input
                      type="checkbox"
                      checked={settings.showAddress}
                      onChange={(e) =>
                        setSettings({ ...settings, showAddress: e.target.checked })
                      }
                      className="rounded text-[#ED500A] focus:ring-[#ED500A]"
                    />
                    <span>Mostrar dirección y ciudad</span>
                  </label>
                </div>

                {/* Tarifa de Domicilio predeterminada */}
                <div className="pt-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tarifa de Entrega a Domicilio ({business.currency || "COP"})
                  </label>
                  <p className="text-[11px] text-slate-400 mb-1.5">
                    Se sumará automáticamente al subtotal cuando el cliente elija la modalidad «Domicilio». Si es 0 o vacío, no se cobrará recargo.
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={settings.deliveryFee ?? 0}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        deliveryFee: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    placeholder="0"
                    className="w-full max-w-xs px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono"
                  />
                </div>
              </div>

              {/* Botón Guardar Personalización */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveCustomSettings}
                  disabled={isSaving}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#d44304] text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Guardar Personalización</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* MODALIDAD C: SUBIR PDF O IMAGEN */}
          {/* ======================================================== */}
          {modality === "file" && (
            <div className="bg-white dark:bg-[#0D0F16] p-6 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Menú en Archivo Propio (PDF o Imagen)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Carga tu carta ya diseñada en formato PDF, PNG, JPG o WEBP.
                </p>
              </div>

              {/* Banner Informativo de Optimización de Almacenamiento */}
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-start gap-3 text-xs text-blue-800 dark:text-blue-300">
                <Info className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Optimización estricta de almacenamiento</p>
                  <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-400">
                    Para optimizar tu cuenta de Supabase Storage, se mantiene como máximo 1 archivo activo. Al cargar un nuevo archivo, el anterior se elimina físicamente para evitar sobrecostos.
                  </p>
                </div>
              </div>

              {/* Si ya tiene archivo activo */}
              {menu.file_url ? (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Archivo Publicado Actualmente
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
                      Activo
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-orange-500/10 text-[#ED500A]">
                      {menu.file_type === "pdf" ? (
                        <FileText className="w-6 h-6" />
                      ) : (
                        <ImageIcon className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {menu.file_name || "menu-digital"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {menu.file_type?.toUpperCase()} &bull; {formatBytes(menu.file_size_bytes)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
                    <a
                      href={menu.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ver archivo</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => setIsConfirmDeleteOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-xs font-semibold text-red-700 dark:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Retirar</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Zona de Carga / Sustitución de Archivo */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {menu.file_url ? "Sustituir por un nuevo archivo" : "Cargar archivo de menú"}
                </label>

                <div className="border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-[#ED500A] dark:hover:border-[#ED500A] rounded-2xl p-6 text-center transition-all bg-slate-50/50 dark:bg-white/[0.01]">
                  <UploadCloud className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Arrastra tu archivo aquí o haz clic para seleccionarlo
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Formatos admitidos: PDF, JPEG, PNG, WEBP (Máx. 10MB)
                  </p>

                  <input
                    type="file"
                    id="menuFileInput"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />

                  <div className="mt-4">
                    <label
                      htmlFor="menuFileInput"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-sm ${
                        isUploading
                          ? "bg-slate-400 cursor-not-allowed"
                          : "bg-[#ED500A] hover:bg-[#d44304]"
                      }`}
                    >
                      {isUploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileUp className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isUploading
                          ? "Cargando y optimizando..."
                          : menu.file_url
                          ? "Seleccionar nuevo archivo"
                          : "Examinar archivos"}
                      </span>
                    </label>
                  </div>

                  {uploadProgress && (
                    <p className="text-xs text-orange-500 font-medium mt-2 animate-pulse">
                      {uploadProgress}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PANEL DERECHO: VISTA PREVIA EN VIVO */}
        <div
          className={`lg:col-span-6 space-y-3 ${
            mobileTab === "editor" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="bg-white dark:bg-[#0D0F16] p-3 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#ED500A]" />
              <span className="text-xs font-bold text-slate-800 dark:text-white">
                Vista Previa en Vivo
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                &bull; Actualizada al instante
              </span>
            </div>

            {/* Selector de Dispositivo, Refrescar y Enlace Externo */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIframeKey((k) => k + 1)}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                title="Recargar vista previa"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                    previewDevice === "mobile"
                      ? "bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                  title="Vista móvil (375px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="text-[11px] hidden sm:inline">Móvil</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                    previewDevice === "desktop"
                      ? "bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                  title="Vista completa"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="text-[11px] hidden sm:inline">Escritorio</span>
                </button>
              </div>
            </div>
          </div>

          {/* Marco simulador de pantalla profesional (Viewport Real Aislado con Iframe) */}
          <div className="flex justify-center items-center bg-slate-950/80 p-3 sm:p-5 rounded-3xl border border-slate-800/80 overflow-hidden min-h-[620px]">
            {previewDevice === "mobile" ? (
              /* MOCKUP SMARTPHONE DE ALTA FIDELIDAD CON IFRAME NATIVO */
              <div className="w-[360px] sm:w-[375px] h-[670px] bg-slate-900 border-[10px] border-slate-900 rounded-[48px] shadow-2xl relative overflow-hidden shrink-0 flex flex-col ring-1 ring-white/10">
                {/* Barra de estado móvil realista */}
                <div className="h-6 w-full bg-slate-950 px-6 flex items-center justify-between text-[10px] font-semibold text-slate-400 select-none shrink-0 border-b border-white/5">
                  <span>9:41</span>
                  <div className="flex items-center gap-1.5 text-[9px] tracking-tight">
                    <span>5G</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Iframe Viewport Móvil 100% Aislado y Fluido */}
                <iframe
                  key={`mobile-preview-${iframeKey}-${previewIframeUrl}`}
                  src={previewIframeUrl}
                  className="w-full flex-1 border-0 bg-white"
                  title="Vista previa móvil del menú digital"
                />
              </div>
            ) : (
              /* MOCKUP NAVEGADOR ESCRITORIO CON IFRAME NATIVO */
              <div className="w-full h-[670px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">
                {/* Barra de ventana simulada */}
                <div className="w-full px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 select-none">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex-1 max-w-sm mx-auto bg-slate-900 border border-slate-800 rounded-md px-2.5 py-0.5 text-[11px] text-slate-400 font-mono truncate text-center">
                    https://negova.app/menu/{business.slug || business.id}
                  </div>
                  <div className="w-12" />
                </div>

                {/* Iframe Viewport Escritorio 100% Aislado */}
                <iframe
                  key={`desktop-preview-${iframeKey}-${previewIframeUrl}`}
                  src={previewIframeUrl}
                  className="w-full flex-1 border-0 bg-white"
                  title="Vista previa escritorio del menú digital"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmación para Retirar Archivo Propio (REGLA: Prohibido alert/confirm nativo) */}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmRemoveFile}
        title="¿Deseas retirar el archivo del menú digital?"
        description="El archivo se eliminará definitivamente de Supabase Storage para liberar almacenamiento. El menú digital regresará a la modalidad de plantillas prediseñadas."
        confirmText="Retirar y liberar espacio"
        cancelText="Conservar archivo"
        variant="danger"
        isLoading={isSaving}
      />
    </div>
  );
}
