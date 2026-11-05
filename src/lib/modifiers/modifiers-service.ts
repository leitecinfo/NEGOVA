import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  CreateModifierGroupInput,
  ModifierGroup,
  ModifierGroupKPIs,
  ModifierGroupSchema,
  ModifierOption,
  ModifierStatus,
  UpdateModifierGroupInput,
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

const migratedBusinesses = new Set<string>();

/**
 * Consulta todos los grupos de modificadores con sus opciones y productos asignados.
 * Si las tablas relacionales están vacías, importa de forma transparente cualquier
 * grupo preexistente configurado en los metadatos de los productos del negocio.
 */
export async function getModifierGroups(businessId: string): Promise<ModifierGroup[]> {
  const supabase = await getSupabase();

  // 1. Consultar grupos
  const { data: rawGroups, error: groupsError } = await supabase
    .from("product_option_groups")
    .select("*")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (groupsError) {
    console.error("[getModifierGroups] Error consultando product_option_groups:", groupsError);
    throw new Error(`Error al consultar grupos de modificadores: ${groupsError.message}`);
  }

  // Si no hay grupos en la tabla relacional, intentar migrar/importar desde metadata de productos si no se ha intentado
  if (!rawGroups || rawGroups.length === 0) {
    if (!migratedBusinesses.has(businessId)) {
      migratedBusinesses.add(businessId);
      await autoMigrateProductMetadataModifiers(businessId);
      // Volver a consultar después de la migración
      const { data: secondFetch } = await supabase
        .from("product_option_groups")
        .select("*")
        .eq("business_id", businessId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!secondFetch || secondFetch.length === 0) {
        return [];
      }
      return buildModifierGroups(supabase, businessId, secondFetch);
    }
    return [];
  }

  return buildModifierGroups(supabase, businessId, rawGroups);
}

/**
 * Arma los objetos ModifierGroup reuniendo opciones y asignaciones de productos.
 */
