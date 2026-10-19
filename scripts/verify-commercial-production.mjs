import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { parse } from "parse5";

const checks=[];
async function get(url,expected=200,options={}){
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(30000),...options});
  assert.equal(response.status,expected,new URL(url).pathname);checks.push({host:new URL(url).hostname,path:new URL(url).pathname,status:response.status});
  return response;
}
const editor=readdirSync(".vercel/output/static/_astro").find(name=>/^ArticleEditor\..*\.js$/.test(name));
assert.ok(editor);
for(const host of ["imperioes.com","www.imperioes.com"]){
  const origin=`https://${host}`,home=await(await get(origin+"/")).text();
  for(const signal of ["home-shirt","/carrito","No acumulable; envio excluido"])assert.ok(home.includes(signal));
  assert.doesNotMatch(home,/BEGIN PRIVATE KEY|\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/);
  const registration=await(await get(origin+"/registro")).text();
  assert.match(registration,/name="newsletter"/);assert.doesNotMatch(registration,/<input[^>]*name="newsletter"[^>]*checked/);
  const subscriptions=parse(await(await get(origin+"/suscribirse")).text());
  let popup=false;
  const visit=node=>{if(node.attrs?.some(attr=>attr.name==="data-tshirt-lead"))popup=true;for(const child of node.childNodes??[])visit(child);};
  visit(subscriptions);assert.equal(popup,false,"The offer must not interrupt plan selection");
  for(const path of ["/tienda","/carrito","/recursos/7-historias-del-siglo-de-oro"]){await(await get(origin+path)).arrayBuffer();}
  for(const path of ["/api/admin/articles","/api/admin/automations","/api/admin/automation-stats"]){
    const response=await get(origin+path,403);assert.match(response.headers.get("cache-control"),/no-store/);await response.arrayBuffer();
  }
  await get(origin+"/api/admin/article-media",403,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:"{}"});
  const script=await(await get(origin+"/_astro/"+editor)).text();
  assert.match(script,/Restaurar sin publicar/);assert.match(script,/\/api\/admin\/article-media/);
  const logo=await get(origin+"/images/logo-redv2.png");assert.match(logo.headers.get("content-type"),/image\/png/);await logo.arrayBuffer();
  const pdf=Buffer.from(await(await get(origin+"/recursos/7-historias-del-siglo-de-oro.pdf")).arrayBuffer());assert.equal(pdf.subarray(0,5).toString(),"%PDF-");
}
console.log(JSON.stringify({checks,servedCmsArtifact:editor,uncheckedNewsletter:true,privateApisProtected:true}));
if(process.argv.includes("--maintenance")){
  const env=parseEnv(readFileSync(".env.reservation-production.local","utf8"));
  assert.equal(env.PUBLIC_SUPABASE_URL,"https://pjrqozlyrjgugdraoght.supabase.co");
  const db=createClient(env.PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const queued=await db.from("marketing_automation_jobs").select("id",{head:true,count:"exact"}).in("status",["pending","processing"]);
  assert.ifError(queued.error);assert.equal(queued.count,0,"Do not dispatch unrelated pending marketing jobs in a release check");
  const response=await get("https://imperioes.com/api/marketing-maintenance",200,{method:"POST",
    headers:{Authorization:`Bearer ${env.COMMERCE_JOB_SECRET}`,"Content-Type":"application/json"},body:"{}"});
  const result=await response.json();assert.equal(result.disabled,false);assert.equal(result.failed,0);assert.equal(result.sent,0);assert.equal(result.queued,0);
  assert.equal(result.delivery.disabled,false);console.log(JSON.stringify({liveMarketingWorker:result,noHistoricalMessagesSent:true}));
}
