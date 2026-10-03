import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { queryNegovaKnowledge } from "@/lib/negova-knowledge";

const SYSTEM_INSTRUCTION = `
Eres el Asistente de Inteligencia Artificial oficial de NEGOVA.
Tu misión es informar, orientar y resolver dudas sobre NEGOVA a los dueños de pequeños y medianos negocios.

INFORMACIÓN OFICIAL Y CONTROLADA DE NEGOVA:
- NEGOVA es una plataforma web de gestión para pequeños negocios y comercios de barrio.
- Centraliza: Ventas + Inventario + Caja + Productos + Clientes + Reportes.
- Mercado Inicial: Enfocado inicialmente en La Guajira, Colombia.
- Plataforma: Versión Web accesible desde cualquier navegador (PC, laptop, tablet o celular). No hay apps móviles nativas por el momento.
- Eslogan rector: "Tú haces la venta. NEGOVA mantiene todo actualizado."
- Planes y Precios (COP):
  1. Plan Inicio: $29.900 COP/mes (pequeños negocios iniciando organización).
  2. Plan Crecimiento: $59.900 COP/mes (RECOMENDADO - deudas, reportes, mayor control).
  3. Plan Negocio: $99.900 COP/mes (operación amplia o múltiples personas/sedes).
  4. Prueba Gratuita: 30 días del Plan Inicio (gestión inicial con el equipo).

REGLAS DE RESPUESTA Y COMPORTAMIENTO:
1. CRÍTICO - PROHIBIDO SALUDOS REPETITIVOS: NUNCA inicies tus respuestas con "¡Hola! Qué gusto saludarte" ni saludos introductorios si el usuario ya está conversando o si hay historial previo. RESPONDE DIRECTAMENTE a la pregunta del usuario de forma inmediata.
2. Responde de forma clara, directa, sencilla y profesional en español.
3. NUNCA inventes funciones no confirmadas (facturación electrónica DIAN, comandas avanzadas, integraciones bancarias, código de barras, etc.).
4. Si el usuario pregunta por una función o ubicación no confirmada, responde transparentemente: "Esa característica o disponibilidad no está confirmada dentro de la información oficial de NEGOVA. Si deseas, puedes consultar directamente por WhatsApp."
5. Mantén las respuestas concisas (2 a 3 párrafos cortos máximo).
6. Usa viñetas con guiones (- o •) y negritas simples (**texto**) de forma limpia. NUNCA incluyas URLs, enlaces ni asteriscos pegados raros en el cuerpo del texto.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, sessionId, history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "El mensaje es requerido" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Construcción del historial de conversación para la memoria multi-turno de Gemini
    const formattedContents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    if (Array.isArray(history) && history.length > 0) {
      for (const item of history) {
        if (item.text && typeof item.text === "string" && item.text.trim()) {
          formattedContents.push({
            role: item.sender === "user" ? "user" : "model",
            parts: [{ text: item.text.trim() }],
          });
        }
      }
    }

    formattedContents.push({
      role: "user",
      parts: [{ text: message }],
    });

    let responseText = "";
    let suggestedAction: any = undefined;

    if (apiKey && apiKey.trim().length > 5 && !apiKey.includes("YOUR_")) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const modelsToTry = [
          "gemini-3.5-flash-lite",
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-1.5-flash",
        ];

        for (const modelName of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.3,
                maxOutputTokens: 600,
              },
              contents: formattedContents,
            });

            if (response && response.text) {
              responseText = response.text;
              break;
            }
          } catch (mErr) {
            // Intenta el siguiente modelo en la lista si ocurre variación
          }
        }
      } catch (sdkErr) {
        console.error("Error al usar el SDK GoogleGenAI, usando fallback:", sdkErr);
      }
    }

    // Fallback verídico respaldado por la capa de conocimiento de NEGOVA si no respondió Gemini
    if (!responseText) {
      const knowledgeResult = queryNegovaKnowledge(message);
      responseText = knowledgeResult.text;
      suggestedAction = knowledgeResult.suggestedAction;
    }

    // Lógica Inteligente para adjuntar Botón de Acción con PRIORIDAD a Contacto / WhatsApp
    const userMsgLower = message.toLowerCase();
    const responseLower = responseText.toLowerCase();

    const isContactTopic =
      userMsgLower.includes("whatsapp") ||
      userMsgLower.includes("contacto") ||
      userMsgLower.includes("hablar") ||
      userMsgLower.includes("soporte") ||
      userMsgLower.includes("persona") ||
      userMsgLower.includes("humano") ||
      userMsgLower.includes("asesor") ||
      userMsgLower.includes("atencion") ||
      userMsgLower.includes("alguien") ||
      userMsgLower.includes("equipo") ||
      responseLower.includes("whatsapp") ||
      responseLower.includes("escribirnos por whatsapp") ||
      responseLower.includes("comunicarte directamente");

    const isPricingTopic =
      userMsgLower.includes("precio") ||
      userMsgLower.includes("cuanto cuesta") ||
      userMsgLower.includes("plan") ||
      userMsgLower.includes("costo") ||
      userMsgLower.includes("valor") ||
      userMsgLower.includes("tarifa") ||
      userMsgLower.includes("suscripcion") ||
      userMsgLower.includes("prueba");

    if (isContactTopic) {
      suggestedAction = {
        label: "Hablar con NEGOVA por WhatsApp",
        actionType: "whatsapp",
      };
    } else if (isPricingTopic) {
      suggestedAction = {
        label: "Ver planes y precios",
        actionType: "link",
        href: "/#precios",
      };
    }

    return NextResponse.json({
      text: responseText,
      suggestedAction,
    });
  } catch (error) {
    return NextResponse.json(
      {
        text: "Ocurrió un inconveniente procesando el mensaje. Puedes escribirnos por WhatsApp.",
        suggestedAction: {
          label: "Hablar con NEGOVA por WhatsApp",
          actionType: "whatsapp",
        },
      },
      { status: 500 }
    );
  }
}
