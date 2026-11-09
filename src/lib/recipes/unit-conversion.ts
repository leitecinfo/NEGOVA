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
  let factor = getConversionFactor(recipeUnit, ingredientStockUnit);
  let crossExplanation: string | undefined = undefined;

  // Si no hay factor de misma magnitud, deducir conversión cruzada gastronómica realista
  if (factor === null) {
    const crossResult = getGastronomicCrossFactor(recipeUnit, ingredientStockUnit);
    if (crossResult) {
      factor = crossResult.factor;
      crossExplanation = crossResult.explanation;
    }
  }

  if (factor === null) {
    // Si no se puede deducir, fallback seguro 1:1 sin bloquear al usuario
    return {
      subtotalCost: Number((recipeQuantity * ingredientUnitCost).toFixed(4)),
      unitCostInRecipeUnit: ingredientUnitCost,
      quantityInStockUnit: recipeQuantity,
      isCompatible: true,
      conversionExplanation: `${recipeQuantity} ${recipeUnit} (conversión directa 1:1)`,
    };
  }

  const quantityInStockUnit = Number((recipeQuantity * factor).toFixed(6));
  const subtotalCost = Number((quantityInStockUnit * ingredientUnitCost).toFixed(4));
  const unitCostInRecipeUnit = Number((ingredientUnitCost * factor).toFixed(6));

  const explanation =
    crossExplanation ||
    (factor !== 1
      ? `${recipeQuantity} ${recipeUnit} = ${quantityInStockUnit} ${ingredientStockUnit}`
      : undefined);

  return {
    subtotalCost,
    unitCostInRecipeUnit,
    quantityInStockUnit,
    isCompatible: true,
    conversionExplanation: explanation,
  };
}

/**
 * Deduce el factor de conversión cruzado gastronómico cuando las magnitudes son distintas.
 * Ejemplos del mundo real:
 * - Lechuga / Verduras compradas en 'unidad': 1 unidad agrícola ≈ 500 g (1 libra) o 10 porciones (0.1 un/porc).
 * - Ingredientes en peso (kg, lb, g) usados en 'porcion': 1 porción gastronómica ≈ 100 g (0.1 kg = 0.2 lb).
 * - Líquidos / Salsas en volumen (ml, lt) vs peso (g, kg): Densidad estándar culinaria 1:1 (1 ml ≈ 1 g, 1 lt ≈ 1 kg).
 */
