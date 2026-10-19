import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";
import { ARTICLE_MEDIA_BUCKET, readArticleImage } from "../../../lib/article-media";
import { database, failure, limited, privateJson, requireAdmin } from "../../../lib/reservations";

export const prerender = false;
export const POST: APIRoute = async context => {
  try {
    await requireAdmin(context);
    if (context.request.headers.get("origin") !== context.url.origin) throw Error("FORBIDDEN");
    await limited(context.request, "admin_article_media", 30);
    const image = await readArticleImage(context.request), key = `${randomUUID()}.webp`;
    const result = await (await database()).storage.from(ARTICLE_MEDIA_BUCKET)
      .upload(key, image.bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (result.error) return privateJson({ error: "No se pudo guardar la imagen. Comprueba el almacenamiento editorial." }, 503);
    return privateJson({ src: `/media/articles/${key}`, width: image.width, height: image.height }, 201);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = { IMAGE_TOO_LARGE: "La imagen debe ocupar como maximo 3 MB.",
      IMAGE_TYPE_NOT_ALLOWED: "Selecciona una imagen JPG, PNG, WebP o AVIF.", IMAGE_INVALID: "La imagen no es valida o excede 16 megapixeles." };
    return messages[code] ? privateJson({ error: messages[code], code }, code === "IMAGE_TOO_LARGE" ? 413 : 400) : failure(error);
  }
};
