/**
 * NEGOVA Platform Configuration Architecture
 * 
 * Alcance actual: Panel de Administración Interno de NEGOVA Core.
 * Todas las configuraciones corresponden exclusivamente a la plataforma global.
 */

// ==========================================
// 1. DOMINIO: PLATAFORMA (Global Admin)
// ==========================================

export type PlatformConfigSectionId =
  | "general"
  | "seguridad"
  | "usuarios-acceso"
  | "facturacion"
  | "planes-limites"
  | "auditoria";

export type PlatformHolderType = "natural_person" | "legal_entity";

export interface NaturalPersonHolderConfig {
  documentType: "CC" | "CE" | "PP" | "PEP" | "no_configurado" | string;
  documentNumber: string;
  fullName: string;
  taxId: string; // NIT según RUT / DIAN
  verificationDigit: string; // DV según RUT / DIAN
  taxAddress: string; // Domicilio fiscal / tributario del titular
}

export interface LegalEntityHolderConfig {
  legalName: string; // Razón social
  taxId: string; // NIT de la entidad jurídica
  verificationDigit: string; // DV de la entidad
  legalRepresentativeName: string; // Nombre del representante legal
  legalRepresentativeDocType: string;
  legalRepresentativeDocNumber: string;
  fiscalAddress: string; // Sede / Domicilio fiscal de la empresa
}

export interface PlatformGeneralConfig {
  platformName: string; // Nombre comercial / Proyecto: "NEGOVA"
  tagline: string;
  supportEmail: string;
  billingSupportEmail: string;
  holderType: PlatformHolderType;
  naturalHolder: NaturalPersonHolderConfig;
  legalHolder: LegalEntityHolderConfig;
  taxRegime: "no_configurado" | "no_responsable_iva" | "responsable_iva" | "simple_tributacion" | "regimen_ordinario";
  taxStatus: "no_configurado" | "no_responsable_iva" | "responsable_iva";
  commercialAddress: string; // Dirección comercial o sede de NEGOVA (puede ser virtual / no existir)
  country: "Colombia (CO)";
  defaultCurrency: "COP";
  timezone: "America/Bogota (UTC-5)";
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
}

export interface AdminSessionPolicy {
  inactivityTimeoutMinutes: 15 | 30 | 60 | 120 | number;
  maxSessionHours: 12 | 24 | 48;
  requireMfa: boolean;
  requireReauthForSensitive: boolean;
}

export interface BusinessSessionPolicy {
  persistentSessionsEnabled: boolean;
  maxSessionDays: 7 | 14 | 30;
  inactivityTimeoutMinutes: number | null;
  requireReauthForSensitive: boolean;
  enforceImmediateRevocation: boolean;
}

export interface PlatformSecurityConfig {
  adminSession: AdminSessionPolicy;
  businessSession: BusinessSessionPolicy;
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  passwordExpirationDays: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  rateLimitPerMinute: number;
  sessionTimeoutMinutes?: number;
  requireMfaForStaff?: boolean;
}

export interface PlatformUsersAccessConfig {
  allowedRoles: Array<"super_admin" | "staff" | "auditor">;
  allowAdminInvitations: boolean;
  invitationExpiryHours: number;
  whoCanInvite: "super_admin_only" | "super_admin_and_staff";
  defaultUserStatus: "active" | "pending_verification";
  enforceEmailVerification: boolean;
  accountActivationPolicy: "immediate" | "manual_approval";
  requireMfaForInternal: boolean;
  requireReauthForSensitive: boolean;
  inactivityTimeoutMinutes: number;
  maxSessionHours: number;
  allowAdminSelfRegistration?: boolean;
}

export interface PlatformNotificationsConfig {
  // 1. Canales de Envío
  emailEnabled: boolean;
  emailSenderAddress: string;
  emailSenderName: string;
  whatsAppEnabled: boolean;
  inAppNotificationsEnabled: boolean;

