import { GoogleGenAI } from "@google/genai";
import { WhatsAppConversationService } from "./conversation-service";
import { sanitizeLog } from "./security";
import { createRestaurantOrder, getRestaurantOrderWithDetails } from "../restaurant/restaurant-service";
import { CreateRestaurantOrderInput, RestaurantOrderWithDetails } from "../restaurant/types";

export interface CatalogProductSummary {
  id: string;
  name: string;
  price: number;
  description?: string;
  isAvailable: boolean;
  metadata?: Record<string, any>;
}

export interface AiProcessInput {
  businessId: string;
  conversationId: string;
  customerPhone: string;
  incomingText: string;
  businessName?: string;
}

export interface AiProcessResult {
  success: boolean;
  replyText: string;
  messageId?: string;
  createdOrder?: RestaurantOrderWithDetails | null;
  error?: string;
  modelUsed?: string;
}

/**
 * Servicio de Inteligencia Artificial para WhatsApp con acceso al catálogo y POS de NEGOVA.
 * Responsabilidades:
 * 1. Conectar de forma segura con Gemini vía GEMINI_API_KEY sin exponer credenciales.
 * 2. Alimentar el contexto multi-turno con el historial real de la conversación.
 * 3. Restringir estrictamente la oferta comercial a los productos reales del catálogo del comercio (aislamiento tenant).
 * 4. Gestionar intenciones de pedido y ejecutar la creación en el POS con validación de backend.
 * 5. Manejar fallos de red, timeouts, límites de tasa y respuestas no válidas mediante fallbacks controlados.
 */
