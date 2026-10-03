import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comercio",
  description: "Optimiza las ventas e inventarios de tu tienda de ropa, papelería o ferretería con NEGOVA.",
};

export default function ComercioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
