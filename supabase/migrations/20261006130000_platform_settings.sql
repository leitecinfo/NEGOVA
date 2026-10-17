-- ==============================================================================
-- NEGOVA SaaS - Migración: Configuración Global de la Plataforma (Platform Settings)
-- Tabla: public.platform_settings
-- ==============================================================================

-- 1. Crear tabla platform_settings si no existe
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índice para búsquedas rápidas por clave
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON public.platform_settings (key);

-- 3. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER tr_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION update_platform_settings_updated_at();

-- 4. Habilitar RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 5. Eliminar políticas previas si existían
DROP POLICY IF EXISTS "Permitir lectura de configuracion a administradores" ON public.platform_settings;
DROP POLICY IF EXISTS "Permitir escritura de configuracion a super_admin" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_read" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_write" ON public.platform_settings;

-- 6. Políticas de Acceso:
-- A. Lectura permitida a usuarios autenticados
CREATE POLICY "platform_settings_read"
ON public.platform_settings FOR SELECT
TO authenticated
USING (true);

-- B. Escritura (INSERT/UPDATE/DELETE) permitida a super_admin
CREATE POLICY "platform_settings_write"
ON public.platform_settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.platform_role = 'super_admin'
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.platform_role = 'super_admin'
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
);

-- 7. Semilla inicial para core_config si no existe
INSERT INTO public.platform_settings (key, value, description)
VALUES (
    'core_config',
    '{
      "general": {
        "platformName": "NEGOVA",
        "tagline": "Plataforma de Gestión y Administración",
        "supportEmail": "leitec.info@gmail.com",
        "billingSupportEmail": "leitec.info@gmail.com",
        "holderType": "natural_person",
        "naturalHolder": {
          "documentType": "CC",
          "documentNumber": "1006575798",
          "fullName": "LEINER DAVID HOYOS CABRERA",
          "taxId": "1006575798",
          "verificationDigit": "9",
          "taxAddress": "CALLE 8 #7-105 CAMARONES, LA GUAJIRA"
        },
        "legalHolder": {
          "legalName": "",
          "taxId": "",
          "verificationDigit": "",
          "legalRepresentativeName": "",
          "legalRepresentativeDocType": "CC",
          "legalRepresentativeDocNumber": "",
          "fiscalAddress": ""
        },
        "taxRegime": "no_responsable_iva",
        "taxStatus": "no_responsable_iva",
        "commercialAddress": "CALLE 8 #7-105 CAMARONES, LA GUAJIRA",
        "country": "Colombia (CO)",
        "defaultCurrency": "COP",
        "timezone": "America/Bogota (UTC-5)",
        "maintenanceMode": false,
        "allowNewRegistrations": true
      },
      "seguridad": {
        "adminSession": {
          "inactivityTimeoutMinutes": 60,
          "maxSessionHours": 24,
          "requireMfa": true,
          "requireReauthForSensitive": true
        },
        "businessSession": {
          "persistentSessionsEnabled": true,
          "maxSessionDays": 30,
          "inactivityTimeoutMinutes": null,
          "requireReauthForSensitive": true,
          "enforceImmediateRevocation": true
        },
        "minPasswordLength": 10,
        "requireUppercase": true,
        "requireNumbers": true,
        "requireSymbols": true,
        "passwordExpirationDays": 90,
        "maxLoginAttempts": 5,
        "lockoutDurationMinutes": 15,
        "rateLimitPerMinute": 60,
        "sessionTimeoutMinutes": 60,
        "requireMfaForStaff": true
      },
      "usuariosAcceso": {
        "allowedRoles": ["super_admin", "staff", "auditor"],
        "allowAdminInvitations": true,
        "invitationExpiryHours": 48,
        "whoCanInvite": "super_admin_only",
        "defaultUserStatus": "active",
        "enforceEmailVerification": true,
        "accountActivationPolicy": "immediate",
        "requireMfaForInternal": true,
        "requireReauthForSensitive": true,
        "inactivityTimeoutMinutes": 60,
        "maxSessionHours": 24,
        "allowAdminSelfRegistration": false
      },
      "facturacion": {
        "paymentModel": "manual",
        "platformDefaultCurrency": "COP",
        "paymentGatewayStatus": "no_configurada",
        "invoicePrefix": "NEG-",
        "taxStatus": "no_configurado"
      },
      "planesLimites": {
        "inicio": {
          "maxUsers": 2,
          "maxProducts": 200,
          "maxBranches": 1,
          "canUsePos": true,
          "canUseAiAssistant": false,
          "canUseMultipleRoles": false,
          "canUseCreditAndDebts": false,
          "canUseAdvancedReports": false,
          "supportLevel": "standard"
        },
        "crece": {
          "maxUsers": 3,
          "maxProducts": 1000,
          "maxBranches": 1,
          "canUsePos": true,
          "canUseAiAssistant": true,
          "canUseMultipleRoles": false,
          "canUseCreditAndDebts": true,
          "canUseAdvancedReports": true,
          "supportLevel": "priority"
        },
        "negocio": {
          "maxUsers": 6,
          "maxProducts": 3000,
          "maxBranches": 1,
          "canUsePos": true,
          "canUseAiAssistant": true,
          "canUseMultipleRoles": true,
          "canUseCreditAndDebts": true,
          "canUseAdvancedReports": true,
          "supportLevel": "direct"
        }
      },
      "auditoria": {
        "retentionDays": 90,
        "logAdminLogins": true,
        "logTenantModifications": true,
        "logBillingChanges": true,
        "logSecurityPolicyChanges": true,
        "minimumLogLevel": "info"
      }
    }'::jsonb,
    'Configuración global inicial de la plataforma NEGOVA'
)
ON CONFLICT (key) DO NOTHING;
