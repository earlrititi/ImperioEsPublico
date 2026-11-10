# Entrega acreditada y recepción del cliente

Implementación local preparada en `051_post_delivery.sql`; no aplicada a ninguna base ni activada en proveedores por este trabajo.

Actualización del 7 de noviembre: integrada y verificada en PostgreSQL temporal. La caducidad del enlace es 14 días después de la fecha programada, también para intervalos de 336 horas; los reintentos no renuevan ese límite. Cancelación y reembolso limpian la próxima fecha de correo y el resumen de etapa junto con la cola. Ver [informe de integración](PERGAMINO-INTEGRATION-2026-11-07.md). No se ha aplicado SQL a servicios reales.

## Señales y estado

`paid_at` registra un pago y `shipped_at` un envío. Ninguno acredita una entrega. Los pedidos históricos con estado `DELIVERED` conservan su estado, pero sus nuevas fechas de acreditación siguen vacías hasta que exista evidencia real. No se generan eventos a partir de esos estados antiguos.

En Pedidos, un administrador autenticado puede registrar una entrega acreditada por paquete, su fecha, una referencia privada a la prueba y su identidad de operador. La antigua acción sin evidencia «SHIPPED → DELIVERED» queda cerrada en SQL. La primera evidencia fija el total de paquetes; cambios de ese total requieren revisión operativa para evitar convertir una entrega parcial en completa. Se conservan los eventos originales. La fecha `carrier_delivered_at` solo se establece cuando todos los índices de paquete tienen evidencia. No hay integración automática con transportistas instalada o autorizada.

La recepción del cliente se confirma desde la cuenta verificada vinculada a la reserva y al correo del pedido, o mediante el enlace de servicio de capacidad limitada. El enlace usa fragmento de URL, firma HMAC con separación de finalidad, caducidad de 14 días y ningún dato personal en la URL. No hay acciones de escritura en GET. La página lo retira de la barra de direcciones, no lo guarda en almacenamiento del navegador y envía la solicitud únicamente al endpoint propio. Cada paquete se confirma una sola vez; una recepción parcial permite confirmar los restantes hasta que se complete o caduque el enlace. Una incidencia consume el enlace. No se confirma automáticamente al abrirlo ni se deduce recepción de aperturas de correo.

Los eventos usan claves idempotentes y restricciones por pedido/tipo/paquete. La recepción puede preceder a la evidencia del transportista sin duplicar correos. Las incidencias se calculan por la fecha real de evento: una resolución antigua no cierra una reclamación posterior. Una devolución física no modifica por sí sola stock ni reembolsa pagos. Los reembolsos se mantienen en su flujo existente.

## Correos y activación posterior a la revisión

El mantenimiento existente llama al nuevo worker, que sale sin consultar la base ni enviar si `POST_DELIVERY_ENABLED` no es `true`. Las dos banderas del ejemplo están en `false`.

Para una futura activación autorizada se exige una fecha explícita `POST_DELIVERY_ENROLLMENT_STARTS_AT`. Solo admite señales nuevas con fecha real y fecha de registro posteriores a ese corte. No incorpora compradores históricos ni modifica o reinicia Welcome Series. Los intervalos configurables son de 24 a 336 horas; por defecto, 48 horas para comprobar entrega y 72 para fidelización.

- `delivery_check`: tras entrega completa acreditada y sin recepción completa del cliente. Servicio y soporte, sin descuentos, solicitudes de reseña ni contenido comercial. Incluye enlace a recepción/incidencia y Reply-To corporativo.
- `post_delivery_loyalty`: tras recepción completa y solo si `POST_DELIVERY_LOYALTY_ENABLED=true`, con elegibilidad verificada en `marketing_email_contacts` y sin supresión vigente. Incluye baja real. Una invitación voluntaria a aportar fotografía/reseña no concede permiso para publicarla; el texto pide autorización específica antes de cualquier publicación.

Los dos tipos usan el renderer corporativo compartido y la misma validación antes del transporte. La cola fija destinatario y número de pedido; la firma del contenido detecta cambios de plantilla durante un reintento. Cada trabajo usa una clave estable de idempotencia de proveedor. Tras 23 horas desde el primer intento pasa a revisión en vez de arriesgar un nuevo envío fuera de la ventana del proveedor. No existe botón que reinicie esa ventana ni reenvío masivo.

