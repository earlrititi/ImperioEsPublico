import { readFileSync, openSync, closeSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const env = parseEnv(readFileSync(".env.reservation-test.local", "utf8"));
if (env.PUBLIC_SUPABASE_URL !== "https://joicpkgvggfxzrdazisx.supabase.co" || !/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? "")) throw Error("ISOLATED_TEST_ENVIRONMENT_REQUIRED");
const port = 4327;
const probe = createServer();
await new Promise((resolve,reject) => probe.once("error",reject).listen(port,"127.0.0.1",resolve));
await new Promise(resolve => probe.close(resolve));
mkdirSync("tmp/commercial-preview",{recursive:true});
const stdout = openSync("tmp/commercial-preview/server.log","a");
const child = spawn(process.execPath,["node_modules/astro/bin/astro.mjs","dev","--host","127.0.0.1","--port",String(port),"--mode","reservation-test"],{
  env:{...process.env,...env,PUBLIC_SITE_URL:`http://127.0.0.1:${port}`,COMMERCE_EMAIL_MODE:"disabled",RESERVATION_MODE:"false",SHIRT_SALES_APPROVED:"true",STRIPE_LIVE_CHECKOUT_ENABLED:"false",PUBLIC_GOOGLE_TAG_ID:"G-VDMP7TKMNY",PUBLIC_GTM_ID:"GTM-5VRFG7ZT"},
  detached:true,windowsHide:true,stdio:["ignore",stdout,stdout],
});
child.unref();closeSync(stdout);
console.log(JSON.stringify({url:`http://127.0.0.1:${port}`,pid:child.pid,mode:"test",mail:"disabled",productionChanged:false}));
