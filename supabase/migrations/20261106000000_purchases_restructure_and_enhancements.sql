-- ==============================================================================
-- NEGOVA SaaS - Migración: Reestructuración Integral del Módulo de Compras (Tarea 6)
-- Agrega soporte de conversión de unidades, tipos de documentos, descuentos,
-- retenciones fiscales, trazabilidad de anulación y metadatos operativos.
-- ==============================================================================

-- 1. Ampliación de la tabla de compras (purchases)
ALTER TABLE public.purchases
    ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'factura',
    ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    ADD COLUMN IF NOT EXISTS retention_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (retention_amount >= 0),
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Índices de optimización para consultas y filtros
CREATE INDEX IF NOT EXISTS idx_purchases_due_date ON public.purchases(business_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_document_type ON public.purchases(business_id, document_type);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_type ON public.purchases(business_id, payment_type);

-- 2. Ampliación de la tabla de ítems de compra (purchase_items)
ALTER TABLE public.purchase_items
    ADD COLUMN IF NOT EXISTS purchase_unit TEXT,
    ADD COLUMN IF NOT EXISTS inventory_unit TEXT,
    ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC(15,4) DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS inventory_quantity NUMERIC(15,4),
    ADD COLUMN IF NOT EXISTS discount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_purchase_items_units ON public.purchase_items(business_id, purchase_unit);

-- 3. Ampliación de la tabla de cuentas por pagar (accounts_payable)
ALTER TABLE public.accounts_payable
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. Comentarios explicativos de auditoría
COMMENT ON COLUMN public.purchases.document_type IS 'Tipo de comprobante comercial: factura, remision, cuenta_cobro, ticket, etc.';
COMMENT ON COLUMN public.purchases.retention_amount IS 'Valor retenido de Retefuente u otras retenciones fiscales aplicadas.';
COMMENT ON COLUMN public.purchases.discount_amount IS 'Descuento comercial global aplicado al total antes o después de impuestos.';
COMMENT ON COLUMN public.purchase_items.conversion_factor IS 'Factor multiplicador para convertir la cantidad comprada a la unidad base de inventario (ej: 1 kg -> 1000 g: factor 1000).';
COMMENT ON COLUMN public.purchase_items.inventory_quantity IS 'Cantidad normalizada neta que ingresa físicamente al Kardex central de inventario.';

