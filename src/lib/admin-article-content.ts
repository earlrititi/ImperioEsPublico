import sanitizeHtml from "sanitize-html";

export const ARTICLE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export type ArticleDraft = {
  title: string; slug: string; lead: string; category: string; author: string;
  imageSrc: string; imageAlt: string; imageCaption: string; publishedAt: string;
  seoTitle: string; description: string; body: string;
};

export function safeArticleImage(value: string) {
  // Local media only. Uploads will be served from the same-origin media route.
  let decoded:string;
  try{decoded=decodeURIComponent(value);}catch{return false;}
  return /^\/(?:images|media\/articles)\/[\p{L}\p{M}0-9_/(). -]+\.(?:png|jpg|jpeg|webp|avif)$/iu.test(decoded) &&
    !decoded.includes("..") && !decoded.includes("%") && !decoded.includes("\\");
}

export function sanitizeArticleBody(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p","br","h2","h3","strong","em","s","u","sup","blockquote","ul","ol","li","a","img","figure","figcaption","hr"],
    allowedAttributes: { h2:["id"],h3:["id"],a: ["href","title","rel"], img: ["src","alt","title","width","height","loading"] },
    allowedSchemes: ["https","http"], allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform("a",{rel:"noopener noreferrer"}),
      img: sanitizeHtml.simpleTransform("img",{loading:"lazy"}) },
    exclusiveFilter: frame => frame.tag === "img" && !safeArticleImage(frame.attribs.src ?? ""),
  });
}

export function validateArticleDraft(input: unknown): ArticleDraft {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_INPUT");
  const data = input as Record<string,unknown>;
  const text = (key: string,max: number,required=false) => {
    if (typeof data[key] !== "string" || data[key].length > max) throw new Error("INVALID_INPUT");
    const value = data[key].trim();
    if (required && !value) throw new Error("INVALID_INPUT");
    return value;
  };
  const draft = {
    title:text("title",200,true), slug:text("slug",160,true), lead:text("lead",1200),
    category:text("category",100,true),author:text("author",150,true),
    imageSrc:text("imageSrc",500),imageAlt:text("imageAlt",300),imageCaption:text("imageCaption",1000),
    publishedAt:text("publishedAt",10),seoTitle:text("seoTitle",200),description:text("description",500),
    body:sanitizeArticleBody(text("body",200000)),
  };
  if (!ARTICLE_SLUG.test(draft.slug) || (draft.imageSrc && !safeArticleImage(draft.imageSrc))) throw new Error("INVALID_INPUT");
  if (draft.publishedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.publishedAt) ||
    !Number.isFinite(Date.parse(draft.publishedAt)) || new Date(draft.publishedAt).toISOString().slice(0,10)!==draft.publishedAt)) throw new Error("INVALID_INPUT");
  return draft;
}

export function articleDraftPreview(draft: ArticleDraft) {
  const escape = (value: string) => sanitizeHtml(value,{allowedTags:[],allowedAttributes:{},disallowedTagsMode:"escape"});
  return `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width"><style>body{margin:0;padding:24px;background:#101012;color:#eee;font:18px/1.7 Georgia,serif;overflow-wrap:anywhere}article{max-width:780px;margin:auto}h1{font-size:32px;line-height:1.2}img{max-width:100%;height:auto}a{color:#f58c91}blockquote{border-left:3px solid #bd343e;padding-left:20px}</style></head><body><article><p>${escape(draft.category)}</p><h1>${escape(draft.title)}</h1><p>${escape(draft.lead)}</p><p>${escape(draft.author)}</p>${draft.imageSrc ? `<figure><img src="${draft.imageSrc}" alt="${escape(draft.imageAlt).replaceAll('"',"&quot;")}"><figcaption>${escape(draft.imageCaption)}</figcaption></figure>` : ""}${draft.body}</article></body></html>`;
}