  // 2. Matriz de Alertas Críticas (Superadmin)
  alertFailedLoginSpike: boolean;
  alertNewDeviceLogin: boolean;
  alertNewTenantCreated: boolean;
  alertSupportRequest: boolean;
  alertSubscriptionExpiring: boolean;
  alertStorageLimitWarning: boolean;
  alertCriticalErrors: boolean;

  // 3. Correo de Recepción de Alertas Técnicas y Operativas
  alertRecipientEmail: string;

  // Compatibilidad adicional
  smsEnabled?: boolean;
  dailyDigestEnabled?: boolean;
  notifyOnCriticalSecurityEvents?: boolean;
}

export interface PlatformIntegrationsConfig {
  resendConfigured: boolean;
  resendMaskedApiKey?: string;
  stripeConfigured: boolean;
  wompiConfigured: boolean;
  twilioConfigured: boolean;
  supabaseStorageBucket: string;
}

export interface PlatformBillingConfig {
  paymentModel: "manual"; // Modelo real actual: Gestión manual de pagos y activación
  platformDefaultCurrency: "COP"; // Moneda base única de la plataforma
  paymentGatewayStatus: "no_configurada"; // Ninguna pasarela activa actualmente
  invoicePrefix: string;
  taxStatus: "no_configurado"; // Sin impuestos asumidos
  // Compatibilidad técnica
  saasTaxRatePercentage?: number;
  saasTaxInclusivePricing?: boolean;
  saasInvoicePrefix?: string;
  taxRatePercentage?: number;
  taxInclusivePricing?: boolean;
  gracePeriodDays?: number;
  retryAttemptsOnFailure?: number;
}

export interface PlanLimitsSpecification {
  maxUsers: number;
  maxProducts: number;
  maxBranches: number;
  canUsePos: boolean;
  canUseAiAssistant: boolean;
  canUseMultipleRoles: boolean;
  canUseCreditAndDebts: boolean;
  canUseAdvancedReports: boolean;
  supportLevel: "standard" | "priority" | "direct";
}

export interface PlatformPlanLimitsConfig {
  inicio: PlanLimitsSpecification;
  crece: PlanLimitsSpecification;
  negocio: PlanLimitsSpecification;
}

export interface PlatformAuditConfig {
  retentionDays: 30 | 60 | 90 | 180 | 365;
  logAdminLogins: boolean;
  logTenantModifications: boolean;
  logBillingChanges: boolean;
  logSecurityPolicyChanges: boolean;
  minimumLogLevel: "debug" | "info" | "warn" | "error";
}

export interface PlatformFullConfig {
  general: PlatformGeneralConfig;
  seguridad: PlatformSecurityConfig;
  usuariosAcceso: PlatformUsersAccessConfig;
  facturacion: PlatformBillingConfig;
  planesLimites: PlatformPlanLimitsConfig;
  auditoria: PlatformAuditConfig;
  updatedAt?: string;
  updatedBy?: string;
}

export const NEGOVA_INSTITUTIONAL_PROFILE = {
  platformName: "NEGOVA",
  tagline: "Plataforma de Gestión y Administración",
  supportEmail: "leitec.info@gmail.com",
  billingSupportEmail: "leitec.info@gmail.com",
  notificationsSenderName: "NEGOVA",
  notificationsSenderEmail: "leitec.info@gmail.com",
  notificationsRecipientEmail: "leitec.info@gmail.com",
  holderType: "Persona Natural",
  fullName: "LEINER DAVID HOYOS CABRERA",
  documentType: "Cédula de Ciudadanía (CC)",
  documentNumber: "1006575798",
  taxId: "1006575798",
  verificationDigit: "9",
  fullNit: "1006575798-9",
  taxAddress: "CALLE 8 #7-105 CAMARONES, LA GUAJIRA",
  commercialAddress: "CALLE 8 #7-105 CAMARONES, LA GUAJIRA",
  taxRegime: "No responsable de IVA",
  taxStatus: "No responsable de IVA (0% - Sin cobro)",
  country: "Colombia (CO)",
  currency: "COP",
  timezone: "America/Bogota (UTC-5)",
} as const;

