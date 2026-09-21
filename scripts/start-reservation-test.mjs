import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';
const env=parseEnv(readFileSync('.env.reservation-test.local','utf8'));
if(env.PUBLIC_SUPABASE_URL!=='https://joicpkgvggfxzrdazisx.supabase.co'||env.RESERVATION_MODE!=='true'||env.STRIPE_LIVE_CHECKOUT_ENABLED!=='false')throw new Error('Unsafe test environment');
execFileSync(process.execPath,['node_modules/astro/bin/astro.mjs','dev','--background','--host','127.0.0.1','--port','4323','--mode','reservation-test'],{env:{...process.env,...env},stdio:'inherit',windowsHide:true});
