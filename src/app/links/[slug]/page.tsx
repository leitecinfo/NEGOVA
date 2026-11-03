import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Utensils,
  ShoppingBag,
  MessageCircle,
  MapPin,
  Phone,
  Globe,
  Mail,
  Star,
  Link as LinkIcon,
  ExternalLink,
  Share2,
} from "lucide-react";

function Instagram({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

function Facebook({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  );
}
import { getPublicLinksPageBySlug } from "@/lib/links/links-service";
import { BioThemePreset } from "@/lib/links/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const config = await getPublicLinksPageBySlug(slug);

  if (!config) {
    return {
      title: "Página no encontrada | NEGOVA",
    };
  }

  return {
    title: `${config.businessName} | Enlaces Oficiales`,
    description: config.description || `Página oficial de enlaces de ${config.businessName}. Menú digital, domicilios y redes.`,
    openGraph: {
      title: `${config.businessName} — Enlaces Oficiales`,
      description: config.description || `Conoce los enlaces oficiales de ${config.businessName}.`,
      images: config.logoUrl ? [{ url: config.logoUrl }] : [],
    },
  };
}

function renderPublicLinkIcon(iconName: string, className = "w-5 h-5") {
  switch (iconName) {
    case "menu":
    case "utensils":
      return <Utensils className={className} />;
    case "delivery":
    case "shopping-bag":
      return <ShoppingBag className={className} />;
    case "whatsapp":
    case "message-circle":
      return <MessageCircle className={className} />;
    case "instagram":
      return <Instagram className={className} />;
    case "maps":
    case "map-pin":
      return <MapPin className={className} />;
    case "phone":
      return <Phone className={className} />;
    case "globe":
      return <Globe className={className} />;
    case "facebook":
      return <Facebook className={className} />;
    case "mail":
      return <Mail className={className} />;
    case "star":
      return <Star className={className} />;
    default:
      return <LinkIcon className={className} />;
  }
}

function getThemeClasses(theme: BioThemePreset) {
  switch (theme) {
    case "dark":
      return {
        wrapper: "bg-[#090D16] text-white",
        card: "bg-white/[0.08] hover:bg-white/[0.14] text-white border-white/10 hover:border-white/20 shadow-md",
        text: "text-white",
        subtext: "text-slate-400",
        footer: "text-slate-500 hover:text-slate-300",
      };
    case "emerald":
      return {
        wrapper: "bg-[#041D14] text-emerald-50",
        card: "bg-emerald-900/50 hover:bg-emerald-900/80 text-emerald-50 border-emerald-700/40 hover:border-emerald-500/50 shadow-md",
        text: "text-white",
        subtext: "text-emerald-200/80",
        footer: "text-emerald-400/80 hover:text-emerald-200",
      };
    case "indigo":
      return {
        wrapper: "bg-[#090E24] text-indigo-50",
        card: "bg-indigo-900/50 hover:bg-indigo-900/80 text-indigo-50 border-indigo-700/40 hover:border-indigo-500/50 shadow-md",
        text: "text-white",
        subtext: "text-indigo-200/80",
        footer: "text-indigo-400/80 hover:text-indigo-200",
      };
    case "rose":
      return {
        wrapper: "bg-[#1E0810] text-rose-50",
        card: "bg-rose-900/50 hover:bg-rose-900/80 text-rose-50 border-rose-700/40 hover:border-rose-500/50 shadow-md",
        text: "text-white",
        subtext: "text-rose-200/80",
        footer: "text-rose-400/80 hover:text-rose-200",
      };
    case "amber":
      return {
        wrapper: "bg-[#190D04] text-amber-50",
        card: "bg-amber-900/50 hover:bg-amber-900/80 text-amber-50 border-amber-700/40 hover:border-amber-500/50 shadow-md",
        text: "text-white",
        subtext: "text-amber-200/80",
        footer: "text-amber-400/80 hover:text-amber-200",
      };
    case "gradient_sunset":
      return {
        wrapper: "bg-gradient-to-b from-amber-500 via-rose-600 to-purple-950 text-white",
        card: "bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-white/20 hover:border-white/30 shadow-lg",
        text: "text-white",
        subtext: "text-white/90",
        footer: "text-white/70 hover:text-white",
      };
    case "gradient_ocean":
      return {
        wrapper: "bg-gradient-to-b from-cyan-600 via-blue-700 to-slate-950 text-white",
        card: "bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-white/20 hover:border-white/30 shadow-lg",
        text: "text-white",
        subtext: "text-white/90",
        footer: "text-white/70 hover:text-white",
      };
    default: // slate
      return {
        wrapper: "bg-slate-50 text-slate-900",
        card: "bg-white hover:bg-slate-100 text-slate-800 border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow",
        text: "text-slate-900",
        subtext: "text-slate-600",
        footer: "text-slate-500 hover:text-slate-800",
      };
  }
}

export default async function PublicLinksPage({ params }: PageProps) {
  const { slug } = await params;
  const config = await getPublicLinksPageBySlug(slug);

  if (!config) {
    notFound();
  }

  const themeStyle = getThemeClasses(config.theme);
  const activeLinks = config.links;

  return (
    <div
      className={`min-h-screen w-full flex flex-col items-center justify-between p-4 sm:p-8 font-body transition-colors duration-200 ${themeStyle.wrapper}`}
    >
      {/* CONTENEDOR CENTRAL (ANCHO TIPO MÓVIL / LINKTREE) */}
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-start items-center space-y-6 pt-6 sm:pt-10">
        {/* CABECERA: LOGO */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1.5 bg-white/10 backdrop-blur-md shadow-xl flex items-center justify-center overflow-hidden border border-white/20 shrink-0">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.logoUrl}
              alt={config.businessName}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <span className="text-3xl font-black tracking-tight text-white select-none">
              {config.businessName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* NOMBRE Y DESCRIPCIÓN */}
        <div className="text-center space-y-2 px-2">
          <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${themeStyle.text}`}>
            {config.businessName}
          </h1>
          {config.description && (
            <p className={`text-xs sm:text-sm font-normal leading-relaxed max-w-sm mx-auto ${themeStyle.subtext}`}>
              {config.description}
            </p>
          )}
        </div>

        {/* LISTA DE ENLACES (SOLO ACTIVOS) */}
        <div className="w-full space-y-3.5 pt-2">
          {activeLinks.map((link) => {
            const isInternal = link.url.startsWith("/");
            const buttonClass = `group w-full min-h-[52px] px-5 py-3 rounded-2xl flex items-center justify-center relative font-semibold text-xs sm:text-sm border transition-all duration-150 active:scale-[0.98] ${themeStyle.card}`;

            if (isInternal) {
              return (
                <Link key={link.id} href={link.url} className={buttonClass}>
                  <div className="absolute left-4.5 text-current opacity-90 transition-transform group-hover:scale-110">
                    {renderPublicLinkIcon(link.icon, "w-5 h-5")}
                  </div>
                  <span className="text-center truncate px-7">{link.title}</span>
                </Link>
              );
            }

            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass}
              >
                <div className="absolute left-4.5 text-current opacity-90 transition-transform group-hover:scale-110">
                  {renderPublicLinkIcon(link.icon, "w-5 h-5")}
                </div>
                <span className="text-center truncate px-7">{link.title}</span>
                <div className="absolute right-4 text-current opacity-40 group-hover:opacity-80 transition-opacity">
                  <ExternalLink className="w-4 h-4" />
                </div>
              </a>
            );
          })}

          {activeLinks.length === 0 && (
            <div className="p-8 text-center text-xs opacity-70 border border-dashed rounded-2xl">
              Este comercio aún no ha configurado enlaces activos.
            </div>
          )}
        </div>
      </div>

      {/* PIE DE PÁGINA */}
      {config.showPoweredBy && (
        <footer className="pt-8 pb-4 text-center">
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 text-[11px] font-mono tracking-wider transition-colors ${themeStyle.footer}`}
          >
            <span>⚡ Potenciado por</span>
            <strong className="font-bold">NEGOVA</strong>
          </Link>
        </footer>
      )}
    </div>
  );
}
