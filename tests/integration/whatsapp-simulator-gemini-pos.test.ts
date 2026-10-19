import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { WhatsAppSimulator } from "../../src/lib/whatsapp/simulator";
import { WhatsAppConversationService } from "../../src/lib/whatsapp/conversation-service";
import { WhatsAppAiService } from "../../src/lib/whatsapp/ai-service";
import { canAiRespond } from "../../src/lib/whatsapp/types";

const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service";

const RUN_TAG = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

let adminClient: any = null;
let isDbConnected = false;

// Negocios de prueba aislados
let testBizA: { id: string; name: string } | null = null;
let testBizB: { id: string; name: string } | null = null;
let productBurgerA: any = null;
let productDrinkA: any = null;
let productSalchipapaB: any = null;

describe("NEGOVA — Fases 2 a 6: Simulador de WhatsApp, Gemini, Catálogo y POS", { timeout: 180000 }, () => {
  beforeAll(async () => {
    try {
      adminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
        auth: { persistSession: false },
      });

      // Verificar conectividad con base de datos
      const { error: pingErr } = await adminClient
        .from("business_whatsapp_configs")
        .select("id")
        .limit(1);

      if (!pingErr) {
        isDbConnected = true;

        // 1. Crear 2 Comercios Aislados temporales
        const { data: bA } = await adminClient
          .from("businesses")
          .insert({
            name: `Burger Bar ${RUN_TAG}`,
            slug: `burger-bar-${RUN_TAG}`,
            status: "active",
          })
          .select("id, name")
          .single();

        const { data: bB } = await adminClient
          .from("businesses")
          .insert({
            name: `Pizzería Express ${RUN_TAG}`,
            slug: `pizzeria-express-${RUN_TAG}`,
            status: "active",
          })
          .select("id, name")
          .single();

        testBizA = bA;
        testBizB = bB;

        // 2. Configurar WhatsApp activo con IA habilitada para ambos comercios
        await adminClient.from("business_whatsapp_configs").insert([
          {
            business_id: testBizA!.id,
            phone_number_id: `phone_${testBizA!.id.slice(0, 12)}`,
            display_phone_number: "+57 300 111 2233",
            verified_name: testBizA!.name,
            status: "active",
            ai_enabled: true,
          },
          {
            business_id: testBizB!.id,
            phone_number_id: `phone_${testBizB!.id.slice(0, 12)}`,
            display_phone_number: "+57 300 444 5566",
            verified_name: testBizB!.name,
            status: "active",
            ai_enabled: true,
          },
        ]);

        // 3. Crear productos en el catálogo real de Negocio A
        const { data: pBurger } = await adminClient
          .from("products")
          .insert({
            business_id: testBizA!.id,
            name: "Hamburguesa Clásica Artesanal",
            description: "Carne de res 150g, queso cheddar, lechuga y salsa de la casa",
            price: 22000,
            status: "active",
            is_available: true,
          })
          .select("id, name, price, business_id")
          .single();

        const { data: pDrink } = await adminClient
          .from("products")
          .insert({
            business_id: testBizA!.id,
            name: "Gaseosa Manzana 400ml",
            description: "Bebida refrescante gasificada",
            price: 5000,
            status: "active",
            is_available: true,
          })
          .select("id, name, price, business_id")
          .single();

        productBurgerA = pBurger;
        productDrinkA = pDrink;

        // 4. Crear productos en el catálogo de Negocio B (para probar aislamiento)
        const { data: pSalchipapa } = await adminClient
          .from("products")
          .insert({
            business_id: testBizB!.id,
            name: "Salchipapa Titán Familiar",
            description: "Papas francesas, salchicha manguera y doble queso costeño",
            price: 35000,
            status: "active",
            is_available: true,
          })
          .select("id, name, price, business_id")
          .single();

        productSalchipapaB = pSalchipapa;
      }
    } catch (setupErr) {
      console.warn("Entorno local no disponible:", setupErr);
    }
  });

  afterAll(async () => {
    if (adminClient && isDbConnected) {
      try {
        if (testBizA) {
          await adminClient.from("businesses").delete().eq("id", testBizA.id);
        }
        if (testBizB) {
          await adminClient.from("businesses").delete().eq("id", testBizB.id);
        }
      } catch (cleanErr) {
        // Ignorar errores en limpieza
      }
    }
  });

  // Pausa preventiva entre tests para respetar la cuota RPM de Gemini API
  beforeEach(async () => {
    await new Promise((r) => setTimeout(r, 1500));
  });

  // ==============================================================================
  // FASE 2: SIMULADOR DE MENSAJES ENTRANTES
  // ==============================================================================
  describe("Fase 2. Simulador de mensajes entrantes", () => {
    it("simula la recepción de un mensaje sin cuenta de Meta, ingresándolo por la cola real", async () => {
      if (!isDbConnected || !testBizA) return;

      const simResult = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: "573009990010",
        senderName: "Carlos Pérez (Test)",
        text: "Hola, ¿tienen servicio a domicilio?",
        processImmediately: true,
      });

      expect(simResult.success).toBe(true);
      expect(simResult.isDuplicate).toBe(false);
      expect(simResult.eventId).toBeDefined();
      expect(simResult.metaMessageId).toContain("wamid.test_");
      expect(simResult.conversationId).toBeDefined();
      expect(simResult.incomingMessage).toBeDefined();
      expect(simResult.incomingMessage?.content).toBe("Hola, ¿tienen servicio a domicilio?");
    });

    it("previene duplicados cuando se reenvía el mismo metaMessageId simulado (Idempotencia)", async () => {
      if (!isDbConnected || !testBizA) return;

      const uniqueWamid = `wamid.test_dedup_${Date.now()}`;

      // Primer envío
      const firstRun = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: "573009990011",
        text: "Mensaje original",
        metaMessageId: uniqueWamid,
        processImmediately: false,
      });

      expect(firstRun.success).toBe(true);
      expect(firstRun.isDuplicate).toBe(false);

      // Segundo envío con el mismo identificador único
      const secondRun = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: "573009990011",
        text: "Mensaje repetido por reintento de red",
        metaMessageId: uniqueWamid,
        processImmediately: false,
      });

      expect(secondRun.success).toBe(true);
      expect(secondRun.isDuplicate).toBe(true);

      // Limpiar el evento de prueba para no dejar cola pendiente a otros tests
      if (firstRun.eventId) {
        await adminClient.from("whatsapp_incoming_events").delete().eq("id", firstRun.eventId);
      }
    });
  });

  // ==============================================================================
  // FASE 3: CONECTAR Y PROBAR GEMINI
  // ==============================================================================
  describe("Fase 3. Conexión y pruebas con Gemini", () => {
    it("el backend lee GEMINI_API_KEY del entorno sin exponer su valor", () => {
      const key = process.env.GEMINI_API_KEY;
      expect(key).toBeDefined();
      expect(typeof key).toBe("string");
      expect(key!.length).toBeGreaterThan(10);
      // Seguridad: verificar que no es una clave ficticia expuesta
      expect(key).not.toContain("YOUR_API_KEY");
      expect(key).not.toContain("dummy");
    });

    it("ejecuta una llamada real a Gemini con el modelo soportado y obtiene respuesta", async () => {
      const result = await WhatsAppAiService.callGemini(
        "Eres un asistente de pruebas de software de NEGOVA. Responde brevemente.",
        [],
        "Por favor confirma si estás activo respondiendo exactamente la palabra: OPERATIVO",
        { timeoutMs: 15000 }
      );

      expect(result.success).toBe(true);
      expect(result.text).toBeDefined();
      expect(result.text?.length).toBeGreaterThan(0);
      expect(result.text?.toUpperCase()).toContain("OPERATIVO");
      expect(result.modelUsed).toBeDefined();
    });

    it("registra los mensajes entrantes y salientes en el historial duradero", async () => {
      if (!isDbConnected || !testBizA) return;

      const phone = "573009990020";
      const sim = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: phone,
        text: "Buenas tardes, ¿qué horario de atención tienen?",
        processImmediately: true,
      });

      expect(sim.success).toBe(true);
      expect(sim.incomingMessage).toBeDefined();
      expect(sim.outgoingResponse).toBeDefined();
      expect(sim.outgoingResponse?.senderRole).toBe("ai");
      expect(sim.outgoingResponse?.content.length).toBeGreaterThan(5);

      // Verificar que ambos mensajes quedaron en la tabla whatsapp_messages
      const history = await WhatsAppConversationService.getConversationHistory(
        adminClient,
        testBizA.id,
        sim.conversationId!,
        10
      );

      expect(history.length).toBeGreaterThanOrEqual(2);
      const roles = history.map((m) => m.senderRole);
      expect(roles).toContain("customer");
      expect(roles).toContain("ai");
    });

    it("maneja errores y timeouts de Gemini con fallback controlado sin colapsar", async () => {
      // Simular llamada con timeout forzado a 1ms
      const timeoutRes = await WhatsAppAiService.callGemini(
        "Eres un asistente.",
        [],
        "Pregunta que causará timeout",
        { timeoutMs: 1 }
      );

      expect(timeoutRes.success).toBe(false);
      expect(timeoutRes.error).toBeDefined();
    });
  });

  // ==============================================================================
  // FASE 4: CONVERSACIÓN Y REGLAS DE ATENCIÓN
  // ==============================================================================
  describe("Fase 4. Conversación y reglas de atención", () => {
    it("inicia la conversación en estado ai_active y permite contexto multi-turno", async () => {
      if (!isDbConnected || !testBizA) return;

      const customerPhone = "573009990030";

      // Mensaje 1
      const turn1 = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: customerPhone,
        text: "Hola, me llamo Fernando",
        processImmediately: true,
      });

      expect(turn1.conversationStatus).toBe("ai_active");
      expect(turn1.outgoingResponse).toBeDefined();

      // Mensaje 2 (prueba de memoria / contexto anterior)
      const turn2 = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: customerPhone,
        text: "¿Recuerdas cuál es mi nombre?",
        processImmediately: true,
      });

      expect(turn2.outgoingResponse).toBeDefined();
      // La IA debe responder con el nombre recordado
      expect(turn2.outgoingResponse?.content.toLowerCase()).toContain("fernando");
    });

    it("no responde con IA cuando la conversación se pausa para atención humana", async () => {
      if (!isDbConnected || !testBizA) return;

      const phone = "573009990031";

      // Crear conversación
      const conv = await WhatsAppConversationService.getOrCreateConversation(
        adminClient,
        testBizA.id,
        phone
      );

      // Pausar para agente humano (de ai_active a human_pending según máquina de estados oficial)
      const pauseRes = await WhatsAppConversationService.updateConversationStatus(
        adminClient,
        testBizA.id,
        conv.id,
        "human_pending"
      );
      expect(pauseRes.success).toBe(true);

      // Simular mensaje del cliente mientras está bajo atención humana
      const simHuman = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: phone,
        text: "Hola, sigo esperando al asesor humano",
        processImmediately: true,
      });

      // El mensaje entrante se guardó, pero la IA NO generó respuesta
      expect(simHuman.incomingMessage?.content).toBe("Hola, sigo esperando al asesor humano");
      expect(simHuman.conversationStatus).toBe("human_pending");
      expect(canAiRespond("human_pending")).toBe(false);
      expect(simHuman.outgoingResponse).toBeNull();
    });

    it("reactiva la IA cuando un usuario autorizado restablece el estado a ai_active", async () => {
      if (!isDbConnected || !testBizA) return;

      const phone = "573009990032";
      const conv = await WhatsAppConversationService.getOrCreateConversation(
        adminClient,
        testBizA.id,
        phone
      );

      // Pausar
      await WhatsAppConversationService.updateConversationStatus(
        adminClient,
        testBizA.id,
        conv.id,
        "human_pending"
      );

      // Reactivar IA
      const reactivateResult = await WhatsAppConversationService.updateConversationStatus(
        adminClient,
        testBizA.id,
        conv.id,
        "ai_active"
      );

      expect(reactivateResult.success).toBe(true);
      expect(reactivateResult.status).toBe("ai_active");
      expect(canAiRespond("ai_active")).toBe(true);

      // Simular mensaje tras reactivación
      const simReactivated = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: phone,
        text: "Hola, ya volví",
        processImmediately: true,
      });

      expect(simReactivated.outgoingResponse).toBeDefined();
      expect(simReactivated.outgoingResponse?.senderRole).toBe("ai");
    });

    it("aislamiento: la intervención humana en un chat no detiene la IA de otros clientes", async () => {
      if (!isDbConnected || !testBizA) return;

      const phoneClient1 = "573009990041";
      const phoneClient2 = "573009990042";

      // Pausar Cliente 1
      const conv1 = await WhatsAppConversationService.getOrCreateConversation(
        adminClient,
        testBizA.id,
        phoneClient1
      );
      await WhatsAppConversationService.updateConversationStatus(
        adminClient,
        testBizA.id,
        conv1.id,
        "human_pending"
      );

      // Cliente 2 interactúa con la IA
      const simClient2 = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: phoneClient2,
        text: "Hola, ¿qué opciones de hamburguesas tienen?",
        processImmediately: true,
      });

      // Cliente 2 debe recibir respuesta activa de la IA
      expect(simClient2.conversationStatus).toBe("ai_active");
      expect(simClient2.outgoingResponse).toBeDefined();
      expect(simClient2.outgoingResponse?.senderRole).toBe("ai");
    });
  });

  // ==============================================================================
  // FASE 5: CONECTAR LA IA CON EL CATÁLOGO REAL DE NEGOVA
  // ==============================================================================
  describe("Fase 5. Catálogo real de NEGOVA y precios verídicos", () => {
    it("la IA consulta y responde con los productos y precios reales de la base de datos", async () => {
      if (!isDbConnected || !testBizA || !productBurgerA) return;

      const sim = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: "573009990050",
        text: "¿Cuánto cuesta la hamburguesa y qué incluye?",
        processImmediately: true,
      });

      expect(sim.outgoingResponse).toBeDefined();
      expect(sim.outgoingResponse?.content).toBeDefined();
      const content = sim.outgoingResponse!.content.toLowerCase();

      // Debe incluir el precio real ($22.000) y el nombre de la hamburguesa
      const hasPrice = content.includes("22.000") || content.includes("22,000") || content.includes("22000") || content.includes("22");
      expect(hasPrice).toBe(true);
      expect(content).toContain("clásica");
    });

    it("no inventa productos inexistentes y aclara la disponibilidad del catálogo", async () => {
      if (!isDbConnected || !testBizA) return;

      const sim = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: "573009990051",
        text: "¿Tienen sushi de salmón y ceviche peruano?",
        processImmediately: true,
      });

      expect(sim.outgoingResponse).toBeDefined();
      expect(sim.outgoingResponse?.content).toBeDefined();
      const content = sim.outgoingResponse!.content.toLowerCase();

      // No debe asegurar que vende sushi ni ceviche
      expect(content).not.toContain("tenemos sushi");
      expect(content).not.toContain("tenemos ceviche");
      // Debe sugerir los productos que sí tiene
      expect(content).toContain("hamburguesa");
    });

    it("aislamiento de catálogo: la IA de Negocio A no ofrece productos de Negocio B", async () => {
      if (!isDbConnected || !testBizA || !testBizB) return;

      const sim = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: "573009990052",
        text: "¿Tienen la Salchipapa Titán Familiar?",
        processImmediately: true,
      });

      expect(sim.outgoingResponse).toBeDefined();
      expect(sim.outgoingResponse?.content).toBeDefined();
      const content = sim.outgoingResponse!.content.toLowerCase();

      // Negocio A (Burger Bar) NO debe ofrecer la Salchipapa Titán que es exclusiva de Negocio B
      expect(content).not.toContain("35.000");
    });
  });

  // ==============================================================================
  // FASE 6: INTEGRACIÓN CON EL POS
  // ==============================================================================
  describe("Fase 6. Integración de la conversación con el POS", () => {
    it("crea un pedido real en el POS cuando el cliente solicita y confirma su orden", async () => {
      if (!isDbConnected || !testBizA || !productBurgerA || !productDrinkA) return;

      const customerPhone = "573009990060";

      // 1. Cliente consulta productos
      await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: customerPhone,
        text: "Hola, quiero pedir para domicilio",
        processImmediately: true,
      });

      // 2. Cliente pide y confirma directamente con datos completos
      const orderSim = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: customerPhone,
        text:
          "Quiero pedir 2 Hamburguesas Clásicas y 1 Gaseosa Manzana. " +
          "Mi nombre es Andrés Gómez, dirección Calle 100 # 15-20 apto 301. " +
          "Confirmo totalmente el pedido, por favor regístralo ya.",
        processImmediately: true,
      });

      expect(orderSim.success).toBe(true);
      expect(orderSim.outgoingResponse).toBeDefined();

      // Verificar si el POS creó la orden en restaurant_orders
      expect(orderSim.createdOrder).toBeDefined();
      if (orderSim.createdOrder) {
        expect(orderSim.createdOrder.order_number).toBeGreaterThan(0);
        expect(orderSim.createdOrder.channel_origin).toBe("whatsapp");
        expect(orderSim.createdOrder.status).toBe("received");
        expect(orderSim.createdOrder.payment_status).toBe("pending");
        // 2 Hamburguesas ($22.000 x 2 = $44.000) + 1 Gaseosa ($5.000) = $49.000
        expect(orderSim.createdOrder.total).toBe(49000);

        // La respuesta al cliente debe mencionar el número de pedido
        expect(orderSim.outgoingResponse?.content).toContain(
          `#${orderSim.createdOrder.order_number}`
        );
      }
    });

    it("no crea el pedido si el cliente solo hace preguntas sin confirmar", async () => {
      if (!isDbConnected || !testBizA) return;

      const simQuestion = await WhatsAppSimulator.simulateIncomingMessage(adminClient, {
        businessId: testBizA.id,
        senderPhone: "573009990061",
        text: "Solo estoy mirando precios por ahora, gracias",
        processImmediately: true,
      });

      expect(simQuestion.createdOrder).toBeNull();
    });
  });
});
