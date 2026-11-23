# Coordinación comercial y audiencia

Base de revisión: `origin/main` del 23 de noviembre, `51bdfbe`. Se conserva el
checkout principal con sus cambios locales. El PR #6 sigue siendo el único
cambio de la frase de tramitación caducada, en HTML y texto.

## Estado real y autorización de audiencia

El 23 de noviembre se observaron 613 cuentas, 49 verificadas y tres identidades
comerciales elegibles. El titular confirmó expresamente en la sesión que las
49 verificadas habían aceptado las comunicaciones y pidió incorporarlas.

Se añadieron 46 registros con origen `owner_confirmed_historical_permission` y
versión `owner-declaration-2026-11-23`. Su metadata distingue declaración del
titular de una acción individual, conserva `original_acceptance_at=null` y no
reconstruye una fecha ni versión legal histórica. Las tres pruebas existentes,
las bajas, los bloqueos, los pedidos y las cuentas no verificadas se conservaron.
La consulta posterior confirma 49 elegibles y 49 incorporadas al motor.

El corte general de incorporación se amplió a la fecha de la cuenta elegible
más antigua. Se mantuvieron exactamente el digest de recuperación, la aprobación
del 23/11 a las 07:09 UTC y los flags. No se insertó ningún trabajo ni se llamó al
proveedor. Esa lectura encontró cero carritos/checkouts identificados guardados,
cero trabajos pendientes y 47 recursos de bienvenida potencialmente debidos.
47 identidades carecen de aceptación analítica; no se infiere de su permiso de
email. Estos son recuentos agregados, no estimaciones de entregas.

## Cambio preparado

La migración 060 reutiliza las tres colas y el libro de transporte existente.
Un lock transaccional por email normalizado reserva el turno comercial; el
consentimiento, la titularidad, la supresión, la lease y los hechos financieros
se vuelven a leer al reservar. Servicio y seguridad conservan su circuito.

Prioridad: checkout, carrito, producto, bienvenida, editorial/campaña,
fidelización y visita genérica. La tarea de mantenimiento materializa primero
la intención de compra; las colas pendientes se comparan sin depender de cuál
worker reclame primero. La política inicial es 1/24 h y 3/168 h, configurable.
Una pausa global o por familia no altera aprobaciones ni elimina trabajos.

El reloj de reintento comienza en el primer intento de proveedor. El trabajo
diferido conserva su cola. Un resultado incierto retiene el turno incluso al
caducar su ventana; solo el mismo trabajo y la misma clave pueden reintentarlo.
Después exige revisión. Una aceptación durable puede cerrar la cola sin llamar
otra vez al proveedor. No se promete atomicidad entre una transacción SQL y HTTP:
una compra confirmada durante una petición ya en vuelo puede preceder a su
aceptación; queda registrada y bloquea las recuperaciones posteriores.

Las bienvenidas comparten historial permanente por email entre cuenta y contacto.
El recurso prometido va primero; una interrupción no libera todos los pasos
atrasados. Se conserva contenido editorial elegible después de comprar, pero
se excluyen las ofertas ya convertidas. Los compradores elegibles también
entran en la audiencia de newsletter, sin depender del corte de automatizaciones.

El nuevo scope `recovery_welcome` añade bienvenida a checkout/carrito sin activar
producto o visita. `recovery_activity_starts_at` conserva la aprobación anterior
para que ampliar el scope no reabra intenciones históricas.

## Verificación y aplicación

- Unitarias, Astro Check, compilación y lint de los archivos afectados.
- Workers compilados con servicios ficticios, red externa bloqueada, retirada
  antes del envío, snapshots, reintentos y conciliación de aceptación.
- PostgreSQL 17 temporal en `127.0.0.1`, dos conexiones independientes: carrera
  por un turno, prioridad, límites, retirada, compra, historial y permisos SQL.
  `scripts/verify-commercial-coordination-db.mjs` exige explícitamente el host,
  usuario y base `crm_fixture`; rechaza una base poblada sin marcador de fixture.
  `CRM_SQL_RESET=1` solo reconstruye ese fixture verificado. Nunca acepta Supabase.

Antes de publicar: autorización específica para 060, validación del código exacto
y del digest `recovery_welcome`, revisión del volumen de 47 bienvenidas y lectura
actual de flags. Aplicar 060 antes del código; cambiar scope y aprobar el digest
solo tras comprobar el despliegue. Mantener apagadas bienvenida central,
confirmación de contactos, producto/visita y posventa. No invocar workers con
credenciales Live para pruebas ni reenviar un histórico de aceptaciones.

Reversión operativa: volver al scope `recovery`, su digest anterior y una nueva
aprobación que conserve `recovery_activity_starts_at`; o activar la pausa global.
Conservar esquema, permisos originales, historial y recibos. No borrar datos.

No se ha añadido zona horaria al destinatario ni se infiere de idioma o IP:
la ventana local 09–20 h sigue pendiente de disponer de una fuente acreditada.
El retorno al carrito conserva la ruta existente, sin prometer sincronización
entre dispositivos ni reserva de stock.
