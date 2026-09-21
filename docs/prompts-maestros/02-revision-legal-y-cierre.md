# PROMPT MAESTRO CODEX — REVISIÓN FINAL, CUMPLIMIENTO LEGAL Y CIERRE DE IMPERIOES.COM

Actúa como **Lead Full-Stack Engineer + Security Engineer + QA Engineer + especialista en e-commerce, privacidad y cumplimiento web UE/España**.

Tu misión es realizar una **auditoría final integral del repositorio de Imperio Español**, corregir lo necesario y dejar la web en estado **production-ready**, manteniendo su identidad visual y sin introducir cambios innecesarios.

No quiero una auditoría teórica. Quiero que:

1. inspecciones el código existente;
2. detectes problemas;
3. propongas la corrección;
4. la implementes directamente cuando sea seguro hacerlo;
5. pruebes el resultado;
6. continúes autónomamente con la siguiente fase;
7. solo me pidas datos cuando sean realmente necesarios y no puedan deducirse del repositorio.

---

# 0. CONTEXTO DEL PROYECTO

Proyecto: **Imperio Español**

Dominio:

`https://imperioes.com`

La web está centrada editorial y visualmente en el **Imperio Español y el Siglo de Oro**, principalmente entre finales del siglo XV y 1700.

La nueva web debe mantener un estilo:

* minimalista;
* elegante;
* editorial;
* histórico;
* inspirado en el Siglo de Oro;
* moderno en UX;
* rápido;
* sobrio;
* con mucho espacio visual;
* sin barroquismo innecesario.

No rediseñes la identidad visual salvo que exista un problema objetivo de:

* accesibilidad;
* responsive;
* legibilidad;
* rendimiento;
* consistencia;
* usabilidad.

---

# 1. STACK PREVISTO

La arquitectura principal es:

* **Astro**
* TypeScript
* Supabase
* Supabase Auth
* PostgreSQL / Supabase Database
* Stripe
* Stripe Checkout
* Stripe Billing
* Stripe Customer Portal
* Stripe Webhooks
* Vercel
* GitHub

Antes de modificar nada:

1. inspecciona el repositorio;
2. identifica las tecnologías realmente instaladas;
3. no des por instalada ninguna dependencia que no exista;
4. reutiliza la arquitectura actual siempre que sea razonable;
5. evita introducir librerías pesadas innecesariamente.

Si alguna tecnología prevista todavía no está implementada, indícalo y decide si corresponde implementarla en esta fase.

---

# 2. OBJETIVO COMERCIAL

La web incluye o incluirá:

* Inicio
* Biblioteca
* Artículos
* Efemérides
* Rutas de lectura
* Cuenta
* Comentarios
* Comunidad
* Discord
* Manifiesto
* Newsletter
* Tienda
* Drops
* Productos físicos
* Recursos digitales
* Contacto
* Suscripciones
* Stripe
* Área privada

Escalera de membresía:

### Gratis

Acceso público limitado.

### Rodelero

Plan de entrada.

### Piquero

Suscripción principal.

### Arcabucero

Plan premium.

No hardcodees precios o prestaciones si actualmente proceden de configuración, Stripe o base de datos.

---

# 3. PRINCIPIO FUNDAMENTAL DE LA AUDITORÍA

No consideres la web terminada porque:

* compile;
* se vea bien;
* Stripe cobre;
* existan páginas legales.

La web estará terminada únicamente cuando exista coherencia entre:

**INTERFAZ
→ CONTRATACIÓN
→ CONSENTIMIENTO
→ STRIPE
→ SUPABASE
→ DERECHOS DEL USUARIO
→ PRODUCTOS
→ DOCUMENTACIÓN LEGAL
→ SEGURIDAD
→ ACCESIBILIDAD
→ SEO
→ PRODUCCIÓN**

Busca inconsistencias entre todas estas capas.

---

# 4. REGLAS DE TRABAJO

Trabaja **fase por fase**.

No me pidas autorización para cada modificación ordinaria.

Puedes corregir autónomamente:

