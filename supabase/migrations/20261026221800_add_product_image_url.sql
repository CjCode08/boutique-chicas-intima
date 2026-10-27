ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.products.image_url IS
'URL pública de la imagen principal del producto almacenada en Supabase Storage.';
