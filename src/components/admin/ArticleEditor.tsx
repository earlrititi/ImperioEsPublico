import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { createElement, ArrowLeft, ArrowUpRight, Bold, BookOpen, Check, Eye, FileText, Heading2, Heading3, Image as ImageIcon, Italic, Link, List, ListOrdered, Plus, Quote, Redo, RotateCcw, Save, Search, Send, Trash2, Undo, Upload, X, type IconNode } from "lucide";
import type { ArticleDraft } from "../../lib/admin-article-content";
import { articlePublicationIssues, articleSlug } from "../../lib/admin-article-editor";
import type { ArticleLibraryRow, ArticleState } from "../../lib/admin-article-library";

const empty: ArticleDraft = { title: "", slug: "", lead: "", category: "Siglo de Oro", author: "Imperio E", imageSrc: "", imageAlt: "", imageCaption: "", publishedAt: "", seoTitle: "", description: "", body: "<p></p>" };
const newDraft = () => ({ ...empty, publishedAt: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) });
type Saved = { id: string; slug: string; status: ArticleState; revision: number; draft: ArticleDraft; isPublic: boolean; slugLocked: boolean; updated_at?: string };
type Identity = { id: string; revision: number };
type Action = "publish" | "withdraw" | "delete" | "restore";
type Confirmation = { action: Action; row?: ArticleLibraryRow } | { action: "discard"; proceed: () => void };
const labels: Record<ArticleState, string> = { draft: "Borrador", published: "Publicado", withdrawn: "Retirado", deleted: "Papelera" };
const filters = [["all", "Todos"], ["published", "Publicados"], ["draft", "Borradores"], ["withdrawn", "Retirados"], ["deleted", "Papelera"]] as const;

function Icon({ node }: { node: IconNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { ref.current?.replaceChildren(createElement(node, { width: 18, height: 18, "aria-hidden": "true" })); }, [node]);
  return <span ref={ref} class="admin-button-icon" />;
}

function Modal({ title, children, onClose, busy = false }: { title: string; children: ComponentChildren; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} class="admin-article-dialog" aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    {children}
  </dialog>;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, body ? {
    method: "POST", cache: "no-store", headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : JSON.stringify(body),
  } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "No se pudo completar la operacion.");
  return data;
}

