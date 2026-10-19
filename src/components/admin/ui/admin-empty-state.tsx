"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/empty-state`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  EmptyState as AdminEmptyState,
  type EmptyStateProps as AdminEmptyStateProps,
} from "@/components/ui/empty-state";

export * from "@/components/ui/empty-state";
