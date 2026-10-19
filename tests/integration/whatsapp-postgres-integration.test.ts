import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { WhatsAppQueueService } from "../../src/lib/whatsapp/queue-service";

/**
 * NEGOVA — Pruebas de Integración Reales contra PostgreSQL / Supabase Local
 * Cobertura de la Sección 7:
 * - 7.1 Aislamiento de secretos (permisos de Postgres y RLS en business_whatsapp_secrets)
 * - 7.2 Aislamiento multi-tenant entre negocios (business_whatsapp_configs, whatsapp_conversations, whatsapp_messages)
 * - 7.3 RPC de reclamación atómica (claim_whatsapp_incoming_events con FOR UPDATE SKIP LOCKED y fencing)
 * - 7.4 Persistencia, deduplicación e idempotencia
 *
 * REGLA OBLIGATORIA: Si PostgreSQL o Supabase local están desconectados (Docker offline),
 * la suite detecta la indisponibilidad y lo reporta de forma transparente y reproducible,
 * sin inventar ejecuciones ni suplantar la base de datos con mocks.
 */

const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const LOCAL_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon";
const LOCAL_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service";

const RUN_TAG = `qa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

let isWhatsAppSchemaApplied = false;
let adminClient: any = null;
let anonClient: any = null;

// Entidades de prueba efímeras aisladas (solo se crean si la migración está aplicada)
let testBizA: { id: string; name: string } | null = null;
let testBizB: { id: string; name: string } | null = null;
let userClientOwnerA: any = null;
let userClientAuxiliarA: any = null;
let userClientOwnerB: any = null;
let createdUserIds: string[] = [];

describe("NEGOVA — WhatsApp IA Lote 1: Pruebas de Integración contra PostgreSQL", () => {
  beforeAll(async () => {
    try {
      adminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
        auth: { persistSession: false },
      });
      anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
        auth: { persistSession: false },
      });

      // 1. Sondear si la tabla business_whatsapp_configs ya fue migrada en la base de datos
      const { error: testTableErr } = await adminClient
        .from("business_whatsapp_configs")
        .select("id")
        .limit(1);

      if (!testTableErr) {
        isWhatsAppSchemaApplied = true;

        // 2. Obtener roles necesarios
        const { data: ownerRole } = await adminClient
          .from("roles")
          .select("id")
          .eq("code", "owner")
          .single();

        const { data: auxRole } = await adminClient
          .from("roles")
          .select("id")
          .eq("code", "auxiliar")
          .single();

        // 3. Crear 2 Comercios Aislados temporales para la prueba
        const { data: bizA } = await adminClient
          .from("businesses")
          .insert({
            name: `QA Biz A ${RUN_TAG}`,
            slug: `qa-biz-a-${RUN_TAG}`,
            status: "active",
          })
          .select("id, name")
          .single();

        const { data: bizB } = await adminClient
          .from("businesses")
          .insert({
            name: `QA Biz B ${RUN_TAG}`,
            slug: `qa-biz-b-${RUN_TAG}`,
            status: "active",
          })
          .select("id, name")
          .single();

        testBizA = bizA;
        testBizB = bizB;

        // 4. Crear Usuarios de prueba en auth.users y vincular en business_users
        if (testBizA && testBizB && ownerRole && auxRole) {
          const pass = "QaTestPassword123!";
          const emailOwnerA = `qa_owner_a_${RUN_TAG}@test.negova.local`;
          const emailAuxA = `qa_aux_a_${RUN_TAG}@test.negova.local`;
          const emailOwnerB = `qa_owner_b_${RUN_TAG}@test.negova.local`;

          const { data: authOwnerA } = await adminClient.auth.admin.createUser({
            email: emailOwnerA,
            password: pass,
            email_confirm: true,
          });
          const { data: authAuxA } = await adminClient.auth.admin.createUser({
            email: emailAuxA,
            password: pass,
            email_confirm: true,
          });
          const { data: authOwnerB } = await adminClient.auth.admin.createUser({
            email: emailOwnerB,
            password: pass,
            email_confirm: true,
          });

          if (authOwnerA?.user && authAuxA?.user && authOwnerB?.user) {
            createdUserIds = [authOwnerA.user.id, authAuxA.user.id, authOwnerB.user.id];

            await adminClient.from("business_users").insert([
              {
                business_id: testBizA.id,
                user_id: authOwnerA.user.id,
                role_id: ownerRole.id,
                status: "active",
              },
              {
                business_id: testBizA.id,
                user_id: authAuxA.user.id,
                role_id: auxRole.id,
                status: "active",
              },
              {
                business_id: testBizB.id,
                user_id: authOwnerB.user.id,
                role_id: ownerRole.id,
                status: "active",
              },
            ]);

            // Clientes autenticados independientes
            userClientOwnerA = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
              auth: { persistSession: false },
            });
            await userClientOwnerA.auth.signInWithPassword({
              email: emailOwnerA,
              password: pass,
            });

            userClientAuxiliarA = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
              auth: { persistSession: false },
            });
            await userClientAuxiliarA.auth.signInWithPassword({
              email: emailAuxA,
              password: pass,
            });

            userClientOwnerB = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
              auth: { persistSession: false },
            });
            await userClientOwnerB.auth.signInWithPassword({
              email: emailOwnerB,
              password: pass,
            });
          }
        }
      } else {
        isWhatsAppSchemaApplied = false;
      }
    } catch {
      isWhatsAppSchemaApplied = false;
    }
  });

  afterAll(async () => {
    // Limpieza rigurosa y garantizada de entidades temporales con reporte explícito de fallos
    const cleanupErrors: string[] = [];

    if (adminClient && isWhatsAppSchemaApplied) {
      if (createdUserIds.length > 0) {
        for (const uid of createdUserIds) {
          try {
            const { error } = await adminClient.auth.admin.deleteUser(uid);
            if (error) {
              cleanupErrors.push(`No se pudo eliminar el usuario temporal ${uid}: ${error.message}`);
            }
          } catch (err: any) {
            cleanupErrors.push(`Excepción al eliminar usuario temporal ${uid}: ${err?.message || err}`);
          }
        }
      }

      if (testBizA || testBizB) {
        const bizIdsToDelete = [testBizA?.id, testBizB?.id].filter(Boolean);
        if (bizIdsToDelete.length > 0) {
          try {
            const { error } = await adminClient.from("businesses").delete().in("id", bizIdsToDelete);
            if (error) {
              cleanupErrors.push(`No se pudo eliminar comercios de prueba [${bizIdsToDelete.join(", ")}]: ${error.message}`);
            }
          } catch (err: any) {
            cleanupErrors.push(`Excepción al eliminar comercios de prueba: ${err?.message || err}`);
          }
        }
      }
    }

    if (cleanupErrors.length > 0) {
      throw new Error(`[Fallo en la Limpieza de Pruebas de Integración]:\n${cleanupErrors.join("\n")}`);
    }
  });

  // -------------------------------------------------------------------------
  // 7.1 Aislamiento de Secretos Criptográficos
  // -------------------------------------------------------------------------
  describe("7.1 Aislamiento de Secretos Criptográficos", () => {
    it("anon no tiene permisos de lectura sobre business_whatsapp_secrets (Postgres REVOKE)", async (ctx) => {
      if (!isWhatsAppSchemaApplied) {
        console.info(
          "[Integration Skip] La migración 20261018210000_whatsapp_integration_schema.sql no está aplicada. " +
          "Restricción obligatoria: Prohibido aplicar migraciones en entornos remotos sin autorización."
        );
        ctx.skip();
        return;
      }

      const { data, error } = await anonClient
        .from("business_whatsapp_secrets")
        .select("*");

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501"); // permission denied for table
      expect(data).toBeNull();
    });

    it("Usuarios autenticados (incluso Propietarios de negocio) tienen denegado el acceso a secretos", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !userClientOwnerA) {
        ctx.skip();
        return;
      }

      const { data, error } = await userClientOwnerA
        .from("business_whatsapp_secrets")
        .select("*");

      // REVOKE ALL de Postgres bloquea directamente a nivel tabla
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
      expect(data).toBeNull();
    });

    it("service_role es el único con acceso a business_whatsapp_secrets", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !testBizA) {
        ctx.skip();
        return;
      }

      const { data, error } = await adminClient
        .from("business_whatsapp_secrets")
        .select("business_id, token_key_id")
        .eq("business_id", testBizA.id);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it("La tabla operativa business_whatsapp_configs NO contiene columnas de secretos", async (ctx) => {
      if (!isWhatsAppSchemaApplied) {
        ctx.skip();
        return;
      }

      const { error: errToken } = await adminClient
        .from("business_whatsapp_configs")
        .select("encrypted_access_token")
        .limit(1);

      expect(errToken).not.toBeNull();
      expect(errToken?.message).toMatch(/column.*does not exist|failed to parse/i);
    });
  });

  // -------------------------------------------------------------------------
  // 7.2 Aislamiento Multi-Tenant entre Negocios y Roles Operativos
  // -------------------------------------------------------------------------
  describe("7.2 Aislamiento Multi-Tenant entre Negocios y Roles Operativos", () => {
    it("El usuario A autenticado accede únicamente a configuraciones de su propio negocio", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !userClientOwnerA || !testBizA) {
        ctx.skip();
        return;
      }

      // Preparar configuración para Biz A mediante admin
      const configA = {
        business_id: testBizA.id,
        phone_number_id: `phone_${RUN_TAG}_a`,
        display_phone_number: "+573000000001",
        verified_name: "Negocio A Verificado",
        status: "active",
      };
      await adminClient.from("business_whatsapp_configs").insert(configA);

      try {
        const { data, error } = await userClientOwnerA
          .from("business_whatsapp_configs")
          .select("business_id, phone_number_id")
          .eq("business_id", testBizA.id);

        expect(error).toBeNull();
        expect(data?.length).toBe(1);
        expect(data?.[0]?.business_id).toBe(testBizA.id);
      } finally {
        await adminClient
          .from("business_whatsapp_configs")
          .delete()
          .eq("business_id", testBizA.id);
      }
    });

    it("El usuario A no puede leer ni modificar configuraciones ni conversaciones del negocio B", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !userClientOwnerA || !testBizB) {
        ctx.skip();
        return;
      }

      // 1. Intento de lectura cross-tenant
      const { data: readData, error: readErr } = await userClientOwnerA
        .from("whatsapp_conversations")
        .select("*")
        .eq("business_id", testBizB.id);

      expect(readErr).toBeNull();
      expect(readData?.length || 0).toBe(0);

      // 2. Intento de modificación cross-tenant
      const { data: updateData } = await userClientOwnerA
        .from("business_whatsapp_configs")
        .update({ verified_name: "Ataque Cross Tenant" })
        .eq("business_id", testBizB.id)
        .select();

      expect(updateData?.length || 0).toBe(0);
    });

    it("Un rol operativo (Auxiliar) no puede modificar configuraciones administrativas", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !userClientAuxiliarA || !testBizA) {
        ctx.skip();
        return;
      }

      const configA = {
        business_id: testBizA.id,
        phone_number_id: `phone_${RUN_TAG}_admin_block`,
        display_phone_number: "+573000000002",
        status: "active",
      };
      await adminClient.from("business_whatsapp_configs").insert(configA);

      try {
        // Auxiliar intenta modificar configuración administrativa
        const { data: auxUpdate } = await userClientAuxiliarA
          .from("business_whatsapp_configs")
          .update({ ai_enabled: false })
          .eq("business_id", testBizA.id)
          .select();

        // RLS debe denegar el update para rol auxiliar (0 filas afectadas)
        expect(auxUpdate?.length || 0).toBe(0);
      } finally {
        await adminClient
          .from("business_whatsapp_configs")
          .delete()
          .eq("business_id", testBizA.id);
      }
    });

    it("Un rol operativo sin permiso de gestión (Auxiliar) no puede modificar el estado de una conversación", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !userClientAuxiliarA || !testBizA) {
        ctx.skip();
        return;
      }

      const convA = {
        business_id: testBizA.id,
        customer_phone: `+57300${Date.now().toString().slice(-7)}`,
        status: "ai_active",
      };
      const { data: createdConv } = await adminClient
        .from("whatsapp_conversations")
        .insert(convA)
        .select()
        .single();

      try {
        const { data: auxConvUpdate } = await userClientAuxiliarA
          .from("whatsapp_conversations")
          .update({ status: "human_pending" })
          .eq("id", createdConv.id)
          .select();

        // RLS debe denegar el update para rol auxiliar sin orders.manage (0 filas devueltas)
        expect(auxConvUpdate?.length || 0).toBe(0);
      } finally {
        await adminClient
          .from("whatsapp_conversations")
          .delete()
          .eq("id", createdConv.id);
      }
    });

    it("El trigger prevent_whatsapp_conversation_business_id_change bloquea la mutación de business_id", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !testBizA || !testBizB) {
        ctx.skip();
        return;
      }

      const convA = {
        business_id: testBizA.id,
        customer_phone: `+57300${Date.now().toString().slice(-7)}`,
        status: "ai_active",
      };
      const { data: createdConv } = await adminClient
        .from("whatsapp_conversations")
        .insert(convA)
        .select()
        .single();

      try {
        const { error: triggerErr } = await adminClient
          .from("whatsapp_conversations")
          .update({ business_id: testBizB.id })
          .eq("id", createdConv.id);

        expect(triggerErr).not.toBeNull();
        expect(triggerErr?.message).toContain("No está permitido modificar el business_id");
      } finally {
        await adminClient
          .from("whatsapp_conversations")
          .delete()
          .eq("id", createdConv.id);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 7.3 RPC de Reclamación Atómica (claim_whatsapp_incoming_events)
  // -------------------------------------------------------------------------
  describe("7.3 RPC claim_whatsapp_incoming_events (Concurrencia Real y Fencing)", () => {
    it("anon y authenticated tienen prohibido ejecutar la RPC de reclamación", async (ctx) => {
      if (!isWhatsAppSchemaApplied) {
        ctx.skip();
        return;
      }

      // Intento anónimo
      const { error: errAnon } = await anonClient.rpc("claim_whatsapp_incoming_events", {
        p_worker_id: "hacker_worker",
        p_batch_size: 5,
        p_lock_timeout_seconds: 300,
      });

      expect(errAnon).not.toBeNull();
      expect(errAnon?.code).toBe("42501"); // permission denied for function

      // Intento autenticado (Propietario de negocio)
      if (userClientOwnerA) {
        const { error: errAuth } = await userClientOwnerA.rpc("claim_whatsapp_incoming_events", {
          p_worker_id: "owner_worker",
          p_batch_size: 5,
          p_lock_timeout_seconds: 300,
        });
        expect(errAuth).not.toBeNull();
        expect(errAuth?.code).toBe("42501");
      }
    });

    it("Reclama eventos pendientes disponibles y los bloquea atómicamente", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !testBizA) {
        ctx.skip();
        return;
      }

      const evtTag = `${RUN_TAG}_claim_pending`;
      const evt = {
        business_id: testBizA.id,
        phone_number_id: "qa_phone_pending",
        meta_message_id: evtTag,
        sender_phone: "+573000000010",
        event_type: "message",
        payload: { text: { body: "Reclamar pendiente" } },
        status: "pending",
        attempts: 0,
        max_attempts: 3,
      };

      try {
        const { data: inserted } = await adminClient
          .from("whatsapp_incoming_events")
          .insert(evt)
          .select()
          .single();

        const { data: claimed, error: claimErr } = await adminClient.rpc(
          "claim_whatsapp_incoming_events",
          {
            p_worker_id: "worker_test_pending",
            p_batch_size: 5,
            p_lock_timeout_seconds: 300,
          }
        );

        expect(claimErr).toBeNull();
        const found = (claimed || []).find((e: any) => e.id === inserted.id);
        expect(found).toBeDefined();
        expect(found.status).toBe("processing");
        expect(found.locked_by).toBe("worker_test_pending");
        expect(found.locked_at).not.toBeNull();
      } finally {
        await adminClient
          .from("whatsapp_incoming_events")
          .delete()
          .eq("meta_message_id", evtTag);
      }
    });

    it("Recupera eventos en processing con locked_at IS NULL cuando tienen intentos disponibles", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !testBizA) {
        ctx.skip();
        return;
      }

      const evtTag = `${RUN_TAG}_null_lock`;
      const evt = {
        business_id: testBizA.id,
        phone_number_id: "qa_phone_null_lock",
        meta_message_id: evtTag,
        sender_phone: "+573000000011",
        event_type: "message",
        payload: { text: { body: "Zombie con lock null" } },
        status: "processing",
        attempts: 1,
        max_attempts: 3,
        locked_at: null,
        locked_by: null,
      };

      try {
        const { data: inserted } = await adminClient
          .from("whatsapp_incoming_events")
          .insert(evt)
          .select()
          .single();

        const { data: claimed, error: claimErr } = await adminClient.rpc(
          "claim_whatsapp_incoming_events",
          {
            p_worker_id: "worker_zombie_null_reclaimer",
            p_batch_size: 5,
            p_lock_timeout_seconds: 300,
          }
        );

        expect(claimErr).toBeNull();
        const found = (claimed || []).find((e: any) => e.id === inserted.id);
        expect(found).toBeDefined();
        expect(found.attempts).toBe(2);
        expect(found.locked_by).toBe("worker_zombie_null_reclaimer");
        expect(found.status).toBe("processing");
      } finally {
        await adminClient
          .from("whatsapp_incoming_events")
          .delete()
          .eq("meta_message_id", evtTag);
      }
    });

    it("Recupera eventos en processing cuyo bloqueo venció (> lock_timeout_seconds)", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !testBizA) {
        ctx.skip();
        return;
      }

      const evtTag = `${RUN_TAG}_expired_lock`;
      const expiredTime = new Date(Date.now() - 600 * 1000).toISOString();
      const evt = {
        business_id: testBizA.id,
        phone_number_id: "qa_phone_expired",
        meta_message_id: evtTag,
        sender_phone: "+573000000012",
        event_type: "message",
        payload: { text: { body: "Bloqueo vencido" } },
        status: "processing",
        attempts: 1,
        max_attempts: 3,
        locked_at: expiredTime,
        locked_by: "worker_muerto",
      };

      try {
        const { data: inserted } = await adminClient
          .from("whatsapp_incoming_events")
          .insert(evt)
          .select()
          .single();

        const { data: claimed, error: claimErr } = await adminClient.rpc(
          "claim_whatsapp_incoming_events",
          {
            p_worker_id: "worker_rescate_01",
            p_batch_size: 5,
            p_lock_timeout_seconds: 300,
          }
        );

        expect(claimErr).toBeNull();
        const found = (claimed || []).find((e: any) => e.id === inserted.id);
        expect(found).toBeDefined();
        expect(found.attempts).toBe(2);
        expect(found.locked_by).toBe("worker_rescate_01");
      } finally {
        await adminClient
          .from("whatsapp_incoming_events")
          .delete()
          .eq("meta_message_id", evtTag);
      }
    });

    it("Envía a dead_letter eventos cuyo bloqueo expiró o es nulo y ya agotaron intentos (attempts >= max_attempts)", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !testBizA) {
        ctx.skip();
        return;
      }

      const evtTag = `${RUN_TAG}_exhausted_dead_letter`;
      const expiredTime = new Date(Date.now() - 600 * 1000).toISOString();
      const evt = {
        business_id: testBizA.id,
        phone_number_id: "qa_phone_exhausted",
        meta_message_id: evtTag,
        sender_phone: "+573000000013",
        event_type: "message",
        payload: { text: { body: "Agotado definitivamente" } },
        status: "processing",
        attempts: 3,
        max_attempts: 3,
        locked_at: expiredTime,
        locked_by: "worker_abandonador",
      };

      try {
        const { data: inserted } = await adminClient
          .from("whatsapp_incoming_events")
          .insert(evt)
          .select()
          .single();

        await adminClient.rpc("claim_whatsapp_incoming_events", {
          p_worker_id: "worker_sweeper",
          p_batch_size: 5,
          p_lock_timeout_seconds: 300,
        });

        const { data: deadLetterEvt } = await adminClient
          .from("whatsapp_incoming_events")
          .select("status, last_error, locked_by, locked_at")
          .eq("id", inserted.id)
          .single();

        expect(deadLetterEvt.status).toBe("dead_letter");
        expect(deadLetterEvt.locked_by).toBeNull();
        expect(deadLetterEvt.locked_at).toBeNull();
        expect(deadLetterEvt.last_error).toContain("Expiró el bloqueo del worker y se agotaron los intentos");
      } finally {
        await adminClient
          .from("whatsapp_incoming_events")
          .delete()
          .eq("meta_message_id", evtTag);
      }
    });

    it("FOR UPDATE SKIP LOCKED: Dos workers concurrentes no reclaman el mismo evento", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !testBizA) {
        ctx.skip();
        return;
      }

      const evtTag = `${RUN_TAG}_conc`;
      const evt1 = {
        business_id: testBizA.id,
        phone_number_id: "qa_phone_conc",
        meta_message_id: `${evtTag}_1`,
        sender_phone: "+573000000001",
        event_type: "message",
        payload: { text: { body: "Concurrent 1" } },
        status: "pending",
      };
      const evt2 = {
        business_id: testBizA.id,
        phone_number_id: "qa_phone_conc",
        meta_message_id: `${evtTag}_2`,
        sender_phone: "+573000000002",
        event_type: "message",
        payload: { text: { body: "Concurrent 2" } },
        status: "pending",
      };

      try {
        await adminClient.from("whatsapp_incoming_events").insert([evt1, evt2]);

        const [res1, res2] = await Promise.all([
          adminClient.rpc("claim_whatsapp_incoming_events", {
            p_worker_id: "integration_worker_1",
            p_batch_size: 1,
            p_lock_timeout_seconds: 300,
          }),
          adminClient.rpc("claim_whatsapp_incoming_events", {
            p_worker_id: "integration_worker_2",
            p_batch_size: 1,
            p_lock_timeout_seconds: 300,
          }),
        ]);

        const claimedIds1 = (res1.data || []).map((e: any) => e.id);
        const claimedIds2 = (res2.data || []).map((e: any) => e.id);

        expect(claimedIds1.length).toBe(1);
        expect(claimedIds2.length).toBe(1);
        expect(claimedIds1[0]).not.toBe(claimedIds2[0]);

        const intersection = claimedIds1.filter((id: string) => claimedIds2.includes(id));
        expect(intersection.length).toBe(0);
      } finally {
        await adminClient
          .from("whatsapp_incoming_events")
          .delete()
          .in("meta_message_id", [`${evtTag}_1`, `${evtTag}_2`]);
      }
    });

    it("Fencing: Un worker obsoleto cuyo bloqueo fue transferido no puede completar el evento", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !testBizA) {
        ctx.skip();
        return;
      }

      const evtTag = `${RUN_TAG}_fencing_service`;
      const evt = {
        business_id: testBizA.id,
        phone_number_id: "qa_phone_fencing",
        meta_message_id: evtTag,
        sender_phone: "+573000000014",
        event_type: "message",
        payload: { text: { body: "Fencing service test" } },
        status: "processing",
        attempts: 1,
        max_attempts: 3,
        locked_at: new Date().toISOString(),
        locked_by: "worker_nuevo_activo",
      };

      try {
        const { data: inserted } = await adminClient
          .from("whatsapp_incoming_events")
          .insert(evt)
          .select()
          .single();

        // Worker antiguo intenta completar mediante el servicio
        const completeSuccess = await WhatsAppQueueService.completeEvent(
          adminClient,
          inserted.id,
          "worker_antiguo_obsoleto"
        );

        expect(completeSuccess).toBe(false);

        // Verificar que el evento sigue en processing asignado a worker_nuevo_activo
        const { data: currentEvt } = await adminClient
          .from("whatsapp_incoming_events")
          .select("status, locked_by")
          .eq("id", inserted.id)
          .single();

        expect(currentEvt.status).toBe("processing");
        expect(currentEvt.locked_by).toBe("worker_nuevo_activo");
      } finally {
        await adminClient
          .from("whatsapp_incoming_events")
          .delete()
          .eq("meta_message_id", evtTag);
      }
    });

    it("Limpieza estricta: Verifica que no queden residuos de eventos temporales en la cola", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !testBizA) {
        ctx.skip();
        return;
      }

      const { data: residualEvents } = await adminClient
        .from("whatsapp_incoming_events")
        .select("id")
        .eq("business_id", testBizA.id);

      expect(residualEvents?.length || 0).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 7.4 Persistencia e Idempotencia
  // -------------------------------------------------------------------------
  describe("7.4 Persistencia, Deduplicación e Idempotencia", () => {
    it("El índice único en meta_message_id previene duplicación ante inserciones simultáneas", async (ctx) => {
      if (!isWhatsAppSchemaApplied || !testBizA) {
        ctx.skip();
        return;
      }

      const duplicateWamid = `wamid_${RUN_TAG}_${Date.now()}`;
      const eventPayload = {
        business_id: testBizA.id,
        phone_number_id: "1234567890",
        meta_message_id: duplicateWamid,
        sender_phone: "+573001234567",
        event_type: "message",
        payload: { text: { body: "Prueba de unicidad" } },
        status: "pending",
      };

      try {
        const { error: err1 } = await adminClient
          .from("whatsapp_incoming_events")
          .insert(eventPayload);
        expect(err1).toBeNull();

        const { error: err2 } = await adminClient
          .from("whatsapp_incoming_events")
          .insert(eventPayload);

        expect(err2).not.toBeNull();
        expect(err2?.code).toBe("23505"); // unique_violation
      } finally {
        await adminClient
          .from("whatsapp_incoming_events")
          .delete()
          .eq("meta_message_id", duplicateWamid);
      }
    });
  });
});
