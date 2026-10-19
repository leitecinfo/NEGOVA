"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/search-input`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  SearchInput as AdminSearchInput,
  type SearchInputProps as AdminSearchInputProps,
} from "@/components/ui/search-input";

export * from "@/components/ui/search-input";
