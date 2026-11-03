import { z } from "zod";

// ==========================================
// Tipos de Geometría de Zonas de Entrega [DOM-001]
// ==========================================

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type DeliveryZoneType = "radius" | "polygon";

export interface DeliveryZoneGeometry {
  type: DeliveryZoneType;
  /**
   * Vértices del polígono (al menos 3 puntos).
   * Obligatorio si type === "polygon".
   */
  coordinates?: GeoPoint[];
  /**
   * Centro del radio geográfico.
   * Obligatorio si type === "radius".
   */
  center?: GeoPoint;
  /**
   * Radio de cobertura en metros.
   * Obligatorio si type === "radius".
   */
  radiusMeters?: number;
}

export interface DeliveryZone {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  tariff: number;
  min_order: number;
  estimated_time_min: number;
  priority: number;
  color: string;
  geometry: DeliveryZoneGeometry;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface CreateDeliveryZoneInput {
  name: string;
  description?: string | null;
  tariff: number;
  min_order?: number;
  estimated_time_min?: number;
  priority?: number;
  color?: string;
  geometry: DeliveryZoneGeometry;
  status?: "active" | "inactive";
}

export interface UpdateDeliveryZoneInput extends Partial<CreateDeliveryZoneInput> {
  id: string;
}

export interface DeliveryZoneMatchResult {
  inside: boolean;
  zone?: DeliveryZone;
  tariff: number;
  estimatedTimeMin?: number;
  minOrder?: number;
  message?: string;
}

export const DELIVERY_ZONE_PRESET_COLORS = [
  "#ED500A", // Negova Orange
  "#3B82F6", // Blue
  "#10B981", // Emerald Green
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
  "#EF4444", // Red
  "#14B8A6", // Teal
] as const;

// ==========================================
// Algoritmos Geoespaciales Puros (Deterministas y Testeables)
// ==========================================

/**
 * Calcula la distancia ortodrómica en metros entre dos puntos geográficos (Haversine).
 */
export function calculateHaversineDistanceMeters(
  point1: GeoPoint,
  point2: GeoPoint
): number {
  const R = 6371000; // Radio medio de la Tierra en metros
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
  const lat1 = (point1.lat * Math.PI) / 180;
  const lat2 = (point2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determina si un punto está dentro de un polígono 2D arbitrario (Ray-Casting Algorithm).
 */
export function isPointInsidePolygon(
  point: GeoPoint,
  polygon: GeoPoint[]
): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Valida si un punto geográfico está contenido dentro de la geometría de una zona (radio o polígono).
 */
export function isPointInsideZone(
  point: GeoPoint,
  geometry: DeliveryZoneGeometry
): boolean {
  if (!point || !geometry) return false;

  if (geometry.type === "radius") {
    if (!geometry.center || typeof geometry.radiusMeters !== "number") return false;
    const distance = calculateHaversineDistanceMeters(point, geometry.center);
    return distance <= geometry.radiusMeters;
  }

  if (geometry.type === "polygon") {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 3) return false;
    return isPointInsidePolygon(point, geometry.coordinates);
  }

  return false;
}

/**
 * Evalúa las zonas activas de un comercio para encontrar la zona coincidente de mayor prioridad.
 */
export function findMatchingDeliveryZone(
  point: GeoPoint,
  zones: DeliveryZone[]
): DeliveryZoneMatchResult {
  const activeZones = (zones || [])
    .filter((z) => z.status === "active")
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const zone of activeZones) {
    if (isPointInsideZone(point, zone.geometry)) {
      return {
        inside: true,
        zone,
        tariff: Number(zone.tariff || 0),
        estimatedTimeMin: zone.estimated_time_min,
        minOrder: Number(zone.min_order || 0),
        message: `Zona asignada: ${zone.name}`,
      };
    }
  }

  return {
    inside: false,
    tariff: 0,
    message: "La dirección se encuentra fuera de las zonas de entrega habilitadas.",
  };
}


// ==========================================
// Tipos de Configuración Completa de Domicilios [DOM-002]
// ==========================================

export type DeliveryTariffMode = "fixed" | "distance" | "zone";
export type DeliveryPayer = "customer" | "business" | "split_50_50";
export type DeliveryAssignmentMode = "manual" | "auto_first" | "round_robin";

export interface DeliveryTimingAlertsConfig {
  maxAcceptTimeMinutes: number;
  delayAlertMinutes: number;
  autoReassignIfNotAccepted: boolean;
  reassignAfterMinutes: number;
}

export interface DeliveryGoalsBonusesConfig {
  dailyDeliveryGoal: number;
  goalBonusAmount: number;
  nightBonusEnabled: boolean;
  nightBonusStartTime: string;
  nightBonusEndTime: string;
  nightBonusAmount: number;
}

export interface DeliveryDistanceTariffConfig {
  baseTariff: number;
  baseDistanceKm: number;
  additionalKmTariff: number;
}

export interface DeliveryBusinessConfig {
  enabled: boolean;
  tariffMode: DeliveryTariffMode;
  fixedFee: number;
  distanceConfig: DeliveryDistanceTariffConfig;
  fallbackZoneFee: number;
  payer: DeliveryPayer;
  assignmentMode: DeliveryAssignmentMode;
  minOrderAmount: number;
  freeDeliveryThreshold?: number | null;
  timing: DeliveryTimingAlertsConfig;
  bonuses: DeliveryGoalsBonusesConfig;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_DELIVERY_BUSINESS_CONFIG: DeliveryBusinessConfig = {
  enabled: true,
  tariffMode: "fixed",
  fixedFee: 5000,
  distanceConfig: {
    baseTariff: 3000,
    baseDistanceKm: 2,
    additionalKmTariff: 1000,
  },
  fallbackZoneFee: 5000,
  payer: "customer",
  assignmentMode: "manual",
  minOrderAmount: 0,
  freeDeliveryThreshold: null,
  timing: {
    maxAcceptTimeMinutes: 10,
    delayAlertMinutes: 30,
    autoReassignIfNotAccepted: false,
    reassignAfterMinutes: 10,
  },
  bonuses: {
    dailyDeliveryGoal: 15,
    goalBonusAmount: 20000,
    nightBonusEnabled: false,
    nightBonusStartTime: "20:00",
    nightBonusEndTime: "06:00",
    nightBonusAmount: 2000,
  },
};

/**
 * Normaliza y valida una configuración de domicilios asegurando valores por defecto seguros.
 */
export function normalizeDeliveryBusinessConfig(
  raw?: Partial<DeliveryBusinessConfig> | null
): DeliveryBusinessConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_DELIVERY_BUSINESS_CONFIG };
  }

  // Soporte de compatibilidad hacia atrás con { enabled, fee } plano anterior
  const legacyFee = typeof (raw as any).fee === "number" && !isNaN((raw as any).fee)
    ? (raw as any).fee
    : undefined;

  const tariffMode: DeliveryTariffMode =
    raw.tariffMode === "distance" || raw.tariffMode === "zone" || raw.tariffMode === "fixed"
      ? raw.tariffMode
      : DEFAULT_DELIVERY_BUSINESS_CONFIG.tariffMode;

  const payer: DeliveryPayer =
    raw.payer === "business" || raw.payer === "split_50_50" || raw.payer === "customer"
      ? raw.payer
      : DEFAULT_DELIVERY_BUSINESS_CONFIG.payer;

  const assignmentMode: DeliveryAssignmentMode =
    raw.assignmentMode === "auto_first" || raw.assignmentMode === "round_robin" || raw.assignmentMode === "manual"
      ? raw.assignmentMode
      : DEFAULT_DELIVERY_BUSINESS_CONFIG.assignmentMode;

  return {
    enabled: raw.enabled ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.enabled,
    tariffMode,
    fixedFee: Math.max(0, Number(raw.fixedFee ?? legacyFee ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.fixedFee)),
    distanceConfig: {
      baseTariff: Math.max(0, Number(raw.distanceConfig?.baseTariff ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.distanceConfig.baseTariff)),
      baseDistanceKm: Math.max(0, Number(raw.distanceConfig?.baseDistanceKm ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.distanceConfig.baseDistanceKm)),
      additionalKmTariff: Math.max(0, Number(raw.distanceConfig?.additionalKmTariff ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.distanceConfig.additionalKmTariff)),
    },
    fallbackZoneFee: Math.max(0, Number(raw.fallbackZoneFee ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.fallbackZoneFee)),
    payer,
    assignmentMode,
    minOrderAmount: Math.max(0, Number(raw.minOrderAmount ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.minOrderAmount)),
    freeDeliveryThreshold:
      typeof raw.freeDeliveryThreshold === "number" && raw.freeDeliveryThreshold > 0
        ? raw.freeDeliveryThreshold
        : null,
    timing: {
      maxAcceptTimeMinutes: Math.max(1, Number(raw.timing?.maxAcceptTimeMinutes ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.timing.maxAcceptTimeMinutes)),
      delayAlertMinutes: Math.max(1, Number(raw.timing?.delayAlertMinutes ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.timing.delayAlertMinutes)),
      autoReassignIfNotAccepted: Boolean(raw.timing?.autoReassignIfNotAccepted ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.timing.autoReassignIfNotAccepted),
      reassignAfterMinutes: Math.max(1, Number(raw.timing?.reassignAfterMinutes ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.timing.reassignAfterMinutes)),
    },
    bonuses: {
      dailyDeliveryGoal: Math.max(1, Number(raw.bonuses?.dailyDeliveryGoal ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.bonuses.dailyDeliveryGoal)),
      goalBonusAmount: Math.max(0, Number(raw.bonuses?.goalBonusAmount ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.bonuses.goalBonusAmount)),
      nightBonusEnabled: Boolean(raw.bonuses?.nightBonusEnabled ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.bonuses.nightBonusEnabled),
      nightBonusStartTime: raw.bonuses?.nightBonusStartTime || DEFAULT_DELIVERY_BUSINESS_CONFIG.bonuses.nightBonusStartTime,
      nightBonusEndTime: raw.bonuses?.nightBonusEndTime || DEFAULT_DELIVERY_BUSINESS_CONFIG.bonuses.nightBonusEndTime,
      nightBonusAmount: Math.max(0, Number(raw.bonuses?.nightBonusAmount ?? DEFAULT_DELIVERY_BUSINESS_CONFIG.bonuses.nightBonusAmount)),
    },
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  };
}

