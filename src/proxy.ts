import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Omitir inmediatamente WebSockets, rutas internas de Next.js, HMR, APIs y Server Actions
  // Esto garantiza que el HMR de desarrollo y las acciones server-side no sufran latencia redundante.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    request.headers.get("upgrade") === "websocket" ||
    request.headers.has("next-action")
  ) {
    return NextResponse.next();
  }

  // 2. Inhabilitar y redirigir cualquier intento de acceder a rutas de registro público
  if (pathname === "/register" || pathname === "/registro") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const isProtectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/workspace") ||
    pathname === "/reset-password";

  const isAuthPublicRoute = pathname === "/login" || pathname === "/forgot-password";

  // Si no es ruta protegida ni de auth (ej: landing page, blog, contacto, planes), permitir paso inmediato (0ms)
  if (!isProtectedRoute && !isAuthPublicRoute) {
    return NextResponse.next();
  }

  // 3. Inspección instantánea de presencia de cookies de sesión de Supabase
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) =>
      (c.name.startsWith("sb-") && c.name.endsWith("-auth-token")) ||
      c.name.includes("supabase") ||
      c.name.includes("auth-token")
  );

  // Optimización crítica: Si no hay cookies de sesión, NO contactar a Supabase (evita cuellos de botella de red)
  if (!hasAuthCookie) {
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
    // Usuario no autenticado en ruta pública (/login, /forgot-password)
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Supabase Client con manejo de Cookies en el Proxy Server-Side
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Obtener la sesión activa con timeout defensivo de 10 segundos para evitar bloqueos del servidor
  let user: any = null;
  try {
    const authPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise<{ data: { user: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null } }), 10000)
    );
    const { data } = await Promise.race([authPromise, timeoutPromise]);
    user = data?.user || null;
  } catch {
    user = null;
  }

  // 4. Protección de Rutas Administrativas / Dashboard / Workspace
  if (isProtectedRoute) {
    // 4a. Sin sesión activa -> login preservando la URL de destino
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }

    const mustChangePassword = Boolean(user.user_metadata?.must_change_password);
    if (mustChangePassword && pathname !== "/reset-password") {
      const url = request.nextUrl.clone();
      url.pathname = "/reset-password";
      return NextResponse.redirect(url);
    }

    // 4b. Obtener rol de usuario (solo requerido para verificar /admin)
    const authRole = user.app_metadata?.role || user.user_metadata?.role;
    let userRole: string | null = authRole ?? null;
    let userStatus = "active";

    if (pathname.startsWith("/admin") && (!userRole || userRole === "customer")) {
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const { createClient: createAdminClient } = await import("@supabase/supabase-js");
          const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
          );
          const { data: adminProfile } = await supabaseAdmin
            .from("users")
            .select("platform_role, status")
            .eq("id", user.id)
            .maybeSingle();

          userRole = adminProfile?.platform_role ?? userRole;
          userStatus = adminProfile?.status ?? "active";
        } else {
          const { data: adminProfile } = await supabase
            .from("users")
            .select("platform_role, status")
            .eq("id", user.id)
            .maybeSingle();

          userRole = adminProfile?.platform_role ?? userRole;
          userStatus = adminProfile?.status ?? "active";
        }
      } catch {
        userStatus = "active";
      }
    }

    // 4c. Contexto: Plataforma Interna de NEGOVA (/admin) -> SEGURIDAD ESTRICTA
    if (pathname.startsWith("/admin")) {
      const isPlatformAdmin =
        (userRole === "super_admin" || userRole === "admin" || userRole === "staff") &&
        userStatus === "active";

      if (!isPlatformAdmin) {
        const url = request.nextUrl.clone();
        if (
          (userRole === "business_owner" ||
            userRole === "owner" ||
            userRole === "auxiliar" ||
            userRole === "customer") &&
          userStatus === "active"
        ) {
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
        url.pathname = "/login";
        url.searchParams.set("error", "unauthorized");
        return NextResponse.redirect(url);
      }

      // Verificación de Timeout por Inactividad para Administradores Internos (60 min)
      const lastActivityCookie = request.cookies.get("negova_admin_activity")?.value;
      const ADMIN_INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
      const now = Date.now();

      if (lastActivityCookie) {
        const lastActivityTime = parseInt(lastActivityCookie, 10);
        if (!isNaN(lastActivityTime) && now - lastActivityTime > ADMIN_INACTIVITY_LIMIT_MS) {
          await supabase.auth.signOut();
          const url = request.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("error", "session_timeout");
          url.searchParams.set("redirectTo", pathname + request.nextUrl.search);

          const timeoutResponse = NextResponse.redirect(url);
          timeoutResponse.cookies.set({
            name: "negova_admin_activity",
            value: "",
            maxAge: 0,
            path: "/",
          });
          return timeoutResponse;
        }
      }

      response.cookies.set({
        name: "negova_admin_activity",
        value: now.toString(),
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
  }

  // 5. Redirección si el usuario ya está autenticado e intenta ir a páginas de auth públicas
  if (
    isAuthPublicRoute &&
    user &&
    !request.nextUrl.searchParams.has("error") &&
    request.method === "GET"
  ) {
    const returnUrl = request.nextUrl.searchParams.get("redirectTo");
    if (returnUrl && returnUrl.startsWith("/")) {
      const url = request.nextUrl.clone();
      url.pathname = returnUrl;
      url.searchParams.delete("redirectTo");
      return NextResponse.redirect(url);
    }

    const authRole = user.app_metadata?.role || user.user_metadata?.role;
    const url = request.nextUrl.clone();
    url.pathname =
      authRole === "super_admin" || authRole === "admin" || authRole === "staff"
        ? "/admin"
        : "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
};
