import assert from "node:assert/strict";
import test from "node:test";
import { h } from "preact";
import render from "preact-render-to-string";
import { OWNER_ORDINARY_SHIPMENT_ACTION, ordinaryShipmentDeclarations } from "../src/lib/owner-shipment-declaration";
import { OwnerShipmentDeclaration } from "../src/components/commerce/CommerceAdmin";

const declaration = { declaredOn: "2026-11-21" as const, recordedAt: "2026-11-21T11:07:58Z" };
test("ordinary shipment notes stay scoped and disclose no audit payload or actor", () => {
  const rows = [
    { entity_id: "order-1", action: OWNER_ORDINARY_SHIPMENT_ACTION, created_at: declaration.recordedAt },
    { entity_id: "order-1", action: OWNER_ORDINARY_SHIPMENT_ACTION, created_at: "2026-11-21T10:00:00Z" },
    { entity_id: "outside-page", action: OWNER_ORDINARY_SHIPMENT_ACTION, created_at: declaration.recordedAt },
    { entity_id: "order-2", action: "SHIPPED", created_at: declaration.recordedAt },
    { entity_id: "order-3", action: OWNER_ORDINARY_SHIPMENT_ACTION, created_at: "unknown" },
  ];
  const result = ordinaryShipmentDeclarations(rows, ["order-1", "order-2", "order-3"]);
  assert.equal(result.size, 1);
  assert.deepEqual(result.get("order-1"), { declaredOn: "2026-11-21", recordedAt: "2026-11-21T11:07:58.000Z" });
});

test("declared dispatch invents neither a dispatch date nor delivery", () => {
  const html = render(h(OwnerShipmentDeclaration, { order: { ownerShipmentDeclaration: declaration } }));
  assert.match(html, /Enviado según titular.*Correos ordinario.*sin seguimiento/);
  assert.match(html, /Fecha efectiva de despacho desconocida/);
  assert.match(html, /Recepción sin acreditar/);
  assert.match(html, /no acredita la recepción/);
  assert.doesNotMatch(html, /11:07|confirmed|DELIVERED/);
});

test("receipt and carrier evidence remain distinct from the owner statement", () => {
  const delivered = render(h(OwnerShipmentDeclaration, { order: { ownerShipmentDeclaration: declaration, carrier_delivered_at: declaration.recordedAt } }));
  assert.match(delivered, /Entrega acreditada; recepción del cliente sin confirmar/);
  assert.doesNotMatch(delivered, /Recepción confirmada por el cliente/);
  const received = render(h(OwnerShipmentDeclaration, { order: { ownerShipmentDeclaration: declaration, customer_received_at: declaration.recordedAt } }));
  assert.match(received, /Recepción confirmada por el cliente/);
  assert.doesNotMatch(received, /Recepción sin acreditar/);
  assert.equal(render(h(OwnerShipmentDeclaration, { order: {} })), "");
});
