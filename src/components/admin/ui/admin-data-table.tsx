"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/data-table`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  DataTable as AdminDataTable,
  type DataTableColumn as AdminDataTableColumn,
  type DataTableProps as AdminDataTableProps,
} from "@/components/ui/data-table";

export * from "@/components/ui/data-table";
