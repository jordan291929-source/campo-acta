# Campo Acta
Control interno de campo de FRUGLOBE: stock ProHass, productores y actas de salida. React + TypeScript + Vite + Supabase; Vercel publica desde GitHub.

## Activar esta actualización
Con la instalación inicial existente, ejecutar **todo** `supabase/migrations/202610260002_full_flow.sql` en SQL Editor de Supabase. Incluye `reset role;`, funciona sobre la migración inicial y puede volver a ejecutarse. No borra registros ni carga existencias ficticias. No repetir el SQL inicial si ya existe.

En Authentication habilitar **Allow new users to sign up** si estaba desactivado. La app ofrece Crear cuenta; Supabase puede solicitar confirmación por correo según su configuración. Configurar Site URL con el dominio real de Vercel y autorizar ese dominio como URL de redirección en Authentication. Si se decide trabajar sin confirmación de correo, esa opción se cambia en Supabase; no requiere cambiar código.

Las cuentas existentes y nuevas reciben perfil automáticamente. Las cuentas comparten las operaciones de Campo. Se puede restringir por cuenta la carga inicial y la edición de productos/precios mediante la migración 003. No se necesitan roles operativos para las salidas. Las tablas siguen requiriendo sesión.

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
- El precio de cada salida no se edita: se toma del catálogo de Productos (precio por envase) y, en soles, se convierte con el tipo de cambio referencial. Para cambiarlo, editar el producto. Al emitir, el precio queda fijado en el acta.
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

## Cuenta de Campo con catálogo de consulta
Aplicar la migración 202610260003_catalog_permissions.sql después de 002. Registrar el correo de la cuenta restringida en field_account_restrictions con can_manage_catalog=false desde SQL Editor. La regla se vincula al usuario existente o al momento de crear su cuenta. Permite operar productores, salidas, firmas, movimientos y NISIRA; restringe importación inicial, saldos iniciales y creación/edición de productos y precios. Las restricciones se validan en el servidor, y las implementaciones internas no están disponibles para llamadas de clientes. La cuenta principal conserva permisos de catálogo.

La interfaz consulta su permiso al actualizar o iniciar sesión. Si aún no se instaló esta migración, mantiene cerradas temporalmente las funciones de catálogo. Nunca volver a aplicar una migración antigua sobre una más reciente.

## Acta de llenado simple y datos de empresa
El formulario separa receptor, descuento y datos comunes de FRUGLOBE. Al elegir productor se completan nombre, documento y predio; se puede indicar un receptor diferente. El importe a descontar se calcula desde los insumos, conservando importes manuales de documentos previos. Las fechas se seleccionan y no se inventan.

El RUC y el domicilio se guardan en Supabase y se completan para usuarios autenticados. No se incluyen en el código del frontend. Para configurar la identidad fiscal, representante, DNI y datos bancarios compartidos, aplicar 202610260004_company_defaults.sql y completar Datos de empresa con la cuenta principal. Campo consulta esos datos sin reescribirlos. Los borradores reciben datos por defecto donde faltan; las actas emitidas conservan sus datos guardados.

## Ingeniero responsable y datos de pago
Aplicar la actualización 005 para guardar el listado de ingenieros en Datos de empresa (un nombre por línea). El responsable de nuevas salidas se selecciona de ese listado; no se usa el correo de la sesión. La impresión incluye el responsable de entrega y conserva por separado el representante de FRUGLOBE configurado. La cuenta bancaria y el canal de constancias se obtienen de la configuración privada, sin incorporar valores personales/bancarios al código público. Los documentos emitidos no se actualizan automáticamente.

## Stock por envase y actas en soles
Aplicar `202610260006_package_units.sql` después de 005. Corrige los productos que quedaron con unidad L/KG cuando sus cantidades eran envases del Excel (por ejemplo, 40 envases x 5 L se mostraban como 40 L). Los saldos importados con la nota "Cantidades en envases" conservan su número; los saldos y movimientos registrados en L/KG se dividen entre el contenido del envase. Los precios pasan a ser por envase. Los borradores se convierten con el mismo importe y deben revisarse de nuevo; las actas emitidas no se modifican. Se puede volver a ejecutar.

Campo registra salidas en envases completos (bolsa, envase o cilindro); la app muestra el contenido total en L/KG como referencia. Las nuevas salidas se emiten en soles: el precio en USD del catálogo se convierte con un tipo de cambio referencial del día (open.er-api.com, no es el TC oficial SUNAT). El tipo de cambio es editable, queda guardado en cada acta y se imprime debajo del total. Cambiar el tipo de cambio o la moneda recalcula los precios del documento.

## Membrete
Todos los formatos impresos (actas, traslados, consumos e ingresos) llevan el membrete de la hoja FRUGLOBE: logo, razón social, RUC, teléfono y domicilio, repetido en cada página. El logo está en `src/assets`; el RUC, teléfono y domicilio se toman de Datos de empresa. Aplicar `202610260007_letterhead_phone.sql` después de 006 para guardar el teléfono del membrete.

## Formulario por pasos y eliminación
El formulario de salidas está ordenado en cinco pasos: qué se registra, a quién y cuándo, insumos (tarjetas con botones − / +, disponible en envases y aviso si no alcanza el stock), quién recibe y descuento, y revisión. Antes de emitir se muestra en lenguaje simple lo que falta completar. Moneda, tipo de cambio, campaña, guía y datos de FRUGLOBE están en "Más datos".

Aplicar `202610260008_delete_operations.sql` después de 007. La cuenta administradora puede eliminar borradores y documentos anulados; un documento emitido se anula primero. Eliminar no cambia el stock y la auditoría conserva una copia del documento.

## Aprobación de cuentas
Aplicar `202610260009_account_approval.sql` después de 008. Las cuentas nuevas quedan pendientes: no leen ni modifican información hasta que administración las aprueba en la pestaña Usuarios. Las cuentas existentes conservan su acceso; las que no estaban restringidas quedan como Administración. Administración edita productos, precios, carga inicial, datos de empresa y usuarios, y puede eliminar documentos; Campo registra salidas y productores. Revisar la lista de Usuarios después de aplicar la migración y quitar el acceso a cualquier cuenta desconocida.

En traslados e ingresos de compra el responsable es personal de almacén: se escribe su nombre (la app sugiere los usados antes) en lugar de elegir un ingeniero de Campo.
