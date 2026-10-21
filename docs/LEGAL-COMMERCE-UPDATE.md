# Actualizacion legal y comercial - 21 de octubre de 2026

## Implementado

- Titular: Adrian Lopez Oliva. NIF: 44067163Z.
- Domicilio declarado: C/ Sobre los Angeles, n. 9, 3 D,
  11160 Barbate (Cadiz), Espana. No se afirma un registro administrativo verificado.
- Devoluciones: Adrian Lopez Oliva - Imperio Espanol, en ese mismo domicilio.
- La configuracion central se usa en documentos legales, vendedor del checkout,
  correos transaccionales y comerciales y formulario de desistimiento.
- El componente legal compartido identifica al prestador y no muestra etiquetas
  de version. Los identificadores internos de consentimiento se conservan.
- Producto: 2699 centimos, IVA del 21 % incluido. Envio: 300 centimos por unidad,
  exclusivamente a Peninsula. Total de una camiseta: 2999 centimos.
- El carrito muestra subtotal de producto e informa de la tarifa. La direccion
  se introduce antes del resumen final. Stripe muestra camisetas, envio, descuento,
  impuestos incluidos y total antes de confirmar el pago.
- Disponibilidad publica booleana por talla. No se devuelve el stock exacto ni
  los totales internos de la campana. Se mantienen el carrito y su contador de
  unidades elegidas por el comprador, que no es un contador de existencias.
- Los correos y el resumen del pedido usan el total realmente cobrado y muestran
  el descuento sin aplicarlo al envio. El administrador dispone del desglose.

## Compatibilidad de pedidos e inventario

La migracion `039_order_price_breakdown.sql` agrega `product_subtotal` y
`shipping_amount` a los pedidos nuevos mediante un trigger de insercion.
No actualiza pedidos existentes. Sus valores historicos quedan intactos.

Los campos anteriores `subtotal`, `unit_price`, `shipping_charged` y las reservas
conservan su significado historico: la instantanea incluye camiseta y envio.
No deben interpretarse como el precio exclusivo del producto. Los nuevos campos
son el desglose explicito, antes del descuento en el producto. Si son NULL en un
pedido historico, la interfaz mantiene el calculo compatible con su tarifa original.

Se conserva `complete_shirt_payment`, incluidos la idempotencia, los importes
esperados, la transaccion de inventario y la validacion de descuentos.
`p_shipping=0` es el campo de tarifa de envio de Stripe: actualmente el envio se
cobra como otra linea de producto y no mediante `shipping_options`.
La migracion no debe cambiar ese parametro ni sumar de nuevo el porte.

La migracion tambien revoca SELECT publico y de clientes sobre product_variants.
El endpoint publico usa el cliente servidor, proyecta solo disponibilidad y el
inventario exacto permanece tras la autorizacion administrativa.

## Verificado

- 165 pruebas unitarias superadas, incluida confirmacion con descuento real.
- Astro check sin errores; lint general y administrativo superados.
- Build de produccion y comprobaciones sobre el bundle compilado.
- Stripe Test: una y tres camisetas, con descuentos 0 %, 15 % y 20 %.
  Totales de una: 29,99 / 25,94 / 24,59 EUR. Totales de tres:
  89,97 / 77,82 / 73,78 EUR. El envio permanece en 3 / 9 EUR.
  Seis sesiones impagadas, posteriormente expiradas. Cero cargos reales.
- Stripe Live, solo lectura: precio de camiseta 26,99 EUR, tarifas de planes,
  IVA inclusivo 21 %, cuenta y webhook existentes correctos. Sin cambios fiscales.
- Supabase Test: migracion y seis confirmaciones de pedido mediante el RPC real;
  desglose, descuentos, idempotencia, privacidad y pedidos previos verificados.
  Toda la transaccion, incluida la migracion, se revierte al terminar.
- UI de tienda y carrito comprobada con datos sinteticos. Tres camisetas:
  subtotal 80,97 EUR. Anchos 390 / 768 / 1440 sin desbordamiento del carrito.
- Formularios de direccion y precio revisados sin enviar datos ni crear compras.
- Documentos legales compilados: identidad y NIF nuevos, domicilio de Barbate,
  ausencia de datos antiguos y de la etiqueta Version 2026-09-10.

## Publicacion

La migracion 039 ya esta aplicada y registrada en Supabase de produccion
(`pjrqozlyrjgugdraoght`). Se verificaron columnas, trigger y permisos. La
transaccion comparo los pedidos historicos antes y despues sin detectar cambios.
El endpoint publico siguio devolviendo HTTP 200 con ventas habilitadas.
El script `scripts/migrate-order-price-production.mjs` permite repetir la
verificacion sin reaplicar la migracion. Requiere `--apply` para la primera aplicacion.

La publicacion del frontend sigue el flujo Preview y posteriormente produccion.
El estado efectivo del despliegue y las comprobaciones de dominios se comunican
al finalizar la entrega.

Pendiente: verificar dentro de las aplicaciones nativas de Instagram y X. La comprobacion
   responsive en Chrome no equivale a probar sus navegadores integrados reales.
La sesion de control solo dispone de Chrome, sin acceso a un dispositivo movil.

No se han modificado pedidos pagados, direcciones de clientes, identidad fiscal
de Stripe ni datos de registro de servicios externos. No se han enviado correos.

## Archivos

- src/config/legal.ts
- src/components/LegalDocument.astro
- src/pages/legal/devoluciones.astro
- src/components/HomeShirt.astro
- src/pages/tienda/index.astro
- src/pages/instagram.astro
- src/components/TshirtLeadPopup.astro
- src/components/commerce/Cart.tsx
- src/components/commerce/ReservationForm.tsx
- src/components/commerce/ReservationManager.tsx
- src/components/commerce/shared.tsx
- src/components/commerce/StoreStock.astro
- src/components/commerce/CommerceAdmin.tsx
- src/lib/public-inventory.ts
- src/lib/meta-catalog.ts
- src/lib/commerce-mail.ts
- src/lib/admin-mail-template.ts
- supabase/migrations/039_order_price_breakdown.sql
- scripts/verify-order-price-breakdown.mjs
- scripts/migrate-order-price-production.mjs
- scripts/verify-commercial-ux.mjs
- tests/commerce-mail.test.ts
- tests/meta-catalog.test.ts
