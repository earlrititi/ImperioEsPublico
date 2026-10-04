import type { APIRoute } from "astro";
import { readPublicInventory } from "../../lib/public-inventory";
import { metaCatalogXml } from "../../lib/meta-catalog";
export const prerender = false;
export const GET: APIRoute = async () => {
  try {
    return new Response(metaCatalogXml(await readPublicInventory()), {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("Catalog temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
};
