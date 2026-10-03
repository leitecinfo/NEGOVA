import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { requireAdminSession } from "@/lib/auth/admin-context";
import { getBusinessesAndRolesOptionsAction } from "../actions";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { NuevoUsuarioClient } from "./nuevo-usuario-client";

export const metadata: Metadata = {
  title: "Nuevo Usuario | Panel Administrativo NEGOVA",
  description: "Crear un nuevo usuario de plataforma o asignar personal a un comercio.",
};

export default async function AdminNuevoUsuarioPage() {
  await requireAdminSession();

  const options = await getBusinessesAndRolesOptionsAction();

  return (
    <AdminPageContainer
      title="Crear Nuevo Usuario"
      description="Registra una nueva cuenta de acceso para el equipo interno de NEGOVA o personal de un comercio."
      maxWidth="5xl"
      badge={
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
          <UserPlus className="w-3.5 h-3.5" />
          Alta de Cuenta
        </span>
      }
      actions={
        <Link
          href="/admin/usuarios"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Directorio</span>
        </Link>
      }
    >
      <NuevoUsuarioClient
        platformRoles={options.platformRoles}
        businessRoles={options.businessRoles}
      />
    </AdminPageContainer>
  );
}
