# Recuperación de carritos y pagos — 21 de noviembre de 2026

## Alcance

Revisar el bloqueo de aprobación de plantillas observado el 16 de noviembre,
preparar una reparación acotada y comprobar elegibilidad, compras anteriores,
bajas, caducidad y repetición de trabajos. No activar envíos, modificar producción,
publicar ni cambiar las preferencias comerciales durante esta preparación.

Base: `a0b20d237efe660e1b96e43cbcac0ba6880de967`. El checkout original y la rama CRM
del 16 de noviembre conservan sus cambios pendientes. El trabajo se realiza en
un checkout separado.

## Lectura actual y reparación

- La protección actual exige una aprobación válida, un pedido pagado de prueba,
  un inicio de incorporación y coincidencia exacta de las definiciones aprobadas.
- La lectura protegida del 21 de noviembre, 11:01 UTC, confirma que continúa la
  diferencia entre el digest aprobado `e30443cd…` y los defaults `0a8a7975…`.
  No existen borradores guardados. Hay tres sujetos incorporados y ninguna
  recuperación potencialmente debida, incluso antes de descontar el historial.
- El nuevo valor `MARKETING_AUTOMATION_SCOPE=recovery` limita la planificación y
  el envío a checkout y carrito. No ejecuta bienvenida central, bienvenida de
  cuenta ni seguimiento editorial. El valor ausente conserva el comportamiento
  anterior; cualquier valor desconocido bloquea la ejecución.
- El modo recovery necesita su propio digest de definiciones. Una aprobación
  global antigua no lo activa. El digest revisado de checkout/carrito es
  `ed8b5018b362201606e937355c81cfea504a575e6e3730dc115966f54d7e6be4`.
- Solo cuentan carritos y checkouts iniciados desde `runtime.approved_at`.
  Se conserva `enrollment_starts_at`: las identidades ya incorporadas podrán
  tener actividad nueva. Los trabajos antiguos y las familias fuera de alcance
  se suprimen al reclamarlos, sin convertirlos en mensajes nuevos.
- Se vuelve a leer la aprobación inmediatamente antes del transporte. Un cambio
  de su fecha, aunque conserve el mismo digest, cancela el envío en curso.
- Se mantienen los filtros existentes de consentimiento, analítica vigente,
  compra y pago en curso, bajas, caducidad, prioridad, límite de frecuencia,
  clave idempotente y snapshot inmutable del proveedor.

## Evidencia y límites

- 19 pruebas unitarias afectadas correctas.
- `astro check`: cero errores, cero warnings, ocho hints preexistentes.
- Compilación de producción y postbuild correctos.
- Fixtures sobre el worker compilado comprueban las exclusiones, reintentos,
  deduplicación, baja antes del envío, aprobación específica y corte de actividad.
  Los transportes y datos son ficticios, con la red externa bloqueada.
- La consulta actual está en `tmp/recovery-repair/current.private.json`; los
  textos completos y el digest revisado en `tmp/recovery-repair/recovery-review.json`.
  No contienen direcciones, nombres ni identificadores de los sujetos.
- No se han aprobado hashes, alterado flags, enviado mensajes, publicado código
  ni cambiado registros de producción durante este trabajo.

## Secuencia de aplicación tras revisar los textos

1. Publicar el código exacto con `MARKETING_AUTOMATION_SCOPE=recovery`. La
   aprobación antigua no coincide y conserva el bloqueo hasta el siguiente paso.
2. Renovar la lectura y comprobar que borradores, digest, fecha de aprobación,
   corte de incorporación y pedido pagado de referencia siguen coincidiendo.
3. Aplicar `RECOVERY-APPROVAL-2026-11-21.sql` solo tras esa revisión. El bloque
   transaccional compara el estado anterior y falla si ha cambiado. Mantiene el
   titular aprobador y el corte de incorporación; actualiza la aprobación y
   el digest de solo dos familias, y reinicia únicamente el cursor.
4. Verificar el estado y la ejecución del programador mediante lecturas. Al no
   existir recuperaciones actuales debidas y exigir actividad posterior a la
   aprobación, no se necesita replay ni envío de prueba a un cliente.
5. Una aceptación del proveedor acredita aceptación, no entrega ni venta. La
   entrega se confirma por su recibo y cualquier conversión se concilia con
   Stripe antes de atribuir un resultado.
