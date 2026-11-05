"use client";

import React, { useState } from "react";
import {
  Mail,
  Phone,
  Calendar,
  Building2,
  Shield,
  Info,
  KeyRound,
  ShieldCheck,
  Lock,
  Briefcase,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { UserModel } from "@/lib/auth/users-service";
import { UserEffectivePermissionsDetail } from "@/lib/auth/user-permissions-service";
import { saveUserPermissionsAction, assignUserPinAction } from "../actions";
import { StatusBadge, Button } from "@/components/ui";
import { UserPermissionsMatrixEditor } from "@/components/permissions/user-permissions-matrix-editor";
import { PinAssignModal } from "@/components/security/pin-assign-modal";
import { CargoBadge } from "@/components/usuarios/cargo-badge";
import { AssignCargosModal } from "@/components/usuarios/assign-cargos-modal";

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
  const [hasPin, setHasPin] = useState(Boolean(user.hasSecurityPin));
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [userCargos, setUserCargos] = useState<string[]>(user.cargos || []);
  const [isCargosModalOpen, setIsCargosModalOpen] = useState(false);

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
                <StatusBadge
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

        {/* Sección: Cargos y Funciones Operativas [CARGOS-001] */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#ED500A]" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-900 dark:text-white">
                Cargos y Funciones Operativas
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                ({userCargos.length} asignado{userCargos.length === 1 ? "" : "s"})
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Etiquetas de la función diaria que desempeña en el comercio (ej. Cajero, Mesero). No condicionan los permisos de acceso ni aumentan el consumo de cupos del plan.
            </p>

            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {userCargos.length > 0 ? (
                userCargos.map((cargo) => (
                  <CargoBadge key={cargo} cargo={cargo} size="md" />
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">
                  Sin cargos operativos asignados
                </span>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Briefcase className="w-3.5 h-3.5" />}
            onClick={() => setIsCargosModalOpen(true)}
          >
            {userCargos.length > 0 ? "Modificar Cargos" : "Asignar Cargos"}
          </Button>
        </div>

        {/* Sección: PIN de Seguridad y Autorizaciones [EMP-002] */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#ED500A]" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-900 dark:text-white">
                PIN de Autorización Operativa
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                  hasPin
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
                }`}
              >
                {hasPin ? (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    <span>PIN Configurado</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3" />
                    <span>Sin PIN Asignado</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              PIN de 4 a 6 dígitos numéricos usado para autorizar anulaciones de venta, aperturas de caja o descuentos mayores.
            </p>
          </div>

          <Button
            type="button"
            variant={hasPin ? "outline" : "primary"}
            size="sm"
            leftIcon={<KeyRound className="w-3.5 h-3.5" />}
            onClick={() => setIsPinModalOpen(true)}
          >
            {hasPin ? "Cambiar PIN" : "Asignar PIN"}
          </Button>
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

      {/* Modal para Asignar / Cambiar PIN de Seguridad [EMP-002] */}
      <PinAssignModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={() => setHasPin(true)}
        employeeName={user.fullName}
        hasExistingPin={hasPin}
        onSavePin={(pin) => assignUserPinAction(businessId, user.id, pin)}
      />

      {/* Modal para Asignar / Modificar Cargos Operativos [CARGOS-001] */}
      <AssignCargosModal
        isOpen={isCargosModalOpen}
        onClose={() => setIsCargosModalOpen(false)}
        businessId={businessId}
        userId={user.id}
        userName={user.fullName}
        initialCargos={userCargos}
        onCargosUpdated={(updated) => setUserCargos(updated)}
      />
    </div>
  );
}
