import assert from 'node:assert/strict';import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';import {parseEnv} from 'node:util';
const project=JSON.parse(readFileSync('.vercel/project.json','utf8'));
assert.equal(project.projectId,'prj_sGnSgdWDmz3kzD8yHidTtA1US8DH');
if(process.argv.includes('--environment')){
  const {token}=JSON.parse(readFileSync(join(process.env.APPDATA,'com.vercel.cli/Data/auth.json'),'utf8'));
  const envs=Object.entries({RESERVATION_MODE:'false',SHIRT_SALES_APPROVED:'true',STRIPE_LIVE_CHECKOUT_ENABLED:'true'}).map(([key,value])=>({key,value,target:['production'],type:'encrypted'}));
  const response=await fetch(`https://api.vercel.com/v10/projects/${project.projectId}/env?teamId=${project.orgId}&upsert=true`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(envs)});
  assert.ok(response.ok);console.log('Production purchase flags enabled for the next deployment.');
}
if(process.argv.includes('--campaign')){
  const e=parseEnv(readFileSync('.env.reservation-production.local','utf8'));assert.equal(e.PUBLIC_SUPABASE_URL,'https://pjrqozlyrjgugdraoght.supabase.co');
  const file=join(mkdtempSync(join(tmpdir(),'imperio-shirt-open-')),'open.sql');
  writeFileSync(file,`begin;set local lock_timeout='5s';
    do $$ begin
      if not (select purchase_activated from public.commerce_campaign where id='shirt-first-edition') then
        update public.commerce_campaign set purchase_open_at=now(),max_reservation_quantity=null,updated_at=now() where id='shirt-first-edition';
        perform public.activate_shirt_campaign('24f42701-98e0-4716-810c-363ae1cc8fa2');
      end if;
    end $$;commit;select purchase_activated,purchase_open_at from public.commerce_campaign where id='shirt-first-edition';`);
  const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
  try{const result=execFileSync(process.execPath,[cli,'db','query','--linked','--project-ref','pjrqozlyrjgugdraoght','--file',file,'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true});const parsed=JSON.parse(result);assert.equal((parsed.rows??parsed)[0].purchase_activated,true);}
  catch{throw Error('Campaign activation failed; private diagnostics omitted');}
  console.log('Shirt campaign activated with audit. Existing reservation invitations can now be processed.');
}
process.exit(0);
