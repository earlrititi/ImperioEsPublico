import type {APIRoute} from "astro";
import {failure,limited,optionalEnv,privateJson,requestBody,rpc} from "../../../lib/reservations";
import {contactTokenHash,validContactToken} from "../../../lib/marketing-contact-token";
export const prerender=false;
export const POST:APIRoute=async({request})=>{
  try{
    const body=await requestBody(request,1024);await limited(request,"marketing_confirmation",10);
    if(typeof body.id!=="string"||typeof body.token!=="string")return privateJson({ok:false},400);
    const {database}=await import("../../../lib/reservations");
    const result=await(await database()).from("marketing_email_verifications").select("expires_at").eq("id",body.id).maybeSingle();
    if(result.error)throw Error("DATABASE_UNAVAILABLE");
    if(!result.data||!validContactToken(body.id,result.data.expires_at,body.token,optionalEnv("MARKETING_VERIFICATION_SECRET")))return privateJson({ok:false},400);
    const ok=await rpc("confirm_marketing_email",{p_id:body.id,p_hash:contactTokenHash(body.token)});
    return privateJson({ok},ok?200:400);
  }catch(error){return failure(error);}
};