* errores;
* inconsistencias;
* accesibilidad;
* tipado;
* rutas;
* SEO;
* validaciones;
* duplicaciones;
* bugs;
* estados de carga;
* errores responsive;
* problemas de seguridad;
* problemas de rendimiento;
* enlaces rotos;
* metadatos;
* formularios;
* componentes legales.

Pídeme información únicamente cuando falten datos reales del negocio, por ejemplo:

* razón social;
* NIF/CIF;
* domicilio;
* email jurídico;
* dirección de devoluciones;
* transportistas;
* fabricante;
* responsable GPSR;
* inscripción en registros;
* situación fiscal;
* OSS;
* proveedores definitivos.

En esos casos utiliza placeholders claramente identificables:

`[PENDIENTE: RAZÓN SOCIAL]`

Nunca inventes información empresarial.

---

# 5. NO INVENTES CUMPLIMIENTO LEGAL

Diferencia siempre entre:

### A. Cumplimiento técnico que puedes verificar

Ejemplo:

* consentimiento registrado;
* cookies bloqueadas;
* botón de pago correcto;
* formulario de desistimiento;
* historial de precios;
* datos GPSR en UI.

### B. Cumplimiento externo que no puedes verificar

Ejemplo:

* inscripción en Registro de Productores;
* adhesión a SCRAP/SRAP;
* declaración OSS;
* alta fiscal;
* fabricante legal;
* contratos con encargados del tratamiento.

Cuando algo pertenezca al grupo B:

**NO marques la web como jurídicamente conforme.**

Márcalo:

`REQUIERE VERIFICACIÓN EMPRESARIAL/LEGAL EXTERNA`

---

# 6. NORMATIVA A TENER EN CUENTA

Comprueba la implementación teniendo en cuenta, entre otras, la normativa vigente que resulte aplicable.

## Unión Europea

* Reglamento (UE) 2016/679 — RGPD
* Directiva 2002/58/CE — ePrivacy
* Directiva 2000/31/CE — comercio electrónico
* Directiva 2011/83/UE — derechos de los consumidores
* Directiva (UE) 2019/770 — contenidos y servicios digitales
* Directiva (UE) 2019/771 — compraventa de bienes
* Directiva 93/13/CEE — cláusulas abusivas
* Directiva 2005/29/CE — prácticas comerciales desleales
* Directiva (UE) 2019/2161 — Omnibus
* Directiva 98/6/CE — precios
* Reglamento (UE) 2023/988 — GPSR
* Reglamento (UE) 1007/2011 — productos textiles
* Reglamento (UE) 2022/2065 — DSA
* Directiva (UE) 2019/882 — European Accessibility Act
* Reglamento (UE) 2018/302 — geoblocking
* normativa europea de IVA aplicable
* Reglamento (UE) 2025/40 sobre envases cuando resulte aplicable

## España

Revisa especialmente la normativa española que implemente, complemente o transponga lo anterior, incluyendo:

* Ley 34/2002 — LSSI
* Ley Orgánica 3/2018 — LOPDGDD
* Real Decreto Legislativo 1/2007 — TRLGDCU
* Real Decreto-ley 7/2021
* Real Decreto-ley 24/2021
* Ley 7/1996 de Ordenación del Comercio Minorista
* Ley 11/2023 de accesibilidad
* Ley 37/1992 del IVA
* Real Decreto 1619/2012 sobre facturación
* Real Decreto 1055/2022 sobre envases
* normativa española vigente que resulte aplicable.

IMPORTANTE:

No confíes ciegamente en esta lista.

Si tienes acceso a fuentes normativas actualizadas, verifica el estado vigente en la fecha de ejecución.

Si no puedes verificar una cuestión jurídica actual:

`NO LA INVENTES`.

Márcala para revisión jurídica.

---

# 7. FASE 0 — INVENTARIO DEL REPOSITORIO

Antes de modificar nada:

Analiza:

* estructura;
* ramas si son relevantes;
* package.json;
* Astro config;
* TypeScript;
* variables de entorno;
* adapters;
* integraciones;
* middleware;
* API routes;
* Supabase;
* Stripe;
* componentes;
* layouts;
* páginas;
* contenido;
* imágenes;
* CSS;
* fuentes;
* analytics;
* cookies;
* SEO;
* sitemap;
* robots;
* tienda;
* auth;
* comentarios.

