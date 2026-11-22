import { useEffect, useRef, useState } from "preact/hooks";
import type { Stripe, StripeCheckoutLoadActionsSuccess, StripePaymentElement } from "@stripe/stripe-js";
import {
  formatMoney,
  SHIRT_DELIVERY_OPTIONS,
  SHIRT_FINAL_PRICE_CENTS,
  SHIRT_PRODUCT_PRICE_CENTS,
  SHIRT_SHIPPING_PRICE_CENTS,
  shirtDeliveryOption,
  type ShirtDelivery,
} from "../../config/commerce";
import { EMAIL_MARKETING_CONSENT } from "../../config/email-marketing";
import { readCart, SHIRT_SIZES, type CartItem, type ShirtSize } from "../../lib/cart";
import { trackFunnel } from "../../lib/funnel-client";
import { trackGoogleCommerce } from "../../lib/google-analytics";
import type { readPublicInventory } from "../../lib/public-inventory";
import { isMainlandAddress, type ShippingAddress } from "../../lib/reservation-validation";
import { attributedPath, socialEvent } from "../../lib/social-attribution";
import { AddressFields, api, emptyAddress } from "./shared";

type Inventory = Awaited<ReturnType<typeof readPublicInventory>>;
type Customer = { name: string; email: string };
type ReservedOrder = {
  id: string;
  token: string;
  customer: Customer;
  address: ShippingAddress;
  delivery: ShirtDelivery;
  stripe?: Stripe | null;
};
type ConfirmedTotal = { amount: string; discount: number };
const maxCheckoutUnits = Math.floor(2_147_483_647 / SHIRT_FINAL_PRICE_CENTS);

interface Props {
  initialSize?: ShirtSize;
  initialQuantity?: number;
  initialCustomer?: Customer;
  fromCart?: boolean;
  initialSales?: boolean;
  stripePublishableKey?: string;
}

