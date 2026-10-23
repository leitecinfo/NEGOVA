import type { Metadata } from "next";
import { Hanken_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { FloatingWrapper } from "@/components/floating/floating-wrapper";
import { GlobalScrollbar } from "@/components/layout/global-scrollbar";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NEGOVA — Plataforma SaaS Multi-Tenant",
    template: "%s | NEGOVA",
  },
  description: "Sistema de gestión integral para negocios",
  icons: {
    icon: "/isotipo.png",
    shortcut: "/isotipo.png",
    apple: "/isotipo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${hankenGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased min-h-screen bg-background text-foreground">
        {children}
        <FloatingWrapper />
        <GlobalScrollbar />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
