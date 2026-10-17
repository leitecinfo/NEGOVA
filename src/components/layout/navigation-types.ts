import { LucideIcon } from "lucide-react";

export type AppNavBadgeVariant = "default" | "brand" | "muted" | "warning" | "success" | "danger";

export interface AppNavSubItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  badge?: {
    text: string;
    variant?: AppNavBadgeVariant;
  };
}

export interface AppNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  section: string;
  description?: string;
  badge?: {
    text: string;
    variant?: AppNavBadgeVariant;
  };
  exactMatch?: boolean;
  subItems?: AppNavSubItem[];
  // Replaces requiredRoles / permissions to be evaluated before passing them to the layout
  allowed?: boolean;
}

export interface AppNavSection {
  id: string;
  label: string;
  items: AppNavItem[];
}

export interface AppUserProfile {
  id?: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  roleLabel: string;
}

export interface AppBranding {
  logoUrl?: string;
  appTitle: string;
  appSubtitle?: string;
  homeUrl: string;
  primaryColor?: string;
}
