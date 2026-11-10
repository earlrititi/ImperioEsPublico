# Integración local del pergamino y Comunicaciones — 7 de noviembre de 2026

Se integraron los 90 archivos de la entrega preparada sobre la base `469736dfc1923506fa47938517888bab6c43260e`, en la rama local `feat/pergamino-integracion` de `earlrititi/ImperioEsPublico`. No se empezó de cero. La eliminación local previa de `public/images/subscription-x-brush.png` se conserva. No se ha hecho commit, push, PR ni despliegue.

## Cambios adicionales al paquete recibido

- `communications-model.ts`: oculta secretos sobre texto HTML decodificado completo, incluidos valores con entidades y fragmentados entre etiquetas; conserva la vista inerte, el aislamiento y el bloqueo de recursos remotos.
- `admin-communications.ts`: la búsqueda rápida de mensajes también consulta el remitente, para encontrar al cliente que escribe al buzón corporativo.
- `Communications.tsx`: ignora respuestas de fichas obsoletas mediante aborto y generación, cancela al cerrar/cambiar consulta y gestiona foco y pestañas por teclado con relaciones ARIA.
- Contacto y modal del manifiesto en inicio (`Services.jsx`): se retiraron dos casillas innecesarias de reconocimiento de privacidad; quedan avisos informativos enlazados. El modal conserva únicamente marketing opcional y Contacto no crea altas comerciales. Se actualizaron la regresión del modal y la integración compilada de Contacto.
- SQL `051`: los enlaces de recepción caducan 14 días después de la fecha programada del correo; incluso un intervalo de 336 horas conserva una ventana de respuesta. Reencolar no cambia esa caducidad. Cancelación/reembolso/incidencias limpian la próxima fecha de correo y actualizan el resumen junto con la cola.
- `package.json` y lock: override limitado a `@vercel/nft → glob 14.0.2`, comprobado con instalación limpia y compilación. Corrige la cadena afectada por [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) y [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Se preservaron los metadatos originales de los opcionales `@emnapi` necesarios para `npm ci`.

## Captación, avisos y cobertura real

| Entrada | Aceptación y marketing |
| --- | --- |
| Registro PIQUERO | Condiciones obligatorias y marketing opcional; ambas casillas desmarcadas |
| Suscripción digital | Aceptación agrupada que conserva las declaraciones digitales; marketing separado y opcional |
| Camiseta / reservas | Condiciones y marketing independiente; compra como invitado |
| Newsletter / PDF | Una casilla comercial opcional; el recurso no depende de aceptarla |
| Manifiesto y promoción de camiseta | Información de privacidad y marketing opcional |
| Modal del manifiesto en inicio | Información de privacidad; una única casilla comercial opcional |
| Contacto | Aviso informativo, sin casilla de privacidad ni suscripción comercial |

Las cookies siguen separadas. El máximo de dos se refiere a casillas legales/comerciales: el control funcional de enviar a otra persona y las categorías de cookies se conservan aparte. Login, recuperación, cambio de contraseña y desistimiento no añaden marketing; cuenta utiliza una preferencia explícita del titular verificado. Footer y promociones que remiten a otro formulario no crean captación duplicada. La búsqueda de formularios abarcó todas las extensiones presentes en `src`, incluido JS/JSX. Los consentimientos conservan versión y origen. Comprar o descargar un PDF no acredita titularidad ni suscribe a publicidad. Verificación comercial, Welcome central y avisos administrativos están implementados y probados con fixtures, pero sus nuevas banderas siguen apagadas. Se reutilizan colas y definiciones existentes, sin reiniciar series, resuscribir bajas ni incorporar históricos.

Comunicaciones y Audiencia consultan fuentes existentes con autorización del servidor, paginación, estados, cobertura y fichas. Las métricas distinguen cuentas/clientes de contactos comerciales, elegibilidad, pendiente de verificación, baja/supresión, origen, Welcome y recepción. La entrega de email exige evidencia del proveedor; pago, envío, apertura y clic siguen separados. IONOS se muestra no sincronizado. No se ha importado ningún buzón ni demostrado acceso a datos reales por este trabajo.

## Verificaciones realizadas

Se creó una copia aislada del código integrado, sin copiar configuración Live, usando 13 variables fixture y una instalación limpia de dependencias. Node `24.11.1`. Las pruebas y la compilación bloquearon conexiones Socket/TLS y desactivaron telemetría. La auditoría npm se hizo aparte, consultando solo el registro público con el lock final.

| Comprobación | Resultado |
| --- | --- |
| Astro / tipos | 457 archivos en la copia con arnés local, 0 errores, 0 warnings; 7 hints previos |
| Unitarias | 225/225 |
| Build y postbuild | Correctos, con el override de glob; compilar no despliega |
| Lint | General, admin, SEO y revisión focalizada correctos |
| Integración compilada | Comercio, pagos/webhooks simulados, autenticación, consentimiento, correo, preferencias, Welcome, scheduler/reintentos, GA4, CMS y ajustes correctos |
| PostgreSQL temporal | Todos los SQL fuente existentes hasta 053 aplicados en PGlite; regresiones de consentimiento, permisos, paquetes, recepción, supresión, leases y caducidad correctas |
| Auditoría de producción | `npm audit --omit=dev`: 0 vulnerabilidades con el lock final |
| Coincidencia de código verificado | 91/91 archivos: manifiesto original más lock actualizado, antes de esta actualización documental |
| Correos en Chrome | 93 capturas reales; 8 fixtures en 11 anchos, variantes oscuras y final del correo largo |
| Comunicaciones / Audiencia en Chrome | 22 layouts en los 11 anchos, fichas, búsqueda, paginación, bandeja desconectada, pestañas por teclado y respuestas tardías/invertidas correctos |
| Formularios en Chrome | 59 layouts; sin desbordamientos ni errores JS; casillas desmarcadas, marketing opcional y máximo dos casillas legales/comerciales |

Los pasos de `verify:master` se ejecutaron por etapas, junto con la auditoría externa separada. No se presenta como una ejecución monolítica con red abierta. PGlite utiliza Auth/storage/red simulados y omite únicamente la carga de pgcrypto, con UUID nativo; no acredita Supabase real ni concurrencia de varias sesiones remotas.

Las capturas proceden de Chrome real con sandbox activado y datos sintéticos rotulados. Solo se permitieron peticiones a localhost. El arnés de formularios usa lecturas simuladas de catálogo/Stripe y bloquea envíos, pagos y POST entrantes. La ausencia de token en las vistas de confirmación/recepción se muestra como tal. La prueba de la ficha aislada produjo un aviso de la instrumentación `serviceWorkers:block` de Playwright al consultar una propiedad prohibida dentro del iframe sin permisos; se conserva por separado del resultado funcional y no se amplió el sandbox.

La unión de textura entre segmentos del pergamino sigue siendo perceptible; no corta el texto. No están certificados Gmail, Outlook, Apple Mail, Yahoo, IONOS, VML ni inversiones de color propias de esos clientes.

## Evidencia local y reproducción

Raíz de evidencia: `C:\Users\lorit\Documents\Codex\2026-11-06\referenced-chatgpt-conversation-this-is-an\outputs\integracion-vscode`.

- `verification-results-final.json`, `verified-code-hashes.json` y logs de cada suite.
- `audit-dependencies/audit-production-final.json`.
- `qa-email-browser.json`, `QA-EMAIL-VISUAL.md`, `screenshots-email/index.html`.
- `qa-dashboard-results.json`, `qa-forms-results.json`, `screenshots/dashboard` y `screenshots/forms`.
- Scripts `qa-dashboard.mjs`, `qa-forms-browser.mjs`, `qa-email-browser.mjs`; los arneses están fuera de la web publicada.
- `estado-previo.txt` y `cambios-locales-previos.patch` conservan la situación anterior.

La copia `verify-project` permite reproducir las verificaciones sin tocar `.env.local` del principal. No iniciar `npm run dev` en el principal con su configuración Live para validar estos cambios. Las dependencias del principal no se sustituyeron; la instalación limpia comprobada corresponde a la copia aislada y al lock entregado.

## Correo de prueba autorizado el 7 de noviembre

El usuario autorizó expresamente un envío a su buzón de prueba. Se envió **un único mensaje** desde la dirección corporativa existente, con el renderer compartido, asunto «Imperio Español | Prueba de la plantilla de pergamino», texto real y los cuatro assets oficiales incrustados mediante CID (92.068 bytes). Pasó la validación de contenido, referencias y ausencia de datos personales del titular. No se modificaron suscriptores, colas comerciales ni campañas. El proveedor informó `delivered`; esto acredita su evento de entrega, no la carpeta de destino, lectura ni fidelidad visual en Gmail.

La comprobación HTTP encontró las cuatro URLs canónicas nuevas en 404, coherente con que no se ha desplegado el paquete. La prueba usa [imágenes inline soportadas por Resend](https://resend.com/docs/dashboard/emails/embed-inline-images) para no depender de publicar assets. El HTML de producción conserva HTTPS; no se sustituyó globalmente su transporte por CID. El resultado y el intento idempotente están en `authorized-preview-result.json` y `authorized-preview-intent.json`, fuera del repositorio. La clave del proveedor se leyó solo en memoria desde la configuración existente para este envío autorizado, sin copiarla a QA, logs ni entregables.

La plantilla corporativa y este mensaje de prueba no contienen datos personales del titular. Las referencias restantes de `src/config/legal.ts` son identificación legal/fiscal reutilizada por pies obligatorios de contratación, comercio y marketing; se conservan. La coincidencia de `src/config/home.js` corresponde a una figura histórica. No se afirma que la identidad exigida haya desaparecido de todos los correos o documentos.

## Pendiente de autorización o validación externa

1. Aplicar y comprobar 050–053 en Supabase Test autorizado, con Auth/RLS, scheduler y concurrencia real. No se aplicó ninguna migración a servicios reales.
2. Validación jurídica de la aceptación digital agrupada y de la actualización de privacidad antes de producción. Se conserva la identidad jurídica/fiscal y el historial protegido.
3. Configurar secretos y revisar fecha prospectiva, digest e intervalos antes de activar Welcome central, avisos, verificación comercial o posentrega. No activar campañas ni backfills por esta integración.
4. Completar pruebas de flujos de Test, baja y renderizado en clientes de correo reales. Solo se autorizó y entregó el mensaje puntual descrito; no se han enviado campañas. Publicar los assets HTTPS por una vía autorizada antes de activar el diseño en producción.
5. Implementar/proporcionar transporte IMAP TLS de solo lectura y autorizar el buzón IONOS. Están preparados contrato incremental, cursores, commit idempotente y retención; el transporte real sigue pendiente.
6. Configurar las plantillas externas de Supabase Auth, Stripe e IONOS mediante sus mecanismos soportados. No se cambiaron esos proveedores ni DNS/MX.

PR y despliegue: no creados, por los límites expresos del encargo. El único correo real fue la prueba expresamente autorizada descrita arriba; no se ejecutaron cargos.

## Reversión

Mantener apagadas las banderas nuevas conserva la reversión operativa; `EMAIL_PARCHMENT_ENABLED=false` permite el fallback del renderer. Conservar consentimientos, eventos, historial y colas. El esquema no debe volver a permitir marcar entrega sin evidencia. `rollback-communications.sql` documenta la reversión de vistas sin borrar mensajes ni datos de negocio.

El parche final de integración excluye la eliminación local previa. Antes de una reversión local, revisar las modificaciones posteriores y comprobar el parche inverso; no ejecutar resets ni borrados generales. Toda migración real o reversión de esquema requiere backup y autorización específicos.
