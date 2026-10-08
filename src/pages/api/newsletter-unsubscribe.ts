import type { APIRoute } from "astro";
import { database, failure, limited, privateJson, requestBody } from "../../lib/reservations";
import { readUnsubscribeToken } from "../../lib/admin-mail";
export const prerender = false;
export const POST: APIRoute = async ({request}) => {
  try {
    await limited(request,"newsletter_unsubscribe",30);
    const body = await requestBody(request);
    if(typeof body.token !== "string" || body.token.length>500) throw new Error("INVALID_INPUT");
    const email = readUnsubscribeToken(body.token);
    const result = await (await database()).from("email_suppressions").upsert({email},{onConflict:"email",ignoreDuplicates:true});
    if(result.error) throw new Error("DATABASE_UNAVAILABLE");
    return privateJson({ok:true});
  } catch(error) { return failure(error); }
};
