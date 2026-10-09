import {useEffect,useState} from "preact/hooks";
import {formatMoney} from "../../config/commerce";
type Account={id:string;email:string;name:string;confirmed:boolean;plan:string;created_at:string;notifications:number};
type Notice={id:string;subject:string;customer_email:string;occurred_at:string;kind:string;delivery_status:string;source_url?:string};
type Result={accounts:Account[];notices:Notice[];subscriptions:{verified:{status:string}[];unresolved:unknown[];archived:unknown[]};reservations:{status:string;total_quantity:number}[];orders:{total:number;status:string}[];checkouts:{status:string}[];interaction:{events?:unknown[]}};
export default function Overview(){
  const [data,setData]=useState<Result|null>(null),[error,setError]=useState(""),[query,setQuery]=useState(""),[tab,setTab]=useState("accounts"),[refresh,setRefresh]=useState(0);
  useEffect(()=>{const controller=new AbortController();setError("");
    fetch("/api/admin/overview",{cache:"no-store",signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error??"No se pudo cargar el resumen.");return d;}).then(setData).catch(e=>{if(e.name!=="AbortError")setError(e.message);});return()=>controller.abort();},[refresh]);
  const date=(v:string)=>new Date(v).toLocaleString("es-ES",{timeZone:"Europe/Madrid"});
  const visible=(v:string)=>v.toLowerCase().includes(query.trim().toLowerCase());
  return <section><div class="admin-toolbar"><h1>Resumen</h1><button onClick={()=>setRefresh(n=>n+1)}>Actualizar</button></div>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Cargando actividad...</p>}
    {data&&<><div class="admin-metrics">
      <div><span>Cuentas registradas</span><strong>{data.accounts.length}</strong></div><div><span>Correos confirmados</span><strong>{data.accounts.filter(a=>a.confirmed).length}</strong></div>
      <div><span>Suscripciones activas verificadas</span><strong>{data.subscriptions.verified.filter(s=>s.status==="active").length}</strong></div><div><span>Avisos registrados</span><strong>{data.notices.length}</strong></div>
      <div><span>Reservas con stock</span><strong>{data.reservations.filter(r=>["RESERVED","PURCHASE_AVAILABLE","PAYMENT_PENDING","PAYMENT_FAILED"].includes(r.status)).length}</strong></div>
      <div><span>Pedidos pagados</span><strong>{data.orders.filter(o=>!['CANCELLED','REFUNDED'].includes(o.status)).length}</strong></div>
      <div><span>Ventas de camisetas</span><strong>{formatMoney(data.orders.filter(o=>!['CANCELLED','REFUNDED'].includes(o.status)).reduce((sum,o)=>sum+o.total,0))}</strong></div><div><span>Historicas archivadas</span><strong>{data.subscriptions.archived.length}</strong></div>
    </div><nav class="admin-toolbar" aria-label="Actividad"><a href="/admin/suscripciones">Suscripciones</a><a href="/admin/comercio">Reservas, pedidos y stock</a><a href="/admin/interacciones">Interacciones y consentimientos</a><a href="/admin/articles">Articulos</a></nav>
    <div class="admin-toolbar" role="tablist"><button role="tab" aria-selected={tab==="accounts"} onClick={()=>setTab("accounts")}>Cuentas</button><button role="tab" aria-selected={tab==="notices"} onClick={()=>setTab("notices")}>Avisos de correo</button><label>Buscar <input type="search" value={query} onInput={e=>setQuery(e.currentTarget.value)}/></label></div>
    <div class="admin-table-wrap" role="tabpanel">{tab==="accounts"?<table><thead><tr><th>Nombre</th><th>Correo</th><th>Cuenta</th><th>Plan</th><th>Registro</th><th>Avisos</th></tr></thead><tbody>{data.accounts.filter(a=>visible(a.email+" "+a.name)).map(a=><tr key={a.id}><td>{a.name||"No facilitado"}</td><td>{a.email}</td><td>{a.confirmed?"Confirmada":"Pendiente de confirmar"}</td><td>{a.plan==="piquero"?"Piquero gratuito":a.plan==="arcabucero"?"Arcabucero":"Maestre de Campo"}</td><td>{date(a.created_at)}</td><td>{a.notifications}</td></tr>)}</tbody></table>:<table><thead><tr><th>Fecha</th><th>Aviso</th><th>Correo</th><th>Tipo</th><th>Entrega</th></tr></thead><tbody>{data.notices.filter(n=>visible(n.customer_email+" "+n.subject)).map(n=><tr key={n.id}><td>{date(n.occurred_at)}</td><td>{n.source_url?<a href={n.source_url} target="_blank" rel="noopener noreferrer">{n.subject}</a>:n.subject}</td><td>{n.customer_email}</td><td>{n.kind==="registration"?"Registro gratuito":n.kind==="checkout_interest"?"Intento sin pago confirmado":n.kind==="paid_subscription"?"Pago confirmado":"Manifiesto"}</td><td>{n.delivery_status==="received_in_owner_inbox"?"Recibido en Gmail":"Aceptado por proveedor"}</td></tr>)}</tbody></table>}</div></>}
  </section>;
}
