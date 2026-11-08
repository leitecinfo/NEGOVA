import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  MeasurementUnit,
  MeasurementUnitType,
  CreateMeasurementUnitInput,
  CreateMeasurementUnitSchema,
  UpdateMeasurementUnitInput,
  UpdateMeasurementUnitSchema,
} from "./types";

async function getSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return await createClient();
}

/**
 * Semilla de unidades base y derivadas del sistema para un comercio.
 */
export async function seedDefaultMeasurementUnits(businessId: string): Promise<void> {
  const supabase = await getSupabase();

  // Verificar si ya existen unidades
  const { count } = await supabase
    .from("measurement_units")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  if (count && count > 0) {
    return;
  }

  // 1. Peso (Base: Kilogramo)
  const { data: kgData } = await supabase
    .from("measurement_units")
    .insert({
      business_id: businessId,
      name: "Kilogramo",
      abbreviation: "kg",
      type: "weight",
      is_base: true,
      conversion_factor: 1.0,
      is_system: true,
    })
    .select("id")
    .single();

  if (kgData?.id) {
    await supabase.from("measurement_units").insert({
      business_id: businessId,
      name: "Gramo",
      abbreviation: "g",
      type: "weight",
      is_base: false,
      conversion_factor: 0.001,
      base_unit_id: kgData.id,
      is_system: true,
    });
  }

  // 2. Volumen (Base: Litro)
  const { data: ltData } = await supabase
    .from("measurement_units")
    .insert({
      business_id: businessId,
      name: "Litro",
      abbreviation: "lt",
      type: "volume",
      is_base: true,
      conversion_factor: 1.0,
      is_system: true,
    })
    .select("id")
    .single();

  if (ltData?.id) {
    await supabase.from("measurement_units").insert({
      business_id: businessId,
      name: "Mililitro",
      abbreviation: "ml",
      type: "volume",
      is_base: false,
      conversion_factor: 0.001,
      base_unit_id: ltData.id,
      is_system: true,
    });
  }

  // 3. Longitud (Base: Metro)
  const { data: mData } = await supabase
    .from("measurement_units")
    .insert({
      business_id: businessId,
      name: "Metro",
      abbreviation: "m",
      type: "length",
      is_base: true,
      conversion_factor: 1.0,
      is_system: true,
    })
    .select("id")
    .single();

  if (mData?.id) {
    await supabase.from("measurement_units").insert({
      business_id: businessId,
      name: "Centímetro",
      abbreviation: "cm",
      type: "length",
      is_base: false,
      conversion_factor: 0.01,
      base_unit_id: mData.id,
      is_system: true,
    });
  }

  // 4. Conteo (Base: Unidad)
  const { data: unData } = await supabase
    .from("measurement_units")
    .insert({
      business_id: businessId,
      name: "Unidad",
      abbreviation: "un",
      type: "count",
      is_base: true,
      conversion_factor: 1.0,
      is_system: true,
    })
    .select("id")
    .single();

  if (unData?.id) {
    await supabase.from("measurement_units").insert([
      {
        business_id: businessId,
        name: "Porción",
        abbreviation: "porc",
        type: "count",
        is_base: false,
        conversion_factor: 1.0,
        base_unit_id: unData.id,
        is_system: true,
      },
      {
        business_id: businessId,
        name: "Paquete",
        abbreviation: "paq",
        type: "count",
        is_base: false,
        conversion_factor: 1.0,
        base_unit_id: unData.id,
        is_system: true,
      },
    ]);
  }
}

/**
 * Consulta la lista de unidades de medida configuradas para el comercio.
 */
