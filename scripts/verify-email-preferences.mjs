import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseEnv} from "node:util";
import {Socket} from "node:net";
Socket.prototype.connect=()=>{throw Error("Real network prohibited");};
const local=parseEnv(readFileSync(".env.local","utf8"));
Object.assign(process.env,{PUBLIC_SITE_URL:"https://imperioes.com",PUBLIC_SUPABASE_URL:local.PUBLIC_SUPABASE_URL,PUBLIC_SUPABASE_ANON_KEY:"fixture",SUPABASE_SERVICE_ROLE_KEY:"fixture",RATE_LIMIT_SECRET:"fixture-rate-limit",COMMERCE_EMAIL_MODE:"disabled"});
const user={id:"00000000-0000-4000-8000-000000000011",email:"fixture@example.invalid",email_confirmed_at:"2026-10-21T00:00:00Z",aud:"authenticated",role:"authenticated",app_metadata:{},user_metadata:{}};
const encode=value=>Buffer.from(JSON.stringify(value)).toString("base64url"),exp=Math.floor(Date.now()/1000)+3600;
const session={access_token:`${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:user.id,exp,role:"authenticated"})}.fixture`,refresh_token:"fixture-refresh",token_type:"bearer",expires_in:3600,expires_at:exp,user};
const project=new URL(local.PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookie=`sb-${project}-auth-token=base64-${encode(session)}`;
let active=false,verified=true,blocked=false;const calls=[];
globalThis.fetch=async(input,options)=>{
  const req=input instanceof Request?input:new Request(input,options),u=new URL(req.url);
  const body=req.method==="GET"?null:await req.json();calls.push({path:u.pathname,body});
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
  if(u.pathname==="/rest/v1/rpc/consume_rate_limit")return json(true);
  if(u.pathname==="/auth/v1/user")return json({...user,email_confirmed_at:verified?user.email_confirmed_at:null});
  if(u.pathname==="/rest/v1/rpc/get_account_email_preference")return json({active,verified,blocked,updatedAt:null});
  if(u.pathname==="/rest/v1/rpc/set_account_email_preference"){
    if(blocked&&body.p_accepted)return json({message:"EMAIL_BLOCKED"},400);
    active=body.p_accepted;return json({active,verified,blocked,updatedAt:new Date().toISOString()});
  }
  if(["/rest/v1/subscriptions","/rest/v1/reservations"].includes(u.pathname))return json([]);
  if(u.pathname==="/rest/v1/profiles")return json({id:user.id,email:user.email});
  throw Error(`Unexpected fixture ${u.pathname}`);
};
const {default:app}=await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
async function post(body,cookies=cookie,origin="https://imperioes.com"){
  return app.fetch(new Request("https://imperioes.com/api/account/email-preference",{method:"POST",headers:{cookie:cookies,Origin:origin},body:new URLSearchParams(body)}));
}
let r=await post({enabled:"yes",user_id:"forged",email:"someone@example.invalid"});assert.equal(r.status,303);assert.match(r.headers.get("location"),/comunicaciones=on/);assert.equal(r.headers.get("cache-control"),"private, no-store");
const choice=calls.find(c=>c.path.endsWith("set_account_email_preference")).body;assert.equal(choice.p_user,user.id);assert.equal(choice.p_accepted,true);assert.ok(choice.p_copy.includes("ofertas"));assert.equal(choice.p_copy_version,"2026-10-21");
r=await post({enabled:"no"});assert.match(r.headers.get("location"),/comunicaciones=off/);assert.equal(active,false);
const mutations=()=>calls.filter(c=>c.path.endsWith("set_account_email_preference")).length;
const before=mutations();
for(const [body,cookies,origin] of [[{enabled:"yes"},cookie,"https://foreign.invalid"],[{enabled:"yes"},"","https://imperioes.com"],[{enabled:"invalid"},cookie,"https://imperioes.com"]]){
  const result=await post(body,cookies,origin);assert.ok(result.status===403||result.headers.get("location")?.includes("comunicaciones=error"));
}assert.equal(mutations(),before);
verified=false;r=await post({enabled:"yes"});assert.match(r.headers.get("location"),/comunicaciones=error/);assert.equal(mutations(),before);verified=true;
blocked=true;r=await post({enabled:"yes"});assert.match(r.headers.get("location"),/comunicaciones=error/);assert.equal(active,false);blocked=false;
const first=await app.fetch(new Request("https://imperioes.com/newsletter")),html=await first.text();assert.equal(first.status,200);assert.equal(first.headers.get("cache-control"),"no-store");
assert.ok(html.includes("Suscribirme y recibir el PDF"));assert.ok(html.includes("Solo descargar el PDF, sin suscribirme"));assert.ok(html.includes('name="intent" value="newsletter_pdf"'));assert.ok(html.includes('name="email" type="email"'));assert.ok(!html.includes('name="firstName"'));
const second=await(await app.fetch(new Request("https://imperioes.com/newsletter"))).text();assert.notEqual(html.match(/name="requestId" value="([^"]+)/)?.[1],second.match(/name="requestId" value="([^"]+)/)?.[1]);
const account=await app.fetch(new Request("https://imperioes.com/cuenta",{headers:{cookie}}));assert.equal(account.status,200);assert.match(await account.text(),/aria-checked="false"/);
console.log("Compiled email preferences: verified server identity, CSRF, native POST, withdrawal/reactivation, failure states, no-JS newsletter, unique request IDs and account switch passed. No real network, email or payment.");

if(process.argv.includes("--serve")){
  const {createServer}=await import("node:http");const {resolve,sep}=await import("node:path");const {stat}=await import("node:fs/promises");
  process.env.PUBLIC_SITE_URL="http://127.0.0.1:4328";
  const roots=[resolve(".vercel/output/static"),resolve("public")];
  createServer(async(req,res)=>{try{
    const path=new URL(req.url,"http://127.0.0.1:4328").pathname;
    if(path.startsWith("/_astro/")||/\.(pdf|webp|png|avif|woff2|jpg|ico)$/.test(path)){
      for(const root of roots){const target=resolve(root,"."+decodeURIComponent(path));if(!target.startsWith(root+sep))continue;
        try{if(!(await stat(target)).isFile())continue;res.setHeader("Content-Type",path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".pdf")?"application/pdf":"application/octet-stream");res.end(readFileSync(target));return;}catch{}}
      res.writeHead(404).end();return;
    }
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const headers=new Headers(req.headers);headers.set("cookie",cookie);
    const response=await app.fetch(new Request("http://127.0.0.1:4328"+req.url,{method:req.method,headers,body:["GET","HEAD"].includes(req.method)?undefined:Buffer.concat(chunks)}));
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500).end("Fixture failed");}}).listen(4328,"127.0.0.1",()=>console.log("Isolated fixture: http://127.0.0.1:4328; no production credentials or real email."));
}
