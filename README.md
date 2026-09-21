# Imperio Espanol

Sitio SSR en Astro para `imperioes.com`, desplegado en Vercel e integrado con Supabase, Stripe y Resend. La analitica opcional solo se carga despues del consentimiento.

> Estado: el codigo compila, pero el lanzamiento comercial sigue bloqueado por los datos empresariales, fiscales y de producto descritos en `FINAL-AUDIT.md`.

## Reservas de camisetas

La fase actual permite reservar sin pago: **29,99 EUR por unidad, IVA y envio
estandar peninsular incluidos**. Supabase Test esta separado de produccion.
Con Node >=22.19, `node scripts/start-reservation-test.mjs` inicia el formulario
en `http://127.0.0.1:4323/reservas` usando el entorno local privado de Test.
No ejecutar `npm run dev` contra `.env.local` para probar estas migraciones.

Reservas sin pago publicadas en https://imperioes.com/reservas el 2026-09-11.
Acceso autenticado verificado en https://imperioes.com/admin/comercio.
Prueba de reserva/cancelacion correcta, correos recibidos en IONOS y 45 unidades
disponibles tras restaurar el stock. Scheduler activo. Resend mantiene un estado
de rebote contradictorio con la recepcion real. Los pagos Live siguen bloqueados.
Consulta el [estado de publicacion](docs/RESERVATION-PRODUCTION-RELEASE.md) y el
[informe A-Z](docs/RESERVATION-MODE.md). Checkout Test completado con tarjeta ficticia,
webhook firmado y pedido/stock verificados; no se han habilitado cobros Live.

## Stack

- Astro 7 + TypeScript + Preact + Tailwind CSS
- API Routes de Astro sobre Vercel
- Supabase Auth + Postgres + RLS
- Stripe Checkout, Billing, Customer Portal y webhooks
- Resend para correos transaccionales y envio del manifiesto
- Google Tag Manager o Google tag opcionales y sujetos a consentimiento

## Requisitos

- Node.js 22.19 o posterior
- npm 11 o posterior
- Proyectos de Supabase, Stripe y Resend configurados para el mismo entorno

## Instalacion

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

No confirmes `.env.local` en Git ni expongas claves privadas mediante variables `PUBLIC_*`.

## Variables de entorno

| Variable | Uso |
| :-- | :-- |
| `PUBLIC_SITE_URL` | Origen canonico, normalmente `https://imperioes.com` |
| `PUBLIC_GTM_ID` | Google Tag Manager opcional |
| `PUBLIC_GOOGLE_TAG_ID` | Google tag opcional si no se usa GTM |
| `PUBLIC_SUPABASE_URL` | URL publica del proyecto Supabase |
| `PUBLIC_SUPABASE_ANON_KEY` | Clave publicable de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada de Supabase, solo servidor |
| `STRIPE_SECRET_KEY` | Clave privada Stripe Test o Live del entorno activo |
| `STRIPE_WEBHOOK_SECRET` | Firma del endpoint del mismo entorno Stripe |
| `STRIPE_TAX_ENABLED` | `true` solo tras validar la configuracion fiscal |
| `STRIPE_PRICE_ARCABUCERO_MONTHLY` | Price recurrente mensual Arcabucero |
| `STRIPE_PRICE_ARCABUCERO_ANNUAL` | Price recurrente anual Arcabucero |
| `STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY` | Price recurrente mensual Maestre de Campo |
| `STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL` | Price recurrente anual Maestre de Campo |
| `STRIPE_PRICE_CAMISETA_IMPERIAL` | Producto fisico; no habilitar mientras falten datos legales |
| `RESEND_API_KEY` | Clave privada de Resend |
| `RESEND_FROM_EMAIL` | Remitente general verificado |
| `RATE_LIMIT_SECRET` | Secreto aleatorio largo para seudonimizar limites por IP |
| `MANIFESTO_FROM_EMAIL` | Remitente del manifiesto |
| `MANIFESTO_PDF_URL` | URL absoluta opcional del PDF |
| `MANIFESTO_PDF_PATH` | Ruta publica local del PDF |
| `MANIFESTO_ATTACHMENT_URL` | URL absoluta opcional del adjunto |
| `MANIFESTO_ATTACHMENT_PATH` | Ruta local del adjunto, normalmente `/manifesto-email.pdf` |

`.env.example` contiene exclusivamente nombres sin valores reales.

## Supabase

Ejecuta en orden todos los archivos de `supabase/migrations`. No omitas las migraciones de consentimientos, ledger de Stripe, catalogo, rate limiting y restriccion de actualizacion de perfiles.

Consulta [supabase/README.md](supabase/README.md) para la lista de tablas y comprobaciones RLS.

## Stripe

- El navegador nunca decide el Price ID ni el nivel concedido.
- La pagina `/checkout/[item]` muestra el contrato antes de crear la sesion.
- La fuente de verdad es `/api/stripe-webhook`, con firma e idempotencia persistente.
- La URL de exito no concede acceso.
- El portal se crea para el cliente vinculado al usuario autenticado.
- No mezcles claves o Price IDs de Stripe Test y Live.

Eventos minimos del webhook:

```txt
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

## Manifiesto y correo

El endpoint `/api/manifesto.php` valida datos, honeypot, origen, limite de peticiones y reconocimiento de privacidad. El envio del manifiesto no suscribe al usuario a marketing. La copia comprimida se encuentra en `public/manifesto-email.pdf`.

## Verificacion

```powershell
npm run check
npm test
npm run build
npm run verify
npm audit
```

Para probar el manifiesto desplegado:

```powershell
.\scripts\test-manifesto-deployed.ps1 -BaseUrl "https://imperioes.com" -Email "correo-de-prueba@example.com"
```

## Publicacion en Vercel

1. Ejecuta todas las migraciones Supabase.
2. Configura las variables en Preview y Production.
3. Ejecuta `npm ci` y `npm run verify`.
4. Publica el commit en el repositorio conectado.
5. Verifica dominio canonico, HTTPS y redireccion `www`.
6. Prueba registro, login, pago, webhook, paywall, portal, contacto y desistimiento.
7. Verifica el modo Stripe y el endpoint de webhook antes de aceptar pagos reales.

## Estructura

- `src/pages`: paginas SSR, legales y API Routes.
- `src/lib`: Supabase, Stripe, consentimiento, seguridad y correo.
- `src/config`: sitio, planes, documentos legales y productos.
- `supabase/migrations`: esquema SQL y politicas RLS.
- `tests`: pruebas de redirects, permisos y configuracion comercial.
- `docs/prompts-maestros`: instrucciones maestras de desarrollo, revisión legal y artículos históricos.
- `docs/LEGAL-COMPLIANCE.md`: matriz de implementacion.
- `FINAL-AUDIT.md`: estado de salida y bloqueadores.

## Reglas operativas

- La camiseta permanece bloqueada mientras figure como `LEGAL_PRODUCT_DATA_INCOMPLETE`.
- Los consentimientos se guardan con version, fecha, sujeto y contexto.
- Cambiar un texto contractual requiere actualizar su version en `src/config/legal.ts`.
- Las ventajas marcadas `Proximamente` no forman parte de la contratacion actual.
