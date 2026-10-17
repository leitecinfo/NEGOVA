"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { FloatingWrapper } from "@/components/floating/floating-wrapper";
import { BLOG_POSTS, BlogPost } from "@/data/blog-data";
import {
  Clock,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  MessageSquare,
  Zap,
  TrendingUp,
  UserCheck,
  HelpCircle,
  Check,
  CheckCircle2,
  Sparkles,
  Phone,
  Mail
} from "lucide-react";

// Hook de observación de scroll para revelación bidireccional
function useScrollObserver(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px -40px 0px"
      }
    );

    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, []);

  return [ref, isVisible];
}

// Componente para Accordion FAQ local del artículo
function ArticleFaqItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all duration-300">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left font-title font-extrabold text-sm sm:text-base text-[#0B0E14] hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <span>{q}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180 text-[#ED500A]" : ""}`} />
      </button>

      {isOpen && (
        <div className="p-5 pt-0 font-body text-xs sm:text-sm text-slate-500 leading-relaxed border-t border-slate-100 animate-slide-down">
          {a}
        </div>
      )}
    </div>
  );
}

// Estructura del contenido rico para cada artículo del blog
interface RichContent {
  intro: string;
  sections: {
    title: string;
    content: string;
    bullets?: string[];
  }[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  faqs: { q: string; a: string }[];
}

const ARTICLE_CONTENTS: Record<string, RichContent> = {
  "como-llevar-el-inventario-de-una-tienda-pequena": {
    intro: "El control del inventario es el corazón de cualquier comercio. Para una tienda pequeña o minimercado, no saber con exactitud qué mercancía hay en las estanterías o en la bodega equivale a perder dinero en forma de productos vencidos, ventas perdidas por falta de stock, o capital de trabajo atrapado en artículos que no rotan.",
    sections: [
      {
        title: "El costo oculto de no controlar tu stock",
        content: "Muchos tenderos cometen el error de comprar mercancía basándose únicamente en la intuición. Esto provoca dos graves problemas que afectan directamente las finanzas de tu negocio:",
        bullets: [
          "Quiebre de Stock: Dejar de vender un producto de alta demanda (como arroz, leche o refrescos) porque se agotó y no lo notaste a tiempo.",
          "Exceso de Inventario: Tener dinero inmovilizado en productos de muy baja rotación que terminan por vencerse en las estanterías.",
          "Falta de claridad en costos: Comprar a precios más altos a última hora debido a la falta de planificación con tus distribuidores habituales."
        ]
      },
      {
        title: "Método práctico de control de inventario",
        content: "Para comenzar a ordenar tu inventario de forma profesional, te sugerimos establecer una plantilla de control diario. Registra siempre el stock inicial, las unidades vendidas (que deben descontarse de inmediato) y define un nivel mínimo de alerta para cada producto crucial."
      }
    ],
    table: {
      headers: ["Producto", "Categoría", "Costo Unitario", "Precio Venta", "Stock Actual", "Alerta Mínima", "Estado"],
      rows: [
        ["Arroz Premium 1kg", "Abarrotes", "$2.800 COP", "$3.500 COP", "45 und", "10 und", "Estable"],
        ["Aceite de Girasol 1L", "Aceites", "$8.200 COP", "$10.500 COP", "8 und", "12 und", "Reordenar urgente"],
        ["Leche Entera 1L", "Lácteos", "$3.100 COP", "$3.900 COP", "32 und", "15 und", "Estable"],
        ["Café Molido 500g", "Bebidas", "$7.500 COP", "$9.800 COP", "4 und", "8 und", "Bajo stock"],
        ["Jabón Multiusos 1kg", "Aseo", "$4.000 COP", "$5.500 COP", "20 und", "5 und", "Estable"]
      ]
    },
    faqs: [
      {
        q: "¿Con qué frecuencia debo hacer el conteo físico de inventario?",
        a: "Se recomienda hacer un arqueo rápido semanal de los productos con mayor volumen de venta y un inventario general completo de forma mensual para ajustar las posibles diferencias del sistema."
      },
      {
        q: "¿Qué es el inventario de seguridad o alerta mínima?",
        a: "Es la cantidad mínima de un producto que debes tener en bodega para seguir vendiendo mientras llega el pedido del proveedor. Se calcula con base en el promedio de ventas diarias y el tiempo que tarda el distribuidor en entregar."
      },
      {
        q: "¿Cómo ayuda NEGOVA a controlar mi inventario?",
        a: "NEGOVA automatiza todo este flujo. Al registrar una venta desde el computador o celular, las existencias del producto se descuentan inmediatamente en tiempo real y el sistema te notifica cuando llega al límite de reorden."
      }
    ]
  },
  "como-controlar-la-caja-de-un-negocio-sin-perder-dinero": {
    intro: "El descuadre de caja diario es uno de los dolores de cabeza más comunes en los pequeños negocios en Colombia. La pérdida de efectivo, los errores al dar el vuelto y los gastos imprevistos no registrados deterioran el margen de ganancia real sin que el propietario lo note a tiempo.",
    sections: [
      {
        title: "Por qué la caja nunca te cuadra al final del día",
        content: "El principal motivo detrás de una caja descuadrada no es el robo de dinero, sino el desorden operativo. Los errores más recurrentes son:",
        bullets: [
          "Gastos imprevistos de caja menor (pagos a repartidores, almuerzos, compras rápidas) no registrados al instante.",
          "Falta de control del saldo base o base de caja inicial de la mañana.",
          "Mezclar el dinero del negocio con las finanzas y gastos familiares del propietario."
        ]
      },
      {
        title: "Guía rápida para un Arqueo de Caja impecable",
        content: "Para garantizar que el arqueo de caja sea exacto, debes llevar un balance estricto. Registra la base de caja inicial, suma todas las ventas del día (discriminando efectivo de transferencias como Nequi o Daviplata) y resta los egresos soportados con facturas."
      }
    ],
    table: {
      headers: ["Concepto", "Método", "Entrada (+)", "Salida (-)", "Saldo Parcial", "Comentarios"],
      rows: [
        ["Apertura de Caja", "Efectivo", "$150.000 COP", "-", "$150.000 COP", "Base para vueltos inicial"],
        ["Venta Abarrotes", "Efectivo", "$45.000 COP", "-", "$195.000 COP", "Cliente particular"],
        ["Pago a Proveedor", "Efectivo", "-", "$60.000 COP", "$135.000 COP", "Factura Distribuidora Lácteos"],
        ["Venta Lácteos/Bebidas", "Transferencia Nequi", "$85.000 COP", "-", "$220.000 COP", "Pago digital verificado"],
        ["Retiro de caja menor", "Efectivo", "-", "$15.000 COP", "$205.000 COP", "Compra de bolsas de empaque"]
      ]
    },
    faqs: [
      {
        q: "¿Qué cantidad de dinero debo dejar como base de caja?",
        a: "Debe ser una suma fija y moderada que cubra los vueltos de las primeras ventas de la mañana (ej. $100.000 o $150.000 COP). Esta base nunca debe contarse como ganancia del día."
      },
      {
        q: "¿Cómo manejar los pagos digitales en el arqueo de caja?",
        a: "Debes validar cada comprobante de Nequi, Daviplata o PSE en tu celular antes de entregar el producto y registrarlos bajo la categoría de transferencia digital para separarlos del efectivo físico."
      },
      {
        q: "¿De qué forma facilita NEGOVA el cierre de caja?",
        a: "En NEGOVA registras aperturas de caja, ingresos de ventas y egresos de gastos diarios. Al final de la jornada, el sistema calcula automáticamente el total esperado y te ayuda a realizar el cuadre con solo un clic."
      }
    ]
  },
  "como-saber-si-tu-negocio-realmente-esta-ganando-dinero": {
    intro: "Vender mucho no es sinónimo de ganar dinero. Muchos emprendedores se confunden al ver flujo de caja y asumir que todo es utilidad. La realidad es que si no calculas correctamente el costo real de adquisición de tus productos y tus gastos fijos mensuales, podrías estar perdiendo dinero silenciosamente.",
    sections: [
      {
        title: "Confundir flujo de caja con ganancias",
        content: "El flujo de caja es el dinero que entra y sale de tu negocio para pagar proveedores o servicios. La ganancia neta, por otro lado, es lo que queda libre después de restar absolutamente todos tus egresos, incluyendo tu propio sueldo como administrador.",
        bullets: [
          "No asignar un sueldo para ti: Trabajar en tu negocio gratis distorsiona la utilidad real.",
          "Omitir gastos hormiga: Servicios, empaques, transporte o mermas de productos que se asumen como costos menores.",
          "Precios de venta calculados sin un margen de contribución real."
        ]
      },
      {
        title: "Cómo calcular tu Margen de Utilidad Neto",
        content: "Para entender la rentabilidad de cada producto que vendes, debes contrastar su precio de venta final contra todos los costos directos asociados. A continuación te presentamos un ejemplo clásico de cálculo de márgenes."
      }
    ],
    table: {
      headers: ["Categoría Producto", "Precio de Venta", "Costo Adquisición", "Costo Operativo Est.", "Margen de Ganancia", "Porcentaje Utilidad", "Rentabilidad"],
      rows: [
        ["Ropa de Moda (Jean)", "$120.000 COP", "$65.000 COP", "$10.000 COP", "$45.000 COP", "37,5%", "Alta"],
        ["Accesorios de celular", "$25.000 COP", "$8.000 COP", "$2.000 COP", "$15.000 COP", "60,0%", "Muy Alta"],
        ["Bebidas y Refrescos", "$3.500 COP", "$2.400 COP", "$300 COP", "$800 COP", "22,8%", "Baja pero alta rotación"],
        ["Comida Rápida (Combo)", "$22.000 COP", "$10.500 COP", "$4.000 COP", "$7.500 COP", "34,1%", "Media"],
        ["Artículos de aseo", "$12.000 COP", "$9.000 COP", "$800 COP", "$2.200 COP", "18,3%", "Baja"]
      ]
    },
    faqs: [
      {
        q: "¿Cuál es un margen de ganancia saludable para un comercio?",
        a: "Depende del sector. En abarrotes y alimentos suele oscilar entre el 15% y 25% debido a la alta rotación, mientras que en ropa, accesorios y tecnología puede superar el 40% o 50%."
      },
      {
        q: "¿Por qué debo asignarme un salario si soy el dueño del negocio?",
        a: "Porque tu tiempo tiene un costo. Si no te pagas un sueldo y tomas dinero de la caja de forma libre, nunca sabrás si el negocio es rentable por sí mismo o si solo estás autoempleándote con pérdidas."
      },
      {
        q: "¿NEGOVA muestra mis ganancias reales?",
        a: "Sí. NEGOVA calcula automáticamente el margen de contribución de cada venta basándose en el costo de compra cargado en el inventario, dándote un balance neto de ganancias sin necesidad de hojas de cálculo complejas."
      }
    ]
  },
  "como-llevar-el-control-del-fiado-a-clientes-sin-cuadernos": {
    intro: "El fiado es una práctica comercial tradicional en Colombia que fideliza clientes, pero también representa uno de los mayores riesgos para la liquidez de un pequeño negocio. Llevar este control en libretas de papel suele terminar en cobros olvidados, cuentas perdidas y disputas de saldos con tus clientes.",
    sections: [
      {
        title: "El gran peligro de las libretas de papel",
        content: "La informalidad del cuaderno de fiado genera múltiples ineficiencias financieras que pueden ahogar a tu negocio en el mediano plazo:",
        bullets: [
          "Pérdida o daño de la libreta física por accidentes (café, humedad, extravíos).",
          "Dificultad para calcular saldos acumulados de clientes al instante.",
          "Olvido de cobros a clientes que cambian de número o se mudan del barrio."
        ]
      },
      {
        title: "Establecer cupos de crédito y abonos organizados",
        content: "La solución no es prohibir el fiado, sino estructurarlo. Asigna un cupo máximo de crédito a cada cliente, registra la fecha de cada compra y documenta de inmediato cada abono para evitar disputas sobre cuánto se debe."
      }
    ],
    table: {
      headers: ["Cliente", "Cupo Autorizado", "Deuda Pendiente", "Último Abono", "Fecha Último Abono", "Saldo Disponible", "Estado Cuenta"],
      rows: [
        ["Carmen Villalobos", "$150.000 COP", "$85.000 COP", "$30.000 COP", "2026-08-20", "$65.000 COP", "Al día"],
        ["Carlos Restrepo", "$100.000 COP", "$98.000 COP", "$10.000 COP", "2026-08-15", "$2.000 COP", "Límite excedido - Bloqueado"],
        ["Liliana Gómez", "$200.000 COP", "$40.000 COP", "$50.000 COP", "2026-08-22", "$160.000 COP", "Al día"],
        ["Mauricio López", "$80.000 COP", "$75.000 COP", "-", "-", "$5.000 COP", "Llamar a cobro"],
        ["Ángela Patiño", "$120.000 COP", "$0 COP", "$40.000 COP", "2026-08-10", "$120.000 COP", "Sin deuda"]
      ]
    },
    faqs: [
      {
        q: "¿Cómo cobrar el fiado de manera sutil pero efectiva?",
        a: "Establece reglas claras de cobro desde el principio (ej. plazo máximo de 15 días o pago en la quincena). Puedes enviar extractos de deuda claros y detallados para recordar el saldo amigablemente."
      },
      {
        q: "¿Debo suspender el fiado si un cliente se pasa del cupo?",
        a: "Sí. Mantener límites claros es vital para la salud financiera de tu negocio. Si un cliente supera el cupo acordado, debes pausar el fiado amigablemente hasta que realice un abono significativo."
      },
      {
        q: "¿De qué manera gestiona NEGOVA las cuentas de mis clientes?",
        a: "En NEGOVA puedes crear perfiles de clientes, asignarles cupos de crédito, registrar ventas a crédito directo y abonar dinero a sus cuentas en segundos, imprimiendo o enviando un comprobante digital de abono por WhatsApp."
      }
    ]
  },
  "como-organizar-los-pedidos-e-insumos-de-un-restaurante": {
    intro: "En un restaurante o negocio de comida, la cocina es donde se define la ganancia. Si compras demasiados insumos perecederos terminarás desperdiciando comida; si compras muy poco, perderás ventas por platos no disponibles. Encontrar el equilibrio requiere planificación de recetas e insumos.",
    sections: [
      {
        title: "Merma y desperdicios: El enemigo silencioso",
        content: "Los desperdicios no controlados de insumos son el factor número uno de pérdidas en restaurantes. Para mitigarlos, debes enfocarte en tres pilares esenciales:",
        bullets: [
          "Porcionamiento estándar: Utilizar básculas para que cada porción de proteína o guarnición sea idéntica.",
          "Rotación PEPS: Primero en entrar, primero en salir, para evitar que los insumos más viejos se dañen en refrigeración.",
          "Planificación de compras con base en el historial real de ventas del restaurante."
        ]
      },
      {
        title: "Control de materias primas por porción de receta",
        content: "Llevar un control estricto de tus compras y existencias en refrigeradores te permite saber con antelación tus costos por plato y programar reabastecimientos de insumos diarios de forma profesional."
      }
    ],
    table: {
      headers: ["Insumo / Ingrediente", "Categoría", "Presentación", "Costo de Compra", "Existencias", "Stock de Seguridad", "Estado de Abasto"],
      rows: [
        ["Pechuga de Pollo 1kg", "Proteínas", "Bolsa x 5kg", "$38.000 COP", "12 kg", "5 kg", "Suficiente"],
        ["Queso Doble Crema 1kg", "Lácteos", "Bloque x 2kg", "$22.000 COP", "3 kg", "4 kg", "Reordenar hoy"],
        ["Pan para Hamburguesa", "Panadería", "Paquete x 12 und", "$6.500 COP", "8 pqts", "4 pqts", "Suficiente"],
        ["Carne Molida Hamburguesa", "Proteínas", "Caja x 24 und", "$42.000 COP", "2 cjs", "3 cjs", "Bajo stock - Comprar"],
        ["Verdura Variada 1kg", "Legumbres", "Canasta x 10kg", "$18.000 COP", "6 kg", "3 kg", "Suficiente"]
      ]
    },
    faqs: [
      {
        q: "¿Qué es la merma y cómo calcularla?",
        a: "La merma es la pérdida de peso o volumen de un insumo durante el almacenamiento o cocción (ej. la pérdida de agua al asar carne). Debes restarla para calcular el costo real de porción de tu receta."
      },
      {
        q: "¿Con qué frecuencia debo revisar la fecha de vencimiento de mis insumos?",
        a: "De forma diaria. El personal de cocina debe revisar el estado de los refrigeradores y congeladores al iniciar y finalizar la jornada para garantizar la frescura de los ingredientes."
      },
      {
        q: "¿NEGOVA me ayuda a administrar los ingredientes de mis platos?",
        a: "Sí. A través de nuestro módulo gastronómico, NEGOVA te permite asociar insumos e ingredientes a cada receta. Cuando vendes una hamburguesa, el sistema descuenta automáticamente los gramos correspondientes de carne, pan y queso de tu inventario."
      }
    ]
  }
};

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = React.use(params);
  const [loaded, setLoaded] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Refs de scroll reveal para animar la entrada/salida bidireccional
  const [headerRef, headerVisible] = useScrollObserver();
  const [contentRef, contentVisible] = useScrollObserver();
  const [recRef, recVisible] = useScrollObserver();

  const post = BLOG_POSTS.find((p) => p.slug === slug);
  const richContent = post ? ARTICLE_CONTENTS[post.slug] : null;

  // Filtrar artículos recomendados (excluyendo el actual)
  const recommendedPosts = useMemo(() => {
    if (!post) return [];
    return BLOG_POSTS.filter((p) => p.id !== post.id).slice(0, 2);
  }, [post]);

  useEffect(() => {
    setLoaded(true);

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  if (!post || !richContent) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] text-[#0B0E14] flex flex-col justify-between">
        <Navbar />
        <main className="grow flex items-center justify-center p-8 pt-36">
          <div className="text-center space-y-4 max-w-md">
            <BookOpen className="w-16 h-16 text-slate-350 mx-auto" />
            <h2 className="font-title font-black text-2xl text-[#0B0E14]">Artículo no encontrado</h2>
            <p className="font-body text-sm text-slate-500">Lo sentimos, no pudimos encontrar el artículo solicitado en NEGOVA.</p>
            <Link 
              href="/blog" 
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-sm transition-colors cursor-pointer"
            >
              Volver al blog
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Cálculos de scroll real para salida y entrada del Header en Parallax
  const headerTranslateY = Math.min(scrollY * 0.28, 140);
  const headerOpacity = Math.max(1 - scrollY * 0.0022, 0);

  // WhatsApp de consultas rápidas
  const contactGeneralUrl = `https://wa.me/573114245409?text=${encodeURIComponent(
    `Hola NEGOVA, leí su artículo sobre "${post.title}" y me gustaría hablar con un asesor sobre cómo su plataforma ayuda en mi negocio.`
  )}`;

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#0B0E14] selection:bg-[#ED500A]/20 selection:text-[#ED500A] overflow-x-hidden">
      <Navbar />

      {/* ── 1. CABECERA DINÁMICA DEL POST CON PARALLAX Y ANIMACIONES DE CARGA ── */}
      <header 
        ref={headerRef as any}
        className="relative pt-28 pb-16 sm:pt-36 sm:pb-20 bg-white border-b border-slate-200 overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[300px] bg-gradient-to-br from-[#ED500A]/5 via-transparent to-[#3B82F6]/5 rounded-full blur-3xl" />
        </div>

        <div 
          className="relative max-w-4xl mx-auto px-6 text-center space-y-6 transition-all duration-75 ease-out"
          style={{
            transform: `translateY(-${headerTranslateY}px)`,
            opacity: headerOpacity,
            willChange: "transform, opacity",
          }}
        >
          <Link
            href="/blog"
            className={`inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-500 hover:text-[#ED500A] transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              loaded && headerVisible 
                ? "opacity-100 translate-y-0 scale-100 blur-0" 
                : "opacity-0 -translate-y-4 scale-95 blur-[1px]"
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al blog</span>
          </Link>

          <span 
            className={`block font-mono text-xs font-semibold tracking-widest text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20 w-max mx-auto transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              loaded && headerVisible 
                ? "opacity-100 translate-y-0 scale-100 blur-0" 
                : "opacity-0 -translate-y-4 scale-95 blur-[1px]"
            }`}
            style={{ transitionDelay: "150ms" }}
          >
            {post.category}
          </span>

          <h1 
            className={`font-title font-black text-3xl sm:text-5xl text-[#0B0E14] tracking-tight leading-tight transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              loaded && headerVisible 
                ? "opacity-100 translate-y-0 scale-100 blur-0" 
                : "opacity-0 translate-y-4 scale-[0.98] blur-[1px]"
            }`}
            style={{ transitionDelay: "300ms" }}
          >
            {post.title}
          </h1>

          {/* Datos del Autor y Lectura */}
          <div 
            className={`flex items-center justify-center gap-4 text-xs font-mono text-slate-500 pt-2 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              loaded && headerVisible 
                ? "opacity-100 translate-y-0 scale-100" 
                : "opacity-0 translate-y-4 scale-95"
            }`}
            style={{ transitionDelay: "450ms" }}
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#ED500A]/10 text-[#ED500A] font-bold text-[10px] flex items-center justify-center border border-[#ED500A]/20">
                AM
              </span>
              <span className="font-bold text-slate-700">Andrés Mendoza</span>
            </div>
            <span>•</span>
            <span>{post.publishedAt}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{post.readingTime}</span>
            </div>
          </div>

        </div>
      </header>

      {/* ── 2. IMAGEN DESTACADA Y ESTRUCTURA DE 2 COLUMNAS (SPLIT LAYOUT) CON SCROLL REVEAL ── */}
      <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-20 space-y-12">
        
        {/* Banner principal */}
        <div 
          className={`w-full aspect-[21/9] rounded-3xl overflow-hidden border border-slate-200 shadow-sm transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            loaded ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-[0.99]"
          }`}
        >
          <img 
            src={post.image} 
            alt={post.title} 
            className="w-full h-full object-cover" 
          />
        </div>

        {/* Grid de Contenido */}
        <div 
          ref={contentRef as any}
          className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start"
        >
          
          {/* COLUMNA IZQUIERDA: SIDEBAR COMERCIAL STICKY */}
          <aside 
            className={`lg:col-span-4 space-y-6 lg:sticky lg:top-28 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              contentVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            {/* Tarjeta 1: Prueba gratis */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 text-left space-y-4 shadow-xs hover:shadow-sm transition-shadow duration-300">
              <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center">
                <Zap className="w-5 h-5 fill-[#ED500A]/10" />
              </div>
              <h4 className="font-title font-extrabold text-base text-[#0B0E14]">
                ¿Quieres organizar tu negocio?
              </h4>
              <p className="font-body text-xs text-slate-500 leading-relaxed">
                NEGOVA te ayuda a registrar tus ventas, existencias de inventario, caja y deudas de clientes sin complicaciones.
              </p>
              <a
                href="https://wa.me/573114245409"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#0B0E14] hover:bg-[#ED500A] text-white font-title font-bold text-xs transition-colors cursor-pointer"
              >
                <span>Comenzar gratis (30 días)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Tarjeta 2: Planes */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 text-left space-y-4 shadow-xs hover:shadow-sm transition-shadow duration-300">
              <div className="w-10 h-10 rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h4 className="font-title font-extrabold text-base text-[#0B0E14]">
                Planes adaptados a tu ritmo
              </h4>
              <p className="font-body text-xs text-slate-500 leading-relaxed">
                Compara las herramientas de nuestros planes Inicio, Crecimiento y Negocio.
              </p>
              <Link
                href="/planes"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-250 text-slate-700 font-title font-bold text-xs transition-colors cursor-pointer"
              >
                <span>Consultar planes y precios</span>
              </Link>
            </div>
          </aside>

          {/* COLUMNA DERECHA: TEXTO DEL ARTÍCULO, TABLA Y FAQ */}
          <article 
            className={`lg:col-span-8 space-y-10 text-left transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              contentVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
            style={{ transitionDelay: "150ms" }}
          >
            
            {/* Introducción */}
            <p className="font-body text-[#0B0E14] text-base sm:text-lg leading-relaxed font-medium">
              {richContent.intro}
            </p>

            {/* Renderizado de Secciones */}
            <div className="space-y-8">
              {richContent.sections.map((sec, idx) => (
                <div key={idx} className="space-y-4">
                  <h3 className="font-title font-black text-xl sm:text-2xl text-[#0B0E14] tracking-tight border-b border-slate-100 pb-2">
                    {sec.title}
                  </h3>
                  <p className="font-body text-slate-600 text-sm sm:text-base leading-relaxed">
                    {sec.content}
                  </p>
                  
                  {sec.bullets && (
                    <ul className="space-y-2.5 pt-2">
                      {sec.bullets.map((b, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-3 text-slate-600 font-body text-xs sm:text-sm leading-relaxed">
                          <div className="w-5 h-5 rounded-full bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          </div>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/* Tabla de Datos del Artículo */}
            {richContent.table && (
              <div className="space-y-4">
                <h4 className="font-title font-extrabold text-sm text-slate-400 uppercase tracking-widest">
                  EJEMPLO PRÁCTICO DE CÁLCULO
                </h4>
                <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {richContent.table.headers.map((h, hIdx) => (
                          <th key={hIdx} className="p-4 font-title font-bold text-xs sm:text-sm text-slate-600 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {richContent.table.rows.map((row, rIdx) => (
                        <tr 
                          key={rIdx} 
                          className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors last:border-b-0 ${
                            rIdx % 2 === 1 ? "bg-slate-50/30" : ""
                          }`}
                        >
                          {row.map((cell, cIdx) => (
                            <td 
                              key={cIdx} 
                              className={`p-4 font-body text-xs sm:text-sm text-slate-600 whitespace-nowrap ${
                                cIdx === 0 ? "font-bold text-[#0B0E14]" : ""
                              } ${
                                cell.includes("urgente") || cell.includes("excedido") || cell.includes("Comprar")
                                  ? "text-red-500 font-bold"
                                  : cell.includes("Estable") || cell.includes("día") || cell.includes("Suficiente")
                                  ? "text-[#10B981] font-bold"
                                  : ""
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Módulo Especial de Asistente IA (Inline CTA) */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#0B0E14] text-white border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#ED500A]/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold text-[#ED500A] tracking-wider uppercase bg-[#ED500A]/15 px-2.5 py-1 rounded-full border border-[#ED500A]/35">
                    <Sparkles className="w-3 h-3 text-[#ED500A]" />
                    <span>NEGOVA AI</span>
                  </span>
                  <h4 className="font-title font-bold text-base text-white">¿Quieres hacerle consultas a tus datos?</h4>
                  <p className="font-body text-xs text-slate-300 max-w-[45ch]">
                    Prueba nuestro asistente con Inteligencia Artificial para consultar tus arqueos de caja, niveles de stock y ventas del día con lenguaje natural.
                  </p>
                </div>
                <a
                  href={contactGeneralUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-xs transition-colors shrink-0 cursor-pointer shadow-lg shadow-[#ED500A]/20"
                >
                  <MessageSquare className="w-4 h-4 fill-white/10" />
                  <span>Probar ahora</span>
                </a>
              </div>
            </div>

            {/* Acordeones de FAQ locales del artículo */}
            <div className="space-y-6 pt-4">
              <h3 className="font-title font-black text-xl sm:text-2xl text-[#0B0E14] tracking-tight">
                Preguntas frecuentes de este artículo
              </h3>
              <div className="space-y-3">
                {richContent.faqs.map((faq, fIdx) => (
                  <ArticleFaqItem
                    key={fIdx}
                    q={faq.q}
                    a={faq.a}
                    isOpen={activeFaq === fIdx}
                    onToggle={() => setActiveFaq(activeFaq === fIdx ? null : fIdx)}
                  />
                ))}
              </div>
            </div>

          </article>

        </div>

      </main>

      {/* ── 3. SECCIÓN DE RECOMENDADOS CON SCROLL REVEAL Y HOVER ── */}
      {recommendedPosts.length > 0 && (
        <section 
          ref={recRef as any}
          className="py-20 sm:py-24 bg-[#F8F9FD] border-t border-slate-200 overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            
            <div className="text-left mb-12">
              <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
                Sigue leyendo
              </span>
              <h3 className="font-title font-black text-2xl sm:text-4xl text-[#0B0E14] mt-4">
                Artículos recomendados para tu negocio
              </h3>
            </div>

            <div 
              className={`grid grid-cols-1 md:grid-cols-2 gap-8 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                recVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-[0.98]"
              }`}
            >
              {recommendedPosts.map((recPost: BlogPost, recIdx: number) => (
                <Link
                  key={recPost.id}
                  href={recPost.href}
                  className="group block p-1.5 rounded-3xl bg-white border border-slate-200 hover:border-[#ED500A]/40 transition-all duration-300 hover:-translate-y-1 shadow-xs"
                >
                  <div className="p-5 sm:p-6 space-y-4 text-left">
                    <div className="relative w-full aspect-[21/9] rounded-2xl overflow-hidden bg-[#ED500A] border border-slate-100">
                      <img 
                        src={recPost.image} 
                        alt={recPost.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20 uppercase">
                        {recPost.category}
                      </span>
                      <span className="font-mono text-xs text-slate-500">{recPost.readingTime}</span>
                    </div>

                    <h4 className="font-title font-bold text-base sm:text-lg text-[#0B0E14] group-hover:text-[#ED500A] transition-colors leading-snug">
                      {recPost.title}
                    </h4>

                    <p className="font-body text-xs sm:text-sm text-slate-600 line-clamp-2">
                      {recPost.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

          </div>
        </section>
      )}

      {/* CTA Final */}
      <section className="relative py-20 sm:py-24 bg-[#0B0E14] text-white text-center border-t border-slate-900">
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-br from-[#ED500A]/20 to-transparent rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 space-y-6">
          <h3 className="font-title font-black text-3xl sm:text-5xl">
            Lleva el control total de tu negocio
          </h3>
          <p className="font-body text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Descubre por qué cientos de tiendas, cafeterías y pequeños comercios en Colombia gestionan sus ventas, caja e inventario con NEGOVA.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/planes"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-sm cursor-pointer shadow-lg shadow-[#ED500A]/20"
            >
              <span>Ver planes de precios</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://wa.me/573114245409"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full bg-[#25D366] hover:bg-[#22C55E] text-white font-title font-bold text-sm cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 fill-white/10" />
              <span>Chatear con un asesor</span>
            </a>
          </div>
        </div>
      </section>

      <FloatingWrapper />
      <Footer />
    </div>
  );
}