async function buildModifierGroups(
  supabase: any,
  businessId: string,
  rawGroups: any[]
): Promise<ModifierGroup[]> {
  const groupIds = rawGroups.map((g) => g.id);

  // 2. Consultar opciones
  const { data: rawOptions, error: optionsError } = await supabase
    .from("product_options")
    .select("*")
    .eq("business_id", businessId)
    .in("option_group_id", groupIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (optionsError) {
    console.error("[getModifierGroups] Error consultando product_options:", optionsError);
  }

  // 3. Consultar vínculos producto-grupo
  const { data: rawLinks, error: linksError } = await supabase
    .from("product_option_groups_products")
    .select("product_id, option_group_id")
    .eq("business_id", businessId)
    .in("option_group_id", groupIds);

  if (linksError) {
    console.error("[getModifierGroups] Error consultando product_option_groups_products:", linksError);
  }

  const optionsByGroup = new Map<string, ModifierOption[]>();
  (rawOptions || []).forEach((opt: any) => {
    const list = optionsByGroup.get(opt.option_group_id) || [];
    list.push({
      id: opt.id,
      option_group_id: opt.option_group_id,
      business_id: opt.business_id,
      name: opt.name,
      price: Number(opt.additional_price ?? 0),
      status: (opt.status as ModifierStatus) || "active",
      sort_order: opt.sort_order ?? 0,
      created_at: opt.created_at,
      updated_at: opt.updated_at,
    });
    optionsByGroup.set(opt.option_group_id, list);
  });

  const linksByGroup = new Map<string, string[]>();
  (rawLinks || []).forEach((link: any) => {
    const list = linksByGroup.get(link.option_group_id) || [];
    list.push(link.product_id);
    linksByGroup.set(link.option_group_id, list);
  });

  return rawGroups.map((g: any) => {
    const groupOptions = optionsByGroup.get(g.id) || [];
    const minSelect = Number(g.min_selections ?? 0);
    const maxSelect = Number(g.max_selections ?? 1);
    const selectionType = maxSelect === 1 ? "single" : "multiple";

    // Si todas las opciones están inactivas y hay al menos una opción, consideramos el grupo inactivo
    const hasActiveOption = groupOptions.length === 0 || groupOptions.some((o) => o.status === "active");
    const status: ModifierStatus = hasActiveOption ? "active" : "inactive";

    return {
      id: g.id,
      business_id: g.business_id,
      name: g.name,
      description: g.description || null,
      commercial_type: (g.commercial_type as any) || "additional",
      required: Boolean(g.required),
      selection_type: selectionType,
      min_select: minSelect,
      max_select: maxSelect,
      sort_order: g.sort_order ?? 0,
      status,
      options: groupOptions,
      applied_product_ids: linksByGroup.get(g.id) || [],
      created_at: g.created_at,
      updated_at: g.updated_at,
    };
  });
}

/**
 * Calcula los KPIs del módulo de modificadores.
 */
export function getModifierGroupKPIs(groups: ModifierGroup[]): ModifierGroupKPIs {
  const totalGroups = groups.length;
  let activeOptions = 0;
  const uniqueLinkedProducts = new Set<string>();

  for (const group of groups) {
    for (const opt of group.options) {
      if (opt.status === "active") {
        activeOptions++;
      }
    }
    for (const pId of group.applied_product_ids) {
      uniqueLinkedProducts.add(pId);
    }
  }

  return {
    totalGroups,
    activeOptions,
    linkedProductsCount: uniqueLinkedProducts.size,
  };
}

/**
 * Crea un nuevo grupo de modificadores con sus opciones y asignaciones de productos.
 */
export async function createModifierGroup(
  businessId: string,
  input: CreateModifierGroupInput
): Promise<ModifierGroup> {
  migratedBusinesses.add(businessId);
  const parsed = ModifierGroupSchema.parse(input);
  const supabase = await getSupabase();

  const maxSelect = parsed.selection_type === "single" ? 1 : Math.max(1, parsed.max_select);
  const minSelect = parsed.required ? Math.max(1, parsed.min_select) : parsed.min_select;

  // 1. Insertar el grupo en product_option_groups
  const groupPayload: Record<string, any> = {
    business_id: businessId,
    name: parsed.name,
    required: parsed.required,
    min_selections: minSelect,
    max_selections: maxSelect,
    sort_order: parsed.sort_order ?? 0,
    commercial_type: parsed.commercial_type || "additional",
  };
  if (parsed.description) {
    groupPayload.description = parsed.description;
  }

  let newGroup: any = null;
  let groupError: any = null;

  const initialInsert = await supabase
    .from("product_option_groups")
    .insert(groupPayload)
    .select()
    .single();

  if (initialInsert.error && (initialInsert.error.message?.includes("column") || initialInsert.error.code === "42703")) {
    delete groupPayload.commercial_type;
    delete groupPayload.description;
    const fallbackInsert = await supabase
      .from("product_option_groups")
      .insert(groupPayload)
      .select()
      .single();
    newGroup = fallbackInsert.data;
    groupError = fallbackInsert.error;
  } else {
    newGroup = initialInsert.data;
    groupError = initialInsert.error;
  }

  if (groupError || !newGroup) {
    console.error("[createModifierGroup] Error al insertar grupo:", groupError);
    throw new Error(`Error al crear el grupo de modificadores: ${groupError?.message}`);
  }

  const groupId = newGroup.id;

  // 2. Insertar opciones si fueron provistas
  if (parsed.options && parsed.options.length > 0) {
    const optionsPayload = parsed.options.map((opt, idx) => ({
      business_id: businessId,
      option_group_id: groupId,
      name: opt.name,
      additional_price: Number(opt.price ?? 0),
      status: opt.status || "active",
      sort_order: opt.sort_order ?? idx,
    }));

    const { error: optionsError } = await supabase.from("product_options").insert(optionsPayload);
    if (optionsError) {
      console.error("[createModifierGroup] Error insertando opciones:", optionsError);
    }
  }

  // 3. Vincular productos asignados
  const productIds = Array.from(new Set(parsed.product_ids || []));
  if (productIds.length > 0) {
    const linksPayload = productIds.map((pId) => ({
      product_id: pId,
      option_group_id: groupId,
      business_id: businessId,
    }));

    const { error: linksError } = await supabase
      .from("product_option_groups_products")
      .insert(linksPayload);

    if (linksError) {
      console.error("[createModifierGroup] Error vinculando productos:", linksError);
    }
  }

  // 4. Sincronizar snapshots en metadata de productos vinculados
  if (productIds.length > 0) {
    await syncProductMetadataModifierGroups(businessId, productIds);
  }

  const allGroups = await getModifierGroups(businessId);
  const found = allGroups.find((g) => g.id === groupId);
  if (!found) {
    throw new Error("No se pudo recuperar el grupo de modificadores recién creado");
  }
  return found;
}

/**
 * Actualiza un grupo de modificadores existente.
 */
export async function updateModifierGroup(
  businessId: string,
  groupId: string,
  input: UpdateModifierGroupInput
): Promise<ModifierGroup> {
  const supabase = await getSupabase();

  const maxSelect =
    input.selection_type === "single"
      ? 1
      : input.max_select !== undefined && input.max_select !== null
      ? Math.max(1, Number(input.max_select))
      : undefined;

  const minSelect =
    input.required !== undefined
      ? input.required
        ? Math.max(1, Number(input.min_select ?? 1))
        : Number(input.min_select ?? 0)
      : input.min_select !== undefined && input.min_select !== null
      ? Number(input.min_select)
      : undefined;

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updates.name = input.name;
  if (input.required !== undefined) updates.required = input.required;
  if (input.description !== undefined) updates.description = input.description;
  if (input.commercial_type !== undefined) updates.commercial_type = input.commercial_type;
  if (minSelect !== undefined) updates.min_selections = minSelect;
  if (maxSelect !== undefined) updates.max_selections = maxSelect;
  if (input.sort_order !== undefined) updates.sort_order = input.sort_order;

  // 1. Actualizar grupo
  let { error: updateError } = await supabase
    .from("product_option_groups")
    .update(updates)
    .eq("id", groupId)
    .eq("business_id", businessId);

  if (updateError && (updateError.message?.includes("column") || updateError.code === "42703")) {
    delete updates.description;
    delete updates.commercial_type;
    const retry = await supabase
      .from("product_option_groups")
      .update(updates)
      .eq("id", groupId)
      .eq("business_id", businessId);
    updateError = retry.error;
  }

  if (updateError) {
    throw new Error(`Error al actualizar el grupo de modificadores: ${updateError.message}`);
  }

  // 2. Si se provieron opciones, sincronizarlas
  if (input.options) {
    // Consultar opciones actuales
    const { data: currentOptions } = await supabase
      .from("product_options")
      .select("id")
      .eq("option_group_id", groupId)
      .eq("business_id", businessId);

    const currentOptionIds = new Set((currentOptions || []).map((o: any) => o.id));
    const inputOptionIds = new Set(
      input.options.filter((o) => o.id).map((o) => o.id as string)
    );

    // Eliminar opciones que ya no están
    const toDelete = Array.from(currentOptionIds).filter((id) => !inputOptionIds.has(id));
    if (toDelete.length > 0) {
      await supabase
        .from("product_options")
        .delete()
        .in("id", toDelete)
        .eq("business_id", businessId);
    }

    // Insertar o actualizar opciones
    for (let idx = 0; idx < input.options.length; idx++) {
      const opt = input.options[idx];
      if (opt.id && currentOptionIds.has(opt.id)) {
        await supabase
          .from("product_options")
          .update({
            name: opt.name,
            additional_price: Number(opt.price ?? 0),
            status: opt.status || "active",
            sort_order: opt.sort_order ?? idx,
            updated_at: new Date().toISOString(),
          })
          .eq("id", opt.id)
          .eq("business_id", businessId);
      } else {
        await supabase.from("product_options").insert({
          business_id: businessId,
          option_group_id: groupId,
          name: opt.name,
          additional_price: Number(opt.price ?? 0),
          status: opt.status || "active",
          sort_order: opt.sort_order ?? idx,
        });
      }
    }
  }

  // 3. Sincronizar vínculos de productos si se especificaron
  let affectedProductIds: string[] = [];
  if (input.product_ids !== undefined) {
    // Obtener vínculos previos para saber a quién desvincular
    const { data: previousLinks } = await supabase
      .from("product_option_groups_products")
      .select("product_id")
      .eq("option_group_id", groupId)
      .eq("business_id", businessId);

    const prevIds = (previousLinks || []).map((l: any) => l.product_id);
    const newIds = Array.from(new Set(input.product_ids));
    affectedProductIds = Array.from(new Set([...prevIds, ...newIds]));

    // Borrar vínculos anteriores
    await supabase
      .from("product_option_groups_products")
      .delete()
      .eq("option_group_id", groupId)
      .eq("business_id", businessId);

    // Insertar nuevos vínculos
    if (newIds.length > 0) {
      const newLinks = newIds.map((pId) => ({
        product_id: pId,
        option_group_id: groupId,
        business_id: businessId,
      }));
      await supabase.from("product_option_groups_products").insert(newLinks);
    }
  } else {
    // Consultar vínculos actuales para sincronizar
    const { data: currentLinks } = await supabase
      .from("product_option_groups_products")
      .select("product_id")
      .eq("option_group_id", groupId)
      .eq("business_id", businessId);
    affectedProductIds = (currentLinks || []).map((l: any) => l.product_id);
  }

  // 4. Sincronizar metadata de productos afectados
  if (affectedProductIds.length > 0) {
    await syncProductMetadataModifierGroups(businessId, affectedProductIds);
  }

  const allGroups = await getModifierGroups(businessId);
  const updated = allGroups.find((g) => g.id === groupId);
  if (!updated) {
    throw new Error("No se pudo recuperar el grupo de modificadores actualizado");
  }
  return updated;
}

/**
 * Elimina un grupo de modificadores y sus opciones, desvinculándolo de productos.
 */
export async function deleteModifierGroup(
  businessId: string,
  groupId: string
): Promise<void> {
  migratedBusinesses.add(businessId);
  const supabase = await getSupabase();

  // 1. Obtener productos vinculados antes de borrar
  const { data: links } = await supabase
    .from("product_option_groups_products")
    .select("product_id")
    .eq("option_group_id", groupId)
    .eq("business_id", businessId);

  const affectedProductIds = (links || []).map((l: any) => l.product_id);

  // 2. Eliminar vínculos
  await supabase
    .from("product_option_groups_products")
    .delete()
    .eq("option_group_id", groupId)
    .eq("business_id", businessId);

  // 3. Eliminar opciones
  await supabase
    .from("product_options")
    .delete()
    .eq("option_group_id", groupId)
    .eq("business_id", businessId);

  // 4. Eliminar grupo
  const { error } = await supabase
    .from("product_option_groups")
    .delete()
    .eq("id", groupId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Error al eliminar el grupo de modificadores: ${error.message}`);
  }

  // 5. Sincronizar metadata de productos afectados
  if (affectedProductIds.length > 0) {
    await syncProductMetadataModifierGroups(businessId, affectedProductIds);
  }
}

/**
 * Añade una opción individual a un grupo existente.
 */
export async function addModifierOption(
  businessId: string,
  groupId: string,
  option: { name: string; price: number; status?: ModifierStatus }
): Promise<ModifierOption> {
  const supabase = await getSupabase();

  const { data: inserted, error } = await supabase
    .from("product_options")
    .insert({
      business_id: businessId,
      option_group_id: groupId,
      name: option.name.trim(),
      additional_price: Number(option.price ?? 0),
      status: option.status || "active",
    })
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(`Error al agregar opción al grupo: ${error?.message}`);
  }

  // Obtener productos vinculados para sincronizar metadata
  const { data: links } = await supabase
    .from("product_option_groups_products")
    .select("product_id")
    .eq("option_group_id", groupId)
    .eq("business_id", businessId);

  const affectedProductIds = (links || []).map((l: any) => l.product_id);
  if (affectedProductIds.length > 0) {
    await syncProductMetadataModifierGroups(businessId, affectedProductIds);
  }

  return {
    id: inserted.id,
    option_group_id: inserted.option_group_id,
    business_id: inserted.business_id,
    name: inserted.name,
    price: Number(inserted.additional_price ?? 0),
    status: (inserted.status as ModifierStatus) || "active",
    sort_order: inserted.sort_order ?? 0,
    created_at: inserted.created_at,
    updated_at: inserted.updated_at,
  };
}

/**
 * Actualiza una opción de modificador específica.
 */
export async function updateModifierOption(
  businessId: string,
  optionId: string,
  updates: { name?: string; price?: number; status?: ModifierStatus }
): Promise<void> {
  const supabase = await getSupabase();

  // Consultar opción para saber su groupId
  const { data: existing } = await supabase
    .from("product_options")
    .select("option_group_id")
    .eq("id", optionId)
    .eq("business_id", businessId)
    .single();

  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.price !== undefined) payload.additional_price = Number(updates.price);
  if (updates.status !== undefined) payload.status = updates.status;

  const { error } = await supabase
    .from("product_options")
    .update(payload)
    .eq("id", optionId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Error al actualizar la opción: ${error.message}`);
  }

  if (existing?.option_group_id) {
    const { data: links } = await supabase
      .from("product_option_groups_products")
      .select("product_id")
      .eq("option_group_id", existing.option_group_id)
      .eq("business_id", businessId);

    const affectedProductIds = (links || []).map((l: any) => l.product_id);
    if (affectedProductIds.length > 0) {
      await syncProductMetadataModifierGroups(businessId, affectedProductIds);
    }
  }
}

