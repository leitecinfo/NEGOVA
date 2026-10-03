import React from "react";
import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/auth/admin-context";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";

export const metadata: Metadata = {
  title: {
    default: "Panel Administrativo | NEGOVA",
    template: "%s | Admin NEGOVA",
  },
  description: "Panel de administración y control global de la plataforma SaaS NEGOVA",
  icons: {
    icon: "/isotipo.png",
    shortcut: "/isotipo.png",
    apple: "/isotipo.png",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verificación estricta de sesión y privilegios en el servidor
  const user = await requireAdminSession();

  return <AdminLayoutShell user={user}>{children}</AdminLayoutShell>;
}
