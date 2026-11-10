# Cobertura de correos: pergamino compartido

## Implementación y alcance real

`src/lib/corporate-email.ts` contiene el renderer compartido, saneamiento de HTML y validación previa al transporte. `prepareCorporateEmail` se ejecuta en el singleton de Resend y en todos los emisores directos inventariados. Los asuntos, textos originales, destinatarios, reply-to, adjuntos, tokens, headers e idempotency keys pertenecen a sus flujos y se conservan. Los valores dinámicos de nombre/producto/talla se escapan en los antiguos correos de cuenta y compra.

Los assets proceden exclusivamente del kit aprobado. `scripts/prepare-email-assets.mjs` redimensiona los segmentos a 600 px y los comprime sin redibujar logos o sello; el manifest público registra SHA256 de origen y salida, medidas y bytes. Peso total de los cuatro segmentos: 92.068 bytes. Las URLs canónicas son `https://imperioes.com/images/email/pergamino-v1/*`; estarán disponibles públicamente al desplegar los archivos estáticos, pendiente de autorización. El renderer no envía imágenes base64 ni SVG inline.

La base vacía usa `renderCorporateEmail({empty:true})` y nunca puede pasar la validación de envío. El cuerpo crece en flujo normal antes del pie de firma/nao; no tiene altura máxima ni superposición. Las tablas, estilos inline, colores de reserva y texto alternativo conservan una lectura semántica al bloquear imágenes. Se utilizan enlaces web y perfiles ya presentes en `src/config/site.ts`.

El panel de correo y newsletter reutiliza el renderer con selector móvil/escritorio. `GET /api/admin/mail?template=empty` exige administrador igual que los otros endpoints. Solo las respuestas de preview servidas desde localhost remapean las imágenes al servidor local; los payloads de envío mantienen HTTPS canónico.

## Matriz de emisores

Cada fila describe cobertura de código comprobable. La matriz siguiente conserva el estado de la entrega inicial, sin envíos reales. La continuación del 7 de noviembre añadió 93 capturas reales de fixtures del renderer compartido en Chrome y **una prueba puntual autorizada**, que el proveedor confirmó entregada, con assets CID y sin datos personales del titular; ver [informe de integración](PERGAMINO-INTEGRATION-2026-11-07.md). No equivale a probar el envío individual de cada fila ni a certificar su renderizado en clientes de correo.

