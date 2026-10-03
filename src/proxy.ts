import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
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
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Obtener la sesión activa directamente en el Servidor de forma segura
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Inhabilitar y redirigir cualquier intento de acceder a rutas de registro público
  if (pathname === "/register" || pathname === "/registro") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 2. Obtener rol de plataforma si existe un usuario autenticado
  let userRole: string | null = null;
  let userStatus: string | null = null;
  let mustChangePassword = false;

  if (user) {
    const authRole = user.app_metadata?.role || user.user_metadata?.role;
    mustChangePassword = Boolean(user.user_metadata?.must_change_password);

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

      userRole =
        adminProfile?.platform_role === "super_admin" || adminProfile?.platform_role === "admin"
          ? adminProfile.platform_role
          : authRole === "super_admin" || authRole === "admin"
            ? authRole
            : (adminProfile?.platform_role ?? null);
      userStatus = adminProfile?.status ?? "active";
    } else {
      const { data: profile } = await supabase
        .from("users")
        .select("platform_role, status")
        .eq("id", user.id)
        .maybeSingle();

      userRole =
        profile?.platform_role === "super_admin" || profile?.platform_role === "admin"
          ? profile.platform_role
          : authRole === "super_admin" || authRole === "admin"
            ? authRole
            : (profile?.platform_role ?? null);
      userStatus = profile?.status ?? "active";
    }
  }

  // 3. Protección de Rutas Administrativas / Dashboard (Server-side Enforcement)
  const isProtectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname === "/reset-password";

  if (isProtectedRoute) {
    // 3a. Sin sesión → login preservando la URL de destino
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }

    // 3b. Si la cuenta exige cambio obligatorio de contraseña temporal
    if (mustChangePassword && pathname !== "/reset-password") {
      const url = request.nextUrl.clone();
      url.pathname = "/reset-password";
      return NextResponse.redirect(url);
    }

    // 3c. Contexto: Plataforma Interna de NEGOVA (/admin) -> SEGURIDAD ESTRICTA CON TIMEOUT DE INACTIVIDAD
    if (pathname.startsWith("/admin")) {
      const isPlatformAdmin = (userRole === "super_admin" || userRole === "admin" || userRole === "staff") && userStatus === "active";
      if (!isPlatformAdmin) {
        const url = request.nextUrl.clone();
        if (userRole === "business_owner" && userStatus === "active") {
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
        await supabase.auth.signOut();
        url.pathname = "/login";
        url.searchParams.set("error", "unauthorized");
        return NextResponse.redirect(url);
      }

      // Verificación de Timeout por Inactividad para Administradores Internos (Default: 60 min = 3600000ms)
      const lastActivityCookie = request.cookies.get("negova_admin_activity")?.value;
      const ADMIN_INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 60 minutos
      const now = Date.now();

      if (lastActivityCookie) {
        const lastActivityTime = parseInt(lastActivityCookie, 10);
        if (!isNaN(lastActivityTime) && now - lastActivityTime > ADMIN_INACTIVITY_LIMIT_MS) {
          // Sesión administrativa caducada por inactividad
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

      // Actualizar timestamp de última actividad administrativa
      response.cookies.set({
        name: "negova_admin_activity",
        value: now.toString(),
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    } else if (pathname.startsWith("/dashboard")) {
      // 3d. Contexto: Negocio / Tenant (/dashboard) -> OPERACIÓN CONTINUA (SESIÓN PERSISTENTE)
      const allowedRoles = ["super_admin", "business_owner", "owner", "auxiliar", "business_admin", "supervisor", "seller", "cashier"];
      const hasAccess = userRole && allowedRoles.includes(userRole) && userStatus === "active";

      if (!hasAccess) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set(
          "error",
          userStatus && userStatus !== "active" ? "account_disabled" : "no_access"
        );
        return NextResponse.redirect(url);
      }
    }
  }

  // 4. Redirección si el usuario ya está autenticado e intenta ir a páginas de auth públicas
  const isAuthPublicRoute = pathname === "/login" || pathname === "/forgot-password";
  const hasErrorParam = request.nextUrl.searchParams.has("error");

  if (isAuthPublicRoute && user && !hasErrorParam) {
    const returnUrl = request.nextUrl.searchParams.get("redirectTo");
    if (returnUrl && returnUrl.startsWith("/")) {
      const url = request.nextUrl.clone();
      url.pathname = returnUrl;
      url.searchParams.delete("redirectTo");
      return NextResponse.redirect(url);
    }

    const url = request.nextUrl.clone();
    url.pathname = (userRole === "super_admin" || userRole === "admin" || userRole === "staff") ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
