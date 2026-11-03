# SEO y GEO: motor editorial de Imperio E

Implementacion: 3 de noviembre de 2026. Panel privado: `/admin/seo`.
Este documento amplia `SEO-GEO.md`, `SEO-GEO-IMPERIO-ESPANOL.md` y
`EDITORIAL-ACCESS.md`; aquellos conservan las reglas de acceso y publicacion.

## Arquitectura

- Astro 7.4, Preact, Supabase y Resend existentes. Node 24 para validar y construir.
- Fuente de verdad: `cms_articles` para publicaciones gestionadas; catalogo
  `ARTICLES_ITEMS` y archivos privados para los 23 originales no sustituidos por CMS.
- El inventario unifica esas fuentes y respeta retiradas/papelera. Analiza metadatos,
  referencias y enlaces. El contexto enviado a IA de una pagina premium contiene
  unicamente titulo, entradilla y descripcion publicos.
- El grafo combina coincidencias textuales, referencias existentes y periodos
  candidatos del diccionario. Esas relaciones inferidas requieren revision; no son
  nuevas afirmaciones historiograficas. No se usan embeddings externos.
- `seo-engine-model.ts`: contratos y limites; `seo-engine-inventory.ts`: inventario,
  relaciones, propuestas de mejora y banco de consultas; `seo-engine-http.ts`:
  lectura HTTPS con DNS validado y fijado; `seo-engine-generation.ts`: proveedor y
  verificacion; `seo-engine.ts`: operaciones; `seo-engine-worker.ts`: trabajos y correo.

## Persistencia y permisos

Migraciones incrementales `041_seo_engine.sql`, `042_seo_generation_versions.sql`
y `043_seo_reopen_opportunity.sql`; `044_seo_scheduler.sql` amplia el dispatcher
existente para que las tareas SEO sigan ejecutandose con marketing pausado:

| Estructura | Funcion |
| --- | --- |
| `seo_engine_config` | Pausas, limites, presupuesto y revision optimista |
| `seo_opportunities` | Propuestas, intencion, contribucion, fuentes, estado |
| `seo_reviews` | Version exacta del CMS, fuentes y afirmaciones, decisiones |
| `seo_jobs` | Cola, reservas de coste, leases, reintentos y recibos Resend |
| `seo_records` | Fuentes, candidatos, observaciones, auditorias e informes |

Todas tienen RLS y acceso exclusivo de servidor. No se duplican usuarios ni cuerpos
publicables. `commerce_audit` registra cambios y aprobaciones. Un trigger impide
publicar articulos asociados al motor usando otra ruta del CMS sin la aprobacion
   de esa misma version. Los articulos manuales previos mantienen su flujo actual.

## Flujo editorial

1. Consultar Inventario o Detectar oportunidades. Las propuestas son cualitativas;
   no se inventan volumen, dificultad ni trafico. Mejoras de paginas existentes
   quedan como propuestas y se editan mediante importacion en el CMS; no se
   generan sustituciones automaticas de texto premium.
2. Registrar al menos dos documentos en Fuentes: URL de un archivo o biblioteca
   admitido, titulo, institucion y extracto literal que aparezca en la pagina.
   Autoria, ano y signatura solo cuando constan. PDFs y paginas inaccesibles no se
   dan por verificadas: requieren una transcripcion HTML o investigacion adicional.
3. Crear una oportunidad, seleccionar fuentes/articulos relacionados, indicar
   aportacion original y aprobarla para generacion. Se comprueban solapamientos.
4. Preparar borrador: reserva presupuesto y encola. Procesar pendientes ejecuta
   una llamada acotada al proveedor. Los estados pasan por investigacion y revision.
5. Se guarda en `cms_articles` como borrador; no se publica. Se conservan el registro
   de afirmaciones, extractos, hashes, fecha de consulta y resultado automatico.
6. Se encola un aviso transaccional para **imperio_e@hotmail.com**, unico por
   revision. El enlace GET abre una vista privada; no aprueba ni publica.
7. Abrir revision y editar en el CMS. Completar autoria editorial, fecha y contenido.
   La IA nunca inventa un revisor; la publicacion guarda UUID y nombre del revisor
   real que confirma la accion, y hace visible la elaboracion asistida y revision.
8. Validar y enviar nueva revision crea una version comprobada nueva. El nombre,
   las comprobaciones realizadas y la confirmacion explicita son obligatorios.
9. Aprobar y publicar usa POST autenticado, Origin valido, revision exacta y una
   transaccion. No hay aprobacion por token ni acceso publico al borrador. Repetir
   la publicacion no duplica articulo ni correo. Cambiar el cuerpo invalida la
   aprobacion. Rechazar o solicitar cambios impide publicar esa revision.
