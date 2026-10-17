/**
 * Definiciones, Taxonomía, Tipos y Funciones Puras de Negocios
 * 100% seguro para importar tanto en Server Components como en Client Components (zero side-effects).
 */

import {
  PlanId,
  BillingInterval,
  VigenciaBadgeInfo,
} from "@/config/plans";
import { CommercialActivity } from "@/config/commercial-activities";

export type { CommercialActivity };


export type BusinessCategory =
  | "gastronomicos"
  | "comercios"
  | "servicios"
  | "mercados"
  | "other"
  // Compatibilidad con identificadores anteriores
  | "gastronomy"
  | "retail"
  | "service";

export type BusinessType =
  // 1. Gastronómicos
  | "restaurant"
  | "cafe"
  | "bar"
  | "fast_food"
  | "fast_food_restaurant"
  | "liquor_store"
  | "bakery"
  | "pizzeria"
  | "ice_cream"
  | "gastronomy"
  | "gastronomy_other"
  // 2. Comercio
  | "fashion"
  | "hardware"
  | "stationery"
  | "technology"
  | "pharmacy"
  | "pets"
  | "retail"
  | "retail_other"
  // 3. Servicios
  | "barbershop"
  | "automotive"
  | "spa"
  | "technical_service"
  | "laundry"
  | "gym"
  | "health"
  | "veterinary"
  | "professional"
  | "service"
  | "service_other"
  // 4. Mercados
  | "minimarket"
  | "supermarket"
  | "fruits_vegetables"
  | "butchery"
  | "wholesale"
  | "distributor"
  | "market_other"
  // 5. General / Otro
  | "other";

export type BusinessStatus = "active" | "inactive" | "suspended" | "trial";

export interface BusinessOwnerSummary {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
}

export interface BusinessPlanSummary {
  planId: PlanId;
  name: string;
  code: string;
  status: string;
  price: number; // Precio de lista del plan
  planPrice: number; // Precio de lista del plan
  currentPrice: number; // Precio actual durante el periodo ($0 COP si está en prueba)
  currency: string;
  maxUsers: number;
  maxProducts: number;
  billingInterval: BillingInterval;
  contractDuration: number;
  durationFormatted: string;
  monthsContracted: number;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  remainingDays: number;
  trialRemainingDays: number | null;
  isExpired: boolean;
  isTrial: boolean;
  vigenciaBadge: VigenciaBadgeInfo;
}

export interface BusinessUserMembership {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  roleId: string;
  roleCode: string;
  roleName: string;
  status: string;
  invitedAt: string | null;
  joinedAt: string | null;
}

export interface BusinessModel {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  commercialActivities: CommercialActivity[];
  settings?: Record<string, any>;
  description: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  country: string;
  status: BusinessStatus;
  timezone: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  owner: BusinessOwnerSummary | null;
  plan: BusinessPlanSummary | null;
  userCount: number;
}

export interface BusinessListFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  businessType?: string;
  sortBy?: "created_at" | "name" | "status";
  sortOrder?: "asc" | "desc";
}

export interface BusinessListResult {
  businesses: BusinessModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    total: number;
    activeCount: number;
    trialCount: number;
    suspendedCount: number;
    inactiveCount: number;
  };
}

export interface CreateBusinessInput {
  name: string;
  slug?: string;
  businessType: BusinessType;
  commercialActivities?: CommercialActivity[];
  settings?: Record<string, any>;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  department?: string;
  country?: string;
  status?: BusinessStatus;
  planId?: PlanId;
  billingInterval?: BillingInterval;
  contractDuration?: number;
  startDate?: string;
  monthsContracted?: number;
  ownerUserId?: string;
  timezone?: string;
  currency?: string;
}

export interface UpdateBusinessInput {
  name?: string;
  slug?: string;
  businessType?: BusinessType;
  commercialActivities?: CommercialActivity[];
  settings?: Record<string, any>;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  department?: string;
  country?: string;
  timezone?: string;
  currency?: string;
  ownerUserId?: string;
}

export interface BusinessCategoryDefinition {
  id: BusinessCategory;
  label: string;
  iconName: string;
  badgeColor: string;
  types: Array<{
    value: BusinessType;
    label: string;
    iconName: string;
  }>;
}

