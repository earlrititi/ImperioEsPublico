import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const project='prj_sGnSgdWDmz3kzD8yHidTtA1US8DH',team='team_hQezVofPx29szeDrLNPRsFhI';
const env=parseEnv(readFileSync('.env.reservation-production.local','utf8'));
assert.equal(env.PUBLIC_SITE_URL,'https://imperioes.com');assert.equal(env.PUBLIC_SUPABASE_URL,'https://pjrqozlyrjgugdraoght.supabase.co');
assert.equal(env.RESERVATION_MODE,'true');assert.equal(env.SHIRT_SALES_APPROVED,'false');assert.equal(env.STRIPE_LIVE_CHECKOUT_ENABLED,'false');
const linked=JSON.parse(readFileSync('.vercel/project.json','utf8'));assert.equal(linked.projectId,project);assert.equal(linked.orgId,team);
const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/0da89b8b7bd584d8/node_modules/vercel/dist/index.js');
const api=(path,method='GET',body)=>{
 const args=[cli,'api',`${path}?teamId=${team}`,'--raw','-X',method];if(body)args.push('--input','-');
 if(method==='DELETE')args.push('--dangerously-skip-permissions');
 const r=spawnSync(process.execPath,args,{input:body?JSON.stringify(body):undefined,encoding:'utf8',timeout:90000,windowsHide:true});
 if(r.status!==0){
   let diagnostic=(r.stderr||r.stdout||'').slice(-1400);
   for(const value of Object.values(env).filter(v=>v.length>5))diagnostic=diagnostic.replaceAll(value,'[REDACTED]');
   console.error(diagnostic);throw new Error(`VERCEL_${method}_FAILED`);
 }
 const data=JSON.parse(r.stdout||'{}');if(data.error||data.errors?.length)throw new Error('VERCEL_ENV_REJECTED');return data;
};
const configKeys=['PUBLIC_SITE_URL','PUBLIC_SUPABASE_URL','PUBLIC_SUPABASE_ANON_KEY','RESERVATION_MODE','RESERVATION_EXPIRATION_HOURS','SHIRT_SALES_APPROVED','STRIPE_LIVE_CHECKOUT_ENABLED','COMMERCE_EMAIL_MODE','RESEND_FROM_EMAIL','MANIFESTO_FROM_EMAIL'];
const secretKeys=['SUPABASE_SERVICE_ROLE_KEY','RESERVATION_TOKEN_SECRET','COMMERCE_JOB_SECRET','RATE_LIMIT_SECRET','RESEND_API_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'];
try {
 const before=api(`/v9/projects/${project}/env`).envs;assert.ok(Array.isArray(before));
 writeFileSync(`.codex-reservation-release/vercel-env-before-${Date.now()}.json`,JSON.stringify(before),{mode:0o600});
 console.log(JSON.stringify({target:'production',apply:process.argv.includes('--apply'),changes:[...configKeys,...secretKeys],existingTypes:before.filter(e=>e.target?.includes('production')).map(e=>({key:e.key,type:e.type}))}));
 if(!process.argv.includes('--apply'))process.exit(0);
 for(const key of [...configKeys,...secretKeys]){
   const value=env[key];assert.ok(value&&value!=='[SENSITIVE]',`Missing real value for ${key}`);
   const matches=before.filter(e=>e.key===key&&e.target?.includes('production')&&!e.gitBranch);assert.ok(matches.length<=1);
   const old=matches[0],type=configKeys.includes(key)?'plain':'sensitive';
   const remaining=old?.target.filter(t=>t!=='production')??[];
   if(old&&(remaining.length||old.customEnvironmentIds?.length)){
     api(`/v10/projects/${project}/env/${old.id}`,'PATCH',{target:remaining});
     try{api(`/v10/projects/${project}/env`,'POST',{key,value,type,target:['production']});}
     catch(error){api(`/v10/projects/${project}/env/${old.id}`,'PATCH',{target:old.target});throw error;}
   }else if(old&&old.type==='sensitive'&&type!=='sensitive'){
     api(`/v9/projects/${project}/env/${old.id}`,'DELETE');
     try{api(`/v10/projects/${project}/env`,'POST',{key,value,type,target:['production']});}
     catch(error){api(`/v10/projects/${project}/env`,'POST',{key,value,type:old.type,target:['production']});throw error;}
   }else if(old)api(`/v10/projects/${project}/env/${old.id}`,'PATCH',{value,type,target:['production']});
   else api(`/v10/projects/${project}/env`,'POST',{key,value,type,target:['production']});
   console.log(`${key}: Production configured`);
 }
 console.log('Production reservation configuration saved; Preview/Test unchanged.');
}catch(error){console.error(JSON.stringify({configured:false,code:error.code??error.message}));process.exitCode=1;}
