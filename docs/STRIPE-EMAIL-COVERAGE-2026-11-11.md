# Cobertura de correo de Stripe y catálogo de clientes

El catálogo `src/lib/customer-mail-catalog.ts` reúne los seis mensajes existentes de `src/lib/emails.ts`: bienvenida PIQUERO, bienvenida de suscripción de pago, descuento de camiseta, fallo de pago de suscripción, cancelación de suscripción y compra antigua. Conserva exactamente sus asuntos, textos, HTML de contenido, remitentes, destinatarios y parámetros. Reutiliza `prepareCorporateEmail`; la key del descuento continúa en su emisor. Diez fixtures sintéticas capturadas antes del cambio comprueban esa conservación sin acceder a servicios ni secretos.

`safeSendWebhookEmail` reconoce tanto excepciones como respuestas SDK con `error` o sin id aceptado. Registra el fallo y devuelve `false`; conserva el reconocimiento del webhook y sus reglas actuales. Este cambio no crea una outbox de suscripciones ni introduce reintentos o nuevos tipos de correo. Comercio mantiene su outbox, payload cifrado, keys y reglas de elegibilidad existentes.

## Avisos que todavía no sustituimos

| Aviso de Stripe | Cobertura propia actual | Decisión antes de desactivar el externo |
|---|---|---|
| Recibo de compra correcta | Confirmación de pedido propia, pero sin enlace a recibo incorporado | Integrar un recibo existente y verificar su entrega |
| Recibo de renovación de suscripción | No hay correo propio específico de renovación cobrada | Mantener el externo hasta implementar y verificar un evento único por factura |
| Factura finalizada, instrucciones de pago y recordatorios de factura pendiente | No cubierto | Mantener; el catálogo no genera ni envía facturas |
| Reembolso y nota de crédito | Se registra el reembolso comercial; no hay aviso propio de reembolso ni nota de crédito | Mantener; no confundir actualizar estado con entregar el comprobante |
| Fallo de pago de suscripción | Existe aviso genérico propio | Falta gestión equivalente de recordatorios, enlace de recuperación y entrega durable antes de sustituir el externo |
| Pago que exige autenticación adicional / 3D Secure | No cubierto por correo propio | Mantener |
| Tarjeta próxima a caducar | No cubierto | Mantener |
| Fin de prueba o próxima renovación | No cubierto | Mantener |
| Cancelación programada / cancelación efectiva | Propio solo al recibir `customer.subscription.deleted`; programarla sincroniza estado | Revisar ambos momentos antes de sustituir notificaciones externas |

La tabla describe código; no afirma que esos ajustes estén habilitados en la cuenta real. No se han consultado ni cambiado ajustes externos de Stripe.

## Documentos de Stripe

Los recibos y las facturas existentes siguen disponibles en Stripe. La centralización utiliza los seis mensajes propios del catálogo. La cobertura de avisos nativos se indica en la tabla anterior.

Fuentes primarias consultadas:

- [Recibos y facturas pagadas](https://docs.stripe.com/receipts): enlaces de recibo, envío automático y `receipt_email`.
- [Objeto Invoice](https://docs.stripe.com/api/invoices/object): `hosted_invoice_url` e `invoice_pdf`.
- [Correos de facturación](https://docs.stripe.com/invoicing/send-email): categorías de avisos externos.
- [Recuperación de pagos y recordatorios](https://docs.stripe.com/billing/revenue-recovery/customer-emails): autenticación, fallos, tarjeta, pruebas y renovaciones.

No se han ejecutado cobros, cancelaciones, reembolsos, envíos reales ni cambios de configuración de proveedores.
