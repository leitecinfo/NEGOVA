"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  MessageCircle,
  User,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { WHATSAPP_PHONE_NUMBER, WHATSAPP_PREFILLED_MESSAGE } from "./floating-contact";

export interface ChatMessage {
  id: string;
  sender: "assistant" | "user";
  text: string;
  timestamp: string;
  suggestedAction?: {
    label: string;
    actionType: "whatsapp" | "link";
    href?: string;
  };
}

const SUGGESTED_QUESTIONS = [
  "¿Qué es NEGOVA?",
  "¿Qué negocios pueden usarlo?",
  "¿Qué incluye cada plan?",
  "¿Puedo probar NEGOVA gratis?",
  "¿NEGOVA funciona desde el computador?",
];

const INITIAL_GREETING_MESSAGE: ChatMessage = {
  id: "init-1",
  sender: "assistant",
  text: "Hola 👋 Soy el asistente de NEGOVA. Puedo ayudarte a conocer cómo funciona, qué incluye, qué negocios puede gestionar y qué plan puede adaptarse mejor a tu negocio.",
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
};

function parseMarkdownLine(line: string): React.ReactNode[] {
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = line.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-[#0B0E14]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const href = linkMatch[2];
      const label = linkMatch[1];
      const isExternal = href.startsWith("http") && !href.includes("precios");

      return (
        <a
          key={index}
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          onClick={(e) => {
            if (href.includes("precios") || href.includes("#precios")) {
              e.preventDefault();
              const el = document.getElementById("precios");
              if (el) {
                el.scrollIntoView({ behavior: "smooth" });
              } else {
                window.location.href = "/#precios";
              }
            }
          }}
          className="text-[#ED500A] underline underline-offset-2 font-medium hover:text-[#F36320] cursor-pointer"
        >
          {label}
        </a>
      );
    }

    return part;
  });
}

function FormattedMessageText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const isBullet =
          trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ");
        const content = isBullet ? trimmed.substring(2).trim() : trimmed;
        const parts = parseMarkdownLine(content);

        if (isBullet) {
          return (
            <div key={idx} className="flex gap-2 items-start pl-1">
              <span className="text-[#ED500A] font-bold select-none">•</span>
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        return <p key={idx}>{parts}</p>;
      })}
    </div>
  );
}

// Componente de Robot Vectorial Animado 100% en código (Sin imágenes estáticas)
export function AnimatedRobotAvatar({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Antena y Luz LED Superior */}
      <circle cx="24" cy="5" r="2.5" fill="#ED500A" className="animate-pulse" />
      <line x1="24" y1="7.5" x2="24" y2="12" stroke="#ED500A" strokeWidth="2" strokeLinecap="round" />

      {/* Cabeza del Robot */}
      <rect x="8" y="12" width="32" height="26" rx="10" fill="#0B0E14" stroke="#ED500A" strokeWidth="2" />
      
      {/* Visor Digital Encendido */}
      <rect x="12" y="16" width="24" height="15" rx="6" fill="#161B26" stroke="#38BDF8" strokeWidth="1.5" />

      {/* Ojos Animados con Pestañeo CSS */}
      <g className="animate-eye-blink">
        <circle cx="18" cy="22" r="2.5" fill="#38BDF8" />
        <circle cx="30" cy="22" r="2.5" fill="#38BDF8" />
        <circle cx="19" cy="21" r="0.8" fill="white" />
        <circle cx="31" cy="21" r="0.8" fill="white" />
      </g>

      {/* Sonrisa del Robot */}
      <path
        d="M19 27C19 27 21.5 29 24 29C26.5 29 29 27 29 27"
        stroke="#38BDF8"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Orejas / Conectores Laterales */}
      <rect x="4" y="20" width="4" height="8" rx="2" fill="#ED500A" />
      <rect x="40" y="20" width="4" height="8" rx="2" fill="#ED500A" />
    </svg>
  );
}

