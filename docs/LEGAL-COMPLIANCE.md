# Matriz de cumplimiento tecnico y legal

Fecha de auditoria: 2026-09-06.

Este documento diferencia implementacion tecnica verificable de cuestiones que requieren datos reales o revision profesional. No constituye asesoramiento juridico ni declara por si mismo conformidad legal.

| Obligacion | Implementacion | Archivo | Estado |
| --- | --- | --- | --- |
| Identificacion del prestador | Titular, nombre comercial, NIF, domicilio, correo y situacion registral | `src/pages/legal/aviso-legal.astro` | Datos configurados; requiere revision juridica |
| Informacion de privacidad | Tratamientos y proveedores reales inventariados | `src/pages/legal/privacidad.astro` | Requiere datos y revision juridica |
| Politica de cookies | Categorias, tecnologias y retirada | `src/pages/legal/cookies.astro` | Implementado tecnicamente |
| Banner de cookies | Aceptar, rechazar y configurar con igual jerarquia | `src/components/CookieConsent.astro` | Implementado tecnicamente |
| Bloqueo previo de analitica | GTM/Google tag se inyectan solo tras aceptar analitica | `src/components/CookieConsent.astro` | Implementado tecnicamente |
| Evidencia de consentimiento | Registros versionados por usuario o identificador anonimo | `supabase/migrations/004_legal_consents.sql` | Aplicado en produccion |
| Registro y login | Alta separada, terminos y privacidad; login no crea usuarios | `src/pages/registro.astro`, `src/pages/login.astro` | Implementado tecnicamente |
| Checkout precontractual | Precio Stripe real, periodicidad, renovacion, impuestos y CTA de pago | `src/pages/checkout/[item].astro` | Implementado para suscripciones |
| Preparacion de suscripciones | Checkout bloqueado si no existe contenido premium elegible publicado | `src/lib/commercial-readiness.ts` | Implementado; contenido pendiente |
| Inicio inmediato digital | Dos confirmaciones separadas y no premarcadas | `src/pages/checkout/[item].astro` | Implementado; revision juridica del texto |
| Soporte duradero | Email de bienvenida con plan, precio, renovacion y version contractual | `src/lib/emails.ts` | Implementado tecnicamente |
| Webhook Stripe | Firma, ledger idempotente, reintentos y estados de suscripcion | `src/pages/api/stripe-webhook.ts` | Migracion aplicada; requiere pago LIVE controlado |
| Acceso premium | Se valida usuario, nivel y estado activo/trialing en SSR | `src/pages/biblioteca/[slug].astro` | Implementado tecnicamente |
| Portal de cliente | Sesion autenticada y cliente vinculado | `src/pages/api/create-customer-portal-session.ts` | Implementado; verificar configuracion Stripe |
| Devoluciones | Pagina con procedimiento y direccion configurada | `src/pages/legal/devoluciones.astro` | Requiere revision juridica y politica logistica |
| Desistimiento electronico | Formulario accesible y envio transaccional | `src/pages/legal/desistimiento.astro`, `src/pages/api/contact.ts` | Datos configurados; requiere revision juridica |
| Producto fisico | Catalogo estructurado y bloqueo por datos incompletos | `src/config/products.ts`, `supabase/migrations/006_commerce_catalog.sql` | Requiere datos |
| GPSR | Campos de fabricante, contacto, responsable UE y seguridad | `src/config/products.ts` | Requiere datos y revision externa |
| Composicion textil | Modelo fibra/porcentaje | `supabase/migrations/006_commerce_catalog.sql` | Requiere datos |
| Historial de precios | Periodos inmutables y visibles solo en productos aptos | `supabase/migrations/006_commerce_catalog.sql` | Implementado; requiere operar datos reales |
| IVA y Stripe Tax | Interruptor explicito, direccion y bloqueo informativo | `src/pages/api/create-checkout-session.ts` | Revision fiscal externa requerida |
| Envases | Marcador de revision externa previo a ventas | `src/config/products.ts` | Revision empresarial/legal externa |
| Newsletter | No existe captacion de marketing; el manifiesto lo excluye expresamente | `src/pages/manifiesto.astro` | N/A mientras no se active newsletter |
| Baja de newsletter | No procede sin lista de marketing activa | N/A | N/A |
| Comentarios y denuncias DSA | Foro y comentarios no estan activos ni contratados | `src/pages/foro.astro`, `src/pages/comunidad.astro` | Pendiente antes de activar comentarios |
| Contacto | Validacion servidor, honeypot, escape, origen y rate limiting | `src/pages/api/contact.ts` | Migracion aplicada en produccion |
| Seguridad de secretos | Variables privadas solo en servidor; `.env.local` ignorado | `.env.example`, `src/lib` | Implementado tecnicamente |
| RLS y privilegios | Lectura por propietario y actualizacion limitada de perfil | `supabase/migrations/008_restrict_profile_updates.sql` | Aplicado en produccion |
| Cabeceras | CSP, HSTS, nosniff, referrer, permisos y anti-frame | `vercel.json` | Implementado; verificar tras deploy |
| Accesibilidad | Skip link, foco, labels, dialogos y reduced motion | `src/layouts/Layout.astro`, `src/styles/global.css` | Implementado parcialmente; prueba manual requerida |
| SEO tecnico | Canonical, sitemap, robots, redirects, 404 y JSON-LD | `src/layouts/Layout.astro`, `src/pages/sitemap.xml.ts` | Implementado tecnicamente |

## Datos empresariales pendientes

1. Edad minima y reglas contractuales aplicables a menores.
2. Plazos de conservacion definitivos y contratos con encargados.

## Datos del producto pendientes

1. Fabricante legal, nombre comercial, direccion postal y email.
2. Responsable en la UE, si procede.
3. SKU general y por talla, stock y trazabilidad.
4. Composicion textil exacta por fibra y porcentaje.
5. Instrucciones, advertencias e informacion de seguridad.
6. Envio: territorios, costes, plazos y transportista.
7. Procedimiento, costes y direccion de devoluciones.

## Verificaciones externas

- Regimen de IVA, tipos aplicables, facturacion, OSS y configuracion Stripe Tax.
- Registro de Productores, envases y adhesiones SCRAP/SRAP cuando procedan.
- Contratos de encargo y transferencias internacionales de Supabase, Stripe, Vercel, Resend y Google.
- Licencias de fuentes e imagenes, en particular la fuente remota FS Rosa Black.
- Revision juridica final de textos y desistimiento antes de cobrar en modo Live.

## Fuentes de referencia verificadas

- AEPD, Guia sobre el uso de las cookies: https://www.aepd.es/guias/guia-cookies.pdf
- BOE, Ley 34/2002: https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758
- BOE, RDL 1/2007: https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555
- EUR-Lex, Reglamento (UE) 2023/988: https://eur-lex.europa.eu/legal-content/ES-EN/TXT/?uri=CELEX%3A32023R0988
