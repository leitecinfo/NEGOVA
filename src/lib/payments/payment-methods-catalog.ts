import {
  PaymentMethodCode,
  PaymentMethodMetadata,
  BusinessPaymentMethodConfig,
  PaymentDestinationType,
  BreBKeyType,
  PublicPaymentMethodDTO,
} from "./types";

export const PAYMENT_METHOD_CODES: readonly PaymentMethodCode[] = [
  "cash",
  "nequi",
  "daviplata",
  "bancolombia",
  "davivienda",
  "nu",
  "bre_b",
] as const;

/**
 * Catálogo maestro de entidades y medios de pago soportados en NEGOVA.
 * Fuente única de verdad para nombres visibles, tipos, logos y reglas de validación.
 */
export const PAYMENT_METHODS_CATALOG: Record<PaymentMethodCode, PaymentMethodMetadata> = {
  cash: {
    code: "cash",
    name: "Efectivo",
    category: "cash",
    categoryLabel: "Efectivo",
    description: "Pago directo contra entrega o al recoger en el local comercial.",
    logoPath: null,
    supportsQr: false,
    allowedDestinationTypes: [],
    defaultDestinationType: "phone",
    destinationValueLabel: "No aplica",
    destinationValuePlaceholder: "",
    requiresAccountHolder: false,
  },
  nequi: {
    code: "nequi",
    name: "Nequi",
    category: "wallet",
    categoryLabel: "Billetera / transferencia",
    description: "Transferencias inmediatas a través de la app Nequi.",
    logoPath: "/bancos/nequi.svg",
    supportsQr: false,
    allowedDestinationTypes: [{ value: "phone", label: "Número de celular Nequi" }],
    defaultDestinationType: "phone",
    destinationValueLabel: "Número de celular Nequi",
    destinationValuePlaceholder: "Ej. 300 123 4567",
    requiresAccountHolder: false,
  },
  daviplata: {
    code: "daviplata",
    name: "DaviPlata",
    category: "wallet",
    categoryLabel: "Billetera / transferencia",
    description: "Transferencias digitales mediante DaviPlata.",
    logoPath: "/bancos/daviplata.svg",
    supportsQr: false,
    allowedDestinationTypes: [{ value: "phone", label: "Número de celular DaviPlata" }],
    defaultDestinationType: "phone",
    destinationValueLabel: "Número de celular DaviPlata",
    destinationValuePlaceholder: "Ej. 310 987 6543",
    requiresAccountHolder: false,
  },
  bancolombia: {
    code: "bancolombia",
    name: "Bancolombia",
    category: "bank",
    categoryLabel: "Banco / transferencia",
    description: "Cuentas de ahorros o corriente Bancolombia.",
    logoPath: "/bancos/bancolombia.svg",
    supportsQr: false,
    allowedDestinationTypes: [
      { value: "savings_account", label: "Cuenta de Ahorros" },
      { value: "checking_account", label: "Cuenta Corriente" },
    ],
    defaultDestinationType: "savings_account",
    destinationValueLabel: "Número de cuenta bancaria",
    destinationValuePlaceholder: "Ej. 031-123456-78",
    requiresAccountHolder: true,
  },
  davivienda: {
    code: "davivienda",
    name: "Davivienda",
    category: "bank",
    categoryLabel: "Banco / transferencia",
    description: "Transferencias a cuentas bancarias Davivienda.",
    // Archivo davivienda.svg no está presente actualmente en public/bancos/. Usar null para fallback visual neutro.
    logoPath: null,
    supportsQr: false,
    allowedDestinationTypes: [
      { value: "savings_account", label: "Cuenta de Ahorros" },
      { value: "checking_account", label: "Cuenta Corriente" },
    ],
    defaultDestinationType: "savings_account",
    destinationValueLabel: "Número de cuenta bancaria",
    destinationValuePlaceholder: "Ej. 458-987654-32",
    requiresAccountHolder: true,
  },
  nu: {
    code: "nu",
    name: "Nu",
    category: "account",
    categoryLabel: "Cuenta / transferencia",
    description: "Transferencias a cuenta de ahorros o celular Nu (Nubank).",
    logoPath: "/bancos/nu.svg",
    supportsQr: false,
    allowedDestinationTypes: [
      { value: "savings_account", label: "Cuenta de Ahorros Nu" },
      { value: "phone", label: "Número de celular asociado" },
    ],
    defaultDestinationType: "savings_account",
    destinationValueLabel: "Número de cuenta o celular Nu",
    destinationValuePlaceholder: "Ej. 1234567890",
    requiresAccountHolder: false,
  },
  bre_b: {
    code: "bre_b",
    name: "Bre-B",
    category: "key",
    categoryLabel: "Transferencia por llave",
    description: "Sistema interoperable de transferencias instantáneas mediante llave.",
    logoPath: "/bancos/breb.svg",
    supportsQr: true,
    allowedDestinationTypes: [
      { value: "phone", label: "Celular" },
      { value: "email", label: "Correo electrónico" },
      { value: "alphanumeric", label: "Llave alfanumérica" },
      { value: "merchant_code", label: "Código de comercio" },
    ],
    defaultDestinationType: "phone",
    destinationValueLabel: "Valor de la llave de destino",
    destinationValuePlaceholder: "Ej. 3001234567 o pagos@minegocio.com",
    requiresAccountHolder: false,
  },
};

