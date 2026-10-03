import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Ponte en contacto con el equipo de NEGOVA. Hablemos de tu negocio.",
};

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