export default function ArticleEditor() {
  const host = useRef<HTMLDivElement>(null), editor = useRef<Editor | null>(null), fileInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null), uploadTarget = useRef<"cover" | "body">("cover");
  const [view, setView] = useState<"library" | "edit">("library");
  const [draft, setDraft] = useState<ArticleDraft>(newDraft), [article, setArticle] = useState<Saved | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [items, setItems] = useState<ArticleLibraryRow[]>([]), [page, setPage] = useState(0), [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(""), [error, setError] = useState(""), [preview, setPreview] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [refresh, setRefresh] = useState(0), [ready, setReady] = useState(false), [, updateTools] = useState(0);
  const [filter, setFilter] = useState("all"), [search, setSearch] = useState(""), [query, setQuery] = useState(""), [slugTouched, setSlugTouched] = useState(false);
  const status = article?.status ?? "draft";

  useEffect(() => {
    if (view !== "edit" || !host.current) return;
    const instance = new Editor({
      element: host.current, extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } }), Image], content: draft.body,
      editorProps: { attributes: { "aria-label": "Contenido del articulo", role: "textbox", "aria-multiline": "true" } },
      onUpdate: ({ editor: current }) => { setDraft(value => ({ ...value, body: current.getHTML() })); setDirty(true); setPreview(""); setMessage(""); },
      onTransaction: () => updateTools(value => value + 1),
    });
    editor.current = instance; setReady(true);
    return () => { editor.current = null; instance.destroy(); setReady(false); };
  }, [view]);
  // UI locks are not content edits. Tiptap otherwise emits an update here.
  useEffect(() => { editor.current?.setEditable(!busy && status !== "deleted", false); }, [busy, status, ready]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    let current = true; setLoading(true);
    api<{ items: ArticleLibraryRow[]; total: number; page: number; counts: Record<string, number> }>(`/api/admin/articles?page=${page}&status=${filter}&search=${encodeURIComponent(query)}`)
      .then(data => { if (current) { setItems(data.items); setTotal(data.total); setCounts(data.counts); if (page !== data.page) setPage(data.page); } })
      .catch(reason => { if (current) setError(reason.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [page, refresh, filter, query]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent); return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  function change(key: keyof ArticleDraft, value: string) {
    setDraft(current => ({ ...current, [key]: value,
      ...(key === "title" ? { ...(!article && !slugTouched ? { slug: articleSlug(value) } : {}), ...(current.seoTitle === current.title || !current.seoTitle ? { seoTitle: value } : {}) } : {}),
      ...(key === "lead" && (!current.description || current.description === current.lead.slice(0, 160)) ? { description: value.slice(0, 160) } : {}),
    }));
    if (key === "slug") setSlugTouched(true);
    setDirty(true); setPreview(""); setMessage(""); setError("");
  }
  function applySaved(saved: Saved) {
    setArticle(saved); setIdentity({ id: saved.id, revision: saved.revision }); setDraft(saved.draft); setSlugTouched(true); setDirty(false);
    editor.current?.commands.setContent(saved.draft.body, { emitUpdate: false });
  }
  function leave(proceed: () => void) {
    if (dirty) { setError(""); setConfirmation({ action: "discard", proceed }); } else proceed();
  }
  function create() {
    leave(() => { setArticle(null); setIdentity(null); setDraft(newDraft()); setSlugTouched(false); setDirty(false); setError(""); setMessage(""); setPreview(""); editor.current?.commands.setContent(empty.body, { emitUpdate: false }); setView("edit"); });
  }
  function library() { leave(() => { setView("library"); setDirty(false); setPreview(""); setError(""); }); }
  async function resolveRow(row: ArticleLibraryRow): Promise<Saved> {
    return row.id ? api<Saved>(`/api/admin/articles?id=${row.id}`) : api<Saved>("/api/admin/articles", { action: "import", id: crypto.randomUUID(), slug: row.slug });
  }
  async function open(row: ArticleLibraryRow) {
    setBusy(true); setError(""); setMessage(""); setPreview("");
    try { applySaved(await resolveRow(row)); setView("edit"); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  async function persist(): Promise<Saved> {
    const request = identity ?? { id: crypto.randomUUID(), revision: 0 };
    // Reuse the same ID after a lost response rather than creating duplicate drafts.
    if (!identity) setIdentity(request);
    const saved = await api<Saved>("/api/admin/articles", { action: "save", ...request, draft });
    applySaved(saved); setRefresh(value => value + 1); return saved;
  }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try { await persist(); setMessage("Borrador guardado."); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  async function showPreview() {
    if (!form.current?.reportValidity()) return;
    setBusy(true); setError("");
    try { setPreview((await api<{ html: string }>("/api/admin/articles", { action: "preview", draft })).html); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  function ask(action: Action, row?: ArticleLibraryRow) {
    if (action === "publish") {
      if (!form.current?.reportValidity()) return;
      const issues = articlePublicationIssues(draft);
      if (issues.length) { setError(`Completa antes de publicar: ${issues.join(", ")}.`); return; }
    }
    setError(""); setConfirmation({ action, row });
  }
  async function confirm() {
    if (!confirmation) return;
    if (confirmation.action === "discard") { confirmation.proceed(); setConfirmation(null); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const { action, row } = confirmation;
      let target: Identity | null = row?.id ? { id: row.id, revision: row.revision } : row ? await resolveRow(row) : identity;
      if (action === "publish" && (dirty || !article)) target = await persist();
      if (!target) throw Error("Articulo no encontrado.");
      const saved = await api<Saved>("/api/admin/articles", { action, id: target.id, revision: target.revision });
      if (action === "delete") { setDirty(false); setArticle(null); setIdentity(null); setView("library"); }
      else if (!row) applySaved(saved);
      setMessage(action === "publish" ? "Articulo publicado." : action === "withdraw" ? "Articulo retirado." : action === "restore" ? "Articulo restaurado sin publicar." : "Articulo movido a la papelera.");
      setPreview(""); setConfirmation(null); setRefresh(value => value + 1);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  function pickImage(target: "cover" | "body") { uploadTarget.current = target; fileInput.current?.click(); }
  async function upload(file: File) {
    if (file.size > 3 * 1024 * 1024) { setError("La imagen debe ocupar como maximo 3 MB."); return; }
    const target = uploadTarget.current; setBusy(true); setError("");
    try {
      const body = new FormData(); body.append("file", file);
      const result = await api<{ src: string }>("/api/admin/article-media", body);
      if (target === "cover") change("imageSrc", result.src);
      else { const alt = prompt("Texto alternativo de la imagen") ?? ""; editor.current?.chain().focus().setImage({ src: result.src, alt }).run(); }
      setMessage("Imagen subida.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  const tools: { label: string; icon: IconNode; active?: boolean; disabled?: boolean; run: () => void }[] = [
    { label: "Negrita", icon: Bold, active: editor.current?.isActive("bold"), run: () => { editor.current?.chain().focus().toggleBold().run(); } },
    { label: "Cursiva", icon: Italic, active: editor.current?.isActive("italic"), run: () => { editor.current?.chain().focus().toggleItalic().run(); } },
    { label: "Titulo H2", icon: Heading2, active: editor.current?.isActive("heading", { level: 2 }), run: () => { editor.current?.chain().focus().toggleHeading({ level: 2 }).run(); } },
    { label: "Titulo H3", icon: Heading3, active: editor.current?.isActive("heading", { level: 3 }), run: () => { editor.current?.chain().focus().toggleHeading({ level: 3 }).run(); } },
    { label: "Lista", icon: List, active: editor.current?.isActive("bulletList"), run: () => { editor.current?.chain().focus().toggleBulletList().run(); } },
    { label: "Lista numerada", icon: ListOrdered, active: editor.current?.isActive("orderedList"), run: () => { editor.current?.chain().focus().toggleOrderedList().run(); } },
    { label: "Cita", icon: Quote, active: editor.current?.isActive("blockquote"), run: () => { editor.current?.chain().focus().toggleBlockquote().run(); } },
    { label: "Enlace", icon: Link, active: editor.current?.isActive("link"), run: () => { const href = prompt("URL del enlace", editor.current?.getAttributes("link").href ?? "https://"); if (href === null) return; if (!href) editor.current?.chain().focus().unsetLink().run(); else if (/^(https?:\/\/|\/(?!\/)|#)/.test(href)) editor.current?.chain().focus().setLink({ href }).run(); else setError("URL no valida."); } },
    { label: "Subir imagen", icon: ImageIcon, run: () => pickImage("body") },
    { label: "Fuentes y bibliografia", icon: BookOpen, run: () => { editor.current?.chain().focus().insertContent("<h2>Fuentes y bibliografia</h2><p></p>").run(); } },
    { label: "Deshacer", icon: Undo, disabled: !editor.current?.can().undo(), run: () => { editor.current?.chain().focus().undo().run(); } },
    { label: "Rehacer", icon: Redo, disabled: !editor.current?.can().redo(), run: () => { editor.current?.chain().focus().redo().run(); } },
  ];
  function field(key: keyof ArticleDraft, label: string, options: { required?: boolean; readOnly?: boolean; multiline?: boolean } = {}) {
    const id = `article-${key}`;
    return <label for={id}>{label}{options.multiline ? <textarea id={id} rows={3} value={draft[key]} onInput={event => change(key, event.currentTarget.value)} /> :
      <input id={id} type={key === "publishedAt" ? "date" : "text"} value={draft[key]} required={options.required} readOnly={options.readOnly} onInput={event => change(key, event.currentTarget.value)} />}</label>;
  }
  const date = (value: string | null) => value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(new Date(value)) : "";
  const actionTitle = confirmation?.action === "delete" ? "Eliminar articulo" : confirmation?.action === "restore" ? "Restaurar sin publicar" : confirmation?.action === "withdraw" ? "Retirar articulo" : confirmation?.action === "discard" ? "Descartar cambios" : "Publicar articulo";
  const confirmationTitle = confirmation && "row" in confirmation ? confirmation.row?.title ?? draft.title : draft.title;

  return <div class="admin-articles">
    <input hidden type="file" ref={fileInput} accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void upload(file); }} />
    {view === "library" ? <>
      <div class="admin-toolbar admin-article-heading"><h1>Articulos</h1><button class="admin-primary" onClick={create} disabled={busy}><Icon node={Plus} /> Crear articulo</button></div>
      <div class="admin-article-library-tools">
        <div role="tablist" aria-label="Estado de los articulos" class="admin-article-tabs">{filters.map(([value, label]) => <button key={value} role="tab" aria-selected={filter === value} aria-controls="article-library" disabled={busy} onClick={() => { setFilter(value); setPage(0); setError(""); }}>{label}{counts[value] !== undefined && <span>{counts[value]}</span>}</button>)}</div>
        <label class="admin-article-search"><Icon node={Search} /><input type="search" aria-label="Buscar articulos" placeholder="Buscar articulos" value={search} maxLength={100} onInput={event => setSearch(event.currentTarget.value)} /></label>
      </div>
      {error && !confirmation && <p role="alert" class="admin-error">{error}</p>}{message && <p role="status" class="admin-success"><Icon node={Check} />{message}</p>}
      <div id="article-library" role="tabpanel" class="admin-table-wrap" aria-busy={loading}>
        <table class="admin-article-table"><thead><tr><th>Articulo</th><th>Estado</th><th class="admin-article-date">Actualizado</th><th><span class="admin-sr-only">Acciones</span></th></tr></thead><tbody>
          {items.map(row => <tr key={row.id ?? row.slug}>
            <td><button class="admin-article-title" onClick={() => void open(row)} disabled={busy || loading}>{row.title}</button><span class="admin-article-slug">/{row.slug}</span></td>
            <td><span class={`admin-article-badge is-${row.status}`}>{labels[row.status]}</span></td>
            <td class="admin-article-date">{date(row.updated_at)}</td>
            <td><div class="admin-row-actions">{row.status === "deleted" ? <button class="admin-icon-button" aria-label={`Restaurar ${row.title}`} title="Restaurar sin publicar" disabled={busy || loading} onClick={() => ask("restore", row)}><Icon node={RotateCcw} /></button> : <>
              <button class="admin-icon-button" aria-label={`Editar ${row.title}`} title="Editar" disabled={busy || loading} onClick={() => void open(row)}><Icon node={FileText} /></button>
              <button class="admin-icon-button admin-danger-quiet" aria-label={`Eliminar ${row.title}`} title="Eliminar" disabled={busy || loading} onClick={() => ask("delete", row)}><Icon node={Trash2} /></button>
            </>}</div></td>
          </tr>)}
        </tbody></table>
        {loading ? <p role="status" class="admin-empty">Cargando articulos...</p> : !items.length && <div class="admin-empty"><Icon node={filter === "deleted" ? Trash2 : FileText} /><p>{filter === "deleted" ? "La papelera esta vacia." : "No hay articulos en esta vista."}</p>{!search && filter !== "deleted" && <button onClick={create}><Icon node={Plus} /> Crear articulo</button>}</div>}
      </div>
      <div class="admin-toolbar admin-article-pagination"><span>{total} {total === 1 ? "articulo" : "articulos"}</span><button disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>Anterior</button><span>{page + 1} / {Math.max(1, Math.ceil(total / 25))}</span><button disabled={(page + 1) * 25 >= total || loading} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
    </> : <>
      <div class="admin-editor-bar">
        <button class="admin-icon-button" title="Volver a articulos" aria-label="Volver a articulos" disabled={busy} onClick={library}><Icon node={ArrowLeft} /></button>
        <div class="admin-editor-heading"><h1>{article ? "Editar articulo" : "Nuevo articulo"}</h1><span class={`admin-article-badge is-${article?.isPublic ? "published" : status}`}>{dirty ? "Cambios sin guardar" : article ? labels[article.isPublic ? "published" : status] : "Nuevo borrador"}</span></div>
        <div class="admin-editor-actions"><button disabled={busy || !ready} onClick={() => void showPreview()}><Icon node={Eye} /> Previsualizar</button><button disabled={busy || !ready || (!dirty && Boolean(article))} onClick={() => form.current?.requestSubmit()}><Icon node={Save} /> Guardar borrador</button>{status !== "deleted" && <button class="admin-primary" disabled={busy || !ready} onClick={() => ask("publish")}><Icon node={Send} />{article?.isPublic ? "Publicar cambios" : "Publicar"}</button>}</div>
      </div>
      {error && !confirmation && <p role="alert" class="admin-error">{error}</p>}{message && <p role="status" class="admin-success"><Icon node={Check} />{message}</p>}
      <form ref={form} class="admin-article-form admin-editor-form" onSubmit={event => { event.preventDefault(); void save(); }}>
        <fieldset disabled={busy || status === "deleted"}><legend class="admin-sr-only">{article ? labels[status] : "Nuevo articulo"}{dirty ? " *" : ""}</legend>
          <div class="admin-editor-layout"><section class="admin-editor-content" aria-label="Contenido editorial">
            {field("title", "Titulo", { required: true })}{field("lead", "Entradilla", { multiline: true })}
            <div class="admin-toolbar admin-format-toolbar" role="toolbar" aria-label="Formato">{tools.map(tool => <button type="button" class="admin-icon-button" key={tool.label} title={tool.label} aria-label={tool.label} aria-pressed={tool.active} disabled={!ready || tool.disabled} onClick={tool.run}><Icon node={tool.icon} /></button>)}</div>
            <div class="admin-article-editor" ref={host} />
          </section><section class="admin-editor-settings" aria-label="Ajustes del articulo">
            <details open><summary>Publicacion</summary><div class="admin-editor-fields">{field("slug", "URL del articulo", { required: true, readOnly: article?.slugLocked })}{field("category", "Categoria", { required: true })}{field("author", "Autor", { required: true })}{field("publishedAt", "Fecha", { required: true })}{article?.isPublic && <a class="admin-public-article" href={`/papeles-y-tratados/${article.slug}`} target="_blank" rel="noopener noreferrer">Ver en la web <Icon node={ArrowUpRight} /></a>}</div></details>
            <details open><summary>Imagen principal</summary><div class="admin-editor-fields"><button type="button" onClick={() => pickImage("cover")}><Icon node={Upload} /> Subir imagen principal</button>{draft.imageSrc && <img class="admin-cover-preview" src={draft.imageSrc} alt={draft.imageAlt} width="320" height="200" />}{field("imageSrc", "Archivo de imagen")}{field("imageAlt", "Texto alternativo")}{field("imageCaption", "Pie de imagen")}</div></details>
            <details><summary>SEO</summary><div class="admin-editor-fields">{field("seoTitle", "Titulo SEO")}{field("description", "Meta description", { multiline: true })}</div></details>
          </section></div>
        </fieldset>
      </form>
      {article && <div class="admin-toolbar admin-editor-lifecycle">{article.status === "deleted" ? <button disabled={busy} onClick={() => ask("restore")}><Icon node={RotateCcw} /> Restaurar sin publicar</button> : <>{article.isPublic && <button disabled={busy} onClick={() => ask("withdraw")}><Icon node={Eye} /> Retirar de la web</button>}<button class="admin-danger-quiet" disabled={busy} onClick={() => ask("delete")}><Icon node={Trash2} /> Eliminar articulo</button></>}</div>}
    </>}
    {confirmation && <Modal title={actionTitle} onClose={() => setConfirmation(null)} busy={busy}>
      <h2>{actionTitle}</h2><p class="admin-confirm-title">{confirmationTitle || "Articulo sin titulo"}</p>
      <p>{confirmation.action === "delete" ? "Se movera a la papelera y dejara de estar visible en la web." : confirmation.action === "restore" ? "Volvera al listado sin publicarse." : confirmation.action === "withdraw" ? "Dejara de estar visible en la web. Se conservara en el editor." : confirmation.action === "discard" ? "Hay cambios sin guardar." : "Esta revision sera visible en la web."}</p>
      {(confirmation.action === "delete" || confirmation.action === "withdraw") && dirty && <p>Los cambios sin guardar se descartaran.</p>}{error && <p role="alert" class="admin-error">{error}</p>}
      <div class="admin-dialog-actions"><button disabled={busy} onClick={() => { setConfirmation(null); setError(""); }}>Cancelar</button><button class={confirmation.action === "delete" || confirmation.action === "discard" ? "admin-danger" : "admin-primary"} disabled={busy} onClick={() => void confirm()}>{busy ? "Procesando..." : actionTitle}</button></div>
    </Modal>}
    {preview && <Modal title="Vista previa del articulo" onClose={() => setPreview("")}><div class="admin-toolbar"><h2>Vista previa</h2><button class="admin-icon-button" title="Cerrar vista previa" aria-label="Cerrar vista previa" onClick={() => setPreview("")}><Icon node={X} /></button></div><iframe title="Vista previa del articulo" sandbox="" srcDoc={preview} /></Modal>}
  </div>;
}
