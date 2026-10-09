import { ARTICLES_ITEMS } from "../config/home";
import { database } from "./reservations";
import { getArticleTier } from "../config/article-access";
import type { ArticleDraft } from "./admin-article-content";

export type PublishedArticle = (typeof ARTICLES_ITEMS)[number] & { cmsId?: string; author?: string };

// Select metadata only. Drafts and premium bodies must never reach a public list.
export async function publishedArticles(): Promise<PublishedArticle[]> {
  const db=await database();
  const records: {id:string;slug:string;status:string;published_meta:ArticleDraft|null}[]=[];
  for(let offset=0;;offset+=500){
    const {data,error}=await db.from("cms_articles").select("id,slug,status,published_meta").order("id").range(offset,offset+499);
    if(error)throw new Error("ARTICLE_CATALOG_UNAVAILABLE");
    records.push(...data);
    if(data.length<500)break;
  }
  const articles:PublishedArticle[]=ARTICLES_ITEMS.filter(a=>!records.some(r=>r.slug===a.slug && r.published_meta));
  for(const row of records){
    if(row.status!=="published" || !row.published_meta)continue;
    const meta=row.published_meta;
    const legacy=ARTICLES_ITEMS.find(a=>a.slug===row.slug);
    articles.push({...legacy,...meta,slug:row.slug,cmsId:row.id,sourceFile:"",href:`/papeles-y-tratados/${row.slug}`,
      ...(meta.imageSrc!==legacy?.imageSrc?{imageAvifSrcSet:undefined,imageWebpSrcSet:undefined,wordmarkSrc:undefined}:{}),
      imageWidth:legacy?.imageWidth??1200,imageHeight:legacy?.imageHeight??800,
    } as PublishedArticle);
  }
  return articles;
}

export function publishedArticleTier(article:PublishedArticle){return getArticleTier(article.slug);}

// Call only after server-side authorization, never from metadata endpoints.
export async function publishedArticleBody(id:string){
  const {data,error}=await (await database()).from("cms_articles").select("published_body").eq("id",id).eq("status","published").maybeSingle();
  if(error || !data)throw new Error("ARTICLE_UNAVAILABLE");
  return data.published_body as string;
}
