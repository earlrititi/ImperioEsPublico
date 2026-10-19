import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("subscription morph stays open until viewport exit, replays on reentry and cleans observers", () => {
  const content=readFileSync("src/components/Services.jsx","utf8");
  const source=ts.createSourceFile("Services.jsx",content,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  let effect:ts.Expression|undefined;
  const visit=(node:ts.Node)=>{
    if(ts.isCallExpression(node)&&node.expression.getText(source)==="useEffect"&&
      node.arguments[0]?.getText(source).includes("[data-service-card-morph]"))effect=node.arguments[0];
    ts.forEachChild(node,visit);
  };
  visit(source);assert.ok(effect);
  const classes=new Set<string>(),listeners=new Map<string,()=>void>(),documentListeners=new Map<string,()=>void>();
  const card={classList:{add:(...names:string[])=>names.forEach(name=>classes.add(name)),remove:(...names:string[])=>names.forEach(name=>classes.delete(name))},
    querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(name:string,run:()=>void)=>listeners.set(name,run),
    removeEventListener:(name:string)=>listeners.delete(name)};
  const observers:{run:(entries:{isIntersecting:boolean;target:typeof card}[])=>void;options:{rootMargin?:string};observed:Set<typeof card>}[]=[];
  class Observer {
    observed=new Set<typeof card>();
    constructor(public run:(entries:{isIntersecting:boolean;target:typeof card}[])=>void,public options:{rootMargin?:string}){observers.push(this);}
    observe(target:typeof card){this.observed.add(target);}
    unobserve(target:typeof card){this.observed.delete(target);}
    disconnect(){this.observed.clear();}
  }
  const document={visibilityState:"visible",querySelectorAll:()=>[card],querySelector:()=>null,
    addEventListener:(name:string,run:()=>void)=>documentListeners.set(name,run),removeEventListener:(name:string)=>documentListeners.delete(name)};
  // Run the actual hook body rather than duplicating its visibility logic.
  const cleanup=runInNewContext(`(${effect.getText(source)})()`,{document,IntersectionObserver:Observer});
  assert.equal(observers.length,2);
  const preload=observers.find(item=>item.options.rootMargin==="320px 0px")!;
  const reset=observers.find(item=>!item.options.rootMargin)!;
  assert.ok(preload&&reset);assert.equal(reset.observed.has(card),true);
  listeners.get("pointerenter")!();assert.ok(classes.has("service-cta-card--locked-open"));
  assert.equal(listeners.has("pointerleave"),false);
  reset.run([{target:card,isIntersecting:true}]);assert.ok(classes.has("service-cta-card--locked-open"));
  preload.run([{target:card,isIntersecting:false}]);assert.ok(classes.has("service-cta-card--locked-open"));
  document.visibilityState="hidden";documentListeners.get("visibilitychange")?.();
  assert.ok(classes.has("service-cta-card--locked-open"),"Changing tabs is not a viewport exit");
  reset.run([{target:card,isIntersecting:false}]);
  assert.equal(classes.has("service-cta-card--locked-open"),false);assert.equal(classes.has("service-cta-card--morph-active"),false);
  reset.run([{target:card,isIntersecting:true}]);listeners.get("focusin")!();
  assert.ok(classes.has("service-cta-card--locked-open"));assert.ok(classes.has("service-cta-card--morph-active"));
  cleanup();assert.equal(listeners.size,0);assert.ok(observers.every(item=>item.observed.size===0));
});
