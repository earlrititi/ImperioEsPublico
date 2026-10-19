import test from "node:test";
import assert from "node:assert/strict";
import { validCart, changeCart } from "../src/lib/cart";
import { ecommercePayload } from "../src/lib/ecommerce";

test("cart contains only unique known sizes and safe positive quantities", () => {
  for (const input of [null, {}, [{ size: "S", quantity: 0 }], [{ size: "3XL", quantity: 1 }], [{ size: "M", quantity: 1, email: "private@example.invalid" }], [{ size: "M", quantity: 1 }, { size: "M", quantity: 2 }]]) assert.equal(validCart(input), false);
  assert.equal(validCart([{ size: "XXL", quantity: 3 }]), true);
  assert.deepEqual(changeCart([{ size: "M", quantity: 2 }], "S", 3), [{ size: "S", quantity: 3 }, { size: "M", quantity: 2 }]);
  assert.deepEqual(changeCart([{ size: "M", quantity: 2 }], "M", 0), []);
  assert.throws(() => changeCart([], "M", 1.5));
});
test("ecommerce uses correct merchandise value, no shipping or invented purchases", () => {
  const payload = ecommercePayload("add_to_cart", [{ size: "M", quantity: 3 }])!;
  assert.equal(payload.currency, "EUR"); assert.equal(payload.value, 80.97);
  assert.equal(payload.items[0].price, 26.99); assert.equal(payload.items[0].quantity, 3);
  assert.equal(ecommercePayload("purchase" as never, [{ size: "M", quantity: 1 }]), null);
  assert.equal(ecommercePayload("view_cart", []), null);
  assert.doesNotMatch(JSON.stringify(payload), /email|address|phone|token|customer/);
});