export default function ReservationForm({
  initialSize = "M",
  initialQuantity = 1,
  initialCustomer = { name: "", email: "" },
  fromCart = false,
  initialSales = false,
  stripePublishableKey,
}: Props) {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [inventoryError, setInventoryError] = useState(false);
  const [size, setSize] = useState<ShirtSize>(initialSize);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState(initialCustomer);
  const [address, setAddress] = useState({ ...emptyAddress });
  const [differentRecipient, setDifferentRecipient] = useState(false);
  const [delivery, setDelivery] = useState<ShirtDelivery>("standard");
  const [challenge, setChallenge] = useState("");
  const [website, setWebsite] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [waitlist, setWaitlist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryUrl, setRecoveryUrl] = useState("");
  const [paymentReady, setPaymentReady] = useState(false);
  const [confirmedTotal, setConfirmedTotal] = useState<ConfirmedTotal | null>(null);
  const submitting = useRef(false);
  const reservedOrder = useRef<ReservedOrder | null>(null);
  const paymentMount = useRef<HTMLDivElement>(null);
  const paymentElement = useRef<StripePaymentElement | null>(null);
  const paymentActions = useRef<StripeCheckoutLoadActionsSuccess | null>(null);

  useEffect(() => {
    if (fromCart) setCartItems(readCart());
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || reservedOrder.current) return;
      refreshing = true;
      try {
        const data = await api("/api/reservations/inventory");
        if (active) {
          setInventory(data);
          setInventoryError(false);
        }
      } catch {
        if (active) setInventoryError(true);
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    void api("/api/reservations/challenge")
      .then((data) => { if (active) setChallenge(data.challenge); })
      .catch((error) => { if (active) setMessage(error.message); });
    return () => {
      active = false;
      clearInterval(timer);
      paymentElement.current?.destroy();
    };
  }, []);

  const sales = inventory ? inventory.salesEnabled : initialSales;
  const reserving = inventory ? inventory.reservationMode : !initialSales;
  const initialLoading = !inventory && !inventoryError;
  const chosenDelivery = shirtDeliveryOption(delivery);
  const variants = inventory?.variants ?? [];
  const items = fromCart ? cartItems : [{ size, quantity: waitlist ? 1 : quantity }];
  const units = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const unavailable = Boolean(inventory && items.some((item) =>
    !variants.some((variant) => variant.name === item.size && variant.available),
  ));
  const maximum = inventory?.campaign.max_reservation_quantity ?? maxCheckoutUnits;
  const validQuantity = items.length > 0 && items.every((item) =>
    Number.isSafeInteger(item.quantity) && item.quantity > 0,
  ) && units <= maximum;
  const canWait = Boolean(inventory && (!inventory.campaign.reservations_open_at ||
    Date.parse(inventory.campaign.reservations_open_at) <= Date.now()));
  const detailsDisabled = busy || Boolean(recoveryUrl);
  const canEnterDetails = !unavailable || waitlist || Boolean(recoveryUrl);
  const canStart = !initialLoading && !inventoryError && Boolean(challenge) && validQuantity &&
    (waitlist ? canWait && unavailable : (sales || reserving) && !unavailable);
  const itemTotal = SHIRT_PRODUCT_PRICE_CENTS * units;
  const shippingTotal = sales ? chosenDelivery?.amount ?? 0 : SHIRT_SHIPPING_PRICE_CENTS * units;
  const total = itemTotal + shippingTotal;
  const checkoutQuery = new URLSearchParams(fromCart ? { cart: "1" } : { size, quantity: String(quantity || 1) });
  const loginHref = `/login?next=${encodeURIComponent(`/reservas?${checkoutQuery}`)}`;

  async function startPayment(order: ReservedOrder) {
    setMessage("Preparando el pago seguro…");
    if (order.stripe === undefined) {
      order.stripe = stripePublishableKey
        ? await import("@stripe/stripe-js/pure").then(({ loadStripe }) => loadStripe(stripePublishableKey, { locale: "es" })).catch(() => null)
        : null;
    }
    const data = await api(`/api/reservations/${order.id}/checkout`, {
      token: order.token,
      address: order.address,
      customer: order.customer,
      delivery: order.delivery,
      confirmPurchase: true,
      paymentUi: order.stripe ? "elements" : undefined,
    });
    void trackFunnel("shirts", 5, "/reservas");
    if (typeof data.url === "string" && data.url) {
      window.location.assign(data.url);
      return;
    }
    if (!order.stripe || typeof data.clientSecret !== "string" || !paymentMount.current) {
      throw new Error("No se pudo cargar el pago seguro.");
    }
    if (Number.isSafeInteger(data.total) && Number.isSafeInteger(data.discount)) {
      setConfirmedTotal({ amount: formatMoney(data.total), discount: data.discount });
    }
    const checkout = order.stripe.initCheckoutElementsSdk({
      clientSecret: data.clientSecret,
      elementsOptions: {
        appearance: {
          theme: "flat",
          variables: {
            colorBackground: "#fffdf9",
            colorText: "#211d19",
            colorPrimary: "#b61f19",
            colorDanger: "#a12822",
            fontSizeBase: "16px",
            borderRadius: "4px",
          },
        },
      },
    });
    const loaded = await checkout.loadActions();
    if (loaded.type === "error") throw new Error(loaded.error.message);
    const syncTotal = () => {
      const { total } = loaded.actions.getSession();
      setConfirmedTotal({ amount: total.total.amount, discount: total.discount.minorUnitsAmount });
    };
    syncTotal();
    checkout.on("change", syncTotal);
    paymentElement.current?.destroy();
    const element = checkout.createPaymentElement({ layout: "tabs" });
    paymentElement.current = element;
    paymentActions.current = loaded.actions;
    element.on("ready", () => {
      setMessage("");
      setPaymentReady(true);
      element.focus();
    });
    element.on("loaderror", () => {
      paymentActions.current = null;
      setPaymentReady(false);
      setMessage("Stripe no pudo cargar el formulario. Puedes volver a intentarlo.");
    });
    element.mount(paymentMount.current);
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting.current || busy) return;
    if (!reservedOrder.current && !canStart) return;
    if (paymentActions.current && !paymentReady) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (paymentActions.current && reservedOrder.current) {
        setMessage("Confirmando el pago…");
        const result = await paymentActions.current.confirm({ redirect: "if_required" });
        if (result.type === "error") throw new Error(result.error.message);
        window.location.assign(`/compra/completada#${reservedOrder.current.id}.${reservedOrder.current.token}`);
        return;
      }
      if (reservedOrder.current) {
        await startPayment(reservedOrder.current);
        return;
      }

      const selection = items.map((item) => ({
        sku: `IE-CAMISETA-IMPERIAL-${item.size}`,
        quantity: item.quantity,
      }));
      const shippingAddress = { ...address, name: differentRecipient ? address.name : customer.name };
      if (!waitlist && !isMainlandAddress(shippingAddress)) {
        throw new Error("Revisa la dirección y comprueba que el código postal coincide con la provincia.");
      }
      setMessage(sales ? "Guardando tus datos de entrega…" : "Verificando la solicitud…");
      if (!waitlist) socialEvent("reservation_started", { sku: selection[0].sku, quantity: units });
      let nonce = 0;
      const encoder = new TextEncoder();
      while (true) {
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`${challenge}:${nonce}`)));
        if (digest[0] === 0 && digest[1] < 16) break;
        nonce++;
      }
      const result = await api("/api/reservations", {
        requestId: challenge.split(".")[0],
        challenge,
        nonce: String(nonce),
        customer,
        items: selection,
        accepted,
        marketing,
        website,
        expirationHours: inventory?.expirationHours ?? 0,
        waitlist,
        address: waitlist ? undefined : shippingAddress,
      });
      if (!waitlist) {
        socialEvent("reservation_completed", { sku: selection[0].sku, quantity: units });
        trackGoogleCommerce("add_shipping_info", items);
        void trackFunnel("shirts", 4);
      }
      if (fromCart) {
        try { sessionStorage.setItem("imperio-cart-reservation", result.id); } catch { /* The order is still available. */ }
      }
      const manage = attributedPath(result.url);
      if (!sales || waitlist) {
        window.location.assign(manage);
        return;
      }

      const credential = new URL(manage, window.location.origin).hash.slice(1);
      const [id, token] = credential.split(".");
      if (id !== result.id || !/^[\da-f]{64}$/i.test(token ?? "")) {
        window.location.assign(manage);
        return;
      }
      const order = { id, token, customer, address: shippingAddress, delivery };
      reservedOrder.current = order;
      setRecoveryUrl(manage);
      try { sessionStorage.setItem("imperio-reservation-access", credential); } catch { /* The private order link still works. */ }
      await startPayment(order);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la solicitud.");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  const action = paymentReady ? "Confirmar pago" : recoveryUrl ? "Reintentar cargar el pago" :
    waitlist ? "Confirmar lista de espera" : sales ? stripePublishableKey ? "Continuar al pago" : "Confirmar y pagar en Stripe" :
    reserving ? "Reservar · 0 €" : "Compra no disponible";

  return (
    <form class="shirt-checkout" method="post" data-funnel-flow="shirts" onSubmit={submit} aria-busy={busy || initialLoading} aria-describedby="reservation-feedback">
      <section class="shirt-checkout__information" aria-labelledby="checkout-information">
        <div class="shirt-checkout__section-heading">
          <h2 id="checkout-information">Tus datos</h2>
          {!initialCustomer.email && <a href={loginHref}>Iniciar sesión</a>}
        </div>

        <fieldset class="shirt-checkout__group" disabled={detailsDisabled}>
          <legend>Camiseta</legend>
          {fromCart ? (
            <p><a href="/carrito">Editar carrito</a></p>
          ) : (
            <div class="reservation-fields">
              <label>Talla
                <select name="size" value={size} onChange={(event) => {
                  setSize(event.currentTarget.value as ShirtSize);
                  setWaitlist(false);
                  setQuantity(1);
                }}>
                  {SHIRT_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              {!waitlist && !unavailable && <label>Cantidad
                <input name="quantity" type="number" min="1" max={maximum} step="1" required value={quantity || ""}
                  onInput={(event) => setQuantity(Number(event.currentTarget.value))} />
              </label>}
            </div>
          )}
          {unavailable && !recoveryUrl && <p role="status">{fromCart ? "Alguna talla de tu carrito está agotada." : "La talla seleccionada está agotada."}</p>}
          {fromCart && !cartItems.length && !initialLoading && <p role="status">Tu carrito está vacío.</p>}
        </fieldset>

        {unavailable && !waitlist && !fromCart && !recoveryUrl &&
          <button class="shirt-checkout__secondary" type="button" disabled={busy || !canWait} onClick={() => setWaitlist(true)}>Apuntarme a la lista de espera</button>}

        {canEnterDetails && (
          <>
            <fieldset class="shirt-checkout__group" disabled={detailsDisabled}>
              <legend>Contacto</legend>
              <div class="reservation-fields">
                <label>Nombre y apellidos
                  <input name="customerName" autoComplete="name" required minLength={2} maxLength={150} value={customer.name}
                    onInput={(event) => setCustomer({ ...customer, name: event.currentTarget.value })} />
                </label>
                <label>Correo electrónico
                  <input name="email" type="email" autoComplete="email" required maxLength={254} value={customer.email}
                    onInput={(event) => setCustomer({ ...customer, email: event.currentTarget.value })} />
                </label>
              </div>
            </fieldset>

            {!waitlist && (
              <>
                <label class="shirt-checkout__consent">
                  <input type="checkbox" checked={differentRecipient} disabled={detailsDisabled} onChange={(event) => setDifferentRecipient(event.currentTarget.checked)} />
                  <span>Enviar a otra persona</span>
                </label>
                <AddressFields value={address} onChange={setAddress} disabled={detailsDisabled} includeRecipient={differentRecipient} />
                {sales && <fieldset class="shirt-checkout__group shirt-checkout__delivery" disabled={detailsDisabled}>
                  <legend>Envío</legend>
                  {SHIRT_DELIVERY_OPTIONS.map((option) => (
                    <label class="shirt-checkout__delivery-option" key={option.id}>
                      <input type="radio" name="delivery" value={option.id} checked={option.id === delivery}
                        onChange={() => setDelivery(option.id)} />
                      <span><strong>{option.label}</strong><small>{option.description}</small></span>
                      <span>{option.amount ? formatMoney(option.amount) : "Gratis"}</span>
                    </label>
                  ))}
                </fieldset>}
              </>
            )}

            <label class="shirt-checkout__trap" aria-hidden="true">Sitio web
              <input tabIndex={-1} autoComplete="off" value={website} onInput={(event) => setWebsite(event.currentTarget.value)} />
            </label>

            {sales && !waitlist && stripePublishableKey && (
              <section class="shirt-checkout__payment" aria-labelledby="checkout-payment-title">
                <h2 id="checkout-payment-title">Pago</h2>
                <div class="shirt-checkout__payment-element" ref={paymentMount} />
              </section>
            )}
            {waitlist && <p>Te avisaremos si vuelve a estar disponible tu talla.</p>}
            {reserving && !waitlist && <div class="shirt-checkout__reservation-note">
              <p>La reserva es gratuita. Podrás completar la compra cuando se abra el pago.</p>
              {inventory?.campaign.purchase_open_at && <p>
                Apertura prevista: {new Date(inventory.campaign.purchase_open_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} (hora peninsular).
              </p>}
              {inventory?.expirationHours ? <p>La reserva caduca a las {inventory.expirationHours} horas de confirmarla.</p> : null}
            </div>}
          </>
        )}
      </section>

      <aside class="shirt-checkout__summary" aria-labelledby="checkout-summary">
        <h2 id="checkout-summary">{waitlist ? "Tu solicitud" : sales ? "Tu pedido" : "Tu reserva"}</h2>
        {!!items.length && (
          <ul class="shirt-checkout__items">
            {items.map((item) => (
              <li class="shirt-checkout__item" key={item.size}>
                <img src="/images/camiseta-imperio-frontal-640.webp" width="80" height="96" alt="" decoding="async" />
                <div>
                  <strong>Camiseta Imperial</strong>
                  <span>Talla {item.size}</span>
                  <span>Cantidad {item.quantity || "—"}</span>
                </div>
                <strong>{formatMoney(SHIRT_PRODUCT_PRICE_CENTS * (item.quantity || 0))}</strong>
              </li>
            ))}
          </ul>
        )}
        {!waitlist && !!items.length && (
          <dl class="shirt-checkout__totals">
            <div><dt>Subtotal</dt><dd>{formatMoney(itemTotal)}</dd></div>
            <div><dt>Envío</dt><dd>{formatMoney(shippingTotal)}</dd></div>
            {confirmedTotal && confirmedTotal.discount > 0 && <div><dt>Descuento</dt><dd>−{formatMoney(confirmedTotal.discount)}</dd></div>}
            <div class="shirt-checkout__total"><dt>Total <small>(IVA incluido)</small></dt><dd>{confirmedTotal?.amount ?? formatMoney(total)}</dd></div>
          </dl>
        )}
      </aside>

      <div class="shirt-checkout__actions">
        {canEnterDetails && (
          <>
            <label class="shirt-checkout__consent">
              <input type="checkbox" checked={accepted} required disabled={detailsDisabled} onChange={(event) => setAccepted(event.currentTarget.checked)} />
              <span>Acepto las{" "}
                <a href={sales && !waitlist ? "/legal/terminos" : "/legal/reservas"} target="_blank" rel="noreferrer">
                  {sales && !waitlist ? "condiciones de compra" : "condiciones de reserva"}
                </a> y he leído la <a href="/legal/privacidad" target="_blank" rel="noreferrer">política de privacidad</a>.
              </span>
            </label>
            <label class="shirt-checkout__consent">
              <input type="checkbox" checked={marketing} disabled={detailsDisabled} onChange={(event) => setMarketing(event.currentTarget.checked)} />
              <span>{EMAIL_MARKETING_CONSENT} Opcional.</span>
            </label>
            <button class="shirt-checkout__submit" type="submit"
              disabled={busy || (paymentActions.current !== null && !paymentReady) || (!recoveryUrl && !canStart)}>
              {busy ? "Un momento…" : initialLoading ? "Comprobando disponibilidad…" : action}
            </button>
          </>
        )}
        {recoveryUrl && <p><a href={recoveryUrl}>Revisar los datos de mi pedido</a></p>}
        {inventoryError && !recoveryUrl && <p role="status">No se ha podido consultar la disponibilidad. Vuelve a intentarlo en unos segundos.</p>}
        {inventory && !sales && !reserving && !waitlist && !unavailable &&
          <p role="status">La compra no está disponible en este momento.</p>}
        <p id="reservation-feedback" role="status" aria-live="polite" aria-atomic="true">{message}</p>
      </div>
    </form>
  );
}
