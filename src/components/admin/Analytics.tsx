import { useEffect, useState } from "preact/hooks";

type Interaction = { page: string; target: string; event: string; count: number };
type Consent = { consent_type: string; decisions: number; accepted: number; rejected: number; withdrawals: number; identities: number };
type Ga4Row = { dimensions: string[]; metrics: number[] };
type Summary = { interactions: Interaction[]; consents: Consent[]; daily: { day: string; event: string; count: number }[];
  ga4?: { status: string; totals: Ga4Row[]; traffic: Ga4Row[]; devices: Ga4Row[]; pages: Ga4Row[]; events: Ga4Row[]; truncated: boolean; thresholded: boolean } };
const eventLabel: Record<string, string> = { page_view: "Visita", click: "Clic", scroll_50: "Scroll 50%", scroll_90: "Scroll 90%" };
const consentLabel: Record<string, string> = { cookies_analytics: "Analitica", cookies_marketing: "Marketing", cookies_preferences: "Preferencias" };
export function formatAnalyticsMetric(value: number | undefined, format: "number" | "currency" | "percent" = "number") {
  if (value === undefined || !Number.isFinite(value)) return "No disponible";
  return value.toLocaleString("es-ES", format === "currency" ? { style: "currency", currency: "EUR" }
    : format === "percent" ? { style: "percent", maximumFractionDigits: 2 } : { maximumFractionDigits: 2 });
}
export default function Analytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [event, setEvent] = useState("");
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(""); setPage(0);
    fetch(`/api/admin/analytics?days=${days}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "No se pudieron cargar los datos."); return result; })
      .then(setData).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [days, attempt]);
  const rows = (data?.interactions ?? []).filter(row => (!event || row.event === event) && `${row.page} ${row.target}`.toLowerCase().includes(query.toLowerCase()));
  const totals = (name: string) => (data?.daily ?? []).filter(r => r.event === name).reduce((sum, r) => sum + Number(r.count), 0);
  return <section>
    <div class="admin-toolbar"><h1>Analítica</h1><label>Periodo <select value={days} onChange={e => setDays(Number(e.currentTarget.value))}>
      {[7, 30, 90, 365].map(n => <option key={n} value={n}>{n} dias</option>)}</select></label></div>
    {error && <div role="alert"><p>{error}</p><button onClick={() => setAttempt(attempt + 1)}>Reintentar</button></div>}
    {!data && !error && <p role="status">Cargando actividad...</p>}
    {data && <>
      <h2>Datos medidos por GA4</h2><p>Solo visitas con consentimiento. Informes hasta ayer; pueden incluir retrasos de procesamiento. Las compras medidas no sustituyen a las ventas reales de Stripe.</p>
      {data.ga4?.status === "available" ? <>
        <div class="admin-metrics">{["Usuarios activos", "Sesiones", "Vistas", "Compras medidas", "Ingresos medidos", "Usuarios que compran"].map((label,i)=><div key={label}><span>{label}</span><strong>{formatAnalyticsMetric(data.ga4?.totals[0]?.metrics[i] ?? (data.ga4?.totals.length === 0 ? 0 : undefined), i === 4 ? "currency" : i === 5 ? "percent" : "number")}</strong></div>)}</div>
        <p>Conversión: porcentaje de usuarios activos medidos que compraron. Los ingresos de GA4 excluyen el IVA y el envío registrados aparte; no equivalen al importe cobrado por Stripe.</p>
        {(data.ga4.truncated || data.ga4.thresholded) && <p role="note">Resultados limitados o sujetos a umbrales de privacidad de Google.</p>}
        {([["Fuentes y campañas", data.ga4.traffic, ["Fuente / medio", "Campaña", "Sesiones", "Usuarios", "Compras medidas", "Ingresos medidos", "Usuarios que compran"]], ["Dispositivos", data.ga4.devices, ["Dispositivo", "Sesiones", "Usuarios", "Compras medidas", "Ingresos medidos", "Usuarios que compran"]], ["Páginas", data.ga4.pages, ["Ruta", "Título", "Vistas", "Usuarios"]], ["Eventos ecommerce y actividad", data.ga4.events, ["Evento", "Veces", "Usuarios"]]] as [string,Ga4Row[],string[]][]).map(([title,values,labels])=><div key={title}><h3>{title}</h3><div class="admin-table-wrap"><table><thead><tr>{labels.map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{values.map((row,i)=><tr key={i}>{row.dimensions.map((value,j)=><td key={`dimension-${j}`}>{value}</td>)}{labels.slice(row.dimensions.length).map((label,j)=><td key={`metric-${j}`}>{formatAnalyticsMetric(row.metrics[j], label === "Ingresos medidos" ? "currency" : label === "Usuarios que compran" ? "percent" : "number")}</td>)}</tr>)}{!values.length&&<tr><td colSpan={labels.length}>Sin datos medidos en este periodo.</td></tr>}</tbody></table></div></div>)}
      </> : <p role="status">{data.ga4?.status === "not_configured" ? "Conexión de servidor a GA4 pendiente de credenciales de lectura." : "Los informes de GA4 no están disponibles. La actividad local sigue accesible."}</p>}
      <h2>Interacciones locales consentidas</h2>
      <div class="admin-metrics">{[["Visitas registradas", "page_view"], ["Clics", "click"], ["Scroll 50%", "scroll_50"], ["Scroll 90%", "scroll_90"]].map(([label, name]) => <div key={name}><span>{label}</span><strong>{totals(name).toLocaleString("es-ES")}</strong></div>)}</div>
      <div class="admin-toolbar"><h2>Paginas y elementos</h2><label>Buscar <input type="search" value={query} onInput={e => { setQuery(e.currentTarget.value); setPage(0); }} /></label><label>Evento <select value={event} onChange={e => { setEvent(e.currentTarget.value); setPage(0); }}><option value="">Todos</option>{Object.entries(eventLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div class="admin-table-wrap"><table><thead><tr><th>Pagina</th><th>Elemento</th><th>Evento</th><th>Veces</th></tr></thead><tbody>
        {rows.slice(page * 25, page * 25 + 25).map(row => <tr key={`${row.page}:${row.target}:${row.event}`}><td>{row.page}</td><td>{row.target}</td><td>{eventLabel[row.event] ?? row.event}</td><td>{Number(row.count).toLocaleString("es-ES")}</td></tr>)}
        {!rows.length && <tr><td colSpan={4}>Sin interacciones registradas para estos filtros.</td></tr>}
      </tbody></table></div>
      <div class="admin-toolbar"><span>{rows.length} resultados</span><button aria-label="Pagina anterior" disabled={!page} onClick={() => setPage(page - 1)}>&larr;</button><span>{page + 1} / {Math.max(1, Math.ceil(rows.length / 25))}</span><button aria-label="Pagina siguiente" disabled={(page + 1) * 25 >= rows.length} onClick={() => setPage(page + 1)}>&rarr;</button></div>
      <h2>Decisiones sobre cookies</h2>
      <div class="admin-table-wrap"><table><thead><tr><th>Categoria</th><th>Aceptaciones</th><th>Rechazos</th><th>Retiradas tras aceptar</th><th>Identificadores distintos</th></tr></thead><tbody>
        {data.consents.map(row => <tr key={row.consent_type}><td>{consentLabel[row.consent_type] ?? row.consent_type}</td><td>{row.accepted}</td><td>{row.rejected}</td><td>{row.withdrawals}</td><td>{row.identities}</td></tr>)}
        {!data.consents.length && <tr><td colSpan={5}>Sin decisiones en este periodo.</td></tr>}
      </tbody></table></div>
    </>}
  </section>;
}
