import test from "node:test";
import assert from "node:assert/strict";
import { accountAudience, filterAudience } from "../src/lib/newsletter-audience";

test("registered buyers and older accounts enter the account segment only through current canonical eligibility", () => {
  const profiles = [
    { id: "buyer", email: " Buyer@example.invalid " },
    { id: "older", email: "older@example.invalid" },
    { id: "cookie-only", email: "cookies@example.invalid" },
    { id: "withdrawn", email: "withdrawn@example.invalid" },
    { id: "unverified", email: "unverified@example.invalid" },
  ];
  const eligible = [
    { user_id: "buyer", email: "buyer@example.invalid" },
    { user_id: "older", email: "older@example.invalid" },
    { user_id: null, email: "contact@example.invalid" },
    { user_id: null, email: "unverified@example.invalid" },
    { user_id: "buyer", email: "wrong-owner@example.invalid" },
  ];
  assert.deepEqual(accountAudience(profiles, eligible), ["buyer@example.invalid", "older@example.invalid"]);
  assert.deepEqual(filterAudience(accountAudience(profiles, eligible), new Set(["older@example.invalid"])).recipients, ["buyer@example.invalid"]);
});