/**
 * Elimina una opción de modificador.
 */
export async function deleteModifierOption(
  businessId: string,
  optionId: string
): Promise<void> {
  const supabase = await getSupabase();

  const { data: existing } = await supabase
    .from("product_options")
    .select("option_group_id")
    .eq("id", optionId)
    .eq("business_id", businessId)
    .single();

  const { error } = await supabase
    .from("product_options")
    .delete()
    .eq("id", optionId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Error al eliminar la opción: ${error.message}`);
  }

  if (existing?.option_group_id) {
    const { data: links } = await supabase
      .from("product_option_groups_products")
      .select("product_id")
      .eq("option_group_id", existing.option_group_id)
      .eq("business_id", businessId);

    const affectedProductIds = (links || []).map((l: any) => l.product_id);
    if (affectedProductIds.length > 0) {
      await syncProductMetadataModifierGroups(businessId, affectedProductIds);
    }
  }
}

/**
 * Activa o desactiva todas las opciones de un grupo de modificadores.
 */
export async function toggleModifierGroupStatus(
  businessId: string,
  groupId: string,
  targetStatus: ModifierStatus
): Promise<void> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from("product_options")
    .update({
      status: targetStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("option_group_id", groupId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Error al alternar el estado del grupo: ${error.message}`);
  }

  const { data: links } = await supabase
    .from("product_option_groups_products")
    .select("product_id")
    .eq("option_group_id", groupId)
    .eq("business_id", businessId);

  const affectedProductIds = (links || []).map((l: any) => l.product_id);
  if (affectedProductIds.length > 0) {
    await syncProductMetadataModifierGroups(businessId, affectedProductIds);
  }
}