| Evento | Tipo | Código responsable | Proveedor | From | Subject | Plantilla | Variables preservadas | Estado | Captura móvil/web | Prueba de envío | Bloqueos/observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cuenta PIQUERO activa | Transaccional | `emails.ts` → `resend.ts` | Resend | Corporativo existente | Original | Compartida | Nombre | Integrado | HTML preparado; sin captura | Simulada/tests | No modifica Auth externo |
| Suscripción de pago activa | Transaccional | `emails.ts` → singleton | Resend | Existente | Original | Compartida | Plan, precio, periodicidad, versión condiciones | Integrado | HTML preparado; sin captura | Simulada/tests | No modifica cobros |
| Descuento de suscripción | Servicio de suscripción existente | `emails.ts` → singleton | Resend | Existente | Original | Compartida | Código, plan, porcentaje, referencia | Integrado | HTML preparado; sin captura | Simulada/tests | No se amplía audiencia |
| Pago de suscripción fallido | Transaccional | `emails.ts` → singleton | Resend | Existente | Original | Compartida | Destinatario | Integrado | HTML preparado; sin captura | Simulada/tests | Flujo sin cambios |
| Suscripción cancelada | Transaccional | `emails.ts` → singleton | Resend | Existente | Original | Compartida | Destinatario | Integrado | HTML preparado; sin captura | Simulada/tests | Flujo sin cambios |
| Compra de merchandising antigua | Transaccional | `emails.ts` → singleton | Resend | Existente | Original | Compartida | Producto, talla | Integrado | HTML preparado; sin captura | Simulada/tests | Texto conservado |
| Reserva, lista de espera, invitación y estados comerciales | Transaccional | `commerce-mail.ts` | Resend directo | Existente | Original por estado | Compartida, desde texto real | Pedido/reserva, artículos, importes, gestión firmada, dirección | Integrado | HTML preparado; sin captura | Simulada/tests | Nuevas snapshots antes de cifrar |
| Aviso administrativo de reserva | Operativo interno | `commerce-mail.ts`, `admin-notifications.ts` | Resend directo | Existente | Original | Compartida | Datos operativos originales | Integrado | HTML preparado; sin captura | Simulada/tests | Acceso interno |
| Aviso administrativo de pedido pagado | Operativo interno | `paid-order-admin-mail.ts` | Resend directo | Existente | Original | Compartida | Pedido/dirección/tallas/importes | Integrado | HTML preparado; sin captura | Simulada/tests | Snapshot cifrada, misma clave de retry |
| Registro, manifiesto/newsletter e interés de suscripción: avisos | Operativo interno | `lead-notifications.ts` → singleton | Resend | Existente | Original | Compartida | Origen/nombre/correo/plan | Integrado | HTML preparado; sin captura | Simulada/tests | Reglas de elegibilidad en flujo |
| Aviso de suscripción pagada | Operativo interno | `stripe-webhook.ts` → singleton | Resend | Existente | Original | Compartida | Factura, plan, periodicidad | Integrado | HTML preparado; sin captura | Simulada/tests | No cambia webhook ni deduplicación |
| Formulario de contacto y desistimiento | Soporte | `api/contact.ts` → singleton | Resend | Existente | Original | Compartida | Texto escapado, remitente y referencia | Integrado | HTML preparado; sin captura | Simulada/tests | Reply-to original |
| Acuse de desistimiento | Servicio | `api/contact.ts` → singleton | Resend | Existente | Original | Compartida | Nombre, referencia, fecha | Integrado | HTML preparado; sin captura | Simulada/tests | No se agrega marketing |
| PDF histórico y manifiesto | Servicio/recurso solicitado | `api/manifesto.php.ts` → singleton | Resend | Existente | Original | Compartida | PDF adjunto, enlaces y preferencias | Integrado | HTML preparado; sin captura | Simulada/tests | Entrega independiente de marketing |
| Correo individual/prueba desde admin | Marketing/operativo según flujo | `admin-mail.ts`, `admin-mail-template.ts` | Resend directo | Existente | Redactado | Compartida | Texto/CTA/preheader/baja | Integrado | Preview común | Simulada/tests | Confirmación de envío existente |
| Newsletter de campañas | Marketing | `admin-mail.ts`, `api/admin/newsletter.ts` | Resend directo | Existente | Redactado | Compartida | Segmento, CTA, baja firmada | Integrado | Preview común | Simulada/tests | No se ha activado ninguna campaña |
| Welcome Series y automatizaciones existentes | Marketing | `automation-worker.ts`, `renderAdminMail` | Resend directo | Existente | Original por paso | Compartida | Personalización, campaña, baja | Integrado | Preview común | Simulada/tests | Activación/elegibilidad controlada por flujo |
| Revisión, publicación y alertas editoriales SEO | Operativo interno | `seo-engine-worker.ts` | Resend directo | Existente | Original | Compartida | Fuentes/avisos/enlaces privados | Integrado | HTML preparado; sin captura | Simulada/tests | No modifica publicación editorial |
| Comprobación de recepción | Servicio | `post-delivery-worker.ts` | Resend directo | Corporativo | Tipo `delivery_check` | `renderAdminMail`, común | Enlace de recepción/pedido | Integración del módulo posentrega | HTML preparado; sin captura | Pruebas del módulo | Solo entrega acreditada y runtime autorizado |
| Fidelización posentrega | Marketing | `post-delivery-worker.ts` | Resend directo | Corporativo | Tipo `post_delivery_loyalty` | `renderAdminMail`, común | Consentimiento, baja, pedido | Integración del módulo posentrega | HTML preparado; sin captura | Pruebas del módulo | No se activa por pagar |
| Confirmación, recuperación, magic links de Auth | Transaccional externo | Supabase Auth | Supabase | Configuración externa | Externo | Pendiente proveedor | Tokens Auth | No modificado externamente | No disponible | No realizada | Requiere export/configuración soportada y acceso autorizado |
| Facturas/recibos automáticos de Stripe | Transaccional externo | Stripe | Stripe | Configuración externa | Externo | Branding del proveedor | Pago/factura | No modificado externamente | No disponible | No realizada | No se han cambiado ajustes fiscales ni proveedor |
| Redacción manual y recepción del buzón | Soporte/manual externo | IONOS/Webmail | IONOS | Configuración externa | Manual | HTML exportable y procedimiento | Texto real del redactor | Pendiente de conexión autorizada | No disponible | No realizada | Resend saliente no ofrece acceso a IONOS |

