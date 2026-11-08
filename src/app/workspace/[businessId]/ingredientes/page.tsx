import React from "react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessLocations, ensureDefaultLocation } from "@/lib/inventory/inventory-service";
import { getCategories } from "@/lib/products/products-service";
import { getMeasurementUnits } from "@/lib/units/units-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { Apple } from "lucide-react";
import { IngredientesManagerClient } from "./ingredientes-manager-client";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function IngredientesPage({ params }: PageProps) {
  const { businessId } = await params;

  // Verificación adaptable de acceso para cualquier tipo de negocio (gastronomía, comercio, ferretería, farmacia)
  try {
    await requireWorkspaceSession(businessId, "inventory.view");
  } catch {
    try {
      await requireWorkspaceSession(businessId, "products.view");
    } catch {
      await requireWorkspaceSession(businessId, "recipes.view");
    }
  }

  // Cargar datos concurrentemente en paralelo para navegación instantánea
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

  // Categorías de materiales e insumos internos en memoria [CAT-SCOPE-001]
  const allCats = categoriesRes.status === "fulfilled" && categoriesRes.value ? categoriesRes.value : [];
  const internalCats = allCats.filter((c: any) => c.scope === "internal");
  const filteredCats = internalCats.length > 0 ? internalCats : allCats;
  const categories = filteredCats.map((c: any) => ({ id: c.id, name: c.name }));

  // Unidades de medida configuradas del negocio
  const rawUnits = unitsRes.status === "fulfilled" && unitsRes.value ? unitsRes.value : [];
  const businessUnits = rawUnits.map((u) => ({
    value: u.abbreviation,
    label: `${u.name} (${u.abbreviation})`,
  }));

  const badge = (
    <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      <Apple className="w-4 h-4" />
    </div>
  );

  return (
    <AppPageContainer
      title="Ingredientes e Insumos"
      description="Administra materias primas, insumos operativos y empaques inventariables para recetas, compras y existencias."
      badge={badge}
      maxWidth="7xl"
    >
      <IngredientesManagerClient
        businessId={businessId}
        locations={locations}
        availableUnits={businessUnits}
        categories={categories}
      />
    </AppPageContainer>
  );
}