Antes de enviar se releen pedido, elegibilidad comercial, banderas y lease. Incidencia, devolución, cancelación, cualquier reembolso, cambio de destinatario o pausa detienen mensajes no necesarios. No afectan al soporte solicitado ni a los avisos esenciales existentes. Las bajas y supresiones se comprueban para marketing; el correo de servicio no depende de consentir publicidad. Los estados del proveedor guardan inicialmente `accepted_by_provider`, nunca una entrega inventada.

## Acceso y minimización

`/api/admin/delivery` requiere administrador real en servidor, límites de frecuencia y validación de origen para escritura. La bandeja del cliente no puede marcar como acreditada una entrega del transportista. Un administrador no puede confirmar recepción haciéndose pasar por el cliente. La confirmación propia comprueba la cuenta, titularidad verificada y relación real con la reserva, o la capacidad firmada vigente. RLS niega acceso de cliente directo a eventos y cola; las funciones solo se ejecutan con el rol de servicio del servidor.

La consulta administrativa muestra fechas, fuentes, referencias y estado de trabajos, sin capacidades vigentes ni credenciales. La respuesta pública de una reserva elimina las nuevas referencias internas de evidencia y los datos internos de programación. El operador debe guardar únicamente referencias de tickets o documentos privados, no copiar imágenes ni datos personales en esas referencias.

## Verificación y límites

`tests/post-delivery.test.ts` comprueba pago/envío sin entrega, confirmación cliente anterior al transportista, elegibilidad comercial independiente, incidencias/reembolsos/devolución, exigencia de evidencia, límites de paquetes/fechas, caducidad/manipulación de enlaces, contenido de servicio sin promoción y banderas desactivadas. Se ejecuta sin pagos, correo ni base de datos reales.

Se aplicaron todas las migraciones fuente a PostgreSQL temporal local (PGlite), con servicios Auth, Storage y red simulados. En PostgreSQL se comprobaron evidencia obligatoria, dos paquetes parcial/completo, deduplicación de eventos y cola, incompatibilidad del total de paquetes, bloqueo de la antigua transición sin evidencia, incidencias/resoluciones desordenadas, recepción anterior al transportista, separación de fidelización, cancelación por reembolso/devolución, caducidad/replay/uso parcial del enlace y titularidad de cuenta/permisos anónimos.

Pendiente de una base Supabase Test autorizada: aplicar primero `050` y después `051`, comprobar integración de permisos RLS/Auth y concurrencia real con dos procesos. Pendiente de un buzón Test autorizado: envío puntual, recepción real y consulta de estado del proveedor. No se han realizado cargos, envíos ni cambios de proveedor; no se declara comprobada una integración logística que no existe.

## Reversión

La reversión operativa inmediata es mantener/poner `POST_DELIVERY_ENABLED=false` y `POST_DELIVERY_LOYALTY_ENABLED=false`. Deja los eventos y auditoría conservados. Un despliegue anterior de código no debe volver a ofrecer la transición de entrega sin evidencia: mantener el cierre SQL hasta revisar esos controles.

Antes de cualquier reversión de esquema, exportar con el mecanismo de backup autorizado los eventos, cola y columnas nuevas a almacenamiento privado; no incluir datos personales en el repositorio. Si todavía no hay eventos ni trabajos puede revertirse transaccionalmente eliminando el trigger `post_delivery_order_stop`, las funciones `private.cancel_post_delivery_after_order_change`, `public.pause_post_delivery`, `public.confirm_commerce_receipt`, `public.claim_post_delivery_job`, `public.queue_post_delivery_jobs`, `public.record_commerce_delivery`, `public.post_delivery_marketing_eligible`, las tablas `post_delivery_jobs` y `commerce_delivery_events`, y las columnas nuevas de `commerce_orders`. No ejecutar esa eliminación cuando haya auditoría histórica sin una estrategia de conservación aprobada. La función de fulfillment original se encuentra en `010_commerce_operations.sql`; su restauración requiere revisión porque vuelve a permitir la transición no acreditada.
