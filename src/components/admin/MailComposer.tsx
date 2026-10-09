import { useEffect, useState } from "preact/hooks";
const blank={subject:"",preheader:"",content:"",cta_label:"",cta_url:""};
type Preview={html:string;expires:number;token:string;revision?:number;recipient?:string;audience?:{recipients:string[];invalid:number;duplicates:number;unsubscribed:number}};
type Log={id:string;subject:string;preheader?:string;content?:string;cta_label?:string;cta_url?:string;segment?:string;revision?:number;recipient?:string;status:string;created_at:string;recipient_count?:number;delivery_status?:string;delivery?:{accepted:number;delivered:number;bounced:number;failed:number}};
const segments=[["shirts","Camisetas con consentimiento"],["subscriptions","Suscriptores con consentimiento"],["arcabucero","Arcabucero"],["maestre_campo","Maestre de Campo"],["both","Camiseta y suscripcion"],["manifesto","Manifiesto con consentimiento"],["leads","Leads con consentimiento"],["all","Todas las audiencias consentidas"]];
export default function MailComposer({newsletter=false}:{newsletter?:boolean}) {
  const [content,setContent]=useState(blank);
  const [recipient,setRecipient]=useState("");
  const [segment,setSegment]=useState("shirts");
  const [type,setType]=useState("individual");
  const [requestId,setRequestId]=useState("");
  const [revision,setRevision]=useState(0);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [logs,setLogs]=useState<Log[]>([]);
  const [refresh,setRefresh]=useState(0);
  const [page,setPage]=useState(0);
  const [total,setTotal]=useState(0);
  const endpoint=newsletter?"/api/admin/newsletter":"/api/admin/mail";
  useEffect(()=>{setRequestId(crypto.randomUUID());},[]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`${endpoint}?page=${page}`,{signal:controller.signal,cache:"no-store"}).then(async r=>{const result=await r.json();if(!r.ok) throw new Error(result.error);return result;}).then(data=>{setLogs(data.items);setTotal(data.total??data.items.length);}).catch(e=>{if(e.name!=="AbortError")setMessage(e.message);});
    return()=>controller.abort();
  },[endpoint,refresh,page]);
  function edit(key:keyof typeof blank,value:string){setContent({...content,[key]:value});setPreview(null);setMessage("");if(!newsletter)setRequestId(crypto.randomUUID());}
  function newDraft(){setContent(blank);setRevision(0);setRequestId(crypto.randomUUID());setPreview(null);setMessage("");}
  function openDraft(log:Log){if(!confirm("Abrir este borrador y descartar los cambios del formulario?"))return;setContent({subject:log.subject,preheader:log.preheader??"",content:log.content??"",cta_label:log.cta_label??"",cta_url:log.cta_url??""});setSegment(log.segment??"all");setRevision(log.revision??1);setRequestId(log.id);setPreview(null);setMessage("");}
  async function checkDelivery(){setBusy(true);try{const r=await fetch("/api/admin/mail",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reconcile"})});if(!r.ok)throw Error("No se pudo comprobar la entrega.");setMessage("Entrega comprobada con el proveedor.");setRefresh(n=>n+1);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  async function submit(action:"preview"|"send"|"save") {
    if(action==="send"&&!window.confirm(`Confirmar envio a ${newsletter?preview?.audience?.recipients.length:preview?.recipient} destinatario(s)?`)) return;
    setBusy(true);setMessage("");
    try {
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...content,recipient,segment,type,requestId,revision,action,...(action==="send"?{expires:preview?.expires,token:preview?.token,confirm:"ENVIAR"}:{})})});
      const result=await response.json();if(!response.ok) throw new Error(result.error||"No se pudo completar la solicitud.");
      if(action==="preview"){setPreview(result);if(newsletter){setRevision(result.revision);setRefresh(n=>n+1);}}
      else if(action==="save"){setRevision(result.revision);setPreview(null);setMessage("Borrador guardado. No se ha enviado ningun correo.");setRefresh(n=>n+1);}
      else {setMessage("Envio en cola. El resultado aparecera en el historial.");setPreview(null);setRefresh(n=>n+1);setRequestId(crypto.randomUUID());setRevision(0);}
    }catch(error){setMessage(error instanceof Error?error.message:"Solicitud no disponible.");}finally{setBusy(false);}
  }
  return <section><h1>{newsletter?"Newsletter":"Correos"}</h1><form class="admin-mail-form" onSubmit={e=>{e.preventDefault();void submit("preview");}}>
    <fieldset disabled={busy} style="border:0;padding:0;margin:0;display:contents">
    {newsletter?<label>Audiencia<select value={segment} onChange={e=>{setSegment(e.currentTarget.value);setPreview(null);}}>{segments.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>:<>
      <label>Tipo<select value={type} onChange={e=>{setType(e.currentTarget.value);setPreview(null);}}><option value="individual">Correo individual</option><option value="test">Prueba a mi correo</option></select></label>
      {type==="individual"&&<label>Destinatario<input type="email" required value={recipient} onInput={e=>{setRecipient(e.currentTarget.value);setPreview(null);}}/></label>}
    </>}
    <label>Asunto<input required maxLength={180} value={content.subject} onInput={e=>edit("subject",e.currentTarget.value)}/></label>
    <label>Preheader<input maxLength={250} value={content.preheader} onInput={e=>edit("preheader",e.currentTarget.value)}/></label>
    <label>Contenido<textarea required rows={12} maxLength={10000} value={content.content} onInput={e=>edit("content",e.currentTarget.value)}/></label>
    <label>Texto del enlace<input maxLength={80} value={content.cta_label} onInput={e=>edit("cta_label",e.currentTarget.value)}/></label>
    <label>URL del enlace<input type="url" maxLength={500} value={content.cta_url} onInput={e=>edit("cta_url",e.currentTarget.value)}/></label>
    <div class="admin-toolbar"><button disabled={busy||!requestId} type="submit">{busy?"Procesando...":"Vista previa"}</button>{newsletter&&<><button type="button" disabled={busy} onClick={()=>void submit("save")}>Guardar borrador</button><button type="button" disabled={busy} onClick={()=>{if(confirm("Descartar los cambios y crear un borrador nuevo?"))newDraft();}}>Nuevo borrador</button></>}</div>
    </fieldset>
  </form>
  <p role="status" aria-live="polite">{message}</p>
  {preview&&<section><h2>Vista previa</h2>{preview.audience&&<p>{preview.audience.recipients.length} destinatarios · {preview.audience.duplicates} duplicados · {preview.audience.invalid} invalidos · {preview.audience.unsubscribed} bajas</p>}
    {preview.recipient&&<p>Para: {preview.recipient}</p>}<iframe title="Vista previa del correo" sandbox="" srcDoc={preview.html}/><button disabled={busy||(newsletter&&!preview.audience?.recipients.length)} onClick={()=>void submit("send")}>Confirmar envio</button>
  </section>}
  <div class="admin-toolbar"><h2>Historial</h2><button onClick={()=>setRefresh(n=>n+1)}>Actualizar</button><button disabled={busy} onClick={()=>void checkDelivery()}>Comprobar entrega</button></div>
  <div class="admin-table-wrap"><table><thead><tr><th>Fecha</th><th>Asunto</th><th>{newsletter?"Destinatarios":"Correo"}</th><th>Estado</th>{newsletter&&<><th>Entrega</th><th>Accion</th></>}</tr></thead><tbody>{logs.map(log=><tr key={log.id}><td>{new Date(log.created_at).toLocaleString("es-ES")}</td><td>{log.subject}</td><td>{newsletter?log.recipient_count:log.recipient}</td><td>{log.delivery_status==="accepted_by_provider"?"Aceptado por el proveedor":log.status}</td>{newsletter&&<><td>{log.delivery?`${log.delivery.accepted} aceptados / ${log.delivery.delivered} entregados / ${log.delivery.bounced} rebotes / ${log.delivery.failed} fallos`:"Sin envios"}</td><td>{log.status==="draft"&&<button disabled={busy} onClick={()=>openDraft(log)}>Editar</button>}</td></>}</tr>)}{!logs.length&&<tr><td colSpan={newsletter?6:4}>Sin envios registrados.</td></tr>}</tbody></table></div>
  {!newsletter&&<div class="admin-toolbar"><button disabled={!page} onClick={()=>setPage(n=>n-1)} aria-label="Pagina anterior">&larr;</button><span>{page+1}</span><button disabled={(page+1)*25>=total} onClick={()=>setPage(n=>n+1)} aria-label="Pagina siguiente">&rarr;</button></div>}
  </section>;
}
