export interface FaqItem {
  id: string;
  clusterId: string;
  clusterName: string;
  question: string;
  answer: string;
  isFeaturedInLanding?: boolean;
}

export interface FaqCluster {
  id: string;
  name: string;
  description: string;
}

export const FAQ_CLUSTERS: FaqCluster[] = [
  {
    id: "general",
    name: "Sobre NEGOVA",
    description: "Qué es NEGOVA, para quién está pensado y cómo funciona.",
  },
  {
    id: "ventas",
    name: "Ventas y Caja",
    description: "Registro de ventas, comprobantes y movimiento diario.",
  },
  {
    id: "inventario",
    name: "Inventario y Stock",
    description: "Control de productos, existencias y alertas de reposición.",
  },
  {
    id: "caja",
    name: "Caja y Gastos",
    description: "Control del dinero que entra y sale, y cuadre de caja.",
  },
  {
    id: "clientes",
    name: "Clientes y Fiado",
    description: "Cuentas por cobrar, créditos a clientes y seguimiento de deudas.",
  },
  {
    id: "negocios",
    name: "Tipos de Negocios",
    description: "Adaptabilidad para restaurantes, comercios, tiendas y servicios.",
  },
  {
    id: "precios",
    name: "Planes y Precios",
    description: "Costos, qué incluye cada plan y opciones de pago.",
  },
  {
    id: "prueba",
    name: "Prueba Gratuita",
    description: "Condiciones de los 30 días gratis y puesta en marcha.",
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  // ── GENERAL ──
  {
    id: "que-es-negova",
    clusterId: "general",
    clusterName: "Sobre NEGOVA",
    question: "¿Qué es NEGOVA y para qué tipo de negocios sirve?",
    answer:
      "NEGOVA es una plataforma de gestión diseñada para pequeños y medianos negocios. Permite llevar el control de ventas, inventario, caja y clientes desde un solo lugar de forma sencilla y sin complicaciones técnicas.",
    isFeaturedInLanding: true,
  },
  {
    id: "servicios-tienda-barrio",
    clusterId: "general",
    clusterName: "Sobre NEGOVA",
    question: "¿NEGOVA sirve para una tienda pequeña o un negocio de barrio?",
    answer:
      "Sí. NEGOVA está pensado precisamente para negocios que quieren dejar atrás los cuadernos y las hojas de cálculo. Es fácil de usar y no requiere conocimientos de contabilidad ni tecnología.",
    isFeaturedInLanding: true,
  },
  {
    id: "necesito-instalacion",
    clusterId: "general",
    clusterName: "Sobre NEGOVA",
    question: "¿Necesito instalar algún programa para utilizar NEGOVA?",
    answer:
      "No. NEGOVA funciona directamente desde el navegador web de tu computador o tablet. Solo necesitas una conexión a internet para ingresar y administrar tu negocio.",
    isFeaturedInLanding: false,
  },

  // ── VENTAS ──
  {
    id: "control-ventas-caja",
    clusterId: "ventas",
    clusterName: "Ventas y Caja",
    question: "¿Puedo registrar mis ventas y saber cuánto vendí durante el día?",
    answer:
      "Sí. NEGOVA te permite registrar cada venta al instante, generar comprobantes y consultar reportes claros de tus ventas diarias, semanales o mensuales.",
    isFeaturedInLanding: true,
  },
  {
    id: "pos-tienda-pequena",
    clusterId: "ventas",
    clusterName: "Ventas y Caja",
    question: "¿Necesito un sistema POS o lector de código de barras?",
    answer:
      "No es obligatorio, pero si cuentas con un lector de barras USB o Bluetooth, NEGOVA lo reconoce automáticamente para agilizar el cobro en mostrador.",
    isFeaturedInLanding: false,
  },

  // ── INVENTARIO ──
  {
    id: "control-inventario-manual",
    clusterId: "inventario",
    clusterName: "Inventario y Stock",
    question: "¿Puedo llevar el inventario de mi negocio sin hacerlo manualmente?",
    answer:
      "Sí. Al registrar tus ventas, el inventario se descuenta automáticamente. Además, recibirás alertas cuando un producto se esté agotando para saber cuándo debes reponer mercancía.",
    isFeaturedInLanding: true,
  },
  {
    id: "variantes-productos",
    clusterId: "inventario",
    clusterName: "Inventario y Stock",
    question: "¿Cómo manejo productos con variantes como tallas o colores?",
    answer:
      "A partir del plan Crecimiento, puedes organizar productos por categorías y variantes como tallas, sabores o presentaciones sin desordenar tu stock.",
    isFeaturedInLanding: false,
  },

  // ── CAJA Y DINERO ──
  {
    id: "cuadre-caja-diario",
    clusterId: "caja",
    clusterName: "Caja y Gastos",
    question: "¿Cómo saber si la caja de mi negocio está cuadrada al final del día?",
    answer:
      "NEGOVA registra las entradas y salidas de dinero en efectivo o transferencias, permitiéndote hacer el arqueo de caja diario para confirmar que los saldos coincidan sin desfasamientos.",
    isFeaturedInLanding: false,
  },

  // ── CLIENTES Y FIADO ──
  {
    id: "control-cuentas-cobrar-fiado",
    clusterId: "clientes",
    clusterName: "Clientes y Fiado",
    question: "¿Puedo registrar y controlar el fiado o cuentas por cobrar a mis clientes?",
    answer:
      "Sí. Puedes asociar ventas a la cuenta de un cliente, llevar el saldo de sus deudas y registrar los abonos realizados para mantener el fiado organizado sin libretas de papel.",
    isFeaturedInLanding: true,
  },

  // ── TIPOS DE NEGOCIOS ──
  {
    id: "servicios-restaurantes",
    clusterId: "negocios",
    clusterName: "Tipos de Negocios",
    question: "¿NEGOVA sirve para restaurantes y negocios de comida?",
    answer:
      "Sí. NEGOVA incluye un modo gastronómico para administrar comandas, ingredientes por receta, mesas y entregas en barra o a domicilio.",
    isFeaturedInLanding: true,
  },
  {
    id: "barberias-servicios",
    clusterId: "negocios",
    clusterName: "Tipos de Negocios",
    question: "¿Sirve para barberías, estéticas o negocios de servicios?",
    answer:
      "Sí. Permite registrar los servicios prestados, asignarlos a cada profesional y llevar la liquidación de comisiones diarias o semanales.",
    isFeaturedInLanding: false,
  },

  // ── PLANES Y PRECIOS ──
  {
    id: "cuanto-cuesta-negova",
    clusterId: "precios",
    clusterName: "Planes y Precios",
    question: "¿Cuánto cuesta NEGOVA y qué opciones de plan existen?",
    answer:
      "NEGOVA ofrece tres planes: Inicio ($29.900 COP/mes) para ordenar el negocio, Crece ($59.900 COP/mes) con estadísticas e IA recomendada, y Negocio ($99.900 COP/mes) para operaciones con colaboradores.",
    isFeaturedInLanding: false,
  },

  // ── PRUEBA GRATUITA ──
  {
    id: "prueba-gratuita-condiciones",
    clusterId: "prueba",
    clusterName: "Prueba Gratuita",
    question: "¿Puedo probar NEGOVA gratis antes de pagar?",
    answer:
      "Sí. Puedes probar el plan Inicio durante 30 días totalmente gratis y sin compromiso. Te acompañamos en la puesta en marcha inicial para que verifiques si encaja con tu forma de trabajar.",
    isFeaturedInLanding: true,
  },
  {
    id: "que-incluye-prueba-30-dias",
    clusterId: "prueba",
    clusterName: "Prueba Gratuita",
    question: "¿Qué incluye la prueba gratuita de 30 días?",
    answer:
      "Acceso completo a las funciones del plan Inicio (registro de ventas, gastos, inventario, caja y clientes) junto con soporte y asesoría para configurar tu catálogo inicial.",
    isFeaturedInLanding: false,
  },
];
