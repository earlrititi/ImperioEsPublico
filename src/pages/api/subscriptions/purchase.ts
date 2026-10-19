import type { APIRoute } from "astro";
import { consumeRateLimit } from "../../../lib/rate-limit";
import { subscriptionPurchaseReceipt } from "../../../lib/subscription-purchase";

export const prerender = false;
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

export const POST: APIRoute = async ({ request }) => {
  // The unguessable Checkout ID is a receipt capability, not an authentication
  // mechanism. Return only fixed product fields and amounts, never identity/access.
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "Invalid content type" }, { status: 415, headers });
  if (Number(request.headers.get("content-length")) > 1024)
    return Response.json({ error: "Solicitud demasiado grande" }, { status: 413, headers });
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ analyticsPurchase: null }, { headers });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1024) { await reader.cancel(); return Response.json({ error: "Solicitud demasiado grande" }, { status: 413, headers }); }
      chunks.push(part.value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!/^cs_live_[A-Za-z0-9]{1,190}$/.test(sessionId)) return Response.json({ analyticsPurchase: null }, { headers });
    if (!await consumeRateLimit({ request, endpoint: "subscription_purchase_receipt", limit: 30, windowSeconds: 15 * 60 }))
      return Response.json({ error: "Intentalo mas tarde" }, { status: 429, headers });
    const { stripe } = await import("../../../lib/stripe");
    return Response.json({ analyticsPurchase: await subscriptionPurchaseReceipt(stripe, sessionId) }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError || (error as { code?: string })?.code === "resource_missing")
      return Response.json({ analyticsPurchase: null }, { headers });
    return Response.json({ error: "Recibo no disponible" }, { status: 503, headers });
  }
};
