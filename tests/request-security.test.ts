import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedRequestOrigin } from "../src/lib/request-security";

test("request origin accepts the runtime and configured canonical origins", () => {
  const local = new Request("http://localhost:4321/api/test", {
    headers: { origin: "http://localhost:4321" },
  });
  const canonical = new Request("https://preview.example/api/test", {
    headers: { origin: "https://imperioes.com" },
  });

  assert.equal(isAllowedRequestOrigin(local, "https://imperioes.com/"), true);
  assert.equal(isAllowedRequestOrigin(canonical, "https://imperioes.com"), true);
});

test("request origin rejects unrelated websites", () => {
  const request = new Request("https://imperioes.com/api/test", {
    headers: { origin: "https://attacker.example" },
  });

  assert.equal(isAllowedRequestOrigin(request, "https://imperioes.com"), false);
});
