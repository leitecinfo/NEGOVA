/**
 * CAPA DE CONOCIMIENTO CENTRALIZADA Y CONTROLADA PARA EL ASISTENTE NEGOVA
 * 
 * Basada en el documento oficial de NEGOVA.
 * Sin invenciones de precios, funciones ni certificaciones no confirmadas.
 */

export interface KnowledgeItem {
  topic: string;
  keywords: string[];
  response: string;
  suggestedAction?: {
    label: string;
    actionType: "whatsapp" | "link";
    href?: string;
  };
}

export const NEGOVA_KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    topic: "qué es negova",
    keywords: ["que es", "qué es", "negova", "propuesta", "para que sirve", "plataforma", "sistema", "objetivo"],
    response:
      "NEGOVA es una plataforma de gestión web pensada especialmente para pequeños negocios y comercios de barrio. Ayuda a organizar la operación diaria desde un solo lugar: **ventas, inventario, caja, productos, clientes y reportes**, sustituyendo cuadernos, hojas de cálculo o la memoria del propietario de forma sencilla y sin complicaciones contables.",
    suggestedAction: {
      label: "Ver planes y precios",
      actionType: "link",
      href: "/#precios",
    },
  },
  {
    topic: "mercado inicial y ubicación",
    keywords: ["guajira", "colombia", "ubicacion", "ciudad", "pais", "donde esta", "mercado", "cobertura"],
    response:
      "Actualmente, la operación inicial de NEGOVA está enfocada en el **mercado de La Guajira, Colombia**, atendiendo especialmente a pequeños comercios y negocios de barrio locales. Estamos trabajando en la expansión progresiva a otras zonas.",
  },
  {
    topic: "aplicación móvil vs versión web",
    keywords: ["app", "aplicacion", "play store", "app store", "android", "iphone", "descargar", "celular"],
    response:
      "Actualmente NEGOVA está comenzando con una **versión web accesible desde cualquier navegador** (computador, laptop, tablet o celular). La prioridad es ofrecer una plataforma ágil y funcional antes de desarrollar aplicaciones móviles nativas independientes.",
  },
  {
    topic: "tienda de barrio / minimercado",
    keywords: ["tienda de barrio", "minimercado", "abarrotes", "kiosco", "variedades"],
    response:
      "¡Totalmente! La tienda de barrio y el minimercado son negocios centrales para los que NEGOVA fue concebido. Te ayuda a controlar las ventas diarias, conocer el stock en estantería, cuadrar la caja y llevar el registro del fiado sin cuadernos.",
    suggestedAction: {
      label: "Probar 30 días gratis",
      actionType: "link",
      href: "/#precios",
    },
  },
  {
    topic: "farmacia de barrio",
    keywords: ["farmacia", "drogueria", "medicamentos"],
    response:
      "NEGOVA está orientado a pequeños comercios como farmacias de barrio para organizar ventas, caja e inventario. Ten en cuenta que funcionalidades regulatorias o sanitarias especializadas (fórmulas médicas, control de medicamentos regulados) deben confirmarse directamente con nuestro equipo.",
  },
  {
    topic: "restaurante pequeño / comida rápida",
    keywords: ["restaurante", "comida rapida", "comidas rapidas", "cafeteria", "panaderia", "pasteleria", "comanda", "mesa"],
    response:
      "Sí, los restaurantes pequeños, cafeterías y locales de comida rápida forman parte del público atendido por NEGOVA para registrar ventas, productos, caja diaria y clientes. Funciones específicas como comandas de cocina o manejo de mesas están en constante validación con el equipo.",
  },
  {
    topic: "barbería y servicios",
    keywords: ["barberia", "peluqueria", "salon", "estetica", "spa", "gimnasio", "taller", "agendamiento", "comisiones"],
    response:
      "Sí. Las barberías, peluquerías, gimnasios y negocios de servicios pueden usar NEGOVA para organizar sus ventas, clientes y caja cotidiana. Funciones específicas como agenda online o comisiones automáticas deben ser confirmadas con el equipo.",
  },
  {
    topic: "planes y precios oficiales",
    keywords: ["planes", "precios", "cuanto cuesta", "precio", "costo", "valor", "tarifas", "suscripcion", "mensual", "cop"],
    response:
      "NEGOVA ofrece tres planes mensuales transparentes en pesos colombianos (COP):\n\n• **Plan Inicio ($29.900 COP/mes):** Para pequeños negocios que quieren dar el primer paso para organizar ventas e inventario.\n• **Plan Crece ($59.900 COP/mes - RECOMENDADO):** Para negocios con mayor actividad que necesitan control de fiados y estadísticas de operación.\n• **Plan Negocio ($99.900 COP/mes):** Para negocios con colaboradores y mayor volumen de operación.",
    suggestedAction: {
      label: "Ver tabla comparativa",
      actionType: "link",
      href: "/planes",
    },
  },
  {
    topic: "recomendación de plan",
    keywords: ["cual plan", "que plan", "recomiendame un plan", "cual me conviene", "diferencia entre inicio y crece", "diferencia entre inicio y crecimiento"],
    response:
      "Para darte la mejor sugerencia, cuéntame: ¿Qué tipo de negocio tienes y qué te interesa organizar principalmente (ventas, inventario, caja o fiados)?\n\nDe forma general:\n- Si estás comenzando a organizar la operación, el **Plan Inicio ($29.900 COP/mes)** es perfecto.\n- Si tu negocio tiene movimiento diario y fiados a clientes, te recomendamos el **Plan Crece ($59.900 COP/mes)**.",
  },
  {
    topic: "prueba gratuita de 30 días",
    keywords: ["prueba gratis", "30 dias", "gratis", "demostracion", "probar", "sin tarjeta", "solicitar prueba"],
    response:
      "Ofrecemos una **Prueba Gratuita de 30 días del Plan Inicio** para que compruebes cómo NEGOVA se adapta a tu negocio. No requiere tarjetas de crédito. El proceso de alta lo coordina directamente nuestro equipo.",
    suggestedAction: {
      label: "Solicitar prueba por WhatsApp",
      actionType: "whatsapp",
    },
  },
  {
    topic: "cómo se conectan las partes",
    keywords: ["como funciona", "conectado", "integrado", "actualiza", "operacion"],
    response:
      "La idea principal es: **Tú haces la venta y NEGOVA mantiene todo actualizado**. Al registrar una venta, el producto se descuenta automáticamente del inventario, el efectivo entra a la caja y, si está asociada a un cliente, se actualiza su historial sin registrar el mismo dato dos veces.",
  },
  {
    topic: "funcionalidades no confirmadas / guardrail",
    keywords: [
      "facturacion electronica",
      "dian",
      "codigo de barras",
      "integracion bancos",
      "recetas",
      "agenda online",
      "comisiones",
      "api externa",
    ],
    response:
      "Esa funcionalidad específica todavía no está confirmada dentro de la información disponible de NEGOVA. Si deseas, puedes contactar a nuestro equipo por WhatsApp para confirmar si está en proceso de desarrollo.",
    suggestedAction: {
      label: "Consultar por WhatsApp",
      actionType: "whatsapp",
    },
  },
];