/**
 * Mantiene sincronizados los grupos de modificadores dentro de `products.metadata.modifier_groups`
 * para los productos especificados. Esto asegura compatibilidad total e inmediata con
 * el sistema POS, Menú Digital QR, KDS y validaciones de comandas sin alterar su funcionamiento.
 */
export async function syncProductMetadataModifierGroups(
  businessId: string,
  productIds: string[]
): Promise<void> {
  if (!productIds || productIds.length === 0) return;
  const supabase = await getSupabase();

  // Consultar todos los grupos del negocio con sus opciones
  const allGroups = await getModifierGroups(businessId);

  // Para cada producto afectado, calcular los grupos que le corresponden
  for (const productId of productIds) {
    const assignedGroups = allGroups.filter((g) =>
      g.applied_product_ids.includes(productId)
    );

    const snapshot = assignedGroups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description || null,
      commercial_type: g.commercial_type || "additional",
      type: g.commercial_type || "additional",
      required: g.required,
      selection_type: g.selection_type,
      min_select: g.min_select,
      max_select: g.max_select,
      status: g.status,
      sort_order: g.sort_order ?? 0,
      options: g.options.map((opt) => ({
        id: opt.id,
        name: opt.name,
        price: opt.price,
        status: opt.status || "active",
        is_available: opt.status === "active",
        sort_order: opt.sort_order ?? 0,
      })),
    }));

    // Obtener producto actual para preservar el resto de su metadata
    const { data: prod } = await supabase
      .from("products")
      .select("metadata")
      .eq("id", productId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (prod) {
      const currentMeta = (prod.metadata || {}) as Record<string, any>;
      const nextMeta = {
        ...currentMeta,
        modifier_groups: snapshot,
      };

      await supabase
        .from("products")
        .update({
          metadata: nextMeta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId)
        .eq("business_id", businessId);
    }
  }
}