/**
 * Calcula la tarifa de domicilio final a cobrar al cliente y el subsidio asumido por el negocio.
 */
export function calculateDeliveryFeeForOrder(
  config: DeliveryBusinessConfig,
  subtotal: number,
  options?: {
    zoneTariff?: number | null;
    distanceKm?: number | null;
  }
): {
  customerDeliveryFee: number;
  businessSubsidizedFee: number;
  grossDeliveryTariff: number;
  isFreeShipping: boolean;
} {
  // 1. Determinar tarifa bruta según modalidad
  let grossTariff = 0;
  if (config.tariffMode === "fixed") {
    grossTariff = Math.max(0, Number(config.fixedFee || 0));
  } else if (config.tariffMode === "distance") {
    const dist = Math.max(0, Number(options?.distanceKm || 0));
    const base = Number(config.distanceConfig?.baseTariff || 0);
    const baseKm = Number(config.distanceConfig?.baseDistanceKm || 0);
    const perKm = Number(config.distanceConfig?.additionalKmTariff || 0);
    const extraKm = Math.max(0, dist - baseKm);
    grossTariff = base + extraKm * perKm;
  } else if (config.tariffMode === "zone") {
    grossTariff =
      typeof options?.zoneTariff === "number" && options.zoneTariff >= 0
        ? options.zoneTariff
        : Number(config.fallbackZoneFee || 0);
  }

  // 2. Umbral de compra para envío gratis (asumido 100% por el negocio si aplica)
  if (config.freeDeliveryThreshold && subtotal >= config.freeDeliveryThreshold) {
    return {
      customerDeliveryFee: 0,
      businessSubsidizedFee: grossTariff,
      grossDeliveryTariff: grossTariff,
      isFreeShipping: true,
    };
  }

  // 3. Aplicar regla de quién asume el costo
  if (config.payer === "business") {
    return {
      customerDeliveryFee: 0,
      businessSubsidizedFee: grossTariff,
      grossDeliveryTariff: grossTariff,
      isFreeShipping: true,
    };
  }

  if (config.payer === "split_50_50") {
    const customerHalf = Math.round(grossTariff / 2);
    const businessHalf = grossTariff - customerHalf;
    return {
      customerDeliveryFee: customerHalf,
      businessSubsidizedFee: businessHalf,
      grossDeliveryTariff: grossTariff,
      isFreeShipping: false,
    };
  }

  // Por defecto "customer" paga el 100%
  return {
    customerDeliveryFee: grossTariff,
    businessSubsidizedFee: 0,
    grossDeliveryTariff: grossTariff,
    isFreeShipping: false,
  };
}

