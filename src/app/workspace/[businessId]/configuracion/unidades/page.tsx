import React, { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Scale, ArrowLeft } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { getMeasurementUnits } from "@/lib/units/units-service";
import { UnitsConfigClient } from "./units-config-client";

export const metadata: Metadata = {
  title: "Unidades y Conversiones | Workspace NEGOVA",
  description:
    "Configuración de unidades de medida y factores de conversión de magnitudes para recetas e inventarios.",
};

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function WorkspaceUnidadesConfigPage({ params }: PageProps) {
  const { businessId } = await params;

  // 1. Autorización de lectura
  const session = await requireWorkspaceSession(businessId, "business_settings.view");

  // 2. Cargar unidades iniciales del comercio (autocrea las del sistema si aún no existen)
  const initialUnits = await getMeasurementUnits(businessId);

  // 3. Permiso de modificación
  const canManage = session.isOwner || session.roleCode === "admin";

  return (
    <AppPageContainer
      title="Unidades y Conversiones"
      description="Configura las unidades de medida oficiales de tu negocio (peso, volumen, longitud, conteo) y define factores de conversión precisos para recetas y control de stock."
      badge={
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${businessId}/configuracion`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Configuración
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400">
            <Scale className="w-3.5 h-3.5" />
            Magnitudes & Equivalencias
          </span>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-slate-500">
            Cargando unidades de medida...
          </div>
        }
      >
        <UnitsConfigClient
          businessId={businessId}
          initialUnits={initialUnits}
          canManage={Boolean(canManage)}
        />
      </Suspense>
    </AppPageContainer>
  );
}
