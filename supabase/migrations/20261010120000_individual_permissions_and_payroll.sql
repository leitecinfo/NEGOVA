-- ==============================================================================
-- NEGOVA SaaS — Migración: Permisos Individuales por Trabajador & Personal/Nómina
-- 1. Tabla de personalizaciones individuales de permisos: business_user_permissions
-- 2. Tablas de Personal y Trabajadores: business_employees
-- 3. Novedades Laborales: employee_novelties
-- 4. Períodos y Liquidaciones de Nómina: payroll_periods, payroll_receipts, payroll_items
-- 5. Compatibilidad incremental con expenses (columna category)
-- ==============================================================================

-- 1. Permisos Individuales por Usuario en Negocio (Overrides de RBAC)
-- Migración incremental y no destructiva: preserva datos existentes si la tabla ya existía
CREATE TABLE IF NOT EXISTS public.business_user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    permission_code TEXT NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT true, -- true: concedido explícitamente; false: denegado/revocado explícitamente
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Asegurar columnas si la tabla ya existía previamente con esquema legado
ALTER TABLE public.business_user_permissions 
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS permission_code TEXT,
    ADD COLUMN IF NOT EXISTS is_granted BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Migración segura de datos heredados sin pérdida de registros
DO $$
BEGIN
    -- Backfill de business_id y user_id si existía columna legada business_user_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'business_user_permissions' AND column_name = 'business_user_id'
    ) THEN
        UPDATE public.business_user_permissions bup
        SET business_id = bu.business_id,
            user_id = bu.user_id
        FROM public.business_users bu
        WHERE bup.business_user_id = bu.id
          AND (bup.business_id IS NULL OR bup.user_id IS NULL);
    END IF;

    -- Migrar permission_id a permission_code si existía previamente
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'business_user_permissions' AND column_name = 'permission_id'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'business_user_permissions' AND column_name = 'permission_code'
    ) THEN
        UPDATE public.business_user_permissions
        SET permission_code = permission_id::text
        WHERE permission_code IS NULL AND permission_id IS NOT NULL;
    END IF;

    -- Asegurar constraint de unicidad sin duplicados
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_business_user_permission'
    ) THEN
        ALTER TABLE public.business_user_permissions 
            ADD CONSTRAINT uq_business_user_permission UNIQUE (business_id, user_id, permission_code);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bu_permissions_lookup 
    ON public.business_user_permissions(business_id, user_id);
CREATE INDEX IF NOT EXISTS idx_bu_permissions_code 
    ON public.business_user_permissions(permission_code);

-- 2. Directorio de Personal y Trabajadores (Desacoplado de cuentas de usuario)
CREATE TABLE IF NOT EXISTS public.business_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE, -- NULL para personal de plataforma interna NEGOVA
    is_platform_employee BOOLEAN DEFAULT false,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Vinculación opcional con cuenta de usuario
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'CC', -- CC, CE, NIT, PASAPORTE, PEP, PPT, etc.
    document_number TEXT NOT NULL,
    birth_date DATE,
    email TEXT,
    phone TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    job_title TEXT NOT NULL,
    department TEXT,
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    contract_type TEXT NOT NULL DEFAULT 'indefinido', -- indefinido, fijo, obra_labor, prestacion_servicios, aprendizaje
    status TEXT NOT NULL DEFAULT 'active', -- active, inactive, on_leave, terminated
    compensation_type TEXT NOT NULL DEFAULT 'fixed_salary', -- fixed_salary, hourly, commission, daily
    base_salary NUMERIC NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
    pay_frequency TEXT NOT NULL DEFAULT 'monthly', -- monthly, biweekly, weekly, daily
    payment_method TEXT NOT NULL DEFAULT 'bank_transfer', -- bank_transfer, cash, nequi, daviplata, check
    bank_name TEXT,
    account_type TEXT, -- ahorros, corriente
    account_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Asegurar columnas si business_employees ya existía parcialmente
ALTER TABLE public.business_employees
    ADD COLUMN IF NOT EXISTS is_platform_employee BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS compensation_type TEXT NOT NULL DEFAULT 'fixed_salary',
    ADD COLUMN IF NOT EXISTS pay_frequency TEXT NOT NULL DEFAULT 'monthly',
    ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
    ADD COLUMN IF NOT EXISTS bank_name TEXT,
    ADD COLUMN IF NOT EXISTS account_type TEXT,
    ADD COLUMN IF NOT EXISTS account_number TEXT;

