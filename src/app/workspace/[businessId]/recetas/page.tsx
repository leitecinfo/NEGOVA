import React from "react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessLocations, ensureDefaultLocation } from "@/lib/inventory/inventory-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { ChefHat } from "lucide-react";
import { RecetasManagerClient } from "./recetas-manager-client";
import { getMeasurementUnits } from "@/lib/units/units-service";

interface PageProps {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function RecetasPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialTab =
    resolvedSearchParams.tab === "ingredients" ? "ingredients" : "recipes";

  // Validar permisos de acceso al módulo de recetas e ingredientes
  await requireWorkspaceSession(businessId, "recipes.view");

  let locations = await getBusinessLocations(businessId);
  if (!locations || locations.length === 0) {
    await ensureDefaultLocation(businessId);
    locations = await getBusinessLocations(businessId);
  }

  // Cargar unidades de medida configuradas del negocio [CONF-001]
  let businessUnits: { value: string; label: string }[] = [];
  try {
    const rawUnits = await getMeasurementUnits(businessId);
    businessUnits = rawUnits.map((u) => ({
      value: u.abbreviation,
      label: `${u.name} (${u.abbreviation})`,
    }));
  } catch {
    businessUnits = [];
  }

  const badge = (
    <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
      <ChefHat className="w-4 h-4" />
    </div>
  );

  return (
    <AppPageContainer
      title="Recetas"
      description="Crea y gestiona las recetas de tus productos."
      badge={badge}
      maxWidth="7xl"
    >
      <RecetasManagerClient
        businessId={businessId}
        locations={locations}
        initialTab={initialTab}
        availableUnits={businessUnits}
      />
    </AppPageContainer>
  );
}
