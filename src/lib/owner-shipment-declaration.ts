// An owner statement records dispatch, never carrier delivery or customer receipt.
export const OWNER_ORDINARY_SHIPMENT_ACTION =
  "shipment:owner_declared:correos_ordinario:untracked:dispatch_date_unknown:declared_on=2026-11-21";

export type OwnerShipmentDeclaration = { declaredOn: "2026-11-21"; recordedAt: string };
export type ShipmentAuditRow = { entity_id: string; action: string; created_at: string };

export function ordinaryShipmentDeclarations(rows: ShipmentAuditRow[], orderIds: readonly string[]) {
  const scope = new Set(orderIds);
  const declarations = new Map<string, OwnerShipmentDeclaration>();
  for (const row of rows) {
    if (!scope.has(row.entity_id) || row.action !== OWNER_ORDINARY_SHIPMENT_ACTION ||
      !Number.isFinite(Date.parse(row.created_at))) continue;
    const existing = declarations.get(row.entity_id);
    if (!existing || Date.parse(row.created_at) > Date.parse(existing.recordedAt)) {
      declarations.set(row.entity_id, { declaredOn: "2026-11-21", recordedAt: new Date(row.created_at).toISOString() });
    }
  }
  return declarations;
}
