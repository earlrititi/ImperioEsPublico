import { useEffect, useState } from "preact/hooks";
import { money, percentage } from "../../lib/email-funnel-model";

type AnyRow = Record<string, any>;
const PERIODS = [
  ["7d", "Últimos 7 días"], ["30d", "Últimos 30 días"], ["90d", "Últimos 90 días"],
  ["month", "Este mes"], ["prev_month", "Mes anterior"], ["all", "Histórico"],
] as const;
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "No consta";
const num = (value: unknown) => new Intl.NumberFormat("es-ES").format(Number(value) || 0);

export default function GeneralMetrics() {
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState<AnyRow | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    fetch(`/api/admin/email-funnel?period=${period}&pageSize=1`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error ?? "No se pudieron cargar las métricas.");
        return result;
      })
      .then(setData)
      .catch(e => { if (e.name !== "AbortError") { setError(e.message); setData(null); } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [period, refresh]);

  return <section class="admin-funnel-page">
    <div class="admin-toolbar">
      <h1>Métricas generales</h1>
      <label>Periodo<select value={period} onChange={event => setPeriod(event.currentTarget.value)}>{PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="button" onClick={() => setRefresh(value => value + 1)}>Actualizar</button>
    </div>
    {busy && !data && <p role="status">Cargando métricas...</p>}
    {error && <p role="alert" class="admin-error">{error}</p>}
    {data && <>
      <p class="admin-funnel-note">Resumen ejecutivo del periodo. Actualizado: {date(data.generated_at)}. Para el detalle por contacto y email, abre la pestaña «Métricas embudo».</p>
      <div class="admin-funnel-kpis">
        <div><span>Contactos</span><strong>{num(data.kpis.entered)}</strong><small>{num(data.kpis.active)} activos</small></div>
        <div><span>Conversiones</span><strong>{num(data.kpis.converted)}</strong><small>{percentage(data.kpis.conversion_rate) ?? "Sin muestra"} del total</small></div>
        <div><span>MRR</span><strong>{money(data.economy.mrr_cents)}</strong><small>ARR {money(data.economy.arr_cents)}</small></div>
        <div><span>Ingresos del periodo</span><strong>{money(data.economy.total_revenue_cents)}</strong><small>{money(data.economy.subscription_revenue_cents)} suscripciones · {money(data.economy.shop_revenue_cents)} tienda</small></div>
        <div><span>Suscripciones activas</span><strong>{num(data.economy.active_maestre + data.economy.active_arcabucero)}</strong><small>{num(data.economy.active_maestre)} Maestre · {num(data.economy.active_arcabucero)} Arcabucero</small></div>
        <div><span>Compradores de tienda</span><strong>{num(data.kpis.buyers)}</strong><small>Pedidos no cancelados</small></div>
        <div><span>Bajas</span><strong>{num(data.kpis.unsubscribed)}</strong><small>{percentage(data.kpis.entered ? data.kpis.unsubscribed / data.kpis.entered : null) ?? "Sin muestra"} del total</small></div>
        <div><span>Bounces / errores</span><strong>{num(data.kpis.errors)}</strong><small>{percentage(data.email_health.bounce_rate) ?? "Sin muestra"} de rebote</small></div>
      </div>

      <section class="admin-funnel-section">
        <h2>Salud del email</h2>
        <div class="admin-metrics admin-funnel-mini">
          <div><span>Enviados aceptados</span><strong>{num(data.email_health.sent)}</strong></div>
          <div><span>Entrega confirmada</span><strong>{num(data.email_health.delivered)}</strong><small>{percentage(data.email_health.delivery_rate) ?? "Sin muestra"}</small></div>
          <div><span>Aperturas (parcial)</span><strong>{num(data.email_health.opened)}</strong><small>{percentage(data.email_health.open_rate) ?? "Sin muestra"}</small></div>
          <div><span>Clics</span><strong>{num(data.email_health.clicked)}</strong><small>{percentage(data.email_health.click_rate) ?? "Sin muestra"}</small></div>
          <div><span>Bounces</span><strong>{num(data.kpis.bounced)}</strong><small>{percentage(data.email_health.bounce_rate) ?? "Sin muestra"}</small></div>
          <div><span>Quejas</span><strong>{num(data.kpis.complained)}</strong><small>{percentage(data.email_health.complaint_rate) ?? "Sin muestra"}</small></div>
        </div>
        <p class="admin-funnel-note">El open rate es una señal parcial. Apple Mail Privacy Protection y los proxies pueden registrar aperturas sin lectura. Prioriza clics y conversiones verificadas en Stripe.</p>
      </section>

      <section class="admin-funnel-section">
        <h2>Comparativa</h2>
        {data.previous
          ? <div class="admin-table-wrap"><table class="admin-funnel-table"><thead><tr><th>Métrica</th><th>Periodo actual</th><th>Periodo anterior</th><th>Variación</th></tr></thead><tbody>
            <tr><td>Entradas</td><td>{num(data.kpis.entered)}</td><td>{num(data.previous.entered)}</td><td>{variation(data.kpis.entered, data.previous.entered)}</td></tr>
            <tr><td>Conversiones</td><td>{num(data.kpis.converted)}</td><td>{num(data.previous.converted)}</td><td>{variation(data.kpis.converted, data.previous.converted)}</td></tr>
            <tr><td>Ingresos</td><td>{money(data.economy.total_revenue_cents)}</td><td>{money(data.previous.total_revenue_cents)}</td><td>{variation(data.economy.total_revenue_cents, data.previous.total_revenue_cents)}</td></tr>
            <tr><td>Ingresos por suscripciones</td><td>{money(data.economy.subscription_revenue_cents)}</td><td>{money(data.previous.subscription_revenue_cents)}</td><td>{variation(data.economy.subscription_revenue_cents, data.previous.subscription_revenue_cents)}</td></tr>
            <tr><td>Ingresos por tienda</td><td>{money(data.economy.shop_revenue_cents)}</td><td>{money(data.previous.shop_revenue_cents)}</td><td>{variation(data.economy.shop_revenue_cents, data.previous.shop_revenue_cents)}</td></tr>
          </tbody></table></div>
          : <p class="admin-funnel-note">El histórico completo no tiene un periodo anterior comparable.</p>}
      </section>

      <section class="admin-funnel-section">
        <h2>Fases</h2>
        <div class="admin-table-wrap"><table class="admin-funnel-table"><thead><tr><th>Fase</th><th>Personas</th><th>% del total</th></tr></thead><tbody>
          {data.phases.map((phase: AnyRow) => <tr key={phase.phase}><td>{phase.label}</td><td>{num(phase.people)}</td><td>{percentage(phase.share) ?? "Sin muestra"}</td></tr>)}
        </tbody></table></div>
      </section>
    </>}
  </section>;
}

function variation(current: unknown, previous: unknown) {
  const a = Number(current) || 0, b = Number(previous) || 0;
  if (!b) return a ? "Sin base comparable" : "Sin cambios";
  const change = (a - b) / b;
  return `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)} %`;
}
