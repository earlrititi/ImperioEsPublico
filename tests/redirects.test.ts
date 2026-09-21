import assert from "node:assert/strict";
import test from "node:test";
import { safeInternalPath } from "../src/lib/redirects";

test("safeInternalPath accepts local paths with query and hash", () => {
  assert.equal(
    safeInternalPath("/cuenta?tab=facturacion#estado", "/"),
    "/cuenta?tab=facturacion#estado"
  );
});

test("safeInternalPath rejects protocol-relative and external URLs", () => {
  assert.equal(safeInternalPath("//example.com", "/cuenta"), "/cuenta");
  assert.equal(safeInternalPath("https://example.com", "/cuenta"), "/cuenta");
  assert.equal(safeInternalPath("javascript:alert(1)", "/cuenta"), "/cuenta");
});
