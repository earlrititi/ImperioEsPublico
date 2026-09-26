import assert from "node:assert/strict";
import { Socket } from "node:net";

Socket.prototype.connect = () => { throw new Error("Network disabled in shirt catalogue checks"); };
globalThis.fetch = async () => { throw new Error("Unexpected network request in shirt catalogue checks"); };
const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
let cases = 0;

async function page(path) {
  const response = await app.fetch(new Request(`https://imperioes.com${path}`));
  assert.equal(response.status, 200, path);
  cases++;
  return response.text();
}

const storefront = await page("/tienda");
assert.match(storefront, /<form[^>]*action="\/reservas"[^>]*method="get"/);
assert.match(storefront, /<select[^>]*name="size"/);
for (const size of ["S", "M", "L", "XL", "XXL"]) {
  assert.match(storefront, new RegExp(`<option[^>]*value="${size}"`));
}
assert.match(storefront, /<option[^>]*value="M"[^>]*selected/);
assert.match(storefront, /IVA incluido/);
assert.match(storefront, /RESERVAR \u2014 0 \u20ac/);

for (const size of ["S", "M", "L", "XL", "XXL"]) {
  const html = await page(`/checkout/camiseta-imperial?size=${size}`);
  assert.match(html, new RegExp(`Talla elegida<\/dt>\\s*<dd[^>]*>${size}<\/dd>`));
  assert.match(html, /26,99/);
  assert.match(html, /3 [\s\S]{0,12} de env/);
  assert.match(html, /29,99/);
  assert.match(html, /100 % poliester/);
  assert.doesNotMatch(html, /Valento BRICKPLUS/);
  assert.match(html, /CAVABRI/);
  assert.match(html, /href="tel:\+34976595758"/);
  assert.match(html, /Costuras planas en hombros y axilas/);
  assert.match(html, /sublimacion, serigrafia, transfer, vinilo, bordado, cosido/);
  assert.match(html, /info@valento.eu/);
  assert.match(html, /No planchar/);
  assert.match(html, /Envase de transporte<\/dt>\s*<dd[^>]*>Sobre de envio/);
  assert.match(html, /Proveedor del envase de transporte<\/dt>\s*<dd[^>]*>Correos/);
  assert.doesNotMatch(html, /PACKAGING_COMPLIANCE_EXTERNAL_REVIEW_REQUIRED/);
  assert.doesNotMatch(html, /advertencias? de seguridad|INFORMACION E INSTRUCCIONES DE SEGURIDAD/i);
  assert.match(html, /LEGAL_PRODUCT_DATA_INCOMPLETE/);
  assert.doesNotMatch(html, /<form[^>]*data-checkout-contract/);
}
for (const query of ["", "?size=NOT-A-SIZE"]) {
  const html = await page(`/checkout/camiseta-imperial${query}`);
  assert.match(html, /Sin seleccionar/);
}
const shipping = await page("/legal/devoluciones");
assert.match(shipping, /Correos/);
assert.match(shipping, /Peninsula espanola/);
assert.match(shipping, /Baleares, Canarias, Ceuta, Melilla/);
assert.match(shipping, /maxima de 48 horas/);
assert.match(shipping, /maxima de 7 dias laborables/);
console.log(`${cases} compiled shirt catalogue scenarios passed. No network or payments.`);
