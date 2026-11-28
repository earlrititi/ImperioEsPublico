import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { AUTOMATION_DEFAULTS, automationKeysForScope } from '../src/lib/email-automations.ts';
const scope='recovery_welcome';
const definitions=AUTOMATION_DEFAULTS.filter(item=>automationKeysForScope(scope).includes(item.key));
const review={scope,keys:definitions.map(item=>item.key),digest:createHash('sha256').update(JSON.stringify(definitions)).digest('hex'),
  daily_limit:1,weekly_limit:3,other_families_disabled:true,definitions};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(review,null,2));
console.log(JSON.stringify({...review,definitions:definitions.map(item=>({key:item.key,revision:item.revision,steps:item.steps.map(step=>({id:step.id,afterHours:step.afterHours,subject:step.mail.subject}))}))}));
