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
    return json(rows.map(row=>({...row,title:row.draft.title})),200,{"content-range":`0-${Math.max(0,rows.length-1)}/${rows.length}`});
  }
  if(path==="/rest/v1/rpc/save_article_draft"){
    const b=await req.json(),old=records.get(b.p_id);if((old?.revision??0)!==b.p_revision)return json({message:"ARTICLE_CONFLICT"},400);
    const row={id:b.p_id,slug:b.p_draft.slug,draft:b.p_draft,status:old?.status??"draft",revision:(old?.revision??0)+1,published_meta:old?.published_meta??null,published_body:old?.published_body??null};
    records.set(row.id,row);writes++;return json(row);
  }
  if(path==="/rest/v1/rpc/transition_article"){
    const b=await req.json(),row=records.get(b.p_id);if(!row)return json({message:"ARTICLE_NOT_FOUND"},400);
    if(row.revision!==b.p_revision)return json({message:"ARTICLE_CONFLICT"},400);
    if(b.p_action==="publish"){row.status="published";const {body,...meta}=row.draft;row.published_meta=meta;row.published_body=body;}
    else row.status=b.p_action==="delete"?"deleted":b.p_action==="restore"?(row.published_meta?"withdrawn":"draft"):"withdrawn";
    row.revision++;writes++;return json(row);
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
console.log("Compiled CMS: create, search, edit, saved/public snapshots, publication, stale revisions, reversible deletion/restoration, image upload/proxy, admin identity and CSRF passed. No real network.");
