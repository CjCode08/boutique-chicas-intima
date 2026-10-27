ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS wholesale_price_usd NUMERIC(10, 2);

COMMENT ON COLUMN public.products.wholesale_price_usd IS
'Precio opcional de venta al mayor en USD. El esquema actual no impone una cantidad mínima.';
