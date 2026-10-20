# Cierre comercial y CMS, 20 de octubre de 2026

Este informe completa el registro del prompt maestro. IMPLEMENTADA significa
codigo disponible; VERIFICADA indica una comprobacion concreta. No convierte una
fixture en una compra real ni una prueba responsive en una prueba de iPhone.
La evidencia de publicacion se anota tras comprobar el despliegue.

## Fases

| Fase | Estado y evidencia |
| --- | --- |
| 0. Diagnostico | VERIFICADA: nueva auditoria de solo lectura de Stripe Live y Supabase; agregado privado en tmp/commercial-audit/2026-10-20.json. |
| 1. Home | IMPLEMENTADA Y VERIFICADA: HERO conservado, camiseta antes de historia/manifiesto/planes, orden de ruta compilada y revision Live anterior. |
| 2. Compra | IMPLEMENTADA Y VERIFICADA: producto, carrito, tallas, cantidades, datos una vez, precio y envio separados; pago completo en Stripe Test y compras Live existentes conciliadas. No se crea un cargo Live para QA. |
| 3. Administracion | IMPLEMENTADA: biblioteca unica, busqueda por titulo/URL, filtros y contadores, editor separado, borrador, imagenes, vista previa, publicacion, retirada y papelera. VERIFICADA en navegador con datos sinteticos y en rutas compiladas. |
| 4. Integridad | VERIFICADA: seis pagos Live con pedido, ningun pedido sin sesion pagada, ningun propietario con suscripciones activas duplicadas y ningun stock negativo. SQL Test con rollback para snapshots, revisiones, restauracion y permisos. |
| 5. Privacidad | IMPLEMENTADA; consentimiento basico y control de retirada verificados anteriormente en ambos hosts. Textos publicados tras validacion del asesor declarada por el titular; no es una certificacion juridica independiente. |
| 6. Analitica | IMPLEMENTADA Y VERIFICADA EN PARTE: GA4/GTM y Data API reales; recepcion de page_view/view_item y dashboard autenticado comprobada el 19. Compras verificadas tecnicamente contra recibos de servidor. Limites de atribucion detallados abajo. |
| 7. Email | IMPLEMENTADA Y ACTIVADA: cinco series comerciales, 12 mensajes, mas confirmaciones de pedido; solo nuevos usuarios verificados con consentimiento vinculado. Historicos revisados y no inscritos sin elegibilidad. Scheduler real comprobado anteriormente. |
| 8. Seguridad | VERIFICADA dentro del alcance: identidad administrativa fija y confirmada, CSRF, limites, privados no-store, aislamiento de cuerpos premium, sanitizacion de HTML, imagenes recodificadas, conflictos y privilegios RPC. No constituye pentest externo ni prueba de que cada cuenta sea humana. |
| 9. Responsive/rendimiento | VERIFICADA EN PARTE: biblioteca/editor en Chrome a 320, 768 y escritorio; sin desbordamiento horizontal; recorridos publicos moviles revisados el 19. PENDIENTES dispositivos iOS/Android reales, navegadores integrados Instagram/X y mediciones de campo CWV. |
| 10. Regresion/cierre | VERIFICADA: 164 unitarias, Astro check sin errores/warnings, build, lint administrativo, 15 suites compiladas generales, suite CMS y SQL Test. Verificacion Live posterior al despliegue registrada en el historial principal. |

## Informe de 18 puntos

1. **Ventas.** Seis cobros correctos, 179,94 EUR, sin reembolsos en la consulta.
   La cifra procede de Stripe y se contrasta con commerce_orders, no de correos.
2. **Intentos.** Ocho sesiones caducadas sin pagar: una de camiseta y siete de
   suscripcion. Cero sesiones abiertas sin pagar. Ninguna se cuenta como venta.
3. **Fallo de tarjeta.** Cero PaymentIntents con last_payment_error en la consulta;
   una sesion caducada no demuestra rechazo bancario.
4. **Registro gratuito.** 518 perfiles Piquero en la instantanea; esto no implica
   518 compradores, personas verificadas o destinatarios de marketing.
5. **Embudo.** La medicion consentida es parcial. Hay recorridos historicos con
   pasos intermedios ausentes; no permiten atribuir una perdida comercial exacta.
   La interfaz distingue caminos incompletos, actividad en curso y abandonos.
6. **Stripe.** Cuenta acct_1UCc4cDRITvLIOKF con charges_enabled y payouts_enabled;
   webhook de produccion enabled. Las comprobaciones de esta revision son GET.
