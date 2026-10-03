export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  readingTime: string;
  publishedAt: string;
  featured: boolean;
  href: string;
}

export const BLOG_CATEGORIES = [
  "Todos",
  "Inventario",
  "Caja y Dinero",
  "Gestión y Ventas",
  "Clientes y Fiado",
  "Restaurantes",
  "Comercios",
  "Consejos",
];

export const BLOG_POSTS: BlogPost[] = [
  {
    id: "inventario-tienda-pequena",
    slug: "como-llevar-el-inventario-de-una-tienda-pequena",
    title: "¿Cómo llevar el inventario de una tienda pequeña?",
    excerpt:
      "Aprende una forma sencilla y práctica de saber qué productos tienes en stock, qué se está vendiendo más rápido y cuándo necesitas reponer mercancía sin perder dinero.",
    category: "INVENTARIO",
    image: "/images/blog-inventario-tienda.jpg",
    readingTime: "5 min de lectura",
    publishedAt: "2026-08-20",
    featured: true,
    href: "/blog/como-llevar-el-inventario-de-una-tienda-pequena",
  },
  {
    id: "control-caja-diario",
    slug: "como-controlar-la-caja-de-un-negocio-sin-perder-dinero",
    title: "¿Cómo llevar el control de caja sin perder dinero?",
    excerpt:
      "Descubre cómo realizar arqueos de caja diarios en tu negocio, evitar desfasamientos de efectivo y llevar un registro claro de los ingresos y salidas cotidianas.",
    category: "CAJA Y DINERO",
    image: "/images/blog-control-caja.jpg",
    readingTime: "4 min de lectura",
    publishedAt: "2026-08-18",
    featured: false,
    href: "/blog/como-controlar-la-caja-de-un-negocio-sin-perder-dinero",
  },
  {
    id: "saber-si-negocio-gana-dinero",
    slug: "como-saber-si-tu-negocio-realmente-esta-ganando-dinero",
    title: "¿Cómo saber si tu negocio realmente está ganando dinero?",
    excerpt:
      "Entiende la diferencia real entre vender mucho y tener ganancias netas. Claves simples para evaluar la rentabilidad de tu pequeño comercio mes a mes.",
    category: "GESTIÓN Y VENTAS",
    image: "/images/blog-ganancias-negocio.jpg",
    readingTime: "6 min de lectura",
    publishedAt: "2026-08-15",
    featured: false,
    href: "/blog/como-saber-si-tu-negocio-realmente-esta-ganando-dinero",
  },
  {
    id: "control-fiado-cuentas-cobrar",
    slug: "como-llevar-el-control-del-fiado-a-clientes-sin-cuadernos",
    title: "¿Cómo llevar el control del fiado sin usar libretas?",
    excerpt:
      "Aprende a registrar créditos de clientes, controlar saldos pendientes y llevar el historial de abonos de forma clara sin depender de libretas de papel.",
    category: "CLIENTES Y FIADO",
    image: "/images/blog-fiado-clientes.jpg",
    readingTime: "5 min de lectura",
    publishedAt: "2026-08-12",
    featured: false,
    href: "/blog/como-llevar-el-control-del-fiado-a-clientes-sin-cuadernos",
  },
  {
    id: "organizacion-insumos-restaurante",
    slug: "como-organizar-los-pedidos-e-insumos-de-un-restaurante",
    title: "¿Cómo organizar los insumos de un restaurante pequeño?",
    excerpt:
      "Evita desperdicios de cocina y descontrol de compras. Claves para calcular ingredientes por receta y llevar la cuenta de comandas sin desorden.",
    category: "RESTAURANTES",
    image: "/images/blog-insumos-restaurante.jpg",
    readingTime: "5 min de lectura",
    publishedAt: "2026-08-10",
    featured: false,
    href: "/blog/como-organizar-los-pedidos-e-insumos-de-un-restaurante",
  },
];
