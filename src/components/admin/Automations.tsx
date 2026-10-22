import { useEffect, useState } from "preact/hooks";
import { AUTOMATION_DEFAULTS, type AutomationDraft } from "../../lib/email-automations";
import type { MailContent } from "../../lib/admin-mail-template";
import type { AutomationRevenue } from "../../lib/ga4-reports";
type AutomationStats = { key: string; pending: number; accepted: number; delivered: number; suppressed: number; review: number };

export default function Automations() {
  const [items, setItems] = useState<AutomationDraft[]>(AUTOMATION_DEFAULTS);
  const [savedItems, setSavedItems] = useState<AutomationDraft[]>(AUTOMATION_DEFAULTS);
  const [selected, setSelected] = useState("welcome");
  const [storageReady, setStorageReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  const [stats, setStats] = useState<AutomationStats[] | null>(null);
  const [revenue, setRevenue] = useState<AutomationRevenue | null>(null);
  const [sending, setSending] = useState<boolean | null>(null);
  const [enrollmentStartsAt,setEnrollmentStartsAt]=useState<string|null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/automations", { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw Error("No se pudieron cargar los borradores.");
      const result = await response.json(); setItems(result.items); setSavedItems(result.items); setStorageReady(result.storageReady);
      setSending(result.sendsEnabled === true);
      if (!result.storageReady) setMessage("Guardado pendiente de la migracion 030 en el entorno de pruebas.");
    }).catch(error => { if (error.name !== "AbortError") setMessage(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    fetch("/api/admin/automation-stats", { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const result = await response.json(); setStats(result.runtimeReady ? result.items : null);
      setSending(result.sendsEnabled === true);
      setEnrollmentStartsAt(result.enrollmentStartsAt??null);
      setRevenue(result.attributedRevenue??null);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const draft = items.find(item => item.key === selected)!;
  const counters = stats?.find(item => item.key === selected);
  const measured = revenue?.items.find(item => item.key === selected);
  function select(key: string) {
    if (dirty && !confirm("Descartar los cambios sin guardar?")) return;
    if (dirty) setItems(savedItems);
    setSelected(key); setDirty(false); setPreview(""); setMessage("");
  }
  function edit(index: number, key: keyof MailContent, value: string) {
    setItems(current => current.map(item => item.key !== selected ? item : { ...item,
      steps: item.steps.map((step, number) => number !== index ? step : { ...step, mail: { ...step.mail, [key]: value } }) }));
    setDirty(true); setPreview("");
  }
  async function submit(action: "preview" | "save", step = 0) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/automations", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, action, step }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error ?? "Solicitud no disponible.");
      if (action === "preview") setPreview(result.html);
      else { const saved = items.map(item => item.key === selected ? { ...item, revision: result.revision } : item);
        setItems(saved); setSavedItems(saved);
        setDirty(false); setSending(false); setMessage("Borrador guardado. No se han programado ni enviado correos."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Solicitud no disponible."); }
    finally { setBusy(false); }
  }
  return <section>
    <div class="admin-toolbar"><h1>Automatizaciones</h1><a href="/admin/newsletter">Newsletter</a></div>
    <p class="admin-status" role="status">{sending === null ? (loading ? "Comprobando estado de los envios..." : "Estado de envios no disponible") : sending ? "Envios comerciales autorizados" : "Envios comerciales desactivados"}</p>
    {enrollmentStartsAt&&<p>Audiencia: cuentas nuevas desde {new Date(enrollmentStartsAt).toLocaleString("es-ES",{timeZone:"Europe/Madrid"})}, con correo verificado y consentimiento.</p>}
    <label>Secuencia <select disabled={busy || loading} value={selected} onChange={event => select(event.currentTarget.value)}>
      {items.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
    </select></label>
    {selected !== "placed_order" && <div class="admin-table-wrap"><table><thead><tr><th>Pendientes</th><th>Aceptados</th><th>Entregados</th><th>Cancelados</th><th>Revision</th></tr></thead>
      <tbody><tr>{(["pending", "accepted", "delivered", "suppressed", "review"] as const).map(key => <td key={key}>{stats === null ? "No disponible" : counters?.[key] ?? 0}</td>)}</tr></tbody></table>
      {revenue?.status === "available" && measured ? <dl><dt>Sesiones desde esta serie</dt><dd>{measured.sessions.toLocaleString("es-ES")}</dd><dt>Compras medidas</dt><dd>{measured.purchases.toLocaleString("es-ES")}</dd><dt>Ingresos atribuidos por GA4</dt><dd>{measured.revenue.toLocaleString("es-ES",{style:"currency",currency:"EUR"})}</dd></dl> : <p>Ingresos atribuidos: {revenue?.status === "available" ? "sin datos medidos para esta serie" : "GA4 no disponible"}.</p>}
      <p>GA4: últimos 30 días completos, solo con consentimiento. No reconstruye atribución anterior al etiquetado ni representa todas las ventas de Stripe. Importes sin IVA ni envío.</p>
      {revenue?.limited && <p role="note">Atribución parcial por límites o umbrales de privacidad de Google.</p>}</div>}
    {selected === "placed_order" ? <><dl><dt>Canal</dt><dd>Transaccional</dd><dt>Momento</dt><dd>Pago confirmado</dd></dl><a href="/admin/comercio">Ver pedidos</a></> :
      <form class="admin-mail-form" onSubmit={event => { event.preventDefault(); void submit("save"); }}>
        <fieldset disabled={busy || loading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          {draft.steps.map((step, index) => <div key={`${selected}-${step.id}`}>
            <h2>{step.afterHours < 24 ? `${step.afterHours} horas` : step.afterHours === 24 ? "1 dia" : `${step.afterHours / 24} dias`}</h2>
            <div class="admin-mail-form">
              <label>Asunto<input required maxLength={180} value={step.mail.subject} onInput={event => edit(index, "subject", event.currentTarget.value)} /></label>
              <label>Preheader<input maxLength={250} value={step.mail.preheader} onInput={event => edit(index, "preheader", event.currentTarget.value)} /></label>
              <label>Contenido<textarea required rows={7} maxLength={10000} value={step.mail.content} onInput={event => edit(index, "content", event.currentTarget.value)} /></label>
              <label>Texto del enlace<input maxLength={80} value={step.mail.cta_label} onInput={event => edit(index, "cta_label", event.currentTarget.value)} /></label>
              <label>URL del enlace<input type="url" maxLength={500} value={step.mail.cta_url} onInput={event => edit(index, "cta_url", event.currentTarget.value)} /></label>
              <button type="button" onClick={() => void submit("preview", index)}>Vista previa</button>
            </div>
          </div>)}
          <div class="admin-toolbar"><button disabled={!storageReady || !dirty} type="submit">Guardar borrador</button></div>
        </fieldset>
      </form>}
    <p role="status" aria-live="polite">{message}</p>
    {preview && <iframe title="Vista previa de la automatizacion" sandbox="" srcDoc={preview} />}
  </section>;
}
