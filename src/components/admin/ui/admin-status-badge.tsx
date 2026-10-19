"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/status-badge`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  StatusBadge as AdminStatusBadge,
  type StatusBadgeProps as AdminStatusBadgeProps,
  type StatusBadgeVariant as AdminStatusBadgeVariant,
} from "@/components/ui/status-badge";

export * from "@/components/ui/status-badge";
