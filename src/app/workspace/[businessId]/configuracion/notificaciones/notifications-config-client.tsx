"use client";

import React, { useState, useTransition, useMemo, useRef } from "react";
import {
  Bell,
  MessageSquare,
  Mail,
  Smartphone,
  Save,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  QrCode,
  Bike,
  Boxes,
  Lock,
  CreditCard,
  Send,
  Loader2,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  Clock,
  User,
  Users,
  Eye,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  NotificationSettings,
  NotificationEventConfig,
  NotificationEventId,
  NotificationChannelType,
  NotificationEventCategory,
  NOTIFICATION_AVAILABLE_ROLES,
} from "@/lib/notifications/types";
import { renderTemplatePreview } from "@/lib/notifications/template-preview";
import {
  updateNotificationEventAction,
  saveAllNotificationSettingsAction,
  resetNotificationEventAction,
} from "./actions";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface NotificationsConfigClientProps {
  businessId: string;
  businessName: string;
  initialSettings: NotificationSettings;
  canManage: boolean;
}

const EVENT_ICONS: Record<NotificationEventId, React.ComponentType<{ className?: string }>> = {
  qr_order_created: QrCode,
  delivery_status_changed: Bike,
  low_stock_reached: Boxes,
  cash_shift_closed: Lock,
  account_receivable_overdue: CreditCard,
};

const CATEGORY_LABELS: Record<NotificationEventCategory, string> = {
  pedidos: "Pedidos QR",
  domicilios: "Domicilios",
  inventario: "Inventario",
  caja: "Caja y Arqueos",
  cartera: "Cartera y Créditos",
};