Genera un inventario corto:

### EXISTENTE

### INCOMPLETO

### AUSENTE

### PROBLEMÁTICO

### BLOQUEADO POR DATOS EXTERNOS

Después continúa automáticamente.

---

# 8. FASE 1 — AVISO LEGAL Y FOOTER

Comprueba que exista:

`/legal/aviso-legal`

Debe contener, cuando proceda:

* titular;
* razón social;
* NIF/CIF;
* domicilio;
* email;
* datos registrales;
* datos de contacto;
* propiedad intelectual;
* condiciones generales de uso;
* legislación aplicable.

No inventes estos datos.

### Footer

Todas las páginas deben permitir acceder fácilmente a:

* Aviso legal
* Privacidad
* Cookies
* Términos y condiciones
* Devoluciones
* Desistimiento
* Accesibilidad
* Configurar cookies

Comprueba enlaces rotos.

---

# 9. FASE 2 — PRIVACIDAD

Revisa:

`/legal/privacidad`

Debe estar adaptada al funcionamiento REAL de la web.

Comprueba especialmente:

* responsable;
* datos recopilados;
* finalidades;
* bases jurídicas;
* Supabase;
* Stripe;
* Vercel;
* email;
* analytics;
* Discord;
* logística;
* comentarios;
* notas;
* biblioteca;
* newsletter;
* destinatarios;
* transferencias internacionales;
* conservación;
* derechos;
* AEPD;
* decisiones automatizadas;
* seguridad.

Elimina referencias residuales a:

* KITH;
* Estados Unidos como jurisdicción del servicio;
* California;
* Nevada;
* Canadá;
* arbitraje estadounidense;
* Shopify;
* PayPal;
* Global-E;
* FedEx;

salvo que alguno sea realmente proveedor de Imperio Español.

---

# 10. FASE 3 — COOKIE BANNER REAL

Audita el comportamiento, no solo la apariencia.

Debe existir:

### Primera capa

* Aceptar
* Rechazar
* Configurar

Aceptar y rechazar deben presentar visibilidad comparable.

No usar:

* dark patterns;
* consentimiento preseleccionado;
* consentimiento implícito por navegar.

Antes del consentimiento NO deben cargarse tecnologías no esenciales.

Comprobar específicamente:

* Google Analytics;
* Meta Pixel;
* TikTok;
* Hotjar;
* Microsoft Clarity;
* heatmaps;
* advertising;
* tracking;
* YouTube embeds;
* mapas;
* terceros que almacenen identificadores.

Clasificar:

### Necessary

### Preferences

### Analytics

### Marketing

Implementar:

`CookieBanner`

`CookieSettings`

y mecanismo permanente:

`Configurar cookies`

Registrar exclusivamente lo necesario para acreditar preferencias.

---

# 11. FASE 4 — CONSENTIMIENTOS SUPABASE

Comprueba o crea una arquitectura similar a:

`legal_consents`

Campos recomendados:

* id
* user_id
* anonymous_id si procede
* consent_type
* document_version
* accepted
* created_at
* withdrawn_at
* source

Tipos:

* terms
* privacy_acknowledgement
* marketing_email
* cookies_analytics
* cookies_marketing
* digital_content_immediate_access
* digital_withdrawal_acknowledgement

No guardes información innecesaria.

Añade índices razonables.

Aplica RLS.

El usuario no puede:

* leer consentimientos ajenos;
* modificar registros históricos arbitrariamente.

---

# 12. FASE 5 — CHECKOUT LEGAL ANTES DE STRIPE

No enviar directamente desde una card:

`Comprar → Stripe`

si falta información contractual.

Crear una página intermedia cuando sea necesaria:

`/checkout/[producto-o-plan]`

Mostrar inmediatamente antes del pago:

* producto/plan;
* precio;
* impuestos;
* periodicidad;
* renovación automática;
* condiciones principales;
* cancelación;
* acceso digital;
* costes adicionales;
* enlace a términos.

El CTA de pago debe ser inequívoco.

Preferir:

