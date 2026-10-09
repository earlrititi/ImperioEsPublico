import { useEffect,useRef,useState } from "preact/hooks";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { createElement,Bold,Italic,Heading2,Heading3,List,ListOrdered,Quote,Link,Image as ImageIcon,Undo,Redo,type IconNode } from "lucide";
import type { ArticleDraft } from "../../lib/admin-article-content";
const empty: ArticleDraft={title:"",slug:"",lead:"",category:"Siglo de Oro",author:"Imperio E",imageSrc:"",imageAlt:"",imageCaption:"",publishedAt:"",seoTitle:"",description:"",body:"<p></p>"};
type Saved={id:string;slug:string;status:string;revision:number;draft:ArticleDraft};
type Row=Pick<Saved,"id"|"slug"|"status"|"revision">;
function Icon({node}:{node:IconNode}) {
  const ref=useRef<HTMLSpanElement>(null);
  useEffect(()=>{ref.current?.replaceChildren(createElement(node,{width:18,height:18,"aria-hidden":"true"}));},[node]);
  return <span ref={ref}/>;
}
async function api(path:string,body?:unknown) {
  const response=await fetch(path,body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:undefined);
  const data=await response.json();
  if(!response.ok)throw new Error(data.error??"No se pudo completar la operacion.");
  return data;
}
export default function ArticleEditor() {
  const host=useRef<HTMLDivElement>(null),editor=useRef<Editor|null>(null);
  const [draft,setDraft]=useState<ArticleDraft>(empty),[record,setRecord]=useState<{id:string;revision:number}|null>(null);
  const [items,setItems]=useState<Row[]>([]),[page,setPage]=useState(0),[total,setTotal]=useState(0);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[dirty,setDirty]=useState(false);
  const [message,setMessage]=useState(""),[error,setError]=useState(""),[preview,setPreview]=useState("");
  const [refresh,setRefresh]=useState(0),[ready,setReady]=useState(false);
  const [status,setStatus]=useState("draft");
  const [legacy,setLegacy]=useState<{slug:string;title:string}[]>([]),[legacySlug,setLegacySlug]=useState("");
  useEffect(()=>{
    if(!host.current)return;
    const instance=new Editor({element:host.current,extensions:[StarterKit.configure({heading:{levels:[2,3]},link:{openOnClick:false}}),Image],content:empty.body,
      editorProps:{attributes:{"aria-label":"Contenido del articulo",role:"textbox","aria-multiline":"true"}},
      onUpdate:({editor:e})=>{setDraft(d=>({...d,body:e.getHTML()}));setDirty(true);setPreview("");}});
    editor.current=instance;setReady(true);
    return ()=>{editor.current=null;instance.destroy();};
  },[]);
  useEffect(()=>{editor.current?.setEditable(!busy);},[busy]);
  useEffect(()=>{
    let current=true;setLoading(true);
    api(`/api/admin/articles?page=${page}`).then(data=>{if(current){setItems(data.items);setTotal(data.total);setLegacy(data.legacy??[]);}})
      .catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setLoading(false);});
    return ()=>{current=false;};
  },[page,refresh]);
  useEffect(()=>{
    if(!dirty)return;
    const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",prevent);return ()=>window.removeEventListener("beforeunload",prevent);
  },[dirty]);
  function change(key:keyof ArticleDraft,value:string){setDraft(d=>({...d,[key]:value}));setDirty(true);setPreview("");setMessage("");}
  async function open(id?:string) {
    if(dirty && !confirm("Hay cambios sin guardar. Descartarlos?"))return;
    setBusy(true);setError("");setMessage("");setPreview("");
    try {
      const saved:Saved|undefined=id?await api(`/api/admin/articles?id=${id}`):undefined;
      const next=saved?.draft??{...empty};
      setDraft(next);setRecord(saved?{id:saved.id,revision:saved.revision}:null);
      setStatus(saved?.status??"draft");
      editor.current?.commands.setContent(next.body,{emitUpdate:false});setDirty(false);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function submit(action:"save"|"preview") {
    setBusy(true);setError("");setMessage("");
    const identity=record??{id:crypto.randomUUID(),revision:0};
    // Keep the request ID if the response is lost; never create a second draft silently.
    if(action==="save"&&!record)setRecord(identity);
    try {
      const result=await api("/api/admin/articles",{action,...identity,draft});
      if(action==="preview")setPreview(result.html);
      else {setStatus(result.status);setRecord({id:result.id,revision:result.revision});setDraft(result.draft);editor.current?.commands.setContent(result.draft.body,{emitUpdate:false});setDirty(false);setMessage("Borrador guardado.");setRefresh(n=>n+1);}
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function transition(action:"publish"|"withdraw"|"delete") {
    if(!record || dirty)return;
    const question=action==="publish"?"Publicar esta revision en la web?":action==="withdraw"?"Retirar el articulo de la web?":"Eliminar este borrador?";
    if(!confirm(question))return;
    setBusy(true);setError("");setMessage("");
    try {
      const saved:Saved=await api("/api/admin/articles",{action,...record});
      setRecord(action==="delete"?null:{id:saved.id,revision:saved.revision});setStatus(saved.status);
      if(action==="delete"){setDraft({...empty});editor.current?.commands.setContent(empty.body,{emitUpdate:false});setStatus("draft");}
      setMessage(action==="publish"?"Articulo publicado.":action==="withdraw"?"Articulo retirado.":"Borrador eliminado.");setPreview("");setRefresh(n=>n+1);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function importLegacy(){
    if(!legacySlug || (dirty&&!confirm("Descartar cambios sin guardar?")))return;
    setBusy(true);setError("");
    try{const saved:Saved=await api("/api/admin/articles",{action:"import",id:crypto.randomUUID(),slug:legacySlug});
      setDraft(saved.draft);setRecord({id:saved.id,revision:saved.revision});setStatus(saved.status);setDirty(false);
      editor.current?.commands.setContent(saved.draft.body,{emitUpdate:false});setPreview("");setRefresh(n=>n+1);setMessage("Articulo importado. La web no cambia hasta publicar.");
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const tools: [string,IconNode,()=>void][]=[
    ["Negrita",Bold,()=>{editor.current?.chain().focus().toggleBold().run();}],
    ["Cursiva",Italic,()=>{editor.current?.chain().focus().toggleItalic().run();}],
    ["Titulo H2",Heading2,()=>{editor.current?.chain().focus().toggleHeading({level:2}).run();}],
    ["Titulo H3",Heading3,()=>{editor.current?.chain().focus().toggleHeading({level:3}).run();}],
    ["Lista",List,()=>{editor.current?.chain().focus().toggleBulletList().run();}],
    ["Lista numerada",ListOrdered,()=>{editor.current?.chain().focus().toggleOrderedList().run();}],
    ["Cita",Quote,()=>{editor.current?.chain().focus().toggleBlockquote().run();}],
    ["Enlace",Link,()=>{const href=prompt("URL del enlace",editor.current?.getAttributes("link").href??"https://");if(href===null)return;if(!href)editor.current?.chain().focus().unsetLink().run();else if(/^(https?:\/\/|\/(?!\/)|#)/.test(href))editor.current?.chain().focus().setLink({href}).run();else setError("URL no valida.");}],
    ["Imagen",ImageIcon,()=>{const src=prompt("Ruta de la imagen","/images/");if(!src)return;const alt=prompt("Texto alternativo")??"";editor.current?.chain().focus().setImage({src,alt}).run();}],
    ["Deshacer",Undo,()=>{editor.current?.chain().focus().undo().run();}],
    ["Rehacer",Redo,()=>{editor.current?.chain().focus().redo().run();}],
  ];
  const fields: [keyof ArticleDraft,string][]=[["title","Titulo"],["slug","Slug"],["category","Categoria"],["author","Autor"],["lead","Entradilla"],["publishedAt","Fecha"],["imageSrc","Imagen principal"],["imageAlt","Texto alternativo"],["imageCaption","Pie de imagen"],["seoTitle","Titulo SEO"],["description","Meta description"]];
  return <>
    <div class="admin-toolbar"><h1>Articulos</h1><button disabled={busy||!ready} onClick={()=>open()}>Nuevo borrador</button></div>
    <div class="admin-toolbar"><label>Articulo existente <select value={legacySlug} disabled={busy} onChange={e=>setLegacySlug(e.currentTarget.value)}><option value="">Seleccionar articulo</option>{legacy.map(a=><option key={a.slug} value={a.slug}>{a.title}</option>)}</select></label><button disabled={busy||!ready||!legacySlug} onClick={importLegacy}>Importar al editor</button></div>
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    <div class="admin-table-wrap" aria-busy={loading}><table><thead><tr><th>Slug</th><th>Estado</th><th>Revision</th><th></th></tr></thead><tbody>
      {items.map(item=><tr key={item.id}><td>{item.slug}</td><td>{item.status}</td><td>{item.revision}</td><td><button disabled={busy||!ready} onClick={()=>open(item.id)}>Editar</button></td></tr>)}
    </tbody></table>{loading?<p role="status">Cargando...</p>:!items.length&&<p>No hay borradores.</p>}</div>
    <div class="admin-toolbar"><button disabled={page===0||loading} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>{page+1} / {Math.max(1,Math.ceil(total/25))}</span><button disabled={(page+1)*25>=total||loading} onClick={()=>setPage(p=>p+1)}>Siguiente</button></div>
    <form onSubmit={event=>{event.preventDefault();submit("save");}} class="admin-article-form">
      <fieldset disabled={busy}><legend>{record?"Editar borrador":"Nuevo borrador"}{dirty?" *":""}</legend><div class="admin-article-fields">
        {fields.map(([key,label])=><label key={key}>{label}<input type={key==="publishedAt"?"date":"text"} value={draft[key]} required={["title","slug","category","author"].includes(key)} onInput={e=>change(key,e.currentTarget.value)}/></label>)}
      </div><div class="admin-toolbar" role="toolbar" aria-label="Formato">{tools.map(([label,node,run])=><button type="button" class="admin-icon-button" key={label} title={label} aria-label={label} disabled={!ready} onClick={run}><Icon node={node}/></button>)}</div>
      <div class="admin-article-editor" ref={host}/><div class="admin-toolbar"><button type="submit" disabled={!ready}>Guardar borrador</button><button type="button" disabled={!ready} onClick={()=>submit("preview")}>Previsualizar</button></div></fieldset>
      {record&&<div class="admin-toolbar"><button type="button" disabled={busy||dirty} onClick={()=>transition("publish")}>{status==="published"?"Publicar cambios":"Publicar"}</button>{status==="published"?<><a href={`/papeles-y-tratados/${draft.slug}`} target="_blank" rel="noopener noreferrer">Ver articulo</a><button type="button" disabled={busy||dirty} onClick={()=>transition("withdraw")}>Retirar</button></>:<button type="button" disabled={busy||dirty} onClick={()=>transition("delete")}>Eliminar</button>}</div>}
    </form>
    {preview&&<section><div class="admin-toolbar"><h2>Vista previa</h2><button onClick={()=>setPreview("")}>Cerrar</button></div><iframe title="Vista previa del articulo" sandbox="" srcDoc={preview}/></section>}
  </>;
}
