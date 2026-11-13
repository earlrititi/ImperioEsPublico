import { useEffect, useRef, useState } from "preact/hooks";

type MailFilter = "all" | "inbound" | "outbound";
type MailItem = {
  id: string;
  subject?: string;
  from?: string[];
  to?: string[];
  date?: string | null;
  direction: "inbound" | "outbound";
  seen?: boolean;
};
type MailMessage = MailItem & {
  html?: string;
  bodyAvailable?: boolean;
  contentLimited?: boolean;
  omissionReason?: string;
  attachments?: { name: string; size: number }[];
  links?: string[];
};
type MailPage = {
  items: MailItem[];
  nextCursor?: string | null;
  hasMore?: boolean;
  checkedAt?: string;
  needsConnection?: boolean;
  coverage?: string;
  warnings?: string[];
};
const filters: { value: MailFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "inbound", label: "Recibidos" },
  { value: "outbound", label: "Enviados" },
];
const date = (value?: string | null) => {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("es-ES") : "Sin fecha";
};
const problem = (code: string) => ({
  FORBIDDEN: "Tu sesión no permite consultar el correo.",
  INVALID_INPUT: "La consulta no es válida. Actualiza la bandeja e inténtalo de nuevo.",
  NOT_FOUND: "El mensaje ya no está disponible.",
  MAILBOX_RESET_REQUIRED: "El buzón ha cambiado. Actualiza la bandeja.",
  MAILBOX_CONNECTION_FAILED: "No se pudo conectar con el buzón corporativo. Revisa su conexión.",
  MAIL_ARCHIVE_UNAVAILABLE: "Parte del historial no está disponible en este momento.",
  RATE_LIMITED: "Espera unos segundos antes de volver a consultar.",
})[code] || "No se pudo consultar el correo. Actualiza la bandeja en unos instantes.";

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 401 || response.status === 403) throw Error("FORBIDDEN");
  const body = await response.json();
  if (!response.ok) throw Error(typeof body.code === "string" ? body.code : typeof body.error === "string" ? body.error : "MAILBOX_QUERY_FAILED");
  return body as T;
}

