import type { APIRoute } from "astro";
import { ARTICLE_MEDIA_BUCKET, ARTICLE_MEDIA_KEY } from "../../../lib/article-media";
import { database } from "../../../lib/reservations";

export const prerender = false;
export const GET: APIRoute = async ({ params }) => {
  if (!ARTICLE_MEDIA_KEY.test(params.file ?? "")) return new Response(null, { status: 404 });
  try {
    const { data, error } = await (await database()).storage.from(ARTICLE_MEDIA_BUCKET).download(params.file!);
    if (error || !data) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(await data.arrayBuffer(), { headers: { "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox", "Cache-Control": "public, max-age=31536000, immutable",
      "Referrer-Policy": "no-referrer" } });
  } catch { return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } }); }
};
