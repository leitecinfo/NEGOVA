import { getDbClient } from "./recipe-service";
import { ensureDefaultLocation, recordInventoryMovement, upsertInventoryStock } from "@/lib/inventory/inventory-service";
import {
  ValidatedIngredientRow,
  ImportIngredientsBatchResult,
} from "./ingredient-import-parser";

export * from "./ingredient-import-parser";

// ==========================================
// IMPORTACIÓN EN LOTE (BATCH EXECUTION)
// ==========================================

export async function importIngredientsBatch(
  businessId: string,
  rows: ValidatedIngredientRow[],
  locationId?: string | null,
  userId?: string | null
): Promise<ImportIngredientsBatchResult> {
  const supabase = await getDbClient();

  // 1. Resolver ubicación
  let defaultLocId = locationId;
  if (!defaultLocId) {
    const defLoc = await ensureDefaultLocation(businessId);
    defaultLocId = defLoc.id;
  }

  // 2. Resolver o autogenerar categorías
  const { data: existingCats } = await supabase
    .from("categories")
    .select("id, name")
    .eq("business_id", businessId);

  const catMap = new Map<string, string>();
  if (existingCats) {
    for (const c of existingCats) {
      catMap.set(c.name.trim().toLowerCase(), c.id);
    }
  }

  // Identificar categorías faltantes requeridas por las filas válidas
  const missingCatNames = new Set<string>();
  for (const r of rows) {
    if (r.categoryName && !r.categoryId) {
      const cleanName = r.categoryName.trim();
      if (!catMap.has(cleanName.toLowerCase())) {
        missingCatNames.add(cleanName);
      }
    }
  }

  // Crear categorías faltantes si no existen
  for (const newCatName of missingCatNames) {
    const { data: createdCat, error: catError } = await supabase
      .from("categories")
      .insert({
        business_id: businessId,
        name: newCatName,
        is_active: true,
      })
      .select("id, name")
      .single();

    if (!catError && createdCat) {
      catMap.set(createdCat.name.trim().toLowerCase(), createdCat.id);
    }
  }

  // 3. Procesar ingredientes uno a uno o en micro-lotes
  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const errors: Array<{ rowNumber: number; name: string; error: string }> = [];

  for (const row of rows) {
    try {
      // Resolver categoría definitiva
      let targetCategoryId: string | null = row.categoryId || null;
      if (!targetCategoryId && row.categoryName) {
        targetCategoryId = catMap.get(row.categoryName.trim().toLowerCase()) || null;
      }

      const itemData: any = {
        business_id: businessId,
        name: row.name,
        description: row.description,
        category_id: targetCategoryId,
        cost: row.cost,
        cost_unit: row.unit,
        price: row.price,
        unit: row.unit,
        min_stock: row.minStock,
        max_stock: row.maxStock,
        is_active: true,
        item_type: "raw_material",
        metadata: {
          barcode: row.barcode,
          sku: row.barcode,
          mostrar_en_pos: row.mostrarEnPos,
          mostrar_en_qr: row.mostrarEnQr,
          mostrar_en_mesas: row.mostrarEnMesas,
          mostrar_en_domicilios: row.mostrarEnDomicilios,
        },
        updated_at: new Date().toISOString(),
      };

      let ingredientId = row.existingIngredientId;

      if (row.action === "update" && ingredientId) {
        // Actualizar existente
        const { error: updateErr } = await supabase
          .from("restaurant_items")
          .update(itemData)
          .eq("id", ingredientId)
          .eq("business_id", businessId);

        if (updateErr) throw updateErr;
        updatedCount++;
      } else {
        // Crear nuevo
        itemData.created_at = new Date().toISOString();
        const { data: createdItem, error: insertErr } = await supabase
          .from("restaurant_items")
          .insert(itemData)
          .select("id")
          .single();

        if (insertErr || !createdItem) throw insertErr || new Error("No se pudo crear el ingrediente.");
        ingredientId = createdItem.id;
        createdCount++;
      }

      // 4. Manejo de Stock Inicial si viene especificado y es mayor que 0
      if (ingredientId && defaultLocId && row.stock > 0 && row.action === "create") {
        await upsertInventoryStock(businessId, {
          productId: ingredientId,
          locationId: defaultLocId,
          quantity: row.stock,
          cost: row.cost,
        });

        await recordInventoryMovement(
          businessId,
          {
            productId: ingredientId,
            locationId: defaultLocId,
            movementType: "entry",
            quantity: row.stock,
            unitCost: row.cost,
            notes: "Inventario inicial por importación masiva de ingredientes",
          },
          userId || undefined
        );
      }
    } catch (err: any) {
      failedCount++;
      errors.push({
        rowNumber: row.rowNumber,
        name: row.name,
        error: err.message || "Error al procesar registro",
      });
    }
  }

  return {
    success: failedCount === 0,
    createdCount,
    updatedCount,
    failedCount,
    errors,
    message: `Procesamiento completado: ${createdCount} creados, ${updatedCount} actualizados, ${failedCount} fallidos.`,
  };
}
