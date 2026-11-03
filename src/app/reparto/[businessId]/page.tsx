import React from "react";
import { notFound } from "next/navigation";
import { getDbClient } from "@/lib/restaurant/restaurant-service";
import { getDriverDispatchSessionByToken } from "@/lib/delivery/delivery-service";
import { DriverAppClient } from "./driver-app-client";
import { DriverSessionPortalClient } from "./driver-session-portal-client";
import { Lock } from "lucide-react";

interface PageProps {
  params: Promise<{
    businessId: string;
  }>;
}

export const metadata = {
  title: "Portal de Reparto · NEGOVA",
  description: "Acceso operativo para domiciliarios y confirmación de entregas.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
  referrer: "no-referrer" as const,
};

export default async function DriverDeliveryPortalPage({ params }: PageProps) {
  const { businessId: rawParam } = await params;

  if (!rawParam || typeof rawParam !== "string") {
    notFound();
  }

  const cleanParam = rawParam.trim();

  // 1. Verificar si el parámetro corresponde a un token criptográfico de sesión segura
  const sessionResult = await getDriverDispatchSessionByToken(cleanParam);
  if (sessionResult.success && sessionResult.session) {
    const supabase = await getDbClient();
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, logo_url")
      .eq("id", sessionResult.session.businessId)
      .maybeSingle();

    return (
      <DriverSessionPortalClient
        token={cleanParam}
        initialBusinessName={business?.name || "Restaurante"}
        initialDriverName={sessionResult.session.driverName}
        initialExpiresAt={sessionResult.session.expiresAt}
      />
    );
  }

  // 2. Si no es un token pero es un UUID de negocio, mantener compatibilidad con portal por PIN
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanParam);
  if (isUuid) {
    const supabase = await getDbClient();
    const { data: business, error } = await supabase
      .from("businesses")
      .select("id, name, logo_url")
      .eq("id", cleanParam)
      .maybeSingle();

    if (!error && business) {
      return (
        <DriverAppClient
          businessId={business.id}
          businessName={business.name || "Comercio NEGOVA"}
        />
      );
    }
  }

  // 3. Si el token no existe, venció o fue revocado, mostrar vista segura sin exponer datos del sistema
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-xs text-center space-y-4 animate-in fade-in">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-neutral-900 dark:text-white">
            Enlace de Reparto no Disponible
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Este enlace de acceso ha expirado, fue revocado o no es válido. Si tienes pedidos pendientes por entregar, comunícate con el restaurante para que te envíen un nuevo enlace seguro.
          </p>
        </div>
      </div>
    </div>
  );
}