export class WhatsAppAiService {
  /**
   * Obtiene la lista de productos activos y disponibles para el comercio especificado.
   * Regla de Oro: NUNCA incluye productos de otros comercios.
   */
  static async getCatalogForBusiness(
    supabaseClient: any,
    businessId: string
  ): Promise<CatalogProductSummary[]> {
    try {
      const { data, error } = await supabaseClient
        .from("products")
        .select("id, name, price, description, is_available, status, metadata")
        .eq("business_id", businessId)
        .eq("status", "active")
        .eq("is_available", true)
        .order("name", { ascending: true })
        .limit(50);

      if (error || !data) {
        console.warn(
          `[WhatsAppAiService] Advertencia al consultar catálogo para negocio ${businessId}:`,
          sanitizeLog(error)
        );
        return [];
      }

      return data.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price || 0),
        description: p.description || undefined,
        isAvailable: Boolean(p.is_available),
        metadata: p.metadata || {},
      }));
    } catch (err: any) {
      console.error("[WhatsAppAiService] Error de catálogo:", sanitizeLog(err?.message || err));
      return [];
    }
  }

  /**
   * Formatea el catálogo en texto estructurado y amigable para el system prompt de la IA.
   */
  static formatCatalogPrompt(products: CatalogProductSummary[]): string {
    if (products.length === 0) {
      return "Actualmente el negocio no tiene productos disponibles en el catálogo digital.";
    }

    const formatPrice = (val: number) =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(val);

    return products
      .map((p, idx) => {
        const desc = p.description ? ` (${p.description})` : "";
        return `${idx + 1}. [ID: ${p.id}] ${p.name}: ${formatPrice(p.price)}${desc}`;
      })
      .join("\n");
  }

  /**
   * Ejecuta una llamada directa a Gemini con fallback multi-modelo y protección contra timeouts.
   */
  static async callGemini(
    systemInstruction: string,
    historyMessages: Array<{ role: "user" | "model"; text: string }>,
    userQuery: string,
    options: { timeoutMs?: number; temperature?: number } = {}
  ): Promise<{ success: boolean; text?: string; error?: string; modelUsed?: string }> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim().length <= 5 || apiKey.includes("YOUR_")) {
      return {
        success: false,
        error: "GEMINI_API_KEY_NOT_CONFIGURED",
      };
    }

    const formattedContents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    for (const h of historyMessages) {
      if (h.text && h.text.trim()) {
        formattedContents.push({
          role: h.role,
          parts: [{ text: h.text.trim() }],
        });
      }
    }

    formattedContents.push({
      role: "user",
      parts: [{ text: userQuery.trim() }],
    });

    // Modelos soportados con cuota disponible ordenados por prioridad en Google GenAI SDK
    const candidateModels = [
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
    ];

    try {
      const ai = new GoogleGenAI({ apiKey });

      for (const modelName of candidateModels) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const timeoutMs = options.timeoutMs || 15000;
            const generatePromise = ai.models.generateContent({
              model: modelName,
              config: {
                systemInstruction,
                temperature: options.temperature ?? 0.2,
                maxOutputTokens: 600,
              },
              contents: formattedContents,
            });

            // Envoltura con timeout
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("ETIMEDOUT: Gemini request exceeded timeout")), timeoutMs)
            );

            const response = await Promise.race([generatePromise, timeoutPromise]);

            if (response && response.text && response.text.trim()) {
              return {
                success: true,
                text: response.text.trim(),
                modelUsed: modelName,
              };
            }
          } catch (mErr: any) {
            const errStr = mErr?.message || String(mErr);
            // Si el modelo da 429 (rate limit), aguardar con backoff exponencial y reintentar
            if (errStr.includes("429") && attempt < 2) {
              await new Promise((r) => setTimeout(r, (attempt + 1) * 3500));
              continue;
            }
            break;
          }
        }
      }

      return {
        success: false,
        error: "Todos los modelos de Gemini fallaron o no están disponibles en este momento.",
      };
    } catch (sdkErr: any) {
      return {
        success: false,
        error: sanitizeLog(sdkErr?.message || "Error al inicializar el SDK de Gemini"),
      };
    }
  }

  /**
   * Detecta y extrae la intención de confirmación de pedido a partir del texto de la IA.
   * Busca el bloque estructurado: [ORDEN_CONFIRMADA]{...}[/ORDEN_CONFIRMADA]
   */
  static extractOrderIntent(
    text: string
  ): { cleanText: string; orderData: any | null } {
    const regex = /\[ORDEN_CONFIRMADA\]([\s\S]*?)\[\/ORDEN_CONFIRMADA\]/i;
    const match = text.match(regex);

    if (!match) {
      return { cleanText: text, orderData: null };
    }

    let orderData = null;
    try {
      orderData = JSON.parse(match[1].trim());
    } catch (parseErr) {
      console.warn("[WhatsAppAiService] Error al parsear bloque [ORDEN_CONFIRMADA]:", parseErr);
    }

    const cleanText = text.replace(regex, "").trim();
    return { cleanText, orderData };
  }

  /**
   * Genera y envía la respuesta del Asistente Comercial de WhatsApp.
   * Flujo integral:
   * 1. Consulta contexto de conversación y catálogo del negocio.
   * 2. Envía solicitud a Gemini con instrucciones de negocio y catálogo.
   * 3. Si se confirma un pedido, lo crea en el POS con validación de backend.
   * 4. Persiste el mensaje de respuesta en la base de datos de WhatsApp.
   */
  static async processIncomingMessage(
    supabaseClient: any,
    input: AiProcessInput
  ): Promise<AiProcessResult> {
    const { businessId, conversationId, customerPhone, incomingText, businessName } = input;

    // 1. Obtener historial multi-turno de la conversación
    const history = await WhatsAppConversationService.getConversationHistory(
      supabaseClient,
      businessId,
      conversationId,
      8
    );

    const formattedHistory: Array<{ role: "user" | "model"; text: string }> = [];
    for (const msg of history) {
      if (msg.content) {
        formattedHistory.push({
          role: msg.senderRole === "customer" ? "user" : "model",
          text: msg.content,
        });
      }
    }

    // 2. Obtener catálogo real del comercio
    const catalog = await this.getCatalogForBusiness(supabaseClient, businessId);
    const catalogText = this.formatCatalogPrompt(catalog);

    // 3. Formular prompt del sistema comercial
    const bizDisplayName = businessName || "nuestro restaurante";
    const systemInstruction = `
Eres el Asistente Comercial y de Ventas Oficial de WhatsApp de "${bizDisplayName}".
Tu objetivo es atender amablemente al cliente, responder dudas sobre los productos y tomar pedidos.

REGLAS ESTRICTAS DE NEGOCIO Y CATÁLOGO:
1. Utiliza ÚNICAMENTE los productos y precios listados en el CATÁLOGO OFICIAL abajo.
2. NUNCA inventes productos, ingredientes que no existan ni precios que no figuren en la lista.
3. Si el cliente pregunta por productos que NO están en el catálogo, indícale cordialmente qué sí tenemos disponible.
4. Responde en español colombiano natural, cordial, claro y conciso (estilo chat de WhatsApp).
5. Usa negritas para destacar nombres de productos y precios (ej: **Hamburguesa Clásica**: $20.000).

REGLAS PARA TOMAR PEDIDOS:
- Cuando el cliente indique qué desea, confirma las cantidades y pregúntale si es para entrega a domicilio, para llevar o en mesa.
- Si es para domicilio, solicita la dirección de entrega y nombre del cliente si aún no los ha dado.
- Siempre presenta un resumen claro con productos, cantidades y el cálculo del total antes de confirmar.
- SOLAMENTE cuando el cliente haya dado su confirmación clara y explícita ("sí", "confirmo", "haz el pedido", "pídelo"), incluye al final EXACTAMENTE este bloque estructurado para que el sistema cree la orden en el POS:
[ORDEN_CONFIRMADA]
{
  "orderType": "delivery" o "takeout",
  "customerName": "Nombre del cliente",
  "deliveryAddress": "Dirección completa si es delivery",
  "notes": "Notas u observaciones si las hay",
  "items": [
    { "productId": "ID_EXACTO_DEL_PRODUCTO_DEL_CATALOGO", "quantity": 1 }
  ]
}
[/ORDEN_CONFIRMADA]
- Si el cliente aún no confirma, NO incluyas el bloque [ORDEN_CONFIRMADA].

CATÁLOGO OFICIAL DISPONIBLE:
${catalogText}
`.trim();

    // 4. Invocar a Gemini
    const geminiResult = await this.callGemini(
      systemInstruction,
      formattedHistory,
      incomingText
    );

    let finalReply = "";
    let createdOrder: RestaurantOrderWithDetails | null = null;

    if (geminiResult.success && geminiResult.text) {
      const { cleanText, orderData } = this.extractOrderIntent(geminiResult.text);
      finalReply = cleanText;

      // 5. Si hay intención de pedido confirmada, procesar con el servicio de comandas/POS de NEGOVA
      if (orderData && Array.isArray(orderData.items) && orderData.items.length > 0) {
        try {
          const orderInput: CreateRestaurantOrderInput = {
            orderType: orderData.orderType === "delivery" ? "delivery" : "takeout",
            channelOrigin: "whatsapp",
            customerName: orderData.customerName || "Cliente WhatsApp",
            customerPhone: customerPhone,
            deliveryAddress: orderData.deliveryAddress || (orderData.orderType === "delivery" ? "Por confirmar" : undefined),
            notes: orderData.notes || "Pedido recibido vía WhatsApp IA",
            items: orderData.items.map((it: any) => ({
              productId: it.productId,
              quantity: Math.max(1, Math.floor(it.quantity || 1)),
            })),
            idempotencyKey: `wa_${conversationId}_${Date.now()}`,
          };

          const orderCreationResult = await createRestaurantOrder(businessId, orderInput);

          if (orderCreationResult.success && orderCreationResult.orderId) {
            createdOrder = await getRestaurantOrderWithDetails(businessId, orderCreationResult.orderId);
            if (createdOrder) {
              const formatCOP = (val: number) =>
                new Intl.NumberFormat("es-CO", {
                  style: "currency",
                  currency: "COP",
                  maximumFractionDigits: 0,
                }).format(val);

              // Añadir confirmación con el número real de comanda generado por el POS
              const orderBanner = `\n\n✅ *¡Pedido #${createdOrder.order_number} registrado con éxito en nuestro sistema!*\n` +
                `Total: *${formatCOP(createdOrder.total)}*\n` +
                `Estado: Recibido en cocina. Te notificaremos cuando esté listo.`;
              finalReply += orderBanner;

              // Vincular en metadata de la conversación
              await supabaseClient
                .from("whatsapp_conversations")
                .update({
                  metadata: {
                    last_order_id: createdOrder.id,
                    last_order_number: createdOrder.order_number,
                    last_order_total: createdOrder.total,
                  },
                })
                .eq("id", conversationId)
                .eq("business_id", businessId);
            }
          } else {
            console.warn(
              "[WhatsAppAiService] Falló creación de comanda POS:",
              orderCreationResult.error
            );
            finalReply += `\n\n(Aviso: Hubo un inconveniente al registrar la comanda en cocina: ${orderCreationResult.error}. Un asesor revisará tu pedido de inmediato).`;
          }
        } catch (orderErr: any) {
          console.error("[WhatsAppAiService] Excepción al crear comanda:", orderErr);
        }
      }
    } else {
      // Fallback controlado si Gemini falla o la clave no responde
      console.warn(
        "[WhatsAppAiService] Gemini no generó respuesta:",
        sanitizeLog(geminiResult.error)
      );

      // Respuesta de cortesía fundamentada en el catálogo disponible
      if (catalog.length > 0) {
        finalReply =
          `¡Hola! Gracias por comunicarte con ${bizDisplayName}. ` +
          `En este momento estamos experimentando una alta demanda en nuestro canal automatizado. ` +
          `Tenemos disponible nuestro menú con productos como **${catalog[0].name}** ($${catalog[0].price.toLocaleString("es-CO")}). ` +
          `Por favor indícanos tu pedido o si deseas que un asesor humano te atienda.`;
      } else {
        finalReply =
          `¡Hola! Gracias por comunicarte con ${bizDisplayName}. ` +
          `Un asesor del equipo revisará tu mensaje a la brevedad posible para colaborarte.`;
      }
    }

    // 6. Persistir el mensaje saliente de la IA en la base de datos
    const persistResult = await WhatsAppConversationService.persistOutgoingMessage(
      supabaseClient,
      businessId,
      conversationId,
      {
        content: finalReply,
        senderRole: "ai",
        messageType: "text",
        rawPayload: {
          model_used: geminiResult.modelUsed || "fallback",
          created_order_id: createdOrder?.id || null,
        },
      }
    );

    return {
      success: true,
      replyText: finalReply,
      messageId: persistResult.messageId,
      createdOrder,
      modelUsed: geminiResult.modelUsed,
    };
  }
}
