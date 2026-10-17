-- ==============================================================================
-- NEGOVA SaaS - Migración: Secuencias y Correlativos Atómicos de Documentos de Venta
-- Tabla: public.business_document_sequences
-- Función: public.get_next_business_document_number
-- ==============================================================================

-- 1. Crear tabla de secuencias por negocio y año si no existe
CREATE TABLE IF NOT EXISTS public.business_document_sequences (
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0 CHECK (current_number >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (business_id, year)
);

-- 2. Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_bds_business_year ON public.business_document_sequences(business_id, year);

-- 3. Habilitar RLS
ALTER TABLE public.business_document_sequences ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acceso (service role tiene acceso total)
DROP POLICY IF EXISTS "service_role_all_business_document_sequences" ON public.business_document_sequences;
CREATE POLICY "service_role_all_business_document_sequences" 
ON public.business_document_sequences 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 5. Inicializar la tabla de secuencias con el máximo número existente en business_sale_documents
-- para no reiniciar el correlativo de negocios que ya tienen documentos emitidos
INSERT INTO public.business_document_sequences (business_id, year, current_number, updated_at)
SELECT 
    b.id AS business_id,
    COALESCE(
        EXTRACT(YEAR FROM bsd.issued_at)::INTEGER, 
        EXTRACT(YEAR FROM now())::INTEGER
    ) AS year,
    COALESCE(MAX(
        CASE 
            WHEN bsd.document_number ~ '^DOC-[0-9]{4}-[0-9]+$' 
            THEN (regexp_replace(bsd.document_number, '^DOC-[0-9]{4}-', ''))::INTEGER
            ELSE 0 
        END
    ), 0) AS current_number,
    now() AS updated_at
FROM public.businesses b
LEFT JOIN public.business_sale_documents bsd ON bsd.business_id = b.id
GROUP BY b.id, COALESCE(EXTRACT(YEAR FROM bsd.issued_at)::INTEGER, EXTRACT(YEAR FROM now())::INTEGER)
ON CONFLICT (business_id, year) 
DO UPDATE SET 
    current_number = GREATEST(public.business_document_sequences.current_number, EXCLUDED.current_number),
    updated_at = now();

-- 6. Función RPC atómica para obtener el siguiente número de documento con bloqueo seguro
CREATE OR REPLACE FUNCTION public.get_next_business_document_number(
    p_business_id UUID,
    p_year INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_val INTEGER;
    v_max_existing INTEGER := 0;
    v_doc_number TEXT;
BEGIN
    -- Asegurar existencia de fila para el negocio y año
    IF NOT EXISTS (
        SELECT 1 FROM public.business_document_sequences 
        WHERE business_id = p_business_id AND year = p_year
    ) THEN
        -- Extraer el número más alto existente en business_sale_documents para ese negocio y año
        SELECT COALESCE(MAX(
            CASE 
                WHEN document_number ~ ('^DOC-' || p_year::TEXT || '-[0-9]+$') 
                THEN (regexp_replace(document_number, '^DOC-' || p_year::TEXT || '-', ''))::INTEGER
                ELSE 0 
            END
        ), 0)
        INTO v_max_existing
        FROM public.business_sale_documents
        WHERE business_id = p_business_id;

        INSERT INTO public.business_document_sequences (business_id, year, current_number, updated_at)
        VALUES (p_business_id, p_year, v_max_existing, now())
        ON CONFLICT (business_id, year) DO NOTHING;
    END IF;

    -- Incrementar y bloquear atómicamente la secuencia
    UPDATE public.business_document_sequences
    SET current_number = current_number + 1,
        updated_at = now()
    WHERE business_id = p_business_id AND year = p_year
    RETURNING current_number INTO v_next_val;

    -- Formatear con padding de 4 dígitos: DOC-YYYY-NNNN
    v_doc_number := 'DOC-' || p_year::TEXT || '-' || lpad(v_next_val::TEXT, 4, '0');
    RETURN v_doc_number;
END;
$$;

-- 7. Asegurar la restricción UNIQUE en business_sale_documents
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'business_sale_documents_business_id_document_number_key'
    ) THEN
        ALTER TABLE public.business_sale_documents 
        ADD CONSTRAINT business_sale_documents_business_id_document_number_key 
        UNIQUE (business_id, document_number);
    END IF;
END $$;
