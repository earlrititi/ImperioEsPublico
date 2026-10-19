import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("overview reads paid-order notices using their actual primary key",async()=>{
  const source=ts.createSourceFile("overview.ts",readFileSync("src/pages/api/admin/overview.ts","utf8"),ts.ScriptTarget.Latest,true);
  let call:ts.CallExpression|undefined;
  const visit=(node:ts.Node)=>{
    if(ts.isCallExpression(node)&&node.expression.getText(source)==="readAll"&&
      node.arguments[0]?.getText(source)==='"paid_order_admin_outbox"')call=node;
    ts.forEachChild(node,visit);
  };
  visit(source);assert.ok(call);
  const dataSource=ts.createSourceFile("admin-data.ts",readFileSync("src/lib/admin-data.ts","utf8"),ts.ScriptTarget.Latest,true);
  const readAll=dataSource.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="readAll");
  assert.ok(readAll);
  const row={order_id:"example",status:"SENT",delivery_status:"delivered",created_at:"2026-10-19T12:00:00Z",sent_at:"2026-10-19T12:01:00Z"};
  const db={from:(table:string)=>{
    assert.equal(table,"paid_order_admin_outbox");
    return {select:()=>({order:(key:string)=>({range:async()=>
      key==="order_id"?{data:[row],error:null}:{data:null,error:{code:"42703"}}})})};
  }};
  // Evaluate the real query and pagination helper against a schema-aware fixture.
  const code=ts.transpileModule(`${readAll.getText(dataSource)}\n${call.getText(source)}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const rows=await runInNewContext(code,{database:async()=>db,exports:{}});
  assert.equal(rows.length,1);
  assert.equal(rows[0].delivery_status,"delivered");
});
