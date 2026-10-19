"use client";

import React, { useState } from "react";
import {
  Mail,
  Phone,
  Calendar,
  Building2,
  Shield,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { UserModel } from "@/lib/auth/users-service";
import { UserEffectivePermissionsDetail } from "@/lib/auth/user-permissions-service";
import { saveUserPermissionsAction } from "../actions";
import { AdminStatusBadge } from "@/components/admin/ui";
import { UserPermissionsMatrixEditor } from "@/components/permissions/user-permissions-matrix-editor";

interface WorkspaceUserDetailClientProps {
  user: UserModel;
  businessId: string;
  businessName: string;
  isOwner: boolean;
  initialPermissions: UserEffectivePermissionsDetail | null;
}

export function WorkspaceUserDetailClient({
  user,
  businessId,
  businessName,
  isOwner,
  initialPermissions,
}: WorkspaceUserDetailClientProps) {
  const [permissionsData, setPermissionsData] = useState<UserEffectivePermissionsDetail | null>(
    initialPermissions
  );

  const handleSavePermissions = async (granted: string[], revoked: string[]) => {
    const res = await saveUserPermissionsAction(businessId, user.id, granted, revoked);
    if (res.success) {
      toast.success(`Permisos individuales de ${user.fullName} guardados correctamente.`);
      return res;
    } else {
      toast.error(res.error || "No fue posible guardar los permisos.");
      throw new Error(res.error || "Error al guardar permisos.");
    }
  };

  const isTargetOwner = user.primaryRole.code === "owner";

  return (
    <div className="space-y-6 font-body">
      {/* 1. TARJETA PRINCIPAL DE PERFIL DEL TRABAJADOR */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Avatar e Identidad */}
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center font-title text-xl sm:text-2xl font-bold text-slate-800 dark:text-white shrink-0 shadow-xs">
              {user.fullName.charAt(0).toUpperCase()}
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold font-title text-slate-900 dark:text-white truncate">
                  {user.fullName}
                </h2>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${user.primaryRole.badgeColor}`}
                >
                  {user.primaryRole.name}
                </span>
                <AdminStatusBadge
                  status={user.status}
                  label={
                    user.status === "active"
                      ? "Activo"
                      : user.status === "blocked"
                      ? "Bloqueado"
                      : "Deshabilitado"
                  }
                />
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap font-mono">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {user.email}
                </span>
                {user.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {user.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {businessName}
                </span>
                {user.createdAt && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Alta: {new Date(user.createdAt).toLocaleDateString("es-CO")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MATRIZ DE PERMISOS EFECTIVOS (DISEÑO UNIFICADO CON ADMIN) */}
      {permissionsData ? (
        <UserPermissionsMatrixEditor
          permissionsData={permissionsData}
          userName={user.fullName}
          userRoleName={user.primaryRole.name}
          isOwnerOrSuperAdmin={isTargetOwner}
          isCurrentUser={false}
          canEdit={isOwner && !isTargetOwner}
          onSave={handleSavePermissions}
          onPermissionsUpdated={setPermissionsData}
        />
      ) : (
        <div className="p-8 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] text-center space-y-3">
          <Shield className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Sin matriz de permisos disponible
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            No se pudo calcular el desglose de permisos para este usuario en el comercio. Verifique que la membresía esté activa.
          </p>
        </div>
      )}
    </div>
  );
}
