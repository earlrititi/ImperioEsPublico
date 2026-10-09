import type {APIRoute} from "astro";
import {failure,limited,privateJson,requireAdmin,rpc} from "../../../lib/reservations";
import {readAll} from "../../../lib/admin-data";
import {summarizeFunnel,type FunnelRun} from "../../../lib/funnel";
import {getRequiredEnv} from "../../../lib/env";
export const prerender=false;
export const GET:APIRoute=async context=>{
  try{
    await requireAdmin(context);await limited(context.request,"admin_funnel",20);
    const days=Number(context.url.searchParams.get("days")??30);
    if(![7,30,90].includes(days))throw Error("INVALID_INPUT");
    const since=Date.now()-days*86400000;
    const [runs,manifesto,orders,consents,analytics]=await Promise.all([
      readAll("funnel_runs","id,flow,stages,created_at,last_seen_at"),readAll("manifesto_requests","id,status,marketing_consent,created_at,source"),
      readAll("commerce_orders","id,status,total,created_at"),readAll("legal_consents","id,source,context_id,context_type,consent_type,accepted,created_at"),rpc("admin_analytics_summary",{p_days:days}),
    ]);
    const current=manifesto.filter(r=>Date.parse(r.created_at)>=since);
    const legacy=new Set(consents.filter(r=>r.source==="manifesto"&&r.consent_type==="privacy_acknowledgement"&&r.accepted===true&&r.context_type==="resource_request"&&r.context_id&&Date.parse(r.created_at)>=since&&!manifesto.some(m=>m.id===r.context_id)).map(r=>r.context_id));
    const {stripe}=await import("../../../lib/stripe");
    const site=getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/,"");
    const checkout={subscriptions:{opened:0,paid:0,expired:0,pending:0},shirts:{opened:0,paid:0,expired:0,pending:0}};
    let read=0;
    for await(const session of stripe.checkout.sessions.list({created:{gte:Math.floor(since/1000)},limit:100})){
      if(++read>10000)throw Error("AUDIENCE_TOO_LARGE");
      if(session.metadata?.readiness_check || !session.success_url?.startsWith(site+"/"))continue;
      const bucket=session.mode==="subscription"&&session.metadata?.termsVersion?checkout.subscriptions:session.metadata?.reservationAttemptId?checkout.shirts:null;
      if(!bucket)continue;
      bucket.opened++;
      if(session.payment_status==="paid")bucket.paid++;
      else if(session.status==="expired")bucket.expired++;
      else bucket.pending++;
    }
    return privateJson({days,funnels:summarizeFunnel(runs.filter(r=>Date.parse(r.created_at)>=since) as FunnelRun[]),checkout,
      manifesto:{requests:current.length,accepted:current.filter(r=>r.status==="accepted").length,failed:current.filter(r=>r.status==="failed").length,
        optIns:current.filter(r=>r.marketing_consent).length,legacyRequests:legacy.size},
      paidOrders:orders.filter(r=>Date.parse(r.created_at)>=since&&!['CANCELLED','REFUNDED'].includes(r.status)).length,
      clicks:analytics.interactions.filter((r:{event:string})=>r.event==="click").slice(0,30),
    });
  }catch(error){return failure(error);}
};
