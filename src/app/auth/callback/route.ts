import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  // Sanitizar 'next' para mitigar Open Redirects
  // Evitamos rutas que no comiencen con '/' o que comiencen con '//' (redirección de protocolo relativo)
  let safeNext = "/dashboard";
  if (next.startsWith("/") && !next.startsWith("//")) {
    safeNext = next;
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${requestUrl.origin}${safeNext}`);
    }
    // Si hay error en el intercambio, loggear de forma segura
    console.error("Error en intercambio de sesión:", error.message);
  }

  // Si ocurre un error vuelve al login
  return NextResponse.redirect(`${requestUrl.origin}/login`);
}
