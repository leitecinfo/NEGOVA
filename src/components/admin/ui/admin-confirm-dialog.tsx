"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/confirm-dialog`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en el panel de administración.
 */
export {
  ConfirmDialog as AdminConfirmDialog,
  type ConfirmDialogProps as AdminConfirmDialogProps,
  type ConfirmVariant as AdminConfirmVariant,
} from "@/components/ui/confirm-dialog";

export * from "@/components/ui/confirm-dialog";
