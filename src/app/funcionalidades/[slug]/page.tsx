"use client";

import React, { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { FloatingWrapper } from "@/components/floating/floating-wrapper";
import { PricingSection } from "@/components/landing/pricing-section";
import { TrustSection } from "@/components/landing/trust-section";
import { FaqLandingSection } from "@/components/landing/faq-landing-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";

// Datos de las 6 funcionalidades con sus respectivos módulos y sub-características de scroll
const FEATURE_DATA: Record<
  string,
  {
    title: string;
    eyebrow: string;
    description: string;
    mainHighlight: string;
    whatsappText: string;
    showcase: {
      id: string;
      number: string;
      title: string;
      description: string;
      image: string;
      bullets: string[];
    }[];
  }
> = {
  inventario: {
    title: "Control de Inventarios",
    eyebrow: "NEGOVA · INVENTARIO",
    description: "Gestiona existencias en tiempo real, organiza tus productos por categorías y recibe alertas automáticas cuando te quedes con pocas unidades.",
    mainHighlight: "Controla tu stock al detalle sin hojas de cálculo complejas",
    whatsappText: "Hola NEGOVA, quiero conocer más sobre el módulo de Control de Inventarios y la prueba gratuita de 30 días.",
    showcase: [
      {
        id: "stock-alertas",
        number: "1",
        title: "Alertas de Stock Mínimo y Crítico",
        description: "Recibe avisos automáticos cuando un artículo esté por agotarse. De esta forma, puedes planificar tus compras con proveedores a tiempo y nunca perder una venta por falta de stock.",
        image: "/images/blog-inventario-tienda.jpg",
        bullets: [
          "Configuración personalizada de mínimos por producto.",
          "Listado instantáneo de productos por reabastecer.",
          "Notificaciones visuales directamente en tu panel principal."
        ]
      },
      {
        id: "carga-codigos",
        number: "2",
        title: "Escaneo de Código de Barras y Variantes",
        description: "Añade nuevos productos escaneando sus códigos con la cámara del celular o un lector. Organízalos con diferentes variantes (tallas, sabores, colores) y sus respectivos precios.",
        image: "/mockup-hero-clean.png",
        bullets: [
          "Carga de productos por escaneo de códigos de barra.",
          "Estructura inteligente de variantes de producto.",
          "Definición de precios de costo y ganancia neta estimada."
        ]
      },
      {
        id: "movimientos-stock",
        number: "3",
        title: "Registro de Entradas, Salidas y Mermas",
        description: "Lleva un historial riguroso de cada movimiento físico. Registra compras a proveedores, devoluciones o pérdidas por mermas, asegurando la exactitud de tu inventario diario.",
        image: "/images/blog-control-caja.jpg",
        bullets: [
          "Historial completo de entradas y salidas de mercancía.",
          "Clasificación de egresos de stock por merma o avería.",
          "Sincronización automática con el Punto de Venta (POS)."
        ]
      },
      {
        id: "valorizacion-existencias",
        number: "4",
        title: "Valorización de tus Existencias en Dinero",
        description: "Conoce al instante el valor monetario de toda la mercancía guardada en tu local comercial. Visualiza tu inversión actual y el dinero potencial que recibirás al venderla.",
        image: "/images/blog-ganancias-negocio.jpg",
        bullets: [
          "Cálculo automatizado del valor total de tu inventario.",
          "Visión clara del capital invertido y ganancia neta estimada.",
          "Reporte de rotación para identificar productos estrella."
        ]
      }
    ]
  },
  "ventas-pos": {
    title: "Punto de Venta POS",
    eyebrow: "NEGOVA · VENTAS & POS",
    description: "Registra ventas de forma rápida e intuitiva, calcula vueltos automáticamente, y monitorea tus ingresos desde cualquier dispositivo.",
    mainHighlight: "Atiende y factura en segundos con un POS ágil e intuitivo",
    whatsappText: "Hola NEGOVA, quiero conocer más sobre el Punto de Venta POS y el registro de ventas.",
    showcase: [
      {
        id: "facturacion-rapida",
        number: "1",
        title: "Facturación Ágil en Tres Clics",
        description: "Cobrar a tus clientes es más rápido que nunca. Selecciona los artículos tocando la pantalla o escaneando su código de barras, agrégalos al carrito y confirma el pago en segundos.",
        image: "/mockup-hero-clean.png",
        bullets: [
          "Punto de venta visual adaptado a computadores, tablets y celulares.",
          "Descuento automático de existencias en el inventario al vender.",
          "Buscador predictivo por nombre, categoría o código."
        ]
      },
      {
        id: "medios-pago",
        number: "2",
        title: "Múltiples Medios de Pago y Vueltos",
        description: "Registra cobros en efectivo, tarjetas de débito/crédito, o billeteras digitales (Nequi, Daviplata, etc.). El sistema calcula automáticamente el cambio para evitar descuadres de caja.",
        image: "/images/blog-control-caja.jpg",
        bullets: [
          "Cálculo automático de vueltos y cambio preciso.",
          "Seguimiento y control de pagos recibidos por transferencia.",
          "Permite registrar pagos parciales y métodos mixtos."
        ]
      },
      {
        id: "comprobantes-digitales",
        number: "3",
        title: "Recibos Digitales directos a WhatsApp",
        description: "Elimina el gasto de papel enviando los comprobantes de venta directamente al WhatsApp o correo electrónico de tus clientes, o imprímelos con tu ticketera térmica USB o Bluetooth.",
        image: "/hero-devices.jpg",
        bullets: [
          "Envío instantáneo de enlaces de recibo por WhatsApp.",
          "Compatible con impresoras térmicas POS estándar.",
          "Diseño limpio con el nombre, contacto y logo de tu negocio."
        ]
      },
      {
        id: "diario-ventas",
        number: "4",
        title: "Historial de Ventas y Turnos en Vivo",
        description: "Monitorea en tiempo real todas las transacciones cobradas a lo largo de la jornada. Controla el desempeño de tus colaboradores por turno y anula facturas con permisos de seguridad.",
        image: "/images/blog-ganancias-negocio.jpg",
        bullets: [
          "Resumen de ventas del día actualizable al instante.",
          "Anulación controlada de ventas por errores de facturación.",
          "Filtro por cajero para control de personal."
        ]
      }
    ]
  },
  reportes: {
    title: "Reportes y Estadísticas",
    eyebrow: "NEGOVA · REPORTES",
    description: "Visualiza tus ingresos reales, ganancias netas, y productos más vendidos en gráficos simples que te ayudan a tomar decisiones inteligentes.",
    mainHighlight: "Entiende el rendimiento real de tu negocio con datos claros",
    whatsappText: "Hola NEGOVA, quiero conocer más sobre los Reportes y Estadísticas financieras.",
    showcase: [
      {
        id: "ganancia-real",
        number: "1",
        title: "Ganancia Neta Calculada al Instante",
        description: "Conoce el beneficio neto real de tu negocio descontando automáticamente el costo de adquisición de tus productos. Ya no necesitas calcular márgenes a mano.",
        image: "/images/blog-ganancias-negocio.jpg",
        bullets: [
          "Cálculo automatizado de la ganancia neta diaria.",
          "Comparación directa entre ingresos brutos y costo de mercancía.",
          "Reporte de rentabilidad global para balance mensual."
        ]
      },
      {
        id: "top-productos",
        number: "2",
        title: "Ranking de Productos Más Vendidos",
        description: "Identifica qué productos son los más populares de tu comercio y cuáles tienen baja rotación, lo que te permite optimizar tu presupuesto de compras.",
        image: "/mockup-hero-clean.png",
        bullets: [
          "Listado automático de los artículos de mayor volumen de venta.",
          "Visualización por rentabilidad por cada línea de producto.",
          "Filtros de popularidad por días o semanas."
        ]
      },
      {
        id: "historial-estadisticas",
        number: "3",
        title: "Historial y Comparativas Mensuales",
        description: "Compara tus resultados financieros actuales con los de meses pasados para analizar el crecimiento de tu comercio e identificar las mejores temporadas de venta.",
        image: "/hero-devices.jpg",
        bullets: [
          "Filtros avanzados por rango de fechas (hoy, semana, mes, año).",
          "Exportación fácil de estadísticas a archivos Excel.",
          "Gráficos interactivos adaptados para móvil y computador."
        ]
      },
      {
        id: "metricas-clave",
        number: "4",
        title: "Ticket Promedio y Número de Clientes",
        description: "Monitorea métricas esenciales como el ticket promedio de compra por cliente y el volumen total de transacciones completadas para medir la efectividad de tu negocio.",
        image: "/images/blog-control-caja.jpg",
        bullets: [
          "Cálculo del ticket de compra promedio.",
          "Contador de transacciones procesadas por jornada.",
          "Dashboard simple con indicadores financieros listos para ver."
        ]
      }
    ]
  },
  catalogo: {
    title: "Catálogo de Productos",
    eyebrow: "NEGOVA · CATÁLOGO",
    description: "Organiza tus productos con imágenes, precios de compra y venta, variantes personalizadas y categorías claras.",
    mainHighlight: "Registra y categoriza tus artículos de forma profesional",
    whatsappText: "Hola NEGOVA, quiero conocer más sobre el Catálogo de Productos y variantes.",
    showcase: [
      {
        id: "organizacion-visual",
        number: "1",
        title: "Categorías e Imágenes de Producto",
        description: "Clasifica tus productos de forma ordenada (bebidas, abarrotes, lácteos, etc.) e integra fotografías para agilizar la identificación de artículos en tu punto de venta.",
        image: "/images/blog-inventario-tienda.jpg",
        bullets: [
          "Estructura ilimitada de categorías y subcategorías.",
          "Identificación visual rápida en la pantalla de cobro del POS.",
          "Buscador predictivo para agilizar la facturación."
        ]
      },
      {
        id: "variantes-atributos",
        number: "2",
        title: "Variantes de Producto y Atributos",
        description: "Registra variantes de un mismo artículo con diferentes precios o stock de forma simple, ideal para controlar tamaños, sabores, colores o marcas del mismo producto.",
        image: "/mockup-hero-clean.png",
        bullets: [
          "Variaciones de tamaño (ej. Coca-Cola 350ml, 1L, 2L).",
          "Control de existencias independiente por cada variante.",
          "Asignación de precios de costo y venta específicos."
        ]
      },
      {
        id: "codigos-rotulado",
        number: "3",
        title: "Códigos de Barra y Rotulado Integrado",
        description: "Escanea y asocia los códigos de barras de fábrica de tus productos, o genera automáticamente nuevos códigos para rotular tus productos a granel o artesanales.",
        image: "/hero-devices.jpg",
        bullets: [
          "Compatible con códigos de barra estándar (EAN, UPC, etc.).",
          "Generación automática de códigos internos NEGOVA.",
          "Listo para impresión y etiquetado físico."
        ]
      },
      {
        id: "precios-masivos",
        number: "4",
        title: "Actualización Masiva de Precios",
        description: "Ajusta de manera rápida los precios de costo o venta de múltiples productos por porcentaje o valor fijo en momentos de inflación o cambios de tarifas de proveedores.",
        image: "/images/blog-ganancias-negocio.jpg",
        bullets: [
          "Actualizaciones rápidas por categoría o proveedor.",
          "Ajustes globales de porcentaje de ganancia.",
          "Sincronización en tiempo real con todas las terminales POS."
        ]
      }
    ]
  },
  "clientes-fiados": {
    title: "Clientes y Fiados",
    eyebrow: "NEGOVA · CLIENTES Y FIADOS",
    description: "Registra las cuentas por cobrar de tus clientes frecuentes (fiado), lleva el historial de abonos y deudas sin necesidad de libretas de papel.",
    mainHighlight: "Lleva las cuentas claras del fiado digital y protege tus finanzas",
    whatsappText: "Hola NEGOVA, quiero conocer más sobre el Control de Fiados y Gestión de Clientes.",
    showcase: [
      {
        id: "fiado-pos",
        number: "1",
        title: "Cobro Fiado Directo desde el POS",
        description: "Asocia una venta como 'cuenta por cobrar' vinculándola con el perfil de un cliente registrado. La deuda acumulada se actualiza en su ficha de manera automática.",
        image: "/images/blog-control-caja.jpg",
        bullets: [
          "Vinculación de deudas en segundos al momento de cobrar.",
          "Cálculo automático de saldos deudores actualizados.",
          "Historial detallado de productos fiados."
        ]
      },
      {
        id: "control-abonos",
        number: "2",
        title: "Registro Histórico de Abonos",
        description: "Registra abonos parciales o totales de deudas en efectivo o transferencias. El sistema descuenta el saldo pendiente y emite un comprobante digital de pago.",
        image: "/images/blog-control-caja.jpg",
        bullets: [
          "Registro detallado de fecha, hora y medio de pago del abono.",
          "Actualización inmediata del saldo restante del cliente.",
          "Recibo de abono para compartir por WhatsApp."
        ]
      },
      {
        id: "ficha-clientes",
        number: "3",
        title: "Directorio y Ficha Técnica de Clientes",
        description: "Consulta los datos de contacto, saldo deudor total, historial de compras, abonos del mes y notas especiales de comportamiento de cada cliente registrado.",
        image: "/mockup-hero-clean.png",
        bullets: [
          "Directorio de clientes centralizado y de búsqueda rápida.",
          "Límites máximos de crédito configurables por cliente.",
          "Historial de comportamiento de pagos e ingresos."
        ]
      },
      {
        id: "resumen-cartera",
        number: "4",
        title: "Estado Global de Cuentas por Cobrar",
        description: "Visualiza en una sola pantalla cuánto dinero total tiene tu negocio en la calle en concepto de fiados. Mantén la cartera bajo control y evita deudas olvidadas.",
        image: "/images/blog-ganancias-negocio.jpg",
        bullets: [
          "Total de saldos por cobrar consolidados a la vista.",
          "Identificación rápida de clientes con deudas pendientes antiguas.",
          "Exportación del listado general de cartera a Excel."
        ]
      }
    ]
  },
  "arqueo-caja": {
    title: "Arqueo y Control de Caja",
    eyebrow: "NEGOVA · CONTROL DE CAJA",
    description: "Registra entradas y salidas de efectivo, realiza aperturas y cierres de caja en cada turno para erradicar los descuadres cotidianos.",
    mainHighlight: "Controla cada peso que entra y sale de tu caja física",
    whatsappText: "Hola NEGOVA, quiero conocer más sobre el Arqueo y Control Diario de Caja.",
    showcase: [
      {
        id: "apertura-base",
        number: "1",
        title: "Apertura de Caja y Base de Efectivo",
        description: "Inicia el día de labores o el turno de tus cajeros registrando el monto inicial de efectivo disponible para dar cambio (base de caja), asegurando la transparencia.",
        image: "/images/blog-control-caja.jpg",
        bullets: [
          "Registro preciso del dinero base inicial.",
          "Asociación del turno al nombre del cajero.",
          "Registro automático de la hora exacta de apertura."
        ]
      },
      {
        id: "gastos-egresos",
        number: "2",
        title: "Registro de Gastos y Salidas Rápidas",
        description: "Monitorea cualquier salida de efectivo para gastos menores de tu local, pago a transportistas o abonos rápidos a proveedores, restándolos automáticamente del efectivo esperado.",
        image: "/images/blog-control-caja.jpg",
        bullets: [
          "Clasificación de egresos de dinero (servicios, proveedores, varios).",
          "Restado inmediato del arqueo total al finalizar el día.",
          "Historial con el concepto y persona que retiró el dinero."
        ]
      },
      {
        id: "arqueo-cierre",
        number: "3",
        title: "Arqueo y Cierre del Turno",
        description: "Al finalizar el día o el turno, realiza el cuadre comparando el efectivo real físico con el monto esperado calculado por el sistema mediante ventas y egresos registrados.",
        image: "/mockup-hero-clean.png",
        bullets: [
          "Reporte visual del efectivo esperado vs. dinero real físico.",
          "Registro y justificación de sobrantes y faltantes de caja.",
          "Envío automático del reporte de cierre de caja por WhatsApp."
        ]
      },
      {
        id: "historial-arqueos",
        number: "4",
        title: "Historial y Reporte de Caja en la Nube",
        description: "Accede al historial de todos los cierres y arqueos de caja anteriores. Audita turnos pasados de manera simple para detectar pérdidas o descuadres recurrentes.",
        image: "/images/blog-ganancias-negocio.jpg",
        bullets: [
          "Archivo completo de cierres de caja históricos ordenados.",
          "Filtros de búsqueda por cajero, fecha y turno.",
          "Respaldo automático seguro en la nube."
        ]
      }
    ]
  }
};

export default function FeatureSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const data = FEATURE_DATA[slug];

  if (!data) {
    notFound();
  }

  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Observer para cambiar la imagen flotante sticky en el scroll de la página
  useEffect(() => {
    const handleScroll = () => {
      const viewportCenter = window.innerHeight / 2;
      let closestIdx = 0;
      let closestDist = Infinity;

      itemRefs.current.forEach((el, index) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const dist = Math.abs(elementCenter - viewportCenter);

        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = index;
        }
      });

      setActiveIndex(closestIdx);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [data.showcase.length]);

  const whatsappUrl = `https://wa.me/573114245409?text=${encodeURIComponent(data.whatsappText)}`;

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#0B0E14] selection:bg-[#ED500A]/20 selection:text-[#ED500A]">
      <Navbar />

      {/* ── 1. HERO CON IMAGEN COMPLETA DE DISPOSITIVOS COMO FONDO ── */}
      <section className="relative pt-32 pb-24 sm:pt-40 sm:pb-32 bg-[#0B0E14] text-white overflow-hidden border-b border-white/10 flex items-center justify-center min-h-[550px] sm:min-h-[620px]">
        {/* Imagen de fondo con opacidad controlada para legibilidad del texto */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-devices.jpg"
            alt="Dispositivos NEGOVA POS"
            fill
            className="object-cover object-center opacity-30 select-none pointer-events-none"
            priority
          />
          {/* Overlay de degradado oscuro */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/75 to-[#0B0E14]/85" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          
          {/* Eyebrow de Marca */}
          <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-widest text-[#ED500A] uppercase px-4 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/30">
            <span className="w-2 h-2 rounded-full bg-[#ED500A] animate-pulse" />
            <span>{data.eyebrow}</span>
          </div>

          {/* Titular Principal */}
          <h1 className="font-title font-black text-4xl sm:text-6xl text-white leading-[1.08] tracking-tight max-w-4xl mx-auto">
            {data.title} en{" "}
            <span className="text-[#ED500A] italic">
              un solo lugar.
            </span>
          </h1>

          {/* Subtítulo explicativo */}
          <p className="font-body text-base sm:text-xl text-slate-300 leading-relaxed max-w-[55ch] mx-auto">
            {data.description}
          </p>

          {/* Botones de Acción Principal y WhatsApp */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/#precios"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-base shadow-xl shadow-[#ED500A]/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer group"
            >
              <span>Probar 30 días gratis</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-title font-bold text-base shadow-lg shadow-[#25D366]/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
            >
              <img src="/icons8-whatsapp.svg" alt="WhatsApp" className="w-5 h-5 shrink-0" />
              <span>Contáctanos por WhatsApp</span>
            </a>
          </div>

        </div>
      </section>

      {/* ── 2. SECCIÓN PRINCIPAL: MOCKUP STICKY DE MÓDULOS AL DETALLE EN SCROLL ── */}
      <section className="relative py-20 sm:py-32 bg-[#F8F9FD] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Cabecera de la sección */}
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
              FUNCIONAMIENTO AL DETALLE
            </span>
            <h2 className="font-title font-extrabold text-3xl sm:text-5xl text-[#0B0E14] mt-4 mb-4 tracking-tight">
              {data.mainHighlight}
            </h2>
            <p className="font-body text-base sm:text-lg text-slate-600">
              Desplázate hacia abajo para ver cómo funciona cada módulo de este panel y cómo se adapta a tu día a día.
            </p>
          </div>

          {/* Grid Layout: Izquierda Sticky (Imagen Flotante) + Derecha Scroll (Módulos 1 a 4) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start mt-8 sm:mt-12">
            
            {/* Columna Izquierda: Imagen Sticky flotante */}
            <div className="lg:col-span-6 lg:sticky lg:top-36 z-20 flex items-center justify-center pt-2">
              <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] hover:shadow-[0_30px_75px_-15px_rgba(0,0,0,0.28)] transition-all duration-500 border border-slate-200 bg-white animate-float-perpetual">
                <div className="relative aspect-[16/10] w-full">
                  <Image
                    src={data.showcase[activeIndex]?.image || "/mockup-hero-clean.png"}
                    alt={data.showcase[activeIndex]?.title || data.title}
                    fill
                    className="object-cover transition-opacity duration-500"
                  />
                </div>
              </div>
            </div>

            {/* Columna Derecha: Contenido con scroll */}
            <div className="lg:col-span-6 space-y-10 sm:space-y-14">
              {data.showcase.map((item, index) => {
                const isActive = activeIndex === index;

                return (
                  <div
                    key={item.id}
                    id={item.id}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    className={`scroll-mt-36 pb-10 sm:pb-14 transition-opacity duration-300 ${
                      index < data.showcase.length - 1 ? "border-b border-slate-200/80" : ""
                    } ${isActive ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
                  >
                    {/* Badge con Número */}
                    <div className="flex items-center gap-3 mb-4">
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-title font-extrabold text-sm transition-colors ${
                          isActive
                            ? "bg-[#ED500A] text-white shadow-md shadow-[#ED500A]/30"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.number}
                      </span>
                      <div className="h-0.5 w-12 bg-[#ED500A]/30" />
                    </div>

                    {/* Título del Sub-módulo */}
                    <h3 className="font-title font-extrabold text-2xl sm:text-3xl text-[#0B0E14] mb-3 leading-tight">
                      {item.title}
                    </h3>

                    {/* Descripción */}
                    <p className="font-body text-sm sm:text-base text-slate-600 leading-relaxed mb-5">
                      {item.description}
                    </p>

                    {/* Bullets clave */}
                    <div className="space-y-2 mb-5">
                      {item.bullets.map((b, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-[#ED500A] shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>

                    {/* Botón de Contacto Directo */}
                    <Link
                      href="/#precios"
                      className="inline-flex items-center gap-2 font-title font-bold text-xs sm:text-sm text-[#ED500A] hover:text-[#F36320] transition-colors group cursor-pointer"
                    >
                      <span>Ver planes y precios</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Botón de regreso a funcionalidades generales */}
          <div className="pt-12 text-center">
            <Link
              href="/funcionalidades"
              className="inline-flex items-center gap-2 font-title font-bold text-sm text-slate-500 hover:text-[#ED500A] transition-colors group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Ver todas las funcionalidades de NEGOVA</span>
            </Link>
          </div>

        </div>
      </section>

      {/* ── 3. SECCIÓN OFICIAL DE TARJETAS DE PLANES Y PRECIOS ── */}
      <PricingSection />

      {/* ── 4. PILARES DE CONFIANZA Y RESPALDO ── */}
      <TrustSection />

      {/* ── 5. PREGUNTAS FRECUENTES ── */}
      <FaqLandingSection />

      {/* ── 6. LLAMADO A LA ACCIÓN FINAL ── */}
      <FinalCtaSection />

      {/* Asistentes Flotantes */}
      <FloatingWrapper />

      <Footer />
    </div>
  );
}
