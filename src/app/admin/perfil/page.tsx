import React from "react";
import { Metadata } from "next";
import { UserCheck } from "lucide-react";
import { requireAdminSession } from "@/lib/auth/admin-context";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { AdminPerfilForm } from "./perfil-form";

export const metadata: Metadata = {
  title: "Mi Perfil de Acceso",
  description: "Gestión de identidad, seguridad y credenciales de acceso a la plataforma NEGOVA",
};

export default async function AdminPerfilPage() {
  const adminUser = await requireAdminSession();

  // Consultar información detallada de perfil desde public.profiles y public.users
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
          .eq("id", adminUser.id)
          .maybeSingle(),
        adminClient
          .from("users")
          .select("created_at")
          .eq("id", adminUser.id)
          .maybeSingle(),
      ]);

      profileRecord = pRes.data;
      userCreatedAt = uRes.data?.created_at;
    }
  } catch (err) {
    console.error("Error cargando detalles del perfil:", err);
  }

  const userData = {
    id: adminUser.id,
    email: adminUser.email,
    fullName: adminUser.fullName,
    avatarUrl: profileRecord?.avatar_url || adminUser.avatarUrl,
    phone: profileRecord?.phone || null,
    bio: profileRecord?.bio || null,
    role: adminUser.role,
    status: adminUser.status,
    createdAt: userCreatedAt || profileRecord?.created_at,
  };

  return (
    <AdminPageContainer
      title="Mi Perfil de Acceso"
      description="Supervise y actualice sus datos personales de administrador, imagen de perfil, credenciales de autenticación y privilegios de plataforma."
      maxWidth="6xl"
      badge={
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-medium">
          <UserCheck className="w-3.5 h-3.5" />
          <span>Sesión Activa</span>
        </div>
      }
    >
      <AdminPerfilForm user={userData} />
    </AdminPageContainer>
  );
}
