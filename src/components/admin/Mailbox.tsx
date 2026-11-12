import { useEffect, useRef, useState } from "preact/hooks";
type Row = Record<string, any>;
const date = (v: string) => {
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("es-ES") : "Sin fecha";
};
const problem = (code: string) =>
  ({
    FORBIDDEN: "Tu sesión no permite consultar el buzón.",
    NOT_FOUND: "El mensaje ya no está disponible.",
    MAILBOX_RESET_REQUIRED: "El buzón ha cambiado. Actualiza la lista.",
    MAILBOX_FOLDER_NOT_FOUND: "No se ha encontrado esa carpeta.",
    RATE_LIMITED: "Espera unos segundos antes de volver a consultar.",
  })[code] ||
  "No se pudo conectar. Revisa la contraseña del buzón o inténtalo de nuevo.";
export default function Mailbox() {
  const [folder, setFolder] = useState("inbox"),
    [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [cursor, setCursor] = useState<Row>({}),
    [pages, setPages] = useState<Row[]>([]),
    [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<Row | null>(null),
    [folders, setFolders] = useState<Row[]>([]),
    [message, setMessage] = useState<Row | null>(null),
    [loading, setLoading] = useState(false),
    [reading, setReading] = useState(false),
    [error, setError] = useState("");
  const [password, setPassword] = useState(""),
    [connecting, setConnecting] = useState(false),
    [connection, setConnection] = useState("");
  const generation = useRef(0),
    detailController = useRef<AbortController | null>(null);
  const choose = (value: string) => {
    detailController.current?.abort();
    generation.current++;
    setFolder(value);
    setCursor({});
    setPages([]);
    setData(null);
    setMessage(null);
    setReading(false);
    setError("");
  };
  useEffect(() => {
    const controller = new AbortController(),
      current = ++generation.current;
    setLoading(true);
    setReading(false);
    setError("");
    setMessage(null);
    detailController.current?.abort();
    const params = new URLSearchParams({
      folder,
      q,
      ...Object.fromEntries(
        Object.entries(cursor).map(([key, value]) => [key, String(value)]),
      ),
    });
    fetch(`/api/admin/mailbox?${params}`, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.code || body.error);
        if (current !== generation.current) return;
        setData(body);
        if (body.folders?.length) setFolders(body.folders);
      })
      .catch((reason) => {
        if (!controller.signal.aborted && current === generation.current)
          setError(problem(reason.message));
      })
      .finally(() => {
        if (!controller.signal.aborted && current === generation.current)
          setLoading(false);
      });
    return () => controller.abort();
  }, [folder, q, cursor, refresh]);
  useEffect(() => () => detailController.current?.abort(), []);
  const open = async (row: Row) => {
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    const current = generation.current;
    setReading(true);
    setMessage(null);
    setError("");
    const params = new URLSearchParams({
      folder,
      ...(folder === "application"
        ? { id: row.id }
        : { uid: row.id, validity: String(data?.validity || 0) }),
    });
    try {
      const response = await fetch(`/api/admin/mailbox?${params}`, {
        credentials: "same-origin",
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.code || body.error);
      if (!controller.signal.aborted && current === generation.current)
        setMessage(body.message);
    } catch (reason) {
      if (!controller.signal.aborted && current === generation.current)
        setError(problem(reason instanceof Error ? reason.message : ""));
    } finally {
      if (!controller.signal.aborted && current === generation.current)
        setReading(false);
    }
  };
  const connect = async (event: Event) => {
    event.preventDefault();
    setConnecting(true);
    setConnection("");
    try {
      const response = await fetch("/api/admin/mailbox", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", password }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.code || body.error);
      setConnection("Buzón conectado para consulta de solo lectura.");
      setRefresh((value) => value + 1);
    } catch (reason) {
      setConnection(problem(reason instanceof Error ? reason.message : ""));
    } finally {
      setPassword("");
      setConnecting(false);
    }
  };
  return (
    <section class="mailbox-panel">
      <header>
        <h1>Buzón de correo</h1>
        <p>Recibidos y enviados de contacto@imperioes.com.</p>
        <div class="admin-toolbar">
          <a href="/admin/correos">Redactar correo</a>
          <a href="/admin/comunicaciones">Historial de comunicaciones</a>
          <button
            type="button"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Actualizar
          </button>
        </div>
      </header>
      <nav class="mailbox-folders" aria-label="Carpetas del buzón">
        {[
          ["inbox", "Recibidos"],
          ["sent", "Enviados del buzón"],
          ["application", "Enviados por la web"],
        ].map(([value, label]) => (
          <button
            type="button"
            aria-pressed={folder === value}
            onClick={() => choose(value)}
          >
            {label}
          </button>
        ))}
        {folders.some((box) => box.kind === "folder") && (
          <select
            aria-label="Otras carpetas"
            value={folders.some((box) => box.id === folder) ? folder : ""}
            onChange={(event) => {
              if (event.currentTarget.value) choose(event.currentTarget.value);
            }}
          >
            <option value="">Otras carpetas</option>
            {folders
              .filter((box) => box.kind === "folder")
              .map((box) => (
                <option value={box.id}>{box.name}</option>
              ))}
          </select>
        )}
      </nav>
      <form
        class="admin-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setCursor({});
          setPages([]);
          setQ(search);
          setRefresh((value) => value + 1);
        }}
      >
        <label>
          {folder === "application"
            ? "Filtrar esta página de enviados"
            : "Buscar en esta carpeta"}
          <input
            type="search"
            maxLength={100}
            value={search}
            onInput={(event) => setSearch(event.currentTarget.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          Buscar
        </button>
      </form>
      {folder !== "application" && (
        <details open={data?.connected === false}>
          <summary>Conexión del buzón corporativo</summary>
          <p>
            Introduce la contraseña de correo de contacto@imperioes.com. Se
            comprueba la conexión cifrada y se guarda protegida para consultar
            el buzón. No se modifican mensajes ni marcas de lectura.
          </p>
          <form class="admin-toolbar" onSubmit={connect}>
            <label>
              Contraseña del buzón
              <input
                name="mailbox_password"
                type="password"
                autoComplete="new-password"
                maxLength={4096}
                value={password}
                onInput={(event) => setPassword(event.currentTarget.value)}
                required
              />
            </label>
            <button type="submit" disabled={connecting || !password}>
              {connecting ? "Comprobando…" : "Conectar para consultar"}
            </button>
          </form>
          {connection && <p role="status">{connection}</p>}
        </details>
      )}
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Consultando correo…</p>}
      {!loading && data?.connected === false && (
        <p role="status">
          El buzón recibido aún no está conectado. Puedes consultar los enviados
          por la web mientras completas la conexión.
        </p>
      )}
      {data?.coverage && <p>{data.coverage}</p>}
      <div class="mailbox-workspace">
        <div>
          <div class="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asunto</th>
                  <th>{folder === "inbox" ? "De" : "De / Para"}</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items || []).map((row: Row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        class="mailbox-subject"
                        type="button"
                        onClick={() => open(row)}
                      >
                        {row.subject || "Sin asunto"}
                      </button>
                      {row.seen === false && (
                        <small> · No leído en el buzón</small>
                      )}
                    </td>
                    <td>
                      {(folder === "inbox" ? row.from : row.to)?.join(", ")}
                    </td>
                    <td>{date(row.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && data?.connected && data.items?.length === 0 && (
            <p>No hay mensajes en esta página.</p>
          )}
          <div class="admin-toolbar">
            <button
              type="button"
              disabled={!pages.length || loading}
              onClick={() => {
                setCursor(pages.at(-1) || {});
                setPages(pages.slice(0, -1));
              }}
            >
              Anteriores
            </button>
            <button
              type="button"
              disabled={!data?.hasMore || loading}
              onClick={() => {
                setPages([...pages, cursor]);
                setCursor(
                  folder === "application"
                    ? { after: data?.nextAfter }
                    : { before: data?.nextBefore, validity: data?.validity },
                );
              }}
            >
              Más mensajes
            </button>
          </div>
          {data?.checkedAt && <p>Última consulta: {date(data.checkedAt)}</p>}
        </div>
        <article
          class="mailbox-message"
          aria-label="Mensaje seleccionado"
          aria-live="polite"
        >
          {reading ? (
            <p>Leyendo mensaje…</p>
          ) : message ? (
            <>
              <h2>{message.subject || "Sin asunto"}</h2>
              <p>
                <strong>De:</strong> {message.from?.join(", ")}
                <br />
                <strong>Para:</strong> {message.to?.join(", ")}
                <br />
                {date(message.date)}
              </p>
              {message.contentLimited && (
                <p>La vista de este mensaje está recortada por su tamaño.</p>
              )}
              {message.bodyAvailable ? (
                <iframe
                  title="Contenido seguro del correo"
                  sandbox=""
                  referrerPolicy="no-referrer"
                  srcDoc={message.html}
                />
              ) : (
                <p>Este mensaje no contiene un cuerpo de texto disponible.</p>
              )}
              {message.attachments?.length > 0 && (
                <>
                  <h3>Adjuntos</h3>
                  <ul>
                    {message.attachments.map((item: Row) => (
                      <li>
                        {item.name} · {item.size} bytes
                      </li>
                    ))}
                  </ul>
                  <p>
                    Los adjuntos no se descargan ni ejecutan automáticamente.
                  </p>
                </>
              )}
              {message.links?.length > 0 && (
                <details>
                  <summary>Enlaces públicos del mensaje</summary>
                  <ul>
                    {message.links.map((link: string) => (
                      <li>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p>
              Selecciona un mensaje para leerlo. Las imágenes externas y el
              contenido activo permanecen bloqueados.
            </p>
          )}
        </article>
      </div>
      <style>{`.mailbox-folders{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}.mailbox-folders [aria-pressed=true]{background:#7c1c18;color:#fff}.mailbox-workspace{display:grid;grid-template-columns:minmax(300px,1fr) minmax(320px,1.2fr);gap:24px;margin-top:24px}.mailbox-subject{text-align:left;white-space:normal;overflow-wrap:anywhere}.mailbox-message{min-width:0;padding:16px;border:1px solid #ddd;border-radius:8px;overflow-wrap:anywhere}.mailbox-message iframe{border:0;width:100%;height:560px;background:#fff}.mailbox-panel details{margin:16px 0}.mailbox-panel input{max-width:100%}@media(max-width:1100px){.mailbox-workspace{grid-template-columns:1fr}.mailbox-message iframe{height:440px}}`}</style>
    </section>
  );
}
