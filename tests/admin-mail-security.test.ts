import test from "node:test";
import assert from "node:assert/strict";
import { mailApproval, verifyMailApproval, readUnsubscribeToken, unsubscribeToken, drainAdminMail, isMailSuppressed,reconcileAdminDelivery } from "../src/lib/admin-mail";

test("send-time suppression honors late withdrawals and fails closed",async()=>{
  type Result = {data: Array<{id?: string; email?: string}>; error?: object};
  const results: Record<string,Result> = {};
  const filters: unknown[][] = [];
  const db = {from(table: string) {
    const query = {
      select() {return query;}, limit() {return query;},
      eq(...args: unknown[]) {filters.push([table,"eq",...args]);return query;},
      ilike(...args: unknown[]) {filters.push([table,"ilike",...args]);return query;},
      not(...args: unknown[]) {filters.push([table,"not",...args]);return query;},
      in(...args: unknown[]) {filters.push([table,"in",...args]);return query;},
      then(resolve: (value: Result)=>unknown) {return Promise.resolve(results[table] ?? {data:[]}).then(resolve);},
    };
    return query;
  }} as unknown as Parameters<typeof isMailSuppressed>[0];
  assert.equal(await isMailSuppressed(db," A_B@example.com "),false);
  assert.ok(filters.some(f=>f[0]==="marketing_suppressed_contacts" && f[1]==="eq" && f[3]==="a_b@example.com"));
  results.marketing_suppressed_contacts={data:[{email:"a_b@example.com"}]};
  assert.equal(await isMailSuppressed(db,"a_b@example.com"),true);
  results.marketing_suppressed_contacts={data:[],error:{message:"unavailable"}};
  await assert.rejects(isMailSuppressed(db,"a_b@example.com"),/SUPPRESSION_LOOKUP_FAILED/);
});
test("email send approval binds the actor, exact payload and expiration",()=>{
  const old=process.env.RESERVATION_TOKEN_SECRET;
  process.env.RESERVATION_TOKEN_SECRET="unit-test-only-secret-not-a-production-credential";
  try {
    const expires=Date.now()+60000;
    const payload={subject:"Approved",recipients:["a@example.com"]};
    const signature=mailApproval("admin",payload,expires);
    assert.equal(verifyMailApproval("admin",payload,expires,signature),true);
    assert.equal(verifyMailApproval("other",payload,expires,signature),false);
    assert.equal(verifyMailApproval("admin",{...payload,subject:"Changed"},expires,signature),false);
    assert.equal(verifyMailApproval("admin",payload,Date.now()-1,signature),false);
    const token=unsubscribeToken("a@example.com");
    assert.equal(readUnsubscribeToken(token),"a@example.com");
    assert.throws(()=>readUnsubscribeToken(`${Buffer.from("b@example.com").toString("base64url")}.${token.split(".")[1]}`));
    assert.throws(()=>readUnsubscribeToken(token+".extra"));
  }finally{if(old===undefined)delete process.env.RESERVATION_TOKEN_SECRET;else process.env.RESERVATION_TOKEN_SECRET=old;}
});
test("disabled admin mail never queries a database or sends a message",async()=>{
  const old=process.env.COMMERCE_EMAIL_MODE;
  process.env.COMMERCE_EMAIL_MODE="disabled";
  try{assert.deepEqual(await drainAdminMail(),{sent:0,disabled:true});}
  finally{if(old===undefined)delete process.env.COMMERCE_EMAIL_MODE;else process.env.COMMERCE_EMAIL_MODE=old;}
});
test("disabled delivery reconciliation never contacts a provider",async()=>{
  const old=process.env.COMMERCE_EMAIL_MODE;process.env.COMMERCE_EMAIL_MODE="disabled";
  try{assert.deepEqual(await reconcileAdminDelivery(),{checked:0,disabled:true});}
  finally{if(old===undefined)delete process.env.COMMERCE_EMAIL_MODE;else process.env.COMMERCE_EMAIL_MODE=old;}
});
