"use client";

import React, { useState, useMemo } from "react";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  X,
  ChevronUp,
  UtensilsCrossed,
  Package,
  Bike,
  CheckCircle2,
  Loader2,
  AlertCircle,
  MessageCircle,
  Clock,
  Banknote,
  ArrowLeftRight,
  Copy,
  Check,
  QrCode,
} from "lucide-react";
import { CartItem } from "./menu-cart-types";
import { createPublicMenuOrderAction } from "@/app/menu/[slugOrId]/actions";
import { toast } from "sonner";
import { PublicPaymentMethodDTO, PaymentMethodCode } from "@/lib/payments/types";
import { getDestinationTypeLabel } from "@/lib/payments/payment-methods-catalog";
import { PaymentMethodLogo } from "@/components/payments/payment-method-logo";

interface Props {
  cart: Record<string, CartItem>;
  onUpdateQuantity: (id: string, delta: number) => void;
  onClearCart: () => void;
  currency: string;
  businessId: string;
  businessName: string;
  whatsappPhone?: string | null;
  theme?: "dark" | "light" | "brutal" | "elegante";
  accentColor?: string;
  isPreview?: boolean;
  activeTable?: { id: string; name_or_number: string } | null;
  tableToken?: string | null;
  deliveryFee?: number;
  deliveryEnabled?: boolean;
  paymentMethods?: PublicPaymentMethodDTO[];
}

