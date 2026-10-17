# Avisos de pedidos pagados

Incidente del 17 de octubre de 2026: seis pagos reales de camisetas estaban
conciliados con pedidos, stock y confirmaciones al comprador, pero no existia
un aviso administrativo para ORDER_PAID. Los avisos anteriores cubrian solo
reservas y lista de espera. No fue un fallo del cobro de Stripe.

## Correccion

- Cola administrativa independiente, un registro por pedido, creada en la misma
  transaccion que el pedido. El backfill no toca la cola de los compradores.
- Nombre, correo, direccion definitiva, tallas, cantidades, total y fecha real
  del pago desde el pedido confirmado, no desde datos antiguos de la reserva.
- Destinatario Live fijo: earlrititi@gmail.com. Test redirige al sink de Resend.
- Snapshot cifrado, lease atomica y clave idempotente estable por pedido.
  Los reintentos ambiguos de mas de 23 horas requieren revision manual.
- Webhook y mantenimiento despachan la cola. El scheduler existente se conserva
  e incluye avisos pendientes y comprobaciones de entrega.
- Cada aviso aceptado queda en el historial del dashboard; la entrega se consulta
  al proveedor y los avisos pendientes o fallidos generan una advertencia.

## Evidencia

- Seis pagos Live, seis pedidos y seis camisetas: 179,94 EUR brutos. Los seis
  correos anteriores de ORDER_PAID tenian como destinatarios a sus compradores.
- Migracion 033 probada en Supabase Test: RLS, permisos, trigger, leases,
  idempotencia, recibo administrativo y revision de intentos antiguos. Rollback
  de fixtures; migracion de esquema conservada.
- Un aviso Test entregado por Resend al destinatario sintetico, sin duplicado.
- Recuperacion Live: seis avisos aceptados y entregados a earlrititi@gmail.com;
  los seis aparecen en INBOX de Gmail. Ningun comprador recibio otro correo.
- No se crean cargos, pedidos ni ajustes de stock en la recuperacion.

Datos personales y recibos detallados se conservan solo en los informes locales
ignorados por Git bajo tmp/paid-order-alerts; no se incluyen en este documento.

## Publicacion

Hotfix aislado de los cambios de home, consentimiento, GA4 y automatizaciones
comerciales aun no publicados. La migracion 033 es aditiva y no depende de
las migraciones 030-032 de esas fases. No activar marketing con este despliegue.

Verificar READY en preview y produccion, HTTP publico, bundle servido, endpoint
de mantenimiento autenticado y ausencia de errores antes de cerrar el incidente.

Referencia: [idempotencia de Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).
