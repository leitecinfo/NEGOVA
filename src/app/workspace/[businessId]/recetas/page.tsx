import React from "react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessLocations, ensureDefaultLocation } from "@/lib/inventory/inventory-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { ChefHat } from "lucide-react";
import { RecetasManagerClient } from "./recetas-manager-client";
import { getMeasurementUnits } from "@/lib/units/units-service";
import { getCategories } from "@/lib/products/products-service";

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

  // Cargar datos concurrentemente en paralelo para velocidad óptima de navegación
  const [locationsRes, categoriesRes, unitsRes] = await Promise.allSettled([
    getBusinessLocations(businessId),
    getCategories(businessId, undefined, "all"),
    getMeasurementUnits(businessId),
  ]);

  let locations = locationsRes.status === "fulfilled" && locationsRes.value ? locationsRes.value : [];
  if (locations.length === 0) {
    try {
      await ensureDefaultLocation(businessId);
      locations = await getBusinessLocations(businessId);
    } catch {
      locations = [];
    }
  }

  // Unidades de medida
  const rawUnits = unitsRes.status === "fulfilled" && unitsRes.value ? unitsRes.value : [];
  const businessUnits = rawUnits.map((u) => ({
    value: u.abbreviation,
    label: `${u.name} (${u.abbreviation})`,
  }));

  // Categorías disponibles filtradas en memoria sin round-trips adicionales
  const allCats = categoriesRes.status === "fulfilled" && categoriesRes.value ? categoriesRes.value : [];
  const internalCats = allCats.filter((c: any) => c.scope === "internal");
  const filteredCats = internalCats.length > 0 ? internalCats : allCats;
  const categories = filteredCats.map((c: any) => ({ id: c.id, name: c.name }));

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
        categories={categories}
      />
    </AppPageContainer>
  );
}
