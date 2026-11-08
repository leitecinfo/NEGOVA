"use client";

import React from "react";
import { Location } from "@/lib/inventory/types";
import { IngredientsTab } from "../recetas/ingredients-tab";

interface Props {
  businessId: string;
  locations: Location[];
  availableUnits?: { value: string; label: string }[];
  categories?: { id: string; name: string }[];
}

export function IngredientesManagerClient({
  businessId,
  locations,
  availableUnits,
  categories,
}: Props) {
  return (
    <IngredientsTab
      businessId={businessId}
      locations={locations}
      availableUnits={availableUnits}
      categories={categories}
    />
  );
}

