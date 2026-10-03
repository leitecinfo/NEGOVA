-- ==============================================================================
-- NEGOVA MVP - Script 05: Funciones y Triggers Automatizados
-- Motor: PostgreSQL 15+ / Supabase
-- ==============================================================================

-- 1. Función para actualizar automáticamente el campo updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de actualización de timestamps
DROP TRIGGER IF EXISTS tr_businesses_updated_at ON public.businesses;
CREATE TRIGGER tr_businesses_updated_at
BEFORE UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_users_updated_at ON public.users;
CREATE TRIGGER tr_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_business_users_updated_at ON public.business_users;
CREATE TRIGGER tr_business_users_updated_at
BEFORE UPDATE ON public.business_users
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_customers_updated_at ON public.customers;
CREATE TRIGGER tr_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_categories_updated_at ON public.categories;
CREATE TRIGGER tr_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_products_updated_at ON public.products;
CREATE TRIGGER tr_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_orders_updated_at ON public.orders;
CREATE TRIGGER tr_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER tr_deliveries_updated_at
BEFORE UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_expenses_updated_at ON public.expenses;
CREATE TRIGGER tr_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 2. Función y Trigger de Auditoría Automática de Estados de Pedido
CREATE OR REPLACE FUNCTION public.handle_order_status_audit()
RETURNS TRIGGER AS $$
BEGIN
    -- Al insertar un nuevo pedido o actualizar el estado existente
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.order_status_history (
            order_id,
            from_status,
            to_status,
            changed_by,
            created_at
        ) VALUES (
            NEW.id,
            NULL,
            NEW.status,
            auth.uid(), -- ID del usuario autenticado si aplica
            now()
        );
    ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.order_status_history (
            order_id,
            from_status,
            to_status,
            changed_by,
            created_at
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            auth.uid(),
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_orders_status_audit ON public.orders;
CREATE TRIGGER tr_orders_status_audit
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_status_audit();


-- 3. Función para Asignar Automáticamente el Consecutivo order_number
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = 0 THEN
        SELECT COALESCE(MAX(order_number), 0) + 1 
        INTO next_num 
        FROM public.orders 
        WHERE business_id = NEW.business_id;
        
        NEW.order_number = next_num;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_orders_assign_number ON public.orders;
CREATE TRIGGER tr_orders_assign_number
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();
