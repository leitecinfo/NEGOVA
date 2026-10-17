"use client";

import { createClient } from "@/lib/supabase/client";

import React, { useState, useTransition, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  Headphones,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
  Search,
  Building2,
  User,
  Phone,
  Mail,
  MessageSquare,
  Sparkles,
  Link2,
  Lock,
  Send,
  Eye,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Bot,
  MessageCircle,
  UserCheck,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  SupportDashboardResult,
  SupportInteraction,
  SupportTicket,
  SupportConversation,
  SupportChatMessage,
  SupportChannel,
  SupportCategory,
  InteractionOutcome,
  TicketStatus,
  TicketPriority,
  ConversationStatus,
  ConversationMode,
} from "@/lib/support/types";
import {
  AdminKpiGrid,
  AdminKpiCard,
  AdminTableToolbar,
  AdminSelect,
  AdminBadge,
  AdminPagination,
  AdminEmptyState,
  AdminButton,
  AdminInput,
} from "@/components/admin/ui";
import { FormattedChatMessage } from "@/components/chat/chat-message-renderer";
import {
  fetchSupportDashboardDataAction,
  createSupportInteractionAction,
  createSupportTicketAction,
  escalateInteractionToTicketAction,
  updateSupportTicketAction,
  fetchConversationsListAction,
  fetchConversationMessagesAction,
  sendAgentChatMessageAction,
  convertChatToInteractionAction,
  convertChatToTicketAction,
  simulateClientMessageAction,
  startDemoChatConversationAction,
  toggleChatModeAction,
} from "./actions";
import { toast } from "sonner";

interface BusinessOption {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  email?: string | null;
  ownerName?: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  ownerId?: string | null;
}

interface SoporteClientProps {
  initialData: SupportDashboardResult;
  businesses: BusinessOption[];
}

