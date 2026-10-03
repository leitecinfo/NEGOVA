import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Servicios",
  description: "Agenda clientes, gestiona comisiones y turnos en tu barbería, spa o taller con NEGOVA.",
};

export default function ServiciosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
