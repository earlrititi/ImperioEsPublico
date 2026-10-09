import assert from 'node:assert/strict';import {readdirSync} from 'node:fs';import {Socket} from 'node:net';
Socket.prototype.connect=()=>{throw Error('Real network prohibited');};
Object.assign(process.env,{PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',RESEND_API_KEY:'fixture',COMMERCE_EMAIL_MODE:'test'});
const states=['delivered','bounced','complained','opened','clicked'];const updates=[],suppressed=[];
globalThis.fetch=async(input,options)=>{
 const r=input instanceof Request?input:new Request(input,options);const u=new URL(r.url);
 let data;if(u.pathname==='/rest/v1/email_logs'&&r.method==='GET')data=states.map((_,i)=>({id:String(i),recipient:`test${i}@example.invalid`,provider_message_id:String(i)}));
 else if(u.hostname==='api.resend.com'&&r.method==='GET')data={last_event:states[Number(u.pathname.split('/').at(-1))]};
 else if(u.pathname==='/rest/v1/email_logs'&&r.method==='PATCH'){updates.push(await r.json());data=null;}
 else if(u.pathname==='/rest/v1/email_suppressions'&&r.method==='POST'){suppressed.push(await r.json());data=null;}
 else throw Error(`Unexpected fixture ${r.method} ${u.pathname}`);
 return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
};
const dir=new URL('../.vercel/output/functions/_render.func/dist/server/chunks/',import.meta.url);const file=readdirSync(dir).find(n=>n.startsWith('admin-mail_')&&n.endsWith('.mjs'));assert.ok(file);
const mod=await import(new URL(file,dir));const reconcile=Object.values(mod).find(f=>typeof f==='function'&&f.name==='reconcileAdminDelivery');assert.ok(reconcile);
assert.equal((await reconcile(10)).checked,5);assert.deepEqual(updates.map(u=>u.delivery_status),['delivered','bounced','complained','delivered','delivered']);
assert.deepEqual(suppressed.map(s=>s.reason),['provider_bounced','provider_complained']);
process.env.COMMERCE_EMAIL_MODE='disabled';assert.equal((await reconcile()).disabled,true);assert.equal(updates.length,5);
console.log('Provider receipts, delivery persistence and bounce/complaint suppression verified. No messages sent.');
