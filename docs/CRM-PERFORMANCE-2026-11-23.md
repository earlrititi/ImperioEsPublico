# Rendimiento y control del CRM

`/admin/automatizaciones` incorpora el informe agregado de las colas comerciales.
La migración 061 añade dos funciones privadas, sin tablas ni incorporación de
contactos. Solo `service_role` puede ejecutarlas; `/api/admin/crm` comprueba al
administrador confirmado, origen de la mutación, límites de peticiones y estado
previo de la política. No entrega direcciones ni cuerpos. Una migración ausente
devuelve 503 explícito; nunca se sustituye por datos de demostración.

El informe deduplica fuente/recibo e ID de proveedor. Aceptación, entrega
confirmada, clic, rebote, queja y revisión se mantienen separados. Una apertura
no cuenta como entrega. La declaración histórica del titular tiene contador
propio y no se presenta como acción de usuario registrada.

Los pedidos con sesión `cs_live_` registrada alimentan cobrado, reembolsado y
neto de reembolsos; incluyen IVA y envío, no son margen. Las facturas completadas
se deduplican por `invoice_id` y se muestran aparte: falta conciliar su modo
histórico y sus devoluciones antes de incluirlas en un neto de suscripciones.
GA4 conserva su informe de 30 días completos, UTMs reconocidas y límites de
privacidad. No se asignan ventas a emails por coincidencia de dirección o fecha.
Recuperación causal, costes, margen y LTV proyectado permanecen no disponibles.

Las pausas global y por familia son reversibles y auditadas en la misma
transacción. Se rechaza una actualización con estado previo desactualizado. Al
retirar la pausa se mantienen los flags y aprobaciones existentes. No se
habilitan campañas, posventa, textos o cohortes desde este control.

Las alertas de 24 h señalan quejas, rebotes y revisión. La alerta de baja entrega
exige al menos 20 aceptaciones y advierte que faltan recibos o puede existir
retraso; no diagnostica una caída real sin evidencia. No se pausa de forma
automática por ausencia de un evento de entrega.

Hay seis experimentos propuestos sin asignación ni envío. El control de tiempos
se conserva. El plan inicial de 4.000 entregas por brazo aproxima una prueba
del 2 % al 3 %, alfa 5 % y potencia 80 %; requiere recalcular con tasa real antes
de empezar y no sirve para declarar resultados con 49 contactos. Las métricas
económicas propuestas exigen asignación y conciliación futura; la atribución
individual entre clic y pedido sigue pendiente y no se inventa en el informe.

## Evidencia local

- `scripts/verify-crm-performance-db.mjs`: agregado real sobre PostgreSQL 17
  temporal, exclusión de Test, deduplicación de factura, reembolsos, nulos de
  atribución/margen, permisos SQL y conflicto de pausa.
- `scripts/verify-crm-admin.mjs`: aplicación Astro compilada, Auth ficticio y
  PostgreSQL temporal real. Comprueba 403 sin administrador y para rol falsificado,
  CSRF, respuesta sin PII, 409 concurrente y 503 de migración ausente.
- `scripts/verify-crm-admin-visual.py`: Chrome efímero, 1440 y 390 px, sin red
  externa. El botón cambia la política mediante API y SQL, vuelve a leerla y
  actualiza la interfaz. Sin errores de página ni desbordamiento del documento.

Las herramientas exigen localhost y la base marcada `crm_fixture`. No cargan
`.env.local`. Las capturas y los números del fixture no acreditan producción.
La publicación de 060–061 requiere la autorización solicitada al titular.
