import sharp from "sharp";

export const ARTICLE_MEDIA_BUCKET = "article-media";
export const ARTICLE_MEDIA_LIMIT = 3 * 1024 * 1024;
export const ARTICLE_MEDIA_KEY = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/;
const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp", "image/avif": "heif" };

export async function prepareArticleImage(bytes: Uint8Array, mime: string) {
  if (!bytes.byteLength || bytes.byteLength > ARTICLE_MEDIA_LIMIT) throw Error("IMAGE_TOO_LARGE");
  if (!Object.hasOwn(formats, mime)) throw Error("IMAGE_TYPE_NOT_ALLOWED");
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" });
    const meta = await image.metadata();
    if (meta.format !== formats[mime] || (meta.format === "heif" && meta.compression !== "av1") ||
      !meta.width || !meta.height || meta.width < 16 || meta.height < 16 || (meta.pages ?? 1) !== 1) throw Error();
    // Re-encode on the server: never publish the input file, scripts or EXIF.
    const { data, info } = await image.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    if (data.byteLength > ARTICLE_MEDIA_LIMIT) throw Error("IMAGE_TOO_LARGE");
    return { bytes: data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof Error && error.message === "IMAGE_TOO_LARGE") throw error;
    throw Error("IMAGE_INVALID");
  }
}

export async function readArticleImage(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data;")) throw Error("INVALID_INPUT");
  const max = ARTICLE_MEDIA_LIMIT + 65536;
  if (Number(request.headers.get("content-length")) > max) throw Error("IMAGE_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw Error("INVALID_INPUT");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > max) { await reader.cancel(); throw Error("IMAGE_TOO_LARGE"); }
    chunks.push(part.value);
  }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData(); }
  catch { throw Error("INVALID_INPUT"); }
  const file = form.get("file");
  if (!(file instanceof File) || [...form.keys()].length !== 1) throw Error("INVALID_INPUT");
  return prepareArticleImage(new Uint8Array(await file.arrayBuffer()), file.type);
}
