import type { Metadata } from "next";
import { BLOG_POSTS } from "@/data/blog-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  return {
    title: post ? post.title : "Artículo de Blog",
    description: post ? post.excerpt : "Lee consejos prácticos para tu negocio en el blog de NEGOVA.",
  };
}

export default function BlogArticleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