export async function getMeasurementUnits(
  businessId: string,
  filterType?: MeasurementUnitType
): Promise<MeasurementUnit[]> {
  const supabase = await getSupabase();

  let query = supabase
    .from("measurement_units")
    .select(
      `
      *,
      base_unit:base_unit_id (name, abbreviation)
    `
    )
    .eq("business_id", businessId)
    .order("is_base", { ascending: false })
    .order("name", { ascending: true });

  if (filterType) {
    query = query.eq("type", filterType);
  }

  try {
    const { data, error } = await query;
    if (error) {
      console.warn("Aviso: No se pudieron consultar unidades de medida:", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      abbreviation: row.abbreviation,
      type: row.type as MeasurementUnitType,
      isBase: Boolean(row.is_base),
      conversionFactor: Number(row.conversion_factor),
      baseUnitId: row.base_unit_id || null,
      baseUnitName: row.base_unit?.name || null,
      baseUnitAbbreviation: row.base_unit?.abbreviation || null,
      isSystem: Boolean(row.is_system),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (err: any) {
    console.warn("Excepción al consultar unidades de medida:", err?.message);
    return [];
  }
}

/**
 * Registra una nueva unidad de medida con su factor de conversión.
 */
export async function createMeasurementUnit(
  businessId: string,
  rawInput: CreateMeasurementUnitInput
): Promise<MeasurementUnit> {
  const validated = CreateMeasurementUnitSchema.parse(rawInput);
  const supabase = await getSupabase();

  const abbreviation = validated.abbreviation.trim().toLowerCase();
  const name = validated.name.trim();

  // Validar unicidad de abreviación en el comercio
  const { data: existing } = await supabase
    .from("measurement_units")
    .select("id")
    .eq("business_id", businessId)
    .eq("abbreviation", abbreviation)
    .maybeSingle();

  if (existing) {
    throw new Error(`Ya existe una unidad con la abreviación «${abbreviation}» en este negocio.`);
  }

  let baseUnitId = validated.baseUnitId || null;

  // Si no es base y no se suministró baseUnitId, buscar la unidad base del tipo correspondiente
  if (!validated.isBase && !baseUnitId) {
    const { data: baseRow } = await supabase
      .from("measurement_units")
      .select("id")
      .eq("business_id", businessId)
      .eq("type", validated.type)
      .eq("is_base", true)
      .maybeSingle();

    if (baseRow?.id) {
      baseUnitId = baseRow.id;
    }
  }

  const { data, error } = await supabase
    .from("measurement_units")
    .insert({
      business_id: businessId,
      name,
      abbreviation,
      type: validated.type,
      is_base: Boolean(validated.isBase),
      conversion_factor: validated.conversionFactor,
      base_unit_id: validated.isBase ? null : baseUnitId,
      is_system: false,
    })
    .select(
      `
      *,
      base_unit:base_unit_id (name, abbreviation)
    `
    )
    .single();

  if (error || !data) {
    throw new Error(`No se pudo crear la unidad de medida: ${error?.message || "Error desconocido"}`);
  }

  return {
    id: data.id,
    businessId: data.business_id,
    name: data.name,
    abbreviation: data.abbreviation,
    type: data.type as MeasurementUnitType,
    isBase: Boolean(data.is_base),
    conversionFactor: Number(data.conversion_factor),
    baseUnitId: data.base_unit_id || null,
    baseUnitName: data.base_unit?.name || null,
    baseUnitAbbreviation: data.base_unit?.abbreviation || null,
    isSystem: Boolean(data.is_system),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Actualiza los datos de una unidad de medida.
 */
export async function updateMeasurementUnit(
  businessId: string,
  unitId: string,
  rawInput: UpdateMeasurementUnitInput
): Promise<MeasurementUnit> {
  const validated = UpdateMeasurementUnitSchema.parse(rawInput);
  const supabase = await getSupabase();

  // Validar pertenencia
  const { data: unitRow } = await supabase
    .from("measurement_units")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", unitId)
    .maybeSingle();

  if (!unitRow) {
    throw new Error("La unidad de medida no fue encontrada.");
  }

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (validated.name !== undefined) {
    updatePayload.name = validated.name.trim();
  }

  if (validated.abbreviation !== undefined) {
    const abbrev = validated.abbreviation.trim().toLowerCase();
    // Validar que no choque con otra unidad
    const { data: dup } = await supabase
      .from("measurement_units")
      .select("id")
      .eq("business_id", businessId)
      .eq("abbreviation", abbrev)
      .neq("id", unitId)
      .maybeSingle();

    if (dup) {
      throw new Error(`La abreviación «${abbrev}» ya está en uso por otra unidad.`);
    }

    updatePayload.abbreviation = abbrev;
  }

  if (validated.conversionFactor !== undefined) {
    // Si es unidad base, su factor debe permanecer 1.0
    if (unitRow.is_base && validated.conversionFactor !== 1.0) {
      throw new Error("Las unidades base deben tener factor de conversión 1.0.");
    }
    updatePayload.conversion_factor = validated.conversionFactor;
  }

  if (validated.baseUnitId !== undefined && !unitRow.is_base) {
    updatePayload.base_unit_id = validated.baseUnitId || null;
  }

  const { data, error } = await supabase
    .from("measurement_units")
    .update(updatePayload)
    .eq("business_id", businessId)
    .eq("id", unitId)
    .select(
      `
      *,
      base_unit:base_unit_id (name, abbreviation)
    `
    )
    .single();

  if (error || !data) {
    throw new Error(`Error al actualizar unidad: ${error?.message || "No se pudo actualizar"}`);
  }

  return {
    id: data.id,
    businessId: data.business_id,
    name: data.name,
    abbreviation: data.abbreviation,
    type: data.type as MeasurementUnitType,
    isBase: Boolean(data.is_base),
    conversionFactor: Number(data.conversion_factor),
    baseUnitId: data.base_unit_id || null,
    baseUnitName: data.base_unit?.name || null,
    baseUnitAbbreviation: data.base_unit?.abbreviation || null,
    isSystem: Boolean(data.is_system),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Verifica si una unidad de medida está actualmente en uso en recetas o ingredientes.
 */
export async function checkUnitUsage(
  businessId: string,
  unitAbbreviation: string
): Promise<{ inUse: boolean; count: number; details: string[] }> {
  const supabase = await getSupabase();
  const details: string[] = [];
  let count = 0;

  // 1. Verificar en ingredientes de recetas (recipe_ingredients)
  const { data: recipeIngs } = await supabase
    .from("recipe_ingredients")
    .select(
      `
      id,
      quantity,
      unit,
      recipe:recipe_id (name, business_id)
    `
    )
    .ilike("unit", unitAbbreviation);

  const matchedRecipeIngs = (recipeIngs || []).filter(
    (ri: any) => ri.recipe?.business_id === businessId
  );

  if (matchedRecipeIngs.length > 0) {
    count += matchedRecipeIngs.length;
    details.push(`${matchedRecipeIngs.length} ingrediente(s) en recetas`);
  }

  // 2. Verificar en productos / ingredientes del catálogo (products.unit)
  const { data: prodUnits } = await supabase
    .from("products")
    .select("id, name")
    .eq("business_id", businessId)
    .ilike("unit", unitAbbreviation);

  if (prodUnits && prodUnits.length > 0) {
    count += prodUnits.length;
    details.push(`${prodUnits.length} producto(s) en catálogo`);
  }

  return {
    inUse: count > 0,
    count,
    details,
  };
}

/**
 * Elimina una unidad de medida si no es del sistema ni está en uso.
 */
export async function deleteMeasurementUnit(
  businessId: string,
  unitId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await getSupabase();

  // 1. Consultar unidad
  const { data: unit } = await supabase
    .from("measurement_units")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", unitId)
    .maybeSingle();

  if (!unit) {
    throw new Error("Unidad de medida no encontrada.");
  }

  // 2. Validar que no sea unidad del sistema ni unidad base
  if (unit.is_system || unit.is_base) {
    throw new Error("Las unidades base predeterminadas del sistema no pueden ser eliminadas.");
  }

  // 3. Validar que no esté en uso por ingredientes ni productos
  const usage = await checkUnitUsage(businessId, unit.abbreviation);
  if (usage.inUse) {
    throw new Error(
      `No se puede eliminar la unidad «${unit.name} (${unit.abbreviation})» porque está en uso en ${usage.details.join(", ")}.`
    );
  }

  // 4. Proceder con la eliminación
  const { error } = await supabase
    .from("measurement_units")
    .delete()
    .eq("business_id", businessId)
    .eq("id", unitId);

  if (error) {
    throw new Error(`Error al eliminar unidad: ${error.message}`);
  }

  return {
    success: true,
    message: `La unidad «${unit.name}» fue eliminada exitosamente.`,
  };
}

/**
 * Convierte un valor de cantidad entre dos unidades del mismo tipo.
 */
export function convertMeasurementQuantity(
  fromUnit: MeasurementUnit,
  toUnit: MeasurementUnit,
  quantity: number
): number {
  if (fromUnit.type !== toUnit.type) {
    throw new Error(`No se puede convertir entre tipos incompatibles (${fromUnit.type} y ${toUnit.type})`);
  }

  if (fromUnit.id === toUnit.id || fromUnit.abbreviation === toUnit.abbreviation) {
    return quantity;
  }

  // Convertir a unidad base, y luego de base a unidad destino
  const quantityInBase = quantity * fromUnit.conversionFactor;
  const targetQuantity = quantityInBase / toUnit.conversionFactor;

  return Number(targetQuantity.toFixed(6));
}
