"use client";

import React, { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  HelpCircle,
  BookOpen,
  Video,
  Send,
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Clock,
  Lightbulb,
  Phone,
  MessageCircle,
  Copy,
  Check,
  AlertCircle,
  Play,
  X,
  FileQuestion,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { AdminBadge } from "@/components/ui/badge";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import {
  HELP_ARTICLES,
  HELP_FAQS,
  HELP_VIDEOS,
  HelpArticle,
  HelpFaq,
  HelpVideo,
} from "@/config/workspace-help-content";
import { submitSupportTicketAction } from "./actions";

type TabId = "guias" | "faqs" | "videos" | "contacto";

interface WorkspaceHelpClientProps {
  businessId: string;
  initialContext?: string;
  userEmail?: string;
}

export function WorkspaceHelpClient({
  businessId,
  initialContext = "pos",
  userEmail = "",
}: WorkspaceHelpClientProps) {
  const searchParams = useSearchParams();
  const contextParam = searchParams.get("context") || initialContext;

  const [activeTab, setActiveTab] = useState<TabId>("guias");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Guía actualmente seleccionada
  const [selectedArticleId, setSelectedArticleId] = useState<string>(() => {
    const match = HELP_ARTICLES.find((a) => a.moduleId === contextParam);
    return match ? match.id : HELP_ARTICLES[0].id;
  });

  // FAQs expandidas
  const [expandedFaqIds, setExpandedFaqIds] = useState<Set<string>>(new Set(["faq-1"]));

  // Video en modal
  const [activeVideo, setActiveVideo] = useState<HelpVideo | null>(null);

  // Formulario de soporte
  const [isPending, startTransition] = useTransition();
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState("pos");
  const [ticketPriority, setTicketPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [ticketPhone, setTicketPhone] = useState("");
  const [ticketAttachment, setTicketAttachment] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [submittedTicketNumber, setSubmittedTicketNumber] = useState<string | null>(null);
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Sincronizar contexto cuando cambia el query param
  useEffect(() => {
    if (contextParam) {
      const match = HELP_ARTICLES.find((a) => a.moduleId === contextParam);
      if (match) {
        setSelectedArticleId(match.id);
        setSelectedModule(match.moduleId);
        setActiveTab("guias");
      }
    }
  }, [contextParam]);

  // Lista de módulos disponibles para filtro
  const modulesList = useMemo(() => {
    const list = [
      { id: "all", name: "Todos los módulos" },
      { id: "pos", name: "POS / Ventas" },
      { id: "caja", name: "Caja y Turnos" },
      { id: "productos", name: "Productos y Stock" },
      { id: "mesas", name: "Mesas y Salón" },
      { id: "cocina", name: "Cocina (KDS)" },
      { id: "domicilios", name: "Domicilios" },
      { id: "clientes", name: "Clientes y Crédito" },
      { id: "reportes", name: "Reportes" },
      { id: "configuracion", name: "Configuración" },
    ];
    return list;
  }, []);

  // Filtrar artículos
  const filteredArticles = useMemo(() => {
    return HELP_ARTICLES.filter((article) => {
      const matchModule = selectedModule === "all" || article.moduleId === selectedModule;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        article.title.toLowerCase().includes(q) ||
        article.summary.toLowerCase().includes(q) ||
        article.moduleName.toLowerCase().includes(q) ||
        article.steps.some((s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));

      return matchModule && matchQuery;
    });
  }, [selectedModule, searchQuery]);

  // Artículo activo
  const activeArticle = useMemo(() => {
    return HELP_ARTICLES.find((a) => a.id === selectedArticleId) || filteredArticles[0] || HELP_ARTICLES[0];
  }, [selectedArticleId, filteredArticles]);

  // Filtrar FAQs
  const filteredFaqs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return HELP_FAQS.filter((faq) => {
      if (!q) return true;
      return (
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        faq.category.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  // Toggle FAQ
  const toggleFaq = (id: string) => {
    setExpandedFaqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Enviar ticket de soporte
  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDescription.trim()) {
      toast.warning("Formulario incompleto", {
        description: "Por favor diligencia el asunto y la descripción detallada de tu consulta.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await submitSupportTicketAction(businessId, {
          subject: ticketSubject.trim(),
          description: ticketDescription.trim(),
          category: ticketCategory,
          priority: ticketPriority,
          contactPhone: ticketPhone.trim() || undefined,
          attachmentUrl: ticketAttachment.trim() || undefined,
        });

        if (res.success && res.ticketNumber) {
          setSubmittedTicketNumber(res.ticketNumber);
          toast.success("¡Ticket creado con éxito!", {
            description: `Tu caso ha sido asignado con el número ${res.ticketNumber}. Te responderemos a la brevedad.`,
          });
          // Limpiar formulario
          setTicketSubject("");
          setTicketDescription("");
          setTicketAttachment("");
          setTicketPhone("");
        } else {
          toast.error("Error al enviar ticket", {
            description: res.error || "No fue posible registrar tu ticket en este momento.",
          });
        }
      } catch (err: any) {
        toast.error("Error inesperado", {
          description: err?.message || "Ocurrió un error al enviar el ticket.",
        });
      }
    });
  };

  // Copiar ticket
  const handleCopyTicket = (ticketNum: string) => {
    navigator.clipboard.writeText(ticketNum);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2000);
    toast.success("Número de ticket copiado al portapapeles");
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-body">
      {/* ─── ENCABEZADO PRINCIPAL ───────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 dark:from-[#0D0F16] dark:via-[#141824] dark:to-[#0D0F16] text-white border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#ED500A]/20 text-orange-400 border border-[#ED500A]/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Centro de Ayuda y Aprendizaje NEGOVA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-title tracking-tight">
            ¿En qué podemos ayudarte hoy?
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Encuentra guías paso a paso, respuestas rápidas a tus dudas operativas o comunícate directamente con nuestro equipo de soporte técnico.
          </p>

          {/* Barra de búsqueda interactiva */}
          <div className="pt-2">
            <div className="relative max-w-lg">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Busca por palabra clave (ej. 'cierre de caja', 'impresora', 'crear producto')..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 dark:bg-white/5 border border-white/15 focus:border-[#ED500A] focus:outline-hidden text-xs sm:text-sm text-white placeholder-slate-400 backdrop-blur-xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Acceso Rápido a Soporte WhatsApp */}
        <div className="relative z-10 flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
          <a
            href="https://wa.me/573000000000?text=Hola%20equipo%20NEGOVA,%20necesito%20asistencia%20en%20mi%20workspace"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Chat de Soporte WhatsApp</span>
          </a>
          <button
            type="button"
            onClick={() => setActiveTab("contacto")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Crear Ticket de Soporte</span>
          </button>
        </div>
      </div>

      {/* ─── PESTAÑAS PRINCIPALES DE NAVEGACIÓN ─────────────────────────── */}
      <Tabs<TabId>
        variant="underline"
        tabs={[
          { id: "guias", label: `Guías Rápidas (${HELP_ARTICLES.length})`, icon: <BookOpen className="w-4 h-4" /> },
          { id: "faqs", label: `Preguntas Frecuentes (${HELP_FAQS.length})`, icon: <FileQuestion className="w-4 h-4" /> },
          { id: "videos", label: `Videos Tutoriales (${HELP_VIDEOS.length})`, icon: <Video className="w-4 h-4" /> },
          { id: "contacto", label: "Contactar Soporte", icon: <Send className="w-4 h-4" /> },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ══════════════════════════════════════════════════════════════════════
           TAB 1: GUÍAS RÁPIDAS PASO A PASO
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "guias" && (
        <div className="space-y-6">
          {/* Filtros de Módulo */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {modulesList.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => setSelectedModule(mod.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedModule === mod.id
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400"
                }`}
              >
                {mod.name}
              </button>
            ))}
          </div>

          {/* Vista Principal: Lista Lateral + Detalle de la Guía */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Índice de Guías */}
            <div className="lg:col-span-4 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-400 px-1">
                Artículos ({filteredArticles.length})
              </p>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredArticles.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                    <FileQuestion className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      No encontramos guías con ese criterio.
                    </p>
                  </div>
                ) : (
                  filteredArticles.map((article) => {
                    const isSelected = article.id === activeArticle.id;
                    return (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => setSelectedArticleId(article.id)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/30 shadow-xs"
                            : "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider font-mono ${
                              isSelected ? "text-[#ED500A]" : "text-slate-400"
                            }`}
                          >
                            {article.moduleName}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {article.readTime}
                          </span>
                        </div>
                        <h4
                          className={`text-xs font-bold leading-snug line-clamp-2 ${
                            isSelected ? "text-[#ED500A]" : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {article.title}
                        </h4>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Columna Derecha: Lectura de la Guía Activa */}
            <div className="lg:col-span-8">
              {activeArticle ? (
                <div className="bg-white dark:bg-[#0D0F16] rounded-3xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm p-6 sm:p-8 space-y-6">
                  {/* Encabezado del Artículo */}
                  <div className="space-y-2 border-b border-slate-100 dark:border-white/5 pb-5">
                    <div className="flex items-center gap-2">
                      <AdminBadge variant="orange">{activeArticle.moduleName}</AdminBadge>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {activeArticle.readTime}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold font-title text-slate-900 dark:text-white">
                      {activeArticle.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {activeArticle.summary}
                    </p>
                  </div>

                  {/* Pasos */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400">
                      Instrucciones Paso a Paso
                    </h3>

                    <div className="space-y-4">
                      {activeArticle.steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-2"
                        >
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{step.title}</span>
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {step.description}
                          </p>
                          {step.tip && (
                            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-orange-50/70 dark:bg-orange-500/5 border border-orange-200/60 dark:border-orange-500/15 text-[11px] text-orange-800 dark:text-orange-300">
                              <Lightbulb className="w-3.5 h-3.5 text-[#ED500A] shrink-0 mt-0.5" />
                              <span>
                                <strong>Consejo:</strong> {step.tip}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Acciones al pie */}
                  <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <span className="text-slate-400">¿Esta guía resolvió tu duda?</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toast.success("¡Gracias por tu valoración!")}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        👍 Sí, me ayudó
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTicketCategory(activeArticle.moduleId);
                          setActiveTab("contacto");
                        }}
                        className="px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 text-[#ED500A] transition-colors cursor-pointer"
                      >
                        Contactar a un asesor
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           TAB 2: PREGUNTAS FRECUENTES (FAQ)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "faqs" && (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400">
              Preguntas Frecuentes ({filteredFaqs.length})
            </p>
            <span className="text-xs text-slate-400">Haz clic en una pregunta para ver la respuesta</span>
          </div>

          <div className="space-y-3">
            {filteredFaqs.map((faq) => {
              const isExpanded = expandedFaqIds.has(faq.id);
              return (
                <div
                  key={faq.id}
                  className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] overflow-hidden transition-all shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/[0.01]"
                  >
                    <div className="space-y-1">
                      <AdminBadge variant="slate" size="sm">
                        {faq.category}
                      </AdminBadge>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {faq.question}
                      </h4>
                    </div>
                    <div className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-white/5 animate-in fade-in duration-150">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           TAB 3: VIDEOS TUTORIALES
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "videos" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HELP_VIDEOS.map((vid) => (
              <div
                key={vid.id}
                className="group rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail con Botón Play */}
                  <div className="relative aspect-video bg-slate-900 overflow-hidden cursor-pointer" onClick={() => setActiveVideo(vid)}>
                    <img
                      src={vid.thumbnailUrl}
                      alt={vid.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-[#ED500A] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 ml-0.5 fill-white" />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-mono text-white font-bold">
                      {vid.duration}
                    </span>
                  </div>

                  <div className="p-4 space-y-1.5">
                    <AdminBadge variant="orange" size="sm">
                      {vid.moduleId.toUpperCase()}
                    </AdminBadge>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                      {vid.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {vid.description}
                    </p>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <button
                    type="button"
                    onClick={() => setActiveVideo(vid)}
                    className="w-full py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Ver Tutorial
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           TAB 4: CONTACTAR A SOPORTE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "contacto" && (
        <div className="max-w-2xl mx-auto space-y-6">
          {submittedTicketNumber ? (
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0D0F16] border border-emerald-500/30 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold font-title text-slate-900 dark:text-white">
                  ¡Solicitud Enviada con Éxito!
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tu ticket ha sido registrado en nuestra mesa de ayuda. Un ingeniero de soporte se comunicará contigo.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 max-w-sm mx-auto space-y-2">
                <span className="text-[10px] uppercase font-mono text-slate-400">Número de Ticket</span>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-base font-bold font-mono text-[#ED500A] tracking-wider">
                    {submittedTicketNumber}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyTicket(submittedTicketNumber)}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    title="Copiar ticket"
                  >
                    {copiedTicket ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSubmittedTicketNumber(null)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#ED500A] hover:bg-[#ED500A]/90 transition-all cursor-pointer"
                >
                  Crear otra consulta
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0D0F16] rounded-3xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm p-6 sm:p-8 space-y-5">
              <div>
                <h3 className="text-lg font-bold font-title text-slate-900 dark:text-white">
                  Formulario de Soporte Técnico
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Describe tu consulta o problema. Entre más detalles y capturas proporciones, más rápido resolveremos tu caso.
                </p>
              </div>

              <form onSubmit={handleSubmitTicket} className="space-y-4">
                {/* Asunto */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Asunto de la solicitud <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="Ej. Problema al imprimir comanda en impresora de cocina"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-[#ED500A] focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Módulo Afectado */}
                  <div className="space-y-1.5">
                    <Select
                      label="Módulo o Área"
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value)}
                    >
                      <option value="pos">Punto de Venta (POS)</option>
                      <option value="caja">Caja y Arqueos</option>
                      <option value="productos">Catálogo e Inventario</option>
                      <option value="mesas">Mesas y Restaurante</option>
                      <option value="cocina">Cocina (KDS)</option>
                      <option value="domicilios">Domicilios</option>
                      <option value="facturacion">Facturación / Comprobantes</option>
                      <option value="impresion">Impresoras Térmicas</option>
                      <option value="general">Otro / Consulta General</option>
                    </Select>
                  </div>

                  {/* Prioridad */}
                  <div className="space-y-1.5">
                    <Select
                      label="Nivel de Urgencia"
                      value={ticketPriority}
                      onChange={(e) => setTicketPriority(e.target.value as any)}
                    >
                      <option value="low">Baja — Duda general o sugerencia</option>
                      <option value="medium">Media — Funcionalidad con alternativa</option>
                      <option value="high">Alta — Afecta la operación del día</option>
                      <option value="urgent">Urgente — Operación detenida por completo</option>
                    </Select>
                  </div>
                </div>

                {/* Teléfono y Captura */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Teléfono o WhatsApp de contacto
                    </label>
                    <input
                      type="tel"
                      value={ticketPhone}
                      onChange={(e) => setTicketPhone(e.target.value)}
                      placeholder="+57 300 123 4567"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-[#ED500A] focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Enlace a captura o imagen (opcional)
                    </label>
                    <input
                      type="url"
                      value={ticketAttachment}
                      onChange={(e) => setTicketAttachment(e.target.value)}
                      placeholder="https://imgur.com/..."
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-[#ED500A] focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Descripción */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Descripción del problema o requerimiento <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    placeholder="Detalla qué estabas haciendo, el mensaje de error que apareció y los pasos para reproducirlo..."
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-[#ED500A] focus:outline-hidden"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#ED500A] hover:bg-[#ED500A]/90 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isPending ? "Enviando ticket..." : "Enviar Solicitud a Soporte"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL DE REPRODUCTOR DE VIDEO ─────────────────────────────── */}
      {activeVideo && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm font-body animate-in fade-in duration-150">
            <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden space-y-4">
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-[#ED500A]" />
                  <h3 className="text-sm font-bold text-white">{activeVideo.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveVideo(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Embed Player */}
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={activeVideo.embedUrl}
                  title={activeVideo.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <div className="p-4 pt-0">
                <p className="text-xs text-slate-300">{activeVideo.description}</p>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
