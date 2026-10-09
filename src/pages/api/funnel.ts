import type {APIRoute} from "astro";
import {CONSENT_KEY,parseConsent} from "../../lib/cookie-consent";
import {LEGAL_DOCUMENT_VERSIONS} from "../../config/legal";
import {validFunnel} from "../../lib/funnel";
import {limited,requestBody,rpc} from "../../lib/reservations";
export const prerender=false;
export const POST:APIRoute=async({request,cookies})=>{
  try{
    if(!parseConsent(cookies.get(CONSENT_KEY)?.value??null,LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics)return new Response(null,{status:204});
    await limited(request,"funnel",120);const body=await requestBody(request);
    if(!validFunnel(body))return new Response(null,{status:400});
    await rpc("record_funnel_step",{p_id:body.id,p_flow:body.flow,p_step:body.step,p_page:body.page});
    return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
  }catch{return new Response(null,{status:503});}
};
