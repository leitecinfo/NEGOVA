-- Migración para ajustar la clave foránea de audit_logs hacia businesses
-- Cambiamos ON DELETE CASCADE por ON DELETE SET NULL para preservar el historial

DO $$
DECLARE
    fk_name text;
BEGIN
    -- Encontrar el nombre de la constraint de foreign key de audit_logs a businesses
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'public.audit_logs'::regclass
      AND confrelid = 'public.businesses'::regclass
      AND contype = 'f'
      LIMIT 1;
      
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.audit_logs DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

-- Agregar la constraint con ON DELETE SET NULL
ALTER TABLE public.audit_logs 
  ADD CONSTRAINT audit_logs_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE SET NULL;
