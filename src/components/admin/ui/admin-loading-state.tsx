"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/loading-skeleton`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  LoadingSkeleton as AdminLoadingSkeleton,
  TableSkeleton as AdminTableSkeleton,
  KpiSkeleton as AdminKpiSkeleton,
  CardSkeleton as AdminCardSkeleton,
} from "@/components/ui/loading-skeleton";

export * from "@/components/ui/loading-skeleton";
