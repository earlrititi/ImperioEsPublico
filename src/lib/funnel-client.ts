import {readSavedConsent} from "./cookie-consent";
import {LEGAL_DOCUMENT_VERSIONS} from "../config/legal";
import {FUNNEL_PAGES,type FunnelFlow} from "./funnel";
const pending=new Map<string,Promise<void>>();
export async function trackFunnel(flow:FunnelFlow,step:number,page=location.pathname){
  try{
    if(!readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics || !FUNNEL_PAGES.test(page))return;
    const key=`imperio-funnel-${flow}`;
    const old=JSON.parse(sessionStorage.getItem(key)??"null");
    if(page!==location.pathname&&(!old||Date.now()-old.at>=30*60*1000))return;
    const run=old && Date.now()-old.at<30*60*1000?old:{id:crypto.randomUUID(),at:Date.now(),steps:[]};
    run.at=Date.now();
    // One random flow identifier per tab, no email, account, input values or URL parameters.
    const steps=[...new Set([0,step])].filter(s=>!run.steps.includes(s));
    for(const s of steps)run.steps.push(s);
    sessionStorage.setItem(key,JSON.stringify(run));
    const task=(pending.get(flow)??Promise.resolve()).then(async()=>{
      for(const s of steps){
        if(!readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics)return;
        try{
          const r=await fetch("/api/funnel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:run.id,flow,step:s,page}),keepalive:true,signal:AbortSignal.timeout(1000)});
          if(!r.ok)throw Error("ANALYTICS_UNAVAILABLE");
        }catch{
          const current=JSON.parse(sessionStorage.getItem(key)??"null");
          if(current?.id===run.id){current.steps=current.steps.filter((value:number)=>value!==s);sessionStorage.setItem(key,JSON.stringify(current));}
        }
      }
    }).catch(()=>{});
    pending.set(flow,task);await Promise.race([task,new Promise<void>(resolve=>{setTimeout(resolve,900);})]);
  }catch{/* Analytics must never prevent a request or payment. */}
}
export function clearFunnel(){
  if(readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics)return;
  for(const flow of ["manifesto","subscriptions","shirts"])try{sessionStorage.removeItem(`imperio-funnel-${flow}`);}catch{}
}
