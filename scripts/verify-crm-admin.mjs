// Full compiled admin route and real local PostgreSQL; Auth/GA4 are synthetic.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve, sep } from "node:path";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { Socket } from "node:net";
const url = new URL(process.env.TEST_DATABASE_URL || "http://missing");
assert.ok(["postgres:","postgresql:"].includes(url.protocol));
assert.equal(url.hostname,"127.0.0.1"); assert.equal(url.pathname,"/crm_fixture"); assert.equal(url.username,"crm_fixture");
const require=createRequire(resolve(process.env.CRM_SQL_TEST_MODULE_ROOT || ".","package.json"));
const {Client}=require("pg"),db=new Client({connectionString:url.href});
await db.connect();
assert.equal((await db.query("select count(*)::int as n from public.crm_fixture_migrations where name='061_crm_performance.sql'")).rows[0].n,1);
const user={id:"24f42701-98e0-4716-810c-363ae1cc8fa2",email:"admin@example.invalid",email_confirmed_at:new Date().toISOString(),aud:"authenticated",role:"authenticated",app_metadata:{},user_metadata:{}};
await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()) on conflict(id) do nothing",[user.id,user.email]);
await db.query("update public.marketing_automation_runtime set commercial_paused=false,commercial_paused_kinds='{}'");
// The sole socket connection was explicitly validated above and is already open.
Socket.prototype.connect=()=>{throw Error("No external connections in CRM fixture");};
const origin="http://127.0.0.1:25461";
Object.assign(process.env,{PUBLIC_SITE_URL:origin,PUBLIC_SUPABASE_URL:"https://fixture.supabase.co",PUBLIC_SUPABASE_ANON_KEY:"fixture",SUPABASE_SERVICE_ROLE_KEY:"fixture",MARKETING_AUTOMATIONS_ENABLED:"false",RATE_LIMIT_SECRET:"synthetic-rate-key-no-production"});
const encode=value=>Buffer.from(JSON.stringify(value)).toString("base64url"),exp=Math.floor(Date.now()/1000)+3600;
const token=`${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:user.id,exp,role:"authenticated"})}.fixture`;
const cookie=`sb-fixture-auth-token=base64-${encode({access_token:token,refresh_token:"fixture",expires_at:exp,expires_in:3600,token_type:"bearer",user})}`;
let forged=false,reportMissing=false;
globalThis.fetch=async(input,init)=>{
 const req=input instanceof Request?input:new Request(input,init),path=new URL(req.url).pathname;
 if(path==="/auth/v1/user")return Response.json(forged?{...user,id:"00000000-0000-4000-8000-000000000001",user_metadata:{role:"admin"}}:user);
 if(path==="/rest/v1/rpc/consume_rate_limit")return Response.json(true);
 if(path==="/rest/v1/marketing_automation_drafts")return Response.json([]);
 if(path==="/rest/v1/marketing_automation_runtime")return Response.json({enrollment_starts_at:new Date().toISOString()});
 if(path==="/rest/v1/rpc/marketing_automation_stats")return Response.json((await db.query("select public.marketing_automation_stats() as stats")).rows[0].stats);
 if(path==="/rest/v1/rpc/crm_performance_stats")return reportMissing?Response.json({code:"PGRST202",message:"missing fixture function"},{status:404}):Response.json((await db.query("select public.crm_performance_stats() as report")).rows[0].report);
 if(path==="/rest/v1/rpc/set_crm_commercial_pause"){
  const b=await req.json();try{return Response.json((await db.query("select public.set_crm_commercial_pause($1,$2,$3,$4) as policy",[b.p_actor,b.p_expected,b.p_paused,b.p_kinds])).rows[0].policy);}
  catch(error){return Response.json({message:error.message,code:error.code},{status:400});}
 }
 throw Error(`Unexpected CRM fixture request ${path}`);
};
const {default:app}=await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const call=(path,method="GET",body,authenticated=true,requestOrigin=origin)=>app.fetch(new Request(origin+path,{method,headers:{...(authenticated?{cookie}:{}),...(body?{"content-type":"application/json",origin:requestOrigin}:{})},...(body?{body:JSON.stringify(body)}:{})}));
try{
 assert.equal((await call("/api/admin/crm","GET",null,false)).status,403);
 forged=true;assert.equal((await call("/api/admin/crm")).status,403);forged=false;
 let response=await call("/api/admin/crm"),data=await response.json();assert.equal(response.status,200,JSON.stringify(data));
 assert.match(response.headers.get("cache-control"),/no-store/);
 assert.ok(data.report.policy);assert.equal(data.ga4.status,"not_configured");
 assert.doesNotMatch(JSON.stringify(data),/@example.invalid|fixture-refresh|SUPABASE_SERVICE_ROLE_KEY/);
 const expected={paused:false,kinds:[]};
 response=await call("/api/admin/crm","POST",{expected,paused:true,kinds:["welcome"]},true,"https://invalid.example");assert.notEqual(response.status,200);
 response=await call("/api/admin/crm","POST",{expected,paused:true,kinds:["welcome"]});assert.equal(response.status,200);
 assert.deepEqual((await response.json()).policy,{paused:true,kinds:["welcome"]});
 assert.equal((await call("/api/admin/crm","POST",{expected,paused:false,kinds:[]})).status,409);
 reportMissing=true;assert.equal((await call("/api/admin/crm")).status,503);reportMissing=false;
 console.log("PASS compiled admin → API → local PostgreSQL → response: auth, forged role, CSRF, aggregate privacy, optimistic pause, missing migration.");
 if(process.env.CRM_BROWSER_FIXTURE!=="1")exitFixture();
 else{
  await db.query("update public.marketing_automation_runtime set commercial_paused=false,commercial_paused_kinds='{}'");
  const staticRoot=resolve(".vercel/output/static");
  const server=createServer(async(req,res)=>{
   try{
    const path=new URL(req.url,origin).pathname,asset=resolve(staticRoot,"."+decodeURIComponent(path));
    if(asset.startsWith(staticRoot+sep)&&existsSync(asset)&&/\.(js|mjs|css|png|svg|woff2?)$/.test(asset)){
     const mime=asset.endsWith("css")?"text/css":/\.m?js$/.test(asset)?"text/javascript":asset.endsWith("svg")?"image/svg+xml":asset.endsWith("png")?"image/png":"font/woff2";
     res.writeHead(200,{"content-type":mime});res.end(readFileSync(asset));return;
    }
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const request=new Request(origin+req.url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks),duplex:"half"}:{})});
    const response=await app.fetch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
   }catch(error){console.error(error.message);res.writeHead(500);res.end("Fixture error");}
  });
  mkdirSync("tmp",{recursive:true});writeFileSync("tmp/crm-browser-fixture.json",JSON.stringify({origin,cookie,synthetic_only:true}));
  server.listen(25461,"127.0.0.1",()=>console.log("CRM_BROWSER_READY "+origin+" synthetic fixture cookie in tmp/crm-browser-fixture.json"));
  process.stdin.resume();process.stdin.once("data",()=>server.close(()=>exitFixture()));
 }
}catch(error){await db.end();throw error;}
async function exitFixture(){await db.end();process.exit(0);}
