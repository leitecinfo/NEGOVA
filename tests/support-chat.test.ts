import { describe, it, expect, vi } from "vitest";
import {
  getOrCreateActiveConversation,
  getConversationMessages,
  sendClientMessage,
  sendAgentMessage,
  convertChatToInteraction,
  convertChatToTicket,
} from "@/lib/support/chat-service";

// Mock Supabase storage
let inMemoryDbConversations: any[] = [];
let inMemoryDbChatMessages: any[] = [];
const mockChatStorage: Record<string, any> = {};

function createChatQueryBuilder(table: string) {
  let targetTable = table === "support_conversations"
    ? inMemoryDbConversations
    : table === "support_chat_messages"
    ? inMemoryDbChatMessages
    : [];
  let filters: Array<(row: any) => boolean> = [];

  const builder: any = {
    select: () => builder,
    eq: (col: string, val: any) => {
      filters.push((row: any) => row[col] === val);
      return builder;
    },
    order: () => builder,
    maybeSingle: async () => {
      let filtered = targetTable.filter((r) => filters.every((f) => f(r)));
      return { data: filtered[0] || null, error: null };
    },
    single: async () => {
      let filtered = targetTable.filter((r) => filters.every((f) => f(r)));
      return { data: filtered[0] || null, error: null };
    },
    then: (resolve: any) => {
      let filtered = targetTable.filter((r) => filters.every((f) => f(r)));
      return Promise.resolve({ data: filtered, error: null }).then(resolve);
    },
    upsert: async (record: any) => {
      const records = Array.isArray(record) ? record : [record];
      for (const r of records) {
        if (table === "support_conversations") {
          const idx = inMemoryDbConversations.findIndex((c) => c.id === r.id);
          if (idx >= 0) inMemoryDbConversations[idx] = { ...inMemoryDbConversations[idx], ...r };
          else inMemoryDbConversations.push({ ...r });
        }
        if (table === "support_chat_messages") {
          const idx = inMemoryDbChatMessages.findIndex((m) => m.id === r.id);
          if (idx >= 0) inMemoryDbChatMessages[idx] = { ...inMemoryDbChatMessages[idx], ...r };
          else inMemoryDbChatMessages.push({ ...r });
        }
        if (table === "platform_settings") {
          mockChatStorage[r.key] = r.value;
        }
      }
      return { data: record, error: null };
    },
    insert: async (record: any) => {
      const records = Array.isArray(record) ? record : [record];
      for (const r of records) {
        if (table === "support_conversations") inMemoryDbConversations.push({ ...r });
        if (table === "support_chat_messages") inMemoryDbChatMessages.push({ ...r });
      }
      return { data: record, error: null };
    },
  };
  return builder;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => createChatQueryBuilder(table),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => createChatQueryBuilder(table),
  }),
}));

vi.mock("@/lib/notifications/notifications-service", () => ({
  createNotification: vi.fn(async () => ({})),
  getNotifications: vi.fn(async () => []),
}));

