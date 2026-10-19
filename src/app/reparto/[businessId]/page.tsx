import React from "react";
import { notFound } from "next/navigation";
import { getDbClient } from "@/lib/restaurant/restaurant-service";
import { DriverAppClient } from "./driver-app-client";

interface PageProps {
  params: Promise<{
    businessId: string;
  }>;
}

export const metadata = {
  title: "Portal de Reparto · NEGOVA",
  description: "Acceso operativo para domiciliarios y confirmación de entregas.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
};

export default async function DriverDeliveryPortalPage({ params }: PageProps) {
  const { businessId } = await params;

  if (!businessId) {
    notFound();
  }

  const supabase = await getDbClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name, logo_url")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) {
    notFound();
  }

  return (
    <DriverAppClient
      businessId={business.id}
      businessName={business.name || "Comercio NEGOVA"}
    />
  );
}
