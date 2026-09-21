import { readFileSync, readdirSync, cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const env=parseEnv(readFileSync('.env.reservation-production.local','utf8'));
assert.equal(env.RESERVATION_MODE,'true');assert.equal(env.SHIRT_SALES_APPROVED,'false');
assert.equal(env.STRIPE_LIVE_CHECKOUT_ENABLED,'false');
const secrets=['SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY','RESERVATION_TOKEN_SECRET','COMMERCE_JOB_SECRET'].map(k=>env[k]).filter(v=>v?.length>15);
function inspect(path){for(const entry of readdirSync(path,{withFileTypes:true})){
 const file=join(path,entry.name);if(entry.isDirectory())inspect(file);
 else if(/\.(js|html|json|css)$/.test(file)){const text=readFileSync(file,'utf8');assert.ok(!secrets.some(s=>text.includes(s)),`Private credential in public artifact: ${entry.name}`);assert.ok(!text.includes('joicpkgvggfxzrdazisx.supabase.co'),'Test backend in production artifact');}
}}
inspect('.vercel/output/static');
const release=mkdtempSync(join(tmpdir(),'imperio-reservations-release-'));
mkdirSync(join(release,'.vercel'));
cpSync('.vercel/output',join(release,'.vercel/output'),{recursive:true});
cpSync('.vercel/project.json',join(release,'.vercel/project.json'));
writeFileSync('.codex-reservation-release/staged-directory.txt',release);
console.log(`Staging verified production artifact from ${release}`);
const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/0da89b8b7bd584d8/node_modules/vercel/dist/index.js');
execFileSync(process.execPath,[cli,'deploy','--prebuilt','--prod','--skip-domain','--yes'],{cwd:release,stdio:'inherit',windowsHide:true});
