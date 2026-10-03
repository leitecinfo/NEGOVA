import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preguntas Frecuentes",
  description: "Resuelve tus dudas sobre el funcionamiento y características de NEGOVA.",
};

export default function PreguntasFrecuentesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
