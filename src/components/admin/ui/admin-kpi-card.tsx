"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/kpi-card`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  KpiCard as AdminKpiCard,
  KpiGrid as AdminKpiGrid,
  type KpiVariant as AdminKpiVariant,
  type KpiCardProps as AdminKpiCardProps,
  type KpiGridProps as AdminKpiGridProps,
} from "@/components/ui/kpi-card";

export * from "@/components/ui/kpi-card";
