import { useEffect, useState } from "preact/hooks";
import { api } from "./shared";
export default function ReceiptConfirmation() {
  const [token, setToken] = useState(""), [orderId, setOrderId] = useState(""), [data, setData] = useState<any>(null),
    [packageIndex, setPackageIndex] = useState(1), [packageCount, setPackageCount] = useState(1), [busy, setBusy] = useState(false),
    [message, setMessage] = useState("Comprobando tu acceso…"), [finished, setFinished] = useState(false);
  useEffect(() => {
    const capability = window.location.hash.slice(1), order = new URL(window.location.href).searchParams.get("order") ?? "";
    // Keep the capability in component memory; remove it from the address bar
    // without storing it in browser storage or including it in analytics.
    setToken(capability); setOrderId(order);
    if (capability) history.replaceState(null, "", window.location.pathname);
    let active = true;
    api("/api/orders/receipt", { action: "inspect", token: capability, orderId: order }).then(result => {
      if (!active) return;
      setData(result); setPackageCount(result.order.delivery_expected_packages ?? 1);
      const firstRemaining = Array.from({ length: result.order.delivery_expected_packages ?? 1 }, (_, n) => n + 1)
        .find(n => !result.receivedPackages.includes(n));
      setPackageIndex(firstRemaining ?? 1); setMessage("");
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  async function submit(kind: "customer_received" | "issue_opened") {
    setBusy(true); setMessage("");
    try {
      const result = await api("/api/orders/receipt", { token, orderId, kind, packageCount, packageIndex, eventId: crypto.randomUUID() });
      const complete = result.complete || kind === "issue_opened";
      setFinished(complete); setMessage(kind === "issue_opened" ? "Hemos registrado la incidencia y detenido los correos de posentrega. Contacta con nuestro equipo para explicar lo ocurrido."
        : complete ? "Gracias. Tu recepción ha quedado confirmada." : "Recepción parcial registrada. Puedes confirmar otro paquete cuando lo recibas.");
      if (!complete) {
        const received = [...data.receivedPackages, packageIndex]; setData({ ...data, receivedPackages: received });
        setPackageIndex(Array.from({ length: packageCount }, (_, n) => n + 1).find(n => !received.includes(n)) ?? 1);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo registrar tu respuesta."); }
    finally { setBusy(false); }
  }
  return <section class="reservation-form" aria-label="Confirmar recepción del pedido">
    <p>La entrega comunicada por el transportista y tu recepción son confirmaciones independientes. Indica únicamente lo que hayas recibido.</p>
    {data && !finished && <form onSubmit={event => { event.preventDefault(); void submit("customer_received"); }}>
      <h2>Pedido {data.order.number}</h2>
      {data.order.customer_received_at ? <p>Este pedido ya tiene la recepción completa confirmada.</p> : <>
        <label>Total de paquetes del pedido<input type="number" min="1" max="50" required disabled={Boolean(data.order.delivery_expected_packages)} value={packageCount}
          onInput={event => { setPackageCount(Number(event.currentTarget.value)); setPackageIndex(1); }} /></label>
        <label>Paquete recibido<select value={packageIndex} onChange={event => setPackageIndex(Number(event.currentTarget.value))}>
          {Array.from({ length: Math.min(50, Math.max(1, packageCount)) }, (_, n) => n + 1).filter(n => !data.receivedPackages.includes(n)).map(n => <option key={n} value={n}>Paquete {n} de {packageCount}</option>)}
        </select></label>
        <button class="btn btn-primary" disabled={busy}>Confirmo que he recibido este paquete</button>
      </>}
      <button type="button" class="btn btn-ghost" disabled={busy} onClick={() => void submit("issue_opened")}>Tengo un problema con la entrega</button>
    </form>}
    {message && <p role="status" aria-live="polite">{message}</p>}
    <p><a href="/contacto">Contactar con soporte</a> · <a href="/cuenta">Mi cuenta</a></p>
  </section>;
}
