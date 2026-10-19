import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import { AUTOMATION_DEFAULTS, validateAutomationDraft } from "../src/lib/email-automations.ts";

const project="pjrqozlyrjgugdraoght", actor="24f42701-98e0-4716-810c-363ae1cc8fa2";
assert.equal(readFileSync("supabase/.temp/project-ref","utf8").trim(),project);
const cli=join(process.env.LOCALAPPDATA,"npm-cache/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-windows-x64/bin/supabase.exe");
const file=join(mkdtempSync(join(tmpdir(),"imperio-marketing-approval-")),"approval.sql");
function query(sql){
  writeFileSync(file,sql);
  try{const result=JSON.parse(execFileSync(cli,["db","query","--linked","--project-ref",project,"--file",file,"--output","json"],
    {encoding:"utf8",stdio:["ignore","pipe","pipe"],windowsHide:true}));return result.rows??result;}
  catch{throw Error("Marketing approval SQL unavailable; private output omitted");}
}
const verified=query(`select exists(select 1 from auth.users where id='${actor}' and email='earlrititi@gmail.com'
  and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<now())) as owner`)[0];
assert.equal(verified.owner,true,"Confirmed owner identity required");
const stored=query("select key,steps,revision from public.marketing_automation_drafts");
const definitions=AUTOMATION_DEFAULTS.filter(item=>item.key!=="placed_order").map(item=>{
  const row=stored.find(row=>row.key===item.key);
  return row?{...item,steps:validateAutomationDraft(item.key,row.steps),revision:row.revision}:item;
});
const digest=createHash("sha256").update(JSON.stringify(definitions)).digest("hex");
const proof=query(`select id,total,stripe_checkout_session_id from public.commerce_orders
  where total>0 and paid_at is not null and status not in ('CANCELLED','REFUNDED')
    and stripe_checkout_session_id like 'cs_live_%' order by paid_at desc limit 1`)[0];
assert.ok(proof,"A canonical paid Live order is required");
const env=parseEnv(readFileSync(".env.reservation-production.local","utf8"));
assert.equal(env.PUBLIC_SUPABASE_URL,`https://${project}.supabase.co`);
assert.match(env.STRIPE_SECRET_KEY,/^(sk|rk)_live_/);
const stripe=new Stripe(env.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id,"acct_1UCc4cDRITvLIOKF");
const session=await stripe.checkout.sessions.retrieve(proof.stripe_checkout_session_id,{expand:["payment_intent.latest_charge"]});
assert.ok(session.livemode&&session.status==="complete"&&session.payment_status==="paid"&&session.mode==="payment");
assert.equal(session.amount_total,proof.total);assert.equal(session.currency,"eur");
const intent=session.payment_intent,charge=intent?.latest_charge;
assert.ok(intent&&typeof intent!=="string"&&intent.status==="succeeded"&&intent.livemode);
assert.equal(intent.amount_received,proof.total);
assert.ok(charge&&typeof charge!=="string"&&charge.paid&&charge.captured&&!charge.refunded&&!charge.disputed&&charge.amount_refunded===0);
assert.equal(charge.amount,proof.total);
console.log(JSON.stringify({project,ownerVerified:true,paidLiveProofVerified:true,series:definitions.length,
  messages:definitions.reduce((n,item)=>n+item.steps.length,0),historicalEnrollment:false,activate:process.argv.includes("--activate")}));
if(process.argv.includes("--activate")){
  query(`begin;set local lock_timeout='5s';
    update public.marketing_automation_runtime set enabled=true,approved_by='${actor}',approved_at=now(),
      template_digest='${digest}',purchase_proof_id='${proof.id}',enrollment_starts_at=coalesce(enrollment_starts_at,now()),last_user_id=null where id=true;
    insert into public.commerce_audit(actor_id,entity_id,entity,action)
      values('${actor}','${proof.id}','email_automation','PROSPECTIVE_ACTIVATION_OWNER_APPROVED_CLI');
    commit;select true as approved;`);
}
const state=query(`select enabled,enrollment_starts_at,template_digest='${digest}' as approved_templates,
  (select count(*) from public.marketing_automation_enrolled_subjects) as enrolled,
  (select count(*) from public.marketing_automation_jobs) as jobs from public.marketing_automation_runtime where id=true`)[0];
console.log(JSON.stringify(state));
console.log("Only Stripe GET operations and explicit configuration approval. No charge, customer email or historical enrollment.");
