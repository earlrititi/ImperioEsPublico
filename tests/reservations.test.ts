import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { formatMoney, SHIRT_FINAL_PRICE_CENTS } from "../src/config/commerce";
import {
  isMainlandAddress,
  parseReservationInput,
} from "../src/lib/reservation-validation";
const address = {
  name: "Cliente Prueba",
  line1: "Calle de pruebas 12",
  line2: "",
  postalCode: "28001",
  city: "Madrid",
  province: "28",
  country: "ES",
};
const input = () => ({
  requestId: randomUUID(),
  customer: {
    name: "Cliente Prueba",
    email: "test@example.invalid",
    phone: "+34 600000000",
  },
  address,
  items: [{ sku: "IE-CAMISETA-IMPERIAL-M", quantity: 2 }],
  accepted: true,
});
test("Final price includes tax and delivery for every quantity", () => {
  for (const [q, cents] of [
    [1, 2999],
    [2, 5998],
    [3, 8997],
    [5, 14995],
    [10, 29990],
  ])
    assert.equal(q * SHIRT_FINAL_PRICE_CENTS, cents);
  assert.match(formatMoney(14995), /149,95/);
});
test("Mainland requires country, province and postcode agreement", () => {
  for (const [province, postalCode] of [
    ["28", "28001"],
    ["11", "11005"],
    ["08", "08001"],
    ["41", "41001"],
  ])
    assert.ok(isMainlandAddress({ ...address, province, postalCode }));
  for (const [province, postalCode] of [
    ["07", "07001"],
    ["35", "35001"],
    ["38", "38001"],
    ["51", "51001"],
    ["52", "52001"],
    ["28", "11005"],
    ["99", "99001"],
    ["28", "28000"],
  ])
    assert.equal(
      isMainlandAddress({ ...address, province, postalCode }),
      false,
    );
  assert.equal(isMainlandAddress({ ...address, country: "PT" }), false);
});
test("Reservation parser ignores forged amounts and strips unneeded customer data", () => {
  const parsed = parseReservationInput({
    ...input(),
    total: 1,
    shippingCost: 900,
    price: 1,
    customer: { ...input().customer, card: "should not be retained" },
  });
  assert.equal(parsed.items[0].quantity, 2);
  assert.equal("total" in parsed, false);
  assert.equal("card" in parsed.customer, false);
  assert.equal("phone" in parsed.customer, false);
  assert.deepEqual(parsed.address, address);
});
test("Reservation parser rejects invalid quantities, duplicate SKUs, malformed data and missing terms", () => {
  for (const quantity of [-1, 0, 1.1, "2", Infinity, NaN, 2147483647])
    assert.throws(() =>
      parseReservationInput({
        ...input(),
        items: [{ sku: "IE-CAMISETA-IMPERIAL-M", quantity }],
      }),
    );
  assert.throws(() =>
    parseReservationInput({
      ...input(),
      items: [...input().items, ...input().items],
    }),
  );
  assert.throws(() => parseReservationInput({ ...input(), accepted: false }));
  assert.throws(() => parseReservationInput({ ...input(), address: undefined }), /INVALID_ADDRESS/);
  assert.throws(() =>
    parseReservationInput({
      ...input(),
      items: [{ sku: "__proto__", quantity: 1 }],
    }),
  );
});

test("Pre-reservation needs an address but no phone or marketing consent", () => {
  const b = { ...input(), customer: { name: "Cliente Prueba", email: " TEST@Example.com " } };
  assert.equal(parseReservationInput(b).customer.email, "test@example.com");
  assert.equal(parseReservationInput(b).marketing, false);
  assert.equal(parseReservationInput({ ...b, marketing: true }).marketing, true);
  assert.throws(() => parseReservationInput({ ...b, marketing: "true" }));
});

test("Address is validated and stripped of unrelated fields; waitlist needs none", () => {
  assert.throws(() => parseReservationInput({ ...input(), address: { ...address, postalCode: "11005" } }), /INVALID_ADDRESS/);
  assert.deepEqual(parseReservationInput({ ...input(), address: { ...address, extra: "unused" } }).address, address);
  assert.equal(parseReservationInput({ ...input(), waitlist: true, address: undefined }).address, null);
});

test("Reservation maximum is configurable and applies to all lines combined", () => {
  const items = [{ sku: "IE-CAMISETA-IMPERIAL-M", quantity: 2 }, { sku: "IE-CAMISETA-IMPERIAL-S", quantity: 1 }];
  assert.throws(() => parseReservationInput({ ...input(), items }), /MAX_RESERVATION_QUANTITY/);
  assert.equal(parseReservationInput({ ...input(), items }, 3).items.length, 2);
  assert.throws(() => parseReservationInput(input(), 0), /INVALID_CONFIGURATION/);
});