`Suscribirme y pagar 5 €/mes`

en lugar de:

`Continuar`

o:

`Confirmar`

---

# 13. FASE 6 — STRIPE

Audita:

* Checkout Session;
* customer;
* subscription;
* Price IDs;
* metadata;
* success_url;
* cancel_url;
* Customer Portal;
* webhook;
* firma del webhook;
* retries;
* idempotencia.

Nunca otorgues acceso premium basándote únicamente en:

`/success`

La fuente de verdad será:

**Stripe webhook verificado.**

Gestionar al menos:

* checkout.session.completed
* customer.subscription.created
* customer.subscription.updated
* customer.subscription.deleted
* invoice.paid
* invoice.payment_failed

No confíes en datos enviados por el cliente.

---

# 14. ESTADO DE SUSCRIPCIÓN EN SUPABASE

Estructura recomendada:

`subscriptions`

Campos mínimos:

* user_id
* stripe_customer_id
* stripe_subscription_id
* stripe_price_id
* tier
* status
* current_period_end
* cancel_at_period_end
* created_at
* updated_at

Los niveles pueden ser:

* free
* rodelero
* piquero
* arcabucero

No confíes únicamente en:

`tier`

Comprueba también:

`status`

---

# 15. FASE 7 — DESISTIMIENTO DIGITAL

Para contenido o servicio digital con acceso inmediato, revisa si el flujo requiere consentimiento específico.

Cuando corresponda, implementar checkboxes separados similares a:

`[ ] Solicito que el servicio digital comience inmediatamente.`

`[ ] Reconozco las consecuencias que este inicio puede tener sobre mi derecho de desistimiento conforme a las condiciones aplicables.`

No premarcarlos.

Registrar:

* usuario;
* versión del texto;
* fecha;
* plan;
* checkout asociado.

Enviar confirmación contractual en soporte duradero cuando corresponda.

---

# 16. FASE 8 — TIENDA

Audita:

`/tienda`

y:

`/tienda/[slug]`

Cada producto debe soportar como mínimo:

* name
* description
* slug
* SKU
* price
* currency
* stock
* images
* variants
* sizes
* composition
* manufacturer
* GPSR info
* shipping info
* returns
* tax
* status

Evitar productos comprables sin información suficiente.

---

# 17. FASE 9 — GPSR

Los productos físicos deben permitir mostrar, cuando corresponda:

* fabricante;
* nombre comercial;
* dirección postal;
* dirección electrónica;
* identificador del producto;
* SKU/referencia;
* responsable UE si procede;
* instrucciones;
* advertencias;
* información de seguridad.

No inventes datos.

Si faltan:

marca el producto como:

`LEGAL_PRODUCT_DATA_INCOMPLETE`

y evita silenciosamente presentarlo como listo para comercialización si faltan datos obligatorios.

---

# 18. COMPOSICIÓN TEXTIL

Para prendas:

crear estructura específica.

Ejemplo:

`composition`

* fibre
* percentage

Mostrar de forma legible:

`100 % algodón`

Evitar texto libre únicamente si podemos estructurarlo.

Permitir múltiples fibras.

---

# 19. FASE 10 — HISTORIAL DE PRECIOS

Para descuentos en productos físicos no confíes únicamente en:

`compare_at_price`

Implementa historial:

`product_prices`

* id
* product_id
* amount
* currency
* starts_at
* ends_at

Cuando se muestre una reducción:

calcular conforme a la normativa aplicable el precio anterior correspondiente.

No inventar un PVP anterior de marketing.

Auditar especialmente los:

**drops.**

---

# 20. FASE 11 — DEVOLUCIONES

Crear/revisar:

`/legal/devoluciones`

Debe informar claramente:

* plazo;
* procedimiento;
* dirección;
* costes;
* producto defectuoso;
* reembolso;
* excepciones;
* productos personalizados;
* contacto.

No imponer automáticamente:

* saldo de tienda;
* restocking fee;
* pérdida de derechos por “final sale”;

cuando sean incompatibles con derechos imperativos.

---

# 21. FORMULARIO DE DESISTIMIENTO

Crear:

