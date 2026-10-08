import test from "node:test";
import assert from "node:assert/strict";
import { ownsShirtDiscount, shirtCheckoutLines } from "../src/lib/shirt-checkout-lines";
import { SHIRT_FINAL_PRICE_CENTS, SHIRT_PRODUCT_PRICE_CENTS, SHIRT_SHIPPING_PRICE_CENTS } from "../src/config/commerce";
test("checkout separates shirt and shipping without changing the undiscounted total",()=>{
  const lines=shirtCheckoutLines("shirt_price","vat",[{quantity:2},{quantity:1}]);
  assert.equal(lines.length,3);
  assert.equal(lines[2].quantity,3);
  assert.equal(lines[2].price_data?.unit_amount,300);
  assert.equal(lines[2].price_data?.tax_behavior,"inclusive");
  assert.equal(SHIRT_FINAL_PRICE_CENTS,2999);
  assert.equal(SHIRT_PRODUCT_PRICE_CENTS+SHIRT_SHIPPING_PRICE_CENTS,2999);
  assert.throws(()=>shirtCheckoutLines("p","t",[{quantity:0}]));
});
test("knowing a subscriber email alone does not authorize their discount",()=>{
  const verified={email:"a@example.com",email_confirmed_at:"2026-10-08"};
  assert.equal(ownsShirtDiscount(verified," A@example.com ","a@example.com"),true);
  assert.equal(ownsShirtDiscount(null,"a@example.com","a@example.com"),false);
  assert.equal(ownsShirtDiscount({email:"a@example.com"},"a@example.com","a@example.com"),false);
  assert.equal(ownsShirtDiscount(verified,"b@example.com","a@example.com"),false);
  assert.equal(ownsShirtDiscount(verified,"a@example.com","b@example.com"),false);
});
