import test from "node:test";
import assert from "node:assert/strict";
import {validFunnel,summarizeFunnel,type FunnelRun} from "../src/lib/funnel";
import {readFileSync} from "node:fs";
test("funnel input rejects personal payloads and private or parameterized URLs",()=>{
  const valid={id:"11111111-1111-4111-8111-111111111111",flow:"subscriptions",step:4,page:"/checkout/arcabucero-annual"};
  assert.equal(validFunnel(valid),true);
  for(const page of ["/admin","/cuenta","/reservas/gestionar","/reservas?email=x@y.com","/reservas#token","/checkout/arbitrary"]){assert.equal(validFunnel({...valid,page}),false);}
  for(const step of [-1,5,1.5,"4"]){assert.equal(validFunnel({...valid,step}),false);}
  assert.equal(validFunnel({...valid,email:"x@y.com"}),false);
  assert.equal(validFunnel({...valid,flow:"__proto__"}),false);
});
test("funnel attrition uses one cohort, ignores incomplete stage paths and excludes recent sessions",()=>{
  const now=Date.parse("2026-10-09T12:00:00Z");
  const row=(id:string,stages:number[],recent=false):FunnelRun=>({id,flow:"subscriptions",stages,created_at:"2026-10-09T10:00:00Z",last_seen_at:recent?"2026-10-09T11:59:00Z":"2026-10-09T10:30:00Z"});
  const f=summarizeFunnel([row("a",[0]),row("b",[0,1]),row("c",[0,1,2,3,4]),row("d",[0,1],true),row("e",[0,4])],now).find(f=>f.flow==="subscriptions")!;
  assert.deepEqual(f.stages.map(s=>s.count),[5,3,1,1,1]);
  assert.equal(f.inProgress,1);assert.equal(f.stages[0].lost,1);assert.equal(f.stages[1].lost,1);
  assert.equal(f.incompletePaths,1);
  assert.equal(f.stages[4].count,1);assert.equal(f.largest?.label,"Entrada");
  assert.equal(f.stages[4].lost,0,"The terminal step is never an abandonment");
});

test("commercial diagnosis reuses cohort rules and includes newsletter without inventing missing stages",()=>{
  const script=readFileSync(new URL("../scripts/audit-commercial.mjs",import.meta.url),"utf8");
  assert.match(script,/summarizeFunnel\(flows, asOf\)/);
  const now=Date.parse("2026-10-22T12:00:00Z");
  const results=summarizeFunnel([{id:"a",flow:"newsletter",stages:[0,4],created_at:"2026-10-22T10:00:00Z",last_seen_at:"2026-10-22T10:00:00Z"}],now);
  const newsletter=results.find(item=>item.flow==="newsletter")!;
  assert.equal(newsletter.incompletePaths,1);
  assert.equal(newsletter.largest,null);
  assert.equal(newsletter.stages[4].lost,0);
  assert.equal(newsletter.stages[4].count,0);
});

test("noindex is not a consent or funnel exclusion and tall forms can become visible",()=>{
  const layout=readFileSync(new URL("../src/layouts/Layout.astro",import.meta.url),"utf8");
  const tracker=readFileSync(new URL("../src/components/FunnelTracker.astro",import.meta.url),"utf8");
  assert.doesNotMatch(layout,/!noindex\s*&&\s*<FunnelTracker/);
  assert.match(tracker,/threshold:0\.01/);
  assert.match(tracker,/FUNNEL_PAGES\.test\(location.pathname\)/);
});
test("newsletter scheduler includes mail-only queues and analytics retention",()=>{
  const sql=readFileSync(new URL("../supabase/migrations/028_funnel_newsletter.sql",import.meta.url),"utf8");
  assert.match(sql,/public\.email_logs where status='pending'/);
  assert.match(sql,/delete from public\.funnel_runs where created_at<now\(\)-interval '90 days'/);
  assert.match(sql,/revoke all on function public\.record_funnel_step/);
});
