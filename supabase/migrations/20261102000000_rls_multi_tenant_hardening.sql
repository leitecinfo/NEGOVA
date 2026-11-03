-- ==============================================================================
-- NEGOVA SaaS - Migración Correctiva: Endurecimiento RLS y Aislamiento Multi-Tenant
-- Tarea: [TEST-002]
-- Archivo: supabase/migrations/20261102000000_rls_multi_tenant_hardening.sql
-- Fecha: 2026-11-02
--
-- Objetivos de Seguridad y Aislamiento:
-- 1. Garantizar que todas las tablas con 'business_id' tengan RLS habilitado.
-- 2. Corregir cualquier política permisiva heredada eliminando claúsulas sin 'TO service_role'.
-- 3. Proteger 'business_sale_documents', 'customers', 'customer_addresses' y 'business_users'
--    para que los clientes autenticados SOLO puedan leer y modificar datos de su propio comercio.
-- 4. Optimizar las comprobaciones con '(SELECT auth.uid())' para prevenir re-evaluaciones por fila.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLA: business_sale_documents
-- ------------------------------------------------------------------------------
ALTER TABLE public.business_sale_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_business_sale_documents" ON public.business_sale_documents;
CREATE POLICY "service_role_all_business_sale_documents" ON public.business_sale_documents
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_sale_documents_read" ON public.business_sale_documents;
CREATE POLICY "tenant_sale_documents_read" ON public.business_sale_documents
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = business_sale_documents.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_sale_documents_write" ON public.business_sale_documents;
CREATE POLICY "tenant_sale_documents_write" ON public.business_sale_documents
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = business_sale_documents.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = business_sale_documents.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

-- ------------------------------------------------------------------------------
-- 2. TABLA: customers
-- ------------------------------------------------------------------------------
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_customers" ON public.customers;
CREATE POLICY "service_role_all_customers" ON public.customers
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_customers_read" ON public.customers;
CREATE POLICY "tenant_customers_read" ON public.customers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = customers.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_customers_write" ON public.customers;
CREATE POLICY "tenant_customers_write" ON public.customers
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = customers.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = customers.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

-- ------------------------------------------------------------------------------
-- 3. TABLA: customer_addresses
-- ------------------------------------------------------------------------------
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_customer_addresses" ON public.customer_addresses;
CREATE POLICY "service_role_all_customer_addresses" ON public.customer_addresses
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_customer_addresses_read" ON public.customer_addresses;
CREATE POLICY "tenant_customer_addresses_read" ON public.customer_addresses
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = customer_addresses.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_customer_addresses_write" ON public.customer_addresses;
CREATE POLICY "tenant_customer_addresses_write" ON public.customer_addresses
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = customer_addresses.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = customer_addresses.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

-- ------------------------------------------------------------------------------
-- 4. TABLA: business_users
-- ------------------------------------------------------------------------------
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_business_users" ON public.business_users;
CREATE POLICY "service_role_all_business_users" ON public.business_users
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_business_users_read" ON public.business_users;
CREATE POLICY "tenant_business_users_read" ON public.business_users
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = business_users.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

-- ------------------------------------------------------------------------------
-- 5. TABLA: business_document_configs & business_document_sequences
-- ------------------------------------------------------------------------------
ALTER TABLE public.business_document_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_business_document_configs" ON public.business_document_configs;
CREATE POLICY "service_role_all_business_document_configs" ON public.business_document_configs
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_document_configs_read" ON public.business_document_configs;
CREATE POLICY "tenant_document_configs_read" ON public.business_document_configs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = business_document_configs.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

ALTER TABLE public.business_document_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_business_document_sequences" ON public.business_document_sequences;
CREATE POLICY "service_role_all_business_document_sequences" ON public.business_document_sequences
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_document_sequences_read" ON public.business_document_sequences;
CREATE POLICY "tenant_document_sequences_read" ON public.business_document_sequences
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = business_document_sequences.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

-- ------------------------------------------------------------------------------
-- 6. TABLA: support_conversations, support_chat_messages, support_tickets, support_interactions
-- ------------------------------------------------------------------------------
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_support_conversations" ON public.support_conversations;
CREATE POLICY "service_role_all_support_conversations" ON public.support_conversations
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_support_conversations_read" ON public.support_conversations;
CREATE POLICY "tenant_support_conversations_read" ON public.support_conversations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = support_conversations.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_support_chat_messages" ON public.support_chat_messages;
CREATE POLICY "service_role_all_support_chat_messages" ON public.support_chat_messages
    TO service_role
    USING (true)
    WITH CHECK (true);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_support_tickets" ON public.support_tickets;
CREATE POLICY "service_role_all_support_tickets" ON public.support_tickets
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_support_tickets_read" ON public.support_tickets;
CREATE POLICY "tenant_support_tickets_read" ON public.support_tickets
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = support_tickets.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

ALTER TABLE public.support_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_support_interactions" ON public.support_interactions;
CREATE POLICY "service_role_all_support_interactions" ON public.support_interactions
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 7. TABLA: platform_expenses, platform_invoices, platform_notifications
-- ------------------------------------------------------------------------------
ALTER TABLE public.platform_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_platform_expenses" ON public.platform_expenses;
CREATE POLICY "service_role_all_platform_expenses" ON public.platform_expenses
    TO service_role
    USING (true)
    WITH CHECK (true);

ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_platform_invoices" ON public.platform_invoices;
CREATE POLICY "service_role_all_platform_invoices" ON public.platform_invoices
    TO service_role
    USING (true)
    WITH CHECK (true);

ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_platform_notifications" ON public.platform_notifications;
CREATE POLICY "service_role_all_platform_notifications" ON public.platform_notifications
    TO service_role
    USING (true)
    WITH CHECK (true);

