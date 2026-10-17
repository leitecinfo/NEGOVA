import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// Leer variables de entorno (simulado o usando dot-env si está)
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("Iniciando migración de datos...");
  // Obtenemos los datos actuales
  const { data: storeData } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "platform:support_store")
    .maybeSingle();

  if (!storeData || !storeData.value) {
    console.log("No hay datos en platform:support_store para migrar.");
    return;
  }

  const { interactions = [], tickets = [] } = storeData.value as any;

  console.log(`Encontrados: ${interactions.length} atenciones y ${tickets.length} tickets.`);

  // Insertar interacciones
  let intCount = 0;
  for (const atn of interactions) {
    const payload = {
      id: atn.id,
      interaction_number: atn.interactionNumber,
      business_id: atn.businessId?.includes("-") ? atn.businessId : null,
      business_name: atn.businessName,
      business_slug: atn.businessSlug,
      contact_name: atn.contactName,
      contact_phone: atn.contactPhone,
      contact_email: atn.contactEmail,
      channel: atn.channel,
      category: atn.category,
      subject: atn.subject,
      summary: atn.summary,
      outcome: atn.outcome,
      ticket_id: atn.ticketId,
      ticket_number: atn.ticketNumber,
      agent_id: atn.agentId?.includes("-") ? atn.agentId : null,
      agent_name: atn.agentName,
      created_at: atn.createdAt,
      updated_at: atn.updatedAt
    };

    const { error } = await admin.from("support_interactions").upsert(payload, { onConflict: "id" });
    if (error) {
      console.error(`Error insertando ATN ${atn.id}:`, error.message);
    } else {
      intCount++;
    }
  }

  // Insertar tickets
  let tckCount = 0;
  for (const tck of tickets) {
    const payload = {
      id: tck.id,
      ticket_number: tck.ticketNumber,
      business_id: tck.businessId?.includes("-") ? tck.businessId : null,
      business_name: tck.businessName,
      business_slug: tck.businessSlug,
      contact_name: tck.contactName,
      contact_email: tck.contactEmail,
      contact_phone: tck.contactPhone,
      origin_channel: tck.originChannel,
      interaction_id: tck.interactionId,
      interaction_number: tck.interactionNumber,
      category: tck.category,
      priority: tck.priority,
      status: tck.status,
      subject: tck.subject,
      description: tck.description,
      assigned_agent_id: tck.assignedAgentId?.includes("-") ? tck.assignedAgentId : null,
      assigned_agent_name: tck.assignedAgentName,
      internal_notes: tck.internalNotes,
      client_resolution: tck.clientResolution,
      created_at: tck.createdAt,
      updated_at: tck.updatedAt,
      resolved_at: tck.resolvedAt,
      closed_at: tck.closedAt
    };

    const { error } = await admin.from("support_tickets").upsert(payload, { onConflict: "id" });
    if (error) {
      console.error(`Error insertando TCK ${tck.id}:`, error.message);
    } else {
      tckCount++;
    }
  }

  console.log(`Migración completada. Atenciones insertadas/actualizadas: ${intCount}. Tickets insertados/actualizados: ${tckCount}.`);
}

run();