export const DEFAULT_PLATFORM_CONFIG: PlatformFullConfig = {
  general: {
    platformName: "NEGOVA",
    tagline: "Plataforma de Gestión y Administración",
    supportEmail: "leitec.info@gmail.com",
    billingSupportEmail: "leitec.info@gmail.com",
    holderType: "natural_person",
    naturalHolder: {
      documentType: "CC",
      documentNumber: "1006575798",
      fullName: "LEINER DAVID HOYOS CABRERA",
      taxId: "1006575798",
      verificationDigit: "9",
      taxAddress: "CALLE 8 #7-105 CAMARONES, LA GUAJIRA",
    },
    legalHolder: {
      legalName: "",
      taxId: "",
      verificationDigit: "",
      legalRepresentativeName: "",
      legalRepresentativeDocType: "CC",
      legalRepresentativeDocNumber: "",
      fiscalAddress: "",
    },
    taxRegime: "no_responsable_iva",
    taxStatus: "no_responsable_iva",
    commercialAddress: "CALLE 8 #7-105 CAMARONES, LA GUAJIRA",
    country: "Colombia (CO)",
    defaultCurrency: "COP",
    timezone: "America/Bogota (UTC-5)",
    maintenanceMode: false,
    allowNewRegistrations: true,
  },
  seguridad: {
    adminSession: {
      inactivityTimeoutMinutes: 60,
      maxSessionHours: 24,
      requireMfa: true,
      requireReauthForSensitive: true,
    },
    businessSession: {
      persistentSessionsEnabled: true,
      maxSessionDays: 30,
      inactivityTimeoutMinutes: null,
      requireReauthForSensitive: true,
      enforceImmediateRevocation: true,
    },
    minPasswordLength: 10,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: true,
    passwordExpirationDays: 90,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    rateLimitPerMinute: 60,
    sessionTimeoutMinutes: 60,
    requireMfaForStaff: true,
  },
  usuariosAcceso: {
    allowedRoles: ["super_admin", "staff", "auditor"],
    allowAdminInvitations: true,
    invitationExpiryHours: 48,
    whoCanInvite: "super_admin_only",
    defaultUserStatus: "active",
    enforceEmailVerification: true,
    accountActivationPolicy: "immediate",
    requireMfaForInternal: true,
    requireReauthForSensitive: true,
    inactivityTimeoutMinutes: 60,
    maxSessionHours: 24,
    allowAdminSelfRegistration: false,
  },
  facturacion: {
    paymentModel: "manual",
    platformDefaultCurrency: "COP",
    paymentGatewayStatus: "no_configurada",
    invoicePrefix: "NEG-",
    taxStatus: "no_configurado",
  },
  planesLimites: {
    inicio: {
      maxUsers: 1,
      maxProducts: 200,
      maxBranches: 1,
      canUsePos: true,
      canUseAiAssistant: false,
      canUseMultipleRoles: false,
      canUseCreditAndDebts: false,
      canUseAdvancedReports: false,
      supportLevel: "standard",
    },
    crece: {
      maxUsers: 3,
      maxProducts: 1000,
      maxBranches: 1,
      canUsePos: true,
      canUseAiAssistant: true,
      canUseMultipleRoles: false,
      canUseCreditAndDebts: true,
      canUseAdvancedReports: true,
      supportLevel: "priority",
    },
    negocio: {
      maxUsers: 6,
      maxProducts: 3000,
      maxBranches: 1,
      canUsePos: true,
      canUseAiAssistant: true,
      canUseMultipleRoles: true,
      canUseCreditAndDebts: true,
      canUseAdvancedReports: true,
      supportLevel: "direct",
    },
  },
  auditoria: {
    retentionDays: 90,
    logAdminLogins: true,
    logTenantModifications: true,
    logBillingChanges: true,
    logSecurityPolicyChanges: true,
    minimumLogLevel: "info",
  },
};

// ==========================================
// 2. DOMINIO: PERFIL PERSONAL (User Account)
// ==========================================

export interface UserPersonalProfileConfig {
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  preferredTheme: "light" | "dark" | "system";
  mfaEnabled: boolean;
  emailNotificationsActive: boolean;
}
