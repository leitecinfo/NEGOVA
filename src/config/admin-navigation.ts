import {
  LayoutDashboard,
  Users,
  User,
  Building2,
  CreditCard,
  Layers,
  Headphones,
  Receipt,
  ShieldCheck,
  Settings,
  Sliders,
  Lock,
  UserCheck,
  Bell,
  Cpu,
  Wallet,
  Gauge,
  History,
  type LucideIcon,
} from "lucide-react";

export type AdminSectionId = "principal" | "gestion" | "operacion" | "control" | "sistema" | "cuenta";

export interface AdminNavSubItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  badge?: {
    text: string;
    variant?: "default" | "brand" | "muted";
  };
}

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  section: AdminSectionId;
  description?: string;
  badge?: {
    text: string;
    variant?: "default" | "brand" | "muted";
  };
  requiredRoles?: Array<"super_admin" | "admin">;
  permissions?: string[];
  exactMatch?: boolean;
  subItems?: AdminNavSubItem[];
}

export interface AdminNavSection {
  id: AdminSectionId;
  label: string;
  items: AdminNavItem[];
}

/**
 * Subsecciones oficiales del módulo de Configuración de Plataforma (NEGOVA Global)
 */
export const PLATFORM_CONFIG_SUBITEMS: AdminNavSubItem[] = [
  {
    id: "general",
    label: "General",
    href: "/admin/configuracion?tab=general",
    icon: Sliders,
    description: "Identidad, país, moneda base y parámetros globales",
  },
  {
    id: "seguridad",
    label: "Seguridad",
    href: "/admin/configuracion?tab=seguridad",
    icon: Lock,
    description: "Políticas de contraseñas, sesiones, MFA y bloqueos",
  },
  {
    id: "usuarios-acceso",
    label: "Usuarios y acceso",
    href: "/admin/configuracion?tab=usuarios-acceso",
    icon: UserCheck,
    description: "Roles internos, permisos por defecto e invitaciones",
  },
  {
    id: "facturacion",
    label: "Facturación",
    href: "/admin/configuracion?tab=facturacion",
    icon: Wallet,
    description: "Modelo de cobro manual, moneda base COP y datos fiscales",
  },
  {
    id: "planes-limites",
    label: "Planes y límites",
    href: "/admin/configuracion?tab=planes-limites",
    icon: Gauge,
    description: "Cuotas de almacenamiento, usuarios y productos",
  },
  {
    id: "auditoria",
    label: "Auditoría",
    href: "/admin/configuracion?tab=auditoria",
    icon: History,
    description: "Políticas de retención y registro de logs",
  },
];

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "principal",
    label: "Principal",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        section: "principal",
        description: "Visión global y métricas del sistema",
        exactMatch: true,
        requiredRoles: ["super_admin", "admin"],
      },
    ],
  },
  {
    id: "gestion",
    label: "Gestión",
    items: [
      {
        id: "usuarios",
        label: "Usuarios",
        href: "/admin/usuarios",
        icon: Users,
        section: "gestion",
        description: "Administración global de identidades y accesos",
        requiredRoles: ["super_admin", "admin"],
      },
      {
        id: "roles",
        label: "Roles y permisos",
        href: "/admin/roles",
        icon: ShieldCheck,
        section: "gestion",
        description: "Matriz granular de autorización y roles internos",
        requiredRoles: ["super_admin", "admin"],
      },
      {
        id: "negocios",
        label: "Negocios",
        href: "/admin/negocios",
        icon: Building2,
        section: "gestion",
        description: "Directorio de empresas y tenants registrados",
        requiredRoles: ["super_admin", "admin"],
      },
      {
        id: "suscripciones",
        label: "Suscripciones",
        href: "/admin/suscripciones",
        icon: CreditCard,
        section: "gestion",
        description: "Estado de cobros y suscripciones activas",
        requiredRoles: ["super_admin", "admin"],
      },
      {
        id: "planes",
        label: "Planes",
        href: "/admin/planes",
        icon: Layers,
        section: "gestion",
        description: "Catálogo comercial y capacidades de planes",
        requiredRoles: ["super_admin", "admin"],
      },
    ],
  },
  {
    id: "operacion",
    label: "Operación",
    items: [
      {
        id: "soporte",
        label: "Soporte",
        href: "/admin/soporte",
        icon: Headphones,
        section: "operacion",
        description: "Tickets de atención e incidencias de clientes",
        requiredRoles: ["super_admin", "admin"],
      },
      {
        id: "facturacion",
        label: "Facturación",
        href: "/admin/facturacion",
        icon: Receipt,
        section: "operacion",
        description: "Recibos, cobros y estado de pago de suscripciones",
        requiredRoles: ["super_admin", "admin"],
      },
      {
        id: "finanzas",
        label: "Finanzas",
        href: "/admin/finanzas",
        icon: Wallet,
        section: "operacion",
        description: "MRR, ARR, flujo de caja y finanzas de NEGOVA",
        requiredRoles: ["super_admin", "admin"],
      },
      {
        id: "personal",
        label: "Personal & Nómina",
        href: "/admin/personal",
        icon: Users,
        section: "operacion",
        description: "Equipo interno de NEGOVA Core y nómina corporativa",
        requiredRoles: ["super_admin", "admin"],
      },
    ],
  },
  {
    id: "control",
    label: "Control",
    items: [
      {
        id: "auditoria",
        label: "Auditoría",
        href: "/admin/auditoria",
        icon: ShieldCheck,
        section: "control",
        description: "Registro cronológico de eventos y seguridad forense",
        requiredRoles: ["super_admin", "admin"],
      },
      {
        id: "notificaciones",
        label: "Notificaciones",
        href: "/admin/notificaciones",
        icon: Bell,
        section: "control",
        description: "Alertas del sistema y avisos de plataforma",
        requiredRoles: ["super_admin", "admin"],
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      {
        id: "configuracion",
        label: "Configuración",
        href: "/admin/configuracion",
        icon: Settings,
        section: "sistema",
        description: "Ajustes globales de la plataforma NEGOVA",
        requiredRoles: ["super_admin", "admin"],
        subItems: PLATFORM_CONFIG_SUBITEMS,
      },
    ],
  },
  {
    id: "cuenta",
    label: "Cuenta",
    items: [
      {
        id: "perfil",
        label: "Mi Perfil",
        href: "/admin/perfil",
        icon: User,
        section: "cuenta",
        description: "Gestión de credenciales, avatar y seguridad personal",
        requiredRoles: ["super_admin", "admin"],
      },
    ],
  },
];

export const ADMIN_EXTRA_NAV_ITEMS: AdminNavItem[] = [];

export const ALL_ADMIN_NAV_ITEMS: AdminNavItem[] = [
  ...ADMIN_NAV_SECTIONS.flatMap((section) => section.items),
  ...ADMIN_EXTRA_NAV_ITEMS,
];