`/legal/desistimiento`

Debe contener:

* explicación;
* formulario;
* contacto;
* procedimiento.

Permitir presentación electrónica cuando sea razonable.

No obligar a utilizar exclusivamente dicho formulario si la legislación admite otras declaraciones inequívocas.

---

# 22. FASE 12 — COMENTARIOS Y DSA

Como la actividad principal es editorial y los comentarios son secundarios, analiza correctamente el encaje del DSA.

Independientemente de la clasificación final, implementa buenas prácticas:

En cada comentario:

`Reportar`

Motivos:

* contenido ilegal
* spam
* acoso
* datos personales
* copyright
* otro

Base:

`comment_reports`

* id
* comment_id
* reporter_id
* reason
* details
* created_at
* status

Y:

`moderation_actions`

* id
* report_id
* moderator_id
* action
* reason
* created_at

No elimines automáticamente contenido denunciado sin revisión salvo supuestos técnicos evidentes como spam automatizado.

---

# 23. FASE 13 — ACCESIBILIDAD

Realiza auditoría siguiendo como objetivo práctico:

**WCAG 2.2 AA**

Revisar:

* semantic HTML;
* headings;
* landmark regions;
* alt;
* labels;
* keyboard;
* focus;
* focus-visible;
* contrast;
* reduced motion;
* dialogs;
* cookie banner;
* modals;
* formularios;
* mensajes de error;
* autenticación;
* checkout;
* dropdowns;
* carruseles;
* botones;
* links;
* iconos;
* responsive zoom.

No abuses de ARIA.

Primero HTML semántico.

Añadir:

`Skip to content`

cuando corresponda.

---

# 24. FASE 14 — IVA Y VENTAS UE

No presupongas el régimen fiscal.

Audita técnicamente que el sistema pueda manejar:

* IVA;
* país;
* dirección;
* moneda;
* taxes;
* facturas;
* Stripe Tax si está activado.

Si se venden servicios digitales o bienes a consumidores UE:

marca para revisión:

* OSS;
* umbrales;
* localización del consumidor;
* tipo de IVA;
* facturación.

No configures fiscalidad basándote en una suposición.

Crear:

`TAX_CONFIGURATION_REQUIRED`

si faltan datos.

---

# 25. FASE 15 — ENVASES

Para productos físicos, generar un bloque de auditoría empresarial:

* fabricante;
* envasador;
* distribuidor;
* productor;
* packaging;
* país;
* Registro de Productores;
* SCRAP/SRAP cuando proceda;
* obligaciones del RD 1055/2022;
* Reglamento UE 2025/40.

Esto puede no ser solucionable mediante código.

Si no existe información suficiente:

`PACKAGING_COMPLIANCE_EXTERNAL_REVIEW_REQUIRED`

No bloquear el desarrollo de contenido, pero sí marcarlo como requisito previo al primer envío cuando corresponda.

---

# 26. NEWSLETTER

Revisar todos los formularios.

No mezclar obligatoriamente:

`quiero obtener el Manifiesto`

con:

`acepto marketing`

salvo que el modelo jurídico real lo justifique claramente.

Preferir consentimientos separados.

Nunca:

* checkboxes premarcados;
* consentimiento escondido;
* aceptación mediante inacción.

Implementar:

* unsubscribe;
* suppression;
* withdrawal date;
* control de newsletter.

---

# 27. CONTACTO

Auditar:

`/contacto`

Debe disponer de:

* formulario accesible;
* validación server-side;
* protección anti-spam;
* mensajes de error claros;
* consentimiento/información de privacidad apropiada;
* protección frente a inyección;
* rate limiting cuando corresponda.

No exponer secretos.

---

# 28. SEGURIDAD

Audita:

* `.env`;
* claves expuestas;
* service role;
* Stripe secrets;
* webhook secrets;
* Supabase keys;
* endpoints;
* CORS;
* redirects;
* SSR;
* RLS;
* SQL;
* XSS;
* CSRF;
* SSRF cuando proceda;
* rate limiting;
* subida de archivos;
* formularios;
* comentarios;
* sanitización;
* headers.

Nunca enviar al cliente:

