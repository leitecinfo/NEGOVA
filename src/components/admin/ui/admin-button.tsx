"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/button`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  Button as AdminButton,
  IconButton as AdminIconButton,
  ButtonGroup as AdminButtonGroup,
  type ButtonProps as AdminButtonProps,
  type IconButtonProps as AdminIconButtonProps,
  type ButtonVariant as AdminButtonVariant,
  type ButtonSize as AdminButtonSize,
} from "@/components/ui/button";

export * from "@/components/ui/button";
