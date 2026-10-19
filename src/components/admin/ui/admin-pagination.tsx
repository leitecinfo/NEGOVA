"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/pagination`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  Pagination as AdminPagination,
  type PaginationProps as AdminPaginationProps,
} from "@/components/ui/pagination";

export * from "@/components/ui/pagination";
