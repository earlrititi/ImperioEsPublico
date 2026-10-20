import test from "node:test";
import assert from "node:assert/strict";
import { articleIsPublic,articleLibrary,type ManagedArticle } from "../src/lib/admin-article-library";

const legacy=[{slug:"historia-de-espana",title:"Historia de Espa\u00f1a",category:"Historia",publishedAt:"2026-09-01"},{slug:"segundo",title:"Segundo articulo"}];
const managed:ManagedArticle={id:"one",slug:legacy[0].slug,title:"Nueva revision",category:"Historia",status:"draft",revision:1,legacy_slug:legacy[0].slug,published_title:null,updated_at:"2026-10-20T00:00:00Z"};
test("article library unifies file and managed articles without duplicates or private draft bodies",()=>{
  const result=articleLibrary([managed],legacy,{page:0,status:"all",search:""});
  assert.equal(result.total,2);assert.equal(result.items.filter(row=>row.slug===managed.slug).length,1);
  assert.equal(result.items[0].source,"cms");assert.equal(result.items[0].isPublic,true);assert.equal(result.items[0].status,"published");
  assert.deepEqual(result.counts,{all:2,draft:0,published:2,withdrawn:0,deleted:0});
  assert.equal("draft" in result.items[0],false);
});
test("legacy trash and withdrawal never reappear as unmanaged public articles",()=>{
  for(const status of ["deleted","withdrawn"] as const){
    const result=articleLibrary([{...managed,status}],legacy,{page:0,status,search:""});
    assert.equal(result.items.length,1);assert.equal(result.items[0].isPublic,false);assert.equal(result.items[0].status,status);
    assert.equal(result.counts.published,1);
  }
  const all=articleLibrary([{...managed,status:"deleted"}],legacy,{page:0,status:"all",search:""});
  assert.equal(all.total,1);assert.equal(all.items[0].slug,"segundo");
});
test("library search treats accents, slugs and wildcard characters as plain text",()=>{
  assert.equal(articleLibrary([],legacy,{page:0,status:"published",search:"ESPANA"}).total,1);
  assert.equal(articleLibrary([],legacy,{page:0,status:"all",search:"historia-de"}).total,1);
  assert.equal(articleLibrary([],legacy,{page:0,status:"all",search:"%_"}).total,0);
});
test("article pagination clamps after the last row is moved to trash",()=>{
  const rows=Array.from({length:26},(_,index)=>({...managed,id:String(index),slug:`entry-${index}`,legacy_slug:null}));
  let result=articleLibrary(rows,[],{page:1,status:"draft",search:""});assert.equal(result.items.length,1);
  result=articleLibrary(rows.slice(0,25),[],{page:1,status:"draft",search:""});assert.equal(result.page,0);assert.equal(result.items.length,25);
});
test("public state distinguishes an imported live file from a new or restored draft",()=>{
  assert.equal(articleIsPublic(managed),true);
  assert.equal(articleIsPublic({...managed,legacy_slug:null}),false);
  assert.equal(articleIsPublic({...managed,status:"withdrawn"}),false);
  assert.equal(articleIsPublic({...managed,status:"deleted"}),false);
  assert.equal(articleIsPublic({...managed,status:"published",published_title:"Published"}),true);
});