export function NotificationsConfigClient({
  businessId,
  businessName,
  initialSettings,
  canManage,
}: NotificationsConfigClientProps) {
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState<NotificationSettings>(initialSettings);

  // Filtro de categoría
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Evento actualmente seleccionado para edición detallada
  const [editingEventId, setEditingEventId] = useState<NotificationEventId>("qr_order_created");
  const [activeChannelTab, setActiveChannelTab] = useState<NotificationChannelType>("whatsapp");

  // Confirmación para restaurar plantilla por defecto
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Referencia al textarea para insertar tags en la posición del cursor
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentEvent = settings.events[editingEventId] || Object.values(settings.events)[0];

  // Lista filtrada de eventos
  const filteredEvents = useMemo(() => {
    const all = Object.values(settings.events);
    if (selectedCategory === "all") return all;
    return all.filter((evt) => evt.category === selectedCategory);
  }, [settings.events, selectedCategory]);

  // Manejo de activación/desactivación rápida del evento completo
  const handleToggleEventEnabled = (eventId: NotificationEventId, enabled: boolean) => {
    if (!canManage) {
      toast.error("No tienes permisos para modificar notificaciones.");
      return;
    }

    const updatedEvt = {
      ...settings.events[eventId],
      enabled,
    };

    const newSettings: NotificationSettings = {
      ...settings,
      events: {
        ...settings.events,
        [eventId]: updatedEvt,
      },
      updatedAt: new Date().toISOString(),
    };

    setSettings(newSettings);

    startTransition(async () => {
      const res = await updateNotificationEventAction(businessId, eventId, { enabled });
      if (res.success) {
        toast.success(
          enabled
            ? `Notificación "${updatedEvt.name}" activada.`
            : `Notificación "${updatedEvt.name}" desactivada.`
        );
      } else {
        toast.error(res.error || "No se pudo actualizar el estado de la notificación.");
      }
    });
  };

  // Manejo de activación de un canal específico dentro del evento
  const handleToggleChannelEnabled = (
    channel: NotificationChannelType,
    enabled: boolean
  ) => {
    if (!canManage) return;

    const updatedEvt: NotificationEventConfig = {
      ...currentEvent,
      channels: {
        ...currentEvent.channels,
        [channel]: {
          ...currentEvent.channels[channel],
          enabled,
        },
      },
    };

    updateCurrentEventState(updatedEvt);
  };

  // Actualización del texto de la plantilla
  const handleTemplateChange = (template: string) => {
    const updatedEvt: NotificationEventConfig = {
      ...currentEvent,
      channels: {
        ...currentEvent.channels,
        [activeChannelTab]: {
          ...currentEvent.channels[activeChannelTab],
          template,
        },
      },
    };
    updateCurrentEventState(updatedEvt);
  };

  // Actualización del asunto de email
  const handleEmailSubjectChange = (subject: string) => {
    const updatedEvt: NotificationEventConfig = {
      ...currentEvent,
      channels: {
        ...currentEvent.channels,
        email: {
          ...currentEvent.channels.email,
          subject,
        },
      },
    };
    updateCurrentEventState(updatedEvt);
  };

  // Toggle de roles destinatarios
  const handleToggleRole = (roleId: string) => {
    if (!canManage) return;
    const exists = currentEvent.recipientRoles.includes(roleId);
    const newRoles = exists
      ? currentEvent.recipientRoles.filter((r) => r !== roleId)
      : [...currentEvent.recipientRoles, roleId];

    const updatedEvt: NotificationEventConfig = {
      ...currentEvent,
      recipientRoles: newRoles,
    };
    updateCurrentEventState(updatedEvt);
  };

  // Toggle notificación al cliente
  const handleToggleNotifyCustomer = (notifyCustomer: boolean) => {
    if (!canManage) return;
    const updatedEvt: NotificationEventConfig = {
      ...currentEvent,
      notifyCustomer,
    };
    updateCurrentEventState(updatedEvt);
  };

  // Auxiliar para actualizar el estado del evento activo
  const updateCurrentEventState = (updatedEvt: NotificationEventConfig) => {
    setSettings((prev) => ({
      ...prev,
      events: {
        ...prev.events,
        [updatedEvt.id]: updatedEvt,
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  // Guardar cambios del evento activo en el servidor
  const handleSaveCurrentEvent = () => {
    if (!canManage) {
      toast.error("No tienes permisos de modificación.");
      return;
    }

    startTransition(async () => {
      const res = await updateNotificationEventAction(businessId, currentEvent.id, currentEvent);
      if (res.success && res.data) {
        toast.success(`Plantilla "${currentEvent.name}" guardada con éxito.`);
      } else {
        toast.error(res.error || "Error al guardar la configuración del evento.");
      }
    });
  };

  // Guardar configuración global
  const handleSaveAllSettings = () => {
    if (!canManage) {
      toast.error("No tienes permisos de modificación.");
      return;
    }

    startTransition(async () => {
      const res = await saveAllNotificationSettingsAction(businessId, settings);
      if (res.success && res.data) {
        toast.success("Toda la configuración de notificaciones ha sido guardada.");
      } else {
        toast.error(res.error || "Error al guardar la configuración.");
      }
    });
  };

  // Insertar variable en el textarea en la posición del cursor
  const handleInsertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const currentText = currentEvent.channels[activeChannelTab].template;

    const before = currentText.substring(0, startPos);
    const after = currentText.substring(endPos, currentText.length);
    const newText = before + tag + after;

    handleTemplateChange(newText);

    // Reposicionar cursor tras la variable insertada
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(startPos + tag.length, startPos + tag.length);
    }, 50);
  };

  // Restaurar evento a valores predeterminados
  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      const res = await resetNotificationEventAction(businessId, editingEventId);
      if (res.success && res.data) {
        updateCurrentEventState(res.data);
        toast.success(`Plantilla "${res.data.name}" restaurada a los valores de fábrica.`);
      } else {
        toast.error(res.error || "No se pudo restaurar la plantilla.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al restaurar.");
    } finally {
      setIsResetting(false);
      setResetModalOpen(false);
    }
  };

  // Generar datos simulados para la vista previa en vivo
  const sampleData = useMemo(() => {
    const dict: Record<string, string> = {};
    currentEvent.availableVariables.forEach((v) => {
      dict[v.tag] = v.sampleValue;
    });
    // Agregar nombre del negocio si está disponible
    dict["{negocio}"] = businessName || "Restaurante Gourmet";
    return dict;
  }, [currentEvent, businessName]);

  // Vista previa interpolada
  const activeTemplate = currentEvent.channels[activeChannelTab].template;
  const renderedPreview = useMemo(() => {
    return renderTemplatePreview(activeTemplate, sampleData);
  }, [activeTemplate, sampleData]);

  const activeEmailSubject = currentEvent.channels.email.subject || "";
  const renderedEmailSubject = useMemo(() => {
    return renderTemplatePreview(activeEmailSubject, sampleData);
  }, [activeEmailSubject, sampleData]);

  return (
    <div className="space-y-6">
      {/* 1. Barra de Control Superior y Guardado Global */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#ED500A]" />
            Notificaciones Automatizadas
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Activa eventos clave, personaliza las plantillas con variables y mantén informados a tus clientes y colaboradores.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveAllSettings}
            disabled={isPending || !canManage}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#ED500A] hover:bg-[#d64708] text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Guardar Todo</span>
          </button>
        </div>
      </div>

      {/* 2. Pestañas de Filtro por Categoría */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-x-auto no-scrollbar">
        {[
          { id: "all", label: "Todos los Eventos" },
          { id: "pedidos", label: "Pedidos QR" },
          { id: "domicilios", label: "Domicilios" },
          { id: "inventario", label: "Inventario" },
          { id: "caja", label: "Caja y Arqueos" },
          { id: "cartera", label: "Cartera y Créditos" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedCategory(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === tab.id
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Panel Principal: Lista de Eventos y Editor de Plantilla */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Tarjetas de Eventos (5 columnas en lg) */}
        <div className="lg:col-span-5 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Eventos Disponibles ({filteredEvents.length})
          </p>

          <div className="space-y-2.5">
            {filteredEvents.map((evt) => {
              const Icon = EVENT_ICONS[evt.id] || Bell;
              const isSelected = editingEventId === evt.id;

              return (
                <div
                  key={evt.id}
                  onClick={() => setEditingEventId(evt.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white dark:bg-slate-900 border-[#ED500A] shadow-md ring-1 ring-[#ED500A]/30"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          evt.enabled
                            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {evt.name}
                          </h4>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {CATEGORY_LABELS[evt.category] || evt.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {evt.description}
                        </p>
                      </div>
                    </div>

                    {/* Switch de Activación General del Evento */}
                    <div
                      className="shrink-0 pt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={evt.enabled}
                          onChange={(e) => handleToggleEventEnabled(evt.id, e.target.checked)}
                          disabled={!canManage}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500" />
                      </label>
                    </div>
                  </div>

                  {/* Canales activos y badge de roles */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          evt.channels.whatsapp.enabled
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400 opacity-60"
                        }`}
                        title="Canal WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        WhatsApp
                      </span>
                      <span>•</span>
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          evt.channels.email.enabled
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 opacity-60"
                        }`}
                        title="Canal Email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Email
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-slate-500">
                      <Users className="w-3 h-3" />
                      <span>{evt.recipientRoles.length} roles</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Editor de Plantillas y Previsualización (7 columnas en lg) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            {/* Cabecera del Editor */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {currentEvent.name}
                  </h3>
                  {currentEvent.enabled ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" />
                      Evento Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      <XCircle className="w-3 h-3" />
                      Desactivado
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {currentEvent.description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(true)}
                  disabled={!canManage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Restaurar plantilla por defecto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveCurrentEvent}
                  disabled={isPending || !canManage}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#ED500A] hover:bg-[#d64708] text-white shadow-xs transition-colors cursor-pointer"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Guardar Plantilla</span>
                </button>
              </div>
            </div>

            {/* Pestañas de Canales para este Evento */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-4">
                {[
                  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
                  { id: "email", label: "Correo Electrónico", icon: Mail },
                  { id: "push", label: "App / Push", icon: Smartphone },
                ].map((ch) => {
                  const Icon = ch.icon;
                  const isChActive = activeChannelTab === ch.id;
                  const isEnabled = currentEvent.channels[ch.id as NotificationChannelType]?.enabled;

                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setActiveChannelTab(ch.id as NotificationChannelType)}
                      className={`flex items-center gap-2 pb-2 text-xs font-bold transition-all relative cursor-pointer ${
                        isChActive
                          ? "text-[#ED500A]"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{ch.label}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      />
                      {isChActive && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ED500A]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Toggle de activación del canal actual */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  Canal {activeChannelTab.toUpperCase()}:
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentEvent.channels[activeChannelTab].enabled}
                    onChange={(e) =>
                      handleToggleChannelEnabled(activeChannelTab, e.target.checked)
                    }
                    disabled={!canManage}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500" />
                </label>
              </div>
            </div>

            {/* Asunto si es Email */}
            {activeChannelTab === "email" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Asunto del Correo Electrónico
                </label>
                <input
                  type="text"
                  value={currentEvent.channels.email.subject || ""}
                  onChange={(e) => handleEmailSubjectChange(e.target.value)}
                  placeholder="Asunto del correo con variables..."
                  disabled={!canManage}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                />
              </div>
            )}

            {/* Toolbar de Variables Disponibles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#ED500A]" />
                  Variables Disponibles (Haz clic para insertar en el texto):
                </label>
                <span className="text-[11px] text-slate-400">
                  {currentEvent.availableVariables.length} variables
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                {currentEvent.availableVariables.map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => handleInsertTag(v.tag)}
                    disabled={!canManage}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-[#ED500A] hover:text-[#ED500A] transition-all cursor-pointer shadow-2xs"
                    title={`${v.description} (Ejemplo: ${v.sampleValue})`}
                  >
                    <span>{v.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Área de Edición de Plantilla */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cuerpo de la Plantilla ({activeChannelTab.toUpperCase()})
                </label>
                <span className="text-[11px] text-slate-400">
                  {activeTemplate.length} caracteres
                </span>
              </div>
              <textarea
                ref={textareaRef}
                rows={activeChannelTab === "push" ? 3 : 7}
                value={activeTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                disabled={!canManage}
                placeholder="Escribe el texto de la plantilla..."
                className="w-full p-3.5 text-xs font-mono leading-relaxed rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
              />
            </div>

            {/* Previsualización en Vivo */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  Previsualización en Tiempo Real ({activeChannelTab.toUpperCase()})
                </h4>
                <span className="text-[10px] text-slate-400">
                  Simulación con valores reales del negocio
                </span>
              </div>

              {activeChannelTab === "whatsapp" ? (
                /* Burbuja de WhatsApp Realista */
                <div className="p-4 rounded-2xl bg-[#EFEAE2] dark:bg-[#0B141A] border border-slate-200 dark:border-slate-800">
                  <div className="max-w-md bg-white dark:bg-[#1F2C34] text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-xs p-3.5 shadow-sm text-xs whitespace-pre-wrap leading-relaxed relative">
                    {renderedPreview || "Escribe el texto de la plantilla para ver la vista previa..."}
                    <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-400">
                      <span>12:45 PM</span>
                      <Check className="w-3 h-3 text-blue-500" />
                    </div>
                  </div>
                </div>
              ) : activeChannelTab === "email" ? (
                /* Tarjeta de Correo Electrónico */
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-xs border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-slate-400">De: </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {businessName} &lt;notificaciones@negova.com&gt;
                    </span>
                  </div>
                  <div className="text-xs border-b border-slate-200 dark:border-slate-700 pb-2 font-bold text-slate-900 dark:text-white">
                    {renderedEmailSubject || "Sin asunto especificado"}
                  </div>
                  <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {renderedPreview}
                  </div>
                </div>
              ) : (
                /* Tarjeta de Notificación Push en App */
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-[#ED500A]">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                      <span>{businessName}</span>
                      <span className="text-[10px] text-slate-400 font-normal">Ahora</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                      {renderedPreview}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Destinatarios y Roles Internos */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-500" />
                Destinatarios de la Notificación
              </h4>

              {/* Notificar al Cliente si aplica */}
              {currentEvent.notifyCustomer !== undefined && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      Enviar notificación al Cliente Final
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Dispara el mensaje al número de WhatsApp o correo electrónico del cliente registrado.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentEvent.notifyCustomer}
                      onChange={(e) => handleToggleNotifyCustomer(e.target.checked)}
                      disabled={!canManage}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500" />
                  </label>
                </div>
              )}

              {/* Roles que reciben la notificación interna */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Roles internos del equipo que reciben la alerta:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {NOTIFICATION_AVAILABLE_ROLES.map((role) => {
                    const isChecked = currentEvent.recipientRoles.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                          isChecked
                            ? "bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60 text-slate-900 dark:text-white"
                            : "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRole(role.id)}
                          disabled={!canManage}
                          className="w-4 h-4 rounded text-[#ED500A] focus:ring-[#ED500A]"
                        />
                        <div>
                          <p className="font-semibold text-xs leading-none">{role.label}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{role.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación para Restaurar Plantilla */}
      <ConfirmModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleConfirmReset}
        title="Restablecer plantilla de notificación"
        description={`¿Deseas restaurar la plantilla "${currentEvent.name}" a los valores de fábrica oficiales? Se perderán las modificaciones personalizadas que hayas realizado.`}
        confirmText="Restablecer plantilla"
        cancelText="Cancelar"
        variant="warning"
        isLoading={isResetting}
      />
    </div>
  );
}
