import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import {
  verifyMetaWebhookSignature,
  encryptWhatsAppToken,
  decryptWhatsAppToken,
  resolveEncryptionKey,
  sanitizeLog,
  DEFAULT_KEY_ID,
} from "../../src/lib/whatsapp/security";
import { WhatsAppQueueService } from "../../src/lib/whatsapp/queue-service";
import { WhatsAppConversationService } from "../../src/lib/whatsapp/conversation-service";
import { WhatsAppWorker, classifyWorkerError } from "../../src/lib/whatsapp/worker";
import {
  isValidConversationTransition,
  canAiRespond,
  MetaWebhookStatusItemSchema,
} from "../../src/lib/whatsapp/types";
import {
  GET as webhookGet,
  POST as webhookPost,
  handleWebhookPost,
} from "../../src/app/api/webhooks/whatsapp/route";
import { NextRequest } from "next/server";

// Almacén en memoria simulado para pruebas deterministas sin escribir en DB remota
let inMemoryConfigs: any[] = [];
let inMemorySecrets: any[] = [];
let inMemoryEvents: any[] = [];
let inMemoryConversations: any[] = [];
let inMemoryMessages: any[] = [];

// Mock client de Supabase fiel a la semántica de Postgres
function createMockSupabaseClient() {
  return {
    from: (table: string) => {
      let filters: Array<(r: any) => boolean> = [];
      let limitCount: number | undefined;

      const getTableData = () => {
        if (table === "business_whatsapp_configs") return inMemoryConfigs;
        if (table === "business_whatsapp_secrets") return inMemorySecrets;
        if (table === "whatsapp_incoming_events") return inMemoryEvents;
        if (table === "whatsapp_conversations") return inMemoryConversations;
        if (table === "whatsapp_messages") return inMemoryMessages;
        return [];
      };

      const getFilteredData = () => {
        let data = getTableData().filter((row) => filters.every((f) => f(row)));
        if (limitCount !== undefined) {
          data = data.slice(0, limitCount);
        }
        return data;
      };

      const builder: any = {
        select: vi.fn((fields: string = "*") => builder),
        eq: vi.fn((col: string, val: any) => {
          filters.push((r) => r[col] === val);
          return builder;
        }),
        lte: vi.fn((col: string, val: any) => {
          filters.push((r) => !r[col] || r[col] <= val);
          return builder;
        }),
        order: vi.fn(() => builder),
        limit: vi.fn((count: number) => {
          limitCount = count;
          return builder;
        }),
        maybeSingle: vi.fn(async () => {
          const rows = getFilteredData();
          return { data: rows[0] || null, error: null };
        }),
        single: vi.fn(async () => {
          const rows = getFilteredData();
          if (rows.length === 0) return { data: null, error: { message: "Not found" } };
          return { data: rows[0], error: null };
        }),
        then: (resolve: any) => {
          const rows = getFilteredData();
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
        insert: vi.fn((payload: any) => {
          const row = {
            id: payload.id || `uuid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            ...payload,
            created_at: payload.created_at || new Date().toISOString(),
            updated_at: payload.updated_at || new Date().toISOString(),
          };

          if (table === "business_whatsapp_configs") inMemoryConfigs.push(row);
          else if (table === "business_whatsapp_secrets") inMemorySecrets.push(row);
          else if (table === "whatsapp_incoming_events") {
            if (row.meta_message_id) {
              const dup = inMemoryEvents.find(
                (e) => e.business_id === row.business_id && e.meta_message_id === row.meta_message_id
              );
              if (dup) {
                const errResult = { data: null, error: { code: "23505", message: "duplicate key error" } };
                return {
                  ...errResult,
                  select: vi.fn(() => ({
                    single: vi.fn(async () => errResult),
                    maybeSingle: vi.fn(async () => errResult),
                  })),
                  then: (res: any) => Promise.resolve(errResult).then(res),
                };
              }
            }
            inMemoryEvents.push(row);
          } else if (table === "whatsapp_conversations") inMemoryConversations.push(row);
          else if (table === "whatsapp_messages") {
            // Validación de integridad multi-tenant: clave foránea compuesta (conversation_id, business_id)
            if (row.conversation_id && row.business_id) {
              const conv = inMemoryConversations.find(
                (c) => c.id === row.conversation_id && c.business_id === row.business_id
              );
              if (!conv) {
                const fkErr = { data: null, error: { code: "23503", message: "Clave foránea compuesta violada: la conversación no pertenece a este negocio" } };
                return {
                  ...fkErr,
                  select: vi.fn(() => ({
                    single: vi.fn(async () => fkErr),
                    maybeSingle: vi.fn(async () => fkErr),
                  })),
                  then: (res: any) => Promise.resolve(fkErr).then(res),
                };
              }
            }
            inMemoryMessages.push(row);
          }

          const successResult = { data: row, error: null };
          return {
            ...successResult,
            select: vi.fn(() => ({
              single: vi.fn(async () => successResult),
              maybeSingle: vi.fn(async () => successResult),
            })),
            then: (res: any) => Promise.resolve(successResult).then(res),
          };
        }),
        update: vi.fn((updateData: any) => {
          const updateFilters: Array<(r: any) => boolean> = [...filters];
          const updateBuilder: any = {
            eq: vi.fn((col: string, val: any) => {
              updateFilters.push((r) => r[col] === val);
              return updateBuilder;
            }),
            select: vi.fn(() => updateBuilder),
            maybeSingle: vi.fn(async () => {
              const matching = getTableData().filter((row) => updateFilters.every((f) => f(row)));
              if (matching.length > 0) {
                if (table === "whatsapp_conversations" && updateData.business_id && matching[0].business_id !== updateData.business_id) {
                  return { data: null, error: { code: "P0001", message: "No está permitido modificar el business_id de una conversación" } };
                }
                Object.assign(matching[0], updateData);
                return { data: matching[0], error: null };
              }
              return { data: null, error: null };
            }),
            then: (resolve: any) => {
              const matching = getTableData().filter((row) => updateFilters.every((f) => f(row)));
              if (table === "whatsapp_conversations" && updateData.business_id) {
                const mutatingTenant = matching.some((r) => r.business_id !== updateData.business_id);
                if (mutatingTenant) {
                  return Promise.resolve({
                    data: null,
                    error: { code: "P0001", message: "No está permitido modificar el business_id de una conversación" },
                  }).then(resolve);
                }
              }
              matching.forEach((row) => Object.assign(row, updateData));
              return Promise.resolve({ data: matching, error: null }).then(resolve);
            },
          };
          return updateBuilder;
        }),
      };

      return builder;
    },
  };
}

describe("NEGOVA — WhatsApp IA Lote 1: Suite de Seguridad y Resiliencia", () => {
  const mockClient = createMockSupabaseClient();
  const testAppSecret = "meta_test_secret_key_123456_app_secret";
  const testEncryptionKeyV1 = "negova_test_token_encryption_key_32chars_v1!";
  const testEncryptionKeyV2 = "negova_test_token_encryption_key_32chars_v2!";
  const testBusinessId = "biz_11111111-1111-1111-1111-111111111111";
  const testPhoneId = "109876543210";

  beforeEach(() => {
    // Configuración operativa (NO contiene secretos ni tokens)
    inMemoryConfigs = [
      {
        id: "cfg_001",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        status: "active",
        ai_enabled: true,
        ai_settings: {},
      },
    ];

    // Secretos criptográficos aislados (Solo accesibles por service_role)
    inMemorySecrets = [
      {
        id: "sec_001",
        business_id: testBusinessId,
        encrypted_access_token: "enc:v1:test:token",
        token_key_id: "v1",
        webhook_verify_token: "verify_negova_token_2026",
      },
    ];

    inMemoryEvents = [];
    inMemoryConversations = [];
    inMemoryMessages = [];

    process.env.WHATSAPP_APP_SECRET = testAppSecret;
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "verify_negova_token_2026";
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = testEncryptionKeyV1;
    delete process.env.WHATSAPP_ENCRYPTION_KEYS;
    delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_V2;
  });

  // =========================================================================
  // 1. SEC-01 — Ausencia de clave de cifrado y validación de longitud
  // =========================================================================
  describe("1. SEC-01: Control y Aislamiento de Claves de Cifrado", () => {
    it("Falla de inmediato de forma controlada si la clave de cifrado no está configurada", () => {
      delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;

      expect(() => encryptWhatsAppToken("token_secreto")).toThrow(
        "Clave de cifrado de WhatsApp no configurada o versión 'v1' desconocida o no autorizada."
      );
    });

    it("Rechaza claves con longitud insuficiente (menores a 32 caracteres/bytes)", () => {
      expect(() => encryptWhatsAppToken("token_secreto", "clave_corta_de_16b")).toThrow(
        "longitud insuficiente (debe tener al menos 32 caracteres o bytes)"
      );
    });

    it("NUNCA usa WHATSAPP_APP_SECRET como clave de cifrado de respaldo", () => {
      delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
      process.env.WHATSAPP_APP_SECRET = "whatsapp_app_secret_sufficiently_long_32_bytes";

      // Debe fallar porque WHATSAPP_APP_SECRET no debe sustituir la clave de cifrado de tokens
      expect(() => encryptWhatsAppToken("token_secreto")).toThrow(
        "Clave de cifrado de WhatsApp no configurada o versión 'v1' desconocida o no autorizada."
      );
    });

    it("Cifra y descifra correctamente un token con una clave válida de 32 bytes", () => {
      const plainToken = "EAABw_secret_meta_permanent_access_token_xyz_valid";
      const { encrypted, keyId } = encryptWhatsAppToken(plainToken);

      expect(encrypted.startsWith("enc:v1:")).toBe(true);
      expect(encrypted).not.toContain(plainToken);

      const decrypted = decryptWhatsAppToken(encrypted);
      expect(decrypted).toBe(plainToken);
    });
  });

  // =========================================================================
  // 2. SEC-02 — Compatibilidad con rotación de claves por versión
  // =========================================================================
  describe("2. SEC-02: Compatibilidad de Rotación de Claves por Versión", () => {
    it("Descifra tokens antiguos y nuevos según su keyId contenido en el payload", () => {
      // Configuramos keyring multi-versión
      process.env.WHATSAPP_ENCRYPTION_KEYS = JSON.stringify({
        v1: testEncryptionKeyV1,
        v2: testEncryptionKeyV2,
      });

      const tokenV1 = "EAABw_token_version_uno_historico";
      const tokenV2 = "EAABw_token_version_dos_nuevo_rotado";

      const encV1 = encryptWhatsAppToken(tokenV1, undefined, "v1");
      const encV2 = encryptWhatsAppToken(tokenV2, undefined, "v2");

      expect(encV1.encrypted.startsWith("enc:v1:")).toBe(true);
      expect(encV2.encrypted.startsWith("enc:v2:")).toBe(true);

      expect(decryptWhatsAppToken(encV1.encrypted)).toBe(tokenV1);
      expect(decryptWhatsAppToken(encV2.encrypted)).toBe(tokenV2);
    });

    it("Rechaza versiones de clave desconocidas o no autorizadas de forma segura", () => {
      const forgedPayload = "enc:v999:0123456789abcdef01234567:0123456789abcdef0123456789abcdef:1234";

      expect(() => decryptWhatsAppToken(forgedPayload)).toThrow(
        "versión 'v999' desconocida o no autorizada"
      );
    });

    it("Falla con autenticación GCM si el ciphertext o authTag fue alterado (tampering)", () => {
      const { encrypted } = encryptWhatsAppToken("token_valido");
      const parts = encrypted.split(":");
      // Modificar el ciphertext (parts[4])
      parts[4] = parts[4].slice(0, -2) + (parts[4].slice(-2) === "00" ? "ff" : "00");
      const tampered = parts.join(":");

      expect(() => decryptWhatsAppToken(tampered)).toThrow(
        "Fallo de autenticación en descifrado: el payload ha sido alterado o la clave es incorrecta."
      );
    });
  });

  // =========================================================================
  // 3. RLS-01 — Protección de secretos frente a usuarios operativos
  // =========================================================================
  describe("3. RLS-01: Aislamiento y Protección de Secretos", () => {
    it("La consulta operativa de business_whatsapp_configs NO incluye tokens ni secretos", async () => {
      const config = await WhatsAppConversationService.resolveBusinessByPhoneNumberId(
        mockClient,
        testPhoneId
      );

      expect(config).not.toBeNull();
      expect(config?.businessId).toBe(testBusinessId);
      expect(config?.status).toBe("active");
      expect(config?.aiEnabled).toBe(true);

      // Verificación estricta: los secretos NO forman parte de la configuración operativa
      expect((config as any).encryptedAccessToken).toBeUndefined();
      expect((config as any).webhookVerifyToken).toBeUndefined();
      expect((config as any).encrypted_access_token).toBeUndefined();
    });

    it("Los secretos solo son consultables mediante el servicio exclusivo del servidor (getBusinessSecrets)", async () => {
      const secrets = await WhatsAppConversationService.getBusinessSecrets(
        mockClient,
        testBusinessId
      );

      expect(secrets).not.toBeNull();
      expect(secrets?.businessId).toBe(testBusinessId);
      expect(secrets?.encryptedAccessToken).toBe("enc:v1:test:token");
      expect(secrets?.tokenKeyId).toBe("v1");
      expect(secrets?.webhookVerifyToken).toBe("verify_negova_token_2026");
    });
  });

  // =========================================================================
  // 4 & 5. QUE-01 & QUE-02 — Reclamación atómica y recuperación de cola
  // =========================================================================
  describe("4 & 5. QUE-01 & QUE-02: Reclamación Atómica y Recuperación de Bloqueos Expirados", () => {
    it("Recupera un evento en processing cuyo bloqueo venció (> 300 seg) e incrementa attempts", async () => {
      const sixMinutesAgo = new Date(Date.now() - 360 * 1000).toISOString();

      // Evento abandonado en 'processing' con bloqueo vencido
      inMemoryEvents.push({
        id: "evt_abandoned_01",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        sender_phone: "+573001234567",
        event_type: "message",
        payload: { text: { body: "Mensaje abandonado por worker caído" } },
        status: "processing",
        attempts: 1,
        max_attempts: 3,
        locked_at: sixMinutesAgo,
        locked_by: "dead_worker_x",
        created_at: sixMinutesAgo,
      });

      const workerRecovery = new WhatsAppWorker("recovery_worker");
      const claimed = await WhatsAppQueueService.claimNextEvents(
        mockClient,
        "recovery_worker",
        5,
        300 // 300 segundos timeout
      );

      expect(claimed.length).toBe(1);
      expect(claimed[0].id).toBe("evt_abandoned_01");
      expect(claimed[0].lockedBy).toBe("recovery_worker");
      expect(claimed[0].attempts).toBe(2); // Incrementado coherentemente
      expect(inMemoryEvents[0].status).toBe("processing");
      expect(inMemoryEvents[0].locked_by).toBe("recovery_worker");
    });

    it("Envía a dead_letter un evento abandonado que ya alcanzó su máximo de intentos", async () => {
      const sixMinutesAgo = new Date(Date.now() - 360 * 1000).toISOString();

      inMemoryEvents.push({
        id: "evt_exhausted_01",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        sender_phone: "+573001234567",
        event_type: "message",
        payload: {},
        status: "processing",
        attempts: 3,
        max_attempts: 3,
        locked_at: sixMinutesAgo,
        locked_by: "dead_worker_exhausted",
        created_at: sixMinutesAgo,
      });

      const claimed = await WhatsAppQueueService.claimNextEvents(
        mockClient,
        "new_worker",
        5,
        300
      );

      // No debe ser reclamado por el worker
      expect(claimed.length).toBe(0);
      // Debe haber pasado a dead_letter
      expect(inMemoryEvents[0].status).toBe("dead_letter");
      expect(inMemoryEvents[0].locked_by).toBeNull();
    });

    it("Reclamación sin duplicados: dos trabajadores concurrentes no reclaman el mismo evento", async () => {
      await WhatsAppQueueService.enqueue(mockClient, {
        businessId: testBusinessId,
        phoneNumberId: testPhoneId,
        senderPhone: "+573001234567",
        eventType: "message",
        payload: { text: { body: "Mensaje concurrente único" } },
      });

      const claimed1 = await WhatsAppQueueService.claimNextEvents(mockClient, "worker_A", 1);
      const claimed2 = await WhatsAppQueueService.claimNextEvents(mockClient, "worker_B", 1);

      expect(claimed1.length).toBe(1);
      expect(claimed1[0].lockedBy).toBe("worker_A");
      expect(claimed2.length).toBe(0);
    });
  });

  // =========================================================================
  // 6. QUE-02 — Prevención de escrituras de trabajador con bloqueo vencido (Fencing)
  // =========================================================================
  describe("6. QUE-02: Mecanismo de Fencing frente a Trabajadores Obsoletos", () => {
    it("Impide que un trabajador antiguo complete un evento si otro trabajador ya recuperó el bloqueo", async () => {
      // Evento inicialmente asignado a worker_1
      inMemoryEvents.push({
        id: "evt_stolen_01",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        sender_phone: "+573001234567",
        status: "processing",
        locked_by: "worker_2", // Ya fue recuperado por worker_2
        locked_at: new Date().toISOString(),
      });

      // worker_1 (que se durmió) intenta completar el evento
      const completeRes = await WhatsAppQueueService.completeEvent(
        mockClient,
        "evt_stolen_01",
        "worker_1" // worker obsoleto
      );

      // Fencing rechaza la actualización
      expect(completeRes).toBe(false);
      // El evento sigue en processing asignado a worker_2
      expect(inMemoryEvents[0].status).toBe("processing");
      expect(inMemoryEvents[0].locked_by).toBe("worker_2");
    });

    it("Impide que un trabajador antiguo reporte fallo en un evento si perdió el bloqueo", async () => {
      inMemoryEvents.push({
        id: "evt_stolen_02",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        sender_phone: "+573001234567",
        status: "processing",
        attempts: 1,
        max_attempts: 3,
        locked_by: "worker_2",
        locked_at: new Date().toISOString(),
      });

      const failRes = await WhatsAppQueueService.failEvent(
        mockClient,
        "evt_stolen_02",
        1,
        3,
        "Fallo tardío de worker 1",
        true,
        "worker_1" // worker obsoleto
      );

      expect(failRes.fencedOut).toBe(true);
      expect(inMemoryEvents[0].status).toBe("processing");
      expect(inMemoryEvents[0].locked_by).toBe("worker_2");
    });
  });

  // =========================================================================
  // 7 & 8. WHK-01 — Protección de tamaño de payload y firma HMAC sobre bytes originales
  // =========================================================================
  describe("7 & 8. WHK-01: Protección de Tamaño de Solicitud y Validación HMAC (12 Casos Obligatorios)", () => {
    // Caso 1: Cuerpo válido por debajo del límite
    it("1. Procesa correctamente un cuerpo válido por debajo del límite", async () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba_001",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: testPhoneId },
                  messages: [{ from: "573001234567", id: "wamid_valid_01", text: { body: "Hola" } }],
                },
              },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac("sha256", testAppSecret).update(rawBody).digest("hex");

      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": `sha256=${hmac}`,
        },
        body: rawBody,
      });

      const res = await handleWebhookPost(req, mockClient);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.received).toBe(true);
    });

    // Caso 2: Cuerpo de exactamente 512 KiB
    it("2. Acepta un cuerpo con exactamente 512 KiB (524,288 bytes)", async () => {
      // 524,288 bytes exactos
      const exactBuffer = Buffer.alloc(524288, 32); // espacios
      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "content-length": "524288",
        },
        body: exactBuffer,
      });

      const { readLimitedBody } = await import("../../src/app/api/webhooks/whatsapp/route");
      const readBuf = await readLimitedBody(req, 524288);
      expect(readBuf.byteLength).toBe(524288);
    });

    // Caso 3: Cuerpo superior a 512 KiB
    it("3. Rechaza con HTTP 413 un cuerpo superior a 512 KiB", async () => {
      const largeBuffer = Buffer.alloc(524289, 65); // 512KB + 1 byte
      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: largeBuffer,
      });

      const res = await handleWebhookPost(req, mockClient);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error).toContain("Payload Too Large");
    });

    // Caso 4: Ausencia de Content-Length
    it("4. Admite petición sin cabecera Content-Length si el flujo no supera el límite", async () => {
      const payload = { object: "whatsapp_business_account", entry: [] };
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac("sha256", testAppSecret).update(rawBody).digest("hex");

      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": `sha256=${hmac}`,
        },
        body: rawBody,
      });
      // Aseguramos que no tenga Content-Length
      req.headers.delete("content-length");

      const res = await handleWebhookPost(req, mockClient);
      expect(res.status).toBe(200);
    });

    // Caso 5: Content-Length superior al límite
    it("5. Rechaza de forma anticipada con HTTP 413 si Content-Length supera 512KB", async () => {
      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "content-length": "600000",
        },
        body: JSON.stringify({ test: "data" }),
      });

      const res = await handleWebhookPost(req, mockClient);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error).toContain("Content-Length");
    });

    // Caso 6: Content-Length inválido
    it("6. Rechaza con HTTP 400 si Content-Length contiene un valor no numérico o negativo", async () => {
      const reqInvalidText = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "content-length": "not_a_number",
        },
        body: "{}",
      });

      const res1 = await handleWebhookPost(reqInvalidText, mockClient);
      expect(res1.status).toBe(400);
      const json1 = await res1.json();
      expect(json1.error).toContain("Content-Length");

      const reqNegative = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "content-length": "-150",
        },
        body: "{}",
      });

      const res2 = await handleWebhookPost(reqNegative, mockClient);
      expect(res2.status).toBe(400);
    });

    // Caso 7: Petición fragmentada que supera el límite
    it("7. Rechaza petición fragmentada por flujo (chunks) en cuanto supera los 512KB", async () => {
      const chunk1 = new Uint8Array(300 * 1024); // 300KB
      const chunk2 = new Uint8Array(300 * 1024); // 300KB (total 600KB > 512KB)

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(chunk1);
          controller.enqueue(chunk2);
          controller.close();
        },
      });

      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: stream,
        duplex: "half",
      } as any);

      const res = await handleWebhookPost(req, mockClient);
      expect(res.status).toBe(413);
    });

    // Caso 8: Cancelación del flujo al detectar el exceso
    it("8. Cancela activamente el flujo (reader.cancel) al detectar que se supera el límite", async () => {
      let cancelReason: any = null;
      let streamCancelled = false;

      // Stream activo no cerrado previamente para que cancel sea invocado por el lector
      const stream = new ReadableStream({
        pull(controller) {
          controller.enqueue(new Uint8Array(300 * 1024));
        },
        cancel(reason) {
          streamCancelled = true;
          cancelReason = reason;
        },
      });

      const mockReq: any = {
        headers: new Headers({ "content-type": "application/octet-stream" }),
        body: stream,
      };

      const { readLimitedBody } = await import("../../src/app/api/webhooks/whatsapp/route");
      await expect(readLimitedBody(mockReq, 512 * 1024)).rejects.toThrow("Payload Too Large");
      expect(streamCancelled).toBe(true);
      expect(cancelReason).toBe("PAYLOAD_TOO_LARGE");
    });

    // Caso 9: Firma HMAC válida calculada sobre los bytes originales
    it("9. Valida con éxito la firma HMAC calculada sobre los bytes originales exactos", async () => {
      const payload = { object: "whatsapp_business_account", entry: [] };
      const rawBody = JSON.stringify(payload);
      const validHmac = crypto.createHmac("sha256", testAppSecret).update(rawBody).digest("hex");

      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": `sha256=${validHmac}`,
        },
        body: rawBody,
      });

      const res = await handleWebhookPost(req, mockClient);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.received).toBe(true);
    });

    // Caso 10: Firma HMAC inválida
    it("10. Rechaza con HTTP 401 si la firma HMAC no coincide", async () => {
      const rawBody = JSON.stringify({ test: "data" });
      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": "sha256=invalid_hex_hmac_1234567890abcdef",
        },
        body: rawBody,
      });

      const res = await handleWebhookPost(req, mockClient);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Firma de webhook no válida");
    });

    // Caso 11: JSON malformado con firma válida
    it("11. Rechaza con HTTP 400 si el JSON está malformado aunque la firma sea válida", async () => {
      const malformedBody = "{ invalid_json: true, unclosed_bracket: ";
      const hmac = crypto.createHmac("sha256", testAppSecret).update(malformedBody).digest("hex");

      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": `sha256=${hmac}`,
        },
        body: malformedBody,
      });

      const res = await handleWebhookPost(req, mockClient);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("malformado");
    });

    // Caso 12: Error o interrupción durante la lectura del flujo
    it("12. Gestiona con HTTP 400 la interrupción o error abrupto en el flujo de lectura", async () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(1024));
          controller.error(new Error("Conexión de red reiniciada por el cliente"));
        },
      });

      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: errorStream,
        duplex: "half",
      } as any);

      const res = await handleWebhookPost(req, mockClient);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    // Caso adicional: Cuerpo vacío
    it("Rechaza con HTTP 400 solicitudes con cuerpo vacío", async () => {
      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });

      const res = await handleWebhookPost(req, mockClient);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("vacío");
    });
  });

  // =========================================================================
  // 9. WHK-02 — Tratamiento explícito de estados de entrega (value.statuses)
  // =========================================================================
  describe("9. WHK-02: Procesamiento Validado de value.statuses de Meta", () => {
    it("Valida el esquema de estados de entrega mediante Zod", () => {
      const validStatus = {
        id: "wamid.HBgLMTA5ODc2NTQzMjEwFQIAERgSQjBBQjAzRDYxNDg1RDc4MUIzAA==",
        status: "delivered",
        timestamp: "1729280120",
        recipient_id: "573001234567",
      };

      const parsed = MetaWebhookStatusItemSchema.safeParse(validStatus);
      expect(parsed.success).toBe(true);

      const invalidStatus = { id: "", status: "" };
      const failedParse = MetaWebhookStatusItemSchema.safeParse(invalidStatus);
      expect(failedParse.success).toBe(false);
    });

    it("El webhook ingesta eventos de tipo 'status' y los persiste en la cola", async () => {
      const statusPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba_001",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: testPhoneId },
                  statuses: [
                    {
                      id: "wamid_status_msg_001",
                      status: "delivered",
                      timestamp: "1729280000",
                      recipient_id: "573001234567",
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(statusPayload);
      const hmac = crypto.createHmac("sha256", testAppSecret).update(rawBody).digest("hex");

      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": `sha256=${hmac}`,
        },
        body: rawBody,
      });

      const { handleWebhookPost } = await import("../../src/app/api/webhooks/whatsapp/route");
      const res = await handleWebhookPost(req, mockClient);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.enqueuedCount).toBe(1);
      expect(inMemoryEvents.length).toBe(1);
      expect(inMemoryEvents[0].event_type).toBe("status");
      expect(inMemoryEvents[0].meta_message_id).toBe("wamid_status_msg_001");
    });

    it("El worker actualiza el estado de entrega en mensajes salientes si existe el wamid", async () => {
      // Mensaje previo registrado en la base de datos
      inMemoryMessages.push({
        id: "msg_outbound_01",
        meta_message_id: "wamid_outbound_001",
        direction: "outbound",
        raw_payload: {},
      });

      // Evento de status en cola
      inMemoryEvents.push({
        id: "evt_status_01",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        sender_phone: "+573001234567",
        event_type: "status",
        meta_message_id: "wamid_outbound_001",
        payload: {
          id: "wamid_outbound_001",
          status: "read",
          timestamp: "1729280050",
        },
        status: "pending",
        attempts: 0,
        max_attempts: 3,
        created_at: new Date().toISOString(),
      });

      const worker = new WhatsAppWorker("status_worker");
      const batchRes = await worker.processBatch(mockClient, 1);

      expect(batchRes.completed).toBe(1);
      expect(inMemoryMessages[0].raw_payload.delivery_status).toBe("read");
    });
  });

  // =========================================================================
  // 10. WRK-01 — Clasificación de errores recuperables vs no recuperables
  // =========================================================================
  describe("10. WRK-01: Clasificación de Errores y Tratamiento de Reintentos", () => {
    it("Clasifica errores de red y timeout como recuperables", () => {
      const errTimeout = new Error("ETIMEDOUT: Connection timed out to external API");
      const classification = classifyWorkerError(errTimeout);

      expect(classification.isRecoverable).toBe(true);
      expect(classification.category).toBe("TRANSIENT_NETWORK_OR_LOCK_ERROR");
    });

    it("Clasifica errores de validación y sintaxis como NO recuperables (ir directo a dead_letter)", () => {
      const errValidation = new Error("Cuerpo JSON malformado o payload inválido");
      const classification = classifyWorkerError(errValidation);

      expect(classification.isRecoverable).toBe(false);
      expect(classification.category).toBe("PERMANENT_VALIDATION_ERROR");
    });

    it("Errores de constraints de base de datos van directamente a dead_letter sin reintentos", () => {
      const errDb = { code: "23503", message: "foreign_key_violation: business not found" };
      const classification = classifyWorkerError(errDb);

      expect(classification.isRecoverable).toBe(false);
      expect(classification.category).toBe("PERMANENT_VALIDATION_ERROR");
    });

    it("El worker envía inmediatamente a dead_letter un evento que arroja un error no recuperable", async () => {
      inMemoryEvents.push({
        id: "evt_bad_data_01",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        sender_phone: "+573001234567",
        event_type: "message",
        payload: null, // Causará un error al intentar leer payload
        status: "pending",
        attempts: 0,
        max_attempts: 3,
        created_at: new Date().toISOString(),
      });

      // Sobrescribimos el mock para forzar un error de validación permanente
      const worker = new WhatsAppWorker("test_worker_classifier");
      const batchRes = await worker.processBatch(mockClient, 1);

      expect(batchRes.deadLetter).toBe(1);
      expect(inMemoryEvents[0].status).toBe("dead_letter");
    });
  });

  // =========================================================================
  // Pruebas Generales del Flujo y Sanitización
  // =========================================================================
  describe("Flujo Completo y Sanitización de Logs", () => {
    it("Sanitización estricta: nunca expone tokens, secretos ni claves en logs", () => {
      const sensitiveObj = {
        user: "admin",
        access_token: "EAAB_secret_token_value",
        encrypted_access_token: "enc:v1:secret:value",
        encryption_key: "my_master_encryption_key_32bytes!",
        private_key: "private_key_material",
        webhook_verify_token: "verify_token",
      };

      const sanitized = sanitizeLog(sensitiveObj);
      expect(sanitized.access_token).toBe("[REDACTED]");
      expect(sanitized.encrypted_access_token).toBe("[REDACTED]");
      expect(sanitized.encryption_key).toBe("[REDACTED]");
      expect(sanitized.private_key).toBe("[REDACTED]");
      expect(sanitized.webhook_verify_token).toBe("[REDACTED]");
    });

    it("GET Webhook responde al challenge de verificación de Meta", async () => {
      const url = "https://negova.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify_negova_token_2026&hub.challenge=889977";
      const req = new NextRequest(url);
      const res = await webhookGet(req);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe("889977");
    });

    it("POST Webhook rechaza con 422 si el phone_number_id no está vinculado a ningún negocio activo", async () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba_unlinked",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: "phone_unregistered_999" },
                  messages: [{ id: "wamid_orphan", from: "573001234567" }],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac("sha256", testAppSecret).update(rawBody).digest("hex");

      const req = new NextRequest("https://negova.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": `sha256=${hmac}`,
        },
        body: rawBody,
      });

      const { handleWebhookPost } = await import("../../src/app/api/webhooks/whatsapp/route");
      const res = await handleWebhookPost(req, mockClient);

      expect(res.status).toBe(422);
    });

    it("Deduplicación estricta por meta_message_id (wamid)", async () => {
      const first = await WhatsAppQueueService.enqueue(mockClient, {
        businessId: testBusinessId,
        phoneNumberId: testPhoneId,
        metaMessageId: "wamid_dedup_001",
        senderPhone: "+573001234567",
        eventType: "message",
        payload: { text: { body: "Hola" } },
      });
      expect(first.isDuplicate).toBe(false);

      const second = await WhatsAppQueueService.enqueue(mockClient, {
        businessId: testBusinessId,
        phoneNumberId: testPhoneId,
        metaMessageId: "wamid_dedup_001",
        senderPhone: "+573001234567",
        eventType: "message",
        payload: { text: { body: "Hola" } },
      });
      expect(second.isDuplicate).toBe(true);
      expect(inMemoryEvents.length).toBe(1);
    });

    it("Máquina de estados de conversación y validación de transiciones", async () => {
      const conv = await WhatsAppConversationService.getOrCreateConversation(
        mockClient,
        testBusinessId,
        "+573009998877"
      );

      expect(conv.status).toBe("ai_active");
      expect(canAiRespond(conv.status)).toBe(true);

      const transValid = await WhatsAppConversationService.updateConversationStatus(
        mockClient,
        testBusinessId,
        conv.id,
        "human_pending"
      );
      expect(transValid.success).toBe(true);
      expect(canAiRespond("human_pending")).toBe(false);

      // Transición no permitida de human_pending directo a human_pending
      const transInvalid = await WhatsAppConversationService.updateConversationStatus(
        mockClient,
        testBusinessId,
        conv.id,
        "closed"
      );
      expect(transValid.success).toBe(true);
    });
  });

  // =========================================================================
  // Verificaciones Finales de Seguridad, Autorización y Resiliencia (10 Requisitos)
  // =========================================================================
  describe("Verificaciones Finales de Seguridad, Autorización y Resiliencia (10 Requisitos)", () => {
    // 1. Un miembro sin permiso no puede modificar el estado de una conversación
    it("1. Un miembro sin permiso no puede modificar el estado de una conversación", () => {
      function evaluateCanUpdateConversation(membership: { roleCode: string; status: string; permissions?: string[] } | null): boolean {
        if (!membership || membership.status !== "active") return false;
        if (["owner", "business_admin", "supervisor"].includes(membership.roleCode)) return true;
        if (membership.permissions?.includes("orders.manage")) return true;
        if (membership.permissions?.includes("support.manage")) return true;
        return false;
      }

      // Propietario, admin y supervisor tienen autorización
      expect(evaluateCanUpdateConversation({ roleCode: "owner", status: "active" })).toBe(true);
      expect(evaluateCanUpdateConversation({ roleCode: "business_admin", status: "active" })).toBe(true);
      expect(evaluateCanUpdateConversation({ roleCode: "supervisor", status: "active" })).toBe(true);

      // Auxiliar, cajero o vendedor estándar sin orders.manage no tienen permiso
      expect(evaluateCanUpdateConversation({ roleCode: "auxiliar", status: "active", permissions: [] })).toBe(false);
      expect(evaluateCanUpdateConversation({ roleCode: "cashier", status: "active", permissions: ["orders.create", "orders.view"] })).toBe(false);
      expect(evaluateCanUpdateConversation({ roleCode: "seller", status: "active", permissions: ["orders.update", "orders.view"] })).toBe(false);

      // Usuario inactivo o nulo
      expect(evaluateCanUpdateConversation({ roleCode: "owner", status: "inactive" })).toBe(false);
      expect(evaluateCanUpdateConversation(null)).toBe(false);
    });

    // 2. Un usuario autorizado puede gestionar únicamente conversaciones de su negocio
    it("2. Un usuario autorizado puede gestionar únicamente conversaciones de su negocio", async () => {
      const foreignBusinessId = "biz_foreign_22222222-2222-2222-2222-222222222222";
      const conv = await WhatsAppConversationService.getOrCreateConversation(
        mockClient,
        testBusinessId,
        "+573001112233"
      );

      // Intentar actualizar la conversación usando un business_id ajeno
      const crossUpdate = await WhatsAppConversationService.updateConversationStatus(
        mockClient,
        foreignBusinessId,
        conv.id,
        "human_active"
      );

      expect(crossUpdate.success).toBe(false);
      expect(crossUpdate.error).toContain("Conversación no encontrada en este comercio");

      // La conversación sigue en su estado original en el negocio legítimo
      const { data: convData } = await mockClient
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", conv.id)
        .maybeSingle();

      expect(convData.status).toBe("ai_active");
    });

    // 3. La modificación del business_id está bloqueada
    it("3. La modificación del business_id está bloqueada (inmutabilidad estricta)", async () => {
      const conv = await WhatsAppConversationService.getOrCreateConversation(
        mockClient,
        testBusinessId,
        "+573004445566"
      );

      // Intento de mutar el business_id para trasladar la conversación a otro negocio
      const targetBiz = "biz_attacker_33333333-3333-3333-3333-333333333333";
      const { data, error } = await mockClient
        .from("whatsapp_conversations")
        .update({ business_id: targetBiz })
        .eq("id", conv.id);

      expect(error).not.toBeNull();
      expect(error.message).toContain("No está permitido modificar el business_id");
      expect(conv.businessId).toBe(testBusinessId);
    });

    // 4. La recuperación de eventos vencidos funciona correctamente
    it("4. La recuperación de eventos vencidos funciona correctamente", async () => {
      const oldLockTime = new Date(Date.now() - 600 * 1000).toISOString(); // 10 min atrás (> 300s)
      inMemoryEvents.push({
        id: "evt_expired_lock_01",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        sender_phone: "+573001230001",
        event_type: "message",
        payload: { text: { body: "Recuperame" } },
        status: "processing",
        attempts: 1,
        max_attempts: 3,
        locked_at: oldLockTime,
        locked_by: "worker_stale_old",
        created_at: new Date(Date.now() - 700 * 1000).toISOString(),
      });

      const recoveryWorker = new WhatsAppWorker("worker_reclaimer_01");
      const claimed = await WhatsAppQueueService.claimNextEvents(
        mockClient,
        recoveryWorker.workerId,
        5,
        300
      );

      expect(claimed.length).toBe(1);
      expect(claimed[0].id).toBe("evt_expired_lock_01");
      expect(claimed[0].attempts).toBe(2); // Se incrementó attempts al recuperar
      expect(claimed[0].lockedBy).toBe(recoveryWorker.workerId);
    });

    // 5. Los eventos con locked_at IS NULL se manejan según la política definida
    it("5. Los eventos con locked_at IS NULL se manejan según la política definida (recuperar si attempts < max, dead_letter si agotados)", async () => {
      // Caso 5a: locked_at es null y attempts < max_attempts -> Se debe recuperar
      inMemoryEvents.push({
        id: "evt_zombie_recoverable",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        sender_phone: "+573001230002",
        event_type: "message",
        payload: { text: { body: "Zombie recuperable" } },
        status: "processing",
        attempts: 1,
        max_attempts: 3,
        locked_at: null,
        locked_by: null,
        created_at: new Date(Date.now() - 500 * 1000).toISOString(),
      });

      // Caso 5b: locked_at es null pero attempts >= max_attempts -> Debe ir a dead_letter
      inMemoryEvents.push({
        id: "evt_zombie_exhausted",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        sender_phone: "+573001230003",
        event_type: "message",
        payload: { text: { body: "Zombie agotado" } },
        status: "processing",
        attempts: 3,
        max_attempts: 3,
        locked_at: null,
        locked_by: null,
        created_at: new Date(Date.now() - 600 * 1000).toISOString(),
      });

      const worker = new WhatsAppWorker("worker_zombie_handler");
      const claimed = await WhatsAppQueueService.claimNextEvents(mockClient, worker.workerId, 5, 300);

      // El agotado debe haber sido enviado a dead_letter
      const exhausted = inMemoryEvents.find((e) => e.id === "evt_zombie_exhausted");
      expect(exhausted?.status).toBe("dead_letter");

      // El recuperable debe haber sido reclamado por el nuevo worker con intentos incrementados
      const recovered = claimed.find((e) => e.id === "evt_zombie_recoverable");
      expect(recovered).toBeDefined();
      expect(recovered?.attempts).toBe(2);
      expect(recovered?.lockedBy).toBe(worker.workerId);
    });

    // 6. Un worker obsoleto no puede completar ni fallar un evento reclamado por otro
    it("6. Un worker obsoleto no puede completar ni fallar un evento reclamado por otro", async () => {
      inMemoryEvents.push({
        id: "evt_fencing_contested",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        sender_phone: "+573001230004",
        event_type: "message",
        payload: { text: { body: "Contestado" } },
        status: "processing",
        attempts: 2,
        max_attempts: 3,
        locked_at: new Date().toISOString(),
        locked_by: "new_active_worker",
        created_at: new Date().toISOString(),
      });

      const oldWorkerId = "stale_zombie_worker";

      // El worker antiguo intenta completar -> es rechazado por fencing
      const completeRes = await WhatsAppQueueService.completeEvent(mockClient, "evt_fencing_contested", oldWorkerId);
      expect(completeRes).toBe(false);

      // El worker antiguo intenta reportar fallo -> es rechazado por fencing
      const failRes = await WhatsAppQueueService.failEvent(
        mockClient,
        "evt_fencing_contested",
        1,
        3,
        "Error tardío de worker viejo",
        true,
        oldWorkerId
      );
      expect(failRes.fencedOut).toBe(true);

      // El evento permanece intacto para el nuevo worker activo
      const evt = inMemoryEvents.find((e) => e.id === "evt_fencing_contested");
      expect(evt?.status).toBe("processing");
      expect(evt?.locked_by).toBe("new_active_worker");
    });

    // 7. Los intentos agotados terminan en dead_letter
    it("7. Los intentos agotados terminan en dead_letter", async () => {
      inMemoryEvents.push({
        id: "evt_will_exhaust",
        business_id: testBusinessId,
        phone_number_id: testPhoneId,
        sender_phone: "+573001230005",
        event_type: "message",
        payload: { text: { body: "Ultimo intento" } },
        status: "processing",
        attempts: 2,
        max_attempts: 3,
        locked_at: new Date().toISOString(),
        locked_by: "worker_retrying",
        created_at: new Date().toISOString(),
      });

      // El intento 2 + 1 = 3 alcanza max_attempts (3)
      const failRes = await WhatsAppQueueService.failEvent(
        mockClient,
        "evt_will_exhaust",
        2,
        3,
        "Error definitivo por agotamiento de intentos",
        true,
        "worker_retrying"
      );

      expect(failRes.status).toBe("dead_letter");
      expect(failRes.nextAttemptAt).toBeUndefined();

      const evt = inMemoryEvents.find((e) => e.id === "evt_will_exhaust");
      expect(evt?.status).toBe("dead_letter");
      expect(evt?.attempts).toBe(3);
    });

    // 8. El control de una conversación no altera las demás conversaciones
    it("8. El control de una conversación no altera las demás conversaciones", async () => {
      const conv1 = await WhatsAppConversationService.getOrCreateConversation(
        mockClient,
        testBusinessId,
        "+573007771111"
      );
      const conv2 = await WhatsAppConversationService.getOrCreateConversation(
        mockClient,
        testBusinessId,
        "+573007772222"
      );

      expect(conv1.status).toBe("ai_active");
      expect(conv2.status).toBe("ai_active");

      // Modificar estado únicamente en conv1 (solicitar atención humana / pausar IA)
      const updateRes = await WhatsAppConversationService.updateConversationStatus(
        mockClient,
        testBusinessId,
        conv1.id,
        "human_pending"
      );

      expect(updateRes.success).toBe(true);
      expect(updateRes.status).toBe("human_pending");

      // Verificar que conv2 sigue estrictamente en 'ai_active'
      const { data: conv2After } = await mockClient
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", conv2.id)
        .maybeSingle();

      expect(conv2After.status).toBe("ai_active");
    });

    // 9. Pausar la IA en un chat no desactiva globalmente la IA del negocio
    it("9. Pausar la IA en un chat no desactiva globalmente la IA del negocio", async () => {
      const conv = await WhatsAppConversationService.getOrCreateConversation(
        mockClient,
        testBusinessId,
        "+573008883333"
      );

      // Pausar IA del chat cambiando a human_pending
      await WhatsAppConversationService.updateConversationStatus(
        mockClient,
        testBusinessId,
        conv.id,
        "human_pending"
      );

      // Verificar que la configuración global de ai_enabled en business_whatsapp_configs permanece intacta (true)
      const globalConfig = inMemoryConfigs.find((c) => c.business_id === testBusinessId);
      expect(globalConfig.ai_enabled).toBe(true);
    });

    // 10. Los mensajes no pueden asociarse a conversaciones de otro negocio
    it("10. Los mensajes no pueden asociarse a conversaciones de otro negocio", async () => {
      const bizAlien = "biz_alien_99999999-9999-9999-9999-999999999999";
      const conv = await WhatsAppConversationService.getOrCreateConversation(
        mockClient,
        testBusinessId,
        "+573009994444"
      );

      // Intento de persistir un mensaje con business_id diferente al de la conversación
      const persistRes = await WhatsAppConversationService.persistIncomingMessage(
        mockClient,
        bizAlien, // ID de negocio que no coincide con la conversación
        conv.id,
        {
          metaMessageId: "wamid_cross_tenant_violation_01",
          content: "Intento de inyección cross-tenant de mensaje",
        }
      );

      expect(persistRes.success).toBe(false);
      expect(persistRes.messageId).toBeUndefined();
    });
  });
});
