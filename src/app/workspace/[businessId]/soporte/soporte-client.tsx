"use client";

import React, { useState, useTransition } from "react";
import {
  Headphones,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  X,
  FileText,
  User,
  ShieldCheck,
  LifeBuoy,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { SupportTicket, SupportCategory, TicketPriority, TicketStatus } from "@/lib/support/types";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  createWorkspaceTicketAction,
  getWorkspaceTicketDetailAction,
  sendWorkspaceTicketMessageAction,
} from "./actions";

interface WorkspaceSoporteClientProps {
  businessId: string;
  businessName: string;
  initialTickets: SupportTicket[];
}

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  technical: "Fallo técnico o error",
  usage_inquiry: "Duda de funcionamiento",
  billing: "Facturación o pagos",
  account: "Cuenta y accesos",
  general: "Consulta general",
};

const PRIORITY_LABELS: Record<TicketPriority, { label: string; badgeClass: string }> = {
  low: {
    label: "Baja",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/[0.08]",
  },
  medium: {
    label: "Media",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  },
  high: {
    label: "Alta",
    badgeClass: "bg-orange-50 text-[#ED500A] border-orange-200 dark:bg-[#ED500A]/10 dark:text-orange-400 dark:border-[#ED500A]/20",
  },
  urgent: {
    label: "Urgente",
    badgeClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  },
};

const STATUS_CONFIG: Record<TicketStatus, { label: string; badgeClass: string; icon: React.ElementType }> = {
  open: {
    label: "Abierta",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    icon: AlertCircle,
  },
  in_progress: {
    label: "En proceso",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    icon: Clock,
  },
  resolved: {
    label: "Resuelta",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    icon: CheckCircle2,
  },
  closed: {
    label: "Cerrada",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/[0.08]",
    icon: CheckCircle2,
  },
};

