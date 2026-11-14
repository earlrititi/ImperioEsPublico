# Identidad oficial en los correos

Fecha de revisión: 14 de noviembre de 2026. Fuente autorizada: `imperio_es_logos_png_svg.zip` proporcionado por el propietario. Las normas generales están en `BRAND_IDENTITY.md`.

## Implementación

`src/lib/corporate-email.ts` es el layout compartido de los correos. `prepareCorporateEmail` lo aplica en la frontera común del transporte existente. El envío sigue utilizando Resend; Supabase mantiene su configuración SMTP existente. IONOS se utiliza en el lector de buzón, sin cambiar su configuración ni introducir un transporte nuevo.

El layout usa tablas de presentación con ancho máximo de 600 px, CSS inline, un bloque de compatibilidad Outlook, texto alternativo, dimensiones reservadas, cuerpo legible y pie con los enlaces existentes. El logo se muestra a 184 × 184 px; en móviles, a 168 × 168 px, siempre proporcionalmente. No contiene SVG, filtros ni imágenes base64. El cuerpo no depende de imágenes de fondo para poder leerse.

| Fondo de cabecera | Recurso centralizado |
| --- | --- |
| Blanco, predeterminado | `BRAND.email.logos.light`: `https://imperioes.com/brand/logos/imperio_es_principal.png` |
| Oscuro | `BRAND.email.logos.dark`: `https://imperioes.com/brand/logos/imperio_es_fondos_oscuros.png` |

```ts
renderCorporateEmail({
  subject: "Pedido confirmado",
  visualTitle: "Gracias por tu compra",
  bodyHtml: contenidoExistente,
  bodyText: textoExistente,
  headerTheme: "dark", // opcional; el valor predeterminado es light
  legalHtml: textosLegalesExistentes,
  legalText: textoLegalExistente,
});
```

Los flujos existentes no necesitan duplicar cabeceras. El layout recibe el contenido, conservando números de pedido, precios, tokens, enlaces firmados, adjuntos, remitentes, destinatarios y cabeceras del proveedor. Los mecanismos de baja siguen perteneciendo a cada flujo: no se añaden a correos de servicio ni se retiran de marketing.

El atributo nuevo `data-imperio-brand="official-20261114"` identifica el diseño actual. El identificador interno `data-imperio-email-layout="pergamino-v1"` se conserva para reconocer snapshots e impedir que los reintentos aniden o reconstruyan mensajes ya preparados. No indica que los nuevos correos utilicen los recursos antiguos. El interruptor existente `EMAIL_PARCHMENT_ENABLED=false` mantiene su comportamiento anterior; no se ha cambiado su configuración.

Las antiguas imágenes compuestas `cabecera-v2.png` y `firma-nao-v2.jpg` contienen marca obsoleta y ya no se emiten desde el renderer activo. Sus archivos y el listado exacto de recursos permitidos en `corporate-mail-preview.ts` se conservan para consultar mensajes históricos y snapshots. Los originales históricos no se reescriben ni se reenvían. La CSP del lector admite el mismo origen para que esas rutas públicas exactas funcionen también en localhost y en previews de Vercel; el saneamiento sigue rechazando imágenes no autorizadas, parámetros de seguimiento, `srcset` y contenido activo.

## Inventario revisado

| Flujo existente | Origen | Aplicación del cambio |
| --- | --- | --- |
| Bienvenida PIQUERO, suscripción de pago, descuento de camiseta, pago fallido, cancelación, compra de merchandising | `customer-mail-catalog.ts` | Hereda el layout compartido |
| Confirmación de cuenta, invitación, acceso por enlace, recuperación, cambio de correo y reautenticación | `auth-mail-catalog.ts` | Hereda el layout, preservando propósitos y destinatarios de los enlaces |
| Siete avisos de seguridad: contraseña, correo, teléfono, identidades y MFA | `auth-mail-catalog.ts` | Hereda el layout; el OTP sigue oculto en las copias de consulta |
| Confirmación de comunicaciones y nuevos suscriptores | `marketing-contacts.ts` | Hereda el transporte compartido |
| Reserva, lista de espera, invitación de compra, estados de pago y pedido | `commerce-mail.ts` | Hereda el layout sin modificar importes, estado ni enlaces |
| Facturas pagadas, recibos, reembolsos, facturas pendientes, notas de crédito, renovación, periodo de prueba, suscripción y tarjeta próxima a caducar | `stripe-customer-mail.ts` | Hereda el layout; ninguna operación de Stripe modificada |
| Bienvenida comercial, checkout abandonado, producto visitado, visita sin continuar y carrito abandonado | `email-automations.ts` y `automation-worker.ts` | Los contenidos y horarios conservados pasan por `renderAdminMail` |
| Campañas manuales, newsletters y comunicaciones administrativas | `admin-mail-template.ts` y `admin-mail.ts` | Hereda cabecera y pie comunes |
| Recepción de entrega y seguimiento de fidelización | `post-delivery-worker.ts` | Hereda el layout manteniendo la separación de servicio y marketing |
| Avisos administrativos de pedidos pagados, reservas, registros, manifiesto, newsletter y suscripción | `admin-notifications.ts`, `paid-order-admin-mail.ts` | Hereda el layout sin cambiar destinatarios |
| Contacto y acuse de desistimiento | `pages/api/contact.ts` | Hereda la frontera del transporte |
| Entrega de manifiesto y PDF de siete historias | `pages/api/manifesto.php.ts` | Hereda el layout, conservando adjuntos y consentimiento |
| Avisos del motor SEO | `seo-engine-worker.ts` | Hereda el transporte compartido |
| Respaldo SMTP de confirmación y recuperación de Supabase | `production-environment/supabase/templates/*.html` | HTML actualizado; tokens Go y URLs de acción intactos |