export function SoporteClient({ initialData, businesses }: SoporteClientProps) {
  const [data, setData] = useState<SupportDashboardResult>(initialData);
  const [isPending, startTransition] = useTransition();

  // Pestaña activa: 'interactions' (Atenciones), 'tickets' (Tickets) o 'chat' (Chat en Vivo)
  const [activeTab, setActiveTab] = useState<"interactions" | "tickets" | "chat">("interactions");

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedOutcome, setSelectedOutcome] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");

  // Estado del Chat en Vivo
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<SupportConversation | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportChatMessage[]>([]);
  const [agentMessageInput, setAgentMessageInput] = useState("");
  const [clientSimulateInput, setClientSimulateInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isSimulatingChat, setIsSimulatingChat] = useState(false);
  const [convertChatModal, setConvertChatModal] = useState<{ open: boolean; type: "atn" | "tck" }>({
    open: false,
    type: "atn",
  });
  const [convertChatForm, setConvertChatForm] = useState({
    category: "usage_inquiry" as SupportCategory,
    subject: "",
    summaryOrDesc: "",
    outcome: "resolved_immediately" as InteractionOutcome,
    priority: "medium" as TicketPriority,
    internalNotes: "",
  });

  // Modales
  const [isNewInteractionModalOpen, setIsNewInteractionModalOpen] = useState(false);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [selectedInteraction, setSelectedInteraction] = useState<SupportInteraction | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  // Formulario de Atención Rápida (Optimizado para ~15 segundos)
  const [interactionForm, setInteractionForm] = useState({
    businessId: businesses[0]?.id || "",
    channel: "whatsapp" as SupportChannel,
    contactName: businesses[0]?.ownerName || "Propietario",
    contactPhone: businesses[0]?.ownerPhone || businesses[0]?.phone || "",
    category: "usage_inquiry" as SupportCategory,
    subject: "",
    summary: "",
    outcome: "resolved_immediately" as InteractionOutcome,
    createLinkedTicket: false,
    ticketPriority: "medium" as TicketPriority,
  });

  // Formulario de Ticket Directo
  const [ticketForm, setTicketForm] = useState({
    businessId: businesses[0]?.id || "",
    contactName: businesses[0]?.ownerName || "Propietario",
    contactEmail: businesses[0]?.ownerEmail || businesses[0]?.email || "",
    contactPhone: businesses[0]?.ownerPhone || businesses[0]?.phone || "",
    originChannel: "whatsapp" as SupportChannel,
    category: "technical" as SupportCategory,
    priority: "medium" as TicketPriority,
    subject: "",
    description: "",
    internalNotes: "",
  });

  // Estado del modal de gestión de ticket
  const [ticketEditState, setTicketEditState] = useState({
    internalNotes: "",
    clientResolution: "",
    status: "open" as TicketStatus,
    priority: "medium" as TicketPriority,
  });

  // Actualiza contacto al cambiar de negocio en los formularios
  const handleBusinessChangeForInteraction = (bizId: string) => {
    const biz = businesses.find((b) => b.id === bizId);
    setInteractionForm((prev) => ({
      ...prev,
      businessId: bizId,
      contactName: biz?.ownerName || "Propietario",
      contactPhone: biz?.ownerPhone || biz?.phone || "",
    }));
  };

  const handleBusinessChangeForTicket = (bizId: string) => {
    const biz = businesses.find((b) => b.id === bizId);
    setTicketForm((prev) => ({
      ...prev,
      businessId: bizId,
      contactName: biz?.ownerName || "Propietario",
      contactEmail: biz?.ownerEmail || biz?.email || "",
      contactPhone: biz?.ownerPhone || biz?.phone || "",
    }));
  };

  const fetchDashboard = (
    page = data.page,
    tab = activeTab,
    q = searchQuery,
    channel = selectedChannel,
    category = selectedCategory,
    outcome = selectedOutcome,
    status = selectedStatus,
    priority = selectedPriority
  ) => {
    startTransition(async () => {
      const res = await fetchSupportDashboardDataAction({
        tab,
        page,
        pageSize: data.pageSize,
        search: q,
        channel,
        category,
        outcome,
        status,
        priority,
      });

      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error("No fue posible actualizar los datos de soporte.");
      }
    });
  };

  // Carga de conversaciones de Chat en Vivo
  const loadConversations = async () => {
    setIsChatLoading(true);
    const res = await fetchConversationsListAction({ search: searchQuery });
    if (res.success && res.data) {
      setConversations(res.data);
      if (res.data.length > 0 && !selectedConversation) {
        selectConversation(res.data[0]);
      }
    }
    setIsChatLoading(false);
  };

  const selectConversation = async (conv: SupportConversation) => {
    setSelectedConversation(conv);
    setIsChatLoading(true);
    const res = await fetchConversationMessagesAction(conv.id);
    if (res.success && res.data) {
      setChatMessages(res.data);
    }
    setIsChatLoading(false);
  };

  useEffect(() => {
    if (activeTab === "chat") {
      loadConversations();

      const supabase = createClient();
      const channel = supabase
        .channel("support_realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "support_chat_messages" },
          (payload: any) => {
            const newMsg: SupportChatMessage = {
              id: payload.new.id,
              conversationId: payload.new.conversation_id,
              senderRole: payload.new.sender_role,
              senderId: payload.new.sender_id,
              senderName: payload.new.sender_name,
              content: payload.new.content,
              suggestedActions: payload.new.suggested_actions,
              readByAdmin: payload.new.read_by_admin,
              readByClient: payload.new.read_by_client,
              isInternalNote: payload.new.is_internal_note,
              metadata: payload.new.metadata,
              createdAt: payload.new.created_at,
            };

            setChatMessages((prev) => {
              // Solo añadir si es de la conversación que estamos viendo
              // Usamos el callback prev para obtener los mensajes actuales. Si el último msj
              // o algún msj tiene este conversationId, es probable que estemos en ella.
              // Pero la forma más segura es re-evaluar contra el estado `selectedConversation`
              // que pasaremos en dependencias (y usaremos una referencia o simplemente el estado closure actual).
              if (!prev.find((m) => m.id === newMsg.id)) {
                // Si la vista actual es de esta conversación, lo añadimos
                if (prev.length === 0 || prev[0].conversationId === newMsg.conversationId) {
                  return [...prev, newMsg];
                }
              }
              return prev;
            });
            
            // Siempre recargar la lista de conversaciones para actualizar previsualizaciones y unread
            loadConversations();
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "support_conversations" },
          (payload: any) => {
            loadConversations();
            setSelectedConversation((prev) => {
              if (prev && prev.id === payload.new.id) {
                return {
                  ...prev,
                  status: payload.new.status,
                  mode: payload.new.mode,
                  assignedAgentId: payload.new.assigned_agent_id,
                  assignedAgentName: payload.new.assigned_agent_name,
                  lastMessagePreview: payload.new.last_message_preview,
                  unreadCountAdmin: payload.new.unread_count_admin,
                  unreadCountClient: payload.new.unread_count_client,
                };
              }
              return prev;
            });
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("Suscrito a Realtime de Soporte");
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeTab]);

  const [isTogglingMode, setIsTogglingMode] = useState(false);

  const handleToggleMode = async (newMode: "ai" | "human") => {
    if (!selectedConversation) return;
    try {
      setIsTogglingMode(true);
      const res = await toggleChatModeAction(selectedConversation.id, newMode);
      if (res.success && res.conversation) {
        setSelectedConversation(res.conversation);
        const msgs = await fetchConversationMessagesAction(selectedConversation.id);
        if (msgs.success && msgs.data) {
          setChatMessages(msgs.data);
        }
        loadConversations();
        if (newMode === "human") {
          toast.success("👨‍💼 Modo Humano activado. Ya puedes responder directamente al cliente.");
        } else {
          toast.success("🤖 Modo IA reactivado. La IA responderá de forma automática.");
        }
      } else {
        toast.error(res.error || "Error al cambiar el modo.");
      }
    } catch {
      toast.error("Error de comunicación al cambiar modo.");
    } finally {
      setIsTogglingMode(false);
    }
  };

  const handleSendAgentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !agentMessageInput.trim()) return;

    try {
      setIsSendingChat(true);
      const res = await sendAgentChatMessageAction(selectedConversation.id, agentMessageInput.trim());
      if (res.success && res.agentMessage) {
        setChatMessages((prev) => [...prev, res.agentMessage!]);
        setAgentMessageInput("");
        // Actualizar modo a humano si no lo estaba
        setSelectedConversation((prev) => prev ? { ...prev, mode: "human", status: "with_agent" } : null);
        loadConversations();
        toast.success("Mensaje enviado al cliente.");
      } else {
        toast.error(res.error || "No se pudo enviar el mensaje.");
      }
    } catch {
      toast.error("Error al enviar mensaje.");
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleSimulateClientMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !clientSimulateInput.trim()) return;

    try {
      setIsSimulatingChat(true);
      toast.info("Enviando mensaje simulado a la IA de Soporte...");
      const res = await simulateClientMessageAction(selectedConversation.id, clientSimulateInput.trim());
      if (res.success) {
        const msgs = await fetchConversationMessagesAction(selectedConversation.id);
        if (msgs.success && msgs.data) {
          setChatMessages(msgs.data);
        }
        setClientSimulateInput("");
        loadConversations();
        if (res.escalatedToHuman) {
          toast.warning("⚠️ La IA transfirió automáticamente la conversación a un Agente Humano.");
        } else {
          toast.success("Mensaje procesado por la IA de Soporte.");
        }
      } else {
        toast.error(res.error || "Error al simular mensaje.");
      }
    } catch {
      toast.error("Error de comunicación.");
    } finally {
      setIsSimulatingChat(false);
    }
  };

  const handleConvertChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation) return;

    try {
      if (convertChatModal.type === "atn") {
        const res = await convertChatToInteractionAction(selectedConversation.id, {
          category: convertChatForm.category,
          subject: convertChatForm.subject.trim() || selectedConversation.subject || "Atención desde Chat",
          summary: convertChatForm.summaryOrDesc.trim() || selectedConversation.lastMessagePreview,
          outcome: convertChatForm.outcome,
        });

        if (res.success) {
          toast.success(`Conversación formalizada en Atención ${res.interactionNumber}.`);
          setConvertChatModal({ open: false, type: "atn" });
          selectConversation(selectedConversation);
          loadConversations();
          fetchDashboard(1);
        } else {
          toast.error(res.error || "Error al formalizar atención.");
        }
      } else {
        const res = await convertChatToTicketAction(selectedConversation.id, {
          category: convertChatForm.category,
          priority: convertChatForm.priority,
          subject: convertChatForm.subject.trim() || selectedConversation.subject || "Ticket desde Chat",
          description: convertChatForm.summaryOrDesc.trim() || selectedConversation.lastMessagePreview,
          internalNotes: convertChatForm.internalNotes.trim() || undefined,
        });

        if (res.success) {
          toast.success(`Conversación escalada a Ticket ${res.ticketNumber}.`);
          setConvertChatModal({ open: false, type: "tck" });
          selectConversation(selectedConversation);
          loadConversations();
          fetchDashboard(1);
        } else {
          toast.error(res.error || "Error al escalar a ticket.");
        }
      }
    } catch {
      toast.error("Error al procesar la solicitud.");
    }
  };

  const handleStartDemoChat = async (bizId: string) => {
    const biz = businesses.find((b) => b.id === bizId);
    if (!biz) return;
    try {
      toast.info(`Iniciando chat para ${biz.name}...`);
      const res = await startDemoChatConversationAction(biz.id, biz.ownerName || "Propietario", biz.name);
      if (res.success && res.conversation) {
        toast.success(`Chat ${res.conversation.conversationNumber} iniciado.`);
        await loadConversations();
        selectConversation(res.conversation);
      }
    } catch {
      toast.error("Error al iniciar chat.");
    }
  };


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDashboard(1);
  };

  // Guardar Atención Rápida
  const handleCreateInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!interactionForm.subject.trim() || !interactionForm.summary.trim()) {
      toast.error("Por favor completa el motivo y el resumen de la atención.");
      return;
    }

    const biz = businesses.find((b) => b.id === interactionForm.businessId);
    if (!biz) {
      toast.error("Selecciona un negocio válido.");
      return;
    }

    startTransition(async () => {
      const res = await createSupportInteractionAction({
        businessId: biz.id,
        businessName: biz.name,
        businessSlug: biz.slug,
        contactName: interactionForm.contactName.trim() || "Contacto",
        contactPhone: interactionForm.contactPhone.trim() || null,
        channel: interactionForm.channel,
        category: interactionForm.category,
        subject: interactionForm.subject.trim(),
        summary: interactionForm.summary.trim(),
        outcome: interactionForm.outcome,
        createLinkedTicket: interactionForm.createLinkedTicket || interactionForm.outcome === "escalated_to_ticket",
        ticketPriority: interactionForm.ticketPriority,
      });

      if (res.success && res.interaction) {
        toast.success(
          res.ticket
            ? `Atención ${res.interaction.interactionNumber} registrada y Ticket ${res.ticket.ticketNumber} generado.`
            : `Atención ${res.interaction.interactionNumber} registrada exitosamente.`
        );
        setIsNewInteractionModalOpen(false);
        setInteractionForm({
          businessId: businesses[0]?.id || "",
          channel: "whatsapp",
          contactName: businesses[0]?.ownerName || "Propietario",
          contactPhone: businesses[0]?.ownerPhone || businesses[0]?.phone || "",
          category: "usage_inquiry",
          subject: "",
          summary: "",
          outcome: "resolved_immediately",
          createLinkedTicket: false,
          ticketPriority: "medium",
        });
        fetchDashboard(1);
      } else {
        toast.error(res.error || "No fue posible registrar la atención.");
      }
    });
  };

  // Guardar Ticket Directo
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      toast.error("Por favor completa el asunto y la descripción detallada.");
      return;
    }

    const biz = businesses.find((b) => b.id === ticketForm.businessId);
    if (!biz) {
      toast.error("Selecciona un negocio válido.");
      return;
    }

    startTransition(async () => {
      const res = await createSupportTicketAction({
        businessId: biz.id,
        businessName: biz.name,
        businessSlug: biz.slug,
        contactName: ticketForm.contactName.trim() || "Contacto",
        contactEmail: ticketForm.contactEmail.trim() || null,
        contactPhone: ticketForm.contactPhone.trim() || null,
        originChannel: ticketForm.originChannel,
        category: ticketForm.category,
        priority: ticketForm.priority,
        subject: ticketForm.subject.trim(),
        description: ticketForm.description.trim(),
        internalNotes: ticketForm.internalNotes.trim() || null,
      });

      if (res.success && res.ticket) {
        toast.success(`Ticket de soporte ${res.ticket.ticketNumber} creado exitosamente.`);
        setIsNewTicketModalOpen(false);
        setTicketForm({
          businessId: businesses[0]?.id || "",
          contactName: businesses[0]?.ownerName || "Propietario",
          contactEmail: businesses[0]?.ownerEmail || businesses[0]?.email || "",
          contactPhone: businesses[0]?.ownerPhone || businesses[0]?.phone || "",
          originChannel: "whatsapp",
          category: "technical",
          priority: "medium",
          subject: "",
          description: "",
          internalNotes: "",
        });
        fetchDashboard(1);
      } else {
        toast.error(res.error || "No fue posible crear el ticket.");
      }
    });
  };

  // Escalar atención existente a ticket
  const handleEscalateAttention = (interaction: SupportInteraction) => {
    startTransition(async () => {
      const res = await escalateInteractionToTicketAction(interaction.id, {
        priority: "medium",
        description: interaction.summary,
      });

      if (res.success && res.ticket) {
        toast.success(`Atención ${interaction.interactionNumber} promovida a Ticket ${res.ticket.ticketNumber}.`);
        if (selectedInteraction && selectedInteraction.id === interaction.id) {
          setSelectedInteraction(res.interaction || null);
        }
        fetchDashboard();
      } else {
        toast.error(res.error || "No fue posible escalar la atención.");
      }
    });
  };

  // Guardar cambios en la gestión de ticket
  const handleSaveTicketChanges = (newStatus?: TicketStatus) => {
    if (!selectedTicket) return;

    startTransition(async () => {
      const res = await updateSupportTicketAction(selectedTicket.id, {
        status: newStatus || ticketEditState.status,
        priority: ticketEditState.priority,
        internalNotes: ticketEditState.internalNotes,
        clientResolution: ticketEditState.clientResolution,
      });

      if (res.success && res.ticket) {
        toast.success(`Ticket ${res.ticket.ticketNumber} actualizado correctamente.`);
        setSelectedTicket(res.ticket);
        setTicketEditState({
          internalNotes: res.ticket.internalNotes || "",
          clientResolution: res.ticket.clientResolution || "",
          status: res.ticket.status,
          priority: res.ticket.priority,
        });
        fetchDashboard();
      } else {
        toast.error(res.error || "No fue posible actualizar el ticket.");
      }
    });
  };

  // Abrir modal de ticket
  const handleOpenTicketModal = (tck: SupportTicket) => {
    setSelectedTicket(tck);
    setTicketEditState({
      internalNotes: tck.internalNotes || "",
      clientResolution: tck.clientResolution || "",
      status: tck.status,
      priority: tck.priority,
    });
  };

  // Badges y etiquetas visuales
  const getChannelBadge = (ch: SupportChannel) => {
    switch (ch) {
      case "whatsapp":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            WhatsApp
          </span>
        );
      case "phone":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Phone className="w-3 h-3" />
            Llamada
          </span>
        );
      case "email":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Mail className="w-3 h-3" />
            Correo
          </span>
        );
      case "in_app_chat":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-orange-500/10 text-[#ED500A] border border-orange-500/20">
            <MessageSquare className="w-3 h-3" />
            Chat NEGOVA
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            Otro
          </span>
        );
    }
  };

  const getCategoryLabel = (c: SupportCategory) => {
    switch (c) {
      case "technical":
        return "Técnico / Fallas";
      case "usage_inquiry":
        return "Dudas de Uso";
      case "billing":
        return "Facturación y Pagos";
      case "account":
        return "Cuenta y Claves";
      default:
        return "Consulta General";
    }
  };

  const getOutcomeBadge = (outcome: InteractionOutcome, ticketNumber?: string | null) => {
    switch (outcome) {
      case "resolved_immediately":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Resuelto de inmediato
          </span>
        );
      case "escalated_to_ticket":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Link2 className="w-3 h-3" />
            Escalado {ticketNumber ? `(${ticketNumber})` : "a Ticket"}
          </span>
        );
      case "information_provided":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Info Suministrada
          </span>
        );
      case "pending_customer":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <Clock className="w-3 h-3" />
            Esperando Cliente
          </span>
        );
    }
  };

  const getPriorityBadge = (p: TicketPriority) => {
    switch (p) {
      case "urgent":
        return <AdminBadge variant="red" size="sm">Urgente</AdminBadge>;
      case "high":
        return <AdminBadge variant="orange" size="sm">Alta</AdminBadge>;
      case "medium":
        return <AdminBadge variant="amber" size="sm">Media</AdminBadge>;
      default:
        return <AdminBadge variant="default" size="sm">Baja</AdminBadge>;
    }
  };

  const getStatusBadge = (s: TicketStatus) => {
    switch (s) {
      case "open":
        return <AdminBadge variant="red" size="sm">Abierto</AdminBadge>;
      case "in_progress":
        return <AdminBadge variant="amber" size="sm">En Progreso</AdminBadge>;
      case "resolved":
        return <AdminBadge variant="emerald" size="sm">Resuelto</AdminBadge>;
      case "closed":
        return <AdminBadge variant="slate" size="sm">Cerrado</AdminBadge>;
    }
  };

  return (
    <div className="space-y-6 font-body">
      {/* 1. KPIS GLOBALES DE SOPORTE */}
      <AdminKpiGrid cols={4}>
        <AdminKpiCard
          title="Atenciones Totales"
          value={data.stats.totalInteractions}
          subtext="Contactos registrados"
          icon={<Headphones className="w-4 h-4 text-[#ED500A]" />}
          variant="default"
        />
        <AdminKpiCard
          title="Atenciones Hoy"
          value={data.stats.todayInteractions}
          subtext={`${data.stats.resolvedImmediatelyCount} resueltas en el acto`}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          variant="emerald"
        />
        <AdminKpiCard
          title="Tickets Abiertos"
          value={data.stats.openTickets}
          subtext="Casos que requieren atención"
          icon={<AlertCircle className="w-4 h-4 text-red-500" />}
          variant="red"
        />
        <AdminKpiCard
          title="Tickets en Progreso"
          value={data.stats.inProgressTickets + data.stats.urgentTickets}
          subtext={`${data.stats.urgentTickets} caso(s) urgente(s)`}
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          variant="amber"
        />
      </AdminKpiGrid>

      {/* 2. BARRA DE ACCIÓN PRINCIPAL (BOTÓN REGISTRAR ATENCIÓN & CREAR TICKET) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
        <div>
          <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white flex items-center gap-2">
            <Headphones className="w-4 h-4 text-[#ED500A]" />
            Mesa de Ayuda & Bitácora de Atención al Cliente
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Registra contactos cotidianos por WhatsApp/teléfono o abre tickets de seguimiento técnico.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <AdminButton
            variant="primary"
            size="md"
            onClick={() => setIsNewInteractionModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Registrar Atención
          </AdminButton>

          <AdminButton
            variant="secondary"
            size="md"
            onClick={() => setIsNewTicketModalOpen(true)}
            leftIcon={<ShieldAlert className="w-4 h-4 text-amber-500" />}
          >
            Crear Ticket
          </AdminButton>
        </div>
      </div>

      {/* 3. SELECTOR DE PESTAÑAS (ATENCIONES VS TICKETS) */}
      <div className="flex border-b border-slate-200 dark:border-white/10 gap-6 text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            setActiveTab("interactions");
            fetchDashboard(1, "interactions");
          }}
          className={`pb-3 px-1 relative transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "interactions"
              ? "text-[#ED500A] font-bold"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Atenciones Directas (Bitácora)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            {data.interactionsTotalCount}
          </span>
          {activeTab === "interactions" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ED500A] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("tickets");
            fetchDashboard(1, "tickets");
          }}
          className={`pb-3 px-1 relative transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "tickets"
              ? "text-[#ED500A] font-bold"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>Tickets de Soporte (Seguimiento)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            {data.ticketsTotalCount}
          </span>
          {activeTab === "tickets" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ED500A] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("chat");
            loadConversations();
          }}
          className={`pb-3 px-1 relative transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "chat"
              ? "text-[#ED500A] font-bold"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Bot className="w-4 h-4 text-purple-500" />
          <span>Chat en Vivo & IA</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            {conversations.filter((c) => ["active", "waiting_agent", "with_agent"].includes(c.status)).length} activos
          </span>
          {activeTab === "chat" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ED500A] rounded-full" />
          )}
        </button>
      </div>

      {/* 4. BARRA DE HERRAMIENTAS Y FILTROS DINÁMICOS */}
      <AdminTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder={
          activeTab === "interactions"
            ? "Buscar en atenciones por motivo, comercio, contacto..."
            : "Buscar en tickets por número, asunto o comercio..."
        }
        onRefresh={() => fetchDashboard()}
        isPending={isPending}
        filters={
          <>
            {/* Canal */}
            <AdminSelect
              value={selectedChannel}
              onChange={(val) => {
                setSelectedChannel(val);
                fetchDashboard(1, activeTab, searchQuery, val);
              }}
              options={[
                { value: "all", label: "Todos los canales" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "phone", label: "Llamada Telefónica" },
                { value: "email", label: "Correo Electrónico" },
                { value: "in_app_chat", label: "Chat NEGOVA" },
                { value: "other", label: "Otro Canal" },
              ]}
            />

            {/* Categoría */}
            <AdminSelect
              value={selectedCategory}
              onChange={(val) => {
                setSelectedCategory(val);
                fetchDashboard(1, activeTab, searchQuery, selectedChannel, val);
              }}
              options={[
                { value: "all", label: "Todas las categorías" },
                { value: "usage_inquiry", label: "Dudas de Uso" },
                { value: "technical", label: "Técnico / Fallas" },
                { value: "billing", label: "Facturación" },
                { value: "account", label: "Cuenta / Claves" },
                { value: "general", label: "General" },
              ]}
            />

            {/* Filtros específicos según pestaña */}
            {activeTab === "interactions" ? (
              <AdminSelect
                value={selectedOutcome}
                onChange={(val) => {
                  setSelectedOutcome(val);
                  fetchDashboard(1, activeTab, searchQuery, selectedChannel, selectedCategory, val);
                }}
                options={[
                  { value: "all", label: "Todos los resultados" },
                  { value: "resolved_immediately", label: "Resuelto de inmediato" },
                  { value: "escalated_to_ticket", label: "Escalado a ticket" },
                  { value: "information_provided", label: "Info suministrada" },
                  { value: "pending_customer", label: "Esperando cliente" },
                ]}
              />
            ) : (
              <>
                <AdminSelect
                  value={selectedStatus}
                  onChange={(val) => {
                    setSelectedStatus(val);
                    fetchDashboard(1, activeTab, searchQuery, selectedChannel, selectedCategory, selectedOutcome, val);
                  }}
                  options={[
                    { value: "all", label: "Todos los estados" },
                    { value: "open", label: "Abiertos" },
                    { value: "in_progress", label: "En Progreso" },
                    { value: "resolved", label: "Resueltos" },
                    { value: "closed", label: "Cerrados" },
                  ]}
                />
                <AdminSelect
                  value={selectedPriority}
                  onChange={(val) => {
                    setSelectedPriority(val);
                    fetchDashboard(1, activeTab, searchQuery, selectedChannel, selectedCategory, selectedOutcome, selectedStatus, val);
                  }}
                  options={[
                    { value: "all", label: "Todas las prioridades" },
                    { value: "urgent", label: "Urgente" },
                    { value: "high", label: "Alta" },
                    { value: "medium", label: "Media" },
                    { value: "low", label: "Baja" },
                  ]}
                />
              </>
            )}
          </>
        }
      />

      {/* 5. TABLA: PESTAÑA 1 - ATENCIONES (BITÁCORA DE CONTACTO) */}
      {activeTab === "interactions" && (
        <div className="space-y-4">
          {data.interactions.length === 0 ? (
            <AdminEmptyState
              icon={MessageSquare}
              title="No hay atenciones registradas"
              description="No se encontraron registros de contacto con los filtros actuales."
              onReset={() => {
                setSearchQuery("");
                setSelectedChannel("all");
                setSelectedCategory("all");
                setSelectedOutcome("all");
                fetchDashboard(1, "interactions", "", "all", "all", "all");
              }}
              resetLabel="Limpiar Filtros"
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3.5 px-4">Atención / Motivo</th>
                      <th className="py-3.5 px-4">Comercio / Contacto</th>
                      <th className="py-3.5 px-4">Canal</th>
                      <th className="py-3.5 px-4">Categoría</th>
                      <th className="py-3.5 px-4">Resultado</th>
                      <th className="py-3.5 px-4">Agente</th>
                      <th className="py-3.5 px-4">Fecha</th>
                      <th className="py-3.5 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {data.interactions.map((atn) => (
                      <tr
                        key={atn.id}
                        onClick={() => setSelectedInteraction(atn)}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      >
                        {/* ID y Motivo */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5 max-w-[240px]">
                            <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">
                              {atn.interactionNumber}
                            </span>
                            <p className="font-bold text-slate-900 dark:text-white truncate mt-1">
                              {atn.subject}
                            </p>
                          </div>
                        </td>

                        {/* Comercio */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {atn.businessName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                              <span>{atn.contactName}</span>
                              {atn.contactPhone && (
                                <span className="text-[10px] font-mono text-slate-400">({atn.contactPhone})</span>
                              )}
                            </p>
                          </div>
                        </td>

                        {/* Canal */}
                        <td className="py-3.5 px-4">
                          {getChannelBadge(atn.channel)}
                        </td>

                        {/* Categoría */}
                        <td className="py-3.5 px-4">
                          <span className="text-slate-700 dark:text-slate-300">
                            {getCategoryLabel(atn.category)}
                          </span>
                        </td>

                        {/* Resultado */}
                        <td className="py-3.5 px-4">
                          {getOutcomeBadge(atn.outcome, atn.ticketNumber)}
                        </td>

                        {/* Agente */}
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                          {atn.agentName}
                        </td>

                        {/* Fecha */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(atn.createdAt).toLocaleDateString("es-CO", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>

                        {/* Acción */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-[11px] font-semibold text-[#ED500A] group-hover:underline">
                            Ver Detalle →
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <AdminPagination
            currentPage={data.page}
            totalPages={data.interactionsTotalPages}
            pageSize={data.pageSize}
            totalItems={data.interactionsTotalCount}
            currentCount={data.interactions.length}
            onPageChange={(p) => fetchDashboard(p)}
          />
        </div>
      )}

      {/* 6. TABLA: PESTAÑA 2 - TICKETS DE SOPORTE (SEGUIMIENTO) */}
      {activeTab === "tickets" && (
        <div className="space-y-4">
          {data.tickets.length === 0 ? (
            <AdminEmptyState
              icon={Headphones}
              title="No hay tickets de soporte"
              description="No se encontraron tickets con los filtros actuales."
              onReset={() => {
                setSearchQuery("");
                setSelectedChannel("all");
                setSelectedCategory("all");
                setSelectedStatus("all");
                setSelectedPriority("all");
                fetchDashboard(1, "tickets", "", "all", "all", "all", "all", "all");
              }}
              resetLabel="Limpiar Filtros"
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3.5 px-4">Ticket / Asunto</th>
                      <th className="py-3.5 px-4">Comercio / Solicitante</th>
                      <th className="py-3.5 px-4">Canal Origen</th>
                      <th className="py-3.5 px-4">Categoría</th>
                      <th className="py-3.5 px-4">Prioridad</th>
                      <th className="py-3.5 px-4">Estado</th>
                      <th className="py-3.5 px-4">Agente Asignado</th>
                      <th className="py-3.5 px-4">Fecha</th>
                      <th className="py-3.5 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {data.tickets.map((tck) => (
                      <tr
                        key={tck.id}
                        onClick={() => handleOpenTicketModal(tck)}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      >
                        {/* Ticket y Asunto */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5 max-w-[240px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-bold text-[#ED500A] bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-200/60 dark:border-orange-500/20">
                                {tck.ticketNumber}
                              </span>
                              {tck.interactionNumber && (
                                <span className="font-mono text-[9px] text-slate-400 bg-slate-100 dark:bg-white/5 px-1 py-0.5 rounded">
                                  {tck.interactionNumber}
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-slate-900 dark:text-white truncate mt-1">
                              {tck.subject}
                            </p>
                          </div>
                        </td>

                        {/* Negocio */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {tck.businessName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {tck.contactName}
                            </p>
                          </div>
                        </td>

                        {/* Canal Origen */}
                        <td className="py-3.5 px-4">
                          {getChannelBadge(tck.originChannel)}
                        </td>

                        {/* Categoría */}
                        <td className="py-3.5 px-4">
                          <span className="text-slate-700 dark:text-slate-300">
                            {getCategoryLabel(tck.category)}
                          </span>
                        </td>

                        {/* Prioridad */}
                        <td className="py-3.5 px-4">
                          {getPriorityBadge(tck.priority)}
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-4">
                          {getStatusBadge(tck.status)}
                        </td>

                        {/* Agente */}
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                          {tck.assignedAgentName || "Sin asignar"}
                        </td>

                        {/* Fecha */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(tck.createdAt).toLocaleDateString("es-CO")}
                        </td>

                        {/* Acción */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-[11px] font-semibold text-[#ED500A] group-hover:underline">
                            Gestionar →
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <AdminPagination
            currentPage={data.page}
            totalPages={data.ticketsTotalPages}
            pageSize={data.pageSize}
            totalItems={data.ticketsTotalCount}
            currentCount={data.tickets.length}
            onPageChange={(p) => fetchDashboard(p)}
          />
        </div>
      )}

      {/* 6.5. PESTAÑA 3: CONSOLA DE CHAT EN VIVO & IA DE SOPORTE NEGOVA */}
      {activeTab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMNA IZQUIERDA: LISTADO DE CONVERSACIONES (4 COLS) */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs overflow-hidden flex flex-col h-[680px]">
            {/* Cabecera del listado */}
            <div className="p-3.5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-white font-title">
                  Conversaciones ({conversations.length})
                </span>
              </div>
              <button
                type="button"
                onClick={loadConversations}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                title="Refrescar chats"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChatLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Selector para iniciar chat demo con un negocio */}
            <div className="p-3 border-b border-slate-100 dark:border-white/[0.06] bg-purple-50/30 dark:bg-purple-500/[0.03]">
              <label className="block text-[10px] font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider mb-1">
                Iniciar Chat con Negocio:
              </label>
              <div className="flex gap-1.5">
                <select
                  id="demo-chat-select"
                  className="w-full text-xs p-1.5 rounded-lg border border-purple-200 dark:border-purple-500/20 bg-white dark:bg-[#12141A] text-slate-900 dark:text-white"
                  defaultValue={businesses[0]?.id}
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.ownerName || "Propietario"})
                    </option>
                  ))}
                </select>
                <AdminButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const sel = document.getElementById("demo-chat-select") as HTMLSelectElement;
                    if (sel && sel.value) handleStartDemoChat(sel.value);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </AdminButton>
              </div>
            </div>

            {/* Lista de hilos */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.04]">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2 text-xs">
                  <Bot className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>No hay conversaciones activas.</p>
                  <p className="text-[11px]">Inicia un chat con uno de tus comercios para probar.</p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSelected = selectedConversation?.id === conv.id;
                  let statusBadge = (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      IA Activa
                    </span>
                  );
                  if (conv.status === "waiting_agent") {
                    statusBadge = (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                        Esperando Asesor
                      </span>
                    );
                  } else if (conv.status === "with_agent") {
                    statusBadge = (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Con Asesor
                      </span>
                    );
                  } else if (conv.status === "resolved") {
                    statusBadge = (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400">
                        Resuelto
                      </span>
                    );
                  }

                  return (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      className={`p-3 cursor-pointer transition-colors space-y-1.5 ${
                        isSelected
                          ? "bg-orange-500/10 border-l-3 border-[#ED500A]"
                          : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-[#ED500A]">
                          {conv.conversationNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(conv.lastMessageAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[140px]">
                          {conv.businessName}
                        </span>
                        {statusBadge}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {conv.lastMessagePreview}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: FLUJO EN TIEMPO REAL Y ACCIONES (8 COLS) */}
          <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs flex flex-col h-[680px] overflow-hidden">
            {selectedConversation ? (
              <>
                {/* Header de conversación activa */}
                <div className="p-3.5 px-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#ED500A] bg-orange-500/10 px-1.5 py-0.5 rounded">
                        {selectedConversation.conversationNumber}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white font-title">
                        {selectedConversation.businessName}
                      </h4>
                      <span className="text-xs text-slate-500">
                        • {selectedConversation.userName}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>Modo:</span>
                      {selectedConversation.mode === "ai" ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                          <Bot className="w-3 h-3" /> IA de Soporte Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#ED500A] bg-orange-500/10 px-2 py-0.5 rounded-md">
                          <UserCheck className="w-3 h-3" /> Atención Humana Activa
                        </span>
                      )}

                      {selectedConversation.status === "waiting_agent" && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-bold animate-pulse flex items-center gap-1 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" /> Requiere Asesor Humano
                        </span>
                      )}

                      {selectedConversation.interactionId && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[10px] font-mono font-bold">
                          📋 Atención Vinculada
                        </span>
                      )}
                      {selectedConversation.ticketId && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 text-[10px] font-mono font-bold">
                          🎫 Ticket Vinculado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botones de acción rápida y Control de Modo */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Switch de Modo IA / Humano */}
                    {selectedConversation.mode === "ai" ? (
                      <AdminButton
                        variant="primary"
                        size="sm"
                        className="whitespace-nowrap font-medium"
                        onClick={() => handleToggleMode("human")}
                        isLoading={isTogglingMode}
                        leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                      >
                        Pasar a Modo Humano
                      </AdminButton>
                    ) : (
                      <AdminButton
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap font-medium border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                        onClick={() => handleToggleMode("ai")}
                        isLoading={isTogglingMode}
                        leftIcon={<Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                      >
                        Reactivar Modo IA
                      </AdminButton>
                    )}

                    <AdminButton
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap px-4 py-1.5 h-auto gap-2 border-slate-300 dark:border-white/20"
                      onClick={() => {
                        setConvertChatForm({
                          category: "usage_inquiry",
                          subject: `Atención: ${selectedConversation.businessName}`,
                          summaryOrDesc: selectedConversation.lastMessagePreview,
                          outcome: "resolved_immediately",
                          priority: "medium",
                          internalNotes: "",
                        });
                        setConvertChatModal({ open: true, type: "atn" });
                      }}
                      leftIcon={<MessageSquare className="w-4 h-4 text-[#ED500A]" />}
                    >
                      Formalizar ATN
                    </AdminButton>

                    <AdminButton
                      variant="secondary"
                      size="sm"
                      className="whitespace-nowrap px-4 py-1.5 h-auto gap-2"
                      onClick={() => {
                        setConvertChatForm({
                          category: "technical",
                          subject: `Ticket: ${selectedConversation.businessName}`,
                          summaryOrDesc: selectedConversation.lastMessagePreview,
                          outcome: "escalated_to_ticket",
                          priority: "medium",
                          internalNotes: "",
                        });
                        setConvertChatModal({ open: true, type: "tck" });
                      }}
                      leftIcon={<ShieldAlert className="w-4 h-4 text-amber-500" />}
                    >
                      Escalar a TCK
                    </AdminButton>
                  </div>
                </div>

                {/* Hilo de Mensajes con Scroll */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/40 dark:bg-black/20">
                  {chatMessages.map((msg) => {
                    if (msg.senderRole === "system") {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <span className="px-3.5 py-1 rounded-full bg-slate-200/90 dark:bg-white/10 text-[11px] font-medium text-slate-600 dark:text-slate-300 border border-slate-300/50 shadow-2xs text-center max-w-[90%]">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }

                    // Mensaje generado por la IA de Soporte (LADO DERECHO - Mensajes de NEGOVA)
                    if (msg.senderRole === "ai") {
                      return (
                        <div key={msg.id} className="flex gap-2.5 max-w-[78%] items-start ml-auto flex-row-reverse animate-in fade-in">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5 border border-slate-200 dark:border-white/10 shadow-2xs">
                            <Bot className="w-4 h-4" />
                          </div>
                          <div className="p-3.5 rounded-2xl rounded-tr-sm bg-slate-100 dark:bg-[#1A1D24] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-2xs space-y-1.5">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-1">
                              <span className="font-bold text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5 text-[#ED500A]" /> IA DE SOPORTE NEGOVA
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(msg.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <FormattedChatMessage content={msg.content} isCurrentUser={false} />
                          </div>
                        </div>
                      );
                    }

                    // Mensaje enviado por el AGENTE HUMANO (LADO DERECHO - Mis Mensajes)
                    if (msg.senderRole === "agent") {
                      return (
                        <div key={msg.id} className="flex gap-2.5 max-w-[78%] items-start ml-auto flex-row-reverse animate-in fade-in">
                          <div className="w-7 h-7 rounded-lg bg-orange-500/15 text-[#ED500A] flex items-center justify-center shrink-0 mt-0.5 border border-orange-500/20 shadow-2xs">
                            <UserCheck className="w-4 h-4" />
                          </div>
                          <div className="p-3.5 rounded-2xl rounded-tr-sm bg-[#ED500A] text-white space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between gap-3 border-b border-white/20 pb-1">
                              <span className="font-bold text-[10px] text-white/95">
                                {msg.senderName} (Tú / Asesor NEGOVA)
                              </span>
                              <span className="text-[10px] text-white/75 font-mono">
                                {new Date(msg.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <FormattedChatMessage content={msg.content} isCurrentUser={true} />
                          </div>
                        </div>
                      );
                    }

                    // Mensaje enviado por el CLIENTE (LADO IZQUIERDO - Mensajes Recibidos)
                    return (
                      <div key={msg.id} className="flex gap-2.5 max-w-[78%] items-start mr-auto animate-in fade-in">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/20 shadow-2xs">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="p-3.5 rounded-2xl rounded-tl-sm bg-white dark:bg-[#151822] border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-1">
                            <span className="font-bold text-[10px] text-blue-600 dark:text-blue-400">
                              {msg.senderName} (Cliente)
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(msg.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <FormattedChatMessage content={msg.content} isCurrentUser={false} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Simulador de cliente para testing de IA & Escalación */}
                <div className="p-2.5 bg-slate-100 dark:bg-white/[0.03] border-t border-slate-200/80 dark:border-white/[0.06]">
                  <form onSubmit={handleSimulateClientMessage} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                      <User className="w-3 h-3" /> Simular Cliente:
                    </span>
                    <input
                      type="text"
                      value={clientSimulateInput}
                      onChange={(e) => setClientSimulateInput(e.target.value)}
                      placeholder='Ej: "No puedo registrar una venta" o "Quiero hablar con una persona"'
                      className="flex-1 text-xs p-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-slate-900 dark:text-white"
                    />
                    <AdminButton
                      variant="outline"
                      size="sm"
                      type="submit"
                      className="whitespace-nowrap"
                      isLoading={isSimulatingChat}
                    >
                      Enviar como Cliente
                    </AdminButton>
                  </form>
                </div>

                {/* Input de respuesta como Agente con Control de Modo */}
                {selectedConversation.mode === "ai" ? (
                  <div className="p-3.5 border-t border-slate-200 dark:border-white/10 bg-purple-50/40 dark:bg-purple-950/15 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>
                        <strong className="text-purple-700 dark:text-purple-300">Modo IA Activo:</strong> La IA está respondiendo automáticamente. Para responder tú como humano, cambia a Modo Humano.
                      </span>
                    </div>
                    <AdminButton
                      variant="primary"
                      size="sm"
                      className="whitespace-nowrap shrink-0"
                      onClick={() => handleToggleMode("human")}
                      isLoading={isTogglingMode}
                      leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                    >
                      Tomar conversación (Modo Humano)
                    </AdminButton>
                  </div>
                ) : (
                  <div className="border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12]">
                    <div className="px-3.5 pt-2 pb-1 flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-100 dark:border-white/[0.04]">
                      <span className="flex items-center gap-1.5 text-[#ED500A] font-semibold">
                        <UserCheck className="w-3.5 h-3.5" /> Estás respondiendo como Asesor Humano (La IA está pausada)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleMode("ai")}
                        className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Bot className="w-3 h-3" /> Devolver a Modo IA
                      </button>
                    </div>
                    <form onSubmit={handleSendAgentMessage} className="p-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={agentMessageInput}
                        onChange={(e) => setAgentMessageInput(e.target.value)}
                        placeholder="Escribe tu respuesta como Asesor Humano de NEGOVA..."
                        className="flex-1 text-xs p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#12141A] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30"
                        autoFocus
                      />
                      <AdminButton
                        variant="primary"
                        size="md"
                        type="submit"
                        isLoading={isSendingChat}
                        leftIcon={<Send className="w-3.5 h-3.5" />}
                      >
                        Responder
                      </AdminButton>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                <Bot className="w-12 h-12 text-purple-400/60 animate-bounce" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Consola de Chat en Vivo & IA NEGOVA
                </h4>
                <p className="text-xs max-w-sm">
                  Selecciona una conversación del listado izquierdo o inicia una sesión de prueba para interactuar con la IA y gestionar transferencias a humanos.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: FORMALIZAR CHAT EN ATENCIÓN O TICKET */}
      {convertChatModal.open && selectedConversation && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                {convertChatModal.type === "atn" ? (
                  <MessageSquare className="w-5 h-5 text-[#ED500A]" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                )}
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-title">
                  {convertChatModal.type === "atn"
                    ? "Formalizar en Atención (ATN)"
                    : "Escalar a Ticket de Soporte (TCK)"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConvertChatModal({ open: false, type: "atn" })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConvertChatSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Comercio:
                </label>
                <input
                  type="text"
                  value={`${selectedConversation.businessName} (${selectedConversation.userName})`}
                  disabled
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Categoría:
                </label>
                <select
                  value={convertChatForm.category}
                  onChange={(e) => setConvertChatForm({ ...convertChatForm, category: e.target.value as SupportCategory })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-slate-900 dark:text-white"
                >
                  <option value="usage_inquiry">Dudas de Uso de la Plataforma</option>
                  <option value="technical">Problema Técnico / Falla</option>
                  <option value="billing">Facturación y Cobro de Suscripción</option>
                  <option value="account">Acceso / Claves</option>
                  <option value="general">Consulta General</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo / Asunto:
                </label>
                <input
                  type="text"
                  value={convertChatForm.subject}
                  onChange={(e) => setConvertChatForm({ ...convertChatForm, subject: e.target.value })}
                  placeholder="Ej: Orientación sobre arqueo de caja"
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {convertChatModal.type === "atn" ? "Resumen de lo orientado:" : "Descripción técnica del caso:"}
                </label>
                <textarea
                  value={convertChatForm.summaryOrDesc}
                  onChange={(e) => setConvertChatForm({ ...convertChatForm, summaryOrDesc: e.target.value })}
                  rows={3}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-slate-900 dark:text-white"
                  required
                />
              </div>

              {convertChatModal.type === "atn" ? (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Resultado:
                  </label>
                  <select
                    value={convertChatForm.outcome}
                    onChange={(e) => setConvertChatForm({ ...convertChatForm, outcome: e.target.value as InteractionOutcome })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-slate-900 dark:text-white"
                  >
                    <option value="resolved_immediately">Resuelto de inmediato</option>
                    <option value="information_provided">Información suministrada</option>
                    <option value="pending_customer">Esperando respuesta del cliente</option>
                    <option value="escalated_to_ticket">Escalado a ticket</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prioridad del Ticket:
                  </label>
                  <select
                    value={convertChatForm.priority}
                    onChange={(e) => setConvertChatForm({ ...convertChatForm, priority: e.target.value as TicketPriority })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-slate-900 dark:text-white"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                <AdminButton
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setConvertChatModal({ open: false, type: "atn" })}
                >
                  Cancelar
                </AdminButton>
                <AdminButton variant="primary" size="sm" type="submit">
                  Confirmar Registro
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* 7. MODAL: REGISTRAR ATENCIÓN RÁPIDA (~15 segundos) */}
      {isNewInteractionModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-title">
                    Registrar Atención al Cliente
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bitácora rápida para contacto cotidiano (WhatsApp, Teléfono, etc.)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewInteractionModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInteraction} className="space-y-3 text-xs">
              {/* Negocio y Canal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Comercio / Negocio:
                  </label>
                  <select
                    value={interactionForm.businessId}
                    onChange={(e) => handleBusinessChangeForInteraction(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ED500A]/30"
                  >
                    {!interactionForm.businessId && (
                      <option value="" disabled>
                        Selecciona el negocio
                      </option>
                    )}
                    {businesses.map((biz) => (
                      <option key={biz.id} value={biz.id}>
                        {biz.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Canal de Contacto:
                  </label>
                  <select
                    value={interactionForm.channel}
                    onChange={(e) => setInteractionForm({ ...interactionForm, channel: e.target.value as SupportChannel })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ED500A]/30 font-medium"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="phone">Llamada Telefónica</option>
                    <option value="email">Correo Electrónico</option>
                    <option value="in_app_chat">Chat NEGOVA</option>
                    <option value="other">Otro Canal</option>
                  </select>
                </div>
              </div>

              {/* Persona de Contacto y Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Persona que Contactó:
                  </label>
                  <input
                    type="text"
                    value={interactionForm.contactName}
                    onChange={(e) => setInteractionForm({ ...interactionForm, contactName: e.target.value })}
                    placeholder="Ej.: Juan Pérez"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ED500A]/30"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono / Celular:
                  </label>
                  <input
                    type="text"
                    value={interactionForm.contactPhone}
                    onChange={(e) => setInteractionForm({ ...interactionForm, contactPhone: e.target.value })}
                    placeholder="Ej.: 300 123 4567"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ED500A]/30 font-mono"
                  />
                </div>
              </div>

              {/* Categoría y Resultado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Categoría:
                  </label>
                  <select
                    value={interactionForm.category}
                    onChange={(e) => setInteractionForm({ ...interactionForm, category: e.target.value as SupportCategory })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ED500A]/30"
                  >
                    <option value="usage_inquiry">Dudas de Uso / Capacitación</option>
                    <option value="technical">Técnico / Fallas</option>
                    <option value="billing">Facturación y Planes</option>
                    <option value="account">Cuenta y Contraseñas</option>
                    <option value="general">Consulta General</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Resultado:
                  </label>
                  <select
                    value={interactionForm.outcome}
                    onChange={(e) => {
                      const val = e.target.value as InteractionOutcome;
                      setInteractionForm({
                        ...interactionForm,
                        outcome: val,
                        createLinkedTicket: val === "escalated_to_ticket",
                      });
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ED500A]/30 font-medium"
                  >
                    <option value="resolved_immediately">Resuelto de inmediato</option>
                    <option value="escalated_to_ticket">Escalar a Ticket de Soporte</option>
                    <option value="information_provided">Información suministrada</option>
                    <option value="pending_customer">Esperando respuesta del cliente</option>
                  </select>
                </div>
              </div>

              {/* Motivo / Asunto */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo / Asunto:
                </label>
                <input
                  type="text"
                  value={interactionForm.subject}
                  onChange={(e) => setInteractionForm({ ...interactionForm, subject: e.target.value })}
                  placeholder="Ej.: No puede registrar una venta"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ED500A]/30"
                  required
                />
              </div>

              {/* Resumen / Solución rápida con texto de ayuda */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Resumen de lo Conversado y Solución:
                </label>
                <textarea
                  value={interactionForm.summary}
                  onChange={(e) => setInteractionForm({ ...interactionForm, summary: e.target.value })}
                  placeholder="Ej.: Se explicó cómo registrar una venta y el usuario confirmó que pudo realizar el proceso correctamente."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ED500A]/30"
                  required
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Describe brevemente lo conversado, la orientación brindada o la solución aplicada.
                </p>
              </div>

              {/* Opciones si se escala a Ticket */}
              {interactionForm.createLinkedTicket && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                    <Link2 className="w-4 h-4 text-amber-600" />
                    <span>Se generará automáticamente un Ticket formal (TCK)</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-amber-900 dark:text-amber-200 mb-1">
                      Prioridad del Ticket:
                    </label>
                    <select
                      value={interactionForm.ticketPriority}
                      onChange={(e) => setInteractionForm({ ...interactionForm, ticketPriority: e.target.value as TicketPriority })}
                      className="w-full p-2 rounded-lg border border-amber-300 dark:border-amber-500/30 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white"
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <AdminButton variant="secondary" size="sm" type="button" onClick={() => setIsNewInteractionModalOpen(false)}>
                  Cancelar
                </AdminButton>
                <AdminButton variant="primary" size="sm" type="submit" isLoading={isPending}>
                  Guardar Atención
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* 8. MODAL: CREAR TICKET DIRECTO (TCK) */}
      {isNewTicketModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-title">
                    Crear Ticket de Soporte Técnico
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Caso formal que requiere investigación técnica o seguimiento.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewTicketModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Comercio Afectado:
                </label>
                <select
                  value={ticketForm.businessId}
                  onChange={(e) => handleBusinessChangeForTicket(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ED500A]/30"
                >
                  {businesses.map((biz) => (
                    <option key={biz.id} value={biz.id}>
                      {biz.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Solicitante:
                  </label>
                  <input
                    type="text"
                    value={ticketForm.contactName}
                    onChange={(e) => setTicketForm({ ...ticketForm, contactName: e.target.value })}
                    placeholder="Nombre"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Correo (Opcional):
                  </label>
                  <input
                    type="email"
                    value={ticketForm.contactEmail}
                    onChange={(e) => setTicketForm({ ...ticketForm, contactEmail: e.target.value })}
                    placeholder="contacto@negocio.com"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Canal Origen:
                  </label>
                  <select
                    value={ticketForm.originChannel}
                    onChange={(e) => setTicketForm({ ...ticketForm, originChannel: e.target.value as SupportChannel })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="phone">Llamada</option>
                    <option value="email">Correo</option>
                    <option value="in_app_chat">Chat</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Categoría:
                  </label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value as SupportCategory })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white"
                  >
                    <option value="technical">Técnico / Fallas</option>
                    <option value="usage_inquiry">Dudas de Uso</option>
                    <option value="billing">Facturación y Pagos</option>
                    <option value="account">Cuenta y Acceso</option>
                    <option value="general">Consulta General</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prioridad:
                  </label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as TicketPriority })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Asunto del Ticket:
                </label>
                <input
                  type="text"
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  placeholder="Ej: Inconsistencia en sincronización de cierre de caja"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción Detallada del Problema:
                </label>
                <textarea
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  placeholder="Pasos para reproducir, mensaje de error o detalles técnicos observados..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Notas Internas Iniciales (Privado Equipo NEGOVA):</span>
                </label>
                <textarea
                  value={ticketForm.internalNotes}
                  onChange={(e) => setTicketForm({ ...ticketForm, internalNotes: e.target.value })}
                  placeholder="Observaciones confidenciales del equipo técnico..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-amber-300/60 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-500/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <AdminButton variant="secondary" size="sm" type="button" onClick={() => setIsNewTicketModalOpen(false)}>
                  Cancelar
                </AdminButton>
                <AdminButton variant="primary" size="sm" type="submit" isLoading={isPending}>
                  Crear Ticket
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* 9. MODAL: DETALLE DE ATENCIÓN (ATN) */}
      {selectedInteraction && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">
                  {selectedInteraction.interactionNumber}
                </span>
                {getChannelBadge(selectedInteraction.channel)}
                {getOutcomeBadge(selectedInteraction.outcome, selectedInteraction.ticketNumber)}
              </div>
              <button
                type="button"
                onClick={() => setSelectedInteraction(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedInteraction.subject}
              </h3>
              <p className="text-xs text-slate-500">
                Atendido por <strong>{selectedInteraction.agentName}</strong> el{" "}
                {new Date(selectedInteraction.createdAt).toLocaleString("es-CO")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">Comercio</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{selectedInteraction.businessName}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">Contacto</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {selectedInteraction.contactName}{" "}
                  {selectedInteraction.contactPhone ? `(${selectedInteraction.contactPhone})` : ""}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Resumen de la Atención y Orientación Brindada:
              </span>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {selectedInteraction.summary}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              {!selectedInteraction.ticketId ? (
                <button
                  type="button"
                  onClick={() => handleEscalateAttention(selectedInteraction)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Promover a Ticket de Soporte</span>
                </button>
              ) : (
                <span className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#ED500A]" />
                  <span>Ticket vinculado: <strong>{selectedInteraction.ticketNumber}</strong></span>
                </span>
              )}

              <AdminButton variant="secondary" size="sm" onClick={() => setSelectedInteraction(null)}>
                Cerrar
              </AdminButton>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* 10. MODAL: GESTIÓN DE TICKET (TCK) CON NOTAS INTERNAS Y RESPUESTA AL CLIENTE */}
      {selectedTicket && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#ED500A]">
                      {selectedTicket.ticketNumber}
                    </span>
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority)}
                    {getChannelBadge(selectedTicket.originChannel)}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedTicket.subject}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metadatos del ticket */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">Comercio</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{selectedTicket.businessName}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">Solicitante</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {selectedTicket.contactName}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">Categoría</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {getCategoryLabel(selectedTicket.category)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">Fecha Reporte</span>
                <p className="font-mono text-slate-800 dark:text-slate-200">
                  {new Date(selectedTicket.createdAt).toLocaleDateString("es-CO")}
                </p>
              </div>
            </div>

            {/* Descripción del problema */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Descripción Detallada del Caso:
              </span>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {selectedTicket.description}
              </div>
            </div>

            {/* SEPARACIÓN CLARA: 1. NOTAS INTERNAS */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Notas Internas de NEGOVA (Privadas — Solo visible para el equipo interno)</span>
              </label>
              <textarea
                value={ticketEditState.internalNotes}
                onChange={(e) => setTicketEditState({ ...ticketEditState, internalNotes: e.target.value })}
                placeholder="Diagnóstico técnico, causa raíz, revisión de código o notas privadas..."
                rows={2}
                className="w-full p-2.5 rounded-lg border border-amber-300/70 dark:border-amber-500/30 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white"
              />
            </div>

            {/* SEPARACIÓN CLARA: 2. RESPUESTA AL CLIENTE */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-emerald-600" />
                <span>Respuesta Formal al Cliente (Solución comunicada / Visible para el comercio)</span>
              </label>
              <textarea
                value={ticketEditState.clientResolution}
                onChange={(e) => setTicketEditState({ ...ticketEditState, clientResolution: e.target.value })}
                placeholder="Escribe la solución explicada al cliente o el mensaje final de cierre..."
                rows={2}
                className="w-full p-2.5 rounded-lg border border-emerald-300/70 dark:border-emerald-500/30 bg-white dark:bg-[#12141A] text-xs text-slate-900 dark:text-white"
              />
            </div>

            {/* Transición de estados y acciones */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Estado:</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSaveTicketChanges("open")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    selectedTicket.status === "open"
                      ? "bg-red-500 text-white"
                      : "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-red-50 hover:text-red-600"
                  }`}
                >
                  Abierto
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSaveTicketChanges("in_progress")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    selectedTicket.status === "in_progress"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-600"
                  }`}
                >
                  En Progreso
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSaveTicketChanges("resolved")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    selectedTicket.status === "resolved"
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600"
                  }`}
                >
                  Resuelto
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSaveTicketChanges("closed")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    selectedTicket.status === "closed"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  Cerrar
                </button>
              </div>

              <div className="flex items-center gap-2">
                <AdminButton variant="secondary" size="sm" onClick={() => setSelectedTicket(null)}>
                  Cerrar Ventana
                </AdminButton>
                <AdminButton variant="primary" size="sm" onClick={() => handleSaveTicketChanges()} isLoading={isPending}>
                  Guardar Notas
                </AdminButton>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