`SUPABASE_SERVICE_ROLE_KEY`

o:

`STRIPE_SECRET_KEY`.

Examinar historial/repo si hay indicios de secretos accidentalmente versionados.

Si detectas secretos comprometidos:

no basta con eliminarlos del archivo.

Indica:

**ROTAR CREDENCIAL.**

---

# 29. HEADERS

Revisar la posibilidad de configurar:

* Content-Security-Policy
* Strict-Transport-Security
* X-Content-Type-Options
* Referrer-Policy
* Permissions-Policy
* frame-ancestors

No implementar una CSP que rompa Stripe, Supabase, fuentes o imágenes.

Primero inventariar dominios necesarios.

---

# 30. SEO

Auditar:

* titles;
* descriptions;
* canonical;
* Open Graph;
* Twitter cards;
* sitemap;
* robots.txt;
* structured data;
* Article schema;
* Product schema;
* Organization;
* Breadcrumbs;
* hreflang si procede;
* pagination;
* redirects;
* 404;
* URLs antiguas.

La web anterior ya existe.

Por tanto:

**NO ROMPER SEO MEDIANTE CAMBIO DE URLs SIN REDIRECCIÓN.**

Crear mapa de:

`old_url → new_url → 301`

cuando corresponda.

---

# 31. CONTENIDO HISTÓRICO

No alteres automáticamente:

* nombres históricos;
* fechas;
* citas;
* conceptos;
* personajes;
* fuentes;

simplemente por parecer extraños.

El contenido está especializado en el Siglo de Oro.

Si detectas posibles errores históricos:

repórtalos.

No los reescribas sin evidencias.

---

# 32. IMÁGENES

Audita:

* dimensiones;
* WebP/AVIF;
* responsive images;
* lazy loading;
* priority hero;
* width/height;
* CLS;
* alt;
* peso;
* calidad.

No recomprimas innecesariamente assets gráficos donde sea importante mantener detalle.

Usar Astro Image cuando aporte ventajas y sea compatible con la arquitectura.

---

# 33. FUENTES

Audita:

* preload;
* self-hosted;
* font-display;
* pesos utilizados;
* archivos duplicados.

No compartas públicamente archivos de fuentes sin comprobar licencia.

---

# 34. PERFORMANCE

Objetivos orientativos Lighthouse en producción:

### Performance

≥ 90

### Accessibility

≥ 95

### Best Practices

≥ 95

### SEO

≥ 95

No sacrifiques UX real para inflar Lighthouse.

Revisar:

* JS enviado;
* islands;
* hidratación;
* imágenes;
* CSS;
* fuentes;
* third parties;
* layout shifts;
* LCP;
* INP;
* CLS.

Astro debe aprovecharse para enviar **cero JavaScript cuando no sea necesario**.

---

# 35. RESPONSIVE

Comprobar como mínimo:

* 320 px
* 375 px
* 430 px
* 768 px
* 1024 px
* 1280 px
* 1440 px
* 1920 px

Especial atención:

* navbar;
* hero;
* carruseles;
* cards;
* biblioteca;
* checkout;
* precios;
* tablas;
* footer;
* modals;
* cookie banner.

No debe existir scroll horizontal accidental.

---

# 36. DARK / LIGHT MODE

Si existen ambos temas:

audita ambos completamente.

Especialmente:

* logos;
* mapas;
* imágenes;
* contraste;
* botones;
* inputs;
* footer;
* modal;
* cookie banner.

No implementar automáticamente dark mode si el proyecto no lo contempla.

---

# 37. ERRORES Y ESTADOS VACÍOS

Cada flujo debe gestionar:

* loading;
* empty;
* error;
* success;
* unauthorized;
* forbidden;
* expired;
* offline cuando proceda.

Ejemplos:

* biblioteca vacía;
* búsqueda sin resultados;
* checkout cancelado;
* Stripe caído;
* comentario fallido;
* sesión expirada;
* suscripción vencida.

---

# 38. PÁGINA 404 Y ERRORES

Crear/revisar:

* 404;
* 500 cuando la plataforma lo permita;
* rutas inexistentes;
* errores de contenido.

