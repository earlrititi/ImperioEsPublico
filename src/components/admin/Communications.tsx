import { useEffect, useId, useRef, useState } from "preact/hooks";
import { AUDIENCE_STATES, COMMUNICATION_SOURCES, COMMUNICATION_STATES } from "../../lib/communications-labels";
import "../../styles/admin-communications.css";

const STATES: Record<string,string> = {recorded:"Solo registro",queued:"En cola",scheduled:"Programado",processing:"Procesando",accepted_by_provider:"Aceptado por proveedor",delivered:"Entrega confirmada",deferred:"Diferido",bounced:"Rebotado",complained:"Queja",failed:"Fallido",cancelled:"Cancelado",unsubscribed:"Baja / suprimido",review:"Requiere revisión",received:"Recibido",eligible:"Elegible comercial",pending_verification:"Pendiente de verificación",suppressed:"Bloqueado / suprimido",no_consent:"Sin consentimiento comercial",sent:"Aceptado por proveedor",pending:"Pendiente",accepted:"Aceptado",declined:"Rechazado",withdrawn:"Retirado"};
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",dateStyle:"medium",timeStyle:"short"}).format(new Date(value)) : "No consta";
const label = (value: unknown) => STATES[String(value)] ?? String(value ?? "No consta");
type Row = Record<string,any>;
type Page = {items:Row[];total:number;page:number;pageSize:number;export_allowed?:boolean;checked_at?:string};
const MESSAGE_TABS = [["outbound","Enviados y cola"],["inbound","Recibidos"],["replies","Respuestas con referencia"]] as const;
async function read(url: string, signal?: AbortSignal) {
  const response = await fetch(url,{credentials:"same-origin",cache:"no-store",signal});
  const result = await response.json(); if (!response.ok) throw Error(result.error ?? "No se pudo consultar el registro."); return result;
}
export default function Communications({audience = false}:{audience?:boolean}) {
  const endpoint = `/api/admin/${audience ? "audience" : "communications"}`;
  const form = useRef<HTMLFormElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const detailRequest = useRef<AbortController|null>(null), detailGeneration = useRef(0);
  const tabButtons = useRef<Record<string,HTMLButtonElement|null>>({}), tabsId = useId();
  const panelId = `${tabsId}-panel`;
  const [params,setParams] = useState(new URLSearchParams(audience ? "" : "direction=outbound"));
  const [page,setPage] = useState<Page>({items:[],total:0,page:0,pageSize:25});
  const [coverage,setCoverage] = useState<Row|null>(null), [totals,setTotals] = useState<Row[]>([]);
  const [busy,setBusy] = useState(true), [error,setError] = useState(""),[detail,setDetail] = useState<Row|null>(null),[detailError,setDetailError] = useState("");
  const [tab,setTab] = useState("outbound"),[refresh,setRefresh] = useState(0),[exporting,setExporting] = useState(false);
  useEffect(()=> {
    const controller = new AbortController(); setBusy(true); setError("");
    read(`${endpoint}?${params}`,controller.signal).then(setPage).catch(e=>{if(e.name!=="AbortError"){setError(e.message);setPage({items:[],total:0,page:0,pageSize:25});}}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>controller.abort();
  },[endpoint,params.toString(),refresh]);
  useEffect(()=> {
    const controller = new AbortController();
    read(`/api/admin/communications?coverage=1`,controller.signal).then(setCoverage).catch(()=>setCoverage(null));
    if(audience)read(`${endpoint}?totals=1`,controller.signal).then(r=>setTotals(r.items)).catch(()=>setTotals([]));
    return ()=>controller.abort();
  },[audience,refresh]);
  useEffect(()=>()=>{detailRequest.current?.abort();detailGeneration.current+=1;},[endpoint]);
  useEffect(()=>{if(detail)heading.current?.focus();},[detail]);
  function closeDetail() {
    detailRequest.current?.abort();detailRequest.current=null;detailGeneration.current+=1;
    setDetail(null);setDetailError("");
  }
  async function openDetail(key:string,eventPage=0) {
    closeDetail();
    const controller=new AbortController(), generation=detailGeneration.current;
    detailRequest.current=controller;
    try {
      const result=await read(`${endpoint}?${new URLSearchParams({detail:key,eventPage:String(eventPage)})}`,controller.signal);
      if(!controller.signal.aborted&&generation===detailGeneration.current)setDetail(result);
    } catch(e){
      if(!controller.signal.aborted&&generation===detailGeneration.current)setDetailError(e instanceof Error ? e.message : "No se pudo abrir la ficha.");
    } finally {if(detailRequest.current===controller)detailRequest.current=null;}
  }
  function search(event:Event) {
    event.preventDefault();const next=new URLSearchParams();
    new FormData(form.current!).forEach((value,key)=>{if(String(value).trim())next.set(key,String(value).trim());});
    if(!audience){next.set("direction",tab==="outbound"?"outbound":"inbound");if(tab==="replies")next.set("replies","1");}
    closeDetail();setParams(next);
  }
  function movePage(index:number){closeDetail();const next=new URLSearchParams(params);next.set("page",String(index));setParams(next);}
  function changeTab(value:string){closeDetail();setTab(value);const next=new URLSearchParams(params);next.set("page","0");next.set("direction",value==="outbound"?"outbound":"inbound");next.delete("replies");if(value==="replies")next.set("replies","1");setParams(next);}
  function tabKey(event:KeyboardEvent,index:number) {
    let next=index;
    if(event.key==="ArrowRight")next=(index+1)%MESSAGE_TABS.length;
    else if(event.key==="ArrowLeft")next=(index+MESSAGE_TABS.length-1)%MESSAGE_TABS.length;
    else if(event.key==="Home")next=0;
    else if(event.key==="End")next=MESSAGE_TABS.length-1;
    else return;
    event.preventDefault();const value=MESSAGE_TABS[next][0];changeTab(value);tabButtons.current[value]?.focus();
  }
  async function download(){
    setExporting(true);setError("");
    try {const response=await fetch(endpoint,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirm:"DESCARGAR",query:params.toString()})});
      if(!response.ok)throw Error((await response.json()).error);
      const url=URL.createObjectURL(await response.blob()),anchor=document.createElement("a");anchor.href=url;anchor.download=`${audience?"audiencia":"comunicaciones"}-limitado.csv`;anchor.click();URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:"Exportación no disponible.");}finally{setExporting(false);}
  }
  const metric = (state:string) => totals.find(t=>t.dimension==="state"&&t.segment===state)?.total ?? 0;
  return <section class="admin-communications">
    <div class="admin-toolbar"><div><p class="comm-eyebrow">IMPERIO E · ADMINISTRACIÓN</p><h1>{audience?"Audiencia":"Comunicaciones"}</h1></div><button type="button" onClick={()=>{closeDetail();setRefresh(v=>v+1);}} disabled={busy}>Actualizar</button></div>
    <p class="comm-intro">{audience?"Contactos, clientes y preferencias conservados en la base actual. Una compra o una cuenta PIQUERO no equivale a una suscripción comercial.":"Consulta los mensajes registrados y sus estados reales. La cobertura depende de cada sistema conectado."}</p>
    <div class="comm-links"><a href={audience?"/admin/comunicaciones":"/admin/audiencia"}>{audience?"Ver comunicaciones":"Ver audiencia"}</a><a href="/admin/correos">Redactar correo</a><a href="/admin/newsletter">Campañas</a><a href="/admin/automatizaciones">Automatizaciones</a></div>
    <div class="comm-coverage" aria-label="Cobertura y conexión">
      <div><span class="comm-dot"/><strong>{coverage?.inbound_connected?"Buzón sincronizado":"Buzón entrante no sincronizado"}</strong><p>{coverage?.inbound_connected?"Consulta la fecha y el alcance de cada buzón conectado.":"No hay acceso verificado a IONOS. Esta pantalla no acredita que el buzón esté vacío ni que los clientes no hayan respondido."}</p></div>
      <div><span class="comm-caption">Consulta de las fuentes locales</span><strong>{coverage?date(coverage.checked_at):"Pendiente de consulta"}</strong><span class="comm-caption">Zona horaria: Europe/Madrid</span></div>
    </div>
    {audience&&<div class="admin-metrics comm-metrics" aria-label="Totales de toda la base"><div><span>Contactos totales</span><strong>{totals.length?totals.filter(t=>t.dimension==="state").reduce((n,t)=>n+Number(t.total),0):"—"}</strong></div>{["eligible","pending_verification","unsubscribed","suppressed","no_consent"].map(s=><div key={s}><span>{label(s)}</span><strong>{totals.length?metric(s):"—"}</strong></div>)}</div>}
    {!audience&&<div class="comm-tabs" role="tablist" aria-label="Tipo de consulta">{MESSAGE_TABS.map(([key,text],index)=><button type="button" key={key} id={`${tabsId}-${key}`} ref={element=>{tabButtons.current[key]=element;}} role="tab" aria-selected={tab===key} aria-controls={panelId} tabIndex={tab===key?0:-1} onKeyDown={event=>tabKey(event,index)} onClick={()=>changeTab(key)}>{text}</button>)}</div>}
    <div id={panelId} role={audience?undefined:"tabpanel"} aria-labelledby={audience?undefined:`${tabsId}-${tab}`} tabIndex={audience?undefined:0}>
    <form ref={form} class="comm-filters" onSubmit={search}>
      <label>Buscar por nombre o email{!audience&&" / asunto"}<input name="q" maxLength={100} type="search" autoComplete="off" placeholder="Buscar en el registro"/></label>
      <label>Estado<select name="state"><option value="">Todos los estados</option>{(audience?AUDIENCE_STATES:COMMUNICATION_STATES).map(s=><option value={s}>{label(s)}</option>)}</select></label>
      <label>{audience?"Origen":"Fuente"}<select name="source"><option value="">Todas las fuentes</option>{(audience?["piquero","camiseta","newsletter","manifiesto","popup_camiseta","supresion","verificacion","suscripcion_pago","campana","automatizacion"]:COMMUNICATION_SOURCES).map(s=><option value={s}>{s}</option>)}</select></label>
      <label>Desde (UTC)<input name="from" type="date"/></label><label>Hasta (UTC)<input name="to" type="date"/></label>
      <details class="comm-more"><summary>Más filtros</summary><div class="comm-filter-extra">
        {!audience&&<><label>Remitente exacto<input name="sender" maxLength={100}/></label><label>Proveedor<input name="provider" maxLength={40}/></label><label>Flujo / campaña<input name="flow" maxLength={80}/></label><label>ID de pedido<input name="order" maxLength={80}/></label><label>Tipo<select name="type"><option value="">Todos</option>{["transaccional","marketing","soporte","contacto"].map(s=><option value={s}>{s}</option>)}</select></label></>}
        <label>{audience?"Paso de Welcome Series":"Etapa"}<input name="stage" maxLength={80}/></label><label>Orden<select name="sort"><option value="newest">Más recientes</option><option value="oldest">Más antiguos</option></select></label><label>Filas por página<select name="pageSize"><option>25</option><option>10</option><option>50</option></select></label>
      </div></details>
      <button type="submit" disabled={busy}>Aplicar filtros</button>
    </form>
    {error&&<p role="alert" class="admin-error">{error}</p>}
    {!audience&&tab!=="outbound"&&!coverage?.inbound_connected&&<p class="comm-notice">No sincronizado: se necesita autorización de lectura del buzón y una importación de prueba. No se muestran mensajes de ejemplo.</p>}
    <div class="admin-toolbar"><p aria-live="polite">{busy?"Consultando…":error?"Consulta no disponible":`${page.total} ${audience?"contactos":"mensajes"} coinciden con los filtros`}</p>{page.export_allowed&&<button type="button" disabled={busy||exporting} onClick={download}>Descargar CSV (máximo 50 filas)</button>}</div>
    <div class="admin-table-wrap" aria-busy={busy}><table class="comm-table"><thead><tr>{(audience?["Contacto","Origen","Consentimiento / verificación","Welcome Series","Compra / envío","Ficha"]:["Fecha · Madrid","Cliente / destinatario","Asunto / referencia","Flujo y etapa","Estado real","Proveedor","Detalle"]).map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>
      {!busy&&page.items.length===0&&!error&&<tr><td colSpan={audience?6:7} class="admin-empty">{!audience&&tab!=="outbound"&&!coverage?.inbound_connected?"Buzón sin sincronizar. No se puede determinar su contenido.":"No hay registros que coincidan con estos filtros."}</td></tr>}
      {page.items.map(row=>audience?<tr key={row.email}><td data-label="Contacto"><strong>{row.name||"Nombre no registrado"}</strong><span>{row.email}</span><small>Alta: {date(row.created_at)}</small></td><td data-label="Origen">{row.sources.join(", ")}</td><td data-label="Consentimiento"><span class={`comm-badge is-${row.state}`}>{label(row.state)}</span><small>Verificación: {date(row.verified_at)}</small></td><td data-label="Welcome Series">{row.welcome_step||"Sin secuencia"}<small>{row.welcome_status?label(row.welcome_status):""}</small><small>Siguiente: {date(row.next_mail_at)}</small></td><td data-label="Compra / envío">{row.order_count} pedido(s)<small>Envío: {date(row.shipped_at)}</small><small>Recibido por cliente: {date(row.customer_received_at)}</small></td><td data-label="Ficha"><button type="button" onClick={()=>openDetail(row.email)}>Ver ficha</button></td></tr>:<tr key={row.id}><td data-label="Fecha · Madrid">{date(row.occurred_at)}</td><td data-label="Cliente / destinatario"><strong>{row.customer_name||"Nombre no registrado"}</strong><span>{row.recipient_email||"Destinatario no conservado"}</span>{row.email!==row.recipient_email&&row.email&&<small>Cliente asociado: {row.email}</small>}<small>De: {row.sender||"No conservado"}</small></td><td data-label="Asunto / referencia">{row.subject}{!row.subject_available&&<small>Referencia de plantilla; asunto histórico no conservado</small>}<small>{row.type} · {row.source}</small></td><td data-label="Flujo y etapa">{row.flow}<small>{row.stage}</small></td><td data-label="Estado real"><span class={`comm-badge is-${row.state}`}>{label(row.state)}</span></td><td data-label="Proveedor">{row.provider}<small>{row.provider_id||"Sin ID registrado"}</small></td><td data-label="Detalle"><button type="button" onClick={()=>openDetail(row.id)}>Ver detalle</button></td></tr>)}
    </tbody></table></div>
    <div class="admin-toolbar comm-pagination"><span>Página {page.page+1} de {Math.max(1,Math.ceil(page.total/page.pageSize))}</span><button type="button" disabled={busy||page.page===0} onClick={()=>movePage(page.page-1)}>Anterior</button><button type="button" disabled={busy||(page.page+1)*page.pageSize>=page.total} onClick={()=>movePage(page.page+1)}>Siguiente</button></div>
    {detailError&&<p role="alert" class="admin-error">{detailError}</p>}
    {detail&&<section class="comm-detail" aria-label={audience?"Ficha de contacto":"Detalle del mensaje"}><div class="admin-toolbar"><h2 tabIndex={-1} ref={heading}>{audience?(detail.contact.name||detail.contact.email):detail.subject}</h2><button type="button" onClick={closeDetail}>Cerrar detalle</button></div>
      {audience?<><p>{detail.contact.email} · <strong>{label(detail.contact.state)}</strong></p><p>La ficha reúne registros de la misma dirección normalizada y conserva sus IDs originales. No fusiona personas ni cambia consentimientos.</p><dl class="comm-data"><dt>Verificación</dt><dd>{date(detail.contact.verified_at)}</dd><dt>Consentimiento vigente</dt><dd>{detail.contact.marketing_accepted_at?date(detail.contact.marketing_accepted_at):"No consta consentimiento comercial vigente y verificable"}</dd><dt>Supresión</dt><dd>{detail.contact.suppression_reason|| (detail.contact.suppressed?"Baja o preferencia de no recibir":"No registrada")}</dd><dt>Último correo</dt><dd>{date(detail.contact.last_mail_at)}</dd></dl><h3>Cronología · fuentes originales</h3><ol class="comm-timeline">{detail.events.map((e:Row)=><li key={`${e.source}:${e.id}`}><time>{date(e.occurred_at)}</time><strong>{e.label} · {label(e.status)}</strong><small>{e.source}</small><div class="comm-metadata">{Object.entries(e.detail??{}).map(([k,v])=><span key={k}>{k}: {v===null?"No consta":String(v)}</span>)}</div></li>)}</ol><div class="admin-toolbar"><span>{detail.total} hitos · página {detail.page+1}</span><button type="button" disabled={!detail.page} onClick={()=>openDetail(detail.contact.email,detail.page-1)}>Hitos anteriores</button><button type="button" disabled={(detail.page+1)*25>=detail.total} onClick={()=>openDetail(detail.contact.email,detail.page+1)}>Más hitos</button></div><details><summary>Identificadores de las fuentes</summary><ul>{detail.contact.source_ids.map((s:Row)=><li>{s.source} · {s.id} · {date(s.created_at)}</li>)}</ul></details></>:<>
      <dl class="comm-data"><dt>Estado real</dt><dd>{label(detail.state)}</dd><dt>Destinatario</dt><dd>{detail.recipients?.join(", ")||detail.recipient_email||"No conservado en esta fuente"}</dd><dt>Cliente asociado</dt><dd>{detail.email||"Sin vínculo registrado"}</dd><dt>Asunto original</dt><dd>{detail.subject_available?detail.subject:"No conservado; se muestra una referencia de plantilla"}</dd><dt>Remitente</dt><dd>{detail.sender||"No conservado"}</dd><dt>Fuente / ID</dt><dd>{detail.source} · {detail.source_id}</dd><dt>Proveedor / ID</dt><dd>{detail.provider} · {detail.provider_id||"No conservado"}</dd><dt>Pedido</dt><dd>{detail.order_id||"Sin vínculo registrado"}</dd><dt>Intentos registrados</dt><dd>{detail.attempts}</dd><dt>Conversación</dt><dd>{detail.relation==="unlinked"?"Sin vincular por cabeceras verificables":"Vinculada por Message-ID / In-Reply-To"}</dd></dl>
      {detail.error&&<p class="admin-error">{detail.error}</p>}
      {detail.tracking&&<p class="comm-notice">Señal parcial del proveedor: {detail.tracking}. No prueba que la persona leyera el mensaje.</p>}
      {detail.body_available?<><h3>Vista inerte del contenido conservado</h3><p>Recursos remotos, formularios y enlaces activos bloqueados. Los enlaces de acceso y verificación se omiten.</p><iframe title="Contenido seguro del mensaje" sandbox="" referrerPolicy="no-referrer" srcDoc={detail.html}/><details><summary>Versión de texto</summary><pre class="comm-text">{detail.text}</pre></details>{detail.links.length>0&&<details><summary>Destinos sin parámetros sensibles (solo referencia)</summary><ul>{detail.links.map((link:string)=><li>{link}</li>)}</ul></details>}</>:<p class="comm-notice">La fuente conserva una referencia de plantilla, sin copia del cuerpo original. No se ha reconstruido un mensaje histórico.</p>}
      <h3>Hitos conservados</h3><ol class="comm-timeline">{detail.events.map((e:Row)=><li><time>{date(e.at)}</time><strong>{label(e.state)}</strong><small>{e.source}</small></li>)}</ol><p>{detail.event_limit}</p>
      {detail.related.length>0&&<><h3>Mensajes relacionados por cabeceras</h3><ul>{detail.related.map((r:Row)=><li><button type="button" onClick={()=>openDetail(r.id)}>{r.subject} · {date(r.occurred_at)}</button></li>)}</ul></>}
      {detail.attachments.length>0&&<><h3>Adjuntos</h3><ul>{detail.attachments.map((a:Row)=><li>{a.name} · {a.size} bytes · descarga bloqueada hasta habilitar almacenamiento privado y revisión de adjuntos</li>)}</ul></>}
      </>}
    </section>}
    <details class="comm-sources"><summary>Cobertura, fuentes y límites del historial</summary>{coverage?<><p>Consulta local: {date(coverage.checked_at)}. No implica una nueva sincronización con el proveedor.</p><div class="admin-table-wrap"><table><thead><tr><th>Fuente</th><th>Registros</th><th>Historial desde</th><th>Último registro</th><th>Última conciliación proveedor</th></tr></thead><tbody>{coverage.sources.map((s:Row)=><tr><td>{s.source}</td><td>{s.records}</td><td>{date(s.history_from)}</td><td>{date(s.latest_record)}</td><td>{date(s.last_provider_check)}</td></tr>)}</tbody></table></div>{coverage.mailboxes.map((b:Row)=><p>{b.label} · {b.state} · última sincronización {date(b.last_sync_at)} · retención {b.retention_days} días · desde {date(b.import_since)}</p>)}<ul>{coverage.limitations.map((s:string)=><li>{s}</li>)}</ul></>:<p>La cobertura aún no se ha podido consultar. Comprueba la conexión y las migraciones privadas.</p>}</details>
    {audience&&totals.length>0&&<details class="comm-sources"><summary>Totales por origen, Welcome Series y posentrega</summary><ul>{totals.filter(t=>t.dimension!=="state").map(t=><li>{t.dimension} · {t.segment}: {t.total}</li>)}</ul></details>}
    </div>
  </section>;
}
