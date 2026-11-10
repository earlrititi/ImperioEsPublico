import type {AutomationStep} from "./email-automations";
export function nextContactWelcome(steps:AutomationStep[],anchor:string,sent:{step:string;sent_at:string}[],now=Date.now()){
  const start=Date.parse(anchor);if(!Number.isFinite(start)||start>now)return null;
  if(sent.some(item=>Date.parse(item.sent_at)>now-6*3600000))return null;
  const next=steps.find(step=>!sent.some(item=>item.step===step.id));
  return next&&start+next.afterHours*3600000<=now?{step:next,due:new Date(start+next.afterHours*3600000).toISOString()}:null;
}
