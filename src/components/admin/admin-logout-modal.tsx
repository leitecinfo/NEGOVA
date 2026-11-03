"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/logout-modal`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en el panel de administración.
 */
export {
  LogoutModal as AdminLogoutModal,
  type LogoutModalProps as AdminLogoutModalProps,
} from "@/components/ui/logout-modal";

export * from "@/components/ui/logout-modal";
