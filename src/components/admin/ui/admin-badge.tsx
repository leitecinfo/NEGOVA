"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/badge`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  Badge as AdminBadge,
  type BadgeProps as AdminBadgeProps,
  type BadgeVariant as AdminBadgeVariant,
} from "@/components/ui/badge";

export * from "@/components/ui/badge";
