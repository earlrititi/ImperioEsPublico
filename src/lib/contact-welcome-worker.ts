import {SITE} from "../config/site";
import {database,optionalEnv,rpc} from "./reservations";
import {getRequiredEnv} from "./env";
import {renderAdminMail} from "./admin-mail-template";
import {unsubscribeToken} from "./admin-mail";
import {personalizeAutomation,campaignAutomationMail,type AutomationDraft} from "./email-automations";
import {nextContactWelcome} from "./contact-welcome-plan";

export async function runContactWelcome(approved:{runtime:any;drafts:AutomationDraft[];digest:string;mode:string},limit:number,stillApproved:()=>Promise<boolean>){
  if(optionalEnv("MARKETING_CENTRAL_WELCOME_ENABLED")!=="true")return {queued:0,sent:0,suppressed:0,failed:0};
  const db=await database(),draft=approved.drafts.find(d=>d.key==="welcome")!;
  const read=async(email:string)=>{const r=await db.from("marketing_email_contacts").select("*").eq("email",email).gte("marketing_accepted_at",approved.runtime.enrollment_starts_at).maybeSingle();
    if(r.error)throw Error("DATABASE_UNAVAILABLE");return r.data;};
  const history=async(email:string,user:string|null)=>{
    const byEmail=await db.from("marketing_automation_jobs").select("step,sent_at").eq("contact_email",email).eq("key","welcome").eq("status","sent");
    if(byEmail.error)throw Error("DATABASE_UNAVAILABLE");
    if(!user)return byEmail.data;
    const byUser=await db.from("marketing_automation_jobs").select("step,sent_at").eq("user_id",user).eq("key","welcome").eq("status","sent");
    if(byUser.error)throw Error("DATABASE_UNAVAILABLE");return [...byEmail.data,...byUser.data];
  };
  let query=db.from("marketing_email_contacts").select("*").gte("marketing_accepted_at",approved.runtime.enrollment_starts_at).order("email").limit(100);
  if(approved.runtime.last_contact_email)query=query.gt("email",approved.runtime.last_contact_email);
  const candidates=await query;if(candidates.error)throw Error("DATABASE_UNAVAILABLE");
  let queued=0,sent=0,suppressed=0,failed=0;
  for(const c of candidates.data){
    const next=nextContactWelcome(draft.steps,c.welcome_at,await history(c.email,c.user_id));
    if(next&&await rpc("queue_contact_welcome",{p_email:c.email,p_step:next.step.id,p_due:next.due,p_revision:draft.revision,p_digest:approved.digest}))queued++;
  }
  const cursor=await db.from("marketing_automation_runtime").update({last_contact_email:candidates.data.length===100?candidates.data.at(-1)!.email:null}).eq("id",true);
  if(cursor.error)throw Error("DATABASE_UNAVAILABLE");
  const {resend}=await import("./resend");
  for(let n=0;n<Math.min(10,limit);n++){
    if(!await stillApproved())break;
    const job=(await rpc("claim_contact_welcome"))?.[0];if(!job)break;
    const finish=async(values:Record<string,unknown>)=>{const result=await db.from("marketing_automation_jobs").update(values).eq("id",job.id).eq("claim_id",job.claim_id).eq("status","processing").select("id");
      if(result.error||result.data.length!==1)throw Error("EMAIL_RECEIPT_UNAVAILABLE");};
    try{
      const contact=await read(job.contact_email),next=contact?nextContactWelcome(draft.steps,contact.welcome_at,await history(contact.email,contact.user_id)):null;
      if(!contact||!next||contact.consent_id!==job.consent_id||next.step.id!==job.step||job.revision!==draft.revision||job.template_digest!==approved.digest){
        await finish({status:"suppressed",reason:"NO_LONGER_ELIGIBLE",provider_payload:null});suppressed++;continue;}
      const recipient=approved.mode==="test"?getRequiredEnv("COMMERCE_TEST_EMAIL"):contact.email;
      let payload=job.provider_payload;
      if(!payload){const mail=campaignAutomationMail(personalizeAutomation(next.step.mail,contact.name),"welcome",job.step),unsubscribe=`${SITE.url}/comunicaciones/baja?token=${unsubscribeToken(contact.email)}`;
        payload={from:`Imperio Español <${SITE.contactEmail}>`,replyTo:SITE.contactEmail,to:recipient,subject:mail.subject,...renderAdminMail(mail,unsubscribe,true),headers:{"List-Unsubscribe":`<${unsubscribe}>`}};
        const saved=await db.from("marketing_automation_jobs").update({provider_payload:payload}).eq("id",job.id).eq("claim_id",job.claim_id).eq("status","processing").is("provider_payload",null).select("id");
        if(saved.error||saved.data.length!==1)throw Error("EMAIL_SNAPSHOT_UNAVAILABLE");}
      const latest=await read(contact.email),lease=await db.from("marketing_automation_jobs").select("status,claim_id").eq("id",job.id).single();
      if(lease.error)throw Error("DATABASE_UNAVAILABLE");
      if(!latest||latest.consent_id!==job.consent_id||lease.data.status!=="processing"||lease.data.claim_id!==job.claim_id||!await stillApproved()){
        if(lease.data.status==="processing")await finish({status:"suppressed",reason:"ELIGIBILITY_CHANGED",provider_payload:null});suppressed++;continue;}
      if(payload.to!==recipient||payload.cc||payload.bcc)throw Error("EMAIL_RECIPIENT_CHANGED");
      const response=await resend.emails.send(payload,{idempotencyKey:`automation-${job.id}`});
      if(response.error||!response.data)throw Error("EMAIL_PROVIDER_UNAVAILABLE");
      await finish({status:"sent",provider_id:response.data.id,sent_at:new Date().toISOString(),provider_payload:null,delivery_status:"accepted_by_provider"});sent++;
    }catch{failed++;}
  }
  return {queued,sent,suppressed,failed};
}