export function getGastronomicCrossFactor(
  recipeUnit: string,
  stockUnit: string
): { factor: number; explanation: string } | null {
  const cleanRecipe = (recipeUnit || "").trim().toLowerCase();
  const cleanStock = (stockUnit || "").trim().toLowerCase();
  const defRecipe = getUnitDefinition(cleanRecipe);
  const defStock = getUnitDefinition(cleanStock);

  if (!defRecipe || !defStock) return null;

  // 1. Receta en 'porcion' (ración culinaria estimada)
  if (defRecipe.canonical === "porcion") {
    if (defStock.canonical === "unidad" || defStock.canonical === "paquete") {
      // 1 porción ≈ 0.1 de unidad/paquete (rinde 10 porciones por defecto)
      return {
        factor: 0.1,
        explanation: "1 porc ≈ 0.1 unidad",
      };
    }
    if (defStock.canonical === "kg") {
      // 1 porción ≈ 100 g = 0.1 kg
      return {
        factor: 0.1,
        explanation: "1 porc ≈ 100 g (0.1 kg)",
      };
    }
    if (defStock.canonical === "lb") {
      // 1 porción ≈ 100 g = 0.2 lb
      return {
        factor: 0.2,
        explanation: "1 porc ≈ 100 g (0.2 lb)",
      };
    }
    if (defStock.canonical === "g") {
      return {
        factor: 100,
        explanation: "1 porc ≈ 100 g",
      };
    }
    if (defStock.canonical === "lt") {
      // 1 porción líquida/salsa ≈ 30 ml = 0.03 lt
      return {
        factor: 0.03,
        explanation: "1 porc ≈ 30 ml (0.03 lt)",
      };
    }
    if (defStock.canonical === "ml") {
      return {
        factor: 30,
        explanation: "1 porc ≈ 30 ml",
      };
    }
  }

  // 2. Receta en Peso (g, kg, lb, oz) y Stock en Unidad/Paquete (ej. lechuga, verduras compradas por unidad)
  // Estándar gastronómico: 1 unidad agrícola ≈ 500 g (1 libra)
  if (defRecipe.magnitude === "weight" && (defStock.canonical === "unidad" || defStock.canonical === "paquete")) {
    const recipeGrams = defRecipe.baseFactor; // g: 1, kg: 1000, lb: 500, oz: 28.3495
    const unitInGrams = 500; // 1 unidad agrícola = 500g
    const factor = recipeGrams / unitInGrams;
    return {
      factor,
      explanation: `${defRecipe.label} ≈ ${Number(factor.toFixed(4))} un (base 500g/un)`,
    };
  }

  // 3. Receta en Unidad y Stock en Peso (ej. se compra por kg o lb, pero en receta usan 1 unidad de papa/tomate)
  if (defRecipe.canonical === "unidad" && defStock.magnitude === "weight") {
    // 1 unidad ≈ 500 g
    const unitGrams = 500;
    const factor = unitGrams / defStock.baseFactor;
    return {
      factor,
      explanation: `1 un ≈ ${Number(factor.toFixed(2))} ${defStock.canonical}`,
    };
  }

  // 4. Cruce Volumen <-> Peso (Densidad culinaria 1:1 aprox: agua, leche, salsas, caldos)
  if (defRecipe.magnitude === "volume" && defStock.magnitude === "weight") {
    // 1 ml = 1 g
    const recipeMl = defRecipe.baseFactor;
    const stockG = defStock.baseFactor;
    const factor = recipeMl / stockG;
    return {
      factor,
      explanation: `${defRecipe.label} ≈ ${Number(factor.toFixed(3))} ${defStock.canonical} (densidad 1:1)`,
    };
  }
  if (defRecipe.magnitude === "weight" && defStock.magnitude === "volume") {
    // 1 g = 1 ml
    const recipeG = defRecipe.baseFactor;
    const stockMl = defStock.baseFactor;
    const factor = recipeG / stockMl;
    return {
      factor,
      explanation: `${defRecipe.label} ≈ ${Number(factor.toFixed(3))} ${defStock.canonical} (densidad 1:1)`,
    };
  }

  return null;
}

/**
 * Catálogo de unidades gastronómicas estándar para recetas.
 * Incluye porciones, peso exacto, libras, kilos y volumen.
 */
export const GASTRONOMIC_RECIPE_UNITS: {
  value: string;
  label: string;
  description: string;
  magnitude: UnitMagnitude;
}[] = [
  { value: "porcion", label: "Porción (porc)", description: "Ración / a ojo", magnitude: "count" },
  { value: "g", label: "Gramos (g)", description: "Peso exacto en gramos", magnitude: "weight" },
  { value: "lb", label: "Libras (lb)", description: "1 libra = 500 g", magnitude: "weight" },
  { value: "kg", label: "Kilogramos (kg)", description: "1 kilo = 1.000 g", magnitude: "weight" },
  { value: "unidad", label: "Unidad (un)", description: "Pieza o unidad entera", magnitude: "count" },
  { value: "ml", label: "Mililitros (ml)", description: "Volumen / líquidos", magnitude: "volume" },
  { value: "lt", label: "Litros (lt)", description: "1 litro = 1.000 ml", magnitude: "volume" },
  { value: "oz", label: "Onzas (oz)", description: "1 oz ≈ 28.35 g", magnitude: "weight" },
  { value: "paquete", label: "Paquete (paq)", description: "Empaque o pack", magnitude: "count" },
];

/**
 * Obtiene las opciones de unidades recomendadas y disponibles para una línea de receta.
 * Pone primero la unidad nativa del ingrediente y sus afines directas, seguidas del resto.
 */
export function getRecipeUnitOptions(ingredientUnit?: string): {
  value: string;
  label: string;
  description?: string;
}[] {
  const clean = (ingredientUnit || "").trim().toLowerCase();
  const def = getUnitDefinition(clean);

  // Ordenar priorizando la unidad nativa y las afines a la magnitud del ingrediente
  const sorted = [...GASTRONOMIC_RECIPE_UNITS].sort((a, b) => {
    if (a.value === def?.canonical) return -1;
    if (b.value === def?.canonical) return 1;
    if (def && a.magnitude === def.magnitude && b.magnitude !== def.magnitude) return -1;
    if (def && b.magnitude === def.magnitude && a.magnitude !== def.magnitude) return 1;
    return 0;
  });

  return sorted.map((u) => ({
    value: u.value,
    label: u.label,
    description: u.description,
  }));
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
