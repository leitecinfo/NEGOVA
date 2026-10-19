"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/table-toolbar`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  TableToolbar as AdminTableToolbar,
  type TableToolbarProps as AdminTableToolbarProps,
} from "@/components/ui/table-toolbar";

export * from "@/components/ui/table-toolbar";
