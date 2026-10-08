import type { APIRoute } from "astro";
import { database, failure, limited, privateJson, requestBody, requireAdmin, rpc } from "../../../lib/reservations";
import { renderAdminMail, validateMail } from "../../../lib/admin-mail-template";
import { mailApproval, verifyMailApproval } from "../../../lib/admin-mail";
import { NEWSLETTER_SEGMENTS, newsletterAudience } from "../../../lib/newsletter-audience";
import { UUID } from "../../../lib/reservation-validation";
import { auditAdmin } from "../../../lib/admin-data";
export const prerender = false;
export const GET: APIRoute = async context => {
  try {
    await requireAdmin(context);
    const result = await (await database()).from("newsletter_campaigns").select("*").order("created_at",{ascending:false}).limit(100);
    if(result.error) throw new Error("DATABASE_UNAVAILABLE");
    return privateJson({items:result.data});
  } catch(error) { return failure(error); }
};
export const POST: APIRoute = async context => {
  try {
    const user = await requireAdmin(context);
    await limited(context.request,"admin_newsletter",20);
    const body = await requestBody(context.request);
    const content = validateMail(body);
    if (!NEWSLETTER_SEGMENTS.includes(body.segment) || !UUID.test(body.requestId ?? "")) throw new Error("INVALID_INPUT");
    const audience = await newsletterAudience(body.segment);
    const payload = {content,segment:body.segment,recipients:[...audience.recipients].sort(),requestId:body.requestId};
    if(body.action === "preview") {
      const expires = Date.now()+15*60*1000;
      return privateJson({...renderAdminMail(content),audience,expires,token:mailApproval(user.id,payload,expires)});
    }
    if(body.action !== "send" || body.confirm !== "ENVIAR" || !audience.recipients.length || !verifyMailApproval(user.id,payload,body.expires,body.token)) throw new Error("INVALID_INPUT");
    const db = await database();
    const saved = await db.from("newsletter_campaigns").upsert({id:body.requestId,name:content.subject,segment:body.segment,...content,created_by:user.id},{onConflict:"id",ignoreDuplicates:true});
    if(saved.error) throw new Error("DATABASE_UNAVAILABLE");
    const campaign = await db.from("newsletter_campaigns").select("*").eq("id",body.requestId).single();
    if(campaign.error || campaign.data.created_by !== user.id || campaign.data.segment !== body.segment || JSON.stringify(validateMail(campaign.data)) !== JSON.stringify(content)) throw new Error("INVALID_INPUT");
    if(campaign.data.status !== "draft") return privateJson({id:body.requestId,status:campaign.data.status,recipients:campaign.data.recipient_count});
    await auditAdmin(user.id,"newsletter",body.requestId,"NEWSLETTER_CONFIRMED");
    const count = await rpc("queue_newsletter",{p_id:body.requestId,p_emails:audience.recipients,p_actor:user.id});
    return privateJson({id:body.requestId,status:"pending",recipients:count},202);
  } catch(error) { return failure(error); }
};