/**
 * Asigna una lista de productos a un grupo de modificadores existente.
 */
export async function assignProductsToGroup(
  businessId: string,
  groupId: string,
  productIds: string[]
): Promise<void> {
  const supabase = await getSupabase();
  const uniqueProductIds = Array.from(new Set(productIds));
  if (uniqueProductIds.length === 0) return;

  // Consultar vínculos ya existentes para no duplicar
  const { data: existingLinks } = await supabase
    .from("product_option_groups_products")
    .select("product_id")
    .eq("option_group_id", groupId)
    .eq("business_id", businessId);

  const existingSet = new Set((existingLinks || []).map((l: any) => l.product_id));
  const toAdd = uniqueProductIds.filter((pId) => !existingSet.has(pId));

  if (toAdd.length > 0) {
    const rows = toAdd.map((pId) => ({
      product_id: pId,
      option_group_id: groupId,
      business_id: businessId,
    }));
    await supabase.from("product_option_groups_products").insert(rows);
  }

  await syncProductMetadataModifierGroups(businessId, toAdd);
}

/**
 * Retira la asignación de un producto de un grupo de modificadores
 * sin eliminar la configuración del grupo ni sus opciones.
 */
export async function unassignProductFromGroup(
  businessId: string,
  groupId: string,
  productId: string
): Promise<void> {
  const supabase = await getSupabase();
  await supabase
    .from("product_option_groups_products")
    .delete()
    .eq("option_group_id", groupId)
    .eq("product_id", productId)
    .eq("business_id", businessId);

  await syncProductMetadataModifierGroups(businessId, [productId]);
}