export function MenuCartDrawer({
  cart,
  onUpdateQuantity,
  onClearCart,
  currency,
  businessId,
  businessName,
  whatsappPhone,
  theme = "dark",
  accentColor = "#22C55E",
  isPreview = false,
  activeTable,
  tableToken,
  deliveryFee = 0,
  deliveryEnabled = true,
  paymentMethods,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderId: string;
    orderNumber: number;
    total: number;
    orderType: string;
    whatsappOpened?: boolean;
    whatsappUrl?: string | null;
    hasBusinessWhatsapp?: boolean;
  } | null>(null);

  // La modalidad "dine_in" (en mesa) SOLO es permitida si se verificó una mesa física con QR válido.
  const hasValidTable = Boolean(activeTable && tableToken);
  const isDeliveryAllowed = deliveryEnabled !== false;

  // Modalidad de consumo seleccionada:
  // Si entró por QR de mesa válido, sugerir "dine_in" por defecto; de lo contrario, "takeout"
  const [orderType, setOrderType] = useState<"dine_in" | "takeout" | "delivery">(
    hasValidTable ? "dine_in" : "takeout"
  );

  // Sincronizar automáticamente la modalidad según la presencia de QR válido de mesa o disponibilidad de domicilio
  React.useEffect(() => {
    if (hasValidTable) {
      setOrderType("dine_in");
    } else {
      setOrderType((prev) => (!isDeliveryAllowed && prev === "delivery" ? "takeout" : prev));
    }
  }, [hasValidTable, isDeliveryAllowed]);

  // Lista de métodos de cobro activos para este negocio (Efectivo siempre presente)
  const availableMethods = useMemo<PublicPaymentMethodDTO[]>(() => {
    if (paymentMethods && paymentMethods.length > 0) {
      return paymentMethods;
    }
    return [
      {
        code: "cash",
        name: "Efectivo",
        category: "Efectivo",
        logoPath: null,
        accountHolder: null,
        destinationType: null,
        destinationValue: null,
        instructions: null,
        breBKeyType: null,
        qrUrl: null,
      },
    ];
  }, [paymentMethods]);

  // Método de pago: por defecto 'cash' o el primero disponible
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    if (typeof window !== "undefined" && navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedText(text);
      toast.success(`${label} copiado al portapapeles.`);
      setTimeout(() => setCopiedText(null), 2500);
    }
  };

  const selectedPayment =
    availableMethods.find((m) => m.code === paymentMethod) || availableMethods[0];

  // Datos para Recogida y Domicilio
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  );

  const items = Object.values(cart);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalAmount = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const applicableDeliveryFee = orderType === "delivery" && isDeliveryAllowed ? Math.max(0, Number(deliveryFee) || 0) : 0;
  const totalAmount = subtotalAmount + applicableDeliveryFee;

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency || "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const cleanWhatsapp = (whatsappPhone || "").replace(/[^0-9]/g, "");

  // Paleta y tokens visuales adaptados según la plantilla activa
  const isBrutal = theme === "brutal";
  const isLight = theme === "light";
  const isElegante = theme === "elegante";

  // Color de acento efectivo por plantilla
  const effectiveAccent = accentColor || (isElegante ? "#C5A059" : isBrutal ? "#FF3B30" : isLight ? "#111111" : "#E10600");

  // Cálculo de contraste de texto (blanco o carbón oscuro según luminancia del acento)
  const getContrastTextColor = (hex: string): string => {
    try {
      const c = hex.replace("#", "");
      if (c.length === 6) {
        const r = parseInt(c.substring(0, 2), 16);
        const g = parseInt(c.substring(2, 4), 16);
        const b = parseInt(c.substring(4, 6), 16);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return lum > 0.65 ? "#0F172A" : "#FFFFFF";
      }
    } catch {}
    return "#FFFFFF";
  };

  const ctaTextColor = isBrutal ? "#111111" : getContrastTextColor(effectiveAccent);

  const generateWhatsappUrl = (orderNum?: number) => {
    if (!cleanWhatsapp || items.length === 0) return "#";
    const header = orderNum
      ? `¡Hola! Acabo de registrar el pedido *#${orderNum}* en *${businessName}*:\n\n`
      : `¡Hola! Quisiera realizar el siguiente pedido en *${businessName}*:\n\n`;

    const lines = items.map(
      (item) => {
        const modText = item.selectedModifiers && item.selectedModifiers.length > 0
          ? ` (+${item.selectedModifiers.map(m => m.optionName || (m as any).name).join(", ")})`
          : "";
        return `• ${item.quantity} x ${item.name}${item.variantName ? ` (${item.variantName})` : ""}${modText} — ${formatPrice(item.unitPrice * item.quantity)}`;
      }
    );

    const subtotalText = `*Subtotal de productos:* ${formatPrice(subtotalAmount)}`;
    const deliveryText = orderType === "delivery" && applicableDeliveryFee > 0
      ? `\n*Domicilio:* ${formatPrice(applicableDeliveryFee)}`
      : "";
    const totalText = `\n*Total del pedido:* ${formatPrice(totalAmount)}`;

    let paymentText = "\n\n*Método de pago:* Efectivo (al entregar o recoger).";
    if (selectedPayment && selectedPayment.code !== "cash") {
      if (selectedPayment.code === "bre_b") {
        const keyLabel = getDestinationTypeLabel(null, selectedPayment.breBKeyType);
        paymentText = `\n\n*Método de pago elegido:* Bre-B\n*Tipo de llave:* ${keyLabel}\n*Llave de destino:* ${selectedPayment.destinationValue}`;
        if (selectedPayment.accountHolder) {
          paymentText += `\n*Titular:* ${selectedPayment.accountHolder}`;
        }
        paymentText += `\n*Total a transferir:* ${formatPrice(totalAmount)}`;
      } else {
        const destType = getDestinationTypeLabel(selectedPayment.destinationType);
        paymentText = `\n\n*Método de pago elegido:* ${selectedPayment.name}\n*Destino:* ${selectedPayment.destinationValue} (${destType})`;
        if (selectedPayment.accountHolder) {
          paymentText += `\n*Titular:* ${selectedPayment.accountHolder}`;
        }
        paymentText += `\n*Total a transferir:* ${formatPrice(totalAmount)}`;
      }
    }

    let modalityInfo = "";
    if (orderType === "dine_in" && activeTable) {
      modalityInfo = `\n\n*Modalidad:* Consumo en Mesa (${activeTable.name_or_number})\n*Estado:* Pendiente de confirmación del personal`;
    } else if (orderType === "takeout") {
      modalityInfo = `\n\n*Modalidad:* Recogida en el local\n*Cliente:* ${customerName} (${customerPhone})`;
    } else if (orderType === "delivery") {
      modalityInfo = `\n\n*Modalidad:* Domicilio\n*Cliente:* ${customerName} (${customerPhone})\n*Dirección:* ${deliveryAddress}${deliveryReference ? ` (${deliveryReference})` : ""}`;
    }

    if (orderNotes.trim()) {
      modalityInfo += `\n*Notas:* ${orderNotes.trim()}`;
    }

    const message = `${header}${lines.join("\n")}\n\n${subtotalText}${deliveryText}${totalText}${paymentText}${modalityInfo}\n\nQuedo atento a la confirmación del pedido.`;
    return `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(message)}`;
  };

  const handleConfirmOrder = async () => {
    if (items.length === 0) return;

    if (isPreview) {
      toast.info("Modo vista previa: La confirmación de pedidos reales está inactiva en el editor.");
      return;
    }

    // Validar campos en el cliente antes de enviar
    if (orderType === "dine_in" && (!hasValidTable || !activeTable || !tableToken)) {
      toast.error("Para pedir en mesa debes escanear el código QR físico de tu mesa.");
      return;
    }

    if ((orderType === "takeout" || orderType === "delivery") && !customerName.trim()) {
      toast.error("Por favor ingresa tu nombre.");
      return;
    }

    if ((orderType === "takeout" || orderType === "delivery") && !customerPhone.trim()) {
      toast.error("Por favor ingresa tu número telefónico de contacto.");
      return;
    }

    if (orderType === "delivery" && !deliveryAddress.trim()) {
      toast.error("Por favor ingresa la dirección para la entrega.");
      return;
    }

    // Validación obligatoria de método de pago
    if (!paymentMethod) {
      toast.error("Por favor selecciona un método de pago.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createPublicMenuOrderAction({
        businessId,
        orderType,
        paymentMethod: selectedPayment.code,
        tableId: orderType === "dine_in" ? activeTable?.id : null,
        tableToken: orderType === "dine_in" ? tableToken : null,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        deliveryAddress: deliveryAddress.trim() || null,
        deliveryReference: deliveryReference.trim() || null,
        notes: orderNotes.trim() || null,
        idempotencyKey,
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || (it.variantName ? it.id.split("_")[1] || null : null),
          variantName: it.variantName || null,
          quantity: it.quantity,
          notes: it.notes,
          selectedModifiers: it.selectedModifiers && it.selectedModifiers.length > 0
            ? it.selectedModifiers.map((m) => ({
                groupId: m.groupId || "",
                groupName: m.groupName || "",
                optionId: m.optionId || "",
                optionName: m.optionName || (m as any).name || "",
                price: m.price || 0,
              }))
            : undefined,
        })),
      });

      if (!res.success || !res.orderId) {
        toast.error(res.error || "No fue posible procesar el pedido.");
        return;
      }

      // Pedido registrado con éxito en NEGOVA
      const finalOrderNumber = res.orderNumber || 0;
      const finalOrderType = res.orderType || orderType;

      // REGLA: Notificación por WhatsApp solo para Recogida (takeout) y Domicilio (delivery).
      // En mesa (dine_in) no genera notificación por WhatsApp.
      let opened = false;
      const effectiveWaUrl =
        finalOrderType !== "dine_in"
          ? res.whatsappUrl || (cleanWhatsapp ? generateWhatsappUrl(finalOrderNumber) : null)
          : null;

      const hasConfiguredWhatsapp =
        res.hasBusinessWhatsapp !== undefined
          ? res.hasBusinessWhatsapp
          : Boolean(cleanWhatsapp);

      if (effectiveWaUrl && effectiveWaUrl !== "#") {
        try {
          const w = window.open(effectiveWaUrl, "_blank");
          if (w && !w.closed) {
            opened = true;
          }
        } catch {
          opened = false;
        }
      }

      setConfirmedOrder({
        orderId: res.orderId,
        orderNumber: finalOrderNumber,
        total: res.total || totalAmount,
        orderType: finalOrderType,
        whatsappOpened: opened,
        whatsappUrl: effectiveWaUrl,
        hasBusinessWhatsapp: hasConfiguredWhatsapp,
      });

      onClearCart();

      if (finalOrderType === "dine_in") {
        toast.success(`¡Comanda #${finalOrderNumber} enviada a cocina! Pendiente de confirmación del personal.`);
      } else if (hasConfiguredWhatsapp && opened) {
        toast.success(`¡Pedido #${finalOrderNumber} guardado! Se abrió WhatsApp para enviar el mensaje.`);
      } else {
        toast.success(`¡Pedido #${finalOrderNumber} registrado exitosamente en NEGOVA!`);
      }
    } catch (err: any) {
      console.error("[handleConfirmOrder] Error:", err);
      toast.error("Error al registrar el pedido. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clases y estilos de la barra inferior fija
  const barBackground = isBrutal
    ? "#FFFFFF"
    : isElegante
    ? "rgba(19, 21, 28, 0.96)"
    : isLight
    ? "rgba(255, 255, 255, 0.98)"
    : "rgba(20, 23, 33, 0.96)";

  const barBorder = isBrutal
    ? "3px solid #111111"
    : isElegante
    ? "1px solid rgba(197, 160, 89, 0.25)"
    : isLight
    ? "1px solid #E2E8F0"
    : "1px solid rgba(255, 255, 255, 0.12)";

  const barShadow = isBrutal
    ? "0 -4px 0 #111111"
    : isElegante
    ? "0 -4px 25px rgba(0, 0, 0, 0.7)"
    : "0 -4px 20px rgba(0, 0, 0, 0.25)";

  const modalContainerClasses = isBrutal
    ? "bg-white border-[3px] border-[#111111] shadow-[6px_6px_0_#111111] text-[#111111]"
    : isElegante
    ? "bg-[#13151C] border border-[#C5A059]/30 text-[#F8F9FA] shadow-[0_25px_60px_rgba(0,0,0,0.8)]"
    : isLight
    ? "bg-white border border-slate-200 text-[#0F172A] shadow-2xl"
    : "bg-[#141721] border border-white/10 text-white shadow-2xl";

  const dividerClass = isBrutal
    ? "border-[#111111]"
    : isElegante
    ? "border-[#C5A059]/20"
    : isLight
    ? "border-slate-100"
    : "border-white/10";

  const secondaryTextClass = isBrutal
    ? "text-slate-600"
    : isElegante
    ? "text-[#C5A059]/80"
    : isLight
    ? "text-slate-500"
    : "text-slate-400";

  const inputClass = isBrutal
    ? "w-full px-3 py-2 rounded-xl bg-white border-2 border-[#111111] text-xs text-[#111111] font-medium placeholder:text-slate-400 focus:outline-hidden focus:shadow-[2px_2px_0_#111111]"
    : isElegante
    ? "w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-[#C5A059]/30 text-xs text-[#F8F9FA] placeholder:text-slate-500 focus:outline-hidden focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
    : isLight
    ? "w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
    : "w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-white/30";

  if (totalCount === 0 && !isOpen && !confirmedOrder) {
    return null;
  }

  return (
    <>
      {/* 1. MODAL COMPLETO DEL CARRITO Y CHECKOUT */}
      {isOpen && (
        <div
          className={`${
            isPreview ? "absolute" : "fixed"
          } inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 transition-all`}
          onClick={() => {
            if (!isSubmitting) setIsOpen(false);
          }}
        >
          <div
            className={`w-full max-w-lg sm:max-w-xl md:max-w-2xl rounded-2xl p-4 sm:p-6 flex flex-col max-h-[92vh] overflow-hidden ${modalContainerClasses}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className={`flex items-center justify-between pb-3 border-b ${dividerClass} shrink-0`}>
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" style={{ color: effectiveAccent }} />
                <h3 className="font-extrabold text-sm sm:text-base">
                  {confirmedOrder ? "Pedido Confirmado" : `Tu Pedido (${totalCount})`}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!confirmedOrder && items.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearCart}
                    disabled={isSubmitting}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 transition-colors text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    title="Vaciar pedido"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold">Vaciar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PANTALLA DE ÉXITO TRAS CONFIRMAR PEDIDO */}
            {confirmedOrder ? (
              <div className="py-6 px-2 flex flex-col items-center text-center space-y-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center animate-in zoom-in-75"
                  style={{
                    backgroundColor: `${effectiveAccent}20`,
                    border: `2px solid ${effectiveAccent}`,
                    color: effectiveAccent,
                  }}
                >
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h4 className="text-xl font-black">¡Pedido Enviado!</h4>
                  <div className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/25">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Pendiente de confirmación</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Número de comanda:{" "}
                    <span className="font-extrabold" style={{ color: effectiveAccent }}>
                      #{confirmedOrder.orderNumber}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Total: <span className="font-bold">{formatPrice(confirmedOrder.total)}</span>
                  </p>
                </div>

                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  {confirmedOrder.orderType === "dine_in"
                    ? `Tu comanda para la ${activeTable?.name_or_number || "mesa"} ha sido registrada en el sistema de ${businessName}. El personal del local la revisará y confirmará antes de iniciar su preparación en cocina.`
                    : `Tu pedido ha sido registrado en el sistema de ${businessName} y está pendiente de ser confirmado por el personal.`}
                </p>

                {confirmedOrder.orderType !== "dine_in" && (
                  <div className="w-full space-y-2">
                    {confirmedOrder.hasBusinessWhatsapp && confirmedOrder.whatsappUrl ? (
                      <>
                        <div className="p-3 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 leading-snug text-left">
                          <p className="font-semibold mb-1">
                            {confirmedOrder.whatsappOpened
                              ? "✓ Mensaje preparado en WhatsApp"
                              : "WhatsApp del comercio:"}
                          </p>
                          <p className="text-[11px] text-emerald-300/90">
                            {confirmedOrder.whatsappOpened
                              ? "Se abrió WhatsApp con el resumen de tu pedido. Recuerda pulsar 'Enviar' en la aplicación para que el negocio lo reciba."
                              : "Tu pedido ya está guardado en NEGOVA. Pulsa el botón a continuación para enviar el resumen al comercio:"}
                          </p>
                        </div>

                        <a
                          href={confirmedOrder.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-white text-xs font-bold shadow-lg hover:opacity-95 active:scale-98 transition-all"
                        >
                          <MessageCircle className="w-4 h-4 fill-current" />
                          <span>
                            {confirmedOrder.whatsappOpened
                              ? "Reabrir WhatsApp del Comercio"
                              : "Abrir WhatsApp con mi Pedido"}
                          </span>
                        </a>

                        <p className="text-[11px] text-slate-400 leading-tight">
                          El pedido ya quedó registrado de forma segura en NEGOVA. El personal lo preparará según la modalidad elegida.
                        </p>
                      </>
                    ) : (
                      <div className="p-3.5 rounded-xl text-xs bg-slate-500/10 border border-slate-500/20 text-slate-300 leading-snug text-left space-y-1">
                        <p className="font-semibold text-slate-200">
                          ✓ Pedido guardado en el sistema
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Este comercio gestionará tu pedido directamente desde su panel de NEGOVA. No se requiere envío adicional por WhatsApp.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {confirmedOrder.orderType === "dine_in" && (
                  <div className="w-full p-3 rounded-xl text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 leading-snug text-center">
                    Tu comanda será atendida directamente por el personal en tu mesa una vez confirmada.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setConfirmedOrder(null);
                    setIsOpen(false);
                  }}
                  className={`w-full py-2.5 rounded-xl border ${dividerClass} hover:bg-white/5 text-xs font-bold transition-colors cursor-pointer`}
                >
                  Volver al Menú
                </button>
              </div>
            ) : (
              /* CONTENIDO NORMAL DEL PEDIDO Y CHECKOUT */
              <div className="overflow-y-auto py-3 pl-0.5 pr-3 sm:pr-4 space-y-3.5 flex-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-400/30 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/50">
                {/* 1. SELECCIÓN DE MODALIDAD */}
                <div className="space-y-1.5">
                  <label className={`text-[11px] font-bold uppercase tracking-wider ${secondaryTextClass}`}>
                    Modalidad de Entrega
                  </label>

                  {/* Si el cliente escaneó un QR válido, se muestran las 3 opciones (En Mesa, Recogida, Domicilio).
                      Si entró por enlace público normal (casa/PC), NO aparece "En Mesa", solo Recogida y Domicilio. */}
                  <div className={`grid ${hasValidTable ? "grid-cols-3" : "grid-cols-2"} gap-1.5`}>
                    {hasValidTable && (
                      <button
                        type="button"
                        onClick={() => setOrderType("dine_in")}
                        style={
                          orderType === "dine_in"
                            ? {
                                backgroundColor: isBrutal ? "#FFD60A" : `${effectiveAccent}18`,
                                borderColor: isBrutal ? "#111111" : effectiveAccent,
                                color: isBrutal ? "#111111" : effectiveAccent,
                              }
                            : undefined
                        }
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          orderType === "dine_in"
                            ? `font-bold ${isBrutal ? "border-2 shadow-[2px_2px_0_#111111]" : ""}`
                            : `${dividerClass} opacity-70 hover:opacity-100`
                        }`}
                      >
                        <UtensilsCrossed className="w-4 h-4 mb-1" />
                        <span className="text-[11px] leading-tight">En Mesa</span>
                      </button>
                    )}

                    {/* Para llevar / Recogida */}
                    <button
                      type="button"
                      onClick={() => setOrderType("takeout")}
                      style={
                        orderType === "takeout"
                          ? {
                              backgroundColor: isBrutal ? "#FFD60A" : `${effectiveAccent}18`,
                              borderColor: isBrutal ? "#111111" : effectiveAccent,
                              color: isBrutal ? "#111111" : effectiveAccent,
                            }
                          : undefined
                      }
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        orderType === "takeout"
                          ? `font-bold ${isBrutal ? "border-2 shadow-[2px_2px_0_#111111]" : ""}`
                          : `${dividerClass} opacity-70 hover:opacity-100`
                      }`}
                    >
                      <Package className="w-4 h-4 mb-1" />
                      <span className="text-[11px] leading-tight">Recogida</span>
                    </button>

                    {/* Domicilio */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!isDeliveryAllowed) {
                          toast.info("El servicio de entrega a domicilio no está disponible actualmente.");
                          return;
                        }
                        setOrderType("delivery");
                      }}
                      disabled={!isDeliveryAllowed}
                      style={
                        orderType === "delivery" && isDeliveryAllowed
                          ? {
                              backgroundColor: isBrutal ? "#FFD60A" : `${effectiveAccent}18`,
                              borderColor: isBrutal ? "#111111" : effectiveAccent,
                              color: isBrutal ? "#111111" : effectiveAccent,
                            }
                          : undefined
                      }
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                        !isDeliveryAllowed
                          ? "opacity-40 cursor-not-allowed bg-black/5 dark:bg-white/5"
                          : orderType === "delivery"
                          ? `font-bold cursor-pointer ${isBrutal ? "border-2 shadow-[2px_2px_0_#111111]" : ""}`
                          : `${dividerClass} opacity-70 hover:opacity-100 cursor-pointer`
                      }`}
                      title={!isDeliveryAllowed ? "Servicio de domicilio no habilitado" : undefined}
                    >
                      <Bike className="w-4 h-4 mb-1" />
                      <span className="text-[11px] leading-tight">
                        Domicilio {!isDeliveryAllowed && <span className="block text-[9px] text-red-500 font-normal leading-none mt-0.5">(Inactivo)</span>}
                      </span>
                    </button>
                  </div>

                  {/* Badge de mesa verificada exclusivamente cuando entró por QR */}
                  {orderType === "dine_in" && hasValidTable && activeTable && (
                    <div
                      className="mt-1 p-2 rounded-xl text-xs flex items-center justify-between"
                      style={{
                        backgroundColor: `${effectiveAccent}14`,
                        border: `1px solid ${effectiveAccent}35`,
                        color: effectiveAccent,
                      }}
                    >
                      <span>
                        Mesa verificada: <strong>{activeTable.name_or_number}</strong>
                      </span>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${effectiveAccent}25` }}
                      >
                        QR Válido
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. CAMPOS OBLIGATORIOS SEGÚN LA MODALIDAD */}
                {(orderType === "takeout" || orderType === "delivery") && (
                  <div className={`space-y-2 pt-1 border-t ${dividerClass}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className={`text-[11px] font-bold block mb-1 ${secondaryTextClass}`}>
                          Tu Nombre <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Ej. Carlos Martínez"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold block mb-1 ${secondaryTextClass}`}>
                          Teléfono de Contacto <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="Ej. 300 123 4567"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {orderType === "delivery" && (
                      <>
                        <div>
                          <label className={`text-[11px] font-bold block mb-1 ${secondaryTextClass}`}>
                            Dirección de Entrega <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Calle, Carrera, Edificio, Apto..."
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={`text-[11px] font-bold block mb-1 ${secondaryTextClass}`}>
                            Barrio o Referencias (Opcional)
                          </label>
                          <input
                            type="text"
                            value={deliveryReference}
                            onChange={(e) => setDeliveryReference(e.target.value)}
                            placeholder="Ej. Frente al parque, timbre 201"
                            className={inputClass}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Notas generales del pedido */}
                <div>
                  <label className={`text-[11px] font-bold block mb-1 ${secondaryTextClass}`}>
                    Indicaciones especiales para la cocina (Opcional)
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Ej. Sin cebolla, salsas aparte..."
                    className={inputClass}
                  />
                </div>

                {/* 3. SELECCIÓN DE MÉTODO DE PAGO */}
                <div className={`space-y-2 pt-2 border-t ${dividerClass}`}>
                  <div className="flex items-center justify-between">
                    <label className={`text-[11px] font-bold block ${secondaryTextClass}`}>
                      Método de pago propuesto <span className="text-red-500">*</span>
                    </label>
                    {selectedPayment && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${effectiveAccent}20`,
                          color: effectiveAccent,
                        }}
                      >
                        {selectedPayment.name}
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] ${secondaryTextClass}`}>
                    Elige cómo realizarás el pago. Las transferencias son informativas; la verificación se coordina con el negocio por WhatsApp.
                  </p>

                  {/* Selector dinámico de entidades activas */}
                  <div className={`grid ${availableMethods.length > 2 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"} gap-2 pt-1`}>
                    {availableMethods.map((m) => {
                      const isSelected = selectedPayment.code === m.code;
                      return (
                        <button
                          type="button"
                          key={m.code}
                          onClick={() => setPaymentMethod(m.code)}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: isBrutal ? "#FFD60A" : `${effectiveAccent}18`,
                                  borderColor: isBrutal ? "#111111" : effectiveAccent,
                                  color: isBrutal ? "#111111" : effectiveAccent,
                                }
                              : undefined
                          }
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer min-h-[44px] ${
                            isSelected
                              ? `font-bold ${isBrutal ? "border-2 shadow-[2px_2px_0_#111111]" : "shadow-xs"}`
                              : `${dividerClass} opacity-80 hover:opacity-100 bg-white/5`
                          }`}
                        >
                          <PaymentMethodLogo code={m.code} size="sm" />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold leading-tight block truncate">
                              {m.name}
                            </span>
                            <span className={`text-[9px] leading-tight block truncate ${secondaryTextClass}`}>
                              {m.code === "cash" ? "Contra entrega" : m.category}
                            </span>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: effectiveAccent }} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* DATOS DE COBRO DE LA ENTIDAD SELECCIONADA */}
                  {selectedPayment.code !== "cash" && selectedPayment.destinationValue && (
                    <div
                      className={`mt-2 p-3.5 rounded-xl border text-xs space-y-2.5 transition-all ${
                        isBrutal
                          ? "bg-[#FFFDF0] border-2 border-[#111111] text-[#111111] shadow-[2px_2px_0_#111111]"
                          : isLight
                          ? "bg-slate-50 border-slate-200 text-slate-800"
                          : "bg-white/[0.04] border-white/10 text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                        <div className="flex items-center gap-2">
                          <PaymentMethodLogo code={selectedPayment.code} size="sm" />
                          <div>
                            <span className="font-bold text-xs block leading-tight">{selectedPayment.name}</span>
                            <span className={`text-[10px] block leading-none ${secondaryTextClass}`}>
                              {selectedPayment.code === "bre_b"
                                ? `Llave: ${getDestinationTypeLabel(null, selectedPayment.breBKeyType)}`
                                : getDestinationTypeLabel(selectedPayment.destinationType)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[9px] block uppercase font-semibold ${secondaryTextClass}`}>Total a transferir</span>
                          <span className="text-xs font-black" style={{ color: effectiveAccent }}>
                            {formatPrice(totalAmount)}
                          </span>
                        </div>
                      </div>

                      {/* VALOR DE DESTINO CON BOTÓN DE COPIAR */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${secondaryTextClass}`}>
                            {selectedPayment.code === "bre_b" ? "Llave Bre-B" : "Número de cuenta / celular"}
                          </span>
                          <span className={`text-[10px] ${secondaryTextClass}`}>Toca para copiar</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 font-mono text-xs font-bold truncate select-all">
                            {selectedPayment.destinationValue}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                selectedPayment.destinationValue!,
                                selectedPayment.code === "bre_b" ? "Llave Bre-B" : "Número de cuenta"
                              )
                            }
                            className="px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                            style={{
                              backgroundColor: `${effectiveAccent}15`,
                              borderColor: `${effectiveAccent}40`,
                              color: effectiveAccent,
                            }}
                          >
                            {copiedText === selectedPayment.destinationValue ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>¡Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>{selectedPayment.code === "bre_b" ? "Copiar llave" : "Copiar"}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* BENEFICIARIO */}
                      {selectedPayment.accountHolder && (
                        <div className="text-[11px]">
                          <span className={`font-semibold ${secondaryTextClass}`}>Titular / Beneficiario: </span>
                          <span className="font-bold">{selectedPayment.accountHolder}</span>
                        </div>
                      )}

                      {/* QR OPCIONAL */}
                      {selectedPayment.qrUrl && (
                        <div className="pt-2 border-t border-black/5 dark:border-white/5 flex flex-col items-center gap-1.5">
                          <span className={`text-[10px] uppercase font-semibold ${secondaryTextClass}`}>
                            Código QR de pago
                          </span>
                          <div className="p-2 rounded-xl bg-white border border-slate-200 dark:border-white/20 shadow-xs max-w-[140px]">
                            <img
                              src={selectedPayment.qrUrl}
                              alt={`Código QR ${selectedPayment.name}`}
                              className="w-full h-auto object-contain"
                            />
                          </div>
                          <span className={`text-[9px] ${secondaryTextClass}`}>
                            Escanea desde tu app bancaria
                          </span>
                        </div>
                      )}

                      {/* INSTRUCCIONES */}
                      {selectedPayment.instructions && (
                        <div className="pt-1.5 text-[11px] italic bg-black/[0.02] dark:bg-white/[0.02] p-2 rounded-lg border border-black/5 dark:border-white/5">
                          "{selectedPayment.instructions}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* CASO EFECTIVO */}
                  {selectedPayment.code === "cash" && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <Banknote className="w-4 h-4 shrink-0" />
                      <span>Pago en efectivo al recibir o retirar tu pedido. No requiere transferencia anticipada.</span>
                    </div>
                  )}
                </div>

                {/* 4. LISTA DE PLATOS EN EL CARRITO */}
                <div className={`pt-2 border-t ${dividerClass}`}>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${secondaryTextClass}`}>
                    Productos Seleccionados
                  </label>

                  {items.length === 0 ? (
                    <div className={`text-center py-6 text-xs ${secondaryTextClass}`}>
                      Tu carrito está vacío. Agrega platos para continuar.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between gap-3 p-2.5 rounded-xl ${
                            isBrutal
                              ? "bg-white border-2 border-[#111111]"
                              : isElegante
                              ? "bg-white/[0.03] border border-[#C5A059]/15"
                              : isLight
                              ? "bg-slate-50 border border-slate-200"
                              : "bg-white/[0.04] border border-white/5"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs sm:text-sm truncate">{item.name}</p>
                            {item.variantName && (
                              <span
                                className="text-[11px] font-semibold block truncate"
                                style={{ color: effectiveAccent }}
                              >
                                {item.variantName}
                              </span>
                            )}
                            {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                              <p className={`text-[10px] mt-0.5 truncate ${secondaryTextClass}`}>
                                + {item.selectedModifiers.map((m) => m.optionName).join(", ")}
                              </p>
                            )}
                            <span className={`text-xs font-medium block mt-0.5 ${secondaryTextClass}`}>
                              {formatPrice(item.unitPrice * item.quantity)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              disabled={isSubmitting}
                              className={`w-6 h-6 rounded-md border ${dividerClass} flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer`}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-bold text-xs w-4 text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              disabled={isSubmitting}
                              className={`w-6 h-6 rounded-md border ${dividerClass} flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer del modal con total y BOTÓN ÚNICO DE CONFIRMACIÓN */}
            {!confirmedOrder && (
              <div className={`pt-3 border-t ${dividerClass} shrink-0 space-y-2.5`}>
                <div className="space-y-1 text-xs">
                  <div className={`flex items-center justify-between ${secondaryTextClass}`}>
                    <span>Subtotal de productos:</span>
                    <span className="font-semibold">{formatPrice(subtotalAmount)}</span>
                  </div>
                  {orderType === "delivery" && (
                    <div className={`flex items-center justify-between ${secondaryTextClass}`}>
                      <span>Costo del domicilio:</span>
                      <span className="font-semibold" style={{ color: effectiveAccent }}>
                        {applicableDeliveryFee > 0 ? formatPrice(applicableDeliveryFee) : "Gratis"}
                      </span>
                    </div>
                  )}
                  <div className={`flex items-center justify-between pt-1 border-t ${dividerClass}`}>
                    <span className={`text-xs font-bold ${secondaryTextClass}`}>Total del pedido:</span>
                    <span className="text-base sm:text-lg font-black" style={{ color: effectiveAccent }}>
                      {formatPrice(totalAmount)}
                    </span>
                  </div>
                </div>

                {items.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {/* BOTÓN ÚNICO DE CONFIRMACIÓN: registra la orden en NEGOVA y abre WhatsApp */}
                    <button
                      type="button"
                      onClick={handleConfirmOrder}
                      disabled={isSubmitting || (orderType === "dine_in" && !activeTable)}
                      style={{
                        backgroundColor: effectiveAccent,
                        color: ctaTextColor,
                      }}
                      className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                        isBrutal ? "border-2 border-[#111111] shadow-[3px_3px_0_#111111] active:translate-x-0.5 active:translate-y-0.5" : ""
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Registrando Pedido...</span>
                        </>
                      ) : (
                        <>
                          {orderType === "dine_in" ? (
                            <UtensilsCrossed className="w-4 h-4 shrink-0" />
                          ) : cleanWhatsapp ? (
                            <MessageCircle className="w-4 h-4 fill-current shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                          )}
                          <span>
                            {orderType === "dine_in"
                              ? "Confirmar comanda en mesa"
                              : cleanWhatsapp
                              ? "Confirmar pedido por WhatsApp"
                              : "Confirmar Pedido"}
                          </span>
                        </>
                      )}
                    </button>

                    <p className={`text-[10px] text-center ${secondaryTextClass}`}>
                      {orderType === "dine_in"
                        ? "La comanda se enviará al sistema para ser confirmada por el personal antes de su preparación."
                        : cleanWhatsapp
                        ? "Registra el pedido en el sistema y abre WhatsApp para notificar al negocio."
                        : "Registra tu pedido en el sistema del negocio."}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className={`w-full py-2 rounded-xl text-xs font-bold border ${dividerClass} hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer`}
                  >
                    Ver el Menú
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. BARRA INFERIOR FIJA - BOTÓN ÚNICO "VER CARRITO" */}
      <aside
        aria-label="Barra de pedido"
        className={`${
          isPreview ? "absolute" : "fixed"
        } left-0 right-0 bottom-0 z-30 p-2.5 sm:p-3 backdrop-blur-md`}
        style={{
          backgroundColor: barBackground,
          borderTop: barBorder,
          boxShadow: barShadow,
        }}
      >
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={() => {
              if (totalCount > 0) {
                setIsOpen(true);
              } else {
                toast.info("Agrega platos al carrito para realizar tu pedido");
              }
            }}
            style={{
              backgroundColor: totalCount > 0 ? effectiveAccent : undefined,
              color: totalCount > 0 ? ctaTextColor : undefined,
            }}
            className={`w-full flex items-center justify-between px-4 sm:px-6 py-3 rounded-xl sm:rounded-full font-bold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-md ${
              isBrutal && totalCount > 0
                ? "border-2 border-[#111111] shadow-[3px_3px_0_#111111] active:translate-x-0.5 active:translate-y-0.5"
                : "hover:opacity-95 active:scale-98"
            } ${
              totalCount > 0
                ? "cursor-pointer"
                : "opacity-45 cursor-not-allowed bg-slate-700 text-white"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-black ${
                  isBrutal
                    ? "bg-[#111111] text-white"
                    : isLight
                    ? "bg-slate-900 text-white"
                    : "bg-black/35 text-white"
                }`}
              >
                {totalCount}
              </div>
              <span className="font-black normal-case text-xs sm:text-sm tracking-normal">
                Ver carrito
              </span>
            </div>

            <div className="flex items-center gap-2 font-black text-xs sm:text-sm">
              <span>{formatPrice(totalAmount)}</span>
              <ChevronUp className="w-4 h-4 opacity-75 shrink-0" />
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
