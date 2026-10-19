"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/input`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  Input as AdminInput,
  type InputProps as AdminInputProps,
} from "@/components/ui/input";

export * from "@/components/ui/input";
