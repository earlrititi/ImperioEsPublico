# Comunicaciones y audiencia — entrega local del 6 de noviembre de 2026

Actualización del 7 de noviembre: los archivos están integrados en el proyecto principal y las vistas, búsqueda, paginación, fichas y accesibilidad se comprobaron en Chrome con datos sintéticos. Se corrigieron ocultación de secretos HTML, búsqueda por remitente y respuestas de ficha obsoletas. Ver [informe de integración y evidencia](PERGAMINO-INTEGRATION-2026-11-07.md); IONOS continúa no sincronizado.

Implementación sobre Astro, Supabase y las colas actuales, sin despliegue, acceso a bases remotas, recuperación de buzones, envíos ni cambios de DNS/MX. No se declara recuperado el historial completo.

## Rutas y permisos

`/admin/comunicaciones` y `/admin/audiencia` usan `requireAdmin` en servidor. Los endpoints `/api/admin/communications` y `/api/admin/audience` repiten la autorización antes de consultar cualquier dato. Las vistas/tablas nuevas carecen de permisos para `public`, `anon` y `authenticated`; solo el servidor con `service_role` puede consultarlas. No hay un endpoint público de sincronización, descargas de adjuntos ni acciones de respuesta/reenvío/borrado/marcado de leído.

Consultas y exportaciones se registran en `commerce_audit` con actor, acción y UUID de operación, sin email, búsqueda, cuerpo o token. Respuestas sin caché, sin referencias externas, sin almacenamiento del navegador. La exportación está deshabilitada salvo que `ADMIN_PII_EXPORT_IDS` contenga expresamente el UUID autorizado; incluso entonces requiere POST del mismo origen, confirmación `DESCARGAR`, límite de frecuencia y máximo de 50 filas por operación. El CSV neutraliza fórmulas. Las funciones existentes conservan su propia autorización y reglas de envío.

## Matriz de cobertura

| Fuente | Recuperable desde la base actual | Límites |
| --- | --- | --- |
| `email_logs` | Correo manual/campañas, asunto original, estado, destinatario, snapshot si existe, conciliación e ID Resend | No incluye mensajes enviados fuera de esta aplicación |
| `marketing_automation_jobs` | Welcome y recuperaciones, contacto por usuario o email, paso, programación, proveedor | Cuerpo/asunto original solo si se conserva el payload; apertura/clic no prueban lectura |
| `marketing_email_verifications` | Solicitud de verificación, fecha e ID Resend | Nunca se expone `token_hash`, enlace ni código de acceso; cuerpo histórico no conservado |
| `marketing_subscription_notices` | Confirmación administrativa de suscripción, contacto asociado e ID proveedor | Contacto asociado no se confunde con destinatario administrativo: si no se conservó, se muestra desconocido |
| `commerce_outbox` | Reserva, confirmación de pedido y resto de tipos en la cola, pedido asociado | Solo referencia de plantilla y aceptación; no se descifra el mensaje ni se inventa entrega |
| `post_delivery_jobs` | Comprobación de recepción y posentrega, pedido, fecha, estado y proveedor | Sin tokens de recepción ni datos de leases; contenido histórico no conservado |
| `manifesto_requests` | Solicitud PDF/manifiesto/Siete historias, fecha e ID proveedor | No hay snapshot completo ni eventos históricos del proveedor |
| `marketing_leads` | Constancia local de envío de cupón | Sin ID proveedor: se muestra «solo registro» |
| `paid_order_admin_outbox`, `seo_jobs` | Avisos administrativos/editoriales e IDs proveedor | Destinatarios no conservados no se deducen del cliente; no se muestran datos administrativos innecesarios |
| IONOS / otras bandejas / correo manual externo | **No conectado ni recuperado** | No se conocen credenciales, permisos ni alcance real. Resend saliente no proporciona acceso al buzón |
| Auth / formularios / avisos históricos fuera de las colas | **No incluidos** | No existe una fuente recuperada de mensaje original en este trabajo |

La UI calcula para cada fuente `history_from`, último registro, última conciliación real, número de registros e IDs proveedor sobre los datos disponibles. La hora de consulta de la base se etiqueta separadamente de la última sincronización externa. Las fechas de filas están en `Europe/Madrid`; los filtros de fechas indican UTC. La cuenta de cobertura es por fuente; el listado deduplica IDs auténticos del proveedor, por lo que no necesariamente se suman como mensajes únicos.

No se transforma `sent`, `opened` o `clicked` en `delivered`. Los estados conservados se distinguen de la aceptación y de la entrega confirmada. Los hitos del detalle son los que conserva cada cola; no se fabrican eventos o reintentos individuales ausentes. Los asuntos de plantilla se etiquetan como referencia cuando el original ya no está almacenado.

## Audiencia completa