describe("Chat de Soporte en Tiempo Real e IA de NEGOVA", () => {
  const testBizId = "biz-chat-test-01";
  const testUserId = "user-chat-test-01";

  it("debe crear una conversación activa e inicializar el mensaje de bienvenida de la IA", async () => {
    const conv = await getOrCreateActiveConversation({
      businessId: testBizId,
      businessName: "Panadería La Espiga",
      userId: testUserId,
      userName: "Juan Panadero",
      planId: "crece",
    });

    expect(conv).toBeDefined();
    expect(conv.conversationNumber).toMatch(/^CHT-\d{4}$/);
    expect(conv.status).toBe("active");
    expect(conv.mode).toBe("ai");
    expect(conv.businessId).toBe(testBizId);

    const messages = await getConversationMessages(conv.id);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].senderRole).toBe("ai");
    expect(messages[0].content).toContain("Asistente de Soporte de NEGOVA");
  });

  it("debe procesar un mensaje del cliente y responder mediante la IA", async () => {
    const conv = await getOrCreateActiveConversation({
      businessId: testBizId,
      businessName: "Panadería La Espiga",
      userId: testUserId,
      userName: "Juan Panadero",
      planId: "crece",
    });

    const res = await sendClientMessage(conv.id, "¿Cómo registro una venta en NEGOVA?");

    expect(res.success).toBe(true);
    expect(res.userMessage).toBeDefined();
    expect(res.aiResponse).toBeDefined();
    expect(res.escalatedToHuman).toBe(false);

    const messages = await getConversationMessages(conv.id);
    expect(messages.length).toBeGreaterThanOrEqual(3);
  });

  it("debe detectar palabras clave de escalación y transferir a un agente humano", async () => {
    const conv = await getOrCreateActiveConversation({
      businessId: testBizId,
      businessName: "Panadería La Espiga",
      userId: testUserId,
      userName: "Juan Panadero",
      planId: "crece",
    });

    const res = await sendClientMessage(conv.id, "Necesito hablar con una persona o un asesor humano urgente");

    expect(res.success).toBe(true);
    expect(res.escalatedToHuman).toBe(true);
    expect(res.aiResponse?.content).toMatch(/soporte humano|asesor/i);

    const messages = await getConversationMessages(conv.id);
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg.senderRole).toBe("ai");
  });

  it("debe permitir que un agente humano responda y asuma la conversación", async () => {
    const conv = await getOrCreateActiveConversation({
      businessId: testBizId,
      businessName: "Panadería La Espiga",
      userId: testUserId,
      userName: "Juan Panadero",
      planId: "crece",
    });

    const res = await sendAgentMessage(conv.id, "agent-admin-01", "Soporte NEGOVA", "Hola Juan, te asisto con gusto.");

    expect(res.success).toBe(true);
    expect(res.agentMessage?.senderRole).toBe("agent");
    expect(res.agentMessage?.senderName).toBe("Soporte NEGOVA");

    const messages = await getConversationMessages(conv.id);
    expect(messages.some((m) => m.senderRole === "agent")).toBe(true);
  });

  it("debe formalizar un chat en una Atención (ATN) sin perder el historial de mensajes", async () => {
    const conv = await getOrCreateActiveConversation({
      businessId: testBizId,
      businessName: "Panadería La Espiga",
      userId: testUserId,
      userName: "Juan Panadero",
      planId: "crece",
    });

    const initialMessagesCount = (await getConversationMessages(conv.id)).length;

    const res = await convertChatToInteraction(conv.id, {
      category: "usage_inquiry",
      subject: "Orientación sobre arqueo",
      summary: "Se explicó el cierre de caja",
      outcome: "resolved_immediately",
      agentUserId: "agent-admin-01",
      agentName: "Soporte NEGOVA",
    });

    expect(res.success).toBe(true);
    expect(res.interactionNumber).toMatch(/^ATN-\d{4}$/);

    const postMessages = await getConversationMessages(conv.id);
    // El historial creció con el mensaje de sistema pero NUNCA se destruyó
    expect(postMessages.length).toBeGreaterThan(initialMessagesCount);
    expect(postMessages.some((m) => m.senderRole === "system" && m.content.includes(res.interactionNumber!))).toBe(true);
  });

  it("debe escalar un chat a un Ticket (TCK) sin perder el historial de mensajes", async () => {
    const conv = await getOrCreateActiveConversation({
      businessId: testBizId,
      businessName: "Panadería La Espiga",
      userId: testUserId,
      userName: "Juan Panadero",
      planId: "crece",
    });

    const res = await convertChatToTicket(conv.id, {
      category: "technical",
      priority: "high",
      subject: "Falla al imprimir reporte",
      description: "El usuario reporta error al generar reporte mensual",
      internalNotes: "Revisar logs del tenant",
      agentUserId: "agent-admin-01",
      agentName: "Soporte NEGOVA",
    });

    expect(res.success).toBe(true);
    expect(res.ticketNumber).toMatch(/^TCK-\d{4}$/);

    const postMessages = await getConversationMessages(conv.id);
    expect(postMessages.some((m) => m.senderRole === "system" && m.content.includes(res.ticketNumber!))).toBe(true);
  });
});
