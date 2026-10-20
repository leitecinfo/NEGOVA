import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { verifyMetaWebhookSignature, timingSafeCompare, sanitizeLog } from "@/lib/whatsapp/security";
import { WhatsAppQueueService } from "@/lib/whatsapp/queue-service";
import { WhatsAppConversationService } from "@/lib/whatsapp/conversation-service";
import { MetaWebhookPayload } from "@/lib/whatsapp/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getServiceDbClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    throw new Error("Credenciales de Supabase no configuradas en el servidor.");
  }

  return createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET: Verificación del Webhook por parte de Meta (Desafío de suscripción)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (!mode || !token || !challenge) {
      return new Response("Parámetros de verificación incompletos", { status: 400 });
    }

    const expectedToken =
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
      process.env.WHATSAPP_VERIFY_TOKEN;

    if (!expectedToken) {
      console.warn(
        "[WhatsApp Webhook GET] WHATSAPP_WEBHOOK_VERIFY_TOKEN no está configurado en las variables de entorno."
      );
      return new Response("Verificación rechazada", { status: 403 });
    }

    if (mode === "subscribe" && timingSafeCompare(token, expectedToken)) {
      // Retornar el challenge de Meta como texto plano tal como exige la documentación oficial
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response("Verificación rechazada", { status: 403 });
  } catch (err: any) {
    console.error("[WhatsApp Webhook GET] Error:", sanitizeLog(err?.message || err));
    return new Response("Error interno", { status: 500 });
  }
}

export const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KiB (524,288 bytes)

export class PayloadTooLargeError extends Error {
  constructor(message = "Payload Too Large: el cuerpo excede el límite permitido de 512KB.") {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export class InvalidContentLengthError extends Error {
  constructor(message = "Cabecera Content-Length inválida.") {
    super(message);
    this.name = "InvalidContentLengthError";
  }
}

export class StreamReadError extends Error {
  constructor(message = "Error durante la lectura del flujo de la solicitud.") {
    super(message);
    this.name = "StreamReadError";
  }
}

/**
 * Lee el cuerpo de la petición HTTP con límite estricto de bytes y corte temprano del flujo (WHK-01).
 * 1. Valida anticipadamente la cabecera Content-Length si está presente (HTTP 413 si excede, HTTP 400 si es inválida).
 * 2. Si req.body expone un ReadableStream, lee por fragmentos (chunks) y suma los bytes reales.
 * 3. En cuanto se superan los 512 KiB, invoca reader.cancel() de inmediato y aborta el procesamiento sin seguir acumulando en memoria.
 * 4. Si el stream no tiene reader, utiliza fallback a req.text() validando la longitud del buffer resultante.
 */
export async function readLimitedBody(
  req: NextRequest,
  maxBytes: number = MAX_PAYLOAD_BYTES
): Promise<Buffer> {
  // 1. Verificación previa de Content-Length
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const trimmed = contentLengthHeader.trim();
    const parsed = Number(trimmed);
    if (!/^\d+$/.test(trimmed) || isNaN(parsed) || parsed < 0) {
      throw new InvalidContentLengthError();
    }
    if (parsed > maxBytes) {
      throw new PayloadTooLargeError(
        `Payload Too Large: el tamaño especificado en Content-Length (${parsed} bytes) excede el límite permitido de ${maxBytes} bytes.`
      );
    }
  }

  // 2. Lectura por flujo (stream) con abort temprano sin buffering excesivo
  if (req.body && typeof req.body.getReader === "function") {
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.byteLength;
          if (receivedBytes > maxBytes) {
            try {
              await reader.cancel("PAYLOAD_TOO_LARGE");
            } catch {
              // Ignorar error al cancelar el reader
            }
            throw new PayloadTooLargeError();
          }
          chunks.push(value);
        }
      }
    } catch (err: any) {
      if (err instanceof PayloadTooLargeError) {
        throw err;
      }
      throw new StreamReadError(err?.message || "Error al leer el flujo de la solicitud");
    }

    if (receivedBytes === 0) {
      return Buffer.alloc(0);
    }

    return Buffer.concat(chunks, receivedBytes);
  }

  // 3. Fallback cuando req.body no expone getReader en el runtime
  let rawText = "";
  try {
    rawText = await req.text();
  } catch (err: any) {
    throw new StreamReadError(err?.message || "Error al leer el cuerpo");
  }

  const buf = Buffer.from(rawText, "utf8");
  if (buf.byteLength > maxBytes) {
    throw new PayloadTooLargeError();
  }
  return buf;
}

/**
 * POST: Ingesta segura de eventos de Meta WhatsApp Business Platform
 * 1. Limita el tamaño del payload a 512KB (HTTP 413) mediante lectura controlada de flujo (WHK-01).
 * 2. Valida la firma HMAC-SHA256 sobre los bytes originales exactos con el App Secret.
 * 3. Valida la estructura del payload JSON.
 * 4. Resuelve el business_id mediante el Phone Number ID previamente verificado.
 * 5. Deduplica y persiste eventos de mensajes y estados (value.statuses - WHK-02) en la cola duradera.
 * 6. Responde HTTP 200 en menos de 1 segundo.
 */
