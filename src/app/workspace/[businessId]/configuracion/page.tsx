import React, { Suspense } from "react";
import { Metadata } from "next";
import { Settings } from "lucide-react";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspaceConfiguracionClient } from "./workspace-configuracion-client";
import { getBusinessProductCount } from "@/lib/products/products-service";
import { NEGOVA_PLANS, PlanId } from "@/config/plans";
import { getEnabledFeaturesForBusiness } from "@/config/commercial-activities";

export const metadata: Metadata = {
  title: "Configuración del Negocio | Workspace NEGOVA",
  description: "Administra la identidad corporativa, datos de contacto, marca y comprobantes de tu negocio.",
};

export default async function WorkspaceConfiguracionRootPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización multi-tenant con guard central
  const session = await requireWorkspaceSession(businessId, "business_settings.view");

  // 2. Obtener configuración documental persistida
  const config = await getBusinessDocumentConfig(businessId);

  // 3. Datos para Tab "Mi negocio": conteo de usuarios y productos
  let activeUserCount = 0;
  let activeProductCount = 0;

  try {
    // Conteo de productos (sin archivar)
    activeProductCount = await getBusinessProductCount(businessId);
  } catch {
    activeProductCount = 0;
  }

  try {
    // Conteo de usuarios activos usando el cliente de servidor autenticado
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { count } = await adminClient
      .from("business_users")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "active");
    activeUserCount = count || 0;
  } catch {
    activeUserCount = 0;
  }

  // 4. Plan y funcionalidades
  const planDef = NEGOVA_PLANS[session.planId as PlanId] || NEGOVA_PLANS.inicio;
  const enabledFeatures = session.enabledFeatures;

  // 5. Settings actuales del negocio provenientes del contexto
  const businessSettings = session.businessSettings || {};

  return (
    <AppPageContainer
      title="Configuración del Negocio"
      description="Administra la identidad comercial, datos de contacto, personalización visual y comprobantes emitidos."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400">
          <Settings className="w-3.5 h-3.5" />
          Ajustes del Comercio
        </span>
      }
    >
      <Suspense fallback={<div className="py-12 text-center text-sm text-slate-500">Cargando configuración...</div>}>
        <WorkspaceConfiguracionClient
          businessId={session.businessId}
          businessName={session.businessName}
          userRole={session.roleCode}
          isOwner={session.isOwner}
          initialConfig={config}
          businessType={session.businessType || "fast_food"}
          commercialActivities={session.commercialActivities}
          planId={session.planId}
          planDef={planDef}
          planLimits={session.planLimits}
          enabledFeatures={enabledFeatures}
          activeUserCount={activeUserCount}
          activeProductCount={activeProductCount}
          businessSettings={businessSettings}
          businessCurrency={session.businessCurrency || "COP"}
          businessTimezone={session.businessTimezone || "America/Bogota"}
        />
      </Suspense>
    </AppPageContainer>
  );
}
