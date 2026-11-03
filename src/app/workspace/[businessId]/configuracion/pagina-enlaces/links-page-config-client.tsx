"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Globe,
  ExternalLink,
  Copy,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Check,
  Sparkles,
  Smartphone,
  Palette,
  Utensils,
  ShoppingBag,
  MessageCircle,
  MapPin,
  Phone,
  Mail,
  Star,
  Link as LinkIcon,
  RotateCcw,
  Save,
  CheckCircle2,
} from "lucide-react";

function Instagram({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

function Facebook({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  );
}
import { toast } from "sonner";
import {
  BusinessLinksPageConfig,
  BioLinkItem,
  BioThemePreset,
  LinkIconType,
} from "@/lib/links/types";
import {
  saveBusinessLinksPageConfigAction,
  resetPredefinedLinksAction,
} from "./actions";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface LinksPageConfigClientProps {
  initialConfig: BusinessLinksPageConfig;
  businessId: string;
}

const AVAILABLE_ICONS: { id: LinkIconType; label: string }[] = [
  { id: "utensils", label: "Menú / Restaurante" },
  { id: "shopping-bag", label: "Domicilio / Compras" },
  { id: "message-circle", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "map-pin", label: "Ubicación / Maps" },
  { id: "phone", label: "Teléfono" },
  { id: "globe", label: "Sitio Web" },
  { id: "facebook", label: "Facebook" },
  { id: "mail", label: "Correo" },
  { id: "star", label: "Destacado / Reseñas" },
  { id: "link", label: "Enlace General" },
];

const THEME_OPTIONS: { id: BioThemePreset; label: string; previewClass: string }[] = [
  { id: "slate", label: "Minimalista Claro", previewClass: "bg-slate-100 text-slate-900 border-slate-300" },
  { id: "dark", label: "Elegante Oscuro", previewClass: "bg-slate-900 text-white border-slate-700" },
  { id: "emerald", label: "Esmeralda Botánico", previewClass: "bg-emerald-950 text-emerald-100 border-emerald-800" },
  { id: "indigo", label: "Índigo Moderno", previewClass: "bg-indigo-950 text-indigo-100 border-indigo-800" },
  { id: "rose", label: "Gourmet Cálido", previewClass: "bg-rose-950 text-rose-100 border-rose-800" },
  { id: "amber", label: "Ámbar Rústico", previewClass: "bg-amber-950 text-amber-100 border-amber-800" },
  { id: "gradient_sunset", label: "Atardecer Degradado", previewClass: "bg-gradient-to-br from-amber-500 via-rose-600 to-purple-800 text-white" },
  { id: "gradient_ocean", label: "Océano Degradado", previewClass: "bg-gradient-to-br from-cyan-600 via-blue-700 to-indigo-900 text-white" },
];

export function renderIconPreview(iconName: string, className = "w-4 h-4") {
  switch (iconName) {
    case "menu":
    case "utensils":
      return <Utensils className={className} />;
    case "delivery":
    case "shopping-bag":
      return <ShoppingBag className={className} />;
    case "whatsapp":
    case "message-circle":
      return <MessageCircle className={className} />;
    case "instagram":
      return <Instagram className={className} />;
    case "maps":
    case "map-pin":
      return <MapPin className={className} />;
    case "phone":
      return <Phone className={className} />;
    case "globe":
      return <Globe className={className} />;
    case "facebook":
      return <Facebook className={className} />;
    case "mail":
      return <Mail className={className} />;
    case "star":
      return <Star className={className} />;
    default:
      return <LinkIcon className={className} />;
  }
}

export function LinksPageConfigClient({
  initialConfig,
  businessId,
}: LinksPageConfigClientProps) {
  const [isPending, startTransition] = useTransition();

  const [businessName, setBusinessName] = useState(initialConfig.businessName);
  const [slug, setSlug] = useState(initialConfig.slug);
  const [logoUrl, setLogoUrl] = useState(initialConfig.logoUrl || "");
  const [description, setDescription] = useState(initialConfig.description || "");
  const [theme, setTheme] = useState<BioThemePreset>(initialConfig.theme);
  const [showPoweredBy, setShowPoweredBy] = useState(initialConfig.showPoweredBy);
  const [links, setLinks] = useState<BioLinkItem[]>(initialConfig.links);

  const [linkToDelete, setLinkToDelete] = useState<BioLinkItem | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Manipulación de Enlaces
  const handleAddLink = () => {
    const newLink: BioLinkItem = {
      id: `link-${Date.now()}`,
      title: "Nuevo Enlace",
      url: "https://",
      icon: "link",
      order: links.length + 1,
      isActive: true,
    };
    setLinks([...links, newLink]);
    toast.success("Nuevo enlace añadido a la lista.");
  };

  const handleUpdateLink = (id: string, updates: Partial<BioLinkItem>) => {
    setLinks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleToggleActive = (id: string) => {
    setLinks((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isActive: !item.isActive } : item
      )
    );
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const copy = [...links];
    const temp = copy[index - 1];
    copy[index - 1] = copy[index];
    copy[index] = temp;
    // Reindexar orden
    copy.forEach((l, i) => (l.order = i + 1));
    setLinks(copy);
  };

  const handleMoveDown = (index: number) => {
    if (index >= links.length - 1) return;
    const copy = [...links];
    const temp = copy[index + 1];
    copy[index + 1] = copy[index];
    copy[index] = temp;
    // Reindexar orden
    copy.forEach((l, i) => (l.order = i + 1));
    setLinks(copy);
  };

  const handleConfirmDeleteLink = () => {
    if (!linkToDelete) return;
    const filtered = links.filter((l) => l.id !== linkToDelete.id);
    filtered.forEach((l, i) => (l.order = i + 1));
    setLinks(filtered);
    setLinkToDelete(null);
    toast.success("Enlace eliminado de la lista.");
  };

  const handleSaveConfig = () => {
    startTransition(async () => {
      const res = await saveBusinessLinksPageConfigAction(businessId, {
        businessName,
        slug,
        logoUrl: logoUrl.trim() || null,
        description,
        theme,
        showPoweredBy,
        links,
      });

      if (res.success && res.data) {
        toast.success("Página de enlaces guardada y publicada exitosamente.");
        setSlug(res.data.slug);
      } else {
        toast.error(res.error || "No fue posible guardar la configuración.");
      }
    });
  };

  const handleResetDefaults = () => {
    startTransition(async () => {
      const res = await resetPredefinedLinksAction(businessId);
      if (res.success && res.data) {
        setLinks(res.data.links);
        setResetModalOpen(false);
        toast.success("Enlaces predeterminados restaurados exitosamente.");
      } else {
        toast.error(res.error || "Error al restaurar los enlaces.");
      }
    });
  };

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/links/${slug}`
    : `/links/${slug}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Enlace público copiado al portapapeles.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No fue posible copiar el enlace.");
    }
  };

  // Estilos del Mockup según Tema
  const getThemeStyles = () => {
    switch (theme) {
      case "dark":
        return {
          bg: "bg-[#0A0D14]",
          card: "bg-white/10 hover:bg-white/15 text-white border-white/10",
          text: "text-white",
          subtext: "text-slate-400",
        };
      case "emerald":
        return {
          bg: "bg-[#062419]",
          card: "bg-emerald-900/60 hover:bg-emerald-900/90 text-emerald-50 border-emerald-700/50",
          text: "text-white",
          subtext: "text-emerald-200",
        };
      case "indigo":
        return {
          bg: "bg-[#0F172A]",
          card: "bg-indigo-900/60 hover:bg-indigo-900/90 text-indigo-50 border-indigo-700/50",
          text: "text-white",
          subtext: "text-indigo-200",
        };
      case "rose":
        return {
          bg: "bg-[#2A0E17]",
          card: "bg-rose-900/60 hover:bg-rose-900/90 text-rose-50 border-rose-700/50",
          text: "text-white",
          subtext: "text-rose-200",
        };
      case "amber":
        return {
          bg: "bg-[#221307]",
          card: "bg-amber-900/60 hover:bg-amber-900/90 text-amber-50 border-amber-700/50",
          text: "text-white",
          subtext: "text-amber-200",
        };
      case "gradient_sunset":
        return {
          bg: "bg-gradient-to-b from-amber-500 via-rose-600 to-purple-900",
          card: "bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-white/20",
          text: "text-white",
          subtext: "text-white/80",
        };
      case "gradient_ocean":
        return {
          bg: "bg-gradient-to-b from-cyan-600 via-blue-700 to-indigo-950",
          card: "bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-white/20",
          text: "text-white",
          subtext: "text-white/80",
        };
      default: // slate
        return {
          bg: "bg-slate-50",
          card: "bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-xs",
          text: "text-slate-900",
          subtext: "text-slate-500",
        };
    }
  };

  const themeStyle = getThemeStyles();

  return (
    <div className="space-y-6 font-body">
      {/* 1. BARRA SUPERIOR: ENLACE PÚBLICO Y ACCIÓN GUARDAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              Enlace Público en Vivo:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400 truncate max-w-[260px] sm:max-w-md">
                /links/{slug}
              </span>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Copiar URL"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <Link
                href={`/links/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Abrir página en nueva pestaña"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isPending ? "Guardando..." : "Guardar y Publicar"}</span>
          </button>
        </div>
      </div>

      {/* 2. CONTENIDO PRINCIPAL: 2 COLUMNAS (FORMULARIO Y PREVIEW MÓVIL) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: CONFIGURADOR (7 COLUMNAS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECCIÓN A: BRANDING Y DATOS DEL NEGOCIO */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Identidad y Branding
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Nombre Comercial *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Slug / URL Personalizada *
                </label>
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 overflow-hidden">
                  <span className="px-2.5 text-[11px] text-slate-400 font-mono select-none">/links/</span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    className="w-full px-2 py-2 bg-transparent text-slate-900 dark:text-white font-mono text-xs border-0 focus:ring-0"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Descripción Corta / Bio
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="¡Bienvenidos! Encuentra aquí nuestro menú digital, domicilios y redes oficiales."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white text-xs resize-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  URL del Logo o Imagen de Perfil
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://ejemplo.com/logo.png"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN B: PALETA Y TEMA VISUAL */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-500" />
              Tema y Estilo Visual
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    theme === t.id
                      ? "ring-2 ring-blue-500 border-blue-500 shadow-xs"
                      : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20"
                  }`}
                >
                  <div className={`w-full h-8 rounded-lg mb-2 border ${t.previewClass}`} />
                  <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 block truncate">
                    {t.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-white/[0.06]">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Mostrar distintivo &quot;Potenciado por NEGOVA&quot; en el pie
              </span>
              <button
                type="button"
                onClick={() => setShowPoweredBy(!showPoweredBy)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  showPoweredBy ? "bg-blue-600 justify-end" : "bg-slate-300 dark:bg-white/20 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </button>
            </div>
          </div>

          {/* SECCIÓN C: GESTIÓN DE ENLACES (LINKTREE) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-emerald-500" />
                  Lista de Enlaces ({links.length})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Configura los botones visibles para tus comensales y seguidores.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="Restaurar los 5 enlaces predeterminados"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Restaurar 5 Enlaces</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold shadow-xs transition-colors cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Enlace</span>
                </button>
              </div>
            </div>

            {/* LISTA DE ENLACES DRAGGABLE / ORDENABLE */}
            <div className="space-y-3">
              {links.map((link, index) => (
                <div
                  key={link.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    link.isActive
                      ? "bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] shadow-xs"
                      : "bg-slate-50 dark:bg-white/[0.01] border-dashed border-slate-200 dark:border-white/[0.06] opacity-60"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Controles de Orden y Estado */}
                    <div className="flex items-center gap-1 self-start sm:self-center">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                          title="Subir orden"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === links.length - 1}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                          title="Bajar orden"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        {renderIconPreview(link.icon, "w-4 h-4")}
                      </div>
                    </div>

                    {/* Inputs de Título y URL */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={link.title}
                          onChange={(e) => handleUpdateLink(link.id, { title: e.target.value })}
                          placeholder="Título del botón"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-semibold text-slate-900 dark:text-white text-xs"
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={link.url}
                          onChange={(e) => handleUpdateLink(link.id, { url: e.target.value })}
                          placeholder="URL de destino (https://... o /menu/...)"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-700 dark:text-slate-300 text-xs"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <select
                          value={link.icon}
                          onChange={(e) => handleUpdateLink(link.id, { icon: e.target.value as any })}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 text-xs cursor-pointer"
                        >
                          {AVAILABLE_ICONS.map((ic) => (
                            <option key={ic.id} value={ic.id} className="dark:bg-[#0D0F16]">
                              {ic.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Acciones del Item */}
                    <div className="flex items-center justify-end gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-white/[0.04]">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(link.id)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          link.isActive
                            ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                            : "text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                        }`}
                        title={link.isActive ? "Desactivar enlace (Ocultar)" : "Activar enlace (Mostrar)"}
                      >
                        {link.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setLinkToDelete(link)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Eliminar enlace"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: PREVISUALIZACIÓN EN VIVO (MOCKUP SMARTPHONE 5 COLUMNAS) */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-2 pb-2 border-b border-white/10">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Smartphone className="w-4 h-4 text-blue-400" />
                Previsualización en Vivo
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                /links/{slug}
              </span>
            </div>

            {/* MARCO DEL SMARTPHONE */}
            <div className="relative mx-auto w-full max-w-[320px] rounded-[36px] p-3 bg-black border-4 border-slate-800 shadow-inner">
              {/* NOTCH */}
              <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mb-2" />

              {/* PANTALLA DEL SMARTPHONE */}
              <div
                className={`w-full min-h-[480px] rounded-[28px] p-5 flex flex-col justify-between transition-colors overflow-hidden ${themeStyle.bg}`}
              >
                {/* CABECERA: LOGO + TITULO + BIO */}
                <div className="space-y-3 text-center pt-2">
                  <div className="w-16 h-16 rounded-full mx-auto p-1 bg-white/20 backdrop-blur-xs shadow-md flex items-center justify-center overflow-hidden border border-white/30">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt={businessName}
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-xl font-black text-white">
                        {businessName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className={`text-sm font-black tracking-tight ${themeStyle.text}`}>
                      {businessName}
                    </h4>
                    {description && (
                      <p className={`text-[11px] leading-relaxed mt-1 px-2 ${themeStyle.subtext}`}>
                        {description}
                      </p>
                    )}
                  </div>
                </div>

                {/* BOTONES DE ENLACES FILTRADOS (SOLO ACTIVOS) */}
                <div className="space-y-2.5 my-5">
                  {links
                    .filter((l) => l.isActive)
                    .map((l) => (
                      <div
                        key={l.id}
                        className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center relative font-semibold text-xs border transition-transform active:scale-98 ${themeStyle.card}`}
                      >
                        <div className="absolute left-3.5">
                          {renderIconPreview(l.icon, "w-4 h-4")}
                        </div>
                        <span className="text-center truncate px-5">{l.title}</span>
                      </div>
                    ))}

                  {links.filter((l) => l.isActive).length === 0 && (
                    <div className="p-4 rounded-xl text-center text-xs opacity-75 border border-dashed">
                      No hay enlaces activos visibles.
                    </div>
                  )}
                </div>

                {/* PIE POWERED BY NEGOVA */}
                {showPoweredBy && (
                  <div className="pt-3 pb-1 text-center">
                    <span className="text-[10px] font-mono tracking-wider opacity-70">
                      ⚡ Potenciado por <strong>NEGOVA</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: CONFIRMACIÓN DE ELIMINACIÓN DE ENLACE */}
      <ConfirmModal
        isOpen={Boolean(linkToDelete)}
        onClose={() => setLinkToDelete(null)}
        onConfirm={handleConfirmDeleteLink}
        title="Eliminar Enlace"
        description={`¿Estás seguro de eliminar el enlace "${linkToDelete?.title || ""}"?`}
        confirmText="Sí, eliminar"
        cancelText="Conservar"
        variant="danger"
        isLoading={isPending}
      />

      {/* MODAL: CONFIRMACIÓN PARA RESTAURAR ENLACES POR DEFECTO */}
      <ConfirmModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleResetDefaults}
        title="Restaurar Enlaces Oficiales"
        description="Esta acción reemplazará la lista actual con los 5 enlaces oficiales recomendados (Menú Digital, Domicilio, WhatsApp, Instagram y Google Maps). ¿Deseas continuar?"
        confirmText="Sí, restaurar los 5 enlaces"
        cancelText="Cancelar"
        variant="warning"
        isLoading={isPending}
      />
    </div>
  );
}
