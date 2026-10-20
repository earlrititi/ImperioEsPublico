import assert from "node:assert/strict";
import { Socket } from "node:net";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import sharp from "sharp";
Socket.prototype.connect=()=>{throw Error("Real network disabled in CMS fixtures");};
const publicUrl=parseEnv(readFileSync(".env.local","utf8")).PUBLIC_SUPABASE_URL,project=new URL(publicUrl).hostname.split(".")[0];
Object.assign(process.env,{PUBLIC_SITE_URL:"https://imperioes.com",PUBLIC_SUPABASE_URL:publicUrl,
  PUBLIC_SUPABASE_ANON_KEY:"fixture",SUPABASE_SERVICE_ROLE_KEY:"fixture",RATE_LIMIT_SECRET:"fixture",STRIPE_SECRET_KEY:"sk_test_disabled"});
const user={id:"24f42701-98e0-4716-810c-363ae1cc8fa2",email:"fixture@example.invalid",email_confirmed_at:"2026-10-01T00:00:00Z",aud:"authenticated",role:"authenticated"};
const encode=v=>Buffer.from(JSON.stringify(v)).toString("base64url"),exp=Math.floor(Date.now()/1000)+3600;
const cookie=`sb-${project}-auth-token=base64-${encode({access_token:`${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:user.id,exp})}.fixture`,refresh_token:"fixture",token_type:"bearer",expires_at:exp,expires_in:3600,user})}`;
const records=new Map(),media=new Map(),requests=[];let forged=false,writes=0;
const json=(data,status=200,headers={})=>Response.json(data,{status,headers});
globalThis.fetch=async(input,init)=>{
  const req=input instanceof Request?input:new Request(input,init),url=new URL(req.url),path=url.pathname;
  requests.push(`${req.method} ${path}`);
  if(path==="/auth/v1/user")return json(forged?{...user,id:"00000000-0000-4000-8000-000000000001",user_metadata:{role:"admin"}}:user);
  if(path==="/rest/v1/rpc/consume_rate_limit")return json(true);
  if(path==="/rest/v1/cms_articles"){
    const id=url.searchParams.get("id")?.replace(/^eq\./,"");if(id)return json(records.get(id)??null);
    let rows=[...records.values()];const status=url.searchParams.get("status");if(status?.startsWith("eq."))rows=rows.filter(r=>r.status===status.slice(3));else if(status==="neq.deleted")rows=rows.filter(r=>r.status!=="deleted");
    if(url.searchParams.has("draft->>title"))assert.equal(url.searchParams.get("draft->>title"),"ilike.%Prueba%");
    return json(rows.map(row=>({...row,title:row.draft.title,category:row.draft.category,published_title:row.published_meta?.title??null})),200,{"content-range":`0-${Math.max(0,rows.length-1)}/${rows.length}`});
  }
  if(path==="/rest/v1/rpc/save_article_draft"){
    const b=await req.json(),old=records.get(b.p_id);if((old?.revision??0)!==b.p_revision)return json({message:"ARTICLE_CONFLICT"},400);
    const row={...old,id:b.p_id,slug:b.p_draft.slug,draft:b.p_draft,status:old?.status??"draft",revision:(old?.revision??0)+1,published_meta:old?.published_meta??null,published_body:old?.published_body??null};
    records.set(row.id,row);writes++;return json(row);
  }
  if(path==="/rest/v1/rpc/transition_article"){
    const b=await req.json(),row=records.get(b.p_id);if(!row)return json({message:"ARTICLE_NOT_FOUND"},400);
    if(row.revision!==b.p_revision)return json({message:"ARTICLE_CONFLICT"},400);
    if(b.p_action==="publish"){row.status="published";const {body,...meta}=row.draft;row.published_meta=meta;row.published_body=body;}
    else row.status=b.p_action==="delete"?"deleted":b.p_action==="restore"?(row.published_meta||row.legacy_slug?"withdrawn":"draft"):"withdrawn";
    row.revision++;writes++;return json(row);
  }
  if(path==="/rest/v1/rpc/import_article_draft"){
    const b=await req.json(),old=[...records.values()].find(row=>row.slug===b.p_draft.slug);if(old)return json(old);
    const row={id:b.p_id,slug:b.p_draft.slug,legacy_slug:b.p_draft.slug,draft:b.p_draft,status:"draft",revision:1,published_meta:null,published_body:null};
    records.set(row.id,row);writes++;return json(row);
  }
  if(path.startsWith("/storage/v1/object/article-media/")&&req.method==="POST"){
    const key=path.split("/").at(-1),body=Buffer.from(await req.arrayBuffer());assert.equal(req.headers.get("content-type"),"image/webp");
    assert.equal((await sharp(body).metadata()).format,"webp");media.set(key,body);writes++;return json({Key:`article-media/${key}`});
  }
  if(path.startsWith("/storage/v1/object/article-media/")&&req.method==="GET"){
    const value=media.get(path.split("/").at(-1));return value?new Response(value,{headers:{"Content-Type":"image/webp"}}):json({message:"not found"},404);
  }
  throw Error(`Unexpected CMS fixture request: ${req.method} ${path}`);
};
const {default:app}=await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const base="https://imperioes.com/api/admin/articles",id="11111111-1111-4111-8111-111111111111";
const call=(body,authenticated=true,origin="https://imperioes.com",suffix="")=>app.fetch(new Request(base+suffix,{method:body?"POST":"GET",
  headers:{...(authenticated?{cookie}:{}),...(body?{Origin:origin,"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined}));
assert.equal((await call(null,false)).status,403);forged=true;assert.equal((await call(null)).status,403);forged=false;
const draft={title:"Prueba editorial",slug:"prueba-editorial",lead:"Resumen",category:"Historia",author:"Imperio E",imageSrc:"",imageAlt:"",imageCaption:"",publishedAt:"2026-10-18",seoTitle:"Prueba editorial",description:"Resumen editorial",body:'<p>Texto privado</p><script>alert(1)</script>'};
assert.notEqual((await call({action:"save",id,revision:0,draft},true,"https://evil.example")).status,200);assert.equal(writes,0);
let response=await call({action:"save",id,revision:0,draft});assert.equal(response.status,200);let saved=await response.json();assert.equal(saved.revision,1);assert.doesNotMatch(saved.draft.body,/<script/);
const listed=await call(null,true,"", "?search=Prueba&status=draft");assert.equal(listed.status,200);assert.equal((await listed.json()).items[0].title,draft.title);
assert.equal((await call(null,true,"","?status=invalid")).status,409);
response=await call({action:"publish",id,revision:1});assert.equal(response.status,200);saved=await response.json();assert.equal(saved.status,"published");
response=await call({action:"save",id,revision:saved.revision,draft:{...draft,body:"<p>Revision nueva</p>"}});assert.equal(response.status,200);saved=await response.json();
assert.match(records.get(id).published_body,/Texto privado/);
assert.equal((await call({action:"publish",id,revision:1})).status,409);
response=await call({action:"delete",id,revision:saved.revision});assert.equal(response.status,200);saved=await response.json();assert.equal(saved.status,"deleted");
assert.equal((await (await call(null,true,"","?status=deleted")).json()).items.length,1);
response=await call({action:"restore",id,revision:saved.revision});assert.equal(response.status,200);saved=await response.json();assert.equal(saved.status,"withdrawn");
response=await call({action:"save",id,revision:saved.revision,draft:{...draft,description:""}});saved=await response.json();
response=await call({action:"publish",id,revision:saved.revision});assert.equal(response.status,400);assert.equal((await response.json()).code,"ARTICLE_INCOMPLETE");
const upload=async(origin="https://imperioes.com",authenticated=true)=>{
  const form=new FormData();form.append("file",new File([await sharp({create:{width:64,height:48,channels:3,background:"red"}}).png().toBuffer()],"private-name.png",{type:"image/png"}));
  return app.fetch(new Request("https://imperioes.com/api/admin/article-media",{method:"POST",headers:{Origin:origin,...(authenticated?{cookie}:{})},body:form}));
};
assert.equal((await upload("https://imperioes.com",false)).status,403);assert.equal((await upload("https://evil.example")).status,403);
response=await upload();assert.equal(response.status,201);const image=await response.json();assert.match(image.src,/^\/media\/articles\/[a-f0-9-]+\.webp$/);assert.doesNotMatch(JSON.stringify(image),/private-name|storage\/v1/);
response=await app.fetch(new Request(`https://imperioes.com${image.src}`));assert.equal(response.status,200,JSON.stringify({requests:requests.slice(-3),stored:media.size}));assert.equal(response.headers.get("content-type"),"image/webp");
assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width,64);
const originalSlug="bienvenidos-a-la-web-del-imperio-espanol",importId="22222222-2222-4222-8222-222222222222";
const publicArticle=()=>app.fetch(new Request(`https://imperioes.com/papeles-y-tratados/${originalSlug}`));
assert.equal((await publicArticle()).status,200);
response=await call({action:"import",id:importId,slug:originalSlug});assert.equal(response.status,200);let original=await response.json();
assert.equal(original.isPublic,true);assert.equal(original.slugLocked,true);assert.equal((await publicArticle()).status,200);
response=await call({action:"delete",id:original.id,revision:original.revision});assert.equal(response.status,200);original=await response.json();
assert.equal((await publicArticle()).status,404,"Deleting an imported draft must hide its original file");
response=await call({action:"restore",id:original.id,revision:original.revision});assert.equal(response.status,200);original=await response.json();
assert.equal(original.status,"withdrawn");assert.equal(original.isPublic,false);assert.equal((await publicArticle()).status,404,"Restore must not republish a legacy file");
response=await call({action:"publish",id:original.id,revision:original.revision});assert.equal(response.status,200);assert.equal((await publicArticle()).status,200);
console.log("Compiled CMS: create, search, edit, saved/public snapshots, publication, stale revisions, reversible deletion/restoration, image upload/proxy, admin identity and CSRF passed. No real network.");
if(process.argv.includes("--serve")){
  const {createServer}=await import("node:http"),{readFile}=await import("node:fs/promises"),{resolve,extname,sep}=await import("node:path");
  const root=resolve(".vercel/output/static"),mime={".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".avif":"image/avif",".woff2":"font/woff2"};
  createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,"http://127.0.0.1:4331");
      if(url.pathname.startsWith("/_astro/")||url.pathname.startsWith("/images/")){
        const path=resolve(root,"."+decodeURIComponent(url.pathname));if(!path.startsWith(root+sep))throw Error("INVALID_PATH");
        res.writeHead(200,{"Content-Type":mime[extname(path)]??"application/octet-stream"});res.end(await readFile(path));return;
      }
      const body=[];for await(const chunk of req)body.push(chunk);
      const headers=new Headers(req.headers);headers.set("cookie",cookie);headers.delete("host");
      if(req.method!=="GET"&&req.method!=="HEAD")headers.set("origin","https://imperioes.com");
      const response=await app.fetch(new Request("https://imperioes.com"+url.pathname+url.search,{method:req.method,headers,...(body.length?{body:Buffer.concat(body)}:{})}));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch{res.writeHead(500,{"Content-Type":"text/plain"});res.end("Synthetic CMS request failed; no production services contacted.");}
  }).listen(4331,"127.0.0.1",()=>console.log("Synthetic CMS QA: http://127.0.0.1:4331/admin/articles (in-memory fixtures only)."));
}
