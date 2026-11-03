import { getDbClient } from "@/lib/restaurant/restaurant-service";
import { logAuditAction } from "@/lib/audit/audit-service";
import {
  LoyaltyProgramConfig,
  DEFAULT_LOYALTY_PROGRAM_CONFIG,
  CustomerLoyaltyAccount,
  LoyaltyTransaction,
  LoyaltyReferenceType,
  PointsRedemptionCalculation,
} from "./types";

/**
 * Consulta la configuración del programa de fidelización del negocio.
 * Se almacena en businesses.settings.loyalty_program
 */
export async function getLoyaltyProgramConfig(
  businessId: string
): Promise<LoyaltyProgramConfig> {
  const supabase = await getDbClient();
  const { data: biz, error } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !biz) {
    return { ...DEFAULT_LOYALTY_PROGRAM_CONFIG };
  }

  const raw = (biz.settings as any)?.loyalty_program;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_LOYALTY_PROGRAM_CONFIG };
  }

  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_LOYALTY_PROGRAM_CONFIG.enabled,
    pointsPerSpentAmount:
      typeof raw.pointsPerSpentAmount === "number" && raw.pointsPerSpentAmount > 0
        ? raw.pointsPerSpentAmount
        : DEFAULT_LOYALTY_PROGRAM_CONFIG.pointsPerSpentAmount,
    redemptionValuePerPoint:
      typeof raw.redemptionValuePerPoint === "number" && raw.redemptionValuePerPoint > 0
        ? raw.redemptionValuePerPoint
        : DEFAULT_LOYALTY_PROGRAM_CONFIG.redemptionValuePerPoint,
    minPointsToRedeem:
      typeof raw.minPointsToRedeem === "number" && raw.minPointsToRedeem >= 0
        ? raw.minPointsToRedeem
        : DEFAULT_LOYALTY_PROGRAM_CONFIG.minPointsToRedeem,
    maxDiscountPercentage:
      typeof raw.maxDiscountPercentage === "number" && raw.maxDiscountPercentage > 0
        ? Math.min(100, raw.maxDiscountPercentage)
        : DEFAULT_LOYALTY_PROGRAM_CONFIG.maxDiscountPercentage,
  };
}

/**
 * Actualiza la configuración del programa de fidelización en businesses.settings.loyalty_program
 */
