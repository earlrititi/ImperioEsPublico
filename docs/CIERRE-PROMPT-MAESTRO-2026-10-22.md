# Cierre del prompt maestro: 22 de octubre de 2026

Este documento actualiza el cierre del 20 de octubre. IMPLEMENTADA significa
codigo disponible; VERIFICADA indica la comprobacion descrita, no una garantia
universal. Los importes de Stripe no se sustituyen por contadores de GA4 ni por
correos. No se hacen nuevos cargos Live, envios masivos ni cambios editoriales
para simular resultados.

## Fases y alcance

| Fase | Estado | Comprobacion |
| --- | --- | --- |
| 0. Diagnostico | VERIFICADA | Consultas actuales de solo lectura a Stripe y Supabase, auditoria agregada de los ultimos 30 dias y del historial. GA4 real consultado desde el dashboard autenticado. |
| 1. Home | IMPLEMENTADA / VERIFICADA | HERO conservado y orden comercial comprobado en la ruta compilada. Manifiesto sin apellidos en Inicio y Manifiesto. |
| 2. Tienda y compra | IMPLEMENTADA / VERIFICADA | Carrito, tallas, cantidades, precio, envio, datos una sola vez y compra invitada cubiertos por regresion; pagos alojados Test completos documentados el 18 de octubre. |
| 3. Dashboard y CMS | IMPLEMENTADA / VERIFICADA | Biblioteca real accesible; crear, buscar, borradores, preview, publicar, retirar, papelera, restaurar e imagenes probados con rutas compiladas y servicios simulados. No se modifica un articulo real para probar. |
| 4. Integridad | VERIFICADA | Seis pagos asociados a seis pedidos, seis avisos administrativos entregados, cero discrepancias, inventarios negativos o propietarios con suscripciones activas duplicadas. |
| 5. Consentimiento | IMPLEMENTADA / VERIFICADA TECNICAMENTE | Basic Consent Mode, version de cookies actualizada, rechazos, persistencia y retirada cubiertos por pruebas. Analitica y email marketing siguen separados. No es una certificacion juridica independiente. |
| 6. GA4/GTM | IMPLEMENTADA / VERIFICADA EN PARTE | Data API real disponible. Nuevos ingresos y conversion por fuente/campana/dispositivo; login y sign_up confirmados y consentidos, probados sin trafico real a Google. La recepcion de esos nuevos eventos requiere una accion real posterior. |
| 7. Email | IMPLEMENTADA / ACTIVACION VERIFICADA | Cinco series comerciales y confirmacion transaccional de pedidos. Panel real indica envios autorizados. Cero cuentas elegibles y cero trabajos en la consulta actual; no se fuerza un envio. Atribucion futura por etiquetas compartidas, no por identidad. |
| 8. Seguridad | VERIFICADA EN EL ALCANCE | Rutas privadas, roles, CSRF, firmas, limites, sanitizacion, aislamiento premium y secretos de servidor cubiertos por pruebas. Dependencias corregidas; npm audit sin avisos conocidos. No sustituye un pentest. |
| 9. Responsive y rendimiento | VERIFICADA EN PARTE | Pruebas responsive anteriores y nueva comprobacion visual del panel. PENDIENTES dispositivos fisicos iOS/Android, navegadores integrados Instagram/X y Core Web Vitals de campo. |
| 10. Regresion | VERIFICADA | 184 unitarias, check sin errores ni warnings (6 hints previos), build y suites compiladas de comercio, autenticacion, CMS, consentimiento, preferencias y correo. |

## Informe de 18 puntos

1. **Diagnostico inicial y actual.** Stripe mantiene seis cobros correctos por
   179,94 EUR, sin reembolsos en la consulta. Ticket medio: 29,99 EUR. Los seis
   pagos estan dentro de los ultimos 30 dias; se ha comprobado tambien el historial.
2. **Compras reales.** Seis camisetas en seis pedidos; ningun pedido sin sesion
   pagada y ninguna sesion de camiseta pagada sin pedido. No hay suscripciones
   Stripe activas en esta instantanea. Las tres antiguas siguen legacy_unverified.
3. **Checkouts.** Ocho sesiones caducadas sin pagar: una de camiseta y siete de
   suscripcion. Cero abiertas sin pagar. No hay PaymentIntents con ultimo error
   de pago; una caducidad no demuestra que un banco rechazara una tarjeta.
4. **Fuga comercial.** Predomina la entrada sin avance registrado: 78 de 87
   recorridos consentidos de camiseta no muestran un paso posterior. Hay cuatro
   caminos incompletos y eventos implantados despues del lanzamiento: estos
   datos no permiten afirmar un abandono financiero exacto ni reconstruir la
   conducta de todos los visitantes. Las 533 cuentas Piquero no son compradores.
5. **Errores corregidos en este cierre.** El script de diagnostico ya no cuenta
   el ultimo paso como abandono y utiliza las mismas cohortes que el dashboard.
   Incluye newsletter, caminos incompletos y actividad en curso. Se corrige su
   lectura de identificadores al conciliar avisos con pedidos. El panel no anuncia
   falsamente que los envios estan desactivados mientras aun esta cargando.
6. **Home y tienda.** Se conserva la composicion original del HERO. La camiseta
   aparece despues, con compra invitada, guia de tallas, disponibilidad sin cifras
   exactas, carrito y desglose de 26,99 EUR + 3 EUR de envio por unidad. No se
   inventan resenas, escasez ni ventas. El manifiesto solo pide nombre y correo.
7. **Stripe.** Cuenta acct_1UCc4cDRITvLIOKF con cobros y transferencias habilitados,
   webhook enabled y catalogo mensual/anual existente. Los precios y cantidades
   se seleccionan en servidor; esta entrega no cambia tarifas ni crea pagos.
