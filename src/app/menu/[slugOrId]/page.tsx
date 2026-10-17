import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicDigitalMenu } from "@/lib/menu/menu-service";
import { TemplateRenderer } from "@/components/menu/template-renderer";
import {
  UtensilsCrossed,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface PageProps {
  params: Promise<{ slugOrId: string }>;
  searchParams?: Promise<{
    preview?: string;
    template?: string;
    modality?: string;
    layout?: string;
    primary?: string;
    sec?: string;
    accent?: string;
    photos?: string;
    desc?: string;
    prices?: string;
    contact?: string;
    address?: string;
    title?: string;
    subtitle?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slugOrId } = await params;
  const data = await getPublicDigitalMenu(slugOrId);

  if (!data) {
    return {
      title: "Menú no encontrado | NEGOVA",
      description: "El menú digital solicitado no se encuentra disponible.",
    };
  }

  const { business } = data;
  return {
    title: `${business.name} — Menú Digital Oficial`,
    description: `Consulta el menú digital actualizado, carta de productos y precios de ${business.name}.`,
    openGraph: {
      title: `${business.name} — Menú Digital`,
      description: `Consulta el menú digital y haz tu pedido en ${business.name}.`,
      images: business.logo_url ? [{ url: business.logo_url }] : [],
    },
  };
}

export default async function PublicMenuPage({ params, searchParams }: PageProps) {
  const { slugOrId } = await params;
  const sp = searchParams ? await searchParams : {};
  const isPreviewMode = sp.preview === "true";

  const data = await getPublicDigitalMenu(slugOrId);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-4 shadow-xl">
          <UtensilsCrossed className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-white">Menú no encontrado</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">
          El enlace del menú ingresado no corresponde a ningún negocio activo o fue modificado.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="px-5 py-2.5 rounded-xl bg-[#ED500A] text-white text-xs font-bold hover:bg-[#d44304] transition-colors"
          >
            Ir a NEGOVA
          </a>
        </div>
      </div>
    );
  }

  const { business, menu, categories, products } = data;

  // Si el menú existe pero está despublicado por el dueño (y NO es modo vista previa de edición)
  if (!menu.is_published && !isPreviewMode) {
    const cleanWhatsapp = (business.whatsapp || business.phone || "").replace(/[^0-9]/g, "");
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl space-y-5">
          {business.logo_url ? (
            <img
              src={business.logo_url}
              alt={business.name}
              className="w-20 h-20 rounded-2xl mx-auto object-cover border border-white/10 shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
          )}

          <div>
            <h1 className="text-2xl font-black text-white">{business.name}</h1>
            <p className="text-xs uppercase tracking-widest text-amber-400 font-bold mt-1">
              Menú en Mantenimiento
            </p>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Nuestro menú digital se encuentra temporalmente en actualización. Puedes contactarnos directamente para consultar la carta y hacer tus pedidos.
          </p>

          <div className="pt-2 flex flex-col gap-2">
            {cleanWhatsapp && (
              <a
                href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(`Hola, quisiera consultar la carta disponible en ${business.name}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-white text-xs font-bold shadow-lg hover:opacity-95 transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>Contactar por WhatsApp</span>
              </a>
            )}

            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>Llamar al {business.phone}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Overrides para previsualización exacta en vivo
  const overrideTemplateId = sp.template || menu.template_id;
  const overrideModality = (sp.modality as any) || menu.modality;
  const overrideSettings = {
    ...menu.custom_settings,
    ...(sp.template ? { templateId: sp.template } : {}),
    ...(sp.layout ? { layoutStyle: sp.layout as any } : {}),
    ...(sp.primary ? { primaryColor: sp.primary } : {}),
    ...(sp.sec ? { secondaryColor: sp.sec } : {}),
    ...(sp.accent ? { accentColor: sp.accent } : {}),
    ...(sp.photos !== undefined ? { showPhotos: sp.photos === "true" } : {}),
    ...(sp.desc !== undefined ? { showDescriptions: sp.desc === "true" } : {}),
    ...(sp.prices !== undefined ? { showPrices: sp.prices === "true" } : {}),
    ...(sp.contact !== undefined ? { showContactInfo: sp.contact === "true" } : {}),
    ...(sp.address !== undefined ? { showAddress: sp.address === "true" } : {}),
    ...(sp.title !== undefined ? { bannerTitle: sp.title } : {}),
    ...(sp.subtitle !== undefined ? { bannerSubtitle: sp.subtitle } : {}),
  };

  // Menú publicado o vista previa activa
  return (
    <TemplateRenderer
      business={business}
      menu={menu}
      categories={categories}
      products={products}
      isPreview={false}
      overrideModality={overrideModality}
      overrideTemplateId={overrideTemplateId as any}
      overrideSettings={overrideSettings}
    />
  );
}
