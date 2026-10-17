CREATE TABLE public.platform_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  concept text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  expense_date timestamp with time zone NOT NULL DEFAULT now(),
  reference text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_expenses_category ON public.platform_expenses(category);
CREATE INDEX idx_platform_expenses_date ON public.platform_expenses(expense_date);

DO $$
DECLARE
    expenses_json jsonb;
    exp jsonb;
    cat text;
    conc text;
    amt numeric;
    dt timestamp with time zone;
    ref text;
BEGIN
    -- Verificar si la tabla public.platform_settings existe antes de intentar leerla
    IF to_regclass('public.platform_settings') IS NOT NULL THEN
        -- Ejecutar la consulta dinámicamente para evitar errores en tiempo de compilación del bloque DO
        EXECUTE 'SELECT value FROM public.platform_settings WHERE key = ''platform:expenses''' INTO expenses_json;

        IF expenses_json IS NOT NULL THEN
            FOR exp IN SELECT * FROM jsonb_array_elements(expenses_json)
            LOOP
                cat := exp->>'category';
                conc := exp->>'concept';
                amt := (exp->>'amount')::numeric;
                dt := (exp->>'date')::timestamp with time zone;
                ref := exp->>'receiptReference';

                INSERT INTO public.platform_expenses (category, concept, amount, expense_date, reference)
                VALUES (cat, conc, amt, dt, ref);
            END LOOP;
        END IF;
    END IF;
END $$;