No se ha encontrado una secuencia comercial independiente de `placed_order`: su definición contiene cero pasos deliberadamente, porque las confirmaciones transaccionales cubren el pedido. No se ha añadido una secuencia duplicada. Los tipos solicitados en el encargo tienen representación en los flujos enumerados; algunos comparten layout o renderizan contenido desde datos, en lugar de tener un archivo HTML por correo.

El código no permite acreditar por sí solo los ajustes actuales del panel de Resend, las plantillas desplegadas en Supabase ni los correos que Stripe envía directamente desde su panel. No se han cambiado configuraciones externas de autenticación, proveedores ni pagos. Las dos plantillas SMTP de respaldo quedan preparadas en el repositorio para su publicación mediante el procedimiento existente, cuando corresponda.

## Previsualización y comprobaciones

```powershell
node --import tsx scripts/preview-corporate-email.ts tmp/rebranding-after/emails
```

Genera 50 vistas HTML con datos ficticios: ambos fondos, mensajes cortos y largos, seis correos de cliente, catorce mensajes de Auth, los doce pasos comerciales existentes, reserva, pedido, avisos administrativos, campaña, recepción de entrega, respaldos Supabase y una vista con imágenes bloqueadas. Los enlaces de seguridad llevan tokens deliberadamente inválidos. Las pruebas de las notificaciones Stripe utilizan sus fixtures existentes y no llaman a Stripe. El generador tampoco ejecuta consultas de base de datos ni envíos.

Se conservaron siete vistas previas del renderer anterior y se generó además la vista del carrito abandonado con el renderer del commit inicial, en `tmp/rebranding-before/emails`, fuera del control de versiones. Las vistas nuevas están en `tmp/rebranding-after/emails`. Las capturas reales del navegador, cuando se hayan realizado, se registran en el informe general; un fixture HTML no se presenta como una captura.

Prueba ejecutada durante la implementación: 55/55 tests de correo, previsualización, archivos históricos, Auth, transporte, comercio, Stripe y posentrega correctos, incluyendo las dos plantillas de respaldo SMTP. El resultado final del conjunto completo corresponde al informe general. Las comprobaciones validan datos y enlaces, la conservación de snapshots, el saneamiento del lector y la variante PNG exacta.

Las vistas HTML y los estilos están preparados para clientes habituales, pero una revisión en navegador no acredita renderizado real en Gmail, Outlook ni Apple Mail. Esa matriz requiere pruebas en esos clientes.

Se compararon además los renderers del commit inicial `844152ba23e378ae4cc47971c6ac482b6f1f505f` y los actuales con datos ficticios:

| Familia | Comparaciones | Resultado |
| --- | ---: | --- |
| Catálogo de cliente | 6 | Texto, asunto, remitente, destinatario y enlaces intactos |
| Auth y seguridad | 14 | Texto, destinatarios, propósitos y tokens de acción intactos |
| Pasos de automatización | 12 | Texto, CTA y enlaces de baja intactos |
| Respaldos SMTP | 2 | URLs de acción y tokens Go exactos intactos |

Las 34 comparaciones preservan 34 enlaces de acción. Los respaldos originales usan `{{ .SiteURL }}` y `{{ .TokenHash }}`; no usaban `.ConfirmationURL`. Se verificó que los 50 fixtures utilizan imágenes relativas únicamente para revisión sin conexión, que sus acciones son absolutas y que el mensaje preparado para transporte conserva el PNG HTTPS canónico. La salida de `EMAIL_PARCHMENT_ENABLED=false` coincide exactamente con la anterior. Evidencia local: `tmp/rebranding/email-independent-review.json` y `tmp/rebranding/email-link-comparison.md`.

Una prueba aislada del lector en un iframe con `sandbox=""` confirmó la carga del PNG aprobado en el origen canónico, un origen de preview simulado y localhost después del ajuste de CSP. Las 9 pruebas específicas del lector y archivo histórico pasaron, incluyendo el rechazo de imágenes privadas del mismo origen y variantes con parámetros de seguimiento. No requirió regenerar los fixtures, porque el HTML de transporte no cambia.

## Envío de prueba preparado

```powershell
# Simulación por defecto; muestra disponibilidad de los PNG y del proveedor.
node --import tsx scripts/test-brand-email.ts

# Solo cuando los recursos canónicos ya estén publicados y el proveedor configurado.
node --import tsx scripts/test-brand-email.ts --send
```

Se utilizan exclusivamente `earlrititi@gmail.com` y el remitente `contacto@imperioes.com`. El script no admite otros destinatarios, no consulta clientes ni colas, y emplea el transporte existente con una clave de idempotencia específica. Antes del envío comprueba que ambos PNG públicos responden como PNG y coinciden byte a byte mediante SHA-256 con los archivos locales oficiales. La clave del proveedor se toma del entorno sin imprimirla; el script no carga ni modifica archivos de configuración.

La simulación del 14 de noviembre devolvió HTTP 404 para los dos PNG canónicos y `providerConfigured=false` en el proceso sin cargar variables locales. Resultado: `ready=false`; no se realizó ningún envío. No se envía una prueba con imágenes rotas mientras los recursos solo están en una rama o preview. `prepared-test-message.json`, generado junto a las vistas HTML, permite revisar el contenido antes del envío.
