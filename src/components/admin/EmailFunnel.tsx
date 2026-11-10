import { useEffect, useRef, useState } from "preact/hooks";
import { money, percentage } from "../../lib/email-funnel-model";

type AnyRow = Record<string, any>;
type Data = {
  generated_at: string;
  period: string;
  range: { from: string | null; to: string | null; days: number | null };
  sequence: AnyRow[];
  kpis: AnyRow;
  email_health: AnyRow;
  phases: AnyRow[];
  dropoff: AnyRow | null;
  breakdown: AnyRow[];
  upcoming: AnyRow;
  economy: AnyRow;
  previous: AnyRow | null;
  contacts: { items: AnyRow[]; total: number; page: number; pageSize: number; totalPages: number };
  options: { sources: string[]; phases: AnyRow[]; steps: AnyRow[] };
  limitations: string[];
};

const PERIODS = [
  ["7d", "Últimos 7 días"],
  ["30d", "Últimos 30 días"],
  ["90d", "Últimos 90 días"],
  ["month", "Este mes"],
  ["prev_month", "Mes anterior"],
  ["all", "Histórico"],
  ["custom", "Fechas concretas"],
] as const;

const STATE_LABELS: Record<string, string> = {
  convertido: "Convertido",
  activo: "Activo",
  lead: "Lead",
  salida: "Salida / incidencia",
};

const date = (value: unknown) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return "No consta";
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
};

const shortDate = (value: unknown) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return "No consta";
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short" }).format(new Date(value));
};

const num = (value: unknown) => new Intl.NumberFormat("es-ES").format(Number(value) || 0);

async function read(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw Error(result.error ?? "No se pudo consultar el embudo.");
  return result;
}

