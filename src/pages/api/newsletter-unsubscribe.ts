import type { APIRoute } from "astro";
import { failure, limited, privateJson, requestBody, rpc } from "../../lib/reservations";
import { readUnsubscribeToken } from "../../lib/admin-mail";
export const prerender = false;
export const POST: APIRoute = async ({request}) => {
  try {
    await limited(request,"newsletter_unsubscribe",30);
    const body = await requestBody(request);
    if(typeof body.token !== "string" || body.token.length>500) throw new Error("INVALID_INPUT");
    const email = readUnsubscribeToken(body.token);
    await rpc("suppress_marketing_email",{p_email:email,p_reason:"unsubscribe"});
    return privateJson({ok:true});
  } catch(error) { return failure(error); }
};
