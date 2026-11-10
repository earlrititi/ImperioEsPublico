import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { APIContext } from "astro";
import { adminDashboardGet, adminDashboardExport, readDashboardPage, type DashboardDependencies } from "../src/lib/admin-communications";
import { communicationState, csvCell, dashboardQuery, inertMessage, safeMessageLink } from "../src/lib/communications-model";
import { syncMailboxPage, type MailboxConfiguration, type ReadOnlyImapTransport, type MailboxCommit } from "../src/lib/mailbox-sync";

test("provider acceptance, opens and clicks are never treated as confirmed delivery",()=>{
  assert.equal(communicationState("sent","accepted_by_provider"),"accepted_by_provider");
  assert.equal(communicationState("sent","opened"),"accepted_by_provider");
  assert.equal(communicationState("sent","clicked"),"accepted_by_provider");
  for(const state of ["delivered","bounced","complained","deferred","failed"]){
    assert.equal(communicationState("sent",state),state);
    assert.equal(communicationState("sent",state),state); // Replayed event is stable.
  }
  assert.equal(communicationState("pending",null,"2030-01-01",0),"scheduled");
  assert.equal(communicationState("suppressed",null),"unsubscribed");
  assert.equal(communicationState("recorded",null),"recorded");
});

test("message detail blocks scripts, forms, trackers, CSS, unsafe links and access secrets",()=>{
  const result=inertMessage(`<h1>Hola</h1><script>alert('x')</script><img src="https://tracker.example/pixel"><form action="https://attacker.example"><input name="password"></form><style>@import 'https://tracker.example'</style><p onclick="steal()">Texto</p><a href="https://imperioes.com/auth/verify?token=SECRET">Verificar</a><a href="https://imperioes.com/tienda?utm_source=test#tracked">Tienda</a><iframe src="https://attacker.example"></iframe>`,"https://imperioes.com/reset?token=top-secret token=TOPSECRET password=pass123");
  assert.match(result.html,/Hola/);assert.match(result.html,/Texto/);
  assert.doesNotMatch(result.html,/<script|<img|<form|<iframe|onclick|attacker\.example|tracker\.example|SECRET|href=/i);
  assert.doesNotMatch(result.text,/TOPSECRET|top-secret|pass123/);
  assert.match(result.html,/default-src 'none'/);
  assert.deepEqual(result.links,["https://imperioes.com/tienda"]);
  for(const url of ["javascript:alert(1)","http://imperioes.com","https://imperioes.com/reservas/gestionar#secret","https://u:p@imperioes.com/"])assert.equal(safeMessageLink(url),null);
});

