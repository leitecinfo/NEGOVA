import {
  TicketTemplateConfig,
  KitchenCommandTemplateConfig,
} from "./types";

export const DEFAULT_TICKET_TEMPLATE: TicketTemplateConfig = {
  showLogo: true,
  businessName: "Mi Negocio",
  taxId: "900.123.456-7",
  address: "Calle 10 # 40-20, Zona Centro",
  phone: "+57 300 123 4567",
  headerText: "Régimen Simple de Tributación — No responsable de IVA",
  footerText: "Comprobante de venta para control interno y soporte comercial.",
  thankYouNote: "¡Gracias por su compra! Esperamos atenderle nuevamente.",
  paperWidth: "80mm",
  showCustomerInfo: true,
  showWaiterInfo: true,
  showPaymentDetails: true,
  customLogoUrl: null,
};

export const DEFAULT_KITCHEN_COMMAND_TEMPLATE: KitchenCommandTemplateConfig = {
  format: "compact",
  showPrices: false,
  highlightModifiers: true,
  groupItemsByCategory: true,
  fontSize: "md",
  showDinersCount: true,
  showWaiterName: true,
  showTableNumber: true,
  paperWidth: "80mm",
  headerTitle: "*** COMANDA DE COCINA ***",
};

/**
 * Genera datos de muestra para la vista previa del comprobante / ticket comercial.
 */
export function getSampleTicketMock(
  businessInfo: {
    name: string;
    tradeName?: string;
    legalName?: string;
    taxId?: string;
    address?: string;
    city?: string;
    phone?: string;
    logoUrl?: string | null;
  },
  template: TicketTemplateConfig
) {
  return {
    documentNumber: "TKT-00428",
    issuedAt: new Date().toISOString(),
    business: {
      name: template.businessName || businessInfo.tradeName || businessInfo.name,
      legalName: template.legalName || businessInfo.legalName,
      taxId: template.taxId || businessInfo.taxId,
      address: template.address || businessInfo.address,
      city: businessInfo.city || "Colombia",
      phone: template.phone || businessInfo.phone,
      logoUrl: template.customLogoUrl !== undefined ? template.customLogoUrl : businessInfo.logoUrl,
    },
    orderType: "dine_in",
    tableName: "Mesa 4 · Salón Principal",
    dinersCount: 3,
    waiterName: "Carlos Gómez",
    customer: {
      name: "Alejandro Restrepo",
      phone: "+57 311 456 7890",
      address: "Carrera 45 # 12-30",
    },
    items: [
      {
        description: "Hamburguesa Gourmet Doble Carne",
        quantity: 2,
        unitPrice: 28000,
        total: 56000,
        modifiers: [
          { groupName: "Queso", optionName: "Extra Mozzarella", price: 3500 },
          { groupName: "Papas", optionName: "Papas Rústicas", price: 0 },
        ],
      },
      {
        description: "Pizza Artesanal 4 Quesos (Mediana)",
        quantity: 1,
        unitPrice: 38000,
        total: 38000,
        notes: "Masa delgada y bien tostada",
      },
      {
        description: "Limonada Natural de Hierbabuena",
        quantity: 2,
        unitPrice: 8500,
        total: 17000,
      },
    ],
    subtotal: 111000,
    discountTotal: 0,
    deliveryFee: 0,
    total: 111000,
    paymentMethod: "Efectivo",
    paymentStatus: "paid",
    headerText: template.headerText,
    footerText: template.footerText,
    thankYouNote: template.thankYouNote,
  };
}

/**
 * Genera datos de muestra para la vista previa de la comanda de cocina / barra.
 * ¡CRITERIO CLAVE!: Sin precios monetarios pero con modificadores claramente destacados.
 */
export function getSampleKitchenCommandMock(template: KitchenCommandTemplateConfig) {
  return {
    orderNumber: "104",
    issuedAt: new Date().toISOString(),
    headerTitle: template.headerTitle || "*** COMANDA DE COCINA ***",
    area: "Cocina Caliente",
    tableName: "Mesa 4 · Salón",
    dinersCount: 3,
    waiterName: "Carlos Gómez",
    orderType: "dine_in",
    items: [
      {
        id: "item-1",
        quantity: 2,
        name: "Hamburguesa Gourmet Doble Carne",
        category: "Hamburguesas & Platos Fuertes",
        modifiers: [
          { type: "add", text: "[+] Extra Queso Mozzarella" },
          { type: "remove", text: "[-] Sin Cebolla Roja" },
          { type: "spec", text: "Término: Tres Cuartos (3/4)" },
          { type: "spec", text: "Acompañamiento: Papas Rústicas" },
        ],
        notes: "Servir en pan brioche sellado con mantequilla",
      },
      {
        id: "item-2",
        quantity: 1,
        name: "Pizza Artesanal 4 Quesos (Mediana)",
        category: "Pizzas & Horno",
        modifiers: [
          { type: "add", text: "[+] Extra Orégano y Albahaca" },
          { type: "spec", text: "Masa delgada y crocante" },
        ],
        notes: "Cortar en 8 porciones iguales",
      },
      {
        id: "item-3",
        quantity: 1,
        name: "Ensalada César con Pollo Grillé",
        category: "Entradas & Ensaladas",
        modifiers: [
          { type: "spec", text: "Aderezo césar servido al lado" },
          { type: "remove", text: "[-] Sin Crutones de Ajo" },
        ],
        notes: null,
      },
    ],
    generalNotes: "Cliente de la mesa es alérgico severo al maní y mariscos. Prioridad alta.",
  };
}

