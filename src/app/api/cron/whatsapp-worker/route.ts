import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { WhatsAppWorker } from "@/lib/whatsapp/worker";
import { timingSafeCompare, sanitizeLog } from "@/lib/whatsapp/security";

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
 * Endpoint de ejecución del Worker de WhatsApp en segundo plano (Cron Job).
 * Protegido mediante token Bearer (CRON_SECRET) compatible con Vercel Cron.
 * Reclama eventos pendientes, recupera bloqueos expirados (zombies) y procesa por lotes.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.warn("[WhatsApp Cron Worker] CRON_SECRET no configurado en el servidor.");
      return NextResponse.json(
        { error: "Endpoint no configurado" },
        { status: 500 }
      );
    }

    const expectedHeader = `Bearer ${cronSecret}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedHeader)) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const batchSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("batchSize") || "10", 10) || 10)
    );

    const dbClient = getServiceDbClient();
    const worker = new WhatsAppWorker();
    const result = await worker.processBatch(dbClient, batchSize);

    return NextResponse.json({
      success: true,
      workerId: worker.workerId,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(
      "[WhatsApp Cron Worker] Error en la ejecución:",
      sanitizeLog(err?.message || err)
    );
    return NextResponse.json(
      { error: "Error interno al ejecutar worker" },
      { status: 500 }
    );
  }
}