/**
 * Sincroniza los grupos de modificadores asignados a un producto específico.
 * Crea los vínculos relacionales faltantes y elimina los que ya no están asignados,
 * asegurando la fuente de verdad en product_option_groups_products y sincronizando metadata.
 */
export async function syncProductModifierGroupLinks(
  businessId: string,
  productId: string,
  groupIds: string[]
): Promise<void> {
  const supabase = await getSupabase();
  const validGroupIds = Array.from(new Set(groupIds.filter(Boolean)));

  // Consultar vínculos actuales para este producto
  const { data: currentLinks } = await supabase
    .from("product_option_groups_products")
    .select("option_group_id")
    .eq("product_id", productId)
    .eq("business_id", businessId);

  const currentGroupSet = new Set((currentLinks || []).map((l: any) => l.option_group_id));
  const targetGroupSet = new Set(validGroupIds);

  // Vínculos a eliminar
  const toDelete = Array.from(currentGroupSet).filter((gId) => !targetGroupSet.has(gId));
  if (toDelete.length > 0) {
    await supabase
      .from("product_option_groups_products")
      .delete()
      .eq("product_id", productId)
      .eq("business_id", businessId)
      .in("option_group_id", toDelete);
  }

  // Vínculos a añadir
  const toAdd = validGroupIds.filter((gId) => !currentGroupSet.has(gId));
  if (toAdd.length > 0) {
    const { data: existingGroups } = await supabase
      .from("product_option_groups")
      .select("id")
      .eq("business_id", businessId)
      .in("id", toAdd);

    const validIdsToAdd = (existingGroups || []).map((g: any) => g.id);
    if (validIdsToAdd.length > 0) {
      const rows = validIdsToAdd.map((gId) => ({
        product_id: productId,
        option_group_id: gId,
        business_id: businessId,
      }));
      await supabase.from("product_option_groups_products").insert(rows);
    }
  }

  await syncProductMetadataModifierGroups(businessId, [productId]);
}


