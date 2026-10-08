import { database } from "./reservations";

export async function auditAdmin(actor: string, entity: string, id: string, action: string) {
  const { error } = await (await database()).from("commerce_audit").insert({ actor_id: actor, entity_id: id, entity, action });
  if (error) throw new Error("AUDIT_UNAVAILABLE");
}

export async function readAll(table: string, columns: string) {
  const db = await database();
  const rows: Record<string, any>[] = [];
  for (let page = 0; page < 100; page++) {
    const { data, error } = await db.from(table).select(columns).order("id").range(page * 500, page * 500 + 499);
    if (error) throw new Error("DATABASE_UNAVAILABLE");
    rows.push(...(data as unknown as Record<string, any>[]));
    if (!data || data.length < 500) return rows;
  }
  throw new Error("AUDIENCE_TOO_LARGE");
}