export const BUSINESS_CATEGORIES: BusinessCategoryDefinition[] = [
  {
    id: "gastronomicos",
    label: "Gastronómicos",
    iconName: "UtensilsCrossed",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    types: [
      { value: "fast_food_restaurant", label: "Restaurante de comida rápida", iconName: "UtensilsCrossed" },
    ],
  },
  {
    id: "comercios",
    label: "Comercio",
    iconName: "Store",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    types: [],
  },
  {
    id: "servicios",
    label: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    types: [],
  },
  {
    id: "mercados",
    label: "Mercados",
    iconName: "Store",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
    types: [],
  },
  {
    id: "other",
    label: "Otro Sector",
    iconName: "Building2",
    badgeColor: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
    types: [],
  },
];

export function getCategoryFromBusinessType(businessType: BusinessType): BusinessCategory {
  for (const cat of BUSINESS_CATEGORIES) {
    if (cat.types.some((t) => t.value === businessType)) {
      return cat.id;
    }
  }
  return "other";
}

export const BUSINESS_TYPE_LABELS: Record<
  BusinessType,
  { label: string; category: BusinessCategory; categoryLabel: string; iconName: string; badgeColor: string }
> = {
  // 1. Gastronómicos
  restaurant: {
    label: "Restaurantes",
    category: "gastronomicos",
    categoryLabel: "Gastronómicos",
    iconName: "UtensilsCrossed",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  cafe: {
    label: "Cafés & Cafeterías",
    category: "gastronomicos",
    categoryLabel: "Gastronómicos",
    iconName: "Coffee",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  bar: {
    label: "Bares & Gastrobares",
    category: "gastronomicos",
    categoryLabel: "Gastronómicos",
    iconName: "Wine",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  fast_food: {
    label: "Comidas Rápidas",
    category: "gastronomicos",
    categoryLabel: "Gastronómicos",
    iconName: "UtensilsCrossed",
    badgeColor: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
  },
  fast_food_restaurant: {
    label: "Restaurante de comida rápida",
    category: "gastronomicos",
    categoryLabel: "Gastronómicos",
    iconName: "UtensilsCrossed",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  liquor_store: {
    label: "Licoreras & Estancos",
    category: "gastronomicos",
    categoryLabel: "Gastronómicos",
    iconName: "Wine",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  bakery: {
    label: "Panaderías & Pastelerías",
    category: "gastronomicos",
    categoryLabel: "Gastronómicos",
    iconName: "UtensilsCrossed",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  pizzeria: {
    label: "Pizzerías",
    category: "gastronomicos",
    categoryLabel: "Gastronómicos",
    iconName: "UtensilsCrossed",
    badgeColor: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  },
  ice_cream: {
    label: "Heladerías & Postres",
    category: "gastronomicos",
    categoryLabel: "Gastronómicos",
    iconName: "UtensilsCrossed",
    badgeColor: "bg-pink-500/10 text-pink-600 border-pink-500/20 dark:text-pink-400",
  },
  gastronomy: {
    label: "Gastronomía (General)",
    category: "gastronomicos",
    categoryLabel: "Gastronómicos",
    iconName: "UtensilsCrossed",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  gastronomy_other: {
    label: "Otro gastronómico",
    category: "gastronomicos",
    categoryLabel: "Gastronómicos",
    iconName: "UtensilsCrossed",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },

  // 2. Comercio
  fashion: {
    label: "Tiendas de ropa & calzado",
    category: "comercios",
    categoryLabel: "Comercio",
    iconName: "Store",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  },
  hardware: {
    label: "Ferreterías & Pinturas",
    category: "comercios",
    categoryLabel: "Comercio",
    iconName: "Store",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  },
  stationery: {
    label: "Papelerías & Variedades",
    category: "comercios",
    categoryLabel: "Comercio",
    iconName: "Store",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  },
  technology: {
    label: "Tecnología & Celulares",
    category: "comercios",
    categoryLabel: "Comercio",
    iconName: "Store",
    badgeColor: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400",
  },
  pharmacy: {
    label: "Droguerías & Farmacias",
    category: "comercios",
    categoryLabel: "Comercio",
    iconName: "Store",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  pets: {
    label: "Tiendas de mascotas / Pets",
    category: "comercios",
    categoryLabel: "Comercio",
    iconName: "Store",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  retail: {
    label: "Comercio (General)",
    category: "comercios",
    categoryLabel: "Comercio",
    iconName: "Store",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  },
  retail_other: {
    label: "Otro comercio",
    category: "comercios",
    categoryLabel: "Comercio",
    iconName: "Store",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  },

  // 3. Servicios
  barbershop: {
    label: "Barberías & Peluquerías",
    category: "servicios",
    categoryLabel: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  automotive: {
    label: "Talleres mecánicos",
    category: "servicios",
    categoryLabel: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400",
  },
  spa: {
    label: "Estéticas & Spas",
    category: "servicios",
    categoryLabel: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  technical_service: {
    label: "Servicios técnicos",
    category: "servicios",
    categoryLabel: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
  },
  laundry: {
    label: "Lavanderías & Tintorerías",
    category: "servicios",
    categoryLabel: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  gym: {
    label: "Gimnasios & Fitness",
    category: "servicios",
    categoryLabel: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  health: {
    label: "Salud & Odontología",
    category: "servicios",
    categoryLabel: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-teal-500/10 text-teal-600 border-teal-500/20 dark:text-teal-400",
  },
  veterinary: {
    label: "Veterinarias",
    category: "servicios",
    categoryLabel: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  professional: {
    label: "Servicios Profesionales",
    category: "servicios",
    categoryLabel: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  service: {
    label: "Servicios (General)",
    category: "servicios",
    categoryLabel: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  service_other: {
    label: "Otro servicio",
    category: "servicios",
    categoryLabel: "Servicios",
    iconName: "Briefcase",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },

  // 4. Mercados
  minimarket: {
    label: "Minimercados & Tiendas de barrio",
    category: "mercados",
    categoryLabel: "Mercados",
    iconName: "Store",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  supermarket: {
    label: "Supermercados de barrio",
    category: "mercados",
    categoryLabel: "Mercados",
    iconName: "Store",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  fruits_vegetables: {
    label: "Fruterías & Verdulerías",
    category: "mercados",
    categoryLabel: "Mercados",
    iconName: "Store",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  butchery: {
    label: "Carnicerías & Charcuterías",
    category: "mercados",
    categoryLabel: "Mercados",
    iconName: "Store",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  wholesale: {
    label: "Depósitos & Mayoristas",
    category: "mercados",
    categoryLabel: "Mercados",
    iconName: "Store",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  distributor: {
    label: "Distribuidoras de alimentos",
    category: "mercados",
    categoryLabel: "Mercados",
    iconName: "Store",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  market_other: {
    label: "Otro mercado",
    category: "mercados",
    categoryLabel: "Mercados",
    iconName: "Store",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },

  // 5. General / Otro
  other: {
    label: "Otro",
    category: "other",
    categoryLabel: "Otro Sector",
    iconName: "Building2",
    badgeColor: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
  },
};

export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, { label: string; badgeColor: string }> = {
  active: {
    label: "Activo",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  trial: {
    label: "En prueba",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  suspended: {
    label: "Suspendido",
    badgeColor: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  },
  inactive: {
    label: "Inactivo",
    badgeColor: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
  },
};

/**
 * Matriz de transiciones de estado válidas
 */
export const VALID_STATUS_TRANSITIONS: Record<BusinessStatus, BusinessStatus[]> = {
  trial: ["active", "suspended", "inactive"],
  active: ["suspended", "inactive", "trial"],
  suspended: ["active", "inactive"],
  inactive: ["active", "trial"],
};

/**
 * Genera un slug limpio y amigable para URL a partir del nombre
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar tildes
    .replace(/[^a-z0-9\s-]/g, "") // Eliminar caracteres especiales
    .replace(/\s+/g, "-") // Espacios por guiones
    .replace(/-+/g, "-") // Guiones repetidos
    .replace(/^-+|-+$/g, ""); // Guiones al inicio/fin
}
