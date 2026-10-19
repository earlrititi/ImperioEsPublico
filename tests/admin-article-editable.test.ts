import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { Editor } from "@tiptap/core";
import ts from "typescript";

test("article editor locks do not emit content changes on load, save or preview",()=>{
  const source=ts.createSourceFile("ArticleEditor.tsx",readFileSync("src/components/admin/ArticleEditor.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let effect:ts.Expression|undefined;
  const visit=(node:ts.Node)=>{
    if(ts.isCallExpression(node)&&node.expression.getText(source)==="useEffect"&&
      node.arguments[0]?.getText(source).includes(".setEditable("))effect=node.arguments[0];
    ts.forEachChild(node,visit);
  };
  visit(source);assert.ok(effect);
  let editable:boolean|undefined;
  let updates=0;
  // Exercise the installed Tiptap method, including its default emitUpdate behavior.
  const instance={
    state:{tr:{}},
    setOptions:(options:{editable:boolean})=>{editable=options.editable;},
    emit:(event:string)=>{if(event==="update")updates++;},
    setEditable:Editor.prototype.setEditable,
  };
  const sequence=[
    {busy:false,status:"draft",expected:true},
    {busy:true,status:"draft",expected:false},
    {busy:false,status:"draft",expected:true},
    {busy:false,status:"published",expected:true},
    {busy:false,status:"deleted",expected:false},
    {busy:false,status:"draft",expected:true},
  ];
  for(const {busy,status,expected} of sequence){
    runInNewContext(`(${effect.getText(source)})()`,{editor:{current:instance},busy,status});
    assert.equal(editable,expected);
    assert.equal(updates,0,"Read-only transitions must preserve the content and dirty state");
  }
  // Confirm that the test fixture still detects a genuine update.
  instance.setEditable(true);
  assert.equal(updates,1);
});
