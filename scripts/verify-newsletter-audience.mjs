import assert from 'node:assert/strict';import {readdirSync} from 'node:fs';import {Socket} from 'node:net';
Socket.prototype.connect=()=>{throw Error('Real network prohibited');};
Object.assign(process.env,{PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',STRIPE_SECRET_KEY:'sk_test_fixture'});
const tables={subscriptions:[],profiles:[],legal_consents:[],
 reservations:[{id:'1',customer_email:'shirt@example.invalid',status:'CONVERTED_TO_ORDER',marketing_consent:true},{id:'2',customer_email:'not-consented@example.invalid',status:'RESERVED',marketing_consent:false},{id:'3',customer_email:'withdrawn@example.invalid',status:'RESERVED',marketing_consent:true,marketing_withdrawn_at:'2026-01-01'}],
 manifesto_requests:[{id:'1',email:'manifesto@example.invalid',status:'accepted',marketing_consent:true},{id:'2',email:'resource-only@example.invalid',status:'accepted',marketing_consent:false},{id:'3',email:'failed@example.invalid',status:'failed',marketing_consent:true}],
 marketing_leads:[{id:'1',email:'lead@example.invalid',marketing_accepted_at:'2026-01-01'},{id:'2',email:'unsubscribed@example.invalid',marketing_accepted_at:'2026-01-01'}],email_suppressions:[{email:'unsubscribed@example.invalid'}]};
globalThis.fetch=async(input,options)=>{const r=input instanceof Request?input:new Request(input,options);const key=new URL(r.url).pathname.split('/').at(-1);assert.ok(key in tables,`Unexpected fixture ${key}`);return new Response(JSON.stringify(tables[key]),{headers:{'Content-Type':'application/json'}});};
const dir=new URL('../.vercel/output/functions/_render.func/dist/server/chunks/',import.meta.url);const name=readdirSync(dir).find(n=>n.startsWith('newsletter-audience_')&&n.endsWith('.mjs'));assert.ok(name);
const exports=await import(new URL(name,dir));const audience=Object.values(exports).find(f=>typeof f==='function'&&f.name==='newsletterAudience');assert.ok(audience);
for(const [segment,expected]of [['shirts',['shirt@example.invalid']],['manifesto',['manifesto@example.invalid']],['leads',['lead@example.invalid']],['all',['shirt@example.invalid','manifesto@example.invalid','lead@example.invalid']]]){
 const result=await audience(segment);assert.deepEqual(result.recipients.sort(),expected.sort());
}
console.log('Compiled newsletter consent, completed orders, resource-only exclusion, failed requests and withdrawals verified. No network or email.');