## Protección de reintentos e historial

Los nuevos payloads con snapshot persistente se renderizan antes de guardarse. Al leer una snapshot inmutable anterior, `prepareCorporateEmail(message,true)` **solo valida y devuelve el payload exacto**, sin cambiar diseño ni texto. Esto evita que Resend rechace la misma idempotency key con un payload diferente tras un despliegue. Esa cola previa conserva deliberadamente su diseño anterior hasta drenarse. No se recrea ni reenvía el historial, no se reinician campañas ni Welcome Series.

El transporte rechaza asunto vacío/con saltos de línea, cuerpo esencial vacío, texto alternativo ausente, variables sin resolver, placeholders de maqueta, scripts/iframes/forms/handlers y URLs de assets locales/data. El saneamiento solo conserva elementos semánticos y estilos de email permitidos. La preview vacía está separada del camino de envío.

## QA y límites conocidos

`tests/corporate-email.test.ts` comprueba estado vacío no enviable, conservación de textos/links firmados/adjuntos/headers, saneamiento, rechazo de entradas inseguras, cuerpos largos, idempotencia del renderer y presencia de la validación en los emisores directos. `scripts/preview-corporate-email.ts` genera artefactos locales vacío, corto, largo de 20 párrafos, pedido, servicio de recepción, marketing con baja y degradación con imágenes bloqueadas. Los fixtures no se guardan como campañas ni se envían.

No se ha afirmado compatibilidad verificada en Gmail web/Android/iOS, Outlook clásico/nuevo/web/móvil, Apple Mail, Yahoo o IONOS. La alternativa de Outlook utiliza tabla condicional de 600 px y reserva de color sólido cuando el motor omite los fondos. No se ha probado VML en un cliente real y no se promete fidelidad de fondos en Outlook clásico. Falta una prueba autorizada en buzón/plataforma real antes de considerar verificada la entrega/renderización en esos clientes.

## Activación y reversión

No se ha desplegado, cambiado DNS, configurado proveedores externos ni enviado un email. Las verificaciones locales no requieren secretos. El cambio de layout se activa al desplegar este código junto con sus assets. `EMAIL_PARCHMENT_ENABLED=false` ofrece lectura semántica sin el adorno para los nuevos mensajes; no reescribe snapshots ya persistidas. Para reversión completa, revertir este cambio de código y assets en la rama y conservar las colas/historial. No es necesaria una migración de datos para el renderer.

Para IONOS manual: abrir el HTML exportado del renderer, insertar texto real fuera de las fixtures y usar únicamente la función de importar/editar HTML que ofrezca la cuenta. No pegar el scaffold con tokens ni prometer un editor HTML si no está disponible; revisar un borrador en web y móvil antes de un envío autorizado. Si IONOS no admite HTML importado, queda pendiente la configuración mediante mecanismos soportados por el proveedor.
