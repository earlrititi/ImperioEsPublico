import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { ARTICLE_MEDIA_BUCKET, ARTICLE_MEDIA_KEY, prepareArticleImage } from "../src/lib/article-media.ts";
const env=parseEnv(readFileSync(".env.reservation-test.local","utf8"));
assert.equal(env.PUBLIC_SUPABASE_URL,"https://joicpkgvggfxzrdazisx.supabase.co");
Object.assign(process.env,{PUBLIC_SUPABASE_URL:env.PUBLIC_SUPABASE_URL,PUBLIC_SUPABASE_ANON_KEY:env.PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY,PUBLIC_SITE_URL:"https://imperioes.com",STRIPE_SECRET_KEY:"sk_test_disabled"});
if(process.argv.includes("--build")){
  const npm=join(process.env.NVM_SYMLINK??"C:/nvm4w/nodejs","node_modules/npm/bin/npm-cli.js");
  execFileSync(process.execPath,[npm,"run","build"],{env:process.env,stdio:["ignore","pipe","pipe"],windowsHide:true});
  console.log("Supabase Test artifact built. Rebuild with production public configuration before releasing.");
}
const originalFetch=globalThis.fetch;
let projectMismatch=false;
globalThis.fetch=(input,init)=>{const request=input instanceof Request?input:new Request(input,init);
  if(new URL(request.url).origin!==env.PUBLIC_SUPABASE_URL)projectMismatch=true;
  assert.equal(new URL(request.url).origin,env.PUBLIC_SUPABASE_URL,"Test transport must never reach another project or provider");return originalFetch(request);};
const db=createClient(env.PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const anon=createClient(env.PUBLIC_SUPABASE_URL,env.PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const key=`${randomUUID()}.webp`;assert.ok(ARTICLE_MEDIA_KEY.test(key));
let stored=false;
try{
  const source=await sharp({create:{width:64,height:48,channels:3,background:"red"}}).png().toBuffer();
  const image=await prepareArticleImage(source,"image/png");
  const uploaded=await db.storage.from(ARTICLE_MEDIA_BUCKET).upload(key,image.bytes,{contentType:"image/webp",upsert:false});
  if(uploaded.error)throw Error("Test image storage unavailable");stored=true;
  assert.ok((await anon.storage.from(ARTICLE_MEDIA_BUCKET).download(key)).error,"Private bucket must not expose direct anonymous downloads");
  const {default:app}=await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
  const response=await app.fetch(new Request(`https://imperioes.com/media/articles/${key}`));
  assert.equal(projectMismatch,false,"Compiled artifact is not configured for Supabase Test; build with Test public variables first");
  assert.equal(response.status,200);assert.equal(response.headers.get("content-type"),"image/webp");
  assert.match(response.headers.get("cache-control"),/immutable/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),image.bytes);
  const denied=await app.fetch(new Request("https://imperioes.com/api/admin/article-media",{method:"POST",headers:{Origin:"https://imperioes.com"}}));
  assert.equal(denied.status,403);
  console.log("Real Supabase Test image upload, private bucket, same-origin media response and anonymous admin denial passed. Synthetic image only.");
}finally{
  if(stored){const removed=await db.storage.from(ARTICLE_MEDIA_BUCKET).remove([key]);if(removed.error)throw Error("Test image cleanup requires review");}
  globalThis.fetch=originalFetch;
}
