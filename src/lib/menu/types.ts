import { Product, Category } from "@/lib/products/types";

export type DigitalMenuModality = "template" | "custom" | "file";

export type DigitalMenuTemplateId = "urbana" | "elegante" | "comercial" | "visual";

export interface DigitalMenuCustomSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: "sans" | "serif" | "display" | "mono";
  fontSize: "sm" | "md" | "lg";
  layoutStyle: "grid" | "list" | "compact" | "text";
  showDescriptions: boolean;
  showPhotos: boolean;
  showPrices: boolean;
  showContactInfo: boolean;
  showAddress: boolean;
  bannerTitle?: string;
  bannerSubtitle?: string;
}

export interface BusinessDigitalMenu {
  id: string;
  business_id: string;
  is_published: boolean;
  modality: DigitalMenuModality;
  template_id: DigitalMenuTemplateId;
  custom_settings: DigitalMenuCustomSettings;
  file_url: string | null;
  file_storage_path: string | null;
  file_type: "pdf" | "image" | null;
  file_name: string | null;
  file_size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

export interface DigitalMenuPublicBusiness {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  currency: string;
  whatsapp?: string | null;
  instagram?: string | null;
  schedule?: string | null;
}

export interface DigitalMenuPublicData {
  business: DigitalMenuPublicBusiness;
  menu: BusinessDigitalMenu;
  categories: Category[];
  products: Product[];
}

export const DEFAULT_DIGITAL_MENU_SETTINGS: DigitalMenuCustomSettings = {
  primaryColor: "#ED500A",
  secondaryColor: "#0B0D13",
  accentColor: "#F59E0B",
  fontFamily: "sans",
  fontSize: "md",
  layoutStyle: "grid",
  showDescriptions: true,
  showPhotos: true,
  showPrices: true,
  showContactInfo: true,
  showAddress: true,
};

export interface TemplateMetadata {
  id: DigitalMenuTemplateId;
  name: string;
  category: string;
  description: string;
  previewThumbnail: string;
  recommendedFor: string;
  defaultColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export const DIGITAL_MENU_TEMPLATES: TemplateMetadata[] = [
  {
    id: "urbana",
    name: "Oscuro Rojo & Urbano",
    category: "Comida Rápida & Street Food",
    description:
      "Inspirado en locales de alto voltaje: fondo negro puro (#0A0A0A), banner inclinado con datos del local, etiquetas sesgadas de precio y tarjeta con borde rojo.",
    previewThumbnail: "/templates/urbana-thumb.svg",
    recommendedFor: "Hamburgueserías, pizzerías, salchipaperías y locales de comida rápida nocturna.",
    defaultColors: {
      primary: "#E10600",
      secondary: "#0A0A0A",
      accent: "#FFFFFF",
    },
  },
  {
    id: "comercial",
    name: "Blanco Minimal",
    category: "Comercio Limpio & Contemporáneo",
    description:
      "Diseño ligero y sereno (#FAFAF8), chips 100% redondeados, tarjetas minimalistas y pie de página en 3 columnas para ubicación y horario.",
    previewThumbnail: "/templates/comercial-thumb.svg",
    recommendedFor: "Cafeterías, panaderías, heladerías, delis y restaurantes familiares.",
    defaultColors: {
      primary: "#111111",
      secondary: "#FAFAF8",
      accent: "#F0EFEC",
    },
  },
  {
    id: "visual",
    name: "Neo-Brutalista",
    category: "Creativa & Alto Impacto",
    description:
      "Fondo cálido crema (#FFF7E0), bordes negros gruesos (3px), sombras 3D sólidas (5px 5px 0), stickers inclinados y marquesina ticker en vivo.",
    previewThumbnail: "/templates/visual-thumb.svg",
    recommendedFor: "Smash burgers, locales juveniles, marcas con personalidad rebelde y combos.",
    defaultColors: {
      primary: "#FF3B30",
      secondary: "#FFF7E0",
      accent: "#FFD60A",
    },
  },
  {
    id: "elegante",
    name: "Elegante Noir & Oro",
    category: "Gastronomía de Autor & Lujo",
    description:
      "Carta sofisticada en fondo noir (#0C0D11) con toques en oro viejo y champán, tipografía con serifa clásica y espaciado gastronómico.",
    previewThumbnail: "/templates/elegante-thumb.svg",
    recommendedFor: "Restaurantes gourmet, asaderos selectos, bistrós y coctelerías.",
    defaultColors: {
      primary: "#C5A059",
      secondary: "#0C0D11",
      accent: "#E8D8B8",
    },
  },
];
