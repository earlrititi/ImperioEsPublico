# Kit pergamino, captación, comunicaciones y posentrega

Base inspeccionada: `469736dfc1923506fa47938517888bab6c43260e`, repositorio ImperioEsPublico. El kit completo se descomprimió y se leyeron los prompts, anexos, templates y manifest. Los dos prompts largos solo difieren en títulos de ensamblado. Se conservaron diseño público, contenido original, pagos, precios, stock y datos jurídicos/fiscales.

## Captación implementada

Registro PIQUERO: una casilla de condiciones con aviso/enlace de privacidad y otra comercial opcional; ninguna premarcada. Suscripción digital: una aceptación explícita que conserva las cuatro declaraciones existentes (condiciones, privacidad, inicio inmediato y consecuencias del desistimiento), registradas por separado; una segunda casilla comercial opcional. Camiseta: mantiene condiciones y marketing independiente. Newsletter/PDF: entrega por email sin publicidad obligatoria y descarga directa sin cuenta; una casilla comercial opcional. Manifiesto: privacidad informativa y la misma casilla comercial, sin consentimiento ficticio de privacidad. Cookies se conservan separadas.

`marketing_email_contacts` es el read model de elegibilidad verificada para cuentas y contactos sin cuenta. No convierte una compra ni la aceptación del proveedor del PDF en prueba de titularidad. `marketing_email_verifications` conserva consentimiento/versionado, token irreversible, caducidad y estado; el enlace requiere acción explícita POST, se consume una vez, no muestra el email y no obliga a crear cuenta. Los reintentos conservan mensaje/token/clave del proveedor; tras 23 horas no se repite una petición incierta. Una nueva petición explícita puede renovar una verificación caducada sin levantar bajas o bloqueos.

La Welcome Series central reutiliza `marketing_automation_jobs`, definiciones y renderer existentes. Una única serie por email normalizado, con exclusión entre el worker anterior y el central; la compra no impide la bienvenida cuando existe consentimiento. El primer paso del valor por defecto pasa a inmediato; los otros intervalos y todos los textos existentes se conservan. Las definiciones aprobadas persistidas siguen prevaleciendo: revisar/reaprobar el digest para adoptar esa programación. No se sobrescriben campañas ni se reinician series. Los avisos de suscripción confirmada usan destinatario administrativo ya configurado, cola privada, cursor, reintentos y deduplicación. El aviso operativo de cuenta nueva sigue siendo una notificación distinta.

Flags nuevos desactivados por defecto: `MARKETING_CONTACT_VERIFICATION_ENABLED`, `MARKETING_CENTRAL_WELCOME_ENABLED`, `MARKETING_SUBSCRIBER_NOTICES_ENABLED`. `MARKETING_VERIFICATION_SECRET` debe ser un secreto servidor de al menos 32 caracteres. El modo de transporte y la clave Stripe deben coincidir; Test solo admite su destinatario configurado. Los fallos de confirmación comercial no bloquean recurso, reserva ni checkout. No hay incorporación masiva retroactiva.

## Correo y administración

Ver `email-template-coverage.md`, `COMMUNICATIONS-DASHBOARD.md` y `post-delivery.md`. El renderer compartido conserva los mensajes auténticos y una base vacía no enviable; los assets proceden del kit. Comunicaciones y Audiencia son consultas reales de fuentes existentes, protegidas en servidor, paginadas y auditadas; no son datos de demostración dentro de la aplicación. El arnés de QA separado usa únicamente datos sintéticos.

Las aperturas/clics se guardan como tales. `provider_delivery_confirmed_at` solo se establece al observar un evento `delivered`; los registros anteriores sin procedencia suficiente no se convierten en entregas confirmadas. No se reescribe ni borra el historial original.

## Verificación reproducible

Usar Node 24 (Node 22.13 del PATH local no satisface Astro instalado). `.env.local` de la copia contiene exclusivamente fixtures, transporte desactivado y ninguna credencial real. Ejecutar `npm run verify:master`, lint de las nuevas librerías y `node scripts/verify-marketing-contacts.mjs` tras compilar.

`scripts/verify-pergamino-db.mjs` aplica los SQL originales 001–053 a PostgreSQL WASM temporal (PGlite), con servicios Auth/storage/net de prueba y sin conexión externa. La única sustitución de los SQL es omitir la carga de pgcrypto: UUID está disponible de forma nativa. Requiere `@electric-sql/pglite` instalado para QA, o `PGLITE_MODULE_PATH` apuntando al módulo. No es una prueba de la configuración del proyecto Supabase Test real ni de su scheduler externo.

Se comprobaron verificación/consentimiento/bajas, permisos anónimos, deduplicación por email, compra elegible, claims de worker, paquetes parciales, evidencia, cronología desordenada, reintentos, incidencias/devoluciones/contracargos, enlaces limitados de recepción y procedencia de entrega de email. Las pruebas compiladas usan transporte simulado con conexiones reales bloqueadas.

La entrega inicial contenía previews HTML sin capturas verificadas. La continuación del 7 de noviembre completó capturas reales en Chrome de correos, formularios y panel en los anchos del kit, con fixtures y red externa bloqueada. Ver [informe de integración](PERGAMINO-INTEGRATION-2026-11-07.md). No se ha probado Gmail, Outlook, Apple Mail ni IONOS; no afirmar compatibilidad verificada ni fidelidad VML.

## Pendientes de activación

1. Aplicar y comprobar 050–053 en Supabase Test autorizado, incluyendo concurrencia de varias sesiones y permisos reales. No se han aplicado a ningún Supabase.
2. Revisar jurídicamente la presentación agrupada de aceptación digital y la actualización de la política de privacidad antes de producción; no se cambiaron identidad, documentos legales ni fiscalidad.
3. Configurar los secretos/flags en Test, revisar fecha prospectiva y digest de plantillas. Autorizar un envío puntual a un buzón de prueba y comprobar assets HTTPS tras publicación autorizada.
4. Conectar IONOS con transporte IMAP TLS de solo lectura y autorización acotada; el contrato incremental y las tablas privadas están preparados, el transporte real no está conectado. Verificar retención, respuestas y cabeceras antes de importar.
5. Configurar por mecanismos soportados las plantillas externas de Supabase Auth, Stripe e IONOS manual. El repositorio no modifica sus editores.
6. Revisar los clientes reales de correo; las capturas locales de Chrome ya están documentadas en el informe de integración. No activar campañas, backfills ni despliegue de producción sin autorización explícita.

## Reversión

Antes de migrar, obtener un backup autorizado. La reversión operativa consiste en desactivar flags nuevos y mantener el esquema, consentimientos, mensajes y eventos auditados. El renderer admite `EMAIL_PARCHMENT_ENABLED=false`. No restaurar la transición antigua DELIVERED sin evidencia. `docs/rollback-communications.sql` revierte las vistas sin borrar buzones ni pedidos; las columnas de procedencia se conservan. No eliminar tablas o evidencias con datos sin plan de conservación y validación.
