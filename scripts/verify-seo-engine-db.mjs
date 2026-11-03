import { readFileSync, writeFileSync, mkdtempSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const root = join(process.env.LOCALAPPDATA, "npm-cache", "_npx");
const cli = readdirSync(root).map(n => join(root, n, "node_modules", "@supabase", "cli-windows-x64", "bin", "supabase.exe")).filter(existsSync).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
assert.ok(cli, "Supabase CLI must be installed by npx supabase first");
const project = "pjrqozlyrjgugdraoght", apply = process.argv.includes("--apply");
function query(file, readOnly = false) {
  try { return execFileSync(cli, ["db", "query", `--remote=${project}`, "--file", file, ...(readOnly ? ["--read-only"] : ["--yes"]), "--output", "json"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { const stderr = String(e.stderr || ""); const error = /ERROR: ([^\n]+)/.exec(stderr)?.[1]; throw Error(`SEO SQL verification failed${error ? `: ${error.slice(0, 300)}` : "; private diagnostics omitted"}`); }
}
const temp = mkdtempSync(join(tmpdir(), "imperio-seo-sql-")), file = join(temp, "verification.sql");
const migrations = ["041_seo_engine", "042_seo_generation_versions", "043_seo_reopen_opportunity", "044_seo_scheduler"].map(name => ({ version: name.slice(0, 3), name, sql: readFileSync(`supabase/migrations/${name}.sql`, "utf8") }));
const tests = readFileSync("supabase/tests/041_seo_engine.sql", "utf8");
writeFileSync(file, "select version from supabase_migrations.schema_migrations where version in ('041','042','043','044');");
const state = JSON.parse(query(file, true)), applied = new Set((state.rows ?? state.result?.rows ?? []).map(r => r.version));
const missing = migrations.filter(m => !applied.has(m.version));
writeFileSync(file, `begin; set local lock_timeout='5s'; set local statement_timeout='60s';\n${missing.map(m => m.sql).join("\n")}\n${tests}\nrollback; select true as passed;`);
query(file);
console.log("SEO SQL: private grants, trusted actor, budget reservation, duplicate generation, concurrency lease, draft isolation, stale versions, editor bypass, exact approval, reviewer and notice idempotency passed. All fixtures rolled back.");
if (apply && missing.length) {
  writeFileSync(file, `begin; set local lock_timeout='5s'; set local statement_timeout='60s';\n${missing.map(m => `${m.sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${m.version}','${m.name}',array[$seo_migration$${m.sql}$seo_migration$]);`).join("\n")}\ncommit; select true as applied;`);
  query(file); console.log(`Migrations ${missing.map(m => m.version).join(", ")} applied. No article published or email sent.`);
}
