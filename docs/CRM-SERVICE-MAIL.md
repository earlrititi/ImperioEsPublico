# Atención individual y comunicaciones comerciales

El redactor administrativo permite elegir expresamente atención al cliente o
comunicación comercial. La finalidad forma parte de la vista previa firmada y
del trabajo inmutable. Una campaña siempre es comercial; cambiar la finalidad
de un trabajo ya aprobado devuelve conflicto.

Una respuesta individual de servicio no exige permiso promocional ni consume
su turno. Una baja comercial no impide responder a una consulta del cliente.
Los bloqueos de entrega permanentes sí envían el trabajo a revisión. Las
comunicaciones comerciales siguen pasando por el coordinador y la baja real.

Este ajuste amplía la 060 todavía pendiente, separa los informes comerciales de
las respuestas de servicio y conserva el transporte, la plantilla corporativa,
la clave idempotente y los límites de reintento del redactor.

Verificación: restricciones SQL de finalidad, exclusión de historial comercial,
conflicto al cambiar un trabajo aprobado y worker compilado con proveedor
ficticio. Una respuesta solicitada supera una baja comercial; un rebote
permanente no provoca un nuevo envío. Sin servicios ni destinatarios reales.