export default function EmailFunnel() {
  const [params, setParams] = useState(new URLSearchParams("period=30d&pageSize=25"));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [detail, setDetail] = useState<AnyRow | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const detailRequest = useRef<AbortController | null>(null);

  const period = params.get("period") ?? "30d";
  const customIncomplete = period === "custom" && (!params.get("from") || !params.get("to"));

  useEffect(() => {
    if (customIncomplete) {
      setBusy(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    setError("");
    read(`/api/admin/email-funnel?${params.toString()}`, controller.signal)
      .then(setData)
      .catch(e => { if (e.name !== "AbortError") { setError(e.message); setData(null); } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [params.toString(), refresh, customIncomplete]);

  useEffect(() => () => detailRequest.current?.abort(), []);

  useEffect(() => {
    if (detail) {
      if (!dialog.current?.open) dialog.current?.showModal();
      heading.current?.focus();
    }
  }, [detail]);

  function update(values: Record<string, string | number | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    if (!("page" in values)) next.set("page", "0");
    setParams(next);
  }

  function applyFilters(event: Event) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const key of ["period", "from", "to", "sort", "pageSize"]) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    new FormData(form.current!).forEach((value, key) => {
      const clean = String(value).trim();
      if (clean) next.set(key, clean);
    });
    next.set("page", "0");
    setParams(next);
  }

  function resetFilters() {
    const next = new URLSearchParams();
    for (const key of ["period", "from", "to", "sort", "pageSize"]) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    next.set("page", "0");
    setParams(next);
  }

  function openDetail(email: string) {
    closeDetail();
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetailBusy(true);
    setDetailError("");
    read(`/api/admin/email-funnel?detail=${encodeURIComponent(email)}`, controller.signal)
      .then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch(e => { if (e.name !== "AbortError") setDetailError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setDetailBusy(false); });
  }

  function closeDetail() {
    detailRequest.current?.abort();
    detailRequest.current = null;
    dialog.current?.close();
    setDetail(null);
    setDetailBusy(false);
    setDetailError("");
  }

  return <section class="admin-funnel-page">
    <div class="admin-toolbar">
      <h1>Métricas embudo</h1>
      <label>Periodo
        <select value={period} onChange={event => update({ period: event.currentTarget.value })}>
          {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {period === "custom" && <>
        <label>Desde<input type="date" value={params.get("from") ?? ""} onChange={event => update({ from: event.currentTarget.value })} /></label>
        <label>Hasta<input type="date" value={params.get("to") ?? ""} onChange={event => update({ to: event.currentTarget.value })} /></label>
      </>}
      <label>Orden
        <select value={params.get("sort") ?? "recent"} onChange={event => update({ sort: event.currentTarget.value })}>
          <option value="recent">Más recientes</option>
          <option value="oldest">Más antiguos</option>
          <option value="revenue">Mayor ingreso</option>
        </select>
      </label>
      <button type="button" onClick={() => setRefresh(value => value + 1)}>Actualizar</button>
    </div>

    {busy && !data && <p role="status">Cargando embudo de email...</p>}
    {customIncomplete && <p class="admin-funnel-note">Elige una fecha de inicio y una fecha de fin para consultar el periodo personalizado.</p>}
    {error && <p role="alert" class="admin-error">{error}</p>}
    {data && <>
      {data.range.days !== null && <p class="admin-funnel-note">Periodo analizado: {date(data.range.from)} — {date(data.range.to)}. Actualizado: {date(data.generated_at)}.</p>}

      <div class="admin-funnel-kpis">
        <div><span>Total entraron</span><strong>{num(data.kpis.entered)}</strong>{data.previous && <small>{delta(data.kpis.entered, data.previous.entered)}</small>}</div>
        <div><span>Activos</span><strong>{num(data.kpis.active)}</strong><small>{percentage(data.kpis.entered ? data.kpis.active / data.kpis.entered : null) ?? "Sin muestra"} del total</small></div>
        <div><span>Pendientes del próximo email</span><strong>{num(data.kpis.pending_next)}</strong><small>{num(data.upcoming.overdue)} atrasados</small></div>
        <div><span>Convertidos</span><strong>{num(data.kpis.converted)}</strong><small>{percentage(data.kpis.conversion_rate) ?? "Sin muestra"} de conversión</small></div>
        <div><span>Bajas</span><strong>{num(data.kpis.unsubscribed)}</strong><small>{percentage(data.kpis.entered ? data.kpis.unsubscribed / data.kpis.entered : null) ?? "Sin muestra"} del total</small></div>
        <div><span>Bounces / errores</span><strong>{num(data.kpis.errors)}</strong><small>{percentage(data.email_health.bounce_rate) ?? "Sin muestra"} de rebote</small></div>
        <div><span>MRR</span><strong>{money(data.economy.mrr_cents)}</strong><small>{num(data.economy.active_maestre)} Maestre · {num(data.economy.active_arcabucero)} Arcabucero</small></div>
        <div><span>Ingresos del periodo</span><strong>{money(data.economy.total_revenue_cents)}</strong><small>{money(data.economy.subscription_revenue_cents)} suscripciones · {money(data.economy.shop_revenue_cents)} tienda</small></div>
      </div>

      <section class="admin-funnel-section">
        <h2>Embudo por fase</h2>
        <p class="admin-funnel-note">Personas por fase real derivada de los envíos y de Stripe. La fase 4 prevalece sobre la de salida cuando hay conversión.</p>
        <div class="admin-table-wrap">
          <table class="admin-funnel-table">
            <thead><tr><th>Fase</th><th>Personas</th><th>% del total</th><th>% fase anterior</th><th>Diferencia</th><th>Distribución</th></tr></thead>
            <tbody>{data.phases.map(phase => <tr key={phase.phase}>
              <td><span class={`admin-funnel-badge is-phase-${phase.phase}`}>{phase.label}</span></td>
              <td>{num(phase.people)}</td>
              <td>{percentage(phase.share) ?? "Sin muestra"}</td>
              <td>{phase.phase === 0 ? "—" : percentage(phase.share_previous) ?? "Sin muestra"}</td>
              <td>{phase.phase === 0 ? "—" : `${num(phase.lost)} menos`}</td>
              <td><div class="admin-funnel-bar"><span style={{ width: `${Math.max(0, Math.min(100, (phase.share ?? 0) * 100))}%` }} /></div></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section class="admin-funnel-section">
        <h2>Mayor caída entre emails</h2>
        {data.dropoff
          ? <p class="admin-funnel-alert">Entre «{data.dropoff.label}» y el siguiente email se pierden {num(data.dropoff.lost_from_previous)} personas ({percentage(data.dropoff.loss_rate) ?? "sin muestra"}). Es la mayor caída observada en la secuencia.</p>
          : <p class="admin-funnel-note">Sin caídas observadas o muestra insuficiente. La secuencia todavía no tiene envíos suficientes para comparar.</p>}
        <div class="admin-table-wrap">
          <table class="admin-funnel-table">
            <thead><tr><th>Email</th><th>Tipo</th><th>Personas</th><th>Enviados</th><th>Entregados</th><th>Abiertos</th><th>Clics</th><th>CTR</th><th>Siguiente fase</th></tr></thead>
            <tbody>{data.breakdown.map(step => <tr key={step.step_id}>
              <td><strong>{step.position}. {step.label}</strong><small>{step.step_id}</small></td>
              <td>{step.kind === "offer" ? "Oferta" : step.kind === "welcome" ? "Bienvenida" : "Nurturing"}</td>
              <td>{num(step.people)}</td>
              <td>{num(step.sent)}</td>
              <td>{num(step.delivered)}</td>
              <td>{num(step.opened)}</td>
              <td>{num(step.clicked)}</td>
              <td>{percentage(step.ctr) ?? "Sin muestra"}</td>
              <td>{phaseName(step.next_phase)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p class="admin-funnel-note">El open rate es parcial: Apple Mail Privacy Protection y los proxies pueden registrar aperturas sin lectura real. Prioriza clics y conversiones de Stripe.</p>
      </section>

      <section class="admin-funnel-section">
        <h2>Próximos envíos</h2>
        <div class="admin-metrics admin-funnel-mini">
          <div><span>Hoy</span><strong>{num(data.upcoming.today)}</strong></div>
          <div><span>Mañana</span><strong>{num(data.upcoming.tomorrow)}</strong></div>
          <div><span>Atrasados</span><strong>{num(data.upcoming.overdue)}</strong></div>
          <div><span>Con error</span><strong>{num(data.upcoming.errors)}</strong></div>
          <div><span>Bloqueados &gt; 48 h</span><strong>{num(data.upcoming.blocked_48h)}</strong></div>
        </div>
        {data.upcoming.items.length
          ? <div class="admin-table-wrap"><table class="admin-funnel-table"><thead><tr><th>Contacto</th><th>Email</th><th>Paso</th><th>Estado</th><th>Programado</th></tr></thead><tbody>
            {data.upcoming.items.map((item: AnyRow) => <tr key={`${item.email}:${item.step}`}>
              <td>{item.name || "Sin nombre"}</td>
              <td><button type="button" class="admin-funnel-link" onClick={() => openDetail(item.email)}>{item.email}</button></td>
              <td>{item.step_label}<small>{item.step}</small></td>
              <td>{item.error ? "Error" : item.late ? "Atrasado" : item.status === "processing" ? "Procesando" : "En cola"}{item.reason && <small>{item.reason}</small>}</td>
              <td>{date(item.due_at)}</td>
            </tr>)}</tbody></table></div>
          : <p class="admin-funnel-note">No hay envíos pendientes en el periodo y filtros actuales.</p>}
      </section>

      <section class="admin-funnel-section">
        <div class="admin-toolbar"><h2>Contactos</h2><span class="admin-funnel-count">{num(data.contacts.total)} contactos</span></div>
        <form ref={form} class="admin-funnel-filters" onSubmit={applyFilters}>
          <label>Buscar<input name="q" placeholder="Nombre o email" defaultValue={params.get("q") ?? ""} /></label>
          <label>Fase<select name="phase" defaultValue={params.get("phase") ?? ""}><option value="">Todas</option>{data.options.phases.map(phase => <option key={phase.value} value={phase.value}>{phase.label}</option>)}</select></label>
          <label>Email actual<select name="step" defaultValue={params.get("step") ?? ""}><option value="">Todos</option>{data.options.steps.map(step => <option key={step.value} value={step.value}>{step.label}</option>)}</select></label>
          <label>Origen<select name="source" defaultValue={params.get("source") ?? ""}><option value="">Todos</option>{data.options.sources.map(source => <option key={source} value={source}>{source}</option>)}</select></label>
          <label>Campaña / UTM<input name="campaign" placeholder="Sin atribución" defaultValue={params.get("campaign") ?? ""} /></label>
          <label class="admin-funnel-check"><input type="checkbox" name="active" value="1" defaultChecked={params.get("active") === "1"} /> Solo activos</label>
          <label class="admin-funnel-check"><input type="checkbox" name="inactive" value="1" defaultChecked={params.get("inactive") === "1"} /> Inactivos</label>
          <label class="admin-funnel-check"><input type="checkbox" name="converted" value="1" defaultChecked={params.get("converted") === "1"} /> Convertidos</label>
          <label class="admin-funnel-check"><input type="checkbox" name="piquero" value="1" defaultChecked={params.get("piquero") === "1"} /> Piquero</label>
          <label class="admin-funnel-check"><input type="checkbox" name="maestre" value="1" defaultChecked={params.get("maestre") === "1"} /> Maestre de Campo</label>
          <label class="admin-funnel-check"><input type="checkbox" name="buyer" value="1" defaultChecked={params.get("buyer") === "1"} /> Comprador</label>
          <label class="admin-funnel-check"><input type="checkbox" name="unsubscribe" value="1" defaultChecked={params.get("unsubscribe") === "1"} /> Bajas</label>
          <label class="admin-funnel-check"><input type="checkbox" name="error" value="1" defaultChecked={params.get("error") === "1"} /> Bounce / error</label>
          <div class="admin-funnel-filter-actions"><button type="submit">Filtrar</button><button type="button" onClick={resetFilters}>Limpiar</button></div>
        </form>

        <div class="admin-table-wrap">
          <table class="admin-funnel-table admin-funnel-contacts">
            <thead><tr><th>Nombre</th><th>Email</th><th>Alta</th><th>Origen / UTM</th><th>Estado</th><th>Fase</th><th>Email actual</th><th>Último / próximo</th><th>Interacción</th><th>Piquero</th><th>Maestre</th><th>Comprador</th><th>Ingresos</th><th>Estado funnel</th></tr></thead>
            <tbody>{data.contacts.items.map(contact => <tr key={contact.email}>
              <td>{contact.name || "Sin nombre"}</td>
              <td><button type="button" class="admin-funnel-link" onClick={() => openDetail(contact.email)}>{contact.email}</button></td>
              <td>{shortDate(contact.captured_at)}</td>
              <td>{contact.origin}<small>{contact.campaign}</small></td>
              <td>{contact.suppressed ? "Suprimido" : contact.active_paid ? "Suscriptor" : contact.is_account ? "Cuenta" : "Lead"}</td>
              <td><span class={`admin-funnel-badge is-phase-${contact.phase}`}>{contact.phase_label}</span></td>
              <td>Email {contact.current_email.position} de {contact.current_email.total}<small>{contact.current_email.label} · {contact.current_email.status}</small></td>
              <td>{shortDate(contact.last_sent_at)}<small>{contact.current_email.next_due_at ? `Próximo: ${shortDate(contact.current_email.next_due_at)}` : "Sin próximo programado"}</small></td>
              <td>{num(contact.opened_count)} abiertos<small>{num(contact.clicked_count)} clics</small></td>
              <td>{contact.is_account && !contact.active_paid ? "Sí" : "—"}</td>
              <td>{contact.maestre ? "Sí" : "—"}</td>
              <td>{contact.buyer ? "Sí" : "—"}</td>
              <td>{money(contact.revenue_cents)}</td>
              <td><span class={`admin-funnel-badge is-state-${contact.funnel_state}`}>{STATE_LABELS[contact.funnel_state] ?? contact.funnel_state}</span></td>
            </tr>)}{!data.contacts.items.length && <tr><td colSpan={14}>No hay contactos con estos filtros.</td></tr>}</tbody>
          </table>
        </div>
        <div class="admin-toolbar admin-funnel-pagination">
          <span>Página {data.contacts.page + 1} de {data.contacts.totalPages}</span>
          <button type="button" disabled={data.contacts.page <= 0} onClick={() => update({ page: data.contacts.page - 1 })}>Anterior</button>
          <button type="button" disabled={data.contacts.page + 1 >= data.contacts.totalPages} onClick={() => update({ page: data.contacts.page + 1 })}>Siguiente</button>
        </div>
      </section>

      <section class="admin-funnel-section">
        <h2>Economía</h2>
        <p class="admin-funnel-note">Stripe es la única fuente de verdad económica. Aperturas y clics no acreditan una compra. {data.economy.revenue_available ? "" : "El ledger de ingresos aún no está disponible."}</p>
        <div class="admin-metrics admin-funnel-mini">
          <div><span>MRR</span><strong>{money(data.economy.mrr_cents)}</strong><small>ARR {money(data.economy.arr_cents)}</small></div>
          <div><span>Ingresos por suscripciones</span><strong>{money(data.economy.subscription_revenue_cents)}</strong><small>Periodo seleccionado</small></div>
          <div><span>Ingresos por tienda</span><strong>{money(data.economy.shop_revenue_cents)}</strong><small>Pedidos no cancelados</small></div>
          <div><span>Compradores</span><strong>{num(data.kpis.buyers)}</strong><small>{num(data.kpis.maestre)} Maestre · {num(data.kpis.arcabucero)} Arcabucero</small></div>
        </div>
        {data.previous && <p class="admin-funnel-note">Periodo anterior: {num(data.previous.entered)} entradas, {num(data.previous.converted)} conversiones, {money(data.previous.total_revenue_cents)} de ingresos.</p>}
      </section>

      <section class="admin-funnel-section">
        <h2>Limitaciones</h2>
        <ul class="admin-funnel-limitations">{data.limitations.map(item => <li key={item}>{item}</li>)}</ul>
      </section>
    </>}

    <dialog ref={dialog} class="admin-article-dialog admin-funnel-dialog" aria-labelledby="funnel-detail-title" onCancel={event => { event.preventDefault(); closeDetail(); }}>
      <div class="admin-toolbar">
        <h2 id="funnel-detail-title" ref={heading} tabIndex={-1}>Ficha de contacto</h2>
        <button type="button" onClick={closeDetail}>Cerrar</button>
      </div>
      {detailBusy && <p role="status">Cargando ficha...</p>}
      {detailError && <p role="alert" class="admin-error">{detailError}</p>}
      {detail && <ContactDetail detail={detail} />}
    </dialog>
  </section>;
}

function ContactDetail({ detail }: { detail: AnyRow }) {
  const contact = detail.contact;
  return <>
    <div class="admin-funnel-detail-grid">
      <div><span>Nombre</span><strong>{contact.name || "Sin nombre"}</strong></div>
      <div><span>Email</span><strong>{contact.email}</strong></div>
      <div><span>Alta</span><strong>{date(contact.captured_at)}</strong></div>
      <div><span>Fase</span><strong>{contact.phase_label}</strong></div>
      <div><span>Estado funnel</span><strong>{STATE_LABELS[contact.funnel_state] ?? contact.funnel_state}</strong></div>
      <div><span>Email actual</span><strong>{contact.current_email.position} de {contact.current_email.total} · {contact.current_email.status}</strong></div>
      <div><span>Origen</span><strong>{contact.origin}</strong></div>
      <div><span>Campaña / UTM</span><strong>{contact.campaign}</strong></div>
      <div><span>Ingresos</span><strong>{money(contact.revenue_cents)}</strong></div>
      <div><span>Suscripción</span><strong>{contact.maestre ? "Maestre de Campo" : contact.arcabucero ? "Arcabucero" : contact.active_paid ? "De pago" : "Piquero / sin pago"}</strong></div>
    </div>
    {contact.suppression_reason && <p class="admin-funnel-alert">Supresión: {contact.suppression_reason}</p>}
    <h3>Timeline</h3>
    {detail.timeline.length
      ? <ol class="admin-funnel-timeline">{detail.timeline.map((event: AnyRow, index: number) => <li key={`${event.at}:${event.kind}:${index}`}>
        <time dateTime={event.at}>{date(event.at)}</time>
        <div><strong>{event.label}</strong>{event.status && <small>{event.status}</small>}{event.url && <small class="admin-funnel-url">{event.url}</small>}{event.amount_cents !== undefined && <small>{money(event.amount_cents)}</small>}</div>
      </li>)}</ol>
      : <p class="admin-funnel-note">No hay eventos registrados todavía.</p>}
    <h3>Pedidos</h3>
    {detail.orders.length
      ? <div class="admin-table-wrap"><table><thead><tr><th>Pedido</th><th>Estado</th><th>Importe</th><th>Fecha</th></tr></thead><tbody>{detail.orders.map((order: AnyRow) => <tr key={order.number}><td>{order.number}</td><td>{order.status}</td><td>{money(Math.max(0, Number(order.total) - Number(order.refunded_amount)))}</td><td>{date(order.paid_at)}</td></tr>)}</tbody></table></div>
      : <p class="admin-funnel-note">Sin pedidos de tienda.</p>}
    <h3>Suscripciones Stripe</h3>
    {detail.subscriptions.length
      ? <div class="admin-table-wrap"><table><thead><tr><th>Plan</th><th>Estado</th><th>Intervalo</th><th>Renueva</th></tr></thead><tbody>{detail.subscriptions.map((subscription: AnyRow) => <tr key={`${subscription.plan}:${subscription.created_at}`}><td>{subscription.plan}</td><td>{subscription.status}</td><td>{subscription.billing_interval ?? "No consta"}</td><td>{date(subscription.current_period_end)}</td></tr>)}</tbody></table></div>
      : <p class="admin-funnel-note">Sin suscripciones de pago.</p>}
    <h3>Aperturas y clics del proveedor</h3>
    {detail.provider_events.length
      ? <div class="admin-table-wrap"><table><thead><tr><th>Evento</th><th>Fecha</th><th>Enlace</th></tr></thead><tbody>{detail.provider_events.map((event: AnyRow, index: number) => <tr key={`${event.event_type}:${event.occurred_at}:${index}`}><td>{event.event_type}</td><td>{date(event.occurred_at)}</td><td>{event.url ?? "—"}</td></tr>)}</tbody></table></div>
      : <p class="admin-funnel-note">Sin eventos de apertura o clic registrados. El historial comienza al activar el webhook de Resend.</p>}
  </>;
}

function phaseName(value: number) {
  return ["Lead captado", "Bienvenida", "Nurturing / contenido", "Oferta", "Conversión", "Salida / incidencia"][value] ?? "Sin clasificar";
}

function delta(current: unknown, previous: unknown) {
  const a = Number(current) || 0, b = Number(previous) || 0;
  if (!b) return "Sin periodo anterior comparable";
  const change = (a - b) / b;
  return `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)} % vs. periodo anterior`;
}
