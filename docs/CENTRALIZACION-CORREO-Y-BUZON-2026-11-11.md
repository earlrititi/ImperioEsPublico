# Centralización del correo y Buzón — 11 de noviembre de 2026

Actualización del 12 de noviembre de 2026. El usuario autorizó la migración 055 y la publicación. La 055 está aplicada en Supabase Production y la cuenta corporativa IONOS está conectada con la credencial cifrada en Vault. La compilación final y las 23 comprobaciones esenciales han terminado correctamente. Los datos del despliegue se registran en la evidencia del corte.

La arquitectura y el orden operativo se mantienen en este documento. El registro de ejecución del corte se conserva fuera del repositorio, en `outputs/integracion-vscode/central-mail-2026-11-11/`, bajo la entrega del 6 de noviembre. Allí deben constar el backup y el SQL revisados, los resultados de aplicación y el commit/despliegue realmente publicados. Ese registro permite actualizar el estado del corte sin confundir una preparación o una prueba local con una acción externa terminada.

## Implementación

La ampliación del 12 de noviembre añade la vista fiel del pergamino en el lector, un archivo consultable de los registros locales y copias protegidas de nuevos envíos. La migración 056 incorpora los campos de cuerpo saneado y un aviso genérico para Auth. La recuperación del historial disponible en Resend utiliza un proceso de lectura y archivo, con claves estables por mensaje y destinatario. Las migraciones 056–057 y esa recuperación requieren la autorización específica del propietario antes de ejecutarse en producción.

El transporte de la aplicación utiliza una única fábrica de Resend y el renderer corporativo actual. `corporate-mail-transport.ts` conserva remitentes, destinatarios, opciones del proveedor, adjuntos y claves existentes. Los snapshots de reintento conservan su payload; no se reescriben cuerpos históricos ni se anidan plantillas. `customer-mail-catalog.ts` reúne los mensajes de clientes ya existentes y `auth-mail-catalog.ts` prepara los mensajes de autenticación admitidos.

`customer-mail-service.ts` añade auditoría prospectiva de **metadatos**, sin guardar HTML, texto del correo, contraseñas, URLs firmadas ni tokens. Conserva destinatario, remitente, asunto depurado, flujo, etapa, digests, identificador del proveedor y estado. La auditoría ordinaria es best effort: un fallo de registro produce un código fijo y no altera la respuesta de entrega. `CORPORATE_MAIL_AUDIT_ENABLED=false` permite desactivarla en QA; no sustituye ni desactiva la deduplicación estricta del hook Auth.

La tabla `customer_mail_deliveries` y sus RPC tienen acceso restringido a `service_role`, con RLS y permisos revocados a `anon` y `authenticated`. No tienen claves foráneas hacia Auth ni consultan usuarios dentro de la transacción del hook. Comunicaciones incorpora esta fuente sin eliminar las anteriores: deduplica por identificador auténtico del proveedor y conserva preferentemente el cuerpo de una fuente histórica que ya lo tenga. Las filas centrales muestran metadatos, con cuerpo nulo. Audiencia y los consentimientos comerciales no se modifican por registrar o consultar correo.

La aceptación del proveedor se registra como `accepted_by_provider`. Solo la evidencia explícita de entrega permite mostrar `delivered`; abrir una ficha, recibir un HTTP satisfactorio o aceptar un envío no acredita lectura ni entrega física.

## Autenticación de Supabase

Está preparado el endpoint `/api/auth/send-email-hook`. Verifica la firma HMAC de Standard Webhooks sobre los bytes originales, comprueba su antigüedad y valida el payload antes del envío. Supabase conserva la propiedad de los tokens y del estado de la cuenta; la aplicación entrega el mensaje solicitado mediante el renderer común.

El catálogo conserva el propósito de cada enlace de confirmación, invitación, recuperación o acceso y limita los destinos a las rutas internas admitidas. Para cambio de correo separa los destinatarios actual y nuevo y asigna sus hashes a la confirmación correspondiente. La reautenticación entrega el OTP solicitado, sin inventar un enlace de confirmación: admite códigos numéricos de 4 a 32 dígitos, sin suponer que la configuración siempre utiliza seis. Las notificaciones de seguridad no requieren un OTP y el aviso de cambio de dirección conserva como destinatario el correo anterior.