/**
 * Obtiene los metadatos de un método del catálogo.
 */
export function getPaymentMethodMetadata(code: string): PaymentMethodMetadata | undefined {
  if (code in PAYMENT_METHODS_CATALOG) {
    return PAYMENT_METHODS_CATALOG[code as PaymentMethodCode];
  }
  return undefined;
}

/**
 * Retorna la etiqueta amigable para un tipo de destino.
 */
export function getDestinationTypeLabel(
  type?: PaymentDestinationType | null,
  breBKeyType?: BreBKeyType | null
): string {
  if (breBKeyType) {
    switch (breBKeyType) {
      case "phone":
        return "Celular";
      case "email":
        return "Correo electrónico";
      case "alphanumeric":
        return "Llave alfanumérica";
      case "merchant_code":
        return "Código de comercio";
    }
  }

  switch (type) {
    case "phone":
      return "Celular";
    case "savings_account":
      return "Cuenta de Ahorros";
    case "checking_account":
      return "Cuenta Corriente";
    case "email":
      return "Correo electrónico";
    case "alphanumeric":
      return "Llave alfanumérica";
    case "merchant_code":
      return "Código de comercio";
    case "id_number":
      return "Cédula / NIT";
    default:
      return "Dato de destino";
  }
}

/**
 * Verifica si los datos obligatorios de un método de pago están completos.
 * Efectivo siempre está completo y no requiere configuración.
 * Para transferencias, se requiere al menos el valor de destino y, para Bre-B, el tipo y valor de llave.
 */
export function isPaymentMethodComplete(
  code: PaymentMethodCode,
  config?: Partial<BusinessPaymentMethodConfig> | null
): boolean {
  if (code === "cash") return true;
  if (!config) return false;

  const destVal = config.destinationValue?.trim();
  if (!destVal || destVal.length < 3) {
    return false;
  }

  if (code === "bre_b") {
    const keyType = config.breBKeyType || (config.destinationType as BreBKeyType);
    if (!keyType || !["phone", "email", "alphanumeric", "merchant_code"].includes(keyType)) {
      return false;
    }
  }

  return true;
}

/**
 * Configuración inicial por defecto para un método del catálogo.
 */
export function getDefaultMethodConfig(code: PaymentMethodCode): BusinessPaymentMethodConfig {
  const meta = PAYMENT_METHODS_CATALOG[code];
  return {
    code,
    name: meta?.name || code,
    isEnabled: code === "cash", // Solo efectivo inicia activo por defecto
    isConfigured: code === "cash",
    accountHolder: null,
    destinationType: meta?.defaultDestinationType || "phone",
    destinationValue: null,
    instructions: null,
    breBKeyType: code === "bre_b" ? "phone" : null,
    qrUrl: null,
    qrStoragePath: null,
  };
}

/**
 * Mapea la configuración interna a DTO público apto para el menú digital y el cliente.
 */
export function toPublicPaymentMethodDTO(config: BusinessPaymentMethodConfig): PublicPaymentMethodDTO {
  const meta = PAYMENT_METHODS_CATALOG[config.code];
  return {
    code: config.code,
    name: meta?.name || config.name || config.code,
    category: meta?.categoryLabel || "Transferencia",
    logoPath: meta?.logoPath || null,
    accountHolder: config.accountHolder?.trim() || null,
    destinationType: config.destinationType || null,
    destinationValue: config.destinationValue?.trim() || null,
    instructions: config.instructions?.trim() || null,
    breBKeyType: config.breBKeyType || null,
    qrUrl: config.qrUrl || null,
  };
}
