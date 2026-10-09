import type { APIRoute } from "astro";
import { database,failure,limited,privateJson,requireAdmin,rpc } from "../../../lib/reservations";
import {readAll} from "../../../lib/admin-data";
import {verifiedSubscriptions} from "../../../lib/subscription-reconciliation";
export const prerender=false;
export const GET:APIRoute=async context=>{
  try{
    await requireAdmin(context);await limited(context.request,"admin_overview",30);
    const db=await database();
    const users=[];
    for(let page=1;page<=100;page++){
      const {data,error}=await db.auth.admin.listUsers({page,perPage:1000});
      if(error)throw new Error("AUTH_UNAVAILABLE");
      users.push(...data.users);if(data.users.length<1000)break;
    }
    const [profiles,notices,subscriptions,reservations,orders,checkouts,interaction]=await Promise.all([
      readAll("profiles","id,email,full_name,created_at"),readAll("admin_notification_history","id,kind,customer_email,subject,occurred_at,source,delivery_status,source_url"),
      verifiedSubscriptions(),readAll("reservations","id,number,customer_email,customer_name,status,total_quantity,created_at"),
      readAll("commerce_orders","id,status,total,created_at"),readAll("subscription_checkouts","email,plan,stripe_session_id,expires_at","email"),rpc("admin_analytics_summary",{p_days:30}),
    ]);
    const accounts=users.map(user=>{
      const profile=profiles.find(p=>p.id===user.id);const email=user.email?.toLowerCase()??"";
      const paid=subscriptions.verified.find(s=>s.email?.toLowerCase()===email && s.status==="active");
      return {id:user.id,email,name:profile?.full_name??user.user_metadata?.full_name??"",created_at:user.created_at,
        confirmed:Boolean(user.email_confirmed_at),plan:paid?.plan??"piquero",subscriptionStatus:paid?.status??null,
        notifications:notices.filter(n=>n.customer_email===email).length};
    });
    const {stripe}=await import("../../../lib/stripe");
    const checkoutStates=[];
    for(const c of checkouts){
      if(!c.stripe_session_id){checkoutStates.push({...c,status:"not_started"});continue;}
      try{const session=await stripe.checkout.sessions.retrieve(c.stripe_session_id);checkoutStates.push({...c,status:session.payment_status==="paid"?"paid":session.status==="expired"?"expired":"pending_payment"});}
      catch(error){if((error as {code?:string}).code!=="resource_missing")throw error;checkoutStates.push({...c,status:"historical_unavailable"});}
    }
    return privateJson({accounts,notices:notices.sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at)),subscriptions,
      reservations,orders,checkouts:checkoutStates,interaction});
  }catch(error){return failure(error);}
};