export async function handleWebhookPost(req: NextRequest, customDbClient?: any) {
  try {
    // 1. Obtener cuerpo en bytes con límite estricto de 512 KiB y corte temprano
    let rawBuffer: Buffer;
    try {
      rawBuffer = await readLimitedBody(req, MAX_PAYLOAD_BYTES);
    } catch (err: any) {
      if (err instanceof PayloadTooLargeError) {
        return NextResponse.json(
          { error: err.message },
          { status: 413 }
        );
      }
      if (err instanceof InvalidContentLengthError) {
        return NextResponse.json(
          { error: err.message },
          { status: 400 }
        );
      }
      if (err instanceof StreamReadError) {
        return NextResponse.json(
          { error: err.message },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Error en la lectura del cuerpo de la solicitud" },
        { status: 400 }
      );
    }

    if (rawBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: "Cuerpo de solicitud vacío" },
        { status: 400 }
      );
    }

    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (!appSecret) {
      console.error("[WhatsApp Webhook] WHATSAPP_APP_SECRET no configurado.");
      return NextResponse.json(
        { error: "Configuración de servidor incompleta" },
        { status: 500 }
      );
    }

    // 2. Validación obligatoria de la firma sobre los bytes exactos recibidos (sin re-serializar)
    const isValidSignature = verifyMetaWebhookSignature(rawBuffer, signature, appSecret);
    if (!isValidSignature) {
      console.warn("[WhatsApp Webhook] Firma HMAC inválida o ausente.");
      return NextResponse.json(
        { error: "Firma de webhook no válida" },
        { status: 401 }
      );
    }

    // 3. Parsear JSON y validar estructura
    let payload: MetaWebhookPayload;
    try {
      payload = JSON.parse(rawBuffer.toString("utf8"));
    } catch {
      return NextResponse.json(
        { error: "Cuerpo de solicitud JSON malformado" },
        { status: 400 }
      );
    }

    if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
      return NextResponse.json(
        { error: "Estructura de evento Meta no compatible" },
        { status: 400 }
      );
    }

    const dbClient = customDbClient || getServiceDbClient();
    let totalEnqueued = 0;

    // 5. Procesar entradas y cambios
    for (const entry of payload.entry) {
      if (!Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        if (change.field !== "messages" || !change.value) continue;

        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;

        if (!phoneNumberId) {
          console.warn("[WhatsApp Webhook] Evento sin phone_number_id en metadata.");
          continue;
        }

        // 6. Resolución estricta del negocio por Phone Number ID receptor
        const config = await WhatsAppConversationService.resolveBusinessByPhoneNumberId(
          dbClient,
          phoneNumberId
        );

        if (!config) {
          console.warn(
            `[WhatsApp Webhook] Evento firmado reconocido pero ignorado (cuarentena): Phone Number ID ${phoneNumberId} no está vinculado a ningún negocio activo.`
          );
          // Reconocimiento seguro: Responder 200 para evitar que Meta reintente durante 7 días
          // y deshabilite el webhook de la app, sin procesar ni asociar el evento a ningún negocio.
          continue;
        }

        const businessId = config.businessId;

        // 7. Ingesta de mensajes entrantes si existen
        if (Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            const enqueueResult = await WhatsAppQueueService.enqueue(dbClient, {
              businessId,
              phoneNumberId,
              metaMessageId: msg.id || null,
              senderPhone: msg.from || "",
              eventType: "message",
              payload: msg,
            });

            if (!enqueueResult.success) {
              console.error(
                "[WhatsApp Webhook] Falló persistencia antes de responder:",
                enqueueResult.error
              );
              return NextResponse.json(
                { error: "Error al asegurar la persistencia del evento" },
                { status: 500 }
              );
            }

            totalEnqueued++;
          }
        }

        // 8. Ingesta validada de estados de entrega/lectura (value.statuses - WHK-02)
        // Distingue transiciones (sent, delivered, read) para no descartar estados válidos como duplicados del wamid.
        if (Array.isArray(value.statuses)) {
          for (const statusItem of value.statuses) {
            if (!statusItem.id || !statusItem.status) {
              console.warn(
                "[WhatsApp Webhook] Recibido status de Meta sin wamid o status válido, ignorando:",
                statusItem
              );
              continue;
            }

            const statusDedupKey = `status:${statusItem.id}:${statusItem.status}`;

            const enqueueResult = await WhatsAppQueueService.enqueue(dbClient, {
              businessId,
              phoneNumberId,
              metaMessageId: statusDedupKey,
              senderPhone: statusItem.recipient_id || "",
              eventType: "status",
              payload: statusItem,
            });

            if (!enqueueResult.success) {
              console.error(
                "[WhatsApp Webhook] Falló persistencia de status Meta antes de responder:",
                enqueueResult.error
              );
              return NextResponse.json(
                { error: "Error al asegurar la persistencia del estado" },
                { status: 500 }
              );
            }

            totalEnqueued++;
          }
        }
      }
    }

    // 9. Respuesta inmediata con confirmación de recepción duradera
    return NextResponse.json({
      received: true,
      enqueuedCount: totalEnqueued,
    });
  } catch (err: any) {
    console.error(
      "[WhatsApp Webhook POST] Error no controlado:",
      sanitizeLog(err?.message || err)
    );
    return NextResponse.json(
      { error: "Error interno al procesar webhook" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleWebhookPost(req);
}

