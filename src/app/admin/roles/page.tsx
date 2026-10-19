import React from "react";
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getRolesListAction } from "./actions";
import { RolesClient } from "./roles-client";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import Link from "next/link";
import { Sliders } from "lucide-react";

export const metadata: Metadata = {
  title: "Roles y Permisos — NEGOVA Admin",
  description: "Administra los roles y las capacidades de acceso dentro de NEGOVA.",
};

export default async function AdminRolesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Obtener roles reales del servidor
  const rolesResponse = await getRolesListAction();
  const roles = rolesResponse.success ? rolesResponse.data : [];

  // Obtener rol del usuario actual
  let currentUserRole = "super_admin";
  const { data: dbUser } = await supabase
    .from("users")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();

  if (dbUser?.platform_role) {
    currentUserRole = dbUser.platform_role;
  }

  return (
    <AdminPageContainer
      title="Roles y permisos"
      description="Administra los roles y las capacidades de acceso dentro de NEGOVA."
      actions={
        <Link
          href="/admin/configuracion?tab=usuarios-acceso"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-[#ED500A]/40 hover:text-[#ED500A] transition-all shadow-2xs"
        >
          <Sliders className="w-3.5 h-3.5 text-[#ED500A]" />
          <span>Políticas Globales de Acceso</span>
        </Link>
      }
    >
      <RolesClient initialRoles={roles} currentUserRole={currentUserRole} />
    </AdminPageContainer>
  );
}