10. Catalogo, sitemap y feed se calculan desde las publicaciones existentes; no hay
    cache de articulo que invalidar. El aviso de publicacion conserva la revision.

La verificacion automatica comprueba formato, coincidencia de extractos, fuentes,
referencias, fechas de publicacion, sanitizacion y duplicidad. Clasifica afirmaciones
como parciales, pendientes, contradictorias o sin fuente. Una coincidencia textual
no certifica fechas historicas, atribuciones o interpretaciones; el revisor debe
contrastar esos extremos. Los bloqueos impiden publicar.

## Proveedor y limites de coste

Variables exclusivamente de servidor en `.env.example`:

- `SEO_AI_ENDPOINT`: endpoint compatible Chat Completions. Hosts permitidos:
  api.openai.com, openrouter.ai y api.mistral.ai; no se habilita ningun contrato.
- `SEO_AI_API_KEY`, `SEO_AI_MODEL`.
- `SEO_AI_INPUT_CENTS_PER_MILLION`, `SEO_AI_OUTPUT_CENTS_PER_MILLION`: tarifas reales
  verificadas del proveedor en centimos. No se presupone un modelo ni un precio.
- `SEO_ENGINE_ENABLED`: habilita la rama SEO del mantenimiento existente.
- `SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON`: cuenta de solo lectura opcional;
  reutiliza `GA4_SERVICE_ACCOUNT_JSON` cuando existe y tiene acceso a la propiedad.

El presupuesto comienza en cero y la generacion pausada. Las reservas se serializan
en Postgres antes de llamar al proveedor. Se usa una cota conservadora de tokens
de entrada, salida maxima, limites diarios/semanales y una generacion simultanea.
Los fallos de resultado incierto conservan la reserva y exigen revision; no se
reintenta a ciegas una llamada de pago. Los costes se guardan cuando hay usage.

Configuracion inicial: dos borradores y tres propuestas de mejora por semana;
cinco candidatos a colaboracion al mes. Son limites de capacidad interna.

## Correo y programacion

Reutiliza Resend, remitente/contacto y secreto de mantenimiento existentes.
Los avisos administrativos no se mezclan con audiencias ni consentimientos de
marketing. Payload inmutable antes del envio, clave Resend estable por job,
backoff exponencial, cinco intentos y ventana maxima de 23 horas. El panel distingue
aceptacion del proveedor, entrega confirmada, rebote y fallo. No se afirma entrega
con una respuesta de aceptacion.

Reutiliza el cron Supabase que llama a `/api/commerce-maintenance`. No se crea otro
cron. La rama SEO esta aislada de los fallos del comercio. `/api/seo-maintenance`
permite ejecutar exclusivamente SEO con el mismo Bearer secreto; GET no modifica.

- Diario: auditoria HTTP/canonical/H1/metadata/schema/robots/sitemap de destinos
  prioritarios, avisos de fallos y notificaciones pendientes.
- Semanal: inventario, mejoras y propuestas nuevas; encola solo oportunidades
  aprobadas con fuentes suficientes y dentro del presupuesto.
- Mensual: informe, Search Console disponible y retencion de respuestas antiguas.
- Cada mantenimiento: como maximo un trabajo de cada clase; deduplicacion UTC por
  dia, semana y mes. La generacion exige ademas proveedor y configuracion habilitada.

No se declara programacion activa hasta verificar desplegado el worker, el flag,
la configuracion y una ejecucion persistida.

## Colaboraciones y GEO

El modulo de colaboradores guarda relacion editorial, evaluacion, contacto publico,
riesgos, articulo relacionado y borrador de correo. Las transiciones exigen
autorizacion previa al contacto y evidencia para registrar contacto/acuerdo.
El envio a terceros queda manual: no se mandan propuestas automaticamente.
Los enlaces se comprueban con HTTP y HTML real, destino y `rel`; un candidato no es
una colaboracion activa. Patrocinios/acuerdos materiales usan sponsored, aportes
de usuarios ugc y asociaciones sin respaldo nofollow. Un fallo no prueba un enlace
perdido: la ultima comprobacion y su fecha permanecen visibles para revision.

El banco GEO usa preguntas de los articulos reales. Registro manual o importacion
autorizada exige fecha, plataforma, pais/idioma, respuesta, URLs y evidencia. Se
distinguen cita directa al dominio, mencion declarada de marca, ausencia y caso no
verificable. Una referencia historica a "Imperio espanol" no cuenta automaticamente
como mencion de la marca. Los duplicados se rechazan. No hay robots que accedan
sin autorizacion a productos de ChatGPT, Google, Gemini, Copilot o Claude.

