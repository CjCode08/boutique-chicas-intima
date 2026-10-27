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
- `products`: `id`, `category_id`, `name`, `description`, `image_url`, `base_price_usd`, `is_active`.
- `product_variants`: `id`, `product_id`, `sku`, `size`, `color`, `stock_quantity`, `min_stock_alert`.
- `inventory_logs`: `variant_id`, `type`, `quantity_changed`, `previous_stock`, `new_stock`, `notes`, `created_at`.
- `exchange_rates`: `rate_ves`, `is_active`, `created_at`.

La migración `supabase/migrations/20261026180000_add_wholesale_price.sql` agrega `products.wholesale_price_usd`, un precio mayorista opcional en USD, sin mínimo de compra. Ejecuta este SQL en Supabase para habilitar ese campo. Mientras no esté aplicada, los productos sin precio mayorista se pueden registrar y editar; si se intenta asignar un precio mayorista, la aplicación mostrará un error que indica la migración necesaria. Las filas existentes quedan con el precio mayorista en `NULL` hasta que se indique uno.

La migración `supabase/migrations/20261026221800_add_product_image_url.sql` agrega `products.image_url`. Aplícala antes de subir imágenes. El formulario permite seleccionar JPG, PNG o WebP de hasta 5 MB; los archivos se almacenan en el bucket `products` y la URL queda asociada al producto. Para que las imágenes se puedan ver, configura ese bucket como público y permite las escrituras necesarias mediante políticas de Storage. La app solo usa la clave anon en el navegador; nunca expongas una service role key.

El dashboard consulta los datos reales y presenta estados vacíos o errores de conexión explícitos. Permite crear productos con sus variantes, stock inicial e imagen, crear categorías (generando su `slug`), editar/desactivar productos, agregar variantes nuevas a productos existentes, ajustar existencias y consultar la auditoría. Las variantes agregadas desde la edición reciben su stock inicial y dejan un movimiento de auditoría; las variantes ya registradas no se modifican desde ese formulario. Los precios unitario y mayorista muestran su equivalente en VES cuando hay una tasa activa. El esquema actual no contiene costo unitario, por lo que el valor del inventario se calcula al precio unitario.

La creación de categorías muestra errores de Supabase en el formulario. Si aparece una denegación de permisos, revisa las políticas RLS de lectura e inserción: no habilites escrituras anónimas en producción. La interfaz todavía no incluye pantalla de inicio de sesión; por eso, si RLS exige `authenticated`, primero hay que implementar la sesión de administrador y autorizar su perfil antes de poder escribir desde el panel.

### Conectar Supabase por MCP desde VS Code

1. En VS Code, abre la paleta (`Ctrl+Shift+P`) y ejecuta **MCP: Add Server**.
2. Selecciona **HTTP**, pega `https://mcp.supabase.com/mcp?project_ref=TU_PROJECT_REF&read_only=true&features=database,docs` y confirma.
3. Inicia sesión en Supabase cuando VS Code lo solicite, selecciona la organización del proyecto y revisa/acepta la conexión.
4. Verifica primero con una consulta de lectura, por ejemplo: “Usa Supabase MCP para listar las tablas; no ejecutes escrituras”.
5. Para cambios de esquema, quita `&read_only=true` solo cuando lo necesites; mantén las aprobaciones manuales y revisa el SQL de cada operación.

`TU_PROJECT_REF` es la parte anterior a `.supabase.co` en `NEXT_PUBLIC_SUPABASE_URL`. El MCP usa el inicio de sesión OAuth de Supabase; no pegues `SUPABASE_SERVICE_ROLE_KEY`, contraseñas ni tokens en el chat o en el repositorio. La configuración también puede añadirse a `.vscode/mcp.json`; VS Code y Supabase documentan los pasos y opciones de seguridad en [VS Code](https://code.visualstudio.com/docs/agent-customization/mcp-servers) y [Supabase](https://supabase.com/docs/guides/ai-tools/mcp).

## Validación

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