La vista agrupa exclusivamente la misma dirección normalizada y conserva los IDs de fuentes. Incluye perfiles PIQUERO, reservas, solicitudes de recursos, leads, verificación, supresiones, campañas, automatizaciones y clientes de suscripciones. No deduce consentimiento de una compra o una cuenta. La elegibilidad procede de `marketing_email_contacts`; la supresión se consulta en `marketing_suppressed_contacts` y prevalece sobre las demás fuentes. Se muestran bajas, bloqueos/rebotes, pendientes de verificar y clientes sin consentimiento en estados distintos. Las identidades administrativas de la aplicación se excluyen del directorio visible.

Fichas con consentimiento/versiones/canal cuando consta, preferencias, fuentes y sus IDs, correos, pedidos y eventos de entrega/recepción. La cronología tiene paginación independiente de 25 hitos. Las métricas globales por estado, fuente, Welcome Series y recepción no se calculan sobre la página visible. La consulta no cambia consentimientos ni reanuda secuencias.

## Bandeja preparada, todavía desconectada

`mailbox-sync.ts` implementa el protocolo de trabajo mediante un transporte **inyectado** de solo lectura sobre TLS. No contiene credenciales ni un cliente IMAP conectado. Requiere autorización y un `import_since` expresos, limita la retención a 1–365 días (90 por defecto), sincroniza páginas de 100, verifica UIDVALIDITY, valida direcciones, conserva solo cabeceras relevantes, sanea el contenido y usa un commit transaccional con comparación de cursor. Un UIDVALIDITY distinto exige una reimportación de alcance aprobado. Los duplicados por UID/Message-ID actualizan su referencia en vez de crear una copia. Los borrados observados y el estado visto solo se importan si el transporte los ha sincronizado realmente.

Las referencias a conversaciones se basan en Message-ID e In-Reply-To verificables. No se vincula por asunto o nombre. Los adjuntos se reducen a nombre/tamaño y no se pueden descargar: faltan almacenamiento privado y revisión autorizada. La vista HTML bloquea scripts, formularios, imágenes/rastreadores, CSS externo, recursos y enlaces activos, se muestra en iframe sin permisos y oculta enlaces de acceso/verificación y secretos. Se conserva una referencia inerte de destinos permitidos sin parámetros ni fragmentos.

Antes de la primera conexión de prueba, pendiente:

1. Confirmar con el titular dónde están realmente los buzones y aliases y el alcance histórico permitido.
2. Autorizar una identidad mínima de lectura del buzón de prueba; guardar secretos mediante el gestor de entorno, nunca en chat ni repositorio.
3. Implementar/proporcionar el transporte IMAP oficial compatible, con TLS y modo lectura obligatorios; verificar que reporta flags, borrados y cursor de forma real.
4. Configurar un job privado y un plan de reintentos/backoff y límites acorde al proveedor. No está activado en este trabajo.
5. Insertar la configuración autorizada de `communication_mailboxes`; ensayar una respuesta real con cabeceras y una importación acotada, cambio de UIDVALIDITY, repetición y borrado.
6. Programar `prune_communications_data()` para que se cumpla la retención aunque el dashboard no se consulte. También se ejecuta al consultar el módulo y al importar. Elimina solo mensajes del nuevo almacén fuera del alcance de cada buzón y auditoría de consultas/exportaciones de este módulo mayor de 180 días; no borra las colas ni auditorías comerciales existentes.

## Pruebas y migraciones

Aplicar primero en una base Test: `050`, `051`, `052_communications_read_models.sql`, `053_mailbox_incremental_commit.sql`, con sus dependencias previas. No aplicar automáticamente a Live. `tests/admin-communications.test.ts` cubre estados reales, sanitización/secretos, filtros y paginación en base, exclusión de cuerpos/tokens del listado, denegación de todos los tipos de consulta/exportación sin admin, auditoría sin PII, exportación cerrada por defecto, modo desconectado y sincronización incremental de transporte de prueba.

El arnés local `../communications-qa` queda **fuera del código de la web**: carga el componente real con datos sintéticos claramente rotulados para verificar escritorio/móvil, búsqueda, paginación y vistas. Sus capturas no acreditan acceso a datos reales ni a IONOS. La conexión de buzón, pruebas con respuesta real y validación de datos de producción siguen pendientes de autorización e integración.

## Rollback

Revertir las rutas/componentes/lecturas de este cambio restaura el menú anterior; no altera los datos de negocio. Para revertir las vistas en Test, después de detener cualquier futuro job de buzón, ejecutar el script revisable `docs/rollback-communications.sql`. Antes de eliminar las dos tablas nuevas, decidir y documentar la eliminación o conservación autorizada de sus datos. No se incluye una orden de eliminación de las tablas y mensajes: permanecerán privados hasta esa decisión. Las colas, consentimientos, contactos y pedidos existentes no se eliminan.