test("message redaction handles decoded entities and credentials split across markup",()=>{
  for (const html of [
    "<p>token&#58; Abcdabcd1234XYZ</p>",
    "<p>to<b>ken:</b> <strong>Abcdabcd1234XYZ</strong></p>",
    "<p>password: <span>Abcdabcd1234XYZ</span></p>",
    "<p>https&#58;//example.test/access?value=Abcdabcd1234XYZ</p>",
  ]) {
    const result = inertMessage(`<h1>Mensaje conservado</h1>${html}<p>Texto posterior &amp; legible.</p>`);
    assert.doesNotMatch(result.html, /Abcdabcd1234XYZ/);
    assert.doesNotMatch(result.text, /Abcdabcd1234XYZ/);
    assert.match(result.html, /Mensaje conservado/);
    assert.match(result.html, /Texto posterior &amp; legible/);
    assert.match(result.html, /omitido/);
  }
  const plain = inertMessage("<p>Contenido <strong>seguro</strong> &amp; legible.</p>");
  assert.match(plain.html, /<strong>seguro<\/strong>/);
  assert.match(plain.text, /Contenido seguro & legible/);
  const escaped = inertMessage("<p>token&#58; ABC&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  assert.doesNotMatch(escaped.html, /<script|alert\(1\)/);
});

test("private searches validate filters and exports neutralise spreadsheet formulas",()=>{
  for(const query of ["page=-1","page=1.5","pageSize=10000","q=x),email.not.is.null","q=%25","state=unknown","source=unknown","direction=unknown","from=bad"]){assert.throws(()=>dashboardQuery(new URLSearchParams(query)));}
  assert.equal(dashboardQuery(new URLSearchParams("q=Prueba&state=bounced&page=2")).page,2);
  for(const value of ["=HYPERLINK(1)","+cmd","-cmd","@SUM(1)"," =cmd"]){assert.match(csvCell(value),/^"'/);}
});

function context(query=""):APIContext{return {url:new URL(`https://imperioes.com/api/admin/communications?${query}`),request:new Request("https://imperioes.com/api/admin/communications"),cookies:{}} as APIContext;}
function dependencies(guard:DashboardDependencies["guard"]):DashboardDependencies{
  const unreachable=async()=>{throw Error("PRIVATE_DATABASE_MUST_NOT_BE_READ");};
  return {guard,audit:unreachable,readPage:unreachable,coverage:unreachable,message:unreachable,contact:unreachable,totals:unreachable,canExport:()=>false};
}
test("all list, detail, coverage, totals and export requests enforce admin access before touching private data",async()=>{
  const deps=dependencies(async()=>{throw Error("FORBIDDEN");});
  for(const audience of [false,true]){
    for(const query of ["","detail=someone%40example.com","coverage=1","totals=1"]){const response=await adminDashboardGet(context(query),audience,deps);assert.equal(response.status,403);assert.equal((await response.json()).code,"FORBIDDEN");assert.match(response.headers.get("cache-control")??"",/no-store/);}
    assert.equal((await adminDashboardExport(context(),audience,deps)).status,403);
  }
});
test("private read access is audited and default export permission stays closed",async()=>{
  const audit:unknown[][]=[];const deps=dependencies(async()=>({id:"admin"} as any));
  deps.audit=async(...args)=>{audit.push(args);};deps.readPage=async()=>({items:[],total:0,page:0,pageSize:25});
  const result=await adminDashboardGet(context("q=private%40example.com"),true,deps);
  assert.equal(result.status,200);assert.equal((await result.json()).export_allowed,false);
  assert.equal(audit.length,1);assert.doesNotMatch(JSON.stringify(audit),/private@example\.com/);
  assert.equal((await adminDashboardExport(context(),true,deps)).status,403);
});

test("list filtering and pagination happen in the database, without requesting message bodies or tokens",async()=>{
  const calls:unknown[][]=[];const q:any={};
  for(const method of ["select","eq","contains","not","or","gte","lt","order","range"]){q[method]=(...args:unknown[])=>{calls.push([method,...args]);return q;};}
  q.then=(resolve:any)=>Promise.resolve({data:[],count:70,error:null}).then(resolve);
  const db={from:(...args:unknown[])=>{calls.push(["from",...args]);return q;}} as any;
  const page=await readDashboardPage(new URLSearchParams("page=2&pageSize=25&q=person&state=delivered&direction=outbound&source=commerce_outbox"),false,db);
  assert.equal(page.total,70);assert.ok(calls.some(c=>c[0]==="range"&&c[1]===50&&c[2]===74));
  assert.ok(calls.some(c=>c[0]==="eq"&&c[1]==="state"&&c[2]==="delivered"));
  assert.ok(calls.some(c=>c[0]==="or"&&String(c[1]).includes("sender.ilike.%person%")));
  const select=calls.find(c=>c[0]==="select");assert.doesNotMatch(String(select?.[1]),/body_html|provider_payload|token_hash|encrypted_message/);
});

test("inbound quick search includes the customer's sender address, while audience searches use contact fields",async()=>{
  const searches:string[]=[];const q:any={};
  for(const method of ["select","eq","contains","not","gte","lt","order","range"])q[method]=()=>q;
  q.or=(search:string)=>{searches.push(search);return q;};
  q.then=(resolve:any)=>Promise.resolve({data:[],count:0,error:null}).then(resolve);
  const db={from:()=>q} as any;
  await readDashboardPage(new URLSearchParams("direction=inbound&q=customer@example.test"),false,db);
  assert.match(searches[0], /sender\.ilike\.%customer@example\.test%/);
  await readDashboardPage(new URLSearchParams("q=customer@example.test"),true,db);
  assert.match(searches[1], /name\.ilike\.%customer@example\.test%/);
  assert.doesNotMatch(searches[1], /sender|subject|customer_name/);
});

const config:MailboxConfiguration={id:"00000000-0000-4000-8000-000000000001",mailbox:"INBOX",enabled:true,authorised_at:"2026-11-01",authorised_by:"00000000-0000-4000-8000-000000000002",import_since:"2026-10-01",retention_days:90};
test("unconnected mailbox is explicit and never performs a fake successful sync",async()=>{
  let commits=0;
  const result=await syncMailboxPage(config,{uidvalidity:null,last_uid:0},null,async()=>{commits++;});
  assert.equal(result.state,"not_connected");assert.equal(commits,0);
});
test("authorised mailbox batches are bounded, sanitised, header linked and use an optimistic incremental cursor",async()=>{
  const seen:MailboxCommit[]=[];const inputs:any[]=[];
  const transport:ReadOnlyImapTransport={tls:true,readOnly:true,readPage:async input=>{inputs.push(input);return {uidvalidity:77,lastUid:12,hasMore:false,deletedUids:[3],flagStateSynced:true,messages:[{uid:12,messageId:"<reply@example.test>",inReplyTo:"<sent@imperioes.com>",references:["<sent@imperioes.com>"],from:" PERSON@EXAMPLE.TEST ",to:["contacto@imperioes.com"],subject:"Respuesta",at:"2026-11-05T10:00:00Z",html:"<p>Gracias</p><script>danger()</script><img src='https://tracker.example'>",seen:false}]};}};
  const result=await syncMailboxPage(config,{uidvalidity:77,last_uid:11},transport,async batch=>{seen.push(batch);},new Date("2026-11-06T10:00:00Z"));
  assert.equal(result.synced,1);assert.equal(inputs[0].afterUid,11);assert.equal(inputs[0].limit,100);
  assert.equal(seen[0].expected_last_uid,11);assert.equal(seen[0].messages[0].sender,"person@example.test");assert.equal(seen[0].messages[0].in_reply_to,"<sent@imperioes.com>");
  assert.doesNotMatch(String(seen[0].messages[0].safe_html),/<script|<img|tracker\.example/);assert.equal(seen[0].messages[0].seen,false);
  const reset=await syncMailboxPage(config,{uidvalidity:76,last_uid:11},transport,async()=>assert.fail("must not commit a UIDVALIDITY reset"),new Date("2026-11-06T10:00:00Z"));assert.equal(reset.state,"reset_required");
  await assert.rejects(()=>syncMailboxPage({...config,authorised_at:null},{uidvalidity:null,last_uid:0},transport,async()=>{},new Date("2026-11-06")),/NOT_AUTHORISED/);
});

test("SQL read models retain suppressions, declined consents, verification states and source IDs behind service-only grants",()=>{
  const sql=readFileSync(new URL("../supabase/migrations/052_communications_read_models.sql",import.meta.url),"utf8");
  assert.match(sql,/group by s\.email/);assert.match(sql,/marketing_suppressed_contacts/);assert.match(sql,/pending_verification/);assert.match(sql,/no_consent/);assert.match(sql,/source_ids/);
  assert.match(sql,/customer_received_at/);assert.match(sql,/to_jsonb\(j\)->>'contact_email'/);assert.doesNotMatch(sql,/token_hash/);
  for(const view of ["admin_communication_records","admin_audience_contacts","admin_audience_timeline","admin_audience_totals"]){assert.match(sql,new RegExp(`revoke all on public\\.${view} from public,anon,authenticated`));}
  assert.match(sql,/distinct on \(case when provider_id is not null/);
  const ui=readFileSync(new URL("../src/components/admin/Communications.tsx",import.meta.url),"utf8");assert.match(ui,/sandbox=""/);assert.doesNotMatch(ui,/localStorage|sessionStorage|dangerouslySetInnerHTML/);
});