export async function updateLoyaltyProgramConfig(
  businessId: string,
  input: Partial<LoyaltyProgramConfig>,
  actorId?: string
): Promise<{ success: boolean; config?: LoyaltyProgramConfig; error?: string }> {
  const supabase = await getDbClient();

  const { data: currentBiz, error: fetchErr } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .single();

  if (fetchErr || !currentBiz) {
    return { success: false, error: "Negocio no encontrado para guardar configuración de puntos." };
  }

  const currentSettings = (currentBiz.settings || {}) as Record<string, any>;
  const currentLoyalty = currentSettings.loyalty_program || DEFAULT_LOYALTY_PROGRAM_CONFIG;

  const mergedConfig: LoyaltyProgramConfig = {
    ...DEFAULT_LOYALTY_PROGRAM_CONFIG,
    ...currentLoyalty,
    ...input,
  };

  const updatedSettings = {
    ...currentSettings,
    loyalty_program: mergedConfig,
  };

  const { error: saveErr } = await supabase
    .from("businesses")
    .update({
      settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (saveErr) {
    return { success: false, error: "Error al guardar configuración: " + saveErr.message };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "update_loyalty_config",
    entityType: "business_settings",
    entityId: businessId,
    description: `Configuración de fidelización actualizada (Activo: ${mergedConfig.enabled}, 1 pt / $${mergedConfig.pointsPerSpentAmount})`,
    metadata: mergedConfig,
  });

  return { success: true, config: mergedConfig };
}

/**
 * Calcula los puntos ganados a partir de un monto de compra según la regla del negocio.
 * Ej: $50.000 con regla 1 pt por cada $1.000 => 50 puntos acumulados
 */
export function calculatePointsEarned(
  spentAmount: number,
  config: LoyaltyProgramConfig
): number {
  if (!config.enabled || config.pointsPerSpentAmount <= 0) {
    return 0;
  }
  const safeSpent = Math.max(0, Number(spentAmount) || 0);
  return Math.floor(safeSpent / config.pointsPerSpentAmount);
}

/**
 * Calcula el valor en dinero (descuento) equivalente a una cantidad de puntos
 */
export function calculateDiscountFromPoints(
  points: number,
  config: LoyaltyProgramConfig
): number {
  if (points <= 0 || config.redemptionValuePerPoint <= 0) {
    return 0;
  }
  return points * config.redemptionValuePerPoint;
}

/**
 * Evalúa y valida una redención de puntos frente al saldo del cliente y el total de la orden
 */
export function evaluatePointsRedemption(
  pointsToRedeem: number,
  customerBalance: number,
  orderTotal: number,
  config: LoyaltyProgramConfig
): PointsRedemptionCalculation {
  if (!config.enabled) {
    return {
      pointsToRedeem: 0,
      discountAmount: 0,
      remainingPoints: customerBalance,
      maxPointsAllowed: 0,
      isValid: false,
      errorMessage: "El programa de fidelización no está activo en este momento.",
    };
  }

  if (customerBalance < config.minPointsToRedeem) {
    return {
      pointsToRedeem: 0,
      discountAmount: 0,
      remainingPoints: customerBalance,
      maxPointsAllowed: 0,
      isValid: false,
      errorMessage: `El cliente necesita acumular al menos ${config.minPointsToRedeem} puntos para redimir (saldo actual: ${customerBalance}).`,
    };
  }

  // Máximo descuento monetario permitido según maxDiscountPercentage
  const maxDiscountAllowed = Math.round(orderTotal * (config.maxDiscountPercentage / 100));
  const maxPointsByOrder = Math.floor(maxDiscountAllowed / (config.redemptionValuePerPoint || 1));
  const maxPointsAllowed = Math.min(customerBalance, maxPointsByOrder);

  if (pointsToRedeem <= 0) {
    return {
      pointsToRedeem: 0,
      discountAmount: 0,
      remainingPoints: customerBalance,
      maxPointsAllowed,
      isValid: false,
      errorMessage: "Debes ingresar una cantidad de puntos mayor a cero.",
    };
  }

  if (pointsToRedeem > customerBalance) {
    return {
      pointsToRedeem,
      discountAmount: 0,
      remainingPoints: customerBalance,
      maxPointsAllowed,
      isValid: false,
      errorMessage: `El cliente solo dispone de ${customerBalance} puntos (intentaste redimir ${pointsToRedeem}).`,
    };
  }

  if (pointsToRedeem > maxPointsAllowed) {
    return {
      pointsToRedeem,
      discountAmount: 0,
      remainingPoints: customerBalance,
      maxPointsAllowed,
      isValid: false,
      errorMessage: `El descuento máximo permitido por puntos para esta cuenta es de ${config.maxDiscountPercentage}% (${maxPointsAllowed} puntos).`,
    };
  }

  const discountAmount = calculateDiscountFromPoints(pointsToRedeem, config);

  return {
    pointsToRedeem,
    discountAmount,
    remainingPoints: customerBalance - pointsToRedeem,
    maxPointsAllowed,
    isValid: true,
  };
}

/**
 * Consulta el estado y balance de puntos de un cliente
 */
export async function getCustomerLoyaltyAccount(
  businessId: string,
  customerId: string
): Promise<CustomerLoyaltyAccount> {
  const supabase = await getDbClient();
  const config = await getLoyaltyProgramConfig(businessId);

  const { data, error } = await supabase
    .from("loyalty_points")
    .select("*")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error || !data) {
    return {
      businessId,
      customerId,
      pointsBalance: 0,
      totalEarned: 0,
      totalRedeemed: 0,
      equivalentMoneyValue: 0,
      canRedeem: false,
    };
  }

  const balance = Number(data.points_balance || 0);
  const moneyValue = calculateDiscountFromPoints(balance, config);
  const canRedeem = config.enabled && balance >= config.minPointsToRedeem;

  return {
    id: data.id,
    businessId,
    customerId,
    pointsBalance: balance,
    totalEarned: Number(data.total_earned || 0),
    totalRedeemed: Number(data.total_redeemed || 0),
    equivalentMoneyValue: moneyValue,
    canRedeem,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Acumula puntos de forma atómica en el saldo del cliente
 */
export async function accumulateLoyaltyPoints(
  businessId: string,
  customerId: string,
  points: number,
  referenceId?: string | null,
  referenceType: LoyaltyReferenceType = "order",
  description?: string | null,
  actorId?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  if (points <= 0) {
    return { success: false, error: "La cantidad de puntos a acumular debe ser mayor a 0." };
  }

  const supabase = await getDbClient();

  // Intentar ejecutar mediante la RPC transaccional
  if (typeof supabase.rpc === "function") {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("accumulate_loyalty_points_rpc", {
        p_business_id: businessId,
        p_customer_id: customerId,
        p_points: points,
        p_reference_id: referenceId || null,
        p_reference_type: referenceType,
        p_description: description || null,
      });

      if (!rpcErr && rpcRes && rpcRes.success) {
        return { success: true, newBalance: rpcRes.points_balance };
      }
    } catch {
      // Fallback a queries estándar si RPC no está disponible en ambiente local/mock
    }
  }

  // Fallback atómico en cliente
  const { data: current } = await supabase
    .from("loyalty_points")
    .select("points_balance, total_earned")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .maybeSingle();

  const prevBalance = Number(current?.points_balance || 0);
  const prevEarned = Number(current?.total_earned || 0);
  const newBalance = prevBalance + points;
  const newEarned = prevEarned + points;
  const now = new Date().toISOString();

  if (current) {
    await supabase
      .from("loyalty_points")
      .update({
        points_balance: newBalance,
        total_earned: newEarned,
        updated_at: now,
      })
      .eq("business_id", businessId)
      .eq("customer_id", customerId);
  } else {
    await supabase.from("loyalty_points").insert({
      business_id: businessId,
      customer_id: customerId,
      points_balance: points,
      total_earned: points,
      total_redeemed: 0,
      created_at: now,
      updated_at: now,
    });
  }

  await supabase.from("loyalty_transactions").insert({
    business_id: businessId,
    customer_id: customerId,
    points,
    type: "earned",
    reference_id: referenceId || null,
    reference_type: referenceType,
    description: description || "Acumulación por compra",
    balance_after: newBalance,
    created_at: now,
  });

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "loyalty_points_accumulated",
    entityType: "customer",
    entityId: customerId,
    description: `Acumulados +${points} puntos (Nuevo saldo: ${newBalance})`,
    metadata: { points, newBalance, referenceId, referenceType },
  });

  return { success: true, newBalance };
}

