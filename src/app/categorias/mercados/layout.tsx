import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mercados",
  description: "Controla las ventas de alta rotación en tu minimercado, verdulería o kiosco con NEGOVA.",
};

export default function MercadosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
