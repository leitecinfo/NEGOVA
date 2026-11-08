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
        status: "active",
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

      const metadata = {
        product_type: "ingredient",
        material_type: "ingredient",
        unit: row.unit,
        cost: row.cost,
        track_stock: true,
        stock_quantity: row.stock,
        min_stock: row.minStock,
        max_stock: row.maxStock,
        barcode: row.barcode || null,
        sku: row.barcode || null,
        available_in_pos: Boolean(row.mostrarEnPos),
        available_in_qr: Boolean(row.mostrarEnQr),
        available_online: Boolean(row.mostrarEnDomicilios),
      };

      const productPayload: any = {
        business_id: businessId,
        name: row.name.trim(),
        description: row.description || null,
        category_id: targetCategoryId,
        price: 0,
        status: "active",
        is_available: true,
        available_in_pos: Boolean(row.mostrarEnPos),
        available_in_qr: Boolean(row.mostrarEnQr),
        available_online: Boolean(row.mostrarEnDomicilios),
        metadata,
        updated_at: new Date().toISOString(),
      };

      let ingredientId = row.existingIngredientId;

      if (row.action === "update" && ingredientId) {
        // Actualizar existente
        const { error: updateErr } = await supabase
          .from("products")
          .update(productPayload)
          .eq("id", ingredientId)
          .eq("business_id", businessId);

        if (updateErr) throw updateErr;
        updatedCount++;
      } else {
        // Crear nuevo
        productPayload.created_at = new Date().toISOString();
        let { data: createdProd, error: insertErr } = await supabase
          .from("products")
          .insert(productPayload)
          .select("id")
          .single();

        if (
          insertErr &&
          (insertErr.code === "PGRST204" ||
            String(insertErr.message || "").includes("available_in_") ||
            String(insertErr.message || "").includes("available_online"))
        ) {
          delete productPayload.available_in_pos;
          delete productPayload.available_in_qr;
          delete productPayload.available_online;
          const retry = await supabase
            .from("products")
            .insert(productPayload)
            .select("id")
            .single();
          createdProd = retry.data;
          insertErr = retry.error;
        }

        if (insertErr || !createdProd) {
          throw insertErr || new Error("No se pudo crear el ingrediente en el catálogo.");
        }
        ingredientId = createdProd.id;
        createdCount++;
      }

      // 4. Manejo de Stock Inicial en inventory_stock y Kardex
      if (ingredientId && defaultLocId && row.stock > 0 && row.action === "create") {
        await upsertInventoryStock(businessId, {
          productId: ingredientId,
          locationId: defaultLocId,
          quantity: row.stock,
          minStock: row.minStock,
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
      } else if (ingredientId && defaultLocId && row.action === "create") {
        await upsertInventoryStock(businessId, {
          productId: ingredientId,
          locationId: defaultLocId,
          quantity: 0,
          minStock: row.minStock,
          cost: row.cost,
        });
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
