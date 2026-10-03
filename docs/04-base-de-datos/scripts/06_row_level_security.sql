-- ==============================================================================
-- NEGOVA MVP - Script 06: Políticas de Seguridad Row-Level Security (RLS)
-- Motor: PostgreSQL 15+ / Supabase
-- ==============================================================================

-- 1. Habilitar RLS en todas las tablas
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- 2. Función auxiliar de verificación de membresía activa
CREATE OR REPLACE FUNCTION public.is_member_of(p_business_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.business_users 
        WHERE business_id = p_business_id 
          AND user_id = auth.uid() 
          AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Función auxiliar para verificar si el usuario autenticado es PROPIETARIO
CREATE OR REPLACE FUNCTION public.is_owner_of(p_business_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.business_users bu
        JOIN public.roles r ON r.id = bu.role_id
        WHERE bu.business_id = p_business_id 
          AND bu.user_id = auth.uid() 
          AND bu.status = 'ACTIVE'
          AND r.name = 'PROPIETARIO'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ==============================================================================
-- 4. POLÍTICAS PARA USUARIOS Y ROLES
-- ==============================================================================

-- USERS: Ver y editar perfil propio
DROP POLICY IF EXISTS "users_own_profile" ON public.users;
CREATE POLICY "users_own_profile" ON public.users
FOR ALL TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- BUSINESS_USERS: Los miembros de un negocio pueden ver su equipo
DROP POLICY IF EXISTS "business_users_member_view" ON public.business_users;
CREATE POLICY "business_users_member_view" ON public.business_users
FOR SELECT TO authenticated
USING (public.is_member_of(business_id));

-- BUSINESS_USERS: Solo propietarios pueden administrar membresías
DROP POLICY IF EXISTS "business_users_owner_manage" ON public.business_users;
CREATE POLICY "business_users_owner_manage" ON public.business_users
FOR ALL TO authenticated
USING (public.is_owner_of(business_id))
WITH CHECK (public.is_owner_of(business_id));

-- ROLES Y PERMISOS: Lectura para usuarios autenticados
DROP POLICY IF EXISTS "roles_read_auth" ON public.roles;
CREATE POLICY "roles_read_auth" ON public.roles
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "permissions_read_auth" ON public.permissions;
CREATE POLICY "permissions_read_auth" ON public.permissions
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_permissions_read_auth" ON public.role_permissions;
CREATE POLICY "role_permissions_read_auth" ON public.role_permissions
FOR SELECT TO authenticated USING (true);


-- ==============================================================================
-- 5. POLÍTICAS PARA EL NEGOCIO (BUSINESSES)
-- ==============================================================================

-- Acceso administrativo para miembros
DROP POLICY IF EXISTS "businesses_member_access" ON public.businesses;
CREATE POLICY "businesses_member_access" ON public.businesses
FOR ALL TO authenticated
USING (public.is_member_of(id))
WITH CHECK (public.is_owner_of(id));

-- Acceso público al perfil comercial (Para Menú Digital)
DROP POLICY IF EXISTS "businesses_public_read" ON public.businesses;
CREATE POLICY "businesses_public_read" ON public.businesses
FOR SELECT TO anon, authenticated
USING (status = 'ACTIVE');


-- ==============================================================================
-- 6. POLÍTICAS PARA CATÁLOGO (CATEGORIES & PRODUCTS)
-- ==============================================================================

-- CATEGORIES: Miembros administran, público consulta activas
DROP POLICY IF EXISTS "categories_member_all" ON public.categories;
CREATE POLICY "categories_member_all" ON public.categories
FOR ALL TO authenticated
USING (public.is_member_of(business_id))
WITH CHECK (public.is_member_of(business_id));

DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read" ON public.categories
FOR SELECT TO anon, authenticated
USING (status = 'ACTIVE');

-- PRODUCTS: Miembros administran, público consulta disponibles
DROP POLICY IF EXISTS "products_member_all" ON public.products;
CREATE POLICY "products_member_all" ON public.products
FOR ALL TO authenticated
USING (public.is_member_of(business_id))
WITH CHECK (public.is_member_of(business_id));

DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
FOR SELECT TO anon, authenticated
USING (is_available = true);


-- ==============================================================================
-- 7. POLÍTICAS PARA CLIENTES (CUSTOMERS)
-- ==============================================================================

DROP POLICY IF EXISTS "customers_member_all" ON public.customers;
CREATE POLICY "customers_member_all" ON public.customers
FOR ALL TO authenticated
USING (public.is_member_of(business_id))
WITH CHECK (public.is_member_of(business_id));


-- ==============================================================================
-- 8. POLÍTICAS PARA PEDIDOS, ÍTEMS, PAGOS Y DOMICILIOS
-- ==============================================================================

-- ORDERS: Miembros tienen acceso total
DROP POLICY IF EXISTS "orders_member_all" ON public.orders;
CREATE POLICY "orders_member_all" ON public.orders
FOR ALL TO authenticated
USING (public.is_member_of(business_id))
WITH CHECK (public.is_member_of(business_id));

-- ORDERS: Público puede crear nuevos pedidos (Checkout del Menú Digital)
DROP POLICY IF EXISTS "orders_anon_insert" ON public.orders;
CREATE POLICY "orders_anon_insert" ON public.orders
FOR INSERT TO anon
WITH CHECK (status = 'RECEIVED');

-- ORDER_ITEMS: Miembros gestionan, público inserta en su pedido
DROP POLICY IF EXISTS "order_items_member_all" ON public.order_items;
CREATE POLICY "order_items_member_all" ON public.order_items
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.is_member_of(o.business_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.is_member_of(o.business_id)));

DROP POLICY IF EXISTS "order_items_anon_insert" ON public.order_items;
CREATE POLICY "order_items_anon_insert" ON public.order_items
FOR INSERT TO anon
WITH CHECK (true);

-- PAYMENTS: Solo miembros autorizados gestionan cobros
DROP POLICY IF EXISTS "payments_member_all" ON public.payments;
CREATE POLICY "payments_member_all" ON public.payments
FOR ALL TO authenticated
USING (public.is_member_of(business_id))
WITH CHECK (public.is_member_of(business_id));

-- DELIVERIES: Miembros gestionan, público inserta al pedir a domicilio
DROP POLICY IF EXISTS "deliveries_member_all" ON public.deliveries;
CREATE POLICY "deliveries_member_all" ON public.deliveries
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = deliveries.order_id AND public.is_member_of(o.business_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = deliveries.order_id AND public.is_member_of(o.business_id)));

DROP POLICY IF EXISTS "deliveries_anon_insert" ON public.deliveries;
CREATE POLICY "deliveries_anon_insert" ON public.deliveries
FOR INSERT TO anon
WITH CHECK (true);

-- ORDER_STATUS_HISTORY: Lectura para miembros
DROP POLICY IF EXISTS "order_status_history_member_read" ON public.order_status_history;
CREATE POLICY "order_status_history_member_read" ON public.order_status_history
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND public.is_member_of(o.business_id)));


-- ==============================================================================
-- 9. POLÍTICAS PARA GASTOS (EXPENSES)
-- ==============================================================================

DROP POLICY IF EXISTS "expenses_member_all" ON public.expenses;
CREATE POLICY "expenses_member_all" ON public.expenses
FOR ALL TO authenticated
USING (public.is_member_of(business_id))
WITH CHECK (public.is_member_of(business_id));
