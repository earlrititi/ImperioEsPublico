export type ArticleState="draft"|"published"|"withdrawn"|"deleted";
export type ManagedArticle={id:string;slug:string;title?:string;category?:string;status:ArticleState;revision:number;updated_at?:string;legacy_slug?:string|null;published_title?:string|null;published_meta?:unknown};
export type ArticleLibraryRow={id:string|null;slug:string;title:string;category:string;status:ArticleState;revision:number;updated_at:string|null;source:"cms"|"file";isPublic:boolean};
type LegacyArticle={slug:string;title:string;category?:string;publishedAt?:string};

export function articleIsPublic(row:Pick<ManagedArticle,"status"|"legacy_slug"|"published_title"|"published_meta">){
  return row.status==="published" || (row.status==="draft"&&Boolean(row.legacy_slug)&&!row.published_title&&!row.published_meta);
}

export function articleLibrary(managed:ManagedArticle[],legacy:LegacyArticle[],options:{page:number;status:string;search:string}){
  const known=new Set(managed.map(row=>row.slug));
  const rows:ArticleLibraryRow[]=managed.map(row=>({
    id:row.id,slug:row.slug,title:row.title||row.slug,category:row.category??"",status:articleIsPublic(row)?"published":row.status,
    revision:row.revision,updated_at:row.updated_at??null,source:"cms",isPublic:articleIsPublic(row),
  }));
  for(const row of legacy){
    if(!known.has(row.slug))rows.push({id:null,slug:row.slug,title:row.title,category:row.category??"",status:"published",revision:0,updated_at:row.publishedAt??null,source:"file",isPublic:true});
  }
  const counts={all:rows.filter(row=>row.status!=="deleted").length,draft:0,published:0,withdrawn:0,deleted:0};
  for(const row of rows)counts[row.status]++;
  const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const query=normalize(options.search);
  const filtered=rows.filter(row=>(options.status==="all"?row.status!=="deleted":row.status===options.status)&&
    (!query||normalize(`${row.title} ${row.slug}`).includes(query)));
  filtered.sort((a,b)=>(b.updated_at??"").localeCompare(a.updated_at??"")||a.title.localeCompare(b.title,"es")||a.slug.localeCompare(b.slug));
  const total=filtered.length,page=Math.min(options.page,Math.max(0,Math.ceil(total/25)-1));
  return {items:filtered.slice(page*25,page*25+25),total,page,counts};
}