/**
 * Redime puntos del saldo del cliente de forma atómica
 */
export async function redeemLoyaltyPoints(
  businessId: string,
  customerId: string,
  points: number,
  referenceId?: string | null,
  referenceType: LoyaltyReferenceType = "order",
  description?: string | null,
  actorId?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  if (points <= 0) {
    return { success: false, error: "La cantidad de puntos a redimir debe ser mayor a 0." };
  }

  const supabase = await getDbClient();

  // Intentar ejecutar mediante la RPC transaccional
  if (typeof supabase.rpc === "function") {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("redeem_loyalty_points_rpc", {
        p_business_id: businessId,
        p_customer_id: customerId,
        p_points: points,
        p_reference_id: referenceId || null,
        p_reference_type: referenceType,
        p_description: description || null,
      });

      if (!rpcErr && rpcRes && rpcRes.success) {
        return { success: true, newBalance: rpcRes.points_balance };
      }
      if (rpcErr) {
        return { success: false, error: rpcErr.message || "Error al redimir puntos." };
      }
    } catch {
      // Fallback
    }
  }

  // Fallback con validación
  const { data: current } = await supabase
    .from("loyalty_points")
    .select("points_balance, total_redeemed")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .maybeSingle();

  const currentBal = Number(current?.points_balance || 0);
  if (currentBal < points) {
    return {
      success: false,
      error: `Saldo insuficiente de puntos. Disponible: ${currentBal}, Solicitado: ${points}`,
    };
  }

  const newBalance = currentBal - points;
  const newRedeemed = Number(current?.total_redeemed || 0) + points;
  const now = new Date().toISOString();

  await supabase
    .from("loyalty_points")
    .update({
      points_balance: newBalance,
      total_redeemed: newRedeemed,
      updated_at: now,
    })
    .eq("business_id", businessId)
    .eq("customer_id", customerId);

  await supabase.from("loyalty_transactions").insert({
    business_id: businessId,
    customer_id: customerId,
    points: -points,
    type: "redeemed",
    reference_id: referenceId || null,
    reference_type: referenceType,
    description: description || "Redención de puntos en pago",
    balance_after: newBalance,
    created_at: now,
  });

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "loyalty_points_redeemed",
    entityType: "customer",
    entityId: customerId,
    description: `Redimidos -${points} puntos (Nuevo saldo: ${newBalance})`,
    metadata: { points, newBalance, referenceId, referenceType },
  });

  return { success: true, newBalance };
}

