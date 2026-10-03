import React from "react";
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getRoleDetailAction } from "../actions";
import { RoleDetailClient } from "./role-detail-client";
import { AdminPageContainer } from "@/components/admin/admin-page-container";

interface RoleDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: RoleDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Detalle del Rol (${id}) — NEGOVA Admin`,
    description: `Administración de permisos y usuarios asignados para el rol ${id}.`,
  };
}

export default async function RoleDetailPage({ params }: RoleDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Obtener detalle del rol y usuarios asignados desde el servidor
  const detailResponse = await getRoleDetailAction(id);
  if (!detailResponse.success || !detailResponse.role) {
    notFound();
  }

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

  const role = detailResponse.role;

  return (
    <AdminPageContainer
      title={role.name}
      description={role.description}
      badge={
        <span
          className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
            role.scope === "platform"
              ? "bg-orange-500/10 text-[#ED500A] border-orange-500/20"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          }`}
        >
          {role.scope === "platform" ? "Plataforma" : "Negocio"}
        </span>
      }
    >
      <RoleDetailClient
        role={role}
        assignedUsers={detailResponse.assignedUsers || []}
        currentUserRole={currentUserRole}
      />
    </AdminPageContainer>
  );
}
