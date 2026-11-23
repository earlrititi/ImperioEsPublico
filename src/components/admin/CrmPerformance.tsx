import { useEffect, useState } from "preact/hooks";
import { COMMERCIAL_FAMILIES, COMMERCIAL_LABELS, CRM_EXPERIMENTS, type CommercialFamily, type CrmReport } from "../../lib/crm-performance";
import type { AutomationRevenue } from "../../lib/ga4-reports";
type Data = { report: CrmReport; alerts: string[]; sendsEnabled: boolean; ga4: AutomationRevenue };
const money = (cents: number) => (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
export default function CrmPerformance() {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/crm", { cache: "no-store", signal: controller.signal }).then(async response => {
      const value = await response.json(); if (!response.ok) throw Error(value.error ?? "Informe no disponible.");
      setData(value); setError("");
    }).catch(reason => { if (reason.name !== "AbortError") { setError(reason.message); setData(null); } });
    return () => controller.abort();
  }, [refresh]);
  async function pause(kind?: CommercialFamily) {
    if (!data || busy) return;
    const policy = data.report.policy;
    const paused = kind ? policy.paused : !policy.paused;
    const kinds = kind ? policy.kinds.includes(kind) ? policy.kinds.filter(value => value !== kind) : [...policy.kinds, kind] : policy.kinds;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/crm", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected: { paused: policy.paused, kinds: policy.kinds }, paused, kinds }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error ?? "No se pudo guardar la pausa.");
      setData({ ...data, report: { ...data.report, policy: { ...policy, ...result.policy } } }); setRefresh(value => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Solicitud no disponible."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="crm-title">
    <div class="admin-toolbar"><h2 id="crm-title">Rendimiento del CRM</h2><button disabled={busy} type="button" onClick={() => setRefresh(value => value + 1)}>Actualizar métricas</button></div>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Cargando informe privado…</p>}
    {data && <>
      <p>Histórico registrado. Actualizado {new Date(data.report.generated_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}. Las ventas se muestran por su fuente; no se atribuyen por proximidad a un email.</p>
      <div class="admin-metrics">
        <div><span>Cuentas verificadas</span><strong>{data.report.audience.verified_accounts}</strong></div>
        <div><span>Direcciones elegibles</span><strong>{data.report.audience.eligible}</strong></div>
        <div><span>Contactos del directorio</span><strong>{data.report.audience.captured}</strong></div>
        <div><span>Bajas / bloqueos</span><strong>{data.report.audience.unsubscribed} / {data.report.audience.blocked}</strong></div>
      </div>
      {data.report.audience.owner_declared > 0 && <p>{data.report.audience.owner_declared} permisos proceden de una declaración histórica del titular, identificada con ese origen en el registro.</p>}
      <h3>Política comercial</h3>
      <p>{data.sendsEnabled ? "Automatizaciones con aprobación vigente" : "Automatizaciones sin aprobación activa"}. {data.report.policy.frequency_enabled ? `Límite ${data.report.policy.daily_limit} en ${data.report.policy.daily_hours} h y ${data.report.policy.weekly_limit} en ${data.report.policy.weekly_hours} h.` : "Límites de frecuencia deshabilitados en configuración."} Los avisos de seguridad y servicio conservan su circuito.</p>
      <button type="button" disabled={busy} onClick={() => void pause()}>{data.report.policy.paused ? "Retirar pausa comercial global" : "Pausar todas las familias comerciales"}</button>
      <p>Retirar una pausa conserva las aprobaciones y flags existentes. No aprueba plantillas ni activa familias nuevas.</p>
      {data.alerts.map(alert => <p role="alert" key={alert}>{alert}</p>)}
      <div class="admin-table-wrap"><table><caption>Colas comerciales · mensajes únicos por ID del proveedor</caption><thead><tr><th>Familia</th><th>Pendientes</th><th>Aceptados</th><th>Entrega confirmada</th><th>Clic observado</th><th>Rebotes / quejas</th><th>Revisión</th><th>Control</th></tr></thead><tbody>
        {COMMERCIAL_FAMILIES.map(kind => {
          const row = data.report.branches.find(item => item.kind === kind);
          return <tr key={kind}><th scope="row">{COMMERCIAL_LABELS[kind]}</th><td>{row?.pending ?? 0}</td><td>{row?.accepted ?? 0}</td><td>{row?.delivered ?? 0}</td><td>{row?.clicked ?? 0}</td><td>{row?.bounced ?? 0} / {row?.complained ?? 0}</td><td>{row?.review ?? 0}</td><td><button disabled={busy} type="button" onClick={() => void pause(kind)} aria-label={`${data.report.policy.kinds.includes(kind) ? "Retirar pausa de" : "Pausar"} ${COMMERCIAL_LABELS[kind]}`}>{data.report.policy.kinds.includes(kind) ? "Retirar pausa" : "Pausar"}</button></td></tr>;
        })}
      </tbody></table></div>
      <p>Un clic o una apertura no prueban entrega ni compra. La aceptación confirma únicamente que el proveedor recibió la solicitud. Alertas: actividad aceptada en las últimas 24 h; las entregas pueden llegar con retraso.</p>
      <h3>Stripe · pedidos Live registrados</h3>
      <dl><dt>Pedidos con pago registrado</dt><dd>{data.report.commerce.paid_orders}</dd><dt>Cobrado / reembolsado</dt><dd>{money(data.report.commerce.collected_cents)} / {money(data.report.commerce.refund_cents)}</dd><dt>Cobro neto de reembolsos</dt><dd>{money(data.report.commerce.net_collected_cents)}</dd><dt>Compradores / compradores recurrentes</dt><dd>{data.report.commerce.buyers} / {data.report.commerce.repeat_buyers}</dd><dt>Facturas de suscripción registradas, bruto</dt><dd>{money(data.report.commerce.recorded_invoice_gross_cents)}</dd></dl>
      <p>Los pedidos incluyen IVA y envío. Las facturas se deduplican por factura y excluyen eventos sin completar; su bruto no acredita neto, devoluciones ni modo Live histórico, y no se suma al neto de tienda. Margen, coste por conversión y valor futuro del cliente: no disponibles sin costes y datos conciliados.</p>
      <h3>GA4 · atribución medida, últimos 30 días completos</h3>
      {data.ga4.status === "available" ? <div class="admin-table-wrap"><table><thead><tr><th>Serie con UTM</th><th>Sesiones</th><th>Compras medidas</th><th>Ingresos atribuidos GA4</th></tr></thead><tbody>{data.ga4.items.map(item => <tr key={item.key}><td>{item.key}</td><td>{item.sessions}</td><td>{item.purchases}</td><td>{money(item.revenue * 100)}</td></tr>)}</tbody></table>{!data.ga4.items.length && <p>Sin atribución medida en el periodo.</p>}</div> : <p>GA4 no disponible; no se han sustituido sus datos por ventas o aperturas.</p>}
      <p>Solo tráfico con consentimiento y UTMs reconocidas. No representa todas las ventas de Stripe ni acredita recuperación causal. {data.ga4.limited && "Informe parcial por límites o umbrales de privacidad."}</p>
      <details><summary>Experimentos preparados, pendientes de volumen y aprobación</summary>
        <p>Sin asignación automática ni cambios en los controles actuales. Plan inicial: 4.000 destinatarios entregados por variante; hipótesis de planificación del 2 % al 3 %, alfa 5 % y potencia aproximada 80 %. Recalcular con la tasa real antes de empezar; con 49 contactos no hay muestra suficiente. No se declaran ganadores.</p>
        {CRM_EXPERIMENTS.map(item => <article key={item.id}><h4>{item.hypothesis}</h4><p>{item.variants.join(" frente a ")}. Métrica: {item.metric}. {item.stop}</p></article>)}
      </details>
    </>}
  </section>;
}
