import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";

const cli = resolve(process.env.LOCALAPPDATA, "npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js");
const run = (args) => JSON.parse(execFileSync(process.execPath, [cli, ...args, "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const org = "thbwmudmggnyxgoilzpi";
const name = "ImperioE Test";
try {
  const projects = run(["projects", "list"]);
  let project = projects.find(p => p.name === name && p.organization_id === org);
  const credentialsFile = ".env.reservation-test.local";
  const saved = existsSync(credentialsFile) ? parseEnv(readFileSync(credentialsFile, "utf8")) : {};
  if (!project) {
    if (!process.argv.includes("--create")) throw new Error("Test project missing; use --create only with owner authorization.");
    saved.SUPABASE_TEST_DB_PASSWORD = randomBytes(32).toString("hex");
    writeFileSync(credentialsFile, Object.entries(saved).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join("\n") + "\n", { mode: 0o600 });
    project = run(["projects", "create", name, "--org-id", org, "--region", "eu-north-1", "--db-password", saved.SUPABASE_TEST_DB_PASSWORD]);
  }
  const ref = project.id ?? project.ref;
  if (!ref || ref === "pjrqozlyrjgugdraoght") throw new Error("Unsafe project target");
  saved.SUPABASE_TEST_PROJECT_REF = ref;
  saved.PUBLIC_SUPABASE_URL = `https://${ref}.supabase.co`;
  saved.RESERVATION_MODE = "true";
  saved.STRIPE_LIVE_CHECKOUT_ENABLED = "false";
  saved.COMMERCE_EMAIL_MODE = "disabled";
  saved.RESERVATION_TOKEN_SECRET ||= randomBytes(32).toString("hex");
  saved.RATE_LIMIT_SECRET ||= randomBytes(32).toString("hex");
  writeFileSync(credentialsFile, Object.entries(saved).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join("\n") + "\n", { mode: 0o600 });
  const keys = run(["projects", "api-keys", "--project-ref", ref]);
  saved.PUBLIC_SUPABASE_ANON_KEY = keys.find(k => k.name === "anon")?.api_key;
  saved.SUPABASE_SERVICE_ROLE_KEY = keys.find(k => k.name === "service_role")?.api_key;
  if (!saved.PUBLIC_SUPABASE_ANON_KEY || !saved.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Project keys not ready; rerun later.");
  writeFileSync(credentialsFile, Object.entries(saved).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join("\n") + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ project: name, ref, credentialsStored: true, productionChanged: false }));
} catch (error) {
  // CLI diagnostics can contain credentials: never forward their payload.
  console.error("Test provisioning did not finish.", error.status ? `CLI status ${error.status}` : error.message);
  process.exitCode = 1;
}
