import { useState } from "preact/hooks";
import { api } from "./shared";
import { DELIVERY_LABELS } from "../../lib/post-delivery-labels";

const date = (value?: string | null) => value ? new Date(value).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "Sin confirmar";
export default function DeliveryActions({ order, busy, onChange }: { order: any; busy: boolean; onChange: () => Promise<void> }) {
  const [kind, setKind] = useState("carrier_delivered"), [evidence, setEvidence] = useState(""),
    [packageCount, setPackageCount] = useState(order.delivery_expected_packages ?? 1), [packageIndex, setPackageIndex] = useState(1),
    [occurredAt, setOccurredAt] = useState(""), [saving, setSaving] = useState(false), [message, setMessage] = useState(""),
    [history, setHistory] = useState<any>(null);
  const disabled = busy || saving;
  const read = async () => { try { setHistory(await api(`/api/admin/delivery?id=${order.id}`)); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo consultar el historial."); } };
  async function save(pause = false) {
    setSaving(true); setMessage("");
    try {
      await api("/api/admin/delivery", { action: pause ? "pause" : "event", orderId: order.id, eventId: crypto.randomUUID(),
        kind, evidence, packageCount, packageIndex, occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString() });
      setMessage(pause ? "Posentrega detenida para este pedido." : "Evidencia registrada. La recepción del cliente sigue siendo independiente.");
      setEvidence(""); await onChange(); await read();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo registrar el evento."); }
    finally { setSaving(false); }
  }
  return <section aria-label="Entrega acreditada y posentrega">
    <h4>Entrega y recepción</h4>
    <dl><dt>Entrega acreditada</dt><dd>{date(order.carrier_delivered_at)}</dd><dt>Recepción del cliente</dt><dd>{date(order.customer_received_at)}</dd>
      <dt>Incidencia</dt><dd>{order.delivery_issue_at ? date(order.delivery_issue_at) : "Sin incidencia registrada"}</dd>
      <dt>Disputa de pago</dt><dd>{order.delivery_disputed_at ? `Posentrega detenida desde ${date(order.delivery_disputed_at)}` : "Sin disputa registrada"}</dd>
      <dt>Posentrega</dt><dd>{order.post_delivery_stage ?? "No iniciada"}</dd><dt>Próximo correo</dt><dd>{date(order.next_email_at)}</dd></dl>
    <p>No hay conexión automática con el transportista. Registra únicamente entregas con prueba verificable. Pago y envío no acreditan entrega.</p>
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <label>Evento<select value={kind} onChange={event => setKind(event.currentTarget.value)}>
        {Object.entries(DELIVERY_LABELS).filter(([value]) => value !== "customer_received").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Total de paquetes<input type="number" min="1" max="50" required disabled={Boolean(order.delivery_expected_packages)} value={packageCount}
        onInput={event => { setPackageCount(Number(event.currentTarget.value)); setPackageIndex(1); }} /></label>
      <label>Paquete afectado<input type="number" min="1" max={packageCount} required value={packageIndex} onInput={event => setPackageIndex(Number(event.currentTarget.value))} /></label>
      <label>Fecha acreditada<input type="datetime-local" required value={occurredAt} onInput={event => setOccurredAt(event.currentTarget.value)} /></label>
      <label>Referencia privada de la prueba o incidencia<input value={evidence} minLength={kind === "issue_opened" ? 0 : 5} required={kind !== "issue_opened"} maxLength={250}
        onInput={event => setEvidence(event.currentTarget.value)} /></label>
      <p>Usa una referencia de documento o ticket; no copies direcciones, fotografías ni datos personales aquí.</p>
      <button class="btn btn-primary" disabled={disabled}>Registrar evidencia</button>
    </form>
    <button class="btn btn-ghost" disabled={disabled || Boolean(order.delivery_paused_at)} onClick={() => void save(true)}>Detener correos de posentrega</button>
    <button class="btn btn-ghost" disabled={disabled} onClick={() => void read()}>Consultar historial de entrega y correos</button>
    {message && <p role="status">{message}</p>}
    {history && <><p>{history.coverage}</p><ul>{history.events.map((event: any) => <li key={event.id}>{DELIVERY_LABELS[event.kind]} · Paquete {event.package_index}/{event.package_count} · {date(event.occurred_at)} · {event.source}{event.evidence_ref ? ` · ${event.evidence_ref}` : ""}</li>)}</ul>
      <ul>{history.jobs.map((job: any) => <li key={job.id}>{job.kind} · {job.status} · {date(job.sent_at ?? job.due_at)}{job.provider_status ? ` · ${job.provider_status}` : ""}{job.last_error ? ` · ${job.last_error}` : ""}</li>)}</ul></>}
  </section>;
}
