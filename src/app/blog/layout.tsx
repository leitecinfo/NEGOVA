import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
  description: "Artículos, guías y consejos para potenciar y digitalizar tu negocio.",
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