// ==========================================
// Liquidación y Arqueo de Domicilios [DOM-006]
// ==========================================

export interface DeliverySettlementSummary {
  driverId: string;
  driverName: string;
  driverPhone?: string | null;
  totalOrdersDelivered: number;
  cashOrdersCount: number;
  digitalOrdersCount: number;
  totalCashCollected: number;
  totalDigitalCollected: number;
  totalRevenue: number;
  driverTips: number;
  driverDeliveryFeeShare: number;
  businessDeliveryFeeShare: number;
  pendingCashToSettle: number;
  isSettled: boolean;
  settledAt?: string | null;
  settledSessionId?: string | null;
  orderIds: string[];
}

export interface DeliverySettlementRecord {
  id: string;
  driverId: string;
  driverName: string;
  amount: number;
  sessionId: string;
  orderIds: string[];
  settledAt: string;
  notes?: string | null;
  createdBy?: string | null;
}

// ==========================================
// Novedades de Entrega [DOM-006]
// ==========================================

export type DeliveryIssueType =
  | "customer_absent"
  | "address_not_found"
  | "customer_rejected"
  | "accident_or_delay"
  | "other";

export const DELIVERY_ISSUE_LABELS: Record<DeliveryIssueType, string> = {
  customer_absent: "Cliente ausente / No contesta",
  address_not_found: "Dirección no encontrada / Incompleta",
  customer_rejected: "Pedido rechazado por cliente",
  accident_or_delay: "Demora en ruta / Incidente vial",
  other: "Otra novedad",
};

