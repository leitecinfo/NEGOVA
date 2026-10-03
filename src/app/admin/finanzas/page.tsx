import { Metadata } from "next";
import { getPlatformFinancialSummary } from "@/lib/finance/finance-service";
import { FinanzasClient } from "./finanzas-client";

export const metadata: Metadata = {
  title: "Finanzas de Plataforma | NEGOVA Admin",
  description: "Control financiero, MRR, ARR, flujo de caja e ingresos de la plataforma NEGOVA.",
};

export const dynamic = "force-dynamic";

export default async function AdminFinanzasPage() {
  const financialSummary = await getPlatformFinancialSummary();

  return <FinanzasClient initialData={financialSummary} />;
}