/**
 * Si el comercio tenía modificadores configurados individualmente en la metadata de sus productos
 * pero aún no los tenía en las tablas normalizadas, este asistente los detecta e importa automáticamente.
 */
async function autoMigrateProductMetadataModifiers(businessId: string): Promise<void> {
  try {
    const supabase = await getSupabase();

    const { data: products } = await supabase
      .from("products")
      .select("id, name, metadata")
      .eq("business_id", businessId);

    if (!products || products.length === 0) return;

    // Agrupar modificadores encontrados por nombre
    const groupMap = new Map<
      string,
      {
        name: string;
        description?: string | null;
        commercial_type: string;
        required: boolean;
        min_select: number;
        max_select: number;
        options: Map<string, { name: string; price: number; is_available: boolean }>;
        productIds: Set<string>;
      }
    >();

    for (const prod of products) {
      const meta = (prod.metadata || {}) as Record<string, any>;
      const rawGroups = Array.isArray(meta.modifier_groups) ? meta.modifier_groups : [];

      for (const g of rawGroups) {
        if (!g.name || typeof g.name !== "string") continue;
        const groupKey = g.name.trim().toLowerCase();

        let groupEntry = groupMap.get(groupKey);
        if (!groupEntry) {
          groupEntry = {
            name: g.name.trim(),
            description: g.description || null,
            commercial_type: g.commercial_type || g.type || "additional",
            required: Boolean(g.required),
            min_select: Number(g.min_select ?? (g.required ? 1 : 0)),
            max_select: Number(g.max_select ?? 1),
            options: new Map(),
            productIds: new Set(),
          };
          groupMap.set(groupKey, groupEntry);
        }

        groupEntry.productIds.add(prod.id);

        const opts = Array.isArray(g.options) ? g.options : [];
        for (const opt of opts) {
          if (!opt.name || typeof opt.name !== "string") continue;
          const optKey = opt.name.trim().toLowerCase();
          if (!groupEntry.options.has(optKey)) {
            groupEntry.options.set(optKey, {
              name: opt.name.trim(),
              price: Math.max(0, Number(opt.price ?? 0)),
              is_available: opt.is_available !== false,
            });
          }
        }
      }
    }

    if (groupMap.size === 0) return;

    // Insertar los grupos encontrados
    for (const groupData of groupMap.values()) {
      const insertData: Record<string, any> = {
        business_id: businessId,
        name: groupData.name,
        required: groupData.required,
        min_selections: groupData.min_select,
        max_selections: groupData.max_select,
        commercial_type: groupData.commercial_type || "additional",
      };
      if (groupData.description) insertData.description = groupData.description;

      let insertedGroupRes = await supabase
        .from("product_option_groups")
        .insert(insertData)
        .select()
        .single();

      if (insertedGroupRes.error) {
        delete insertData.commercial_type;
        delete insertData.description;
        insertedGroupRes = await supabase
          .from("product_option_groups")
          .insert(insertData)
          .select()
          .single();
      }

      const insertedGroup = insertedGroupRes.data;
      if (!insertedGroup) continue;

      // Insertar opciones
      const optionsArray = Array.from(groupData.options.values());
      if (optionsArray.length > 0) {
        const optionRows = optionsArray.map((opt, idx) => ({
          business_id: businessId,
          option_group_id: insertedGroup.id,
          name: opt.name,
          additional_price: opt.price,
          status: opt.is_available ? "active" : "inactive",
          sort_order: idx,
        }));
        await supabase.from("product_options").insert(optionRows);
      }

      // Insertar vínculos con los productos que lo tenían
      const productIds = Array.from(groupData.productIds);
      if (productIds.length > 0) {
        const linkRows = productIds.map((pId) => ({
          product_id: pId,
          option_group_id: insertedGroup.id,
          business_id: businessId,
        }));
        await supabase.from("product_option_groups_products").insert(linkRows);
      }
    }
  } catch (err) {
    console.warn("[autoMigrateProductMetadataModifiers] No se pudo autocompletar la migración previa:", err);
  }
}
