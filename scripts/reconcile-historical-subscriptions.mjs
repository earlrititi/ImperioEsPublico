import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import Stripe from 'stripe';
const e=parseEnv(readFileSync('.env.reservation-production.local','utf8'));
assert.equal(e.PUBLIC_SUPABASE_URL,'https://pjrqozlyrjgugdraoght.supabase.co');
assert.match(e.STRIPE_SECRET_KEY,/^(sk|rk)_live_/);
const stripe=new Stripe(e.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id,'acct_1UCc4cDRITvLIOKF');
const db=createClient(e.PUBLIC_SUPABASE_URL,e.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ids=['21db5a74-fe58-44fe-9efe-9dc3b9fb5c80','de100145-cc41-438c-a235-51524adf6c07','c7ebb831-ca3a-4308-90d1-f5ef2fa222d9'];
const actor='24f42701-98e0-4716-810c-363ae1cc8fa2';
const {data:rows,error}=await db.from('subscriptions').select('*').in('id',ids);assert.ifError(error);assert.equal(rows.length,3);
for(const r of rows){
  assert.equal(r.user_id,actor);assert.equal(r.email,'earlrititi@gmail.com');
  assert.ok(['active','legacy_unverified'].includes(r.status));assert.ok(Date.parse(r.current_period_end)<Date.now());
  await assert.rejects(stripe.subscriptions.retrieve(r.stripe_subscription_id),err=>err.code==='resource_missing');
}
console.log('Verified three expired historical records absent from current Live Stripe account. No Stripe mutations.');
if(process.argv.includes('--apply')){
  const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
  const file=join(mkdtempSync(join(tmpdir(),'imperio-reconcile-')),'reconcile.sql');
  const values=rows.map(r=>`('${r.id}'::uuid,'${r.stripe_subscription_id.replaceAll("'","''")}','${r.updated_at}'::timestamptz)`).join(',');
  writeFileSync(file,`begin;set local lock_timeout='5s';
    do $$ declare r record; affected integer; begin
      for r in select * from (values ${values}) as expected(id,stripe_id,updated) loop
        if exists(select 1 from public.subscriptions where id=r.id and status='legacy_unverified') then continue; end if;
        update public.subscriptions set status='legacy_unverified',updated_at=now()
          where id=r.id and stripe_subscription_id=r.stripe_id and updated_at=r.updated and status='active'
          and user_id='${actor}' and current_period_end<now();
        get diagnostics affected=row_count;
        if affected<>1 then raise exception 'RECONCILIATION_CONFLICT'; end if;
        insert into public.commerce_audit(actor_id,entity_id,entity,action)
          values('${actor}',r.id,'subscription','LEGACY_ACTIVE_TO_UNVERIFIED_CURRENT_ACCOUNT_MISSING');
      end loop;
    end $$;commit;select count(*) as archived from public.subscriptions where id in (${ids.map(id=>`'${id}'`).join(',')}) and status='legacy_unverified';`);
  try{const result=execFileSync(process.execPath,[cli,'db','query','--linked','--project-ref','pjrqozlyrjgugdraoght','--file',file,'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true});const parsed=JSON.parse(result);assert.equal((parsed.rows??parsed)[0].archived,3);}
  catch{throw new Error('Reconciliation failed; private diagnostics omitted');}
  console.log('Three historical records archived with audit. No payments, cancellations, or mail.');
}
process.exit(0);