CREATE INDEX IF NOT EXISTS idx_employees_business_status 
    ON public.business_employees(business_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_platform 
    ON public.business_employees(is_platform_employee) WHERE is_platform_employee = true;
CREATE INDEX IF NOT EXISTS idx_employees_user_id 
    ON public.business_employees(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_document 
    ON public.business_employees(document_type, document_number);

-- 3. Novedades Laborales (Horas extra, bonos, deducciones, anticipos, incapacidades)
CREATE TABLE IF NOT EXISTS public.employee_novelties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE, -- NULL si es plataforma
    employee_id UUID NOT NULL REFERENCES public.business_employees(id) ON DELETE CASCADE,
    novelty_type TEXT NOT NULL, -- overtime, bonus, deduction, advance, unpaid_leave, sick_leave, salary_adjustment, other
    description TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, applied, cancelled
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_novelties_employee 
    ON public.employee_novelties(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_novelties_business_date 
    ON public.employee_novelties(business_id, start_date);

-- 4. Períodos de Nómina
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE, -- NULL si es nómina de plataforma NEGOVA
    name TEXT NOT NULL,
    period_type TEXT NOT NULL DEFAULT 'biweekly', -- monthly, biweekly, weekly, custom
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    payment_date DATE,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, calculated, approved, paid, closed, cancelled
    total_base NUMERIC NOT NULL DEFAULT 0,
    total_bonuses NUMERIC NOT NULL DEFAULT 0,
    total_deductions NUMERIC NOT NULL DEFAULT 0,
    total_net NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_business_status 
    ON public.payroll_periods(business_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates 
    ON public.payroll_periods(start_date, end_date);

-- 5. Comprobantes / Liquidaciones Individuales por Período
CREATE TABLE IF NOT EXISTS public.payroll_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.business_employees(id) ON DELETE RESTRICT,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    base_salary NUMERIC NOT NULL DEFAULT 0,
    bonuses_amount NUMERIC NOT NULL DEFAULT 0,
    deductions_amount NUMERIC NOT NULL DEFAULT 0,
    advances_amount NUMERIC NOT NULL DEFAULT 0,
    net_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
    paid_at TIMESTAMPTZ,
    payment_method TEXT,
    payment_reference TEXT,
    expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL, -- Vínculo con egreso de negocio
    platform_expense_id UUID REFERENCES public.platform_expenses(id) ON DELETE SET NULL, -- Vínculo con egreso de plataforma
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_period_employee UNIQUE (period_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_receipts_period 
    ON public.payroll_receipts(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_receipts_employee 
    ON public.payroll_receipts(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_receipts_expense 
    ON public.payroll_receipts(expense_id);
CREATE INDEX IF NOT EXISTS idx_payroll_receipts_platform_expense 
    ON public.payroll_receipts(platform_expense_id);

-- 6. Desglose de Conceptos por Comprobante
CREATE TABLE IF NOT EXISTS public.payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES public.payroll_receipts(id) ON DELETE CASCADE,
    concept_type TEXT NOT NULL, -- base_salary, overtime, bonus, transport_allowance, commission, deduction, advance, other
    concept_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    is_deduction BOOLEAN NOT NULL DEFAULT false,
    novelty_id UUID REFERENCES public.employee_novelties(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_receipt 
    ON public.payroll_items(receipt_id);

-- 7. Compatibilidad con Egresos Financieros de Negocio
-- Asegura que public.expenses admita categorización para egresos de nómina
ALTER TABLE public.expenses 
    ADD COLUMN IF NOT EXISTS category TEXT;

-- 8. Habilitar Seguridad RLS
ALTER TABLE public.business_user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_novelties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

-- 9. Políticas RLS: Acceso Total para Service Role (Server Actions y Procesos del Sistema)
DROP POLICY IF EXISTS "service_role_all_bu_permissions" ON public.business_user_permissions;
CREATE POLICY "service_role_all_bu_permissions" ON public.business_user_permissions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_employees" ON public.business_employees;
CREATE POLICY "service_role_all_employees" ON public.business_employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_novelties" ON public.employee_novelties;
CREATE POLICY "service_role_all_novelties" ON public.employee_novelties FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_payroll_periods" ON public.payroll_periods;
CREATE POLICY "service_role_all_payroll_periods" ON public.payroll_periods FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_payroll_receipts" ON public.payroll_receipts;
CREATE POLICY "service_role_all_payroll_receipts" ON public.payroll_receipts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_payroll_items" ON public.payroll_items;
CREATE POLICY "service_role_all_payroll_items" ON public.payroll_items FOR ALL USING (true) WITH CHECK (true);

-- 10. Políticas RLS para Usuarios Autenticados (Aislamiento Multi-Tenant y Protección de Plataforma)

-- A. Lectura de permisos individuales de usuario
DROP POLICY IF EXISTS "tenant_bu_permissions_read" ON public.business_user_permissions;
CREATE POLICY "tenant_bu_permissions_read" ON public.business_user_permissions
    FOR SELECT TO authenticated
    USING (
        -- Colaborador del negocio con membresía activa
        business_id IN (
            SELECT bu.business_id FROM public.business_users bu
            WHERE bu.user_id = auth.uid() AND bu.status = 'active'
        )
        OR
        -- Personal de plataforma (super_admin / admin)
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
              AND (u.platform_role::text IN ('super_admin', 'admin') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin'))
        )
    );

-- B. Escritura en permisos: Solo el Dueño (owner) del comercio o Administrador de Plataforma
-- Prohíbe terminantemente que auxiliares se concedan permisos o modifiquen a terceros
DROP POLICY IF EXISTS "owner_bu_permissions_write" ON public.business_user_permissions;
CREATE POLICY "owner_bu_permissions_write" ON public.business_user_permissions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            JOIN public.roles r ON r.id = bu.role_id
            WHERE bu.user_id = auth.uid() 
              AND bu.business_id = business_user_permissions.business_id
              AND bu.status = 'active'
              AND r.code = 'owner'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
              AND (u.platform_role::text IN ('super_admin', 'admin') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin'))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            JOIN public.roles r ON r.id = bu.role_id
            WHERE bu.user_id = auth.uid() 
              AND bu.business_id = business_user_permissions.business_id
              AND bu.status = 'active'
              AND r.code = 'owner'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
              AND (u.platform_role::text IN ('super_admin', 'admin') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin'))
        )
    );

-- C. Directorio de Personal
DROP POLICY IF EXISTS "tenant_employees_read" ON public.business_employees;
CREATE POLICY "tenant_employees_read" ON public.business_employees
    FOR SELECT TO authenticated
    USING (
        -- Personal de un comercio: solo visible para miembros activos de ese comercio
        (
            business_id IS NOT NULL 
            AND business_id IN (
                SELECT bu.business_id FROM public.business_users bu
                WHERE bu.user_id = auth.uid() AND bu.status = 'active'
            )
        )
        OR
        -- Personal interno de NEGOBANK (business_id IS NULL) o auditoría: solo super_admin y admin
        (
            EXISTS (
                SELECT 1 FROM public.users u 
                WHERE u.id = auth.uid() 
                  AND (u.platform_role::text IN ('super_admin', 'admin') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin'))
            )
        )
    );

-- D. Períodos de Nómina
DROP POLICY IF EXISTS "tenant_payroll_periods_read" ON public.payroll_periods;
CREATE POLICY "tenant_payroll_periods_read" ON public.payroll_periods
    FOR SELECT TO authenticated
    USING (
        (
            business_id IS NOT NULL 
            AND business_id IN (
                SELECT bu.business_id FROM public.business_users bu
                WHERE bu.user_id = auth.uid() AND bu.status = 'active'
            )
        )
        OR
        (
            EXISTS (
                SELECT 1 FROM public.users u 
                WHERE u.id = auth.uid() 
                  AND (u.platform_role::text IN ('super_admin', 'admin') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin'))
            )
        )
    );

-- E. Comprobantes de Nómina
DROP POLICY IF EXISTS "tenant_payroll_receipts_read" ON public.payroll_receipts;
CREATE POLICY "tenant_payroll_receipts_read" ON public.payroll_receipts
    FOR SELECT TO authenticated
    USING (
        (
            business_id IS NOT NULL 
            AND business_id IN (
                SELECT bu.business_id FROM public.business_users bu
                WHERE bu.user_id = auth.uid() AND bu.status = 'active'
            )
        )
        OR
        (
            EXISTS (
                SELECT 1 FROM public.users u 
                WHERE u.id = auth.uid() 
                  AND (u.platform_role::text IN ('super_admin', 'admin') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin'))
            )
        )
    );

-- F. Novedades Laborales
DROP POLICY IF EXISTS "tenant_novelties_read" ON public.employee_novelties;
CREATE POLICY "tenant_novelties_read" ON public.employee_novelties
    FOR SELECT TO authenticated
    USING (
        (
            business_id IS NOT NULL 
            AND business_id IN (
                SELECT bu.business_id FROM public.business_users bu
                WHERE bu.user_id = auth.uid() AND bu.status = 'active'
            )
        )
        OR
        (
            EXISTS (
                SELECT 1 FROM public.users u 
                WHERE u.id = auth.uid() 
                  AND (u.platform_role::text IN ('super_admin', 'admin') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin'))
            )
        )
    );

-- G. Desglose de Conceptos de Nómina
DROP POLICY IF EXISTS "tenant_payroll_items_read" ON public.payroll_items;
CREATE POLICY "tenant_payroll_items_read" ON public.payroll_items
    FOR SELECT TO authenticated
    USING (
        receipt_id IN (
            SELECT pr.id FROM public.payroll_receipts pr
            WHERE (
                pr.business_id IS NOT NULL 
                AND pr.business_id IN (
                    SELECT bu.business_id FROM public.business_users bu
                    WHERE bu.user_id = auth.uid() AND bu.status = 'active'
                )
            )
        )
        OR
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
              AND (u.platform_role::text IN ('super_admin', 'admin') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin'))
        )
    );
