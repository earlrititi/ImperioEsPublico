import { useEffect, useState } from "preact/hooks";
import { formatMoney, SHIRT_FINAL_PRICE_CENTS, SHIRT_PRICE_COPY } from "../../config/commerce";
import { AddressFields, emptyAddress, api } from "./shared";

export default function ReservationForm({ initialSize = "M" }: { initialSize?: string }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [size, setSize] = useState(initialSize), [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState({ name: "", email: "" });
  const [address, setAddress] = useState({ ...emptyAddress });
  const [challenge, setChallenge] = useState(""), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [available, setAvailable] = useState(false);
  const [accepted, setAccepted] = useState(false), [marketing, setMarketing] = useState(false);
  const [website, setWebsite] = useState(""), [campaign, setCampaign] = useState<any>(null);
  const [expirationHours, setExpirationHours] = useState(0), [waitlist, setWaitlist] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const data = await api("/api/reservations/inventory");
        if (active) {
          setInventory(data.variants); setAvailable(data.reservationMode);
          setExpirationHours(data.expirationHours); setCampaign(data.campaign);
        }
      } catch { if (active) setAvailable(false); }
    };
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    void api("/api/reservations/challenge").then((data) => { if (active) setChallenge(data.challenge); })
      .catch((e) => { if (active) setMessage(e.message); });
    return () => { active = false; clearInterval(timer); };
  }, []);
  const variant = inventory.find((v) => v.name === size);
  const soldOut = variant?.available_stock === 0;
  const maximum = Math.min(campaign?.max_reservation_quantity ?? Infinity, variant?.available_stock ?? 0);
  const canWait = Boolean(campaign && (!campaign.reservations_open_at || Date.parse(campaign.reservations_open_at) <= Date.now()));
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !variant) return;
    if ((!waitlist && (!Number.isInteger(quantity) || quantity < 1 || quantity > maximum)) || (waitlist && !soldOut)) {
      setMessage("La disponibilidad ha cambiado. Revisa talla y cantidad."); return;
    }
    setBusy(true); setMessage("Verificando solicitud...");
    try {
      let nonce = 0;
      const encoder = new TextEncoder();
      while (true) {
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`${challenge}:${nonce}`)));
        if (digest[0] === 0 && digest[1] < 16) break;
        nonce++;
      }
      const result = await api("/api/reservations", {
        requestId: challenge.split(".")[0], challenge, nonce: String(nonce), customer,
        items: [{ sku: variant.sku, quantity: waitlist ? 1 : quantity }],
        accepted, marketing, website, expirationHours, waitlist,
        address: waitlist ? undefined : address,
      });
      window.location.assign(result.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar la solicitud."); setBusy(false);
    }
  }
  return (
    <form class="reservation-form" onSubmit={submit}>
      <header class="reservation-form__header">
        <span class="commerce-kicker">Solicitud de reserva</span>
        <h2>{waitlist ? "Lista de espera" : "Pre-reserva gratuita"}</h2>
        <p class="reservation-total">{formatMoney(0)} ahora</p>
        <p>{SHIRT_PRICE_COPY}.</p>
        <p>Compra posterior: {formatMoney(SHIRT_FINAL_PRICE_CENTS)} por unidad. Total para {quantity} {quantity === 1 ? "camiseta" : "camisetas"}: {formatMoney(SHIRT_FINAL_PRICE_CENTS * quantity)}.</p>
      </header>
      <fieldset disabled={busy}>
        <legend>Talla y cantidad</legend>
        <div class="reservation-fields">
          <label>Talla
            <select value={size} onChange={(e) => { setSize(e.currentTarget.value); setWaitlist(false); setQuantity(1); }}>
              {["S", "M", "L", "XL", "XXL"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {!waitlist && !soldOut && <label>Cantidad
            <input type="number" min="1" max={maximum} step="1" required value={quantity}
              onInput={(e) => setQuantity(Number(e.currentTarget.value))} />
          </label>}
        </div>
        <p class="reservation-stock" role="status" aria-live="polite">{variant ? soldOut ? "AGOTADO" : `Quedan ${variant.available_stock} unidades en talla ${size}` : "Consultando stock..."}</p>
        {!waitlist && typeof campaign?.max_reservation_quantity === "number" && <p class="reservation-note">Máximo {campaign.max_reservation_quantity} unidades por pre-reserva.</p>}
      </fieldset>
      {soldOut && !waitlist && <>
        <p>Todas las unidades de esta talla estan actualmente reservadas o vendidas.</p>
        <button type="button" class="btn btn-ghost" disabled={busy || !canWait} onClick={() => setWaitlist(true)}>APUNTARME A LA LISTA DE ESPERA</button>
      </>}
      {(!soldOut || waitlist) && <>
        <fieldset disabled={busy}>
          <legend>Contacto</legend>
          <label>Nombre
            <input autoComplete="name" required minLength={2} maxLength={150} value={customer.name}
              onInput={(e) => setCustomer({ ...customer, name: e.currentTarget.value })} />
          </label>
          <label>Email
            <input type="email" autoComplete="email" required maxLength={254} value={customer.email}
              onInput={(e) => setCustomer({ ...customer, email: e.currentTarget.value })} />
          </label>
        </fieldset>
        {!waitlist && <AddressFields value={address} onChange={setAddress} disabled={busy} />}
        <label class="commerce-honeypot" aria-hidden="true">Sitio web
          <input tabIndex={-1} autoComplete="off" value={website} onInput={(e) => setWebsite(e.currentTarget.value)} />
        </label>
        <div class="reservation-conditions">
          <p>{waitlist ? "La lista de espera no asigna stock ni obliga a comprar. Te avisaremos por orden de entrada si se libera una unidad." : "Pre-reserva gratuita. No se realiza ningún cobro y la pre-reserva no implica obligación de compra. La unidad quedará temporalmente asignada hasta que finalice el periodo indicado para completar la compra."}</p>
          {campaign?.purchase_open_at && <p><strong>Compra prioritaria prevista:</strong> {new Date(campaign.purchase_open_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} (hora peninsular).</p>}
          <p>Tras recibir la invitación de compra dispondrás de {campaign?.purchase_window_hours ?? 24} horas para completarla.</p>
          {expirationHours > 0 && !waitlist && <p>Esta reserva caduca {expirationHours} horas después de confirmarla.</p>}
        </div>
        <label class="reservation-consent">
          <input type="checkbox" checked={accepted} required disabled={busy} onChange={(e) => setAccepted(e.currentTarget.checked)} />
          <span>He leído la <a href="/legal/privacidad" target="_blank" rel="noreferrer">Política de privacidad</a> y las <a href="/legal/reservas" target="_blank" rel="noreferrer">condiciones de la pre-reserva</a>.</span>
        </label>
        <label class="reservation-consent">
          <input type="checkbox" checked={marketing} disabled={busy} onChange={(e) => setMarketing(e.currentTarget.checked)} />
          <span>Quiero recibir novedades y comunicaciones comerciales de Imperio E.</span>
        </label>
        <button class="btn btn-primary" type="submit" disabled={busy || !challenge || (waitlist ? !canWait : !available || maximum < 1)}>
          {busy ? "Confirmando..." : waitlist ? "Confirmar lista de espera" : "RESERVAR \u2014 0 \u20ac"}
        </button>
      </>}
      {!available && !soldOut && <p role="status">El periodo de pre-reserva no esta abierto.</p>}
      <p role="status" aria-live="polite">{message}</p>
    </form>
  );
}
