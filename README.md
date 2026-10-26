# Campo Acta
Control interno de campo de FRUGLOBE: stock ProHass, productores y actas de salida. React + TypeScript + Vite + Supabase; Vercel publica desde GitHub.

## Activar esta actualización
Con la instalación inicial existente, ejecutar **todo** `supabase/migrations/202610260002_full_flow.sql` en SQL Editor de Supabase. Incluye `reset role;`, funciona sobre la migración inicial y puede volver a ejecutarse. No borra registros ni carga existencias ficticias. No repetir el SQL inicial si ya existe.

En Authentication habilitar **Allow new users to sign up** si estaba desactivado. La app ofrece Crear cuenta; Supabase puede solicitar confirmación por correo según su configuración. Configurar Site URL con el dominio real de Vercel y autorizar ese dominio como URL de redirección en Authentication. Si se decide trabajar sin confirmación de correo, esa opción se cambia en Supabase; no requiere cambiar código.

Las cuentas existentes y nuevas reciben perfil automáticamente. Todos los usuarios autenticados tienen las mismas funciones. No se necesita asignar roles operativos ni habilitar cada usuario por SQL. Las tablas siguen requiriendo sesión.

## Flujo disponible
- **Productores:** crear y editar identidad, predio, dirección y datos de contacto.
- **Productos:** presentación, unidad de control, contenido por envase, costo de compra y precio al productor, por separado.
- **Carga inicial:** seleccionar los Excel locales. Lee Productos y Registro de Movimientos del kardex; lee productores del proyecto. Revisión antes de confirmar: unidades, cantidad y fecha de corte. No sube los archivos originales a GitHub.
- **Stock:** saldos por Sur, Norte y Chincha. Actualizar información consulta los cambios de otros usuarios.
- **Salidas y actas:** nuevo documento, borrador editable, confirmación y acta imprimible/guardar PDF con las condiciones del Word enviado. Los datos de productor, producto y precio quedan fijados al emitir.
- **Históricas:** formalizan entregas ya descontadas sin modificar existencias. Desde Carga inicial se pueden preparar borradores por grupo del kardex; revisar destinatario, unidades y precio.
- **Ingresos de compra:** incrementan stock del almacén elegido.
- **Transferencias:** descuentan origen y suman destino en la misma transacción.
- **Consumo propio:** descuenta stock sin generar deuda de productor.
- **Firma:** adjuntar PDF/JPG/PNG (hasta 10 MB), abrir copia firmada con enlace temporal.
- **NISIRA:** registrar referencia del documento para seguimiento. No hay sincronización automática con el ERP.
- **Anulación:** motivo obligatorio, mantiene historial y genera reverso de movimientos. Si un ingreso/transferencia ya se consumió y no puede revertirse, la anulación se rechaza.
- **Movimientos:** libro de stock y trazabilidad de operaciones.

No se ha implementado aplicación automática de descuentos en liquidaciones ni cálculo de cobranzas. El acta conserva la autorización y el importe de la entrega para su control posterior.

## Importación y unidades
La hoja Productos del kardex tiene 32 posiciones producto/almacén. Las cantidades del kardex se interpretan inicialmente como envases (UN). La aplicación muestra el contenido total calculado automáticamente: 10 envases x 20 L = 200 L. La misma equivalencia se muestra en la vista de carga, el stock, las salidas y las actas. No genera movimientos adicionales ni cambia los precios guardados. Si un registro ya se controla en L/KG, conserva su contenido sin multiplicarlo nuevamente. Una fracción de UN representa una fracción de envase.

No sumar unidades diferentes. La unidad/contenido de un producto con saldos no se cambia: crear otra presentación para evitar reinterpretar registros existentes.

- Las entregas anteriores ya estaban descontadas del stock.
- Las observaciones amarillas de uso previsto en Chincha no son salidas.
- Un saldo desconocido permanece null, nunca cero.
- La importación inicial es transaccional y rechaza posiciones ya cargadas; no duplica stock.
- El kardex nuevo contiene saldos cero explícitos donde el archivo anterior tenía errores. Revisar antes de cargar.
- Los productores sin documento se pueden guardar; completarlo antes de emitir un acta. Nombres parecidos o alias deben revisarse; no se fusionan por suposición.
- Los códigos internos del kardex (por ejemplo 2923-1) se conservan en las notas de origen y **no se consideran códigos NISIRA**.
- Los precios del acta se expresan por unidad de control, en la moneda indicada. No se convierten monedas automáticamente; cambiar moneda reinicia precios.
- Una nueva salida anterior a la fecha de corte se rechaza: usar histórica cuando ya esté descontada.

## Acceso y consistencia
RLS habilitado, sin lectura anónima. Todas las cuentas comparten acceso funcional. Escritura de documentos y libro solo mediante funciones transaccionales; la app no puede editar directamente saldos calculados ni documentos emitidos. Las funciones comprueban sesión. El control compartido de operaciones evita consumos concurrentes por encima del saldo. Guardar borradores usa versión para detectar edición simultánea. Confirmar y anular repetidamente no duplica movimientos.

Los archivos firmados están en un bucket privado con lectura para usuarios autenticados. No se elimina ni reemplaza el original desde la aplicación.

## Configuración Vercel
Proyecto actual: `fruglobe`; repositorio `jordan291929-source/campo-acta`.
Framework Vite, build `npm run build`, salida `dist`.
Variables para Production/Preview (visibilidad Config):
```text
VITE_SUPABASE_URL=https://aeokjqnjfajuftivftdq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clave pública>
```
Volver a desplegar al cambiar variables. Nunca usar claves secretas en variables VITE_.

## Desarrollo y pruebas
Node 22.12 o superior. Copiar .env.example a .env.local y completar la clave pública.
```text
npm ci
npm run dev
npm run build
npm test
```
`tests/database.mjs` prueba la primera instalación en aislamiento.
`tests/flow.mjs` prueba la actualización y el circuito: alta automática, acceso uniforme, importación inicial, saldo histórico sin doble descuento, insuficiencia, idempotencia, transferencias, consumos, reversos, edición simultánea, referencias, firma y snapshots.
`node tests/excel.mjs <kardex.xlsx> <proyecto.xlsx>` comprueba los lectores sobre archivos locales.
`node tests/print-preview.mjs` genera una muestra sintética en .qa/acta.html para inspección visual con el servidor local.
Las pruebas no modifican el proyecto real de Supabase.

Los Excel reales y los datos personales nunca deben agregarse al repositorio público. Configurar respaldos del proyecto Supabase antes de su operación habitual.

## Base desde compras originales
La plantilla de compras tiene 16 productos, todos en SUR, y marca TIPO_BASE=COMPRAS_ORIGINALES en Instrucciones. El lector distingue esta base del kardex de remanentes. Se importan unidades facturadas (UN), contenido, costo neto y precio de productor sin IGV con incremento de 15%. Los valores financieros permanecen en el archivo local y Supabase; no se publican en este repositorio.

Con esta base, las salidas y traslados anteriores deben registrarse como movimientos que descuentan stock una sola vez. En la preparación de salidas del kardex se elige si deben descontar o si ya estaban descontadas. Regularización documental sin descuento solo corresponde cuando la salida física ya fue registrada. La fecha base documental de la plantilla es la última emisión de factura; se puede revisar antes de confirmar y no se considera fecha probada de recepción física.

Productos también permite cargar un archivo privado de precios sin IGV +15% y aplicarlo al catálogo según la unidad de control. No modifica las actas emitidas.