La página 404 debe respetar el estilo Imperio Español.

---

# 39. TESTS

Ejecutar los tests existentes.

Si no existen, crear al menos pruebas razonables para flujos críticos.

Prioridad:

1. autenticación;
2. permisos;
3. Stripe;
4. webhook;
5. suscripción;
6. paywall;
7. checkout;
8. consentimiento;
9. cookies;
10. comentarios.

No crear cientos de tests superficiales.

Prioriza los que eviten pérdida económica, fuga de datos o acceso premium incorrecto.

---

# 40. BUILD FINAL

Ejecutar al menos:

* install limpio;
* lint;
* typecheck;
* tests;
* Astro check;
* build producción.

Corregir todos los errores.

No aceptar como finalizado:

* warnings críticos;
* errores TypeScript ignorados;
* imports muertos;
* rutas rotas;
* variables inexistentes.

---

# 41. VARIABLES DE ENTORNO

Crear/revisar:

`.env.example`

Debe contener únicamente nombres:

`PUBLIC_SUPABASE_URL=`

`PUBLIC_SUPABASE_ANON_KEY=`

`SUPABASE_SERVICE_ROLE_KEY=`

`STRIPE_SECRET_KEY=`

`STRIPE_WEBHOOK_SECRET=`

etc.

Nunca valores reales.

Documentar cuáles se requieren en producción.

---

# 42. PRODUCCIÓN

Antes de considerar finalizada la web:

revisar:

* dominio;
* HTTPS;
* www/non-www;
* canonical;
* redirects;
* Vercel environment;
* Stripe LIVE MODE;
* webhook producción;
* Supabase producción;
* email production;
* rate limits;
* backups;
* analytics;
* cookies;
* sitemap;
* robots;
* emails transaccionales.

Distingue siempre:

`Stripe Test`

de:

`Stripe Live`.

---

# 43. DOCUMENTACIÓN

Crear o actualizar:

`README.md`

Incluyendo:

* instalación;
* desarrollo;
* build;
* variables;
* Supabase;
* Stripe;
* webhooks;
* deployment;
* estructura del proyecto;
* procedimientos importantes.

Crear adicionalmente:

`docs/LEGAL-COMPLIANCE.md`

con matriz:

| Obligación | Implementación | Archivo | Estado |
| ---------- | -------------- | ------- | ------ |

Y estados:

* ✅ Implementado
* ⚠️ Requiere datos
* ⚠️ Revisión jurídica
* ❌ Pendiente
* N/A

---

# 44. ARCHIVO FINAL DE AUDITORÍA

Crear:

`FINAL-AUDIT.md`

Debe contener exclusivamente:

# Resumen

# Cambios realizados

# Problemas encontrados

# Problemas corregidos

# Seguridad

# Legal

# Stripe

# Supabase

# E-commerce

# Accesibilidad

# SEO

# Performance

# Tests

# Datos pendientes del propietario

# Obligaciones externas

# Preparación para producción

# Bloqueadores de lanzamiento

---

# 45. CRITERIO DE BLOQUEADOR

Clasifica cada problema:

### P0 — BLOQUEA LANZAMIENTO

Ejemplos:

* pago inseguro;
* secreto expuesto;
* ausencia de consentimiento necesario;
* cookie tracking ilegal antes de consentimiento;
* Stripe webhook vulnerable;
* acceso premium sin pago;
* producto físico sin información legal esencial;
* checkout engañoso;
* política legal con empresa equivocada.

### P1 — DEBE CORREGIRSE

Problema serio pero no crítico.

### P2 — MEJORA

UX, performance, consistencia.

### P3 — OPCIONAL

Refinamiento.

Corrige todos los P0 y P1 técnicamente solucionables.

---

# 46. IMPORTANTE: NO QUIERO UN REDISEÑO AUTOMÁTICO

Si la interfaz ya funciona:

NO reemplaces arbitrariamente:

* tipografía;
* colores;
* imágenes;
* layout;
* ornamentación;
* textos;
* naming.

El trabajo principal es:

**auditar → corregir → terminar → optimizar.**

---

# 47. NO BORRES FUNCIONALIDAD

