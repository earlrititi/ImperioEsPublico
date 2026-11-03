import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";

for (const file of [".env.local", ".env.admin-production.local", ".env.reservation-test.local"]) {
  if (!existsSync(file)) continue;
  const env = parseEnv(readFileSync(file, "utf8"));
  console.log(file, JSON.stringify(Object.fromEntries(Object.keys(env).filter(k => /AI|OPENAI|GEMINI|RESEND|SUPABASE|GOOGLE|GA4|COMMERCE_JOB/.test(k)).map(k => [k, Boolean(env[k])]))));
}
