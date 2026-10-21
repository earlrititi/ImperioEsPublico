import { useEffect, useRef, useState } from "preact/hooks";
import { formatMoney, SHIRT_PRODUCT_PRICE_CENTS } from "../../config/commerce";
import { AddressFields, emptyAddress, api } from "./shared";
import { attributedPath, socialEvent } from "../../lib/social-attribution";
import {trackFunnel} from "../../lib/funnel-client";
import { readCart, type CartItem } from "../../lib/cart";
import { trackGoogleCommerce } from "../../lib/google-analytics";
import { EMAIL_MARKETING_CONSENT } from "../../config/email-marketing";

export default function ReservationForm({ initialSize = "M", initialCustomer = { name: "", email: "" }, fromCart = false, initialSales = false }: { initialSize?: string; initialCustomer?: { name: string; email: string }; fromCart?: boolean; initialSales?: boolean }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [size, setSize] = useState(initialSize), [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState(initialCustomer);
  const [differentRecipient, setDifferentRecipient] = useState(false);
  const submitting = useRef(false);
  const [address, setAddress] = useState({ ...emptyAddress });
  const [challenge, setChallenge] = useState(""), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [available, setAvailable] = useState(false);
  const [accepted, setAccepted] = useState(false), [marketing, setMarketing] = useState(false);
  const [website, setWebsite] = useState(""), [campaign, setCampaign] = useState<any>(null);
  const [expirationHours, setExpirationHours] = useState(0), [waitlist, setWaitlist] = useState(false);
  const [sales,setSales]=useState(initialSales);
  const [inventoryState, setInventoryState] = useState<"loading" | "ready" | "error">("loading");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  useEffect(() => {
    if (fromCart) setCartItems(readCart());
    let active = true;
    const refresh = async () => {
      try {
        const data = await api("/api/reservations/inventory");
        if (active) {
          setInventory(data.variants); setAvailable(data.reservationMode||data.salesEnabled);setSales(Boolean(data.salesEnabled));
          setExpirationHours(data.expirationHours); setCampaign(data.campaign);
          setInventoryState("ready");
        }
      } catch { if (active) { setAvailable(false); setInventoryState("error"); } }
    };
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    void api("/api/reservations/challenge").then((data) => { if (active) setChallenge(data.challenge); })
      .catch((e) => { if (active) setMessage(e.message); });
    return () => { active = false; clearInterval(timer); };
  }, []);
  const variant = inventory.find((v) => v.name === size);
  const soldOut = fromCart ? cartItems.some(item => inventory.find(v => v.name === item.size)?.available === false) : variant?.available === false;
  const maximum = variant?.available ? campaign?.max_reservation_quantity ?? Infinity : 0;
  const units = fromCart ? cartItems.reduce((sum, item) => sum + item.quantity, 0) : quantity;
  const canWait = Boolean(campaign && (!campaign.reservations_open_at || Date.parse(campaign.reservations_open_at) <= Date.now()));
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting.current || busy || !variant || inventoryState !== "ready") return;
    if (fromCart && (!cartItems.length || soldOut)) { setMessage("Revisa las tallas y cantidades en tu carrito."); return; }
    if (!fromCart && ((!waitlist && (!Number.isInteger(quantity) || quantity < 1 || quantity > maximum)) || (waitlist && !soldOut))) {
      setMessage("La disponibilidad ha cambiado. Revisa talla y cantidad."); return;
    }
    submitting.current = true;
    setBusy(true); setMessage(sales ? "Guardando tus datos para revisar el pago..." : "Verificando solicitud...");
    if (!waitlist) socialEvent("reservation_started", { sku: variant.sku, quantity });
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
        items: fromCart ? cartItems.map(item => ({ sku: `IE-CAMISETA-IMPERIAL-${item.size}`, quantity: item.quantity })) : [{ sku: variant.sku, quantity: waitlist ? 1 : quantity }],
        accepted, marketing, website, expirationHours, waitlist,
        address: waitlist ? undefined : { ...address, name: differentRecipient ? address.name : customer.name },
      });
      if (!waitlist) socialEvent("reservation_completed", { sku: variant.sku, quantity });
      if (!waitlist) trackGoogleCommerce("add_shipping_info", fromCart ? cartItems : [{ size: variant.name, quantity }]);
      if(!waitlist)await trackFunnel("shirts",4);
      if (fromCart) try { sessionStorage.setItem("imperio-cart-reservation", result.id); } catch { /* Optional cart cleanup must not block checkout. */ }
      window.location.assign(attributedPath(result.url));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar la solicitud."); setBusy(false); submitting.current = false;
    }
  }
  return (
    <form class="reservation-form" data-funnel-flow="shirts" onSubmit={submit} aria-busy={busy || inventoryState === "loading"} aria-describedby="reservation-feedback">
      <header class="reservation-form__header">
        <span class="commerce-kicker">{sales?"Compra de camiseta":"Solicitud de reserva"}</span>
        <h2>{waitlist ? "Lista de espera" : sales?"Camiseta Imperial":"Pre-reserva gratuita"}</h2>
        {inventoryState === "loading" ? <p role="status">Comprobando disponibilidad y precio...</p> : <p class="reservation-total">{sales&&!waitlist?formatMoney(SHIRT_PRODUCT_PRICE_CENTS*units):formatMoney(0)}{!sales&&" ahora"}</p>}
        <p>{formatMoney(SHIRT_PRODUCT_PRICE_CENTS)} por camiseta. IVA incluido. Envío a Península: 3 € por camiseta, añadido al revisar el pago.</p>
      </header>
      <fieldset disabled={busy}>
        <legend>Talla y cantidad</legend>
        {fromCart ? <><ul>{cartItems.map(item => <li key={item.size}>Talla {item.size} · {item.quantity} {item.quantity === 1 ? "camiseta" : "camisetas"}</li>)}</ul><a href="/carrito">Modificar carrito</a>{inventoryState !== "loading" && !cartItems.length && <p>Tu carrito está vacío.</p>}</> : <><div class="reservation-fields">
          <label>Talla
            <select value={size} onChange={(e) => { setSize(e.currentTarget.value); setWaitlist(false); setQuantity(1); }}>
              {["S", "M", "L", "XL", "XXL"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {!waitlist && !soldOut && <label>Cantidad
            <input type="number" min="1" max={Number.isFinite(maximum) ? maximum : undefined} step="1" required value={quantity}
              onInput={(e) => setQuantity(Number(e.currentTarget.value))} />
          </label>}
        </div>
        <p class="reservation-stock" role="status" aria-live="polite">{variant ? soldOut ? "AGOTADO" : "DISPONIBLE" : "Consultando disponibilidad..."}</p>
        </>}
        {!waitlist && typeof campaign?.max_reservation_quantity === "number" && <p class="reservation-note">Máximo {campaign.max_reservation_quantity} unidades por pre-reserva.</p>}
      </fieldset>
      {soldOut && !waitlist && <>
        <p>Esta talla está agotada.</p>
        {fromCart ? <a href="/carrito">Revisar mi carrito</a> : <button type="button" class="btn btn-ghost" disabled={busy || !canWait} onClick={() => setWaitlist(true)}>APUNTARME A LA LISTA DE ESPERA</button>}
      </>}
      {(!soldOut || waitlist) && <>
        <fieldset disabled={busy}>
          <legend>Contacto</legend>
          <label>Nombre
            <input name="customerName" autoComplete="name" required minLength={2} maxLength={150} value={customer.name}
              onInput={(e) => setCustomer({ ...customer, name: e.currentTarget.value })} />
          </label>
          <label>Email
            <input name="email" type="email" autoComplete="email" required maxLength={254} value={customer.email}
              onInput={(e) => setCustomer({ ...customer, email: e.currentTarget.value })} />
          </label>
        </fieldset>
        {!waitlist && <>
          <label class="reservation-consent">
            <input type="checkbox" checked={differentRecipient} disabled={busy} onChange={e => setDifferentRecipient(e.currentTarget.checked)} />
            <span>Enviar a otra persona</span>
          </label>
          <AddressFields value={address} onChange={setAddress} disabled={busy} includeRecipient={differentRecipient} />
        </>}
        <label class="commerce-honeypot" aria-hidden="true">Sitio web
          <input tabIndex={-1} autoComplete="off" value={website} onInput={(e) => setWebsite(e.currentTarget.value)} />
        </label>
        <div class="reservation-conditions">
          <p>{waitlist ? "La lista de espera no obliga a comprar. Te avisaremos si vuelve a estar disponible tu talla." : sales ? "Revisa tu dirección y continúa al pago seguro." : "Pre-reserva gratuita. No se realiza ningún cobro y la pre-reserva no implica obligación de compra. La unidad quedará temporalmente asignada hasta que finalice el periodo indicado para completar la compra."}</p>
          {sales&&!waitlist&&<p>Revisa el resumen y confirma el pago en Stripe. El descuento de tu suscripcion activa se comprueba al pagar.</p>}
          {!sales&&campaign?.purchase_open_at && <p><strong>Compra prioritaria prevista:</strong> {new Date(campaign.purchase_open_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} (hora peninsular).</p>}
          {!waitlist && !sales && <p>Dispones de {campaign?.purchase_window_hours ?? 24} horas para completarla.</p>}
          {expirationHours > 0 && !waitlist && <p>Esta reserva caduca {expirationHours} horas después de confirmarla.</p>}
        </div>
        <label class="reservation-consent">
          <input type="checkbox" checked={accepted} required disabled={busy} onChange={(e) => setAccepted(e.currentTarget.checked)} />
          <span>He leído la <a href="/legal/privacidad" target="_blank" rel="noreferrer">Política de privacidad</a> y las <a href={sales && !waitlist ? "/legal/terminos" : "/legal/reservas"} target="_blank" rel="noreferrer">{sales && !waitlist ? "condiciones de compra" : "condiciones de la pre-reserva"}</a>.</span>
        </label>
        <label class="reservation-consent">
          <input type="checkbox" checked={marketing} disabled={busy} onChange={(e) => setMarketing(e.currentTarget.checked)} />
          <span>{EMAIL_MARKETING_CONSENT} Opcional; baja en cualquier momento.</span>
        </label>
        <button class="btn btn-primary" type="submit" disabled={busy || !challenge || (waitlist ? !canWait : !available || (fromCart ? !cartItems.length : maximum < 1))}>
          {busy ? "Guardando..." : inventoryState === "loading" ? "Comprobando disponibilidad..." : waitlist ? "Confirmar lista de espera" : sales?"Revisar y continuar al pago":"RESERVAR \u2014 0 \u20ac"}
        </button>
      </>}
      {inventoryState !== "loading" && !available && !soldOut && <p role="status">Las compras no estan disponibles temporalmente.</p>}
      <p id="reservation-feedback" role="status" aria-live="polite" aria-atomic="true">{message}</p>
    </form>
  );
}
