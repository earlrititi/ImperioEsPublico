import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const origin=process.argv[2];
assert.match(origin??'',/^https:\/\/imperio-espa-ol-deploy-[a-z0-9]+-earlrititi-2806s-projects\.vercel\.app$/);
const e=parseEnv(readFileSync('.env.reservation-test.local','utf8'));
assert.equal(e.PUBLIC_SUPABASE_URL,'https://joicpkgvggfxzrdazisx.supabase.co');
const db=createClient(e.PUBLIC_SUPABASE_URL,e.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js');
const created=[];
const articleId=randomUUID();
const campaignId=randomUUID();
async function fixture(id){
  const existing=await db.auth.admin.getUserById(id);
  assert.ok(!existing.data.user,'Refuse to modify an existing Test user');
  const email=`preview-${id}@example.invalid`;
  const made=await db.auth.admin.createUser({id,email,email_confirm:true,...(id==='24f42701-98e0-4716-810c-363ae1cc8fa2'?{app_metadata:{editorial_admin:true}}:{})});
  assert.ifError(made.error);created.push(id);
  const link=await db.auth.admin.generateLink({type:'magiclink',email});assert.ifError(link.error);
  const auth=createClient(e.PUBLIC_SUPABASE_URL,e.PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const verified=await auth.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'});assert.ifError(verified.error);
  const encoded=Buffer.from(JSON.stringify(verified.data.session)).toString('base64url');
  return `sb-joicpkgvggfxzrdazisx-auth-token=base64-${encoded}`;
}
function request(path,cookie,body){
  // curl reads the short-lived fixture cookie from stdin, never from command arguments/logs.
  const config=`silent\nshow-error\nheader = "Cookie: ${cookie}"\nwrite-out = "\\n%{http_code}"\n`+
    (body?`header = "Content-Type: application/json"\nheader = "Origin: ${origin}"\ndata = ${JSON.stringify(JSON.stringify(body))}\n`:'');
  const output=execFileSync(process.execPath,[cli,'curl',origin+path,'--','--config','-'],{input:config,encoding:'utf8',stdio:['pipe','pipe','pipe'],windowsHide:true});
  const split=output.lastIndexOf('\n');return {status:Number(output.slice(split+1)),body:output.slice(0,split)};
}
try{
  const admin=await fixture('24f42701-98e0-4716-810c-363ae1cc8fa2');
  const normal=await fixture(randomUUID());
  for(const path of ['/admin','/admin/embudo','/admin/interacciones','/admin/suscripciones','/admin/correos','/admin/newsletter','/admin/articles','/admin/comercio']){
    const r=request(path,admin);assert.equal(r.status,200,path);assert.match(r.body,/Administracion/);assert.doesNotMatch(r.body,/sk_live_|service_role/);console.log(`Admin page verified: ${path}`);
  }
  for(const path of ['/api/admin/funnel','/api/admin/analytics','/api/admin/subscriptions','/api/admin/mail','/api/admin/newsletter','/api/admin/articles','/api/admin/overview']){
    assert.equal(request(path,admin).status,200,path);
    assert.equal(request(path,normal).status,403,`Normal user denied ${path}`);console.log(`Admin and non-admin API verified: ${path}`);
  }
  const mail={subject:'Preview draft only',preheader:'',content:'Test only: no email sent.',cta_label:'',cta_url:'',segment:'manifesto',requestId:campaignId};
  const mailSave=request('/api/admin/newsletter',admin,{...mail,action:'save',revision:0});assert.equal(mailSave.status,200);assert.equal(JSON.parse(mailSave.body).revision,1);
  const mailPreview=request('/api/admin/newsletter',admin,{...mail,action:'preview',revision:1});assert.equal(mailPreview.status,200);assert.equal(JSON.parse(mailPreview.body).revision,2);
  assert.equal(request('/api/admin/newsletter',admin,{...mail,action:'save',revision:1}).status,409);
  assert.equal(request('/api/admin/newsletter',normal,{...mail,action:'save',revision:2}).status,403);
  assert.equal((await db.from('email_logs').select('id').eq('campaign_id',campaignId)).data.length,0);
  console.log('Newsletter draft save, preview, stale revision and non-admin denial verified. No queued mail.');
  const draft={title:'Preview fixture',slug:`preview-${articleId}`,lead:'Test only',category:'Historia',author:'Test',imageSrc:'',imageAlt:'',imageCaption:'',publishedAt:'2026-10-08',seoTitle:'Preview fixture',description:'Test',body:'<h2>Heading</h2><script>alert(1)</script><p>Body</p>'};
  const saved=request('/api/admin/articles',admin,{action:'save',id:articleId,revision:0,draft});assert.equal(saved.status,200);
  assert.equal(JSON.parse(saved.body).revision,1);assert.doesNotMatch(JSON.parse(saved.body).draft.body,/<script>/);
  const preview=request('/api/admin/articles',admin,{action:'preview',draft});assert.equal(preview.status,200);assert.doesNotMatch(JSON.parse(preview.body).html,/<script>/);
  assert.equal(request('/api/admin/articles',normal,{action:'save',id:articleId,revision:1,draft}).status,403);
  assert.equal(request('/api/admin/articles',admin,{action:'save',id:articleId,revision:1,draft:{...draft,title:'Updated'}}).status,200);
  assert.equal(request('/api/admin/articles',admin,{action:'save',id:articleId,revision:1,draft}).status,409);
  console.log('Real Test draft save, preview sanitation, revision conflict and non-admin denial verified');
  assert.equal(request('/api/admin/articles',normal,{action:'publish',id:articleId,revision:2}).status,403);
  assert.equal(request('/api/admin/articles',admin,{action:'publish',id:articleId,revision:2}).status,200);
  const path='/papeles-y-tratados/'+draft.slug;
  const publicPage=request(path,'');assert.equal(publicPage.status,200);assert.match(publicPage.body,/Articulo para suscriptores/);assert.doesNotMatch(publicPage.body,/<p>Body<\/p>/);
  const adminPage=request(path,admin);assert.equal(adminPage.status,200);assert.match(adminPage.body,/<p>Body<\/p>/);
  const catalogue=request('/papeles-y-tratados','');assert.equal(catalogue.status,200);assert.ok(catalogue.body.includes(draft.slug));assert.doesNotMatch(catalogue.body,/<p>Body<\/p>/);
  assert.ok(request('/sitemap.xml','').body.includes(draft.slug));
  assert.ok(!request('/feed.xml','').body.includes(draft.slug));
  assert.equal(request('/api/admin/articles',admin,{action:'save',id:articleId,revision:3,draft:{...draft,body:'<p>UNPUBLISHED_SENTINEL</p>'}}).status,200);
  assert.doesNotMatch(request(path,admin).body,/UNPUBLISHED_SENTINEL/);
  assert.equal(request('/api/admin/articles',admin,{action:'publish',id:articleId,revision:3}).status,409);
  assert.equal(request('/api/admin/articles',admin,{action:'withdraw',id:articleId,revision:4}).status,200);
  assert.equal(request(path,'').status,404);assert.ok(!request('/sitemap.xml','').body.includes(draft.slug));
  assert.equal(request('/api/admin/articles',admin,{action:'delete',id:articleId,revision:5}).status,200);
  console.log('Publication, public catalogue, sitemap, premium protection, draft isolation and withdrawal verified in Preview.');
}finally{
  assert.ifError((await db.from('newsletter_campaigns').delete().eq('id',campaignId)).error);
  assert.ifError((await db.from('commerce_audit').delete().eq('entity','newsletter').eq('entity_id',campaignId)).error);
  assert.ifError((await db.from('cms_articles').delete().eq('id',articleId)).error);
  assert.ifError((await db.from('commerce_audit').delete().eq('entity','article').eq('entity_id',articleId)).error);
  for(const id of created){const deleted=await db.auth.admin.deleteUser(id);assert.ifError(deleted.error);}
  console.log('Temporary Test auth fixtures removed; production untouched. No emails or payments.');
}
