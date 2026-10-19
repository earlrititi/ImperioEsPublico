import { useEffect, useRef, useState } from "preact/hooks";
import { RESERVATION_STATUS } from "../../config/commerce";
import { isMainlandAddress } from "../../lib/reservation-validation";
import {trackFunnel} from "../../lib/funnel-client";
import { trackConfirmedGooglePurchase } from "../../lib/google-analytics";
import { changeCart, readCart, saveCart, SHIRT_SIZES, type ShirtSize } from "../../lib/cart";
import { LEGAL_BUSINESS, LEGAL_LINKS } from "../../config/legal";
import {
  AddressFields,
  AddressSummary,
  api,
  emptyAddress,
  ItemsSummary,
} from "./shared";

export default function ReservationManager({ paymentReturn = false }: { paymentReturn?: boolean }) {
  const [access, setAccess] = useState({ id: "", token: "" }),
    [r, setR] = useState<any>(null),
    [address, setAddress] = useState(emptyAddress);
  const [mode, setMode] = useState(true),
    [message, setMessage] = useState("Consultando reserva..."),
    [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "" });
  const [editing, setEditing] = useState(false);
  const [confirmationDelayed, setConfirmationDelayed] = useState(false);
  const [analyticsPurchase, setAnalyticsPurchase] = useState<unknown>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const notifiedPaid = useRef(false);
  useEffect(() => {
    if (!paymentReturn || r?.status !== "CONVERTED_TO_ORDER" || !analyticsPurchase) return;
    const measure = () => { trackConfirmedGooglePurchase(analyticsPurchase); };
    measure();
    window.addEventListener("imperio:cookie-consent", measure);
    return () => window.removeEventListener("imperio:cookie-consent", measure);
  }, [paymentReturn, r?.status, analyticsPurchase]);
  useEffect(() => {
    if (paymentReturn && r?.status === "CONVERTED_TO_ORDER" && !notifiedPaid.current) {
      notifiedPaid.current = true;
      try {
        if (sessionStorage.getItem("imperio-cart-reservation") === r.id) {
        let cart = readCart();
        for (const item of r.reservation_items ?? []) {
          const size = item.size as ShirtSize;
          if (!SHIRT_SIZES.includes(size)) continue;
          const current = cart.find(line => line.size === size);
          if (current) cart = changeCart(cart, size, Math.max(0, current.quantity - item.quantity));
        }
        saveCart(cart);
        sessionStorage.removeItem("imperio-cart-reservation");
        }
      } catch { /* A confirmed order must remain visible when browser storage is blocked. */ }
      heading.current?.focus();
    }
  }, [paymentReturn, r?.status]);
  useEffect(() => {
    const fragment = window.location.hash.slice(1);
    let saved = "";
    try {
      saved = sessionStorage.getItem("imperio-reservation-access") ?? "";
    } catch {}
    const idFromAccount = new URLSearchParams(window.location.search).get("id");
    const raw = fragment || (idFromAccount ? `${idFromAccount}.` : saved);
    const [id, token = ""] = raw.split(".");
    if (fragment) {
      try {
        sessionStorage.setItem("imperio-reservation-access", fragment);
      } catch {}
      history.replaceState(null, "", window.location.pathname);
    }
    if (!id) {
      setMessage(
        "Abre el enlace privado de tu reserva o accede desde tu cuenta.",
      );
      return;
    }
    const credentials = { id, token };
    setAccess(credentials);
    let active = true;
    let initialized = false;
    let timer: ReturnType<typeof setInterval>;
    const started = Date.now();
    const refresh = async () => {
      try {
        const data = await api(`/api/reservations/${id}`, {
          action: "view",
          token,
        });
        if (active) {
          setR(data.reservation);
          setAnalyticsPurchase(data.analyticsPurchase ?? null);
          setMode(data.reservationMode);
          if (!initialized) {
            setCustomer({ name: data.reservation.customer_name, email: data.reservation.customer_email });
            setAddress(
              data.reservation.paymentAddress ??
                data.reservation.shipping_address ?? { ...emptyAddress, name: data.reservation.customer_name },
            );
            setEditing(!isMainlandAddress(data.reservation.paymentAddress ?? data.reservation.shipping_address));
            initialized = true;
          }
          setMessage("");
          if (["CONVERTED_TO_ORDER", "CANCELLED", "EXPIRED"].includes(data.reservation.status)) clearInterval(timer);
          if (paymentReturn && Date.now() - started > 90000) setConfirmationDelayed(true);
        }
      } catch (e) {
        if (active)
          setMessage(e instanceof Error ? e.message : "No disponible");
      }
    };
    void refresh();
    timer = setInterval(() => {
      if (paymentReturn && Date.now() - started > 180000) { clearInterval(timer); return; }
      if (!document.hidden) void refresh();
    }, paymentReturn ? 5000 : 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function cancel() {
    if (!confirm("Cancelar la reserva y liberar las unidades?")) return;
    setBusy(true);
    try {
      const data = await api(`/api/reservations/${access.id}`, {
        action: "cancel",
        token: access.token,
      });
      setR(data.reservation);
      setMessage("Reserva cancelada. No se ha realizado ningun cobro.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No disponible");
    } finally {
      setBusy(false);
    }
  }
  async function pay(e: SubmitEvent) {
    e.preventDefault();
    if (submitting.current || busy || editing) return;
    if (!isMainlandAddress(address)) {
      setMessage("Comprueba la direccion peninsular.");
      return;
    }
    setBusy(true);
    submitting.current = true;
    setMessage("Abriendo el pago seguro. Tus datos ya estan guardados.");
    try {
      const data = await api(`/api/reservations/${access.id}/checkout`, {
        token: access.token,
        address,
        confirmPurchase: true,
        customer,
      });
      await trackFunnel("shirts",5,"/reservas");
      window.location.assign(data.url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No disponible");
      setBusy(false);
      submitting.current = false;
    }
  }
  async function resetPayment() {
    setBusy(true);
    try {
      const data = await api(`/api/reservations/${access.id}`, {
        action: "reset-payment",
        token: access.token,
      });
      setR(data.reservation);
      setMessage("Sesion de pago cerrada. Puedes revisar la direccion.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No disponible");
    } finally {
      setBusy(false);
    }
  }
  if (!r) return <p role="status">{message}</p>;
  const paid = r.status === "CONVERTED_TO_ORDER";
  const order = r.commerce_orders;
  const confirming = paymentReturn && r.status === "PAYMENT_PENDING";
  const paymentLocked = ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(r.status);
  const canPay = !mode && ["PURCHASE_AVAILABLE", "PAYMENT_FAILED", "PAYMENT_PENDING"].includes(r.status) && !confirming;
  function finishEditing() {
    if (!isMainlandAddress(address) || customer.name.trim().length < 2 || customer.name.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) || customer.email.length > 254) {
      setMessage("Revisa el nombre, el correo y la direccion peninsular antes de continuar.");
      return;
    }
    setEditing(false);
    setMessage("Datos revisados. Puedes continuar al pago.");
    editButton.current?.focus();
  }
  return (
    <section class="reservation-manager" aria-busy={busy}>
      <h2 ref={heading} tabIndex={-1}>
        {paid
          ? (paymentReturn ? "Pago recibido" : "Pedido confirmado")
          : confirming
            ? "Estamos confirmando tu pago."
          : r.status === "PAYMENT_FAILED" ? "El pago no se ha completado"
          : r.status === "RESERVED"
            ? "Reserva confirmada"
            : RESERVATION_STATUS[r.status]}
      </h2>
      {confirming && <div class="reservation-payment-status" role="status" aria-live="polite" aria-atomic="true">
        <p>{confirmationDelayed ? "La confirmacion esta tardando un poco mas de lo habitual. No repitas el pago; te avisaremos por correo cuando se confirme." : "Estamos comprobando el resultado del pago. Esta pantalla se actualiza automaticamente; no necesitas volver a pagar."}</p>
        {confirmationDelayed && <button type="button" class="btn btn-ghost" onClick={() => window.location.reload()}>Comprobar estado</button>}
      </div>}
      {paid && <p role="status">Tu pedido esta confirmado. Recibiras los detalles por correo; no necesitas rellenar nada mas.</p>}
      <p class="commerce-reference">{r.number}</p>
      {r.marketing_consent && <button class="btn btn-ghost" disabled={busy} onClick={async () => {
        setBusy(true);
        try { const data = await api(`/api/reservations/${access.id}`, { action: "marketing-withdraw", token: access.token }); setR(data.reservation); setMessage("Consentimiento comercial retirado."); }
        catch (e) { setMessage(e instanceof Error ? e.message : "No disponible"); }
        finally { setBusy(false); }
      }}>Retirar consentimiento comercial</button>}
      {!canPay && <p>Estado: {RESERVATION_STATUS[r.status]}</p>}
      <ItemsSummary
        items={r.reservation_items}
        total={r.total_price_snapshot}
      />
      {(canPay || order?.shipping_address || r.paymentAddress || r.shipping_address) && <h3>Contacto y entrega</h3>}
      <AddressSummary
        address={
          canPay ? address : order?.shipping_address ?? r.paymentAddress ?? r.shipping_address
        }
      />
      <p>
        {canPay ? customer.name : r.customer_name}{" \u00b7 "}{canPay ? customer.email : r.customer_email}{r.customer_phone ? ` \u00b7 ${r.customer_phone}` : ""}
      </p>
      {!paid && !confirming && (
        <>
          <p>
            <strong>
              {["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(r.status)
                ? "El pago todavia no se ha confirmado. No inicies otro si tu banco ya muestra un cargo."
                : "NO SE HA REALIZADO NINGUN COBRO."}
            </strong>
          </p>
          {r.status === "RESERVED" && <p>
            Cuando abramos las ventas podras revisar estos datos y completar el
            pago.
          </p>}
        </>
      )}
      {r.status === "WAITLIST" && <p>Estas en la lista de espera. No se ha asignado stock ni existe obligacion de compra.</p>}
      {!paid && r.expires_at && (
        <p>
          Reserva valida hasta: {new Date(r.expires_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} (hora peninsular)
        </p>
      )}
      {order && (
        <>
          <p>Pedido: {order.number}</p>
          <p>Envio: {RESERVATION_STATUS[order.status]}</p>
          {order.tracking_number && (
            <p>
              {order.carrier}: {order.tracking_number}
            </p>
          )}
        </>
      )}
      {canPay && (
          <form onSubmit={pay} aria-describedby="purchase-feedback">
            <h3>Revisa y continua al pago</h3>
            <button ref={editButton} type="button" class="btn btn-ghost" disabled={busy || paymentLocked} aria-expanded={editing} aria-controls="purchase-edit-fields" onClick={() => editing ? finishEditing() : setEditing(true)}>
              {editing ? "Usar estos datos" : "Editar contacto y entrega"}
            </button>
            <div id="purchase-edit-fields" hidden={!editing}>{editing && <>
            <fieldset disabled={busy || paymentLocked}>
              <legend>Contacto de compra</legend>
              <label>Nombre<input autoComplete="name" required minLength={2} maxLength={150} value={customer.name} onInput={(e) => setCustomer({ ...customer, name: e.currentTarget.value })} /></label>
              <label>Email<input type="email" autoComplete="email" required maxLength={254} value={customer.email} onInput={(e) => setCustomer({ ...customer, email: e.currentTarget.value })} /></label>
            </fieldset>
            <AddressFields value={address} onChange={setAddress} disabled={busy || paymentLocked} />
            <button type="button" class="btn btn-ghost" onClick={finishEditing}>Usar estos datos</button>
            </>}</div>
            <details class="reservation-purchase-details">
            <summary>Producto, envio y condiciones</summary>
            <picture>
              <source type="image/avif" srcSet="/images/cuadros-explicativos-camiseta-640.avif 640w, /images/cuadros-explicativos-camiseta-960.avif 960w" sizes="(max-width: 760px) calc(100vw - 48px), 640px" />
              <img src="/images/cuadros-explicativos-camiseta-960.webp" srcSet="/images/cuadros-explicativos-camiseta-640.webp 640w, /images/cuadros-explicativos-camiseta-960.webp 960w" sizes="(max-width: 760px) calc(100vw - 48px), 640px" alt="Camiseta Imperial, modelo y detalles" width="1920" height="1080" loading="lazy" decoding="async" style={{ maxWidth: "100%", height: "auto", objectFit: "contain" }} />
            </picture>
            <p>Vendedor: {LEGAL_BUSINESS.ownerName}, {LEGAL_BUSINESS.tradeName}. NIF {LEGAL_BUSINESS.taxId}. {LEGAL_BUSINESS.registeredAddress}.</p>
            <p>Camiseta: 26,99 EUR + 3 EUR de envio por unidad. IVA incluido. Solo Peninsula. Preparacion maxima: 48 horas; entrega maxima: 7 dias laborables tras el pago.</p>
            <p>Descuento de suscriptor: vinculado a la cuenta verificada y al correo de la reserva. No incluye el envio. <a href="/login?next=/reservas/gestionar">Iniciar sesion</a></p>
            <p>Desistimiento: 14 dias naturales desde la recepcion. Esta camiseta de diseno fijo no se considera personalizada para el comprador.</p>
            <nav aria-label="Condiciones de compra">{LEGAL_LINKS.map((link) => <p key={link.href}><a href={link.href} target="_blank" rel="noreferrer">{link.label}</a></p>)}</nav>
            </details>
            {["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(r.status) && (
              <button
                type="button"
                class="btn btn-ghost"
                disabled={busy}
                onClick={resetPayment}
              >
                Cerrar sesion de pago y revisar direccion
              </button>
            )}
            <label class="reservation-consent">
              <input type="checkbox" required disabled={busy || editing} />
              <span>
                He revisado mis datos y acepto las{" "}
                <a href="/legal/terminos">condiciones de compra</a>. Confirmo el
                acceso al pago seguro en Stripe, donde vere el importe final antes de pagar.
              </span>
            </label>
            <button class="btn btn-primary" type="submit" disabled={busy || editing}>
              {busy ? "Abriendo Stripe..." : "Continuar al pago seguro"}
            </button>
          </form>
        )}
      {["WAITLIST", "RESERVED", "PURCHASE_AVAILABLE", "PAYMENT_FAILED", "PAYMENT_PENDING"].includes(r.status) && !confirming && (
        <details class="reservation-purchase-details">
          <summary>Cancelar la reserva</summary>
          <p>Esta opcion libera las unidades. Si hay un pago en curso, antes se comprobara su estado.</p>
          <button type="button" class="btn btn-ghost" disabled={busy} onClick={cancel}>Cancelar reserva</button>
        </details>
      )}
      <p id="purchase-feedback" role="status" aria-live="polite" aria-atomic="true">
        {message}
      </p>
      <p>
        <a href="/tienda">Volver a la tienda</a> ·{" "}
        <a href="mailto:contacto@imperioes.com">Contacto</a>
      </p>
    </section>
  );
}