La deduplicación Auth usa una HMAC del payload firmado y una clave independiente para cada destinatario/slot. No depende de que Supabase conserve el mismo `webhook-id` al reintentar. `claim_customer_mail`, `complete_customer_mail` y `fail_customer_mail` controlan el claim, la aceptación y los fallos. Un mensaje ya aceptado devuelve su registro sin reenviarse; un cambio de payload pendiente se rechaza, un claim ocupado no se duplica y los intentos inciertos fuera de la ventana de 23 horas pasan a revisión. El lease es de diez segundos. No se promete envío exactamente una vez fuera de la ventana del proveedor ni se ejecutan reenvíos ciegos.

La configuración nueva requiere:

- `SUPABASE_AUTH_EMAIL_HOOK_SECRET`: secreto de firma del hook.
- `AUTH_MAIL_IDEMPOTENCY_SECRET`: secreto distinto y estable, de al menos 32 caracteres, para las HMAC de deduplicación. Su rotación debe considerar los intentos pendientes.
- La clave Resend y la URL pública ya utilizadas por el transporte corporativo.

Los valores secretos se configuran mediante los mecanismos protegidos de cada entorno; no se incorporan al repositorio, informes o logs. El endpoint devuelve un error de configuración mientras no estén preparados sus requisitos. Su rama Auth utiliza el ledger estricto y `audit:false`, para evitar una segunda auditoría genérica del mismo envío.

**SMTP y el proveedor Email actuales se mantienen configurados y habilitados** durante la activación y la verificación del hook. Mantener esa configuración no implica que exista un fallback SMTP automático ante un fallo del hook: sus errores se comunican para reintento. Las plantillas y los ajustes externos son distintos del renderer de la aplicación y su estado efectivo pertenece al registro operativo del corte. Se conserva el seguimiento de clics y aperturas desactivado (`false`), especialmente para los enlaces de autenticación.

## Buzón administrativo

`/admin/buzon` y `/api/admin/mailbox` requieren una sesión administrativa verificada. La interfaz distingue Recibidos, Enviados del buzón y Enviados por la web; enlaza a Redactar correo y al historial de Comunicaciones.

El adaptador IONOS fija `imap.ionos.es:993`, usa TLS con validación del certificado y mínimo TLS 1.2, y abre carpetas mediante EXAMINE/solo lectura. Lista metadatos con paginación por UID y comprueba UIDVALIDITY. La selección MIME distingue el cuerpo principal de los adjuntos y mensajes `message/rfc822`; no utiliza el cuerpo de un correo adjunto como si fuera el mensaje abierto. En `multipart/alternative` prefiere la alternativa HTML; también representa los mensajes `text/plain`, escapando su contenido literal para que no se ejecute como marcado. Solo obtiene la parte de texto elegida, con un límite de transporte de 2 MB. No expone cambios de flags, borrado, envío ni descarga automática de adjuntos. Los adjuntos se muestran como metadatos.

El HTML del mensaje se convierte en una vista inerte: sin recursos remotos, scripts, formularios ni enlaces activos dentro del contenido. Se muestra en un iframe con sandbox vacío y CSP propia restrictiva. Los enlaces públicos permitidos se presentan aparte y requieren una acción expresa del administrador. Las respuestas son privadas y los fallos externos se reducen a códigos, sin devolver la contraseña.

La vista avisa del truncado real: el límite de lectura MIME y los límites de previsualización son distintos. La previsualización limita HTML a 200.000 caracteres y texto a 100.000; `contentLimited` informa también de esos recortes, aunque el mensaje no llegue a 2 MB. Los mensajes propios de reautenticación reconocidos por su asunto muestran una indicación de código omitido en la copia de consulta. En IONOS no se descarga su parte MIME; en la consulta de Resend tampoco se presenta el OTP en la interfaz. El código continúa disponible en el correo original de su destinatario, no en el historial central de metadatos.

