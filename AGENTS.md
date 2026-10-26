# Guía para agentes (Codex, Claude u otros)

Leer también `README.md`: describe el negocio, el flujo y cada migración. Este archivo resume lo necesario para seguir desarrollando sin romper nada.

## Qué es
Campo Acta: control interno de FRUGLOBE S.A.C. para insumos agrícolas ProHass. Registra stock por almacén (Sur, Norte, Chincha), productores, salidas a productores con acta imprimible (deuda que se descuenta de liquidaciones de palta), consumo propio, traslados entre almacenes e ingresos de compra.

Usuarios: personal de **campo** (ingenieros) y **almacén**, muchas veces desde el celular. Todo texto de la interfaz va en español claro y simple, sin tecnicismos.

## Stack y despliegue
- React 19 + TypeScript + Vite. Sin router ni librería de estado: `src/main.tsx` maneja pestañas y carga de datos.
- Supabase (Postgres + Auth + Storage). El frontend usa solo la clave pública; toda escritura pasa por funciones `security definer`.
- Vercel publica automáticamente al fusionar en `main`. Hay dos proyectos de Vercel conectados al repositorio (`fruglobe` y `campo-acta`).
- **Las migraciones SQL no se despliegan solas**: el usuario las ejecuta a mano en el SQL Editor de Supabase. Al entregar una migración nueva, indicarle siempre el archivo que debe ejecutar. Preguntar qué migraciones ya aplicó si hace falta saberlo.

## Estructura
- `src/main.tsx`: login, cuenta pendiente, pestañas, carga de datos (`load`) y `run` (ejecuta una acción, muestra errores y recarga todo).
- `src/Operations.tsx`: formulario por pasos de salidas/actas/traslados/ingresos, lista de documentos, firma, NISIRA, anulación y eliminación.
- `src/Acta.tsx`: acta imprimible con membrete (se repite en cada página). Formato completo para productor; "Datos del movimiento" para traslado, consumo e ingreso.
- `src/ActaFields.tsx`: partes del acta (quién recibe, descuento, datos de FRUGLOBE, otros) usadas en distintos pasos.
- `src/Masters.tsx` (productores y productos), `src/Imports.tsx` + `src/excel.ts` (carga inicial desde Excel), `src/PriceImport.tsx` + `src/pricing.ts` (precios), `src/CompanySettings.tsx` + `src/company.ts` (datos de empresa), `src/Users.tsx` (aprobación de cuentas).
- `src/model.ts`: tipos y utilidades (`packageCount`, `packageLabel`, `packageContent`, `money`, `fmt`).
- `src/exchange.ts`: tipo de cambio referencial USD→PEN (dos fuentes públicas y respaldo con el último TC del navegador).
- `supabase/migrations/`: 001 a 009, en orden. `tests/`: pruebas con PGlite (Postgres en memoria) y de módulos TypeScript.

## Reglas de negocio que no se deben romper
- **Stock y cantidades en envases enteros** (unidad `UN`: bolsa, envase, cilindro). El contenido (L/KG) es solo referencia. No volver a ofrecer cantidades en L/KG.
- **Precio por envase desde el catálogo de Productos**; en salidas no se edita. Las actas se emiten en **soles (PEN)** por defecto, convirtiendo el precio USD con el tipo de cambio referencial guardado en cada acta (`details.exchange_rate`).
- **Un documento emitido no se modifica.** Para corregir: anular (genera reverso de stock) y registrar uno nuevo. Solo administración elimina, y solo borradores o anulados; la auditoría guarda copia.
- Un documento emitido ya descontó su salida: no compararlo con el stock actual.
- Saldo desconocido es `null`, nunca cero. La importación no duplica stock.
- Entrega a productor: responsable = ingeniero del listado de Datos de empresa. Traslado e ingreso: responsable de almacén (texto libre).
- Cuentas nuevas quedan pendientes (`profiles.active=false`) hasta que administración las apruebe. Administración = `profiles.role='admin'`. Comprobar acceso en SQL con `public.campo_acta_member()` y permisos de administración con `public.field_can_manage_catalog()`.

## Seguridad y datos
- Nunca subir al repositorio Excel reales, datos personales, RUC/DNI, cuentas bancarias ni claves. Esos datos viven en Supabase (Datos de empresa) o en archivos locales del usuario. Solo variables `VITE_` públicas en el frontend.
- Toda función nueva expuesta: `security definer set search_path=''`, validar `campo_acta_member()` (y `field_can_manage_catalog()` si es de administración), `revoke ... from public, anon` y `grant execute ... to authenticated`.
- Nunca editar una migración ya aplicada: crear la siguiente (`202610260010_...sql`), idempotente cuando sea posible, empezando con `reset role; begin;`.

## Estilo de código
- Código compacto, como el existente (líneas largas, JSX denso). Comentarios breves en español solo donde aportan el porqué.
- Estilos en `src/style.css`, `src/flow.css` (formulario, acta, impresión) y `src/acta-fields.css`. Diseño responsive: revisar escritorio ancho y celular (390 px).

## Comandos
```text
npm ci
npm run dev          # servidor local (necesita .env.local con la URL y clave pública)
npx tsc -b           # tipos
npm test             # base de datos (PGlite) + módulos
npm run build        # compilación de producción
node tests/print-preview.mjs   # genera .qa/acta.html para revisar el acta impresa
```
Antes de entregar: `npx tsc -b`, `npm test` y `npm run build` sin errores. Si se cambia SQL, agregar pruebas en `tests/flow.mjs` (aplica todas las migraciones en PGlite y prueba permisos y stock).

## Pendientes conocidos
- El precio está bloqueado en la interfaz, pero `field_save_operation` todavía acepta el precio que envía el navegador. Se podría calcular en el servidor desde el catálogo y el tipo de cambio.
- La tabla de Stock aún muestra la columna "Contenido total" en L/KG; podría pasar al formato "N envases de X L c/u" usado en salidas.
- `exceljs` (~940 KB) se carga en el paquete principal; cargarlo solo en Carga inicial aceleraría la app.
- `npm test` no incluye `tests/print-preview.mjs` ni `tests/producers-template.mjs` (requieren archivos o revisión visual).
- Dos proyectos de Vercel conectados al mismo repositorio; confirmar con el usuario cuál es el oficial.