Search Console utiliza query/page y devuelve estado, periodo y filas reales; cero
y falta de acceso son estados diferentes. No se atribuye al API un desglose IA
que no devuelve este endpoint. GA4 y pedidos verificados siguen en sus paneles
existentes: no se convierten eventos consentidos en ingresos contables.

## Seguridad, pausas y reversibilidad

- Pausar generacion: Configuracion > Generacion pausada.
- Pausar correos: Configuracion > Notificaciones pausadas.
- Detener todo SEO: `SEO_ENGINE_ENABLED=false` y deshabilitar programacion.
- Los trabajos, borradores y auditoria se conservan; los permisos premium no cambian.
- DNS publico comprobado, direccion fijada, redirecciones revalidadas, HTTPS, limite
  de respuesta y timeout; fuentes externas restringidas a archivos/bibliotecas.
- Contenido recuperado e IA son datos no confiables; se sanitiza HTML y no se
  ejecuta codigo del modelo. Claves y cuerpos privados no entran en el bundle cliente.
- Retencion configurable: se retira la respuesta textual antigua de observaciones;
  se conservan cita, fecha y evidencia. Las fuentes/versiones de aprobacion se
  conservan por trazabilidad. Contextos redundantes de jobs antiguos se retiran.

## Comprobaciones y operaciones

- `npm run verify`, `npm run lint`, `npm run lint:admin`, `npm run lint:seo-engine`.
- `node scripts/verify-seo-engine.mjs`: rutas compiladas, identidades, CSRF,
  privacidad, inventario real y ausencia de proveedor; red bloqueada.
  Tambien disponible como `npm run test:seo-engine`, incluido en `verify:master`.
- `node scripts/verify-seo-engine-db.mjs`: pruebas SQL en transaccion y ROLLBACK;
  `--apply` solo despues de verificarlas aplica 041 con todo pausado.
- `node scripts/verify-seo-engine.mjs --serve`: panel aislado en puerto 4343 con
  servicios en memoria; solo para QA, nunca evidencia de un proveedor real.
- `node scripts/operate-seo-engine.mjs --inventory`: lectura real agregada.
- `--propose`: persiste propuestas cualitativas; `--test-mail`: prueba real acotada
  al correo editorial, rechaza colas ajenas y restaura la pausa anterior.
- `--receipts`: concilia el evento real de Resend; no reenvia.
- `--enable-schedule`: habilita mantenimiento/correo y mantiene generacion pausada,
  presupuesto cero; `--run-schedule`: ejecuta solo tareas SEO.

Los scripts de operaciones leen credenciales locales ignoradas por Git y no las
imprimen. Los resultados y limites de la entrega se actualizan al finalizar las
pruebas reales; un fixture no demuestra un envio o una generacion real.

Referencias de integracion: [Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create),
[Search Analytics](https://developers.google.com/webmaster-tools/v1/searchanalytics/query),
[IA y sitios web](https://developers.google.com/search/docs/appearance/ai-features).

## Evidencia de esta entrega

- Produccion: 22 articulos publicados frente a 23 entradas originales; se respetan
  las retiradas del CMS. 83 relaciones/referencias y 23 consultas de seguimiento.
- Cinco oportunidades cualitativas guardadas. Dos candidatos institucionales para
  revision; cero contactos, acuerdos o backlinks atribuidos al sistema.
- Las dos paginas documentales probadas no se marcan verificadas: una devuelve
  403 y otra supera el limite. No hay fuentes nuevas aprobadas ni borradores IA.
- Resend: prueba administrativa a `imperio_e@hotmail.com`, evento `delivered`,
  proveedor `01a1a296-d301-7a61-85be-b95cd844b79f`. No se publico un articulo para probar.
- Migraciones 041-044 aplicadas tras pruebas con ROLLBACK, incluidas regeneracion,
  version original conservada, rechazo, limites de gasto y proteccion del editor.
- Jobs diario/semanal/mensual ejecutados y persistidos correctamente. Se reutiliza
  `imperio-commerce-maintenance`, activo cada cinco minutos. Generacion pausada,
  presupuesto cero y oportunidades pendientes de investigacion/aprobacion.
- 198 pruebas unitarias y suites compiladas de CMS, premium, autenticacion, correo,
  comercio y SEO. Lint y typecheck sin errores; siete hints anteriores de Astro.
- `npm audit --omit=dev`: cuatro avisos moderados previos en glob/minimatch y la
  cadena de herramientas del adaptador de Vercel. No se aplico el downgrade major
  propuesto por npm audit fix --force.
- La comprobacion visual no pudo completarse: la revision automatica del control
  de Chrome no pudo identificar con certeza la URL activa y detuvo la herramienta.
- Pendientes de acceso: API/modelo/tarifas para IA y permiso de lectura de Search
  Console para la cuenta de servicio. Los proveedores GEO permanecen manuales.
