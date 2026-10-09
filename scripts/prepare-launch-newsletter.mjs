import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createClient} from '@supabase/supabase-js';
const e=parseEnv(readFileSync('.env.reservation-production.local','utf8'));
assert.equal(e.PUBLIC_SUPABASE_URL,'https://pjrqozlyrjgugdraoght.supabase.co');
const db=createClient(e.PUBLIC_SUPABASE_URL,e.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const actor='24f42701-98e0-4716-810c-363ae1cc8fa2',id='a13f3a47-7ca5-4a58-97ac-d5673910c82b';
const user=await db.auth.admin.getUserById(actor);assert.ifError(user.error);assert.equal(user.data.user.email,'earlrititi@gmail.com');assert.ok(user.data.user.email_confirmed_at);
const existing=await db.from('newsletter_campaigns').select('id,status').eq('id',id).maybeSingle();assert.ifError(existing.error);
if(!existing.data){
 const result=await db.rpc('save_newsletter_draft',{p_id:id,p_actor:actor,p_revision:0,p_segment:'all',p_content:{
  subject:'Imperio E: camisetas y suscripciones disponibles',preheader:'Camiseta Imperial y acceso a nuestros articulos.',
  content:'Ya puedes comprar la Camiseta Imperial y suscribirte a Imperio E.\n\nLa camiseta cuesta 26,99 euros, IVA incluido, mas 3 euros de envio por unidad. Enviamos exclusivamente a la peninsula. Preparacion en un maximo de 48 horas y entrega en un maximo de 7 dias laborables.\n\nArcabucero y Maestre de Campo dan acceso a los articulos de pago, con opciones mensuales y anuales. Arcabucero incluye un 15% de descuento en la camiseta y Maestre de Campo un 20%. El descuento es de un solo uso, requiere una suscripcion activa, no es acumulable y no se aplica al envio.\n\nPuedes consultar los planes en https://imperioes.com/suscribirse y comprar la camiseta en nuestra web.\n\nPara cualquier consulta, escribe a contacto@imperioes.com.',
  cta_label:'Ver la Camiseta Imperial',cta_url:'https://imperioes.com/reservas',
 }});assert.ifError(result.error);
}
const campaign=await db.from('newsletter_campaigns').select('status,revision').eq('id',id).single();assert.ifError(campaign.error);assert.equal(campaign.data.status,'draft');
const logs=await db.from('email_logs').select('id',{count:'exact',head:true}).eq('campaign_id',id);assert.ifError(logs.error);assert.equal(logs.count,0);
console.log('Launch newsletter draft saved and verified. Owner review/preview/confirmation required. No queued or sent emails.');
process.exit(0);
