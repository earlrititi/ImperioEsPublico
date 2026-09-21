import { useEffect, useState } from "preact/hooks";
import { RESERVATION_STATUS } from "../../config/commerce";
import { isMainlandAddress } from "../../lib/reservation-validation";
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
      history.replaceState(null, "", "/reservas/gestionar");
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
    const refresh = async () => {
      try {
        const data = await api(`/api/reservations/${id}`, {
          action: "view",
          token,
        });
        if (active) {
          setR(data.reservation);
          setMode(data.reservationMode);
          if (!initialized) {
            setCustomer({ name: data.reservation.customer_name, email: data.reservation.customer_email });
            setAddress(
              data.reservation.paymentAddress ??
                data.reservation.shipping_address ?? { ...emptyAddress, name: data.reservation.customer_name },
            );
            initialized = true;
          }
          setMessage("");
        }
      } catch (e) {
        if (active)
          setMessage(e instanceof Error ? e.message : "No disponible");
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 10000);
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
    if (!isMainlandAddress(address)) {
      setMessage("Comprueba la direccion peninsular.");
      return;
    }
    setBusy(true);
    try {
      const data = await api(`/api/reservations/${access.id}/checkout`, {
        token: access.token,
        address,
        confirmPurchase: true,
        customer,
      });
      window.location.assign(data.url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No disponible");
      setBusy(false);
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
  return (
    <section class="reservation-manager">
      <h2>
        {paid
          ? (paymentReturn ? "Pago recibido" : "Pedido confirmado")
          : paymentReturn && ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(r.status)
            ? "Estamos confirmando tu pago."
          : r.status === "RESERVED"
            ? "Reserva confirmada"
            : RESERVATION_STATUS[r.status]}
      </h2>
      <p class="commerce-reference">{r.number}</p>
      {r.marketing_consent && <button class="btn btn-ghost" disabled={busy} onClick={async () => {
        setBusy(true);
        try { const data = await api(`/api/reservations/${access.id}`, { action: "marketing-withdraw", token: access.token }); setR(data.reservation); setMessage("Consentimiento comercial retirado."); }
        catch (e) { setMessage(e instanceof Error ? e.message : "No disponible"); }
        finally { setBusy(false); }
      }}>Retirar consentimiento comercial</button>}
      <p>Estado: {RESERVATION_STATUS[r.status]}</p>
      <ItemsSummary
        items={r.reservation_items}
        total={r.total_price_snapshot}
      />
      {(order?.shipping_address || r.paymentAddress || r.shipping_address) && <h3>Direccion de entrega</h3>}
      <AddressSummary
        address={
          order?.shipping_address ?? r.paymentAddress ?? r.shipping_address
        }
      />
      <p>
        {r.customer_email}{r.customer_phone ? ` \u00b7 ${r.customer_phone}` : ""}
      </p>
      {!paid && (
        <>
          <p>
            <strong>
              {["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(r.status)
                ? "El pago todavia no se ha confirmado."
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
      {[
        "WAITLIST",
        "RESERVED",
        "PURCHASE_AVAILABLE",
        "PAYMENT_FAILED",
        "PAYMENT_PENDING",
      ].includes(r.status) && (
        <button class="btn btn-ghost" disabled={busy} onClick={cancel}>
          Cancelar reserva
        </button>
      )}
      {!mode &&
        ["PURCHASE_AVAILABLE", "PAYMENT_FAILED", "PAYMENT_PENDING"].includes(
          r.status,
        ) && (
          <form onSubmit={pay}>
            <h3>Revision final de compra</h3>
            <fieldset disabled={busy || ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(r.status)}>
              <legend>Contacto de compra</legend>
              <label>Nombre<input autoComplete="name" required minLength={2} maxLength={150} value={customer.name} onInput={(e) => setCustomer({ ...customer, name: e.currentTarget.value })} /></label>
              <label>Email<input type="email" autoComplete="email" required maxLength={254} value={customer.email} onInput={(e) => setCustomer({ ...customer, email: e.currentTarget.value })} /></label>
            </fieldset>
            <img src="/images/cuadros-explicativos-camiseta.webp" alt="Camiseta Imperial, modelo y detalles" width="640" height="640" style={{ maxWidth: "100%", height: "auto", objectFit: "contain" }} />
            <p>Vendedor: {LEGAL_BUSINESS.ownerName}, {LEGAL_BUSINESS.tradeName}. NIF {LEGAL_BUSINESS.taxId}. {LEGAL_BUSINESS.registeredAddress}.</p>
            <p>Unidades asignadas a tu reserva. Envio estandar peninsular: 0 EUR adicionales. IVA incluido. Preparacion maxima: 48 horas; entrega maxima: 7 dias laborables tras el pago.</p>
            <p>Desistimiento: 14 dias naturales desde la recepcion. Esta camiseta de diseno fijo no se considera personalizada para el comprador.</p>
            <nav aria-label="Condiciones de compra">{LEGAL_LINKS.map((link) => <p key={link.href}><a href={link.href} target="_blank" rel="noreferrer">{link.label}</a></p>)}</nav>
            <AddressFields
              value={address}
              onChange={setAddress}
              disabled={
                busy || ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(r.status)
              }
            />
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
              <input type="checkbox" required />
              <span>
                He revisado mis datos y acepto las{" "}
                <a href="/legal/terminos">condiciones de compra</a>. Confirmo el
                pago del importe mostrado.
              </span>
            </label>
            <button class="btn btn-primary" disabled={busy}>
              Confirmar y pagar
            </button>
          </form>
        )}
      <p role="status" aria-live="polite">
        {message}
      </p>
      <p>
        <a href="/tienda">Volver a la tienda</a> ·{" "}
        <a href="mailto:contacto@imperioes.com">Contacto</a>
      </p>
    </section>
  );
}
