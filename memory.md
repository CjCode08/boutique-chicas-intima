# Memoria de Desarrollo - Boutique Chicas Íntima

## Estado del Proyecto
- **Fase Actual**: Fase 1 - Sistema de Inventario y Gestión de Productos.
- **Fecha de Inicio**: 26 de Octubre 2026.

---

## Log de Tareas Completadas
- [x] Definición general de requerimientos y arquitectura del sistema.
- [x] Diseño del esquema unificado de base de datos en Supabase (SQL ejecutable preparado).
- [x] Configuración inicial del repositorio e instrucciones para agentes en `AGENTS.md`.
- [x] Dashboard responsivo de inventario conectado al esquema real de Supabase.
- [x] Alta de productos y variantes con stock inicial, categorías con slug, conversión USD/VES y auditoría.
- [x] Edición y activación/desactivación lógica de productos; ajustes de stock con motivo e historial.
- [x] Documentación de desarrollo y columnas consumidas en `README.md`.

---

## Roadmap por Fases

### Fase 1: Sistema de Inventario (EN PROCESO)
- [x] Configurar cliente de Supabase en Next.js (`@supabase/ssr`).
- [ ] Completar mantenimiento de Categorías (creación ya disponible; falta editar/eliminar).
- [x] Gestión de Productos Base (crear, editar y activar/desactivar).
- [x] Gestión de Variantes (tallas, colores, SKU, umbral y stock por variante).
- [x] Panel de Auditoría (`inventory_logs`) para visualizar ingresos, ajustes e historial.
- [x] Mensajes de error de creación de categorías visibles dentro del formulario y opción para reintentar la conexión.
- [x] Añadido campo de precio mayorista opcional en USD (sin mínimo de unidades) y migración SQL correspondiente.
- [x] Documentada conexión MCP de Supabase a VS Code con acceso de solo lectura inicial.

### Fase 2: Catálogo Ecommerce & Pedidos WhatsApp
- [ ] Vista pública responsiva del catálogo (filtros por categoría, talla, color).
- [ ] Carrito de compras cliente con selector de entrega (Pickup, Delivery local, Envío nacional).
- [ ] Generador de mensaje estructurado y redirección a WhatsApp para confirmar pedido.

### Fase 3: Interfaz para Vendedores
- [ ] Vista optimizada de selección rápida de productos y variantes.
- [ ] Buscador integrado / interfaz para escáner de productos en tienda.
- [ ] Creación de carrito del vendedor asignando datos del cliente.

### Fase 4: Punto de Venta (POS)
- [ ] Módulo de recepción de pedidos generados por vendedores.
- [ ] Procesamiento de pagos (múltiples formas de pago y cálculo multimoneda USD/VES).
- [ ] Rebaja automática de stock e impresión/visualización de ticket.

### Fase 5: Panel Administrativo & Analítica
- [ ] Reporte de ventas diarias, semanales, quincenales y mensuales por vendedor.
- [ ] Cálculo de comisiones por vendedor según porcentaje asignado.
- [ ] Métricas: Top vendedor, producto más vendido y vista de Stock tipo Semáforo.

---

## Decisiones y Elementos Descartados
*(Registrar aquí cualquier función o enfoque que se decida no implementar para no reconsiderarlo a futuro)*
- La tabla `products` no contiene costo unitario; el indicador de valor de inventario usa el precio de venta (`base_price_usd`) y se etiqueta como tal.
- El precio mayorista (`wholesale_price_usd`) es opcional, sin mínimo de compra; el usuario puede decidir cómo aplicarlo en operaciones futuras.
- Ejecutar la migración `supabase/migrations/20261026180000_add_wholesale_price.sql` en Supabase antes de crear/actualizar productos con precio mayorista.
- Los errores al crear categorías antes se enviaban al mensaje detrás del modal; ahora se muestran en el formulario. Errores de permisos pueden requerir políticas RLS de lectura/escritura.
- La UI aún no tiene flujo de inicio de sesión; si las escrituras exigen RLS `authenticated`, primero hay que implementar inicio de sesión y validar `profiles.role` antes de abrir escrituras del panel.

## Esquema confirmado y decisiones de implementación
- Las rutas se organizan por módulo. El inventario funcional está en `/admin/inventory`; catálogo, vendedores, POS y reportes permanecen como pantallas explícitas de preparación.
- `/` redirige a `/admin/inventory`; se usa `/catalog` porque `(catalog)/page.tsx` compite por la ruta raíz.
- La carga de datos conserva las tablas que respondieron correctamente; sin migración mayorista, altas/ediciones sin ese precio se guardan y el formulario explica cómo habilitarlo.
- Si falla el alta de un producto o sus variantes, se muestra una notificación toast accesible, además del detalle en el formulario.
- Al editar un producto se pueden añadir variantes con SKU, talla, color, stock inicial y umbral; el stock inicial se registra en la auditoría y no se alteran las variantes existentes.
- Productos pueden tener imagen principal en `products.image_url`; se sube JPG, PNG o WebP (máx. 5 MB) al bucket público `products`. La migración de la columna y las políticas de Storage necesarias deben aplicarse en Supabase.
- Variantes en `product_variants`; stock en `stock_quantity`; umbral por SKU en `min_stock_alert`.
- Precio base en `products.base_price_usd`; conversión a bolívares con `exchange_rates.rate_ves` activo.
- Movimientos usan `inventory_logs.type`, `quantity_changed`, `previous_stock` y `new_stock`; el stock inicial se registra como `ADDITION` y los cambios manuales como `ADJUSTMENT`.
- La app usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; las políticas RLS determinan permisos de lectura/escritura.
- El MCP oficial de Supabase se conecta por HTTP/OAuth desde VS Code; mantenerlo acotado al `project_ref`, usar `read_only=true` al probar y revisar manualmente el SQL antes de otorgar escritura.