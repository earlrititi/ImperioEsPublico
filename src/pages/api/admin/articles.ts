import type { APIRoute } from "astro";
import { ARTICLES_ITEMS } from "../../../config/home";
import { database,failure,limited,privateJson,requestBody,requireAdmin,rpc } from "../../../lib/reservations";
import { articleDraftPreview,validateArticleDraft } from "../../../lib/admin-article-content";
import { UUID } from "../../../lib/reservation-validation";
export const prerender=false;
const articleFailure=(error: unknown)=>{
  const code=error instanceof Error ? error.message : "";
  const messages: Record<string,string>={ARTICLE_CONFLICT:"Otro administrador ha guardado cambios. Recarga antes de guardar.",ARTICLE_SLUG_EXISTS:"El slug ya pertenece a otro articulo.",ARTICLE_SLUG_LOCKED:"La URL de un articulo publicado no puede cambiarse.",ARTICLE_NOT_FOUND:"Articulo no encontrado."};
  return messages[code] ? privateJson({error:messages[code],code},code==="ARTICLE_NOT_FOUND"?404:409) : failure(error);
};
export const GET: APIRoute=async context=>{
  try {
    await requireAdmin(context);
    const id=context.url.searchParams.get("id");
    const db=await database();
    if(id) {
      if(!UUID.test(id))throw new Error("INVALID_INPUT");
      const result=await db.from("cms_articles").select("id,slug,status,draft,revision,updated_at").eq("id",id).neq("status","deleted").maybeSingle();
      if(result.error)throw new Error("DATABASE_UNAVAILABLE");
      if(!result.data)throw new Error("ARTICLE_NOT_FOUND");
      return privateJson(result.data);
    }
    const page=Math.max(0,Math.min(10000,Number(context.url.searchParams.get("page"))||0));
    if(!Number.isInteger(page))throw new Error("INVALID_INPUT");
    const result=await db.from("cms_articles").select("id,slug,status,revision,updated_at",{count:"exact"}).neq("status","deleted")
      .order("updated_at",{ascending:false}).order("id").range(page*25,page*25+24);
    if(result.error)throw new Error("DATABASE_UNAVAILABLE");
    return privateJson({items:result.data,total:result.count,page});
  }catch(error){return articleFailure(error);}
};
export const POST: APIRoute=async context=>{
  try {
    const user=await requireAdmin(context);
    await limited(context.request,"admin_articles",60);
    const body=await requestBody(context.request,256000);
    const draft=validateArticleDraft(body?.draft);
    if(body.action==="preview")return privateJson({html:articleDraftPreview(draft)});
    if(body.action!=="save" || !UUID.test(body.id??"") || !Number.isInteger(body.revision) || body.revision<0)throw new Error("INVALID_INPUT");
    // Legacy import is separate: a new draft must never shadow a live file-backed article.
    if(ARTICLES_ITEMS.some(article=>article.slug===draft.slug))throw new Error("ARTICLE_SLUG_EXISTS");
    const saved=await rpc("save_article_draft",{p_id:body.id,p_actor:user.id,p_revision:body.revision,p_draft:draft});
    return privateJson({id:saved.id,slug:saved.slug,status:saved.status,revision:saved.revision,draft:saved.draft});
  }catch(error){return articleFailure(error);}
};
