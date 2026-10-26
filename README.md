# Campo Acta

Aplicación independiente de FRUGLOBE para control de insumos. React + TypeScript + Vite + Supabase. Alojamiento previsto en Vercel.

## Estado de esta versión

Implementado: acceso con correo y contraseña, sesión persistente, verificación de usuario habilitado, consulta de existencias por ubicación, filtros y estados de carga/error. El stock se actualiza al abrir la sesión o pulsar Actualizar stock; todavía no usa suscripciones en tiempo real.

Preparado en SQL: perfiles con roles, productos, ubicaciones, saldos iniciales, libro de movimientos, vista de stock y depósito privado de documentos. Solo lectura desde la aplicación. No hay registro público ni posibilidad de asignarse permisos desde el navegador.

Pendiente: maestros editables, importación validada, actas históricas y nuevas, firma adjunta, operaciones transaccionales de almacén, consumos, transferencias, ajustes, descuentos y seguimiento NISIRA. Esta versión no es todavía un sistema operativo completo.

## Instalación Supabase

1. En SQL Editor ejecutar una sola vez `supabase/migrations/202610260001_initial.sql`. Crea objetos nuevos; no ejecutar si ya hay tablas homónimas sin revisar.
2. En Authentication > Users crear un usuario con correo y contraseña, confirmado. Deshabilitar los registros públicos en la configuración de Authentication.
3. Copiar su UUID y ejecutar el siguiente SQL sustituyendo los valores:

```sql
insert into public.profiles(id,full_name,role)
values ('UUID_DEL_USUARIO','Jordan','admin');
```

4. Agregar usuarios adicionales del mismo modo con rol `campo`, `almacen` o `administracion`. En esta primera versión todos los miembros activos consultan stock; las operaciones de escritura aún están cerradas incluso para el perfil admin.
5. La carga inicial se hará después de conciliar los archivos privados. No se incluyen en este repositorio público nombres, DNI, precios ni saldos operativos.

## Configuración local

Copiar `.env.example` como `.env.local` y reemplazar la clave por la Publishable key del proyecto. Usar Node.js 22.12 o superior.

```text
npm ci
npm run dev
```

## Vercel

Importar `jordan291929-source/campo-acta`. Seleccionar Vite, comando de compilación `npm run build`, directorio de salida `dist`.

Configurar en Environment Variables, para los entornos que se vayan a utilizar:

```text
VITE_SUPABASE_URL=https://aeokjqnjfajuftivftdq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clave publica del proyecto>
```

Volver a desplegar después de modificar las variables. No necesita claves secretas de Supabase ni acceso directo de Vercel a PostgreSQL. Nunca agregar service_role, secret keys o contraseña de base de datos a variables VITE_: se incorporan al navegador.

## Reglas de la carga inicial

- Archivo de stock Norte–Sur: representa el saldo restante después de las entregas históricas. Falta confirmar fecha de corte.
- ENTREGADO en el historial: formalización documental sin nueva salida de stock. PENDIENTE no equivale a entregado. Estados parciales requieren validar cantidad real.
- Amarillo y observaciones de uso futuro en Chincha: no son salidas ni reservas confirmadas.
- Los cuatro #REF! de Sur permanecen desconocidos (`quantity = null`, `verified = false`), nunca cero.
- Verificar Argenfrut 205/209 L y Nutri-Aktiv Ca-B-Zn 5/20 L antes de homologar productos.
- Controlar L/KG en unidad base; al importar envases multiplicar cantidad de envases por contenido validado. UN solo para productos controlados por unidades.
- Código NISIRA como texto y solo tras verificación; nunca inventarlo.
- Precio de compra y precio al productor deben ser campos distintos en el módulo de entregas. Importes fijados por documento, sin actualizar actas anteriores al cambiar un catálogo.
- Consumo propio en Chincha no genera deuda a productor. Transferencia a Chincha y aplicación son movimientos diferentes.

## Verificación

`npm run build` comprueba tipos y genera la versión distribuible. Para validar permisos en Supabase, comprobar: visitante sin sesión no lee tablas; usuario sin perfil no lee stock; miembro activo sí lee; ningún miembro puede escribir o cambiar su rol mediante la API. La SQL debe validarse en un proyecto de prueba antes de cargar datos operativos. Las copias de seguridad y restauración se configurarán antes de operar con datos reales.
