/**
 * Conversión de unidades de medida para Recetas y Escandallos [REC-004]
 * 
 * Magnitudes soportadas:
 * - Masa / Peso: kg, g, mg, lb, oz
 * - Volumen: lt, ml, oz_fl
 * - Conteo / Unidades: unidad, porcion, tajada, paquete, docena
 */

export type UnitMagnitude = "weight" | "volume" | "count" | "unknown";

interface UnitDefinition {
  canonical: string;
  magnitude: UnitMagnitude;
  baseFactor: number; // Factor hacia la unidad base de su magnitud (g para peso, ml para volumen, 1 para conteo)
  label: string;
  aliases: string[];
}

const UNIT_DEFINITIONS: UnitDefinition[] = [
  // --- MASA / PESO (Base: Gramo 'g') ---
  {
    canonical: "kg",
    magnitude: "weight",
    baseFactor: 1000,
    label: "Kilogramos (kg)",
    aliases: ["kg", "kilo", "kilos", "kilogramo", "kilogramos"],
  },
  {
    canonical: "g",
    magnitude: "weight",
    baseFactor: 1,
    label: "Gramos (g)",
    aliases: ["g", "gr", "grs", "gramo", "gramos"],
  },
  {
    canonical: "mg",
    magnitude: "weight",
    baseFactor: 0.001,
    label: "Miligramos (mg)",
    aliases: ["mg", "miligramo", "miligramos"],
  },
  {
    canonical: "lb",
    magnitude: "weight",
    baseFactor: 500, // Estándar comercial gastronómico en Colombia (1 libra = 500 gramos)
    label: "Libras (lb)",
    aliases: ["lb", "lbs", "libra", "libras"],
  },
  {
    canonical: "oz",
    magnitude: "weight",
    baseFactor: 28.3495,
    label: "Onzas (oz)",
    aliases: ["oz", "onza", "onzas"],
  },

  // --- VOLUMEN (Base: Mililitro 'ml') ---
  {
    canonical: "lt",
    magnitude: "volume",
    baseFactor: 1000,
    label: "Litros (lt)",
    aliases: ["lt", "l", "litro", "litros"],
  },
  {
    canonical: "ml",
    magnitude: "volume",
    baseFactor: 1,
    label: "Mililitros (ml)",
    aliases: ["ml", "mililitro", "mililitros", "cc"],
  },
  {
    canonical: "oz_fl",
    magnitude: "volume",
    baseFactor: 29.5735,
    label: "Onzas líquidas (fl oz)",
    aliases: ["oz_fl", "oz fl", "fl_oz", "fl oz", "onza liquida", "onzas liquidas"],
  },

  // --- CONTEO / DISCRETO (Base: Unidad 'unidad') ---
  {
    canonical: "unidad",
    magnitude: "count",
    baseFactor: 1,
    label: "Unidad (un)",
    aliases: ["unidad", "un", "und", "unidades", "u", "unit", "units", "botella", "botellas", "bot", "lata", "latas", "rollo", "rollos"],
  },
  {
    canonical: "porcion",
    magnitude: "count",
    baseFactor: 1,
    label: "Porción (porc)",
    aliases: ["porcion", "porc", "porciones", "portion", "tajada", "tajadas", "rebanada", "rebanadas"],
  },
  {
    canonical: "paquete",
    magnitude: "count",
    baseFactor: 1,
    label: "Paquete (paq)",
    aliases: ["paquete", "paquetes", "pqte", "paq", "pack", "caja", "cajas", "cja", "box", "bolsa", "bolsas", "blsa", "bag", "docena", "docenas", "doc"],
  },
];

/**
 * Normaliza un texto de unidad a su identificador canónico y magnitud.
 */
export function getUnitDefinition(rawUnit: string | null | undefined): UnitDefinition | null {
  if (!rawUnit) return null;
  const clean = rawUnit.trim().toLowerCase();
  for (const def of UNIT_DEFINITIONS) {
    if (def.canonical === clean || def.aliases.includes(clean)) {
      return def;
    }
  }
  return null;
}

/**
 * Determina si dos unidades son de la misma magnitud y compatibles entre sí.
 */
export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  if (!unitA || !unitB) return false;
  const cleanA = unitA.trim().toLowerCase();
  const cleanB = unitB.trim().toLowerCase();
  if (cleanA === cleanB) return true;

  const defA = getUnitDefinition(cleanA);
  const defB = getUnitDefinition(cleanB);

  if (!defA || !defB) {
    return cleanA === cleanB;
  }

  // Si son de conteo distinto (ej. tajada vs unidad), son compatibles a razón 1:1 salvo que tengan baseFactor distinto
  if (defA.magnitude === "count" && defB.magnitude === "count") {
    return true;
  }

  return defA.magnitude === defB.magnitude;
}

