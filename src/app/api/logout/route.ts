import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Cerrar la sesión en Supabase (invalida la sesión actual en la base de datos y cookies)
  const { error } = await supabase.auth.signOut();

  if (error) {
    // Si hay un error, lo registramos de forma segura, pero procedemos a limpiar las cookies y redirigir
    console.error("Error al cerrar sesión:", error.message);
  }

  // Redirigir al login y limpiar cookies
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(`${requestUrl.origin}/login`, {
    status: 303, // Redirección Get post-Post
  });

  // Asegurar la purga manual de las cookies de Supabase en la respuesta
  const supabaseCookieName = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`;
  response.cookies.set(supabaseCookieName, "", { maxAge: -1 });

  return response;
}

// También permitir GET por simplicidad si se llama desde enlaces, aunque POST es preferido por CSRF
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(`${requestUrl.origin}/login`);

  const supabaseCookieName = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`;
  response.cookies.set(supabaseCookieName, "", { maxAge: -1 });

  return response;
}
