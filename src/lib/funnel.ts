export const FUNNEL_STEPS = {
  manifesto: ["Entrada", "Formulario abierto", "Formulario iniciado", "Envio intentado", "Solicitud aceptada"],
  subscriptions: ["Entrada", "Plan elegido / formulario", "Formulario iniciado", "Envio intentado", "Stripe abierto"],
  shirts: ["Entrada", "Talla / formulario", "Formulario iniciado", "Solicitud intentada", "Stock asignado", "Stripe abierto"],
} as const;
export type FunnelFlow = keyof typeof FUNNEL_STEPS;
export const FUNNEL_PAGES = /^\/(?:$|manifiesto|suscribirse|precios|instagram|tienda|reservas|checkout\/(?:arcabucero-(?:monthly|annual)|maestre-campo-(?:monthly|annual)))\/?$/;
export function validFunnel(value: unknown): value is {id:string;flow:FunnelFlow;step:number;page:string} {
  if(!value || typeof value!=="object")return false;
  const v=value as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["id","flow","step","page"].includes(k)))return false;
  return typeof v.id==="string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.id) &&
    typeof v.flow==="string" && Object.hasOwn(FUNNEL_STEPS,v.flow) &&
    Number.isInteger(v.step) && Number(v.step)>=0 && Number(v.step)<FUNNEL_STEPS[v.flow as FunnelFlow].length &&
    typeof v.page==="string" && FUNNEL_PAGES.test(v.page);
}
export type FunnelRun={id:string;flow:FunnelFlow;stages:number[];created_at:string;last_seen_at:string};
export function summarizeFunnel(runs:FunnelRun[],now=Date.now()){
  return Object.entries(FUNNEL_STEPS).map(([flow,labels])=>{
    const cohort=runs.filter(r=>r.flow===flow);
    const mature=cohort.filter(r=>now-Date.parse(r.last_seen_at)>=30*60*1000);
    const reached=(r:FunnelRun,step:number)=>Array.from({length:step+1},(_,i)=>i).every(i=>r.stages.includes(i));
    const stages=labels.map((label,step)=>{
      const count=cohort.filter(r=>reached(r,step)).length;
      const settled=mature.filter(r=>reached(r,step)).length;
      const lost=step<labels.length-1?mature.filter(r=>reached(r,step)&&!reached(r,step+1)).length:0;
      return {label,count,settled,lost,lossRate:settled?lost/settled:null};
    });
    const largest=stages.slice(0,-1).filter(s=>s.lost>0).sort((a,b)=>b.lost-a.lost)[0]??null;
    return {flow,stages,inProgress:cohort.length-mature.length,largest};
  });
}