/**
 * Retorna el factor multiplicador para convertir una cantidad de `fromUnit` a `toUnit`.
 * Ejemplo: getConversionFactor("g", "kg") -> 0.001
 * Ejemplo: getConversionFactor("kg", "g") -> 1000
 * Si no son compatibles, retorna null.
 */
export function getConversionFactor(fromUnit?: string, toUnit?: string): number | null {
  const cleanFrom = (fromUnit || "").trim().toLowerCase();
  const cleanTo = (toUnit || "").trim().toLowerCase();
  if (!cleanFrom || !cleanTo) return null;
  if (cleanFrom === cleanTo) return 1;

  const defFrom = getUnitDefinition(cleanFrom);
  const defTo = getUnitDefinition(cleanTo);

  if (!defFrom || !defTo) {
    return cleanFrom === cleanTo ? 1 : null;
  }

  if (defFrom.magnitude !== defTo.magnitude) {
    return null;
  }

  // factor = (base de from) / (base de to)
  return defFrom.baseFactor / defTo.baseFactor;
}

/**
 * Convierte una cantidad de `fromUnit` hacia `toUnit`.
 * Si no son compatibles, devuelve la cantidad original y marca incompatible.
 */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string
): { convertedQuantity: number; factor: number; isCompatible: boolean; error?: string } {
  if (quantity === 0) {
    return { convertedQuantity: 0, factor: 1, isCompatible: true };
  }

  const factor = getConversionFactor(fromUnit, toUnit);
  if (factor === null) {
    return {
      convertedQuantity: quantity,
      factor: 1,
      isCompatible: false,
      error: `Las unidades «${fromUnit}» y «${toUnit}» pertenecen a magnitudes incompatibles.`,
    };
  }

  return {
    convertedQuantity: Number((quantity * factor).toFixed(6)),
    factor,
    isCompatible: true,
  };
}

/**
 * Calcula el costo de una línea de receta considerando la conversión de unidades entre
 * la unidad de la receta y la unidad en que se compra/almacena el ingrediente.
 * 
 * Ejemplo:
 * - Ingrediente se compra en kg a $20.000 / kg.
 * - Receta usa 120 g.
 * - Cantidad convertida a kg = 120 * 0.001 = 0.12 kg.
 * - Costo subtotal = 0.12 * 20.000 = $2.400.
 * - Costo unitario normalizado en receta = 20.000 * 0.001 = $20 / g.
 */
export function calculateLineCostWithConversion(params: {
  recipeQuantity: number;
  recipeUnit: string;
  ingredientStockUnit: string;
  ingredientUnitCost: number;
}): {
  subtotalCost: number;
  unitCostInRecipeUnit: number;
  quantityInStockUnit: number;
  isCompatible: boolean;
  conversionExplanation?: string;
} {
  const { recipeQuantity, recipeUnit, ingredientStockUnit, ingredientUnitCost } = params;

  if (recipeQuantity <= 0 || ingredientUnitCost <= 0) {
    return {
      subtotalCost: 0,
      unitCostInRecipeUnit: 0,
      quantityInStockUnit: 0,
      isCompatible: true,
    };
  }

  // Factor para llevar de unidad receta a unidad de stock del ingrediente
  const factor = getConversionFactor(recipeUnit, ingredientStockUnit);

  if (factor === null) {
    // Incompatibles (ej. kg con lt)
    return {
      subtotalCost: Number((recipeQuantity * ingredientUnitCost).toFixed(4)),
      unitCostInRecipeUnit: ingredientUnitCost,
      quantityInStockUnit: recipeQuantity,
      isCompatible: false,
      conversionExplanation: `Unidades incompatibles (${recipeUnit} vs ${ingredientStockUnit})`,
    };
  }

  const quantityInStockUnit = Number((recipeQuantity * factor).toFixed(6));
  const subtotalCost = Number((quantityInStockUnit * ingredientUnitCost).toFixed(4));
  const unitCostInRecipeUnit = Number((ingredientUnitCost * factor).toFixed(6));

  const explanation =
    factor !== 1
      ? `${recipeQuantity} ${recipeUnit} = ${quantityInStockUnit} ${ingredientStockUnit}`
      : undefined;

  return {
    subtotalCost,
    unitCostInRecipeUnit,
    quantityInStockUnit,
    isCompatible: true,
    conversionExplanation: explanation,
  };
}

/**
 * Obtiene la lista de unidades compatibles con una unidad dada para alimentar los selectores.
 */
export function getCompatibleUnits(unit: string): { value: string; label: string }[] {
  const def = getUnitDefinition(unit);
  if (!def) {
    return [{ value: unit, label: unit }];
  }
  return UNIT_DEFINITIONS.filter((d) => d.magnitude === def.magnitude).map((d) => ({
    value: d.canonical,
    label: d.label,
  }));
}
