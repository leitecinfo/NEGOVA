"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/select`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  Select as AdminSelect,
  type SelectOption as AdminSelectOption,
  type SelectProps as AdminSelectProps,
} from "@/components/ui/select";

export * from "@/components/ui/select";
