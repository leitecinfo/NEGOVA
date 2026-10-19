"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/error-state`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  ErrorState as AdminErrorState,
  type ErrorStateProps as AdminErrorStateProps,
} from "@/components/ui/error-state";

export * from "@/components/ui/error-state";