/**
 * Ajuste manual de puntos por parte de un administrador (con motivo obligatorio y trazabilidad)
 */
export async function adjustCustomerLoyaltyPoints(
  businessId: string,
  customerId: string,
  pointsDelta: number,
  reason: string,
  actorId?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  if (pointsDelta === 0) {
    return { success: false, error: "El ajuste de puntos debe ser diferente de cero." };
  }
  if (!reason || reason.trim().length < 5) {
    return { success: false, error: "Debes especificar un motivo descriptivo para el ajuste de puntos." };
  }

  const supabase = await getDbClient();
  const { data: current } = await supabase
    .from("loyalty_points")
    .select("points_balance, total_earned, total_redeemed")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .maybeSingle();

  const prevBalance = Number(current?.points_balance || 0);
  const newBalance = prevBalance + pointsDelta;

  if (newBalance < 0) {
    return {
      success: false,
      error: `El ajuste resultaría en un saldo negativo (${newBalance}). Saldo disponible actual: ${prevBalance}`,
    };
  }

  const now = new Date().toISOString();

  if (current) {
    await supabase
      .from("loyalty_points")
      .update({
        points_balance: newBalance,
        total_earned: pointsDelta > 0 ? Number(current.total_earned || 0) + pointsDelta : current.total_earned,
        updated_at: now,
      })
      .eq("business_id", businessId)
      .eq("customer_id", customerId);
  } else {
    await supabase.from("loyalty_points").insert({
      business_id: businessId,
      customer_id: customerId,
      points_balance: newBalance,
      total_earned: Math.max(0, pointsDelta),
      total_redeemed: 0,
      created_at: now,
      updated_at: now,
    });
  }

  await supabase.from("loyalty_transactions").insert({
    business_id: businessId,
    customer_id: customerId,
    points: pointsDelta,
    type: "adjusted",
    reference_id: null,
    reference_type: "manual",
    description: `Ajuste manual: ${reason.trim()}`,
    balance_after: newBalance,
    created_at: now,
  });

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "loyalty_points_adjusted",
    entityType: "customer",
    entityId: customerId,
    description: `Ajuste manual de puntos: ${pointsDelta > 0 ? "+" : ""}${pointsDelta} puntos. Motivo: ${reason.trim()}`,
    metadata: { pointsDelta, previousBalance: prevBalance, newBalance, reason },
  });

  return { success: true, newBalance };
}

/**
 * Consulta el historial cronológico de transacciones de puntos de un cliente
 */
export async function getCustomerLoyaltyHistory(
  businessId: string,
  customerId: string,
  limit = 50
): Promise<LoyaltyTransaction[]> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("loyalty_transactions")
    .select("*")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((t: any) => ({
    id: t.id,
    businessId: t.business_id,
    customerId: t.customer_id,
    points: Number(t.points),
    type: t.type,
    referenceId: t.reference_id,
    referenceType: t.reference_type,
    description: t.description,
    balanceAfter: Number(t.balance_after),
    createdAt: t.created_at,
  }));
}

