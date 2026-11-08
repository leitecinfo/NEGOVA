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
  categories?: { id: string; name: string }[];
}

export function RecetasManagerClient({
  businessId,
  locations,
  initialTab = "recipes",
  availableUnits,
  categories,
}: Props) {
  const [activeTab, setActiveTab] = useState<"recipes" | "ingredients">(initialTab);

  return (
    <div className="space-y-6">
      {/* Selector de Pestañas (Estilo Productos / Inventario) */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-white/[0.08] pb-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("recipes")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "recipes"
              ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
          }`}
        >
          <ChefHat className="w-4 h-4" />
          <span>Recetas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ingredients")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "ingredients"
              ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
          }`}
        >
          <Apple className="w-4 h-4" />
          <span>Ingredientes e Insumos</span>
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
          categories={categories}
        />
      )}
    </div>
  );
}

