import type { APIRoute } from "astro";
import { ARTICLES_ITEMS } from "../../../config/home";
import { database,failure,limited,privateJson,requestBody,requireAdmin,rpc } from "../../../lib/reservations";
import { articleDraftPreview,validateArticleDraft } from "../../../lib/admin-article-content";
import { articlePublicationIssues } from "../../../lib/admin-article-editor";
import { articleIsPublic,articleLibrary,type ManagedArticle } from "../../../lib/admin-article-library";
import { readAll } from "../../../lib/admin-data";
import { UUID } from "../../../lib/reservation-validation";
import { loadArticleSource } from "../../../lib/article-content";
import { getArticleEditorial } from "../../../config/editorial";
import ArticleBody from "../../../components/ArticleBody";
import { h } from "preact";
import renderToString from "preact-render-to-string";
export const prerender=false;
const articleFailure=(error: unknown)=>{
  const code=error instanceof Error ? error.message : "";
  const messages: Record<string,string>={ARTICLE_CONFLICT:"Otro administrador ha guardado cambios. Recarga antes de guardar.",ARTICLE_SLUG_EXISTS:"El slug ya pertenece a otro articulo.",ARTICLE_SLUG_LOCKED:"La URL de un articulo publicado no puede cambiarse.",ARTICLE_NOT_FOUND:"Articulo no encontrado."};
  return messages[code] ? privateJson({error:messages[code],code},code==="ARTICLE_NOT_FOUND"?404:409) : failure(error);
};
const savedArticle=(saved:any)=>({id:saved.id,slug:saved.slug,status:saved.status,revision:saved.revision,draft:saved.draft,updated_at:saved.updated_at,
  isPublic:articleIsPublic(saved),slugLocked:Boolean(saved.legacy_slug||saved.published_title||saved.published_meta)});
export const GET: APIRoute=async context=>{
  try {
    await requireAdmin(context);
    const id=context.url.searchParams.get("id");
    const db=await database();
    if(id) {
      if(!UUID.test(id))throw new Error("INVALID_INPUT");
      const result=await db.from("cms_articles").select("id,slug,status,draft,revision,updated_at,legacy_slug,published_title:published_meta->>title").eq("id",id).maybeSingle();
      if(result.error)throw new Error("DATABASE_UNAVAILABLE");
      if(!result.data)throw new Error("ARTICLE_NOT_FOUND");
      return privateJson(savedArticle(result.data));
    }
    const page=Math.max(0,Math.min(10000,Number(context.url.searchParams.get("page"))||0));
    if(!Number.isInteger(page))throw new Error("INVALID_INPUT");
    const status=context.url.searchParams.get("status")??"all",search=(context.url.searchParams.get("search")??"").trim();
    if(!["all","draft","published","withdrawn","deleted"].includes(status)||search.length>100)throw Error("INVALID_INPUT");
    const records=await readAll("cms_articles","id,slug,status,revision,updated_at,legacy_slug,title:draft->>title,category:draft->>category,published_title:published_meta->>title");
    return privateJson(articleLibrary(records as ManagedArticle[],ARTICLES_ITEMS,{page,status,search}));
  }catch(error){return articleFailure(error);}
};
export const POST: APIRoute=async context=>{
  try {
    const user=await requireAdmin(context);
    await limited(context.request,"admin_articles",60);
    const body=await requestBody(context.request,256000);
    if(body.action==="import") {
      const legacy=ARTICLES_ITEMS.find(a=>a.slug===body.slug);
      if(!legacy || !UUID.test(body.id??""))throw new Error("INVALID_INPUT");
      const draft=validateArticleDraft({title:legacy.title,slug:legacy.slug,lead:legacy.lead??"",category:legacy.category,author:"Imperio Espanol",
        imageSrc:legacy.imageSrc,imageAlt:legacy.imageAlt||legacy.title,imageCaption:legacy.imageCaption??"",publishedAt:legacy.publishedAt??"",
        seoTitle:legacy.seoTitle??legacy.title,description:legacy.description??"",
        body:renderToString(h(ArticleBody,{source:await loadArticleSource(legacy.sourceFile),noteIds:getArticleEditorial(legacy.slug).notes.map(n=>n.id)}))});
      const saved=await rpc("import_article_draft",{p_id:body.id,p_actor:user.id,p_draft:draft});
      return privateJson(savedArticle(saved));
    }
    if (["publish","withdraw","delete","restore"].includes(body?.action)) {
      if (!UUID.test(body.id??"") || !Number.isInteger(body.revision) || body.revision<1) throw new Error("INVALID_INPUT");
      if (body.action==="publish") {
        const result=await (await database()).from("cms_articles").select("draft").eq("id",body.id).single();
        if(result.error)throw new Error("ARTICLE_NOT_FOUND");
        const checked=validateArticleDraft(result.data.draft);
        const issues=articlePublicationIssues(checked);
        if(issues.length)return privateJson({error:`Completa antes de publicar: ${issues.join(", ")}.`,code:"ARTICLE_INCOMPLETE",issues},400);
      }
      const saved=await rpc("transition_article",{p_id:body.id,p_actor:user.id,p_revision:body.revision,p_action:body.action});
      return privateJson(savedArticle(saved));
    }
    const draft=validateArticleDraft(body?.draft);
    if(body.action==="preview")return privateJson({html:articleDraftPreview(draft)});
    if(body.action!=="save" || !UUID.test(body.id??"") || !Number.isInteger(body.revision) || body.revision<0)throw new Error("INVALID_INPUT");
    // Legacy import is separate: a new draft must never shadow a live file-backed article.
    if(ARTICLES_ITEMS.some(article=>article.slug===draft.slug)) {
      const existing=await (await database()).from("cms_articles").select("legacy_slug").eq("id",body.id).maybeSingle();
      if(existing.error || existing.data?.legacy_slug!==draft.slug)throw new Error("ARTICLE_SLUG_EXISTS");
    }
    const saved=await rpc("save_article_draft",{p_id:body.id,p_actor:user.id,p_revision:body.revision,p_draft:draft});
    return privateJson(savedArticle(saved));
  }catch(error){return articleFailure(error);}
};
