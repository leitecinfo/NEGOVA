"use client";

/**
 * @deprecated Este componente ha sido neutralizado a `@/components/ui/tabs`.
 * Se conserva este archivo exclusivamente como puente de compatibilidad retroactiva
 * para no romper las importaciones existentes en módulos de Workspace y Admin.
 */
export {
  Tabs as AdminTabs,
  type TabItem as AdminTabItem,
  type TabsProps as AdminTabsProps,
} from "@/components/ui/tabs";

export * from "@/components/ui/tabs";
