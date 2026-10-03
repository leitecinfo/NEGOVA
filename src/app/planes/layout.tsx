import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planes y Precios",
  description: "Elige el plan ideal de NEGOVA para automatizar tu negocio.",
};

export default function PlanesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
