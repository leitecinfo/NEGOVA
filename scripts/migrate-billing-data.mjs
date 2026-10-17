import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Leer variables de entorno sin usar dotenv
const envStr = fs.readFileSync(".env.local", "utf-8");
const getEnv = (key) => {
  const match = envStr.match(new RegExp("^" + key + "=(.*)$", "m"));
  return match ? match[1].trim() : "";
};

const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("Iniciando migración de facturas...");
  const { data: storeData, error: storeError } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "platform:invoices")
    .maybeSingle();

  if (storeError) {
    console.error("Error al obtener platform_settings:", storeError);
    return;
  }

  if (!storeData || !storeData.value || !Array.isArray(storeData.value)) {
    console.log("No hay datos en platform:invoices para migrar.");
    return;
  }

  const invoices = storeData.value;
  console.log(`Encontradas: ${invoices.length} facturas en JSON.`);

  // Insertar facturas
  let invCount = 0;
  let omittedCount = 0;
  for (const inv of invoices) {
    const payload = {
      id: inv.id,
      invoice_number: inv.invoiceNumber,
      business_id: inv.businessId?.includes("-") ? inv.businessId : null,
      business_name: inv.businessName,
      business_slug: inv.businessSlug,
      subscription_id: null, // As they were not linked before
      plan_id: inv.planId,
      plan_name: inv.planName,
      billing_interval: inv.billingInterval,
      amount: inv.amount,
      currency: inv.currency || "COP",
      status: inv.status,
      payment_method: inv.paymentMethod,
      payment_reference: inv.paymentReference,
      issued_at: inv.issuedAt,
      due_date: inv.dueDate,
      paid_at: inv.paidAt,
      notes: inv.notes,
      pdf_url: inv.pdfUrl,
      pdf_storage_path: inv.pdfStoragePath,
      last_email_sent_at: inv.lastEmailSentAt,
      last_sent_to_email: inv.lastSentToEmail,
      billing_period: inv.issuedAt ? inv.issuedAt.substring(0, 7) : null,
      created_at: inv.issuedAt,
      updated_at: new Date().toISOString()
    };

    const { error } = await admin.from("platform_invoices").upsert(payload, { onConflict: "id" });
    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation
        console.warn(`Omitido (duplicado/restricción) ${inv.id}:`, error.message);
        omittedCount++;
      } else {
        console.error(`Error insertando INV ${inv.id}:`, error.message);
      }
    } else {
      invCount++;
    }
  }

  console.log(`Migración completada exitosamente.`);
  console.log(`Facturas insertadas/actualizadas: ${invCount}.`);
  console.log(`Facturas omitidas: ${omittedCount}.`);
}

run().catch(console.error);
