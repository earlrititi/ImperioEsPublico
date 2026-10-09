import type { APIRoute } from "astro";
import { database, failure, limited, privateJson, requestBody, requireAdmin, rpc } from "../../../lib/reservations";
import { renderAdminMail, validateMail } from "../../../lib/admin-mail-template";
import { mailApproval, verifyMailApproval,reconcileAdminDelivery } from "../../../lib/admin-mail";
import { normalizeEmail, validEmail } from "../../../lib/newsletter-audience";
import { UUID } from "../../../lib/reservation-validation";
export const prerender = false;
export const GET: APIRoute = async context => {
  try {
    await requireAdmin(context);
    const page = Math.max(0,Math.min(10000,Number(context.url.searchParams.get("page")) || 0));
    const result = await (await database()).from("email_logs").select("id,recipient,type,subject,status,provider_message_id,delivery_status,error,created_at,sent_at",{count:"exact"}).order("created_at",{ascending:false}).range(page*25,page*25+24);
    if (result.error) throw new Error("DATABASE_UNAVAILABLE");
    return privateJson({items:result.data,total:result.count});
  } catch(error) { return failure(error); }
};
export const POST: APIRoute = async context => {
  try {
    const user = await requireAdmin(context);
    await limited(context.request,"admin_mail",30);
    const body = await requestBody(context.request);
    if(body.action==="reconcile")return privateJson(await reconcileAdminDelivery(10));
    const content = validateMail(body);
    const type = body.type === "test" ? "test" : "individual";
    const recipient = normalizeEmail(type === "test" ? user.email : body.recipient);
    if (!validEmail(recipient) || !UUID.test(body.requestId ?? "")) throw new Error("INVALID_INPUT");
    const payload = {content,type,recipient,requestId:body.requestId};
    if (body.action === "preview") {
      const expires = Date.now()+15*60*1000;
      return privateJson({...renderAdminMail(content),recipient,expires,token:mailApproval(user.id,payload,expires)});
    }
    if (body.action !== "send" || body.confirm !== "ENVIAR" || !verifyMailApproval(user.id,payload,body.expires,body.token)) throw new Error("INVALID_INPUT");
    const id = await rpc("queue_individual_mail",{p_id:body.requestId,p_actor:user.id,p_recipient:recipient,p_type:type,p_content:content});
    return privateJson({id,status:"pending"},202);
  } catch(error) { return failure(error); }
};
