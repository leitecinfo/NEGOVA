/**
 * Catálogo Centralizado de Guías, Preguntas Frecuentes y Tutoriales [HELP-001]
 * 
 * Alcance:
 * 1. Guías paso a paso para todos los módulos principales del Workspace.
 * 2. Preguntas frecuentes (FAQs) con acordeón interactivo.
 * 3. Videos tutoriales con embeds y transcripciones.
 * 4. Mapeo contextual para resolver la ruta activa hacia la guía correspondiente.
 */

export interface HelpStep {
  title: string;
  description: string;
  tip?: string;
}

export interface HelpArticle {
  id: string;
  moduleId: string;
  moduleName: string;
  category: "ventas" | "operaciones" | "inventario" | "gastronomia" | "administracion";
  title: string;
  summary: string;
  readTime: string;
  steps: HelpStep[];
  frequentlyAskedQuestion?: string;
  frequentlyAskedAnswer?: string;
}

export interface HelpFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
  relatedModuleId?: string;
}

export interface HelpVideo {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  duration: string;
  thumbnailUrl: string;
  embedUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GUÍAS RÁPIDAS POR MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "pos-crear-venta",
    moduleId: "pos",
    moduleName: "Punto de Venta (POS)",
    category: "ventas",
    title: "Cómo registrar ventas y emitir tickets en el POS",
    summary: "Aprende a agregar productos al carrito, seleccionar modificadores, aplicar descuentos y procesar cobros mixtos en efectivo, tarjeta o transferencia.",
    readTime: "3 min de lectura",
    steps: [
      {
        title: "1. Verificar que la caja esté abierta",
        description: "Antes de iniciar cobros, el sistema valida que tu turno de caja esté activo. Si está cerrado, pulsa en 'Abrir Caja' e ingresa la base de efectivo inicial.",
        tip: "Si operas en restaurante, asegúrate de estar asignado a la sala o caja correspondiente.",
      },
      {
        title: "2. Seleccionar productos y modificadores",
        description: "Haz clic en cualquier producto del catálogo visual o usa el lector de código de barras. Si el producto tiene extras o términos (ej. salsa, término de carne), se desplegará el modal de modificadores para elegirlos.",
      },
      {
        title: "3. Asignar cliente (opcional o requerido para crédito)",
        description: "Pulsa en 'Buscar o crear cliente' si deseas registrar puntos, emitir factura con datos o conceder fiado/crédito.",
      },
      {
        title: "4. Procesar el pago y emitir comprobante",
        description: "Presiona 'Cobrar', selecciona el método de pago (o 'Pago Dividido' para cobrar una parte en efectivo y otra por transferencia) y confirma. El ticket se imprimirá automáticamente.",
        tip: "Puedes pulsar F4 o Espacio para abrir rápidamente el modal de cobro.",
      },
    ],
  },
  {
    id: "caja-turnos-arqueos",
    moduleId: "caja",
    moduleName: "Caja y Turnos",
    category: "operaciones",
    title: "Cómo abrir turno, registrar movimientos y hacer el cierre de caja",
    summary: "Guía completa para el control de efectivo: apertura de base, registro de ingresos/egresos y conciliación de ventas contra conteo ciego al cerrar turno.",
    readTime: "4 min de lectura",
    steps: [
      {
        title: "1. Apertura de turno de caja",
        description: "Ingresa al módulo Caja y pulsa 'Abrir Turno'. Digita el monto en efectivo con el que inicias el día (base de cambio).",
      },
      {
        title: "2. Registro de movimientos extraordinarios",
        description: "Si pagas a un proveedor de emergencia o retiras dinero para consignar, pulsa 'Nuevo Movimiento', elige 'Egreso' y describe el motivo para mantener el cuadre exacto.",
        tip: "Nunca retires efectivo sin registrar el egreso, o generará un faltante al cierre.",
      },
      {
        title: "3. Realizar el Cierre del Día (Arqueo ciego)",
        description: "Al finalizar la jornada, pulsa 'Cerrar Turno'. Cuenta los billetes y monedas físicos e ingresa el monto total contado sin ver el saldo teórico.",
      },
      {
        title: "4. Revisar diferencias y exportar reporte",
        description: "El sistema comparará el monto contado contra las ventas reales del sistema, calculando si hay sobrante, faltante o cuadre exacto. Genera el PDF del arqueo para tu contabilidad.",
      },
    ],
  },
  {
    id: "catalogo-crear-producto",
    moduleId: "productos",
    moduleName: "Catálogo y Productos",
    category: "inventario",
    title: "Cómo crear productos, combos y gestionar stock",
    summary: "Configura productos con código de barras, categorías, variantes (tallas/colores), impuestos y control de stock mínimo.",
    readTime: "3 min de lectura",
    steps: [
      {
        title: "1. Ingresar a Productos y pulsar 'Nuevo Producto'",
        description: "En el menú lateral, dirígete a Catálogo > Productos y haz clic en el botón superior '+ Nuevo Producto'.",
      },
      {
        title: "2. Definir información básica y precios",
        description: "Ingresa el nombre comercial, categoría, precio de venta con IVA, costo de compra y código de barras (puedes escanearlo directamente con la cámara o pistola).",
      },
      {
        title: "3. Activar control de inventario",
        description: "Marca la casilla 'Controlar stock' e ingresa la cantidad disponible inicial y el stock mínimo de alerta (ej. avisar cuando queden menos de 5 unidades).",
        tip: "Si vendes platillos preparados, desactiva control de stock directo y usa el módulo de Recetas.",
      },
      {
        title: "4. Guardar y verificar disponibilidad",
        description: "Guarda el producto. Quedará disponible de inmediato en el POS, menú digital QR y portal de domicilios según los canales que hayas activado.",
      },
    ],
  },
  {
    id: "mesas-comandas-restaurante",
    moduleId: "mesas",
    moduleName: "Mesas y Restaurante",
    category: "gastronomia",
    title: "Cómo comandar mesas, trasladar cuentas y cobrar cuentas separadas",
    summary: "Organiza tu salón por salas, toma pedidos por mesa con envío instantáneo a cocina y gestiona traslados sin perder los ítems.",
    readTime: "4 min de lectura",
    steps: [
      {
        title: "1. Visualizar el plano de mesas por salas",
        description: "En el módulo Mesas verás tus salas (Interior, Terraza, Barra) con el estado de cada mesa en tiempo real (Libre, Ocupada, Cuenta Pedida).",
      },
      {
        title: "2. Abrir comanda y enviar a cocina",
        description: "Haz clic en una mesa libre, añade los platos y bebidas y presiona 'Enviar a Cocina'. Los tickets aparecerán inmediatamente en la pantalla KDS de los cocineros.",
      },
      {
        title: "3. Trasladar o unir mesas",
        description: "Si los comensales se cambian de lugar, pulsa 'Acciones de Mesa' > 'Trasladar Mesa', selecciona la mesa destino y confirma. Todo el historial se conserva intacto.",
      },
      {
        title: "4. Pedir cuenta y checkout",
        description: "Imprime la precuenta para los clientes y haz clic en 'Cobrar Mesa' cuando deseen pagar. Al finalizar el cobro, la mesa vuelve automáticamente al estado 'Libre'.",
      },
    ],
  },
  {
    id: "cocina-kds-pantalla",
    moduleId: "cocina",
    moduleName: "Pantalla de Cocina (KDS)",
    category: "gastronomia",
    title: "Cómo utilizar el KDS en cocina y despachar pedidos",
    summary: "Reemplaza las comandas de papel por una pantalla táctil sincronizada en tiempo real que alerta pedidos demorados con colores y temporizadores.",
    readTime: "2 min de lectura",
    steps: [
      {
        title: "1. Recepción en tiempo real",
        description: "Cada vez que un mesero o cliente por QR pide un platillo, la comanda entra al KDS con aviso sonoro y encabezado con número de mesa o pedido.",
      },
      {
        title: "2. Indicadores de tiempo y urgencia",
        description: "El ticket cambia de color: verde (<10 min), amarillo (10-20 min) y rojo parpadeante (>20 min) para priorizar los pedidos más antiguos.",
      },
      {
        title: "3. Marcar ítems o comandas completas",
        description: "Toca cada plato para marcarlo como listo, o pulsa 'Despachar Todo' cuando el pedido completo esté emplatado para avisar al mesero o repartidor.",
      },
    ],
  },
  {
    id: "domicilios-portal-despacho",
    moduleId: "domicilios",
    moduleName: "Domicilios y Reparto",
    category: "operaciones",
    title: "Cómo gestionar domicilios y verificar entregas con PIN",
    summary: "Asigna pedidos a tus repartidores, calcula tarifas de envío por zonas y confirma la entrega mediante PIN de seguridad.",
    readTime: "3 min de lectura",
    steps: [
      {
        title: "1. Recepción y aprobación del pedido",
        description: "En Pedidos > Domicilios revisa la dirección, productos y datos del cliente. Pulsa 'Aceptar y Enviar a Cocina'.",
      },
      {
        title: "2. Asignar repartidor",
        description: "Cuando la cocina termine el pedido, pulsa 'Asignar Repartidor' y selecciona al mensajero disponible.",
      },
      {
        title: "3. Entrega segura con PIN",
        description: "El repartidor consulta el pedido desde su celular. Al llegar a la casa del cliente, le solicita el PIN de 4 dígitos para completar la entrega en el sistema.",
        tip: "El PIN evita fraudes y garantiza que el pedido fue entregado a la persona correcta.",
      },
    ],
  },
  {
    id: "clientes-cartera-credito",
    moduleId: "clientes",
    moduleName: "Clientes y Cartera (Fiados)",
    category: "administracion",
    title: "Cómo otorgar crédito a clientes y registrar abonos",
    summary: "Lleva el control de fiados con límite de crédito, historial de compras y registro de abonos parciales o totales.",
    readTime: "3 min de lectura",
    steps: [
      {
        title: "1. Registrar cliente con cupo de crédito",
        description: "En Clientes > Nuevo Cliente, activa la casilla 'Habilitar crédito' e ingresa el cupo máximo permitido (ej. $200.000 COP).",
      },
      {
        title: "2. Vender a crédito en el POS",
        description: "Al cobrar una venta en el POS, selecciona al cliente y elige el método 'A Crédito / Fiado'. El saldo pendiente aumentará automáticamente.",
      },
      {
        title: "3. Registrar abonos de deuda",
        description: "Cuando el cliente venga a pagar, ingresa a su perfil en Clientes > Detalle, haz clic en 'Registrar Abono', ingresa el monto pagado y emite su recibo de caja.",
      },
    ],
  },
  {
    id: "reportes-ventas-horas-pico",
    moduleId: "reportes",
    moduleName: "Reportes y Estadísticas",
    category: "administracion",
    title: "Cómo analizar tus ventas, costos y horarios más concurridos",
    summary: "Visualiza métricas financieras clave: ticket promedio, productos más vendidos, horas pico y rentabilidad real.",
    readTime: "3 min de lectura",
    steps: [
      {
        title: "1. Filtrar por rango de fechas",
        description: "Selecciona el período a consultar (Hoy, Esta semana, Este mes o Rango personalizado) para actualizar todos los gráficos.",
      },
      {
        title: "2. Analizar el mapa de calor de horas pico",
        description: "El reporte de Horas Pico te muestra los días y horas con mayor afluencia para que programes a tu personal eficientemente.",
      },
      {
        title: "3. Exportar informes en Excel y PDF",
        description: "Haz clic en los botones superiores para descargar informes oficiales para tu contador o reuniones administrativas.",
      },
    ],
  },
  {
    id: "configuracion-impresion-2fa",
    moduleId: "configuracion",
    moduleName: "Configuración y Seguridad",
    category: "administracion",
    title: "Cómo configurar impresoras térmicas y activar 2FA",
    summary: "Conecta impresoras de tickets para barra y cocina, y activa la autenticación en dos pasos (Google Authenticator) para blindar el negocio.",
    readTime: "4 min de lectura",
    steps: [
      {
        title: "1. Configurar impresoras y estaciones",
        description: "En Configuración > Impresoras registra tu impresora térmica (80mm o 58mm) y vincúlala a las estaciones que correspondan (Caja, Barra o Cocina).",
      },
      {
        title: "2. Personalizar encabezado y pie de ticket",
        description: "Añade el NIT, dirección, teléfono y un mensaje cordial (ej. '¡Gracias por su compra!') que se imprimirá en cada comprobante.",
      },
      {
        title: "3. Activar Verificación en Dos Pasos (2FA)",
        description: "En Configuración > Seguridad escanea el código QR con Google Authenticator o Authy y guarda tus 8 códigos de respaldo en un lugar seguro.",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. PREGUNTAS FRECUENTES (FAQS)
// ─────────────────────────────────────────────────────────────────────────────

export const HELP_FAQS: HelpFaq[] = [
  {
    id: "faq-1",
    category: "General",
    question: "¿Qué pasa si se me corta la conexión a internet en el negocio?",
    answer: "NEGOVA está optimizado para tolerar intermitencias de red. Si la conexión se pierde temporalmente, puedes continuar interactuando en las pantallas abiertas; una vez regrese la conectividad, las acciones se sincronizan automáticamente con la nube.",
    relatedModuleId: "pos",
  },
  {
    id: "faq-2",
    category: "Impresión",
    question: "¿Qué tipo de impresoras térmicas son compatibles?",
    answer: "Cualquier impresora térmica estándar de 80mm o 58mm con conexión USB, red local Ethernet/Wi-Fi o Bluetooth compatible con comandos ESC/POS o con el controlador nativo del sistema operativo.",
    relatedModuleId: "configuracion",
  },
  {
    id: "faq-3",
    category: "Seguridad",
    question: "¿Qué hago si pierdo el celular y tengo 2FA activado?",
    answer: "Puedes utilizar cualquiera de tus 8 Códigos de Respaldo generados al activar 2FA. En la pantalla de inicio de sesión, pulsa en '¿Sin acceso a tu app? Usar respaldo' e ingresa un código de 8 caracteres (ej. 8B4C-29D1). Cada código sirve una única vez.",
    relatedModuleId: "configuracion",
  },
  {
    id: "faq-4",
    category: "Caja",
    question: "¿Puedo tener más de una caja registradora abierta al mismo tiempo?",
    answer: "Sí, dependiendo de tu plan de suscripción (Plan Crece o Negocio), puedes abrir múltiples turnos de caja en simultáneo asignados a diferentes colaboradores o terminales físicas.",
    relatedModuleId: "caja",
  },
  {
    id: "faq-5",
    category: "Menú QR",
    question: "¿Los clientes necesitan descargar una aplicación para pedir por código QR?",
    answer: "No. El menú digital de NEGOVA es 100% web. El cliente únicamente escanea el código QR de su mesa con la cámara de su celular y el menú se abre de inmediato en su navegador sin descargas ni registros obligatorios.",
    relatedModuleId: "mesas",
  },
  {
    id: "faq-6",
    category: "Facturación",
    question: "¿Los comprobantes emitidos son válidos ante la DIAN?",
    answer: "El POS emite comprobantes de venta internos (tirilla POS / ticket de control). Para negocios que requieren Factura Electrónica de Venta con validación previa de la DIAN, el módulo de facturación electrónica genera el XML y CUFE correspondiente según la resolución asignada.",
    relatedModuleId: "pos",
  },
  {
    id: "faq-7",
    category: "Inventario",
    question: "¿Cómo descuenta el stock una hamburguesa con ingredientes?",
    answer: "A través del módulo de Recetas. Creas la receta de la hamburguesa asociando los ingredientes base (ej. 150g de carne, 1 pan, 30g de queso). Cada vez que vendes una hamburguesa en el POS o por delivery, el stock de cada ingrediente se descuenta automáticamente.",
    relatedModuleId: "productos",
  },
  {
    id: "faq-8",
    category: "Personal",
    question: "¿Cómo creo usuarios para mis cajeros sin que vean las finanzas del negocio?",
    answer: "En el módulo 'Usuarios y Roles' crea la cuenta y asígnale el rol 'Cajero'. Este rol tiene acceso exclusivamente al Punto de Venta y apertura/cierre de su propia caja, impidiendo ver reportes de utilidades, configuración general o modificar precios.",
    relatedModuleId: "configuracion",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. VIDEOS TUTORIALES
// ─────────────────────────────────────────────────────────────────────────────

export const HELP_VIDEOS: HelpVideo[] = [
  {
    id: "video-pos-intro",
    moduleId: "pos",
    title: "Primeros Pasos en el Punto de Venta (POS)",
    description: "Recorrido guiado de 5 minutos: apertura de caja, agregar productos al carrito, modificadores de cocina y cobro en efectivo.",
    duration: "4:32 min",
    thumbnailUrl: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=600&auto=format&fit=crop&q=80",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
  {
    id: "video-mesas-kds",
    moduleId: "mesas",
    title: "Gestión de Salón y Pantalla de Cocina (KDS)",
    description: "Cómo abrir mesas, comandar por salas, enviar a cocina y despachar desde la pantalla KDS táctil.",
    duration: "6:15 min",
    thumbnailUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
  {
    id: "video-caja-cierre",
    moduleId: "caja",
    title: "Control de Efectivo y Cierre Diario de Caja",
    description: "Aprende a registrar egresos, controlar faltantes/sobrantes y conciliar el turno ciego.",
    duration: "3:48 min",
    thumbnailUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
  {
    id: "video-domicilios-pin",
    moduleId: "domicilios",
    title: "Despacho de Domicilios y Validación con PIN",
    description: "Asignación de mensajeros propios, zonas de entrega y verificación con código PIN seguro del cliente.",
    duration: "5:02 min",
    thumbnailUrl: "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&auto=format&fit=crop&q=80",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. MAPEO CONTEXTUAL: Resuelve la ruta activa a su módulo de ayuda
// ─────────────────────────────────────────────────────────────────────────────

export function resolveHelpContextFromPath(pathname: string): string {
  const clean = pathname.toLowerCase();

  if (clean.includes("/pos")) return "pos";
  if (clean.includes("/caja") || clean.includes("/turnos")) return "caja";
  if (clean.includes("/productos") || clean.includes("/inventario") || clean.includes("/categorias")) return "productos";
  if (clean.includes("/mesas") || clean.includes("/reservas")) return "mesas";
  if (clean.includes("/cocina") || clean.includes("/kds")) return "cocina";
  if (clean.includes("/domicilios") || clean.includes("/reparto") || clean.includes("/despacho")) return "domicilios";
  if (clean.includes("/clientes") || clean.includes("/cartera") || clean.includes("/creditos")) return "clientes";
  if (clean.includes("/reportes") || clean.includes("/dashboard") || clean.includes("/ventas")) return "reportes";
  if (clean.includes("/configuracion") || clean.includes("/roles") || clean.includes("/usuarios")) return "configuracion";

  return "pos"; // Fallback amigable
}

