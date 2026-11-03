/**
 * NEGOVA — Tipos y Definiciones para la Página de Enlaces (Linktree / Bio Links) [CONF-005]
 */

export type LinkIconType =
  | "menu"
  | "utensils"
  | "shopping-bag"
  | "message-circle"
  | "instagram"
  | "map-pin"
  | "phone"
  | "globe"
  | "facebook"
  | "tiktok"
  | "mail"
  | "star"
  | "link";

export type BioThemePreset =
  | "slate"
  | "dark"
  | "emerald"
  | "indigo"
  | "rose"
  | "amber"
  | "gradient_sunset"
  | "gradient_ocean";

export interface BioLinkItem {
  id: string;
  title: string;
  url: string;
  icon: LinkIconType | string;
  order: number;
  isActive: boolean;
  isPredefined?: boolean;
  predefinedType?: "menu" | "delivery" | "whatsapp" | "instagram" | "maps" | "other";
}

export interface BusinessLinksPageConfig {
  businessId: string;
  businessName: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  theme: BioThemePreset;
  customPrimaryColor?: string | null;
  links: BioLinkItem[];
  showPoweredBy: boolean;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
    website?: string;
  };
  updatedAt?: string;
}

export interface UpdateLinksPageInput {
  businessName?: string;
  slug?: string;
  logoUrl?: string | null;
  description?: string | null;
  theme?: BioThemePreset;
  customPrimaryColor?: string | null;
  links?: BioLinkItem[];
  showPoweredBy?: boolean;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
    website?: string;
  };
}
