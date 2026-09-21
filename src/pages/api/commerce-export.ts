import type { APIRoute } from "astro";
import { database, failure, limited, requireAdmin } from "../../lib/reservations";
export const prerender = false;
const cell = (value: unknown) => {
  const text = String(value ?? "");
  return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
};
export const GET: APIRoute = async (context) => {
  try {
    await requireAdmin(context);
    await limited(context.request, "commerce_export", 10);
    const db = await database();
    const rows = [["Pedido", "Nombre", "Email", "Direccion", "Piso", "CP", "Localidad", "Provincia", "Pais", "SKU", "Talla", "Cantidad", "Total centimos", "Estado"]];
    let offset = 0;
    while (true) {
      const { data, error } = await db.from("commerce_orders")
        .select("number,customer_name,customer_email,shipping_address,total,status,commerce_order_items(sku,size,quantity)")
        .in("status", ["PAID", "READY_FOR_FULFILLMENT", "PREPARING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"])
        .order("created_at").order("id").range(offset, offset + 999);
      if (error) throw new Error("DATABASE_UNAVAILABLE");
      for (const o of data ?? []) for (const i of o.commerce_order_items) {
        const a = o.shipping_address;
        rows.push([o.number, o.customer_name, o.customer_email, a.line1, a.line2, a.postalCode, a.city, a.province, a.country, i.sku, i.size, String(i.quantity), String(o.total), o.status]);
      }
      if (!data || data.length < 1000) break;
      offset += 1000;
      if (offset >= 100000) throw new Error("EXPORT_LIMIT");
    }
    return new Response("\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="pedidos-pagados.csv"', "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
    });
  } catch (error) { return failure(error); }
};