8. **Supabase.** Cero discrepancias financieras o stock negativo. No se requiere
   una migracion nueva para este cierre. No se reaplican migraciones de produccion.
   Las pruebas SQL anteriores estan documentadas; no se presentan como repetidas
   ahora. Los helpers antiguos de SQL Test requieren revisar la compatibilidad
   con linked-project.json antes de reutilizarlos con la CLI actual.
9. **GA4.** Propiedad 558692820, G-VDMP7TKMNY. En la revision real de 30 dias hasta
   ayer: 91 usuarios activos, 112 sesiones y 225 vistas; 19 view_item, 7 add_to_cart,
   7 view_cart y 3 begin_checkout. Cero compras medidas, que no anulan las seis
   ventas Stripe. No se dividen recuentos de eventos para inventar una cohorte.
10. **GTM.** Se conserva GTM-5VRFG7ZT, con una unica carga tras consentimiento.
    No se publica otro contenedor ni se exporta la credencial privada de servidor.
11. **Consent Mode.** Basico: no SDK ni pings Google antes de aceptar; permisos
    publicitarios Google denegados. Version de cookies 2026-10-22: se vuelve a
    solicitar eleccion, sin convertir consentimientos antiguos en nuevas aceptaciones.
12. **Aceptacion/rechazo/retirada.** Cubiertos por pruebas de cliente y rutas
    compiladas; se conservan las comprobaciones Live del 19 de octubre. El nuevo
    marcador de autenticacion solo nace tras una accion confirmada y consentimiento
    previo; firma, caducidad, manipulacion, retirada y repeticion estan probadas.
    Google sigue bloqueado en login, cuenta, administracion y checkout privado.
13. **Legales.** Cookies y privacidad describen el marcador HttpOnly de cinco
    minutos y su deduplicacion local. Solo se devuelve tipo de accion/metodo al
    cliente, nunca email, usuario, contrasena ni destino privado. El titular conserva
    los datos legales existentes. No se declara una nueva validacion del asesor.
14. **Dashboard.** GA4 anade ingresos y porcentaje de usuarios que compran por
    campana/fuente/dispositivo. Los importes medidos excluyen IVA/envio, no son el
    cobro bruto. Distingue cero, ausencia de datos, indisponibilidad y umbrales.
    Configuracion muestra correo, flags comerciales, identificadores publicos de
    medicion y versiones legales. Es privada y de solo lectura; no muestra claves.
15. **Email.** Seis avisos de pedidos pagados entregados; cero pendientes y cero
    pedidos sin aviso. From/Reply-To contacto@imperioes.com; los avisos al titular
    usan el destinatario administrativo existente. Resend no crea copias IMAP en
    Enviados de IONOS. No se reenvian recibos ni correos de prueba en este cierre.
    Los CTA comerciales futuros incorporan solo serie y paso compartidos; GA4
    muestra atribucion consentida de 30 dias, no una reconstruccion retrospectiva.
16. **Pruebas.** npm run verify:master agrupa la regresion reproducible sin cargos
    reales. La suite de autenticacion incluye 36 escenarios de rutas compiladas;
    GA4 comprueba aislamiento de secretos; CMS usa fixtures y no articulos reales.
    Astro 7.3.8, sanitize-html 2.18.1 y sus dependencias compatibles resuelven los
    tres avisos encontrados en npm audit. Sin actualizaciones major forzadas.
17. **Pendientes externos.** Validacion en dispositivos fisicos y datos de campo;
    observacion de nuevas altas/compras consentidas cuando ocurran realmente.
    add_payment_info no se fabrica: la pagina alojada de Stripe no proporciona
    una observacion fiable del instante de introducir la tarjeta. Los seis pedidos
    siguen READY_FOR_FULFILLMENT: su envio fisico y cambio de estado son tareas del
    equipo, aunque se hubiera comunicado su envio por otro canal. No se marcan
    enviados por inferencia. Cualquier campana masiva historica requiere aprobacion.
18. **Seguimiento.** Comparar ventas Stripe, pedidos, avisos y entrega; medir visitas
    a producto, carrito y checkout en cohortes observables; vigilar errores, bajas
    y atribucion de campanas sin equiparar analitica consentida al total del negocio.
    Auditoria Piquero actual: 533 perfiles, 46 confirmados y 487 sin confirmar;
    438 requieren revision por inactividad sin verificar superior a siete dias.
    Ninguna senal demuestra por si sola que sean bots; no se borra ninguna cuenta.

## Evidencia y reproduccion

- `npm run verify:master`: codigo, tipos, build, lint, unitarias e integraciones
  con transportes simulados, mas auditoria de dependencias del registro npm.
- `node scripts/audit-commercial.mjs`: GET/SELECT reales; requiere Node compatible
  y las credenciales locales existentes. Produce agregados privados, no envia correos.
- `node scripts/audit-piquero-accounts.mjs`: revision de solo lectura. El detalle
  con datos personales queda fuera de Git; no se adjunta a este informe.
- `node scripts/verify-commercial-production.mjs`: rutas y artefacto CMS servido.
  No usar `--maintenance` como una lectura: esa opcion invoca workers.
- Evidencia local no versionada: `tmp/commercial-audit/2026-10-22.json` y
  `tmp/commercial-audit/piquero-review-2026-10-22.json`.
- Definiciones de conversion e ingresos:
  [esquema oficial de Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema).

No hay un bloqueo conocido para vender o editar articulos. Esto no convierte
las pruebas simuladas en una compra o un email real, ni acredita dispositivos
que no se han usado. La publicacion debe comprobarse con READY, ambos dominios
y el panel autenticado antes de dar por entregado el nuevo codigo.
