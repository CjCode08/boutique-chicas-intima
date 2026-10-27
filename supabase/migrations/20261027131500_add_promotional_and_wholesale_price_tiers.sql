ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS wholesale_price_usd NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS promotional_price_3_11_usd NUMERIC(10, 2);

COMMENT ON COLUMN public.products.wholesale_price_usd IS
'Precio por unidad en USD al comprar 12 o más prendas del mismo producto.';

COMMENT ON COLUMN public.products.promotional_price_3_11_usd IS
'Precio promocional por unidad en USD al comprar de 3 a 11 prendas del mismo producto.';