export default function Mailbox() {
  const [filter, setFilter] = useState<MailFilter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState<(string | null)[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<MailPage | null>(null);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connection, setConnection] = useState("");
  const generation = useRef(0);
  const listController = useRef<AbortController | null>(null);
  const detailController = useRef<AbortController | null>(null);
  const connectController = useRef<AbortController | null>(null);
  const forceRefresh = useRef(false);

  const changeList = () => {
    generation.current++;
    listController.current?.abort();
    detailController.current?.abort();
    setData(null);
    setMessage(null);
    setSelectedId(null);
    setReading(false);
    setLoading(true);
    setError("");
  };
  const resetList = () => {
    changeList();
    setCursor(null);
    setPages([]);
    setRefresh(value => value + 1);
  };
  const refreshList = () => {
    forceRefresh.current = true;
    resetList();
  };

  useEffect(() => {
    const controller = new AbortController();
    listController.current = controller;
    const current = ++generation.current;
    setLoading(true);
    setError("");
    detailController.current?.abort();
    const params = new URLSearchParams({ view: "unified", filter, q: query });
    if (cursor) params.set("cursor", cursor);
    if (forceRefresh.current) {
      params.set("refresh", "1");
      forceRefresh.current = false;
    }
    fetch(`/api/admin/mailbox?${params}`, { credentials: "same-origin", signal: controller.signal })
      .then(readResponse<MailPage>)
      .then(body => {
        if (!controller.signal.aborted && current === generation.current) setData(body);
      })
      .catch(reason => {
        if (!controller.signal.aborted && current === generation.current) setError(problem(reason instanceof Error ? reason.message : ""));
      })
      .finally(() => {
        if (!controller.signal.aborted && current === generation.current) setLoading(false);
      });
    return () => controller.abort();
  }, [filter, query, cursor, refresh]);

  useEffect(() => () => {
    detailController.current?.abort();
    connectController.current?.abort();
  }, []);

  const open = async (row: MailItem) => {
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    const current = generation.current;
    setSelectedId(row.id);
    setMessage(null);
    setReading(true);
    setError("");
    const params = new URLSearchParams({ view: "unified", id: row.id });
    try {
      const response = await fetch(`/api/admin/mailbox?${params}`, { credentials: "same-origin", signal: controller.signal });
      const body = await readResponse<{ message: MailMessage }>(response);
      if (!controller.signal.aborted && current === generation.current) setMessage(body.message);
    } catch (reason) {
      if (!controller.signal.aborted && current === generation.current) setError(problem(reason instanceof Error ? reason.message : ""));
    } finally {
      if (!controller.signal.aborted && current === generation.current) setReading(false);
    }
  };

  const connect = async (event: Event) => {
    event.preventDefault();
    if (connecting || !password) return;
    const credential = password;
    setPassword("");
    setConnecting(true);
    setConnection("");
    const controller = new AbortController();
    connectController.current = controller;
    try {
      const response = await fetch("/api/admin/mailbox", {
        method: "POST", credentials: "same-origin", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", password: credential }),
      });
      await readResponse<{ connected: boolean }>(response);
      if (!controller.signal.aborted) {
        setConnection("Conexión completada. Los mensajes del buzón se incluyen en la bandeja.");
        refreshList();
      }
    } catch (reason) {
      if (!controller.signal.aborted) setConnection(problem(reason instanceof Error ? reason.message : ""));
    } finally {
      if (!controller.signal.aborted) setConnecting(false);
    }
  };

  const previousPage = () => {
    if (loading || !pages.length) return;
    const previous = pages.at(-1) ?? null;
    changeList();
    setCursor(previous);
    setPages(history => history.slice(0, -1));
    setRefresh(value => value + 1);
  };
  const nextPage = () => {
    if (loading || !data?.hasMore || !data.nextCursor) return;
    const next = data.nextCursor;
    changeList();
    setPages(history => [...history, cursor]);
    setCursor(next);
    setRefresh(value => value + 1);
  };

  return (
    <section class="mailbox-panel">
      <header>
        <h1>Mail</h1>
        <p>Enviados y recibidos de contacto@imperioes.com en una sola bandeja.</p>
        <div class="admin-toolbar">
          <a href="/admin/correos">Redactar correo</a>
          <button type="button" disabled={loading} onClick={refreshList}>Actualizar</button>
        </div>
      </header>
      <nav class="mailbox-filters" aria-label="Filtrar correo">
        {filters.map(item => (
          <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => {
            resetList();
            setFilter(item.value);
          }}>{item.label}</button>
        ))}
      </nav>
      <form class="admin-toolbar mailbox-search" onSubmit={event => {
        event.preventDefault();
        resetList();
        setQuery(search.trim());
      }}>
        <label>Buscar correo
          <input type="search" maxLength={100} value={search} onInput={event => setSearch(event.currentTarget.value)} />
        </label>
        <button type="submit" disabled={loading}>Buscar</button>
      </form>
      <details class="mailbox-connection" open={data?.needsConnection === true}>
        <summary>Conexión del buzón corporativo</summary>
        <p>Introduce su contraseña para incluir los mensajes del buzón en esta bandeja. La consulta es de solo lectura y no cambia las marcas de los mensajes.</p>
        <form class="admin-toolbar" onSubmit={connect}>
          <label>Contraseña del buzón
            <input name="mailbox_password" type="password" autoComplete="new-password" maxLength={4096} value={password} onInput={event => setPassword(event.currentTarget.value)} required />
          </label>
          <button type="submit" disabled={connecting || !password}>{connecting ? "Comprobando…" : "Conectar para consultar"}</button>
        </form>
        {connection && <p role="status">{connection}</p>}
      </details>
      {error && <p class="admin-error" role="alert">{error}</p>}
      {loading && <p role="status">Consultando correo…</p>}
      {data?.needsConnection && <p role="status">Conecta el buzón corporativo para incluir sus mensajes en esta bandeja.</p>}
      {data?.warnings?.length ? <ul class="mailbox-notices" aria-label="Estado de la consulta">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : null}
      {data?.coverage && <p class="mailbox-coverage">{data.coverage}</p>}
      <div class="mailbox-workspace">
        <div class="mailbox-list">
          <div class="admin-table-wrap">
            <table>
              <thead><tr><th>Asunto</th><th class="mailbox-correspondent">De / Para</th><th class="mailbox-date">Fecha</th></tr></thead>
              <tbody>
                {(data?.items ?? []).map(row => {
                  const counterpart = (row.direction === "inbound" ? row.from : row.to)?.join(", ") || "No disponible";
                  return <tr key={row.id} class={selectedId === row.id ? "mailbox-selected" : undefined}>
                    <td>
                      <button class="mailbox-subject" type="button" aria-pressed={selectedId === row.id} onClick={() => open(row)}>{row.subject || "Sin asunto"}</button>
                      <div class="mailbox-row-meta"><span>{row.direction === "inbound" ? "Recibido" : "Enviado"}</span>{row.seen === false && <span>Sin leer</span>}</div>
                      <span class="mailbox-mobile-correspondent">{counterpart}</span>
                    </td>
                    <td class="mailbox-correspondent">{counterpart}</td>
                    <td class="mailbox-date">{date(row.date)}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {!loading && data && data.items.length === 0 && <p>No hay mensajes que coincidan con esta consulta.</p>}
          <div class="admin-toolbar">
            <button type="button" disabled={!pages.length || loading} onClick={previousPage}>Anteriores</button>
            <button type="button" disabled={!data?.hasMore || !data.nextCursor || loading} onClick={nextPage}>Más mensajes</button>
          </div>
          {data?.checkedAt && <p class="mailbox-coverage">Última consulta: {date(data.checkedAt)}</p>}
        </div>
        <article class="mailbox-message" aria-label="Mensaje seleccionado" aria-live="polite">
          {reading ? <p>Leyendo mensaje…</p> : message ? <>
            <h2>{message.subject || "Sin asunto"}</h2>
            <p><strong>De:</strong> {message.from?.join(", ") || "No disponible"}<br />
              <strong>Para:</strong> {message.to?.join(", ") || "No disponible"}<br />{date(message.date)}</p>
            {message.contentLimited && <p>La vista de este mensaje está recortada por su tamaño.</p>}
            {message.bodyAvailable ? <iframe title="Contenido seguro del correo" sandbox="" referrerPolicy="no-referrer" srcDoc={message.html} /> : <p>{message.omissionReason || "El contenido de este mensaje no está disponible."}</p>}
            {message.attachments?.length ? <><h3>Adjuntos</h3><ul>{message.attachments.map((item, index) => <li key={index}>{item.name} · {item.size} bytes</li>)}</ul><p>Los adjuntos no se descargan ni ejecutan automáticamente.</p></> : null}
            {message.links?.length ? <details><summary>Enlaces públicos del mensaje</summary><ul>{message.links.map(link => <li key={link}><a href={link} target="_blank" rel="noopener noreferrer">{link}</a></li>)}</ul></details> : null}
          </> : <p>Selecciona un mensaje para leerlo aquí. El contenido activo y los recursos externos no autorizados permanecen bloqueados.</p>}
        </article>
      </div>
      <style>{`
        .admin-shell .mailbox-filters{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}
        .mailbox-filters [aria-pressed=true]{background:#7c1c18;color:#fff;border-color:#bb6058}
        .mailbox-search label{flex:1 1 280px}
        .mailbox-search input{flex:1;min-width:0}
        .mailbox-panel details{margin:16px 0}
        .mailbox-connection{border-block:1px solid #48484d;padding:8px 0}
        .mailbox-coverage,.mailbox-notices{font-size:14px;color:#b8b8c0;line-height:1.5}
        .mailbox-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:24px;margin-top:24px}
        .mailbox-list,.mailbox-message{min-width:0}
        .mailbox-subject{text-align:left;white-space:normal;overflow-wrap:anywhere;max-width:100%}
        .mailbox-row-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:#b8b8c0;margin-top:7px}
        .mailbox-mobile-correspondent{display:none}
        .mailbox-selected{background:#312025}
        .mailbox-date{width:136px;font-size:13px}
        .mailbox-message{padding:16px;border:1px solid #57575e;border-radius:8px;overflow-wrap:anywhere}
        .mailbox-message h2{margin-top:0}
        .mailbox-message iframe{border:0;width:100%;max-width:100%;height:640px;background:#fff}
        @media(max-width:1100px){.mailbox-workspace{grid-template-columns:1fr}}
        @media(max-width:540px){.mailbox-correspondent{display:none}.mailbox-mobile-correspondent{display:block;font-size:12px;color:#b8b8c0;overflow-wrap:anywhere;margin-top:6px}.mailbox-date{width:104px}.mailbox-message{padding:12px}.mailbox-message iframe{height:640px}}
      `}</style>
    </section>
  );
}