7. **Precios.** Camiseta 26,99 EUR mas 3 EUR de envio por unidad, IVA incluido y
   Peninsula. Planes Arcabucero 1,99/17,99 EUR y Maestre 3,99/37,99 EUR. Beneficio
   de camiseta 15/20 %, no acumulable, envio excluido y suscripcion activa.
8. **Supabase.** Cero diferencias de conciliacion pedido/sesion pagada, cero
   duplicados activos y cero inventarios negativos. Tres suscripciones historicas
   legacy_unverified siguen archivadas sin atribuir pagos ni acceso pagado.
9. **Avisos al titular.** Canal ORDER_PAID independiente con direccion final,
   tallas y cantidades; seis avisos entregados en la revision anterior. La prueba
   compilada cubre reintentos, deduplicacion, destinatario y datos incompletos.
10. **IONOS.** Mensajes tecnicos recibidos: directo y formulario real. Envio por
    Resend desde contacto@imperioes.com no crea copia IMAP en Enviados de IONOS.
11. **GA4/GTM.** Se conservan G-VDMP7TKMNY y GTM-5VRFG7ZT. Propiedad 558692820,
    lector de servidor sin credencial en el cliente. La recepcion real anterior
    demuestra navegacion, no una nueva compra ni atribucion completa de ventas.
12. **Consentimiento.** Sin decision de analitica no se carga Google; rechazar y
    retirar se comprueban compartidos entre root/www. Rutas privadas excluidas.
13. **Email comercial.** Bienvenida y recuperacion diferenciadas de confirmacion
    de pedido. Se revisa consentimiento, compra, baja y duplicados antes de enviar.
    No se afirma que un paquete se ha enviado sin una accion de logistica.
14. **Historicos.** No se han borrado cuentas sospechosas ni enviado campanas
    retrospectivas. Falta de verificacion por si sola no prueba que sean bots.
15. **CMS.** Abrir Articulos muestra una biblioteca, no un formulario vacio.
    Crear abre el editor. Guardar borrador conserva la version publica. Publicar
    exige confirmacion. Eliminar usa papelera; restaurar nunca publica por si solo.
    Los articulos antiguos se editan desde el mismo listado, sin selector separado.
16. **Pruebas.** Ciclo crear/guardar/preview/publicar/eliminar/restaurar y descarte
    probado visualmente en un servidor local de fixtures en memoria, sin red real.
    SQL Test verifica tambien los archivos antiguos retirados/restaurados y URLs
    canonicas. No se modifican articulos reales para probar el CMS.
17. **Limites pendientes.** No se inventa add_payment_info dentro de Stripe
    hospedado: no existe observacion fiable del momento de introducir la tarjeta.
    login/sign_up no se presentan como eventos GA4 verificados. Ingresos por
    campana siguen "no medidos" sin correlacion consentida; no se cruzan correos
    con pedidos para rellenar atribuciones. Pruebas fisicas/CWV quedan abiertas.
18. **Operacion y seguimiento.** Vigilar pedidos pagados frente a avisos y entregas,
    inventario disponible, webhooks fallidos, bajas/supresiones, abandono solo de
    recorridos completos y conversiones realmente recibidas en GA4. Los seis
    pedidos constan READY_FOR_FULFILLMENT: preparacion/envio fisico y actualizacion
    del estado siguen correspondiendo al equipo, no se marcan enviados por inferencia.

## Seguridad de esta entrega

- Migracion 038 cambia unicamente la funcion de transicion editorial y conserva
  permisos de servicio. Huellas de articulos/stock y recuentos comerciales
  comparados antes/despues; no se altera ningun registro editorial al aplicarla.
- Un articulo antiguo eliminado/retirado deja de exponerse tambien por su archivo
  original. Restaurarlo queda retirado hasta una publicacion expresa.
- Se conserva la modificacion local ajena en TshirtLeadPopup.astro; no se incluye
  automaticamente en esta entrega.
- Sin nuevas contrasenas, permisos superiores, cargos Live o envios masivos.

## Evidencia reproducible

- npm test; npm run check; npm run build; npm run lint:admin
- npm run test:integration; node scripts/verify-article-cms.mjs
- SUPABASE_TEST_WORKDIR configurado: node scripts/verify-article-publication-db.mjs
- node scripts/migrate-article-lifecycle.mjs [--test] [--apply]
- node scripts/verify-commercial-production.mjs, despues de publicar
- Capturas privadas: tmp/commercial-audit/qa-2026-10-20/

No hay bloqueos para vender o para usar el CMS. Los limites del punto 17 impiden
afirmar que todas las mediciones y todos los dispositivos estan verificados.
