import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {isBuiltin} from 'node:module';
const dir='.vercel/output/functions/_render.func/dist/server/chunks';
const bundles=readdirSync(dir).filter(name=>/^articles_.*\.mjs$/.test(name));
assert.ok(bundles.length,'Compiled CMS endpoint missing');
for(const name of bundles){
  const code=readFileSync(join(dir,name),'utf8');
  for(const match of code.matchAll(/__require\("([^"]+)"\)/g))assert.ok(isBuiltin(match[1]),`Untraced CMS dependency: ${match[1]}`);
  assert.doesNotMatch(code,/from ["']sanitize-html["']/);
}
console.log('CMS sanitizer bundled; runtime require calls restricted to Node built-ins.');
