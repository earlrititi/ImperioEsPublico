# Camiseta Imperial: datos confirmados

Actualizacion comercial 2026-09-10: reserva anticipada sin pago, precio final
2999 centimos por unidad con IVA y envio estandar peninsular incluidos.
La politica anterior de 2699 + 300 queda sustituida. Estado tecnico y pruebas:
[RESERVATION-MODE.md](./RESERVATION-MODE.md).

Datos incorporados a la configuracion local el 2026-09-09. No abre ventas,
no modifica Stripe ni Supabase y no publica el sitio.

## Precio y envio

Confirmacion directa del propietario:

- Camiseta: 29,99 EUR finales por unidad, IVA y envio peninsular incluidos.
- Envio: 0 EUR adicionales al cliente; Correos, gestionado por Imperio Espanol.
- Total para una camiseta con envio: 29,99 EUR.
- Destino: Peninsula espanola. No Baleares, Canarias, Ceuta, Melilla ni otros paises.
- Preparacion: maximo 48 horas. Entrega: maximo 7 dias laborables.
- No se ha supuesto que las 48 horas sean laborables ni sumado ambos plazos
  para anunciar una fecha distinta de la indicada por el propietario.
- El propietario confirmo posteriormente IVA del 21 % incluido tambien para
  las suscripciones mensuales y anuales; vease `STRIPE-MINIMIZATION-AUDIT.md`.
  El desglose fiscal del transporte y la configuracion efectiva de Stripe
  se revisaran al implementar el pago del producto.

## Prenda base

Fuente: `ficha tecnica valento.pdf`, dos paginas, revisadas visualmente.

- Modelo: Valento BRICKPLUS, camiseta tecnica de manga corta para adulto.
- Marca: VALENTO. Referencia del fabricante: CAVABRI, confirmada por el
  propietario; distinta del SKU interno `IE-CAMISETA-IMPERIAL`.
- Composicion: 100 % poliester. Densidad: 145 g/m2.
- Tejido transpirable Bird-Eye, secado rapido.
- Caracteristicas ampliadas aportadas por el propietario: cuello redondo,
  diseno bicolor, evacuacion del sudor y costuras planas en hombros y axilas.
- Prenda base apta para sublimacion, serigrafia, transfer, vinilo, bordado y
  cosido. No identifica la tecnica aplicada al estampado final de Imperio E.
- Simbolos de cuidado de la pagina 1: lavado hasta 30 grados, no lejia,
  no planchar, no limpieza en seco, no secadora.
- Medidas aproximadas en centimetros, no medidas de contorno corporal:

| Talla | Largo | Ancho | Stock restante |
| --- | ---: | ---: | ---: |
| S | 66 | 50 | 3 |
| M | 69 | 53 | 15 |
| L | 72 | 56 | 16 |
| XL | 75 | 59 | 8 |
| XXL | 78 | 62 | 3 |
| Total | | | 45 |

Contacto de la prenda base verificado en la [pagina oficial de Valento](https://valento.es/productos/camisetas-tecnicas/camiseta-tecnica-BRICKPLUS):
Valento Textile S.L., Poligono PLAZA, calle Burtina 12, 50197 Zaragoza, Espana;
`info@valento.eu`. La ficha no acredita por si sola el etiquetado ni las
responsabilidades sobre la camiseta estampada final.

Telefono aportado por el propietario: +34 976 595 758. El propietario
reconfirma razon social, direccion, email, composicion, medidas y stock de la
tabla anterior. Esta actualizacion no modifica existencias en Supabase.

## Existencias

Fuente: `tabla_simple_ventas_camisetas.xlsx`, hoja `Ventas camisetas`, A6:D10.
Se comprobo `stock restante = stock inicial - vendidas` en las cinco filas
y el total D12 (45). La columna de vendidas contiene ceros.

La celda B3 contiene 29,99 EUR. La instruccion comercial posterior del propietario
define ese importe como precio final unitario, con envio incluido tambien en
reservas de varias unidades. No se han modificado los documentos originales.

Las existencias de `src/config/products.ts` son la instantanea inicial para
sembrar el inventario. La disponibilidad operativa de reservas se calcula en
Supabase por variante: fisico - reservado - vendido. Las funciones nuevas se
han aplicado solo en ImperioE Test. SKU interno: `IE-CAMISETA-IMPERIAL`, con
sufijo por talla; no es la referencia del fabricante `CAVABRI`.

## Aplicacion

- Configuracion central: modelo, material, cuidados, contacto, precios,
  transporte, tallas, medidas y existencias.
- Tienda: cinco tallas, resumen fiscal y de envio; el formulario GET conserva
  la talla elegida hasta la pagina contractual sin crear una compra.
- Checkout: precio, gastos, total, datos de la prenda base y tabla de medidas.
- Envios/devoluciones: condiciones de envio confirmadas; version 2026-09-09.
- Se mantienen los bloqueos del producto y de nuevos cobros Live.

## Pendientes

Verificacion local: `npm run verify` pasa (0 errores/advertencias/hints,
24 tests y build correcto); `npm run test:integration` pasa con 35 escenarios
editoriales, 37 de comercio y 9 de catalogo de camiseta. HTTP local de
`/checkout/camiseta-imperial?size=XXL`: 200, talla y total correctos.
No habia navegador conectado para verificar visualmente las vistas.

- Confirmar etiquetado e instrucciones de seguridad que correspondan al
  producto estampado final y cerrar la revision de envases.
- Implementar y probar pago de producto, inventario y validacion de destinos
  peninsulares en servidor; mostrar solo texto no aplica una restriccion a Stripe.
- Confirmar condiciones de transporte para pedidos de varias unidades antes
  de habilitar cantidades superiores a una.
- Verificar la configuracion fiscal efectiva en Stripe Test, hacer QA visual,
  publicar solo tras validacion y autorizacion, y probar un pedido real
  controlado antes de declarar apertura comercial.
