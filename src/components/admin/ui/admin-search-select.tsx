"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/search-select`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  SearchSelect as AdminSearchSelect,
  type SearchSelectOption as AdminSearchSelectOption,
  type SearchSelectProps as AdminSearchSelectProps,
} from "@/components/ui/search-select";

export * from "@/components/ui/search-select";