/**
 * Motor conversacional contextual que evalúa la pregunta del usuario y consulta la base oficial.
 */
export function queryNegovaKnowledge(userQuery: string): {
  text: string;
  suggestedAction?: KnowledgeItem["suggestedAction"];
} {
  const normalized = userQuery
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Saludo conversacional contextual cuando el usuario solo menciona "tengo una tienda"
  if (normalized.includes("tengo una tienda") && !normalized.includes("que")) {
    return {
      text: "¡Excelente! Cuéntame: ¿es una tienda de barrio, ropa, ferretería, tecnología u otro tipo de tienda? Así podré explicarte exactamente qué funciones de NEGOVA se adaptan mejor a tu negocio.",
    };
  }

  // Saludos básicos
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|saludos|hey)$/.test(normalized.trim())) {
    return {
      text: "¡Hola! ¿En qué puedo orientarte hoy sobre NEGOVA? Puedo ayudarte con dudas sobre ventas, inventario, caja o reportes.",
    };
  }

  if (normalized.includes("tengo un restaurante") && !normalized.includes("que")) {
    return {
      text: "¡Genial! ¿Es un restaurante pequeño, local de comida rápida, cafetería o panadería? Cuéntame qué necesitas controlar principalmente (ventas, caja o inventario).",
    };
  }

  for (const item of NEGOVA_KNOWLEDGE_BASE) {
    const matches = item.keywords.some((kw) => {
      const normalizedKw = kw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return normalized.includes(normalizedKw);
    });

    if (matches) {
      return {
        text: item.response,
        suggestedAction: item.suggestedAction,
      };
    }
  }

  // Respuesta transparente y profesional si la consulta excede el conocimiento documentado
  return {
    text: "Esa información o característica específica todavía no está confirmada dentro de la información disponible de NEGOVA. Si deseas, puedes escribirnos directamente por WhatsApp para confirmarlo con nuestro equipo.",
    suggestedAction: {
      label: "Hablar con NEGOVA por WhatsApp",
      actionType: "whatsapp",
    },
  };
}
