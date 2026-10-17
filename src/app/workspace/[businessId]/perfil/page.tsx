import React from "react";
import { Metadata } from "next";
import { UserCheck } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspacePerfilClient } from "./workspace-perfil-client";

export const metadata: Metadata = {
  title: "Mi Perfil de Acceso | Workspace NEGOVA",
  description: "Gestión de identidad, seguridad y credenciales de acceso dentro de tu comercio.",
};

export default async function WorkspacePerfilPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización de sesión en el negocio (roles: owner, auxiliar, etc.)
  const session = await requireWorkspaceSession(businessId, "none");

  // 2. Consultar información de perfil personal desde public.profiles y public.users
  let profileRecord: {
    phone: string | null;
    bio: string | null;
    avatar_url: string | null;
    created_at?: string;
  } | null = null;

  let userCreatedAt: string | undefined = undefined;

  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const [pRes, uRes] = await Promise.all([
        adminClient
          .from("profiles")
          .select("phone, bio, avatar_url, created_at")
          .eq("id", session.userId)
          .maybeSingle(),
        adminClient
          .from("users")
          .select("created_at")
          .eq("id", session.userId)
          .maybeSingle(),
      ]);

      profileRecord = pRes.data;
      userCreatedAt = uRes.data?.created_at;
    }
  } catch (err) {
    console.error("[WorkspacePerfilPage] Error cargando detalles del perfil:", err);
  }

  const userData = {
    id: session.userId,
    email: session.userEmail,
    fullName: session.userEmail.split("@")[0], // Fallback base si no tiene nombre
    avatarUrl: profileRecord?.avatar_url || null,
    phone: profileRecord?.phone || null,
    bio: profileRecord?.bio || null,
    roleCode: session.roleCode,
    roleName: session.roleName,
    businessName: session.businessName,
    isOwner: session.isOwner,
    createdAt: userCreatedAt || profileRecord?.created_at,
  };

  // Si profiles tiene nombre, asignarlo
  if (profileRecord) {
    try {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data: pName } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("id", session.userId)
        .maybeSingle();
      if (pName?.full_name) {
        userData.fullName = pName.full_name;
      }
    } catch {
      // Ignorar fallback
    }
  }

  return (
    <AppPageContainer
      title="Mi Perfil de Acceso"
      description="Supervise y actualice sus datos personales, imagen de perfil y credenciales de autenticación dentro del comercio."
      maxWidth="6xl"
      badge={
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-medium">
          <UserCheck className="w-3.5 h-3.5" />
          <span>Sesión en Comercio</span>
        </div>
      }
    >
      <WorkspacePerfilClient businessId={session.businessId} user={userData} />
    </AppPageContainer>
  );
}
