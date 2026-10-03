import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { UserPlus, ShieldCheck } from "lucide-react";
import { requireAdminSession } from "@/lib/auth/admin-context";
import { getUsersList } from "@/lib/auth/users-service";
import { getBusinessesAndRolesOptionsAction } from "./actions";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { UsuariosClient } from "./usuarios-client";

export const metadata: Metadata = {
  title: "Gestión de Usuarios | Panel Administrativo NEGOVA",
  description:
    "Administración global de identidades, perfiles, asignación de roles y estados de cuenta en NEGOVA y comercios asociados.",
};

export default async function AdminUsuariosPage() {
  const session = await requireAdminSession();

  // 1. Obtener listado inicial de usuarios en el servidor
  let initialData = null;
  let businesses: Array<{ id: string; name: string; slug: string; status: string }> = [];

  try {
    const [usersResult, optionsResult] = await Promise.all([
      getUsersList({ page: 1, pageSize: 10, scope: "all" }),
      getBusinessesAndRolesOptionsAction(),
    ]);

    initialData = usersResult;
    if (optionsResult.success) {
      businesses = optionsResult.businesses;
    }
  } catch (err) {
    console.error("[AdminUsuariosPage Server Fetch Error]:", err);
  }

  return (
    <AdminPageContainer
      title="Usuarios"
      description="Administra los usuarios de NEGOVA y los usuarios pertenecientes a los negocios."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          Directorio Seguro
        </span>
      }
      actions={
        <Link
          href="/admin/usuarios/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#D44405] text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer font-body active:scale-[0.98]"
        >
          <UserPlus className="w-4 h-4" />
          <span>Crear Usuario</span>
        </Link>
      }
    >
      <UsuariosClient
        initialData={initialData}
        businesses={businesses}
        currentUserId={session.id}
        isSuperAdmin={session.isSuperAdmin}
      />
    </AdminPageContainer>
  );
}
