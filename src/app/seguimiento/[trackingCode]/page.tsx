import React from "react";
import { Metadata } from "next";
import { getPublicOrderTracking } from "@/lib/delivery/tracking-service";
import { OrderTrackingClient } from "./order-tracking-client";
import { MapPin, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ trackingCode: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { trackingCode } = await params;
  const data = await getPublicOrderTracking(trackingCode);

  if (!data) {
    return {
      title: "Seguimiento de Pedido | NEGOVA",
      description: "Consulta el estado en vivo de tu pedido a domicilio.",
    };
  }

  return {
    title: `Seguimiento Pedido #${data.orderNumber} — ${data.business.name} | NEGOVA`,
    description: `Consulta el estado en tiempo real de tu pedido #${data.orderNumber} en ${data.business.name}.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function PublicOrderTrackingPage({ params }: PageProps) {
  const { trackingCode } = await params;
  const data = await getPublicOrderTracking(trackingCode);

  // Si no se encuentra el código de seguimiento
  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-[#ED500A] mx-auto shadow-xl">
            <MapPin className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white">Seguimiento no encontrado</h1>
            <p className="text-xs text-slate-400 font-mono">
              Código consultado: {trackingCode?.toUpperCase()}
            </p>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            No encontramos ningún pedido activo asociado a este código de seguimiento. Verifica que
            el enlace sea correcto o comunícate con el comercio donde realizaste tu compra.
          </p>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a NEGOVA</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <OrderTrackingClient initialTracking={data} />;
}
