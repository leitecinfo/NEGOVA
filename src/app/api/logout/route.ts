import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function performLogout(request: NextRequest) {
  // 1. Ejecutar signOut en Supabase con timeout de 800ms para que nunca bloquee la petición si la red o Supabase tardan
  try {
    const supabase = await createClient();
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }),
      new Promise((resolve) => setTimeout(resolve, 800)),
    ]);
  } catch (error: any) {
    console.warn("Aviso al cerrar sesión en Supabase:", error?.message || error);
  }

  // 2. Determinar si la petición proviene de fetch/AJAX o de navegación directa
  const isFetch =
    request.headers.get("accept")?.includes("application/json") ||
    request.headers.get("content-type")?.includes("application/json") ||
    request.headers.get("sec-fetch-mode") === "cors";

  const requestUrl = new URL(request.url);
  const loginUrl = `${requestUrl.origin}/login`;

  const response = isFetch
    ? NextResponse.json({ success: true, redirect: "/login" }, { status: 200 })
    : NextResponse.redirect(loginUrl, { status: 303 });

  // 3. Purgar absolutamente TODAS las cookies de autenticación de Supabase (incluyendo fragmentos .0, .1, etc.)
  const allCookies = request.cookies.getAll();
  const clearedCookies = new Set<string>();

  for (const cookie of allCookies) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name.includes("auth-token") ||
      cookie.name.includes("supabase")
    ) {
      clearedCookies.add(cookie.name);
    }
  }

  // Asegurar también los nombres base y fragmentados comunes por URL de proyecto
  try {
    const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    clearedCookies.add(`sb-${projectRef}-auth-token`);
    clearedCookies.add(`sb-${projectRef}-auth-token.0`);
    clearedCookies.add(`sb-${projectRef}-auth-token.1`);
    clearedCookies.add(`sb-${projectRef}-auth-token.2`);
  } catch {}

  for (const cookieName of clearedCookies) {
    response.cookies.set(cookieName, "", {
      path: "/",
      maxAge: -1,
      expires: new Date(0),
    });
    response.cookies.delete(cookieName);
  }

  // Headers para evitar cualquier caché de respuestas de auth
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export async function POST(request: NextRequest) {
  return performLogout(request);
}

export async function GET(request: NextRequest) {
  return performLogout(request);
}