Antes de eliminar código aparentemente antiguo:

1. busca referencias;
2. comprueba rutas;
3. comprueba imports;
4. comprueba Git;
5. determina si sigue siendo necesario.

No realices grandes refactors si no aportan valor real al cierre.

---

# 48. GIT

Trabaja con cambios claros.

No mezcles innecesariamente:

* refactor;
* diseño;
* legislación;
* Stripe;
* DB;

en una modificación imposible de revisar.

Antes de acciones destructivas:

detente.

Nunca:

* borres producción;
* resetees Supabase;
* elimines tablas;
* borres usuarios;
* vacíes Stripe;
* sobrescribas configuración remota;

sin aprobación explícita.

---

# 49. PREGUNTAS AL PROPIETARIO

Agrupa todas las preguntas siempre que sea posible.

No hagas:

Pregunta → esperar → pregunta → esperar → pregunta.

Haz:

## DATOS NECESARIOS PARA CONTINUAR

1. Razón social:
2. NIF:
3. Domicilio:
4. Dirección de devoluciones:
5. Fabricante:
6. Email legal:
7. etc.

Mientras esperas esos datos, continúa con todo lo que no dependa de ellos.

---

# 50. DEFINICIÓN FINAL DE “TERMINADO”

No declares el proyecto terminado hasta cumplir:

## Código

* build limpio;
* TypeScript limpio;
* sin errores críticos;
* sin rutas rotas.

## Seguridad

* ningún secreto cliente;
* RLS auditado;
* webhooks verificados;
* inputs validados.

## Legal

* páginas existentes;
* enlaces correctos;
* consentimientos;
* cookies;
* checkout;
* desistimiento;
* productos;
* comentarios.

## Stripe

* checkout;
* webhooks;
* customer portal;
* cancelación;
* renovaciones;
* impagos.

## Supabase

* RLS;
* consentimientos;
* subscriptions;
* perfiles;
* comments.

## UX

* responsive;
* estados;
* errores;
* accesibilidad.

## SEO

* sitemap;
* robots;
* metadata;
* redirects.

## Performance

* imágenes;
* JS;
* fuentes;
* Core Web Vitals razonables.

## Producción

* variables;
* dominio;
* HTTPS;
* servicios LIVE comprobados.

---

# 51. RESULTADO FINAL QUE QUIERO DE TI

Cuando termines, responde únicamente con un informe ejecutivo estructurado:

## 1. ESTADO

`LISTO PARA PRODUCCIÓN`

o

`NO LISTO PARA PRODUCCIÓN`

## 2. SCORE

* Legal: X/100
* Seguridad: X/100
* Stripe: X/100
* Supabase: X/100
* Accesibilidad: X/100
* SEO: X/100
* Performance: X/100
* UX: X/100

## 3. BLOQUEADORES

Solo P0.

## 4. DATOS QUE NECESITO APORTAR

Lista exacta.

## 5. ACCIONES EXTERNAS

Ejemplo:

* registro envases;
* OSS;
* revisión asesor;
* claves producción;
* Stripe Live.

## 6. CAMBIOS REALIZADOS

Resumen.

## 7. TESTS EJECUTADOS

Resultado.

## 8. DEPLOY

Indicar:

`APTO PARA DEPLOY`

o:

`NO HACER DEPLOY`

---

# 52. INSTRUCCIÓN FINAL

Empieza ahora.

Primero realiza **FASE 0 — inventario del repositorio**.

Después ejecuta las fases secuencialmente sin pedirme permiso entre cada una.

Soluciona autónomamente todo lo que sea seguro y técnicamente verificable.

Pregunta únicamente por datos empresariales, jurídicos, fiscales o de producción que no puedas conocer.

No ocultes errores para conseguir una puntuación alta.

No declares cumplimiento legal sin evidencia.

No sacrifiques estabilidad por refactors estéticos.

El objetivo final es:

**DEJAR IMPERIOES.COM TÉCNICAMENTE TERMINADA, LEGALMENTE ESTRUCTURADA, SEGURA, RÁPIDA, ACCESIBLE Y PREPARADA PARA PRODUCCIÓN.**