export function WorkspaceSoporteClient({
  businessId,
  businessName,
  initialTickets,
}: WorkspaceSoporteClientProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Array<{
    id: string;
    senderRole: "client" | "agent" | "ai" | "system";
    senderName: string;
    content: string;
    createdAt: string;
  }>>([]);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Modales y estados de UI
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Formulario de creación
  const [formSubject, setFormSubject] = useState("");
  const [formCategory, setFormCategory] = useState<SupportCategory>("general");
  const [formPriority, setFormPriority] = useState<TicketPriority>("medium");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Formulario de nuevo mensaje
  const [replyContent, setReplyContent] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Filtrado en cliente
  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNumber = t.ticketNumber.toLowerCase().includes(q);
      const matchSubject = t.subject.toLowerCase().includes(q);
      const matchDesc = t.description.toLowerCase().includes(q);
      if (!matchNumber && !matchSubject && !matchDesc) return false;
    }
    return true;
  });

  // Métricas
  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  const handleSelectTicket = async (ticket: SupportTicket) => {
    setSelectedTicketId(ticket.id);
    setSelectedTicket(ticket);
    setIsDetailLoading(true);
    setReplyError(null);

    const res = await getWorkspaceTicketDetailAction(businessId, ticket.id);
    if (res.success && res.ticket) {
      setSelectedTicket(res.ticket);
      setTicketMessages(res.messages || []);
    } else {
      setSelectedTicket(ticket);
      setTicketMessages([]);
    }
    setIsDetailLoading(false);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formSubject.trim()) {
      setFormError("Por favor ingresa el asunto de la solicitud.");
      return;
    }
    if (!formDescription.trim()) {
      setFormError("Por favor ingresa una descripción detallada del problema o duda.");
      return;
    }

    startTransition(async () => {
      const res = await createWorkspaceTicketAction(businessId, {
        subject: formSubject,
        description: formDescription,
        category: formCategory,
        priority: formPriority,
      });

      if (res.success && res.ticket) {
        setTickets((prev) => [res.ticket!, ...prev]);
        setIsCreateModalOpen(false);
        setFormSubject("");
        setFormDescription("");
        setFormCategory("general");
        setFormPriority("medium");
        handleSelectTicket(res.ticket);
      } else {
        setFormError(res.error || "No se pudo crear la solicitud. Intenta nuevamente.");
      }
    });
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyContent.trim()) return;

    setIsSendingReply(true);
    setReplyError(null);

    const content = replyContent.trim();
    const res = await sendWorkspaceTicketMessageAction(businessId, selectedTicket.id, content);

    if (res.success) {
      setReplyContent("");
      setTicketMessages((prev) => [
        ...prev,
        {
          id: res.messageId || `msg-${Date.now()}`,
          senderRole: "client",
          senderName: "Tú",
          content,
          createdAt: new Date().toISOString(),
        },
      ]);
    } else {
      setReplyError(res.error || "Error al enviar el mensaje de seguimiento.");
    }
    setIsSendingReply(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Barra de Acción y Resumen de Métricas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Consulta el estado de tus tickets o inicia una nueva solicitud de soporte con el equipo de NEGOVA.
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-[#ED500A] to-[#ab3500] text-white text-xs sm:text-sm font-semibold shadow-md shadow-[#ED500A]/20 hover:brightness-110 active:scale-95 transition-all focus:outline-hidden shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Solicitud</span>
        </button>
      </div>

      {/* 2. Tarjetas de Estado Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Solicitudes</span>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">{totalCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Abiertas o En Proceso</span>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">{openCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Resueltas / Cerradas</span>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">{resolvedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Panel Principal: Lista de Solicitudes y Detalle */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Buscador, Filtros y Lista (5 o 6 columnas) */}
        <div className={`space-y-4 ${selectedTicket ? "lg:col-span-5" : "lg:col-span-12"}`}>
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3">
            {/* Buscador */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por código (TCK-XXXX) o asunto..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] transition-all"
              />
            </div>

            {/* Filtros de Estado y Categoría */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
              >
                <option value="all">Todos los estados</option>
                <option value="open">Abierta</option>
                <option value="in_progress">En proceso</option>
                <option value="resolved">Resuelta</option>
                <option value="closed">Cerrada</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
              >
                <option value="all">Todas las categorías</option>
                <option value="technical">Técnico</option>
                <option value="usage_inquiry">Duda de uso</option>
                <option value="billing">Facturación</option>
                <option value="account">Cuenta y accesos</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          {/* Listado de Tickets */}
          <div className="space-y-2.5">
            {filteredTickets.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl space-y-2">
                <LifeBuoy className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No hay solicitudes registradas</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                    ? "No se encontraron solicitudes con los filtros aplicados."
                    : "Si tienes alguna consulta técnica o inconveniente con tu negocio, crea una nueva solicitud."}
                </p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isSelected = selectedTicketId === ticket.id;
                const statusInfo = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                const priorityInfo = PRIORITY_LABELS[ticket.priority] || PRIORITY_LABELS.medium;
                const StatusIcon = statusInfo.icon;

                return (
                  <div
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative ${
                      isSelected
                        ? "bg-orange-50/40 dark:bg-[#ED500A]/5 border-[#ED500A]/40 shadow-sm"
                        : "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 shadow-xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {ticket.ticketNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-flex items-center gap-1 ${statusInfo.badgeClass}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-medium border ${priorityInfo.badgeClass}`}>
                        {priorityInfo.label}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white mt-2 line-clamp-1">
                      {ticket.subject}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {ticket.description}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-[10px] text-slate-400">
                      <span>{CATEGORY_LABELS[ticket.category] || "General"}</span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha: Detalle de Solicitud y Mensajes */}
        {selectedTicket && (
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-sm space-y-5">
              {/* Header del Ticket */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#ED500A] bg-orange-50 dark:bg-[#ED500A]/10 px-2 py-0.5 rounded-md border border-orange-200/60 dark:border-[#ED500A]/20">
                      {selectedTicket.ticketNumber}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_CONFIG[selectedTicket.status].badgeClass}`}>
                      {STATUS_CONFIG[selectedTicket.status].label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${PRIORITY_LABELS[selectedTicket.priority].badgeClass}`}>
                      Prioridad {PRIORITY_LABELS[selectedTicket.priority].label}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mt-2">
                    {selectedTicket.subject}
                  </h2>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                    <span>Categoría: <strong>{CATEGORY_LABELS[selectedTicket.category]}</strong></span>
                    <span>Creado: <strong>{new Date(selectedTicket.createdAt).toLocaleString("es-CO")}</strong></span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTicketId(null);
                    setSelectedTicket(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                  title="Cerrar detalle"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Descripción Inicial del Caso */}
              <div className="bg-slate-50 dark:bg-white/[0.02] p-4 rounded-xl border border-slate-200/60 dark:border-white/5 space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Descripción del problema reportado
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Solución o Respuesta Oficial de NEGOVA (si existe) */}
              {selectedTicket.clientResolution && (
                <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 space-y-1.5 animate-in fade-in-50">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Resolución oficial del equipo de Soporte NEGOVA</span>
                  </div>
                  <p className="text-xs text-emerald-950 dark:text-emerald-200 whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.clientResolution}
                  </p>
                  {selectedTicket.resolvedAt && (
                    <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
                      Fecha de resolución: {new Date(selectedTicket.resolvedAt).toLocaleString("es-CO")}
                    </div>
                  )}
                </div>
              )}

              {/* Historial de Mensajes / Conversación */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-title text-slate-900 dark:text-white flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                    Historial de Comunicación y Respuestas
                  </span>
                  {isDetailLoading && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Cargando...
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-slate-50/80 dark:bg-black/20 border border-slate-200/60 dark:border-white/5 scrollbar-thin">
                  {ticketMessages.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No hay mensajes adicionales de seguimiento aún. Nuestro equipo revisará tu caso a la brevedad.
                    </div>
                  ) : (
                    ticketMessages.map((msg) => {
                      const isClient = msg.senderRole === "client";
                      const isAgent = msg.senderRole === "agent";
                      const isAi = msg.senderRole === "ai";

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isClient ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400">
                            {isClient ? (
                              <span>Tú ({businessName})</span>
                            ) : isAgent ? (
                              <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Asesor NEGOVA
                              </span>
                            ) : isAi ? (
                              <span className="font-semibold text-[#ED500A] flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> IA de Soporte
                              </span>
                            ) : (
                              <span>Sistema</span>
                            )}
                            <span>•</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>

                          <div
                            className={`px-3.5 py-2 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                              isClient
                                ? "bg-[#ED500A] text-white rounded-tr-xs"
                                : isAgent
                                ? "bg-blue-600 text-white rounded-tl-xs"
                                : "bg-white dark:bg-[#0D0F16] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.08] rounded-tl-xs"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Formulario para Enviar Nuevo Mensaje */}
              {selectedTicket.status !== "closed" ? (
                <form onSubmit={handleSendReply} className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                  {replyError && (
                    <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs">
                      {replyError}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Escribe un mensaje o responde al equipo de soporte..."
                      disabled={isSendingReply}
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] transition-all"
                    />
                    <button
                      type="submit"
                      disabled={isSendingReply || !replyContent.trim()}
                      className="px-4 py-2 rounded-xl bg-[#ED500A] text-white text-xs font-semibold hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0"
                    >
                      {isSendingReply ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Enviar</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-xl text-center text-xs text-slate-500">
                  Esta solicitud ha sido cerrada. Si necesitas ayuda con otro asunto, por favor crea una nueva solicitud.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Modal Personalizado: Nueva Solicitud (Cumple regla No Alertas Nativas) */}
      {isCreateModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
              onClick={() => setIsCreateModalOpen(false)}
            />

            <div className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl p-6 z-10 animate-in fade-in zoom-in-95 duration-150 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Crear Solicitud de Soporte
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Asunto de la solicitud <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="Ej: Inconveniente con cierre de turno de caja o impresión"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Categoría
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as SupportCategory)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                    >
                      <option value="technical">Fallo técnico o error</option>
                      <option value="usage_inquiry">Duda de funcionamiento</option>
                      <option value="billing">Facturación o pagos</option>
                      <option value="account">Cuenta y accesos</option>
                      <option value="general">Consulta general</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Prioridad
                    </label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value as TicketPriority)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                    >
                      <option value="low">Baja - Consulta general</option>
                      <option value="medium">Media - Operación normal</option>
                      <option value="high">Alta - Afecta ventas o emisión</option>
                      <option value="urgent">Urgente - Bloqueo total</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Descripción detallada <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe con precisión qué ocurrió, los pasos para reproducir o la duda que requieres solucionar..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] resize-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#ED500A] text-white text-xs font-semibold shadow-md shadow-[#ED500A]/20 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Crear Solicitud</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
