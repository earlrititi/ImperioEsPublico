import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve} from 'node:path';
const file='.env.reservation-test.local',env=parseEnv(readFileSync(file,'utf8'));
if(env.SUPABASE_TEST_PROJECT_REF!=='joicpkgvggfxzrdazisx')throw new Error('Unsafe target');
const cli=resolve(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const apply=process.argv.includes('--apply');
execFileSync(process.execPath,[cli,'config',apply?'push':'diff','--project-ref',env.SUPABASE_TEST_PROJECT_REF,'--workdir','test-environment'],{stdio:'inherit'});
if(apply){env.PUBLIC_SITE_URL='http://127.0.0.1:4323';writeFileSync(file,Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600});}