const CHAT_SESSION_TTL = 24 * 60 * 60 * 1000; // Expiración de 24 horas

export function NegovaAssistant() {
  const [sessionId, setSessionId] = useState<string>("guest-session");
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING_MESSAGE]);

  // Cargar sesión e historial de localStorage al recargar (F5) con tiempo de expiración (24 Horas)
  useEffect(() => {
    try {
      const rawData = localStorage.getItem("negova_chat_data");
      if (rawData) {
        const payload = JSON.parse(rawData);
        const isExpired = Date.now() - (payload.timestamp || 0) > CHAT_SESSION_TTL;

        if (!isExpired && Array.isArray(payload.messages) && payload.messages.length > 0) {
          setSessionId(payload.sessionId || "sess-" + Date.now());
          setMessages(payload.messages);
        } else {
          // Si expiró (+24h), limpiamos la sesión anterior
          localStorage.removeItem("negova_chat_data");
          setSessionId("sess-" + Date.now());
          setMessages([INITIAL_GREETING_MESSAGE]);
        }
      } else {
        setSessionId("sess-" + Date.now());
      }
    } catch {
      // Ignora si localStorage no está disponible
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Guardar conversación en localStorage cada vez que cambien los mensajes (solo tras la hidratación inicial)
  useEffect(() => {
    if (!isHydrated) return;

    try {
      const payload = {
        timestamp: Date.now(),
        sessionId,
        messages,
      };
      localStorage.setItem("negova_chat_data", JSON.stringify(payload));
    } catch {
      // Ignora
    }
  }, [messages, sessionId, isHydrated]);

  const handleClearHistory = () => {
    try {
      localStorage.removeItem("negova_chat_data");
      const freshSession = "sess-" + Date.now();
      setSessionId(freshSession);
      setMessages([INITIAL_GREETING_MESSAGE]);
    } catch {
      setMessages([INITIAL_GREETING_MESSAGE]);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage;
    if (!query.trim() || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    if (!textToSend) setInputMessage("");
    setIsLoading(true);

    try {
      // Pasamos el historial previo de mensajes para dar memoria conversacional a la IA
      const historyPayload = messages.map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          sessionId,
          history: historyPayload,
        }),
      });

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: "assistant",
        text: data.text || "Disculpa, ha ocurrido un detalle. Puedes consultarnos por WhatsApp.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestedAction: data.suggestedAction,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: "No se pudo procesar tu mensaje. Si deseas, puedes escribirnos directamente por WhatsApp.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestedAction: {
          label: "Hablar con NEGOVA por WhatsApp",
          actionType: "whatsapp",
        },
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE_NUMBER}?text=${encodeURIComponent(
    WHATSAPP_PREFILLED_MESSAGE
  )}`;

  return (
    <>
      {/* ── BOTÓN FLOTANTE DEL ASISTENTE IA ── */}
      <div className="relative group">
        <div
          className={`hidden sm:block absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 rounded-xl bg-[#0B0E14] text-white font-title font-semibold text-xs whitespace-nowrap shadow-lg border border-white/10 transition-all duration-200 pointer-events-none ${
            showTooltip && !isOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
          }`}
        >
          Pregunta a NEGOVA
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          aria-label="Abrir asistente de IA NEGOVA"
          aria-expanded={isOpen}
          className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 focus:outline-hidden cursor-pointer relative group drop-shadow-[0_8px_20px_rgba(237,80,10,0.4)] sm:drop-shadow-[0_10px_25px_rgba(237,80,10,0.45)] hover:drop-shadow-[0_15px_30px_rgba(237,80,10,0.7)]"
        >
          <AnimatedRobotAvatar className="w-full h-full group-hover:rotate-3 transition-transform duration-300" />
          <span className="absolute top-0 right-0 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#ED500A] border-2 border-[#0B0E14] animate-pulse" />
        </button>
      </div>

      {/* ── PANEL DE CHAT FLOTANTE (EN PANTALLA SOBRE LA PÁGINA) ── */}
      {isOpen && (
        <div className="fixed inset-x-2 sm:inset-x-auto sm:right-6 bottom-2 sm:bottom-24 top-16 sm:top-auto z-50 w-auto sm:w-[420px] h-auto sm:h-[580px] rounded-3xl bg-white text-[#0B0E14] border border-slate-200 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden animate-fade-in max-w-[calc(100vw-16px)]">
          
          {/* HEADER DEL ASISTENTE */}
          <div className="p-4 sm:p-5 bg-[#0B0E14] text-white flex items-center justify-between border-b border-white/10 relative">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-[#ED500A]/20 text-[#ED500A] border border-[#ED500A]/30 flex items-center justify-center">
                <AnimatedRobotAvatar className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-title font-extrabold text-base text-white">
                    Asistente NEGOVA
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    En línea
                  </span>
                </div>
                <p className="font-body text-xs text-slate-400">
                  Estoy aquí para ayudarte a conocer NEGOVA.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Reiniciar conversación"
                aria-label="Reiniciar conversación"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Cerrar asistente"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* CUERPO DEL CHAT DE MENSAJES */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#F8F9FD]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.sender === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-[#0B0E14] text-[#ED500A] border border-[#ED500A]/40 flex items-center justify-center shrink-0 shadow-2xs self-start">
                    <AnimatedRobotAvatar className="w-5 h-5" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-2`}>
                  <div
                    className={`p-3.5 rounded-2xl font-body text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      msg.sender === "user"
                        ? "bg-[#ED500A] text-white rounded-tr-none font-medium"
                        : "bg-white text-[#0B0E14] border border-slate-200/80 rounded-tl-none"
                    }`}
                  >
                    {msg.sender === "user" ? (
                      <span className="whitespace-pre-line">{msg.text}</span>
                    ) : (
                      <FormattedMessageText text={msg.text} />
                    )}
                  </div>

                  {/* Acciones o Botones sugeridos */}
                  {msg.suggestedAction && (
                    <div className="pt-1">
                      {msg.suggestedAction.actionType === "whatsapp" ? (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-title font-bold text-xs shadow-xs transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-white/20" />
                          <span>{msg.suggestedAction.label}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            setTimeout(() => {
                              const el = document.getElementById("precios");
                              if (el) {
                                el.scrollIntoView({ behavior: "smooth" });
                              } else {
                                window.location.href = "/#precios";
                              }
                            }, 150);
                          }}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0B0E14] hover:bg-[#ED500A] text-white font-title font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          <span>{msg.suggestedAction.label}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  <span className="font-mono text-[10px] text-slate-400 block text-right px-1">
                    {msg.timestamp}
                  </span>
                </div>

                {msg.sender === "user" && (
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-full bg-[#0B0E14] text-[#ED500A] border border-[#ED500A]/40 flex items-center justify-center shrink-0 shadow-2xs">
                  <AnimatedRobotAvatar className="w-5 h-5" />
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-400 font-mono text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ED500A] animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ED500A] animate-pulse [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ED500A] animate-pulse [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            {/* PREGUNTAS SUGERIDAS (Chips Rápidos) */}
            {messages.length <= 2 && (
              <div className="pt-3">
                <span className="font-mono text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  PREGUNTAS SUGERIDAS
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSendMessage(q)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#ED500A]/10 border border-slate-200 hover:border-[#ED500A]/30 text-slate-700 hover:text-[#ED500A] font-title font-medium text-xs transition-colors cursor-pointer text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT FIJO INFERIOR */}
          <div className="p-3 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Escribe tu pregunta sobre NEGOVA..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A] text-xs sm:text-sm text-[#0B0E14] placeholder-slate-400"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-2.5 rounded-xl bg-[#ED500A] hover:bg-[#F36320] disabled:opacity-40 text-white transition-colors cursor-pointer shrink-0"
                aria-label="Enviar mensaje"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      )}
    </>
  );
}
