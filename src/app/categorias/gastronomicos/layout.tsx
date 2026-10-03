import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gastronomía",
  description: "Automatiza tu restaurante, bar, panadería o cafetería con NEGOVA.",
};

export default function GastronomicosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
