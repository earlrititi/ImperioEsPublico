import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
const project='pjrqozlyrjgugdraoght';
const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const file=join(mkdtempSync(join(tmpdir(),'imperio-admin-production-')),'migration.sql');
function query(sql){
  writeFileSync(file,sql);
  try {const output=JSON.parse(execFileSync(process.execPath,[cli,'db','query','--linked','--project-ref',project,'--file',file,'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}));return output.rows??output;}
  catch{throw new Error('Production SQL failed; no private diagnostics logged');}
}
const applied=query('select version from supabase_migrations.schema_migrations order by version');
for(const version of ['016','017','018','019'])assert.ok(applied.some(row=>row.version===version),`Missing prerequisite ${version}`);
const pending=readdirSync('supabase/migrations').filter(name=>/^02[0-4]_.*\.sql$/.test(name)&&!applied.some(row=>row.version===name.slice(0,3))).sort();
console.log(JSON.stringify({project,pending,apply:process.argv.includes('--apply')}));
if(process.argv.includes('--apply')&&pending.length){
  const statements=pending.map(name=>{
    const body=readFileSync(join('supabase/migrations',name),'utf8');
    assert.ok(!body.includes('$admin_migration$'));
    return `${body}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${name.slice(0,3)}','${name.slice(4,-4)}',array[$admin_migration$${body}$admin_migration$]);`;
  });
  query(`begin;set local lock_timeout='5s';${statements.join('\n')}\ncommit;select true as applied;`);
  console.log('Admin migrations applied atomically. Existing reservations, subscriptions and inventory unchanged.');
}
