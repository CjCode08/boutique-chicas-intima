# Instrucciones para Agentes de IA - Boutique Chicas Íntima

## Regla de Oro: Memoria del Proyecto
1. **SIEMPRE** lee y revisa el archivo `memory.md` ubicado en la raíz antes de responder o generar cualquier código para entender la fase actual y decisiones previas.
2. Al finalizar cualquier tarea o actualización relevante, **ACTUALIZA** `memory.md` registrando lo realizado, las decisiones tomadas y descartando información obsoleta.

## Contexto del Proyecto
Sistema integral para la tienda de ropa interior femenina "Boutique Chicas Íntima".

### Stack Tecnológico
- **Framework**: Next.js (App Router, React, TypeScript).
- **Estilos**: Tailwind CSS (Limpio, femenino, color rojo principal `#E63946` / `#DC2626` usado con elegancia).
- **Base de Datos y Backend**: Supabase (PostgreSQL, Row Level Security, Auth, Storage).
- **Control de Versiones**: Git & GitHub.
- **Asistente**: GitHub Copilot

## Lineamientos de Diseño y Desarrollo
1. **Multimoneda**: Toda visualización de montos debe soportar USD y Bolívares (VES), calculados mediante la tasa activa en la tabla `exchange_rates`.
2. **UI/UX**:
   - **Catálogo Cliente**: Estética limpia, femenina, acentos rojos, carga hiperrápida, mobile-first (optimizado para teléfonos y tablets).
   - **Vendedores / POS / Inventario**: Interfaces limpias, amigables, uso sutil del rojo, enfocadas en la rapidez operativa (búsqueda rápida y soporte para escáner).
   - **Panel Admin**: Minimalista, métricas claras, stock semáforo (Verde: OK, Amarillo: Poco Stock, Rojo: Sin Stock/Crítico).
3. **Manejo de Errores y Tipado**:
   - Todo el código debe ser estrictamente tipado en TypeScript.
   - Usar Server Actions o llamadas a Supabase con manejo explícito de errores (`try/catch` y notificaciones en UI).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