Si falta la credencial IMAP, **se introduce únicamente desde el panel administrativo después de aplicar 055**. El formulario comprueba primero la conexión cifrada y de solo lectura; después guarda la credencial protegida en Vault mediante las RPC restringidas. La contraseña se vacía de la interfaz tras el intento y no se almacena en `localStorage` ni `sessionStorage`. La credencial facilitada por el propietario se ha comprobado mediante TLS y guardado en Vault el 12 de noviembre.

La vista de Enviados por la web consulta el historial que conserva Resend y filtra por el remitente corporativo, tanto al listar como al abrir una ficha. Su búsqueda filtra la página de enviados consultada, no todo el historial externo. La comprobación real de solo lectura obtuvo una página de **25 mensajes propios**, con `has_more=true`: acredita ese acceso y la existencia de más páginas, sin constituir una importación ni un envío. La retención de Resend es limitada y esta consulta no constituye un archivo completo; Comunicaciones mantiene aparte las fuentes locales disponibles.

Este trabajo no realiza sincronización de fondo ni backfill histórico de IONOS. Tampoco copia los mensajes de Resend/SMTP a la carpeta Enviados de IONOS, configura buzones o MX, descarga adjuntos o importa automáticamente cuerpos al historial central. La cancelación en el navegador evita mostrar respuestas obsoletas; la consulta IMAP del servidor termina mediante su operación y sus timeouts, sin afirmar cancelación instantánea de la conexión remota.

## Verificación del corte

La compilación final y las 23 comprobaciones esenciales de transporte, firma Auth y lectura protegida han terminado correctamente. La revisión visual a 390 y 1440 px verificó el panel con la CSP actual. La conexión real de IONOS confirmó 18 mensajes en Recibidos, 8 en Enviados y 5 carpetas. La consulta real de Resend devolvió una página de 25 enviados corporativos con más resultados.

La evidencia está en `outputs/integracion-vscode/central-mail-2026-11-11/` y `mailbox-qa-2026-11-11/`, bajo la entrega del 6 de noviembre. Los registros del corte contienen resultados y metadatos.

La cobertura de avisos nativos de Stripe se describe en [Cobertura de correo de Stripe](STRIPE-EMAIL-COVERAGE-2026-11-11.md).

## Activación y reversión

El orden operativo del corte autorizado es:

1. Utilizar el conjunto exacto ya revisado y compilado. Comprobar el esquema de destino y validar el backup y el SQL que se aplicarán antes de ejecutar 055.
2. Aplicar 055 en el entorno acordado y comprobar tabla, RPC, RLS y vistas, registrando los resultados. Mantener desactivado el hook Auth durante esta fase y conservar SMTP/proveedor Email.
3. Publicar esa versión revisada y comprobar el commit y el despliegue efectivos. La auditoría genérica debe encontrar ya su esquema; mantener el seguimiento de clics/aperturas en `false`.
4. Configurar los dos secretos nuevos por sus canales protegidos, comprobar el endpoint y el ledger, y efectuar el cambio de hook en el orden acordado para el corte. Verificar los recorridos de confirmación y recuperación; registrar por separado qué configuración quedó activa y qué envíos de comprobación se realizaron a los destinos acordados.
5. Después de 055 y del despliegue, el propietario puede introducir la credencial IONOS en el panel. Comprobar allí lectura, paginación y cobertura; no iniciar una importación histórica implícita.

Para revertir una activación, retirar primero el hook Auth y restaurar el recorrido SMTP/proveedor Email anterior antes de publicar código que carezca del endpoint. Un fallo de auditoría ordinaria puede contenerse con `CORPORATE_MAIL_AUDIT_ENABLED=false`; ese interruptor no reemplaza el rollback del hook ni del ledger estricto. Conservar registros aceptados, claves, consentimientos y eventos: no borrar 055, reiniciar colas o regenerar identidades para forzar reenvíos. Aplicar y verificar la reversión dentro del alcance acordado de la intervención y dejar sus resultados en el registro externo del corte.

Este documento describe el funcionamiento y el orden de la intervención; el estado inicial del corte indicado arriba solo se actualiza con evidencia de ejecución.
