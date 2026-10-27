# Boutique Chicas Íntima

Aplicación web para gestionar el inventario de Boutique Chicas Íntima con Next.js, TypeScript y Supabase.

## Organización de la aplicación

Las rutas se separan por módulo dentro de `src/app`: el inventario actual vive en `admin/inventory`, el catálogo está preparado en `catalog`, y las áreas `seller`, `pos` y `admin/sales` tienen pantallas indicativas hasta que se desarrollen sus funciones. La lógica y vista del inventario están en `src/components/inventory/InventoryApp.tsx`; los componentes compartidos se guardan en `src/components/shared`.

El inicio redirige a `/admin/inventory`. El catálogo usa `/catalog` en vez del grupo `(catalog)/page.tsx` del esquema inicial: un grupo de rutas sin segmento en la URL también resolvería a `/` y entraría en conflicto con la redirección de inicio. Las rutas `/admin/inventory/new`, `/admin/inventory/[id]` y `/admin/inventory/audit` abren el formulario, la edición y la auditoría.

Los endpoints BCV y WhatsApp quedan pendientes hasta implementar sus integraciones; no se crean rutas API vacías. La configuración actual de Next.js está en `next.config.ts` y Tailwind CSS 4 se configura desde `globals.css`, por lo que se conservan esos archivos en vez de añadir configuraciones que el proyecto no utiliza.

## Desarrollo local

1. Instala las dependencias con `npm install`.
2. Configura `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Inicia el servidor con `npm run dev`.

La clave `SUPABASE_SERVICE_ROLE_KEY`, si existe, nunca debe exponerse al navegador ni llevar el prefijo `NEXT_PUBLIC_`. Las operaciones del cliente usan la clave pública y dependen de las políticas RLS de Supabase.

## Inventario — fase 1

El panel conecta con estas tablas y columnas del esquema SQL del proyecto:

- `categories`: `id`, `name`, `slug`.
- `products`: `id`, `category_id`, `name`, `description`, `image_url`, `base_price_usd`, `promotional_price_3_11_usd`, `wholesale_price_usd`, `is_active`.
- `product_variants`: `id`, `product_id`, `sku`, `size`, `color`, `stock_quantity`, `min_stock_alert`.
- `inventory_logs`: `variant_id`, `type`, `quantity_changed`, `previous_stock`, `new_stock`, `notes`, `created_at`.
- `exchange_rates`: `rate_ves`, `is_active`, `created_at`.

La migración `supabase/migrations/20261027131500_add_promotional_and_wholesale_price_tiers.sql` agrega `products.promotional_price_3_11_usd` para el precio promocional de 3 a 11 piezas y configura `products.wholesale_price_usd` para el precio al mayor desde 12 piezas, ambos opcionales y expresados por unidad en USD. `base_price_usd` es el precio unitario para 1 o 2 piezas. Ejecuta el SQL de esa migración en Supabase para habilitar los tres campos. Los precios guardados actualmente en `wholesale_price_usd` se conservan; revisa esos valores y reasígnalos según corresponda al nuevo esquema.

El catálogo, el carrito, la interfaz de vendedores y el punto de venta aún son pantallas de preparación; por tanto, el sistema todavía no procesa compras ni calcula automáticamente el precio en un pedido. Esta configuración deja guardados los tres precios. En el futuro flujo de venta, las unidades de todas las variantes (tallas/colores) del mismo producto deberán sumarse para aplicar el precio unitario (1–2), de promoción (3–11) o al mayor (12+).

La migración `supabase/migrations/20261026221800_add_product_image_url.sql` agrega `products.image_url`. Aplícala antes de subir imágenes. El formulario permite seleccionar JPG, PNG o WebP de hasta 5 MB; los archivos se almacenan en el bucket `products` y la URL queda asociada al producto. Para que las imágenes se puedan ver, configura ese bucket como público y permite las escrituras necesarias mediante políticas de Storage. La app solo usa la clave anon en el navegador; nunca expongas una service role key.

El dashboard consulta los datos reales y presenta estados vacíos o errores de conexión explícitos. Permite crear productos con sus variantes, stock inicial e imagen, crear categorías (generando su `slug`), editar/desactivar productos, agregar variantes nuevas a productos existentes, ajustar existencias y consultar la auditoría. Las variantes agregadas desde la edición reciben su stock inicial y dejan un movimiento de auditoría; las variantes ya registradas no se modifican desde ese formulario. Los tres precios muestran su equivalente en VES cuando hay una tasa activa. El esquema actual no contiene costo unitario, por lo que el valor del inventario se calcula al precio unitario.
