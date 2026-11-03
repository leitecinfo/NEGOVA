"use client";

import React, { useState } from "react";
import { ChefHat, Apple } from "lucide-react";
import { Location } from "@/lib/inventory/types";
import { RecipesTab } from "./recipes-tab";
import { IngredientsTab } from "./ingredients-tab";

interface Props {
  businessId: string;
  locations: Location[];
  initialTab?: "recipes" | "ingredients";
  availableUnits?: { value: string; label: string }[];
}

export function RecetasManagerClient({
  businessId,
  locations,
  initialTab = "recipes",
  availableUnits,
}: Props) {
  const [activeTab, setActiveTab] = useState<"recipes" | "ingredients">(initialTab);

  return (
    <div className="space-y-6">
      {/* Selector de Pestañas */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("recipes")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "recipes"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <ChefHat className="w-4 h-4" />
          Recetas
        </button>

        <button
          onClick={() => setActiveTab("ingredients")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "ingredients"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Apple className="w-4 h-4" />
          Ingredientes
        </button>
      </div>

      {/* Vista de la Pestaña Activa */}
      {activeTab === "recipes" ? (
        <RecipesTab
          businessId={businessId}
          locations={locations}
          availableUnits={availableUnits}
        />
      ) : (
        <IngredientsTab
          businessId={businessId}
          locations={locations}
          availableUnits={availableUnits}
        />
      )}
    </div>
  );
}

