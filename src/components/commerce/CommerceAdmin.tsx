import { useEffect, useState } from "preact/hooks";
import { formatMoney, RESERVATION_STATUS } from "../../config/commerce";
import { AddressSummary, api, ItemsSummary } from "./shared";

export default function CommerceAdmin() {
  const [view, setView] = useState("reservations"),
    [page, setPage] = useState(0),
    [data, setData] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const d = await api(`/api/commerce-admin?view=${view}&page=${page}`);
    setData(d);
  }
  useEffect(() => {
    let active = true;
    setData(null);
    setMessage("");
    const load = () =>
      api(`/api/commerce-admin?view=${view}&page=${page}`)
        .then((d) => {
          if (active) setData(d);
        })
        .catch((e) => {
          if (active) setMessage(e.message);
        });
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [view, page]);
  async function action(
    action: string,
    id?: string,
    extra: Record<string, unknown> = {},
  ) {
    if (
      ["cancel", "open", "campaign-activate", "invite-next"].includes(action) &&
      !confirm(
        action === "cancel"
          ? "Cancelar y liberar el stock?"
          : "Abrir la compra y notificar al cliente?",
      )
    )
      return;
    setBusy(true);
    try {
      const result = await api("/api/commerce-admin", {
        action,
        id,
        requestId: crypto.randomUUID(),
        ...extra,
      });
      setMessage(
        result.disabled
          ? "El envio de correo esta desactivado en este entorno."
          : "Operacion completada.",
      );
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operacion no disponible.");
    } finally {
      setBusy(false);
    }
  }
  const stats = data?.stats;
  return (
    <section class="commerce-admin">
      {!data && !message && <p role="status">Cargando reservas...</p>}
      {message && <p role="status" aria-live="polite">{message}</p>}
      <nav class="commerce-admin-nav" aria-label="Gestion comercial">
        <button class="btn btn-ghost" aria-pressed={view === "waitlist"} onClick={() => { setView("waitlist"); setPage(0); }}>Lista de espera</button>
        <a class="btn btn-ghost" href="/api/commerce-export">Exportar pedidos pagados</a>
        <button
          class="btn btn-ghost"
          aria-pressed={view === "reservations"}
          onClick={() => {
            setView("reservations");
            setPage(0);
          }}
        >
          Reservas
        </button>
        <button
          class="btn btn-ghost"
          aria-pressed={view === "orders"}
          onClick={() => {
            setView("orders");
            setPage(0);
          }}
        >
          Pedidos
        </button>
        <button
          class="btn btn-ghost"
          disabled={busy}
          onClick={() => action("mail")}
        >
          Procesar correos pendientes
        </button>
      </nav>
      {data?.campaign && <CampaignSettings campaign={data.campaign} busy={busy} onSave={(config) => action("campaign-configure", undefined, { config })} onActivate={() => action("campaign-activate")} disabled={data.reservationMode} />}
      {data && <div class="commerce-stats">
        <span><strong>{data.campaign.edition_total ?? "Pendiente"}</strong>Total de edicion</span>
        <span><strong>{data.waiting}</strong>En lista de espera</span>
        <span><strong>{data.expired}</strong>Reservas expiradas</span>
      </div>}
      {data?.legalPending?.length > 0 && <details><summary>Revision legal pendiente</summary><ul>{data.legalPending.map((text: string) => <li key={text}>{text}</li>)}</ul></details>}
      {stats && (
        <div class="commerce-stats">
          <span>
            <strong>{stats.reservations}</strong>Reservas activas
          </span>
          <span>
            <strong>{stats.reservedUnits}</strong>Unidades reservadas
          </span>
          <span>
            <strong>{formatMoney(stats.potentialValue)}</strong>Valor potencial
            de reservas
          </span>
          <span>
            <strong>{formatMoney(stats.collectedRevenue)}</strong>Ingresos
            cobrados netos de reembolsos
          </span>
          <span>
            <strong>{stats.paidOrders}</strong>Pedidos pagados
          </span>
          <span>
            <strong>{stats.paidUnits}</strong>Unidades vendidas
          </span>
          <span>
            <strong>{stats.pendingEmails}</strong>Correos pendientes (
            {stats.reviewEmails} en revision)
          </span>
        </div>
      )}
      <details class="commerce-inventory">
      <summary>Consultar inventario por talla</summary>
      <div class="commerce-table-wrap">
        <table>
          <caption>Inventario</caption>
          <thead>
            <tr>
              <th>SKU / talla / color</th>
              <th>Stock vendible</th>
              <th>Promocionales registradas</th>
              <th>Reservado</th>
              <th>Vendido</th>
              <th>Disponible</th>
              <th>Lista de espera</th>
            </tr>
          </thead>
          <tbody>
            {data?.inventory.map((v: any) => (
              <tr key={v.id}>
                <th scope="row">
                  {v.sku}
                  <small>
                    {v.name} · {v.color}
                  </small>
                </th>
                <td>{v.physical_stock}</td>
                <td>{v.promotional_stock}</td>
                <td>{v.reserved_stock}</td>
                <td>{v.sold_stock}</td>
                <td>{v.available_stock}</td>
                <td><button class="btn btn-ghost" disabled={busy || v.available_stock < 1} onClick={() => action("invite-next", undefined, { sku: v.sku })}>Invitar siguiente</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </details>
      <div class="commerce-table-wrap commerce-reservations-table" role="region" aria-label="Listado de reservas y pedidos" tabIndex={0}>
        <table>
          <caption>{view === "orders" ? "Pedidos" : view === "waitlist" ? "Lista de espera" : "Reservas"}</caption>
          <thead>
            <tr>
              <th>Reserva / nombre</th>
              <th>Direccion de entrega</th>
              <th>Talla y cantidad</th>
              <th>Total camisetas</th>
              <th>{view === "orders" ? "Total cobrado" : "Valor reservado"}</th>
              <th>Estado</th>
              <th>Detalle y acciones</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r: any) => (
              <tr key={r.id}>
                <th scope="row">
                  <span class="commerce-reference">{r.number ?? r.reservation_number}</span>
                  <small>{r.customer_name}</small>
                  <small>{r.customer_email}</small>
                </th>
                <td class="commerce-delivery-address">
                  {r.shipping_address ? <AddressSummary address={r.shipping_address} /> : <span>Direccion pendiente</span>}
                </td>
                <td>
                  <ul class="commerce-size-list">
                    {(r.reservation_items ?? r.commerce_order_items ?? []).map((item: any) => (
                      <li key={item.id ?? item.sku}><strong>{item.size}</strong>: {item.quantity} {item.quantity === 1 ? "camiseta" : "camisetas"}</li>
                    ))}
                  </ul>
                </td>
                <td>{r.total_quantity}</td>
                <td>
                  {formatMoney(r.total ?? r.total_price_snapshot)}
                  <small>IVA y envio incluidos</small>
                </td>
                <td>{RESERVATION_STATUS[r.status]}</td>
                <td>
                  <details>
                    <summary>Ver detalle</summary>
                    <p>{r.customer_phone}</p>
                    <p>Creada: {new Date(r.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>
                    {r.expires_at && <p>Fecha limite: {new Date(r.expires_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>}
                    {r.stripe_checkout_session_id && <p class="commerce-reference">Stripe: {r.stripe_checkout_session_id}</p>}
                    {r.order_id && <p class="commerce-reference">Pedido: {r.order_id}</p>}
                    {view !== "orders" && <p>Marketing: {r.marketing_consent ? "Aceptado" : "No aceptado"}</p>}
                    {view !== "orders" ? (
                      <>
                        <ItemsSummary
                          items={r.reservation_items}
                          total={r.total_price_snapshot}
                        />
                        <a href={`/reservas/gestionar?id=${r.id}`}>
                          Ver reserva
                        </a>
                        <div class="commerce-actions">
                          <button
                            class="btn btn-ghost"
                            disabled={
                              busy ||
                              ![
                                "WAITLIST",
                                "RESERVED",
                                "PURCHASE_AVAILABLE",
                                "PAYMENT_FAILED",
                                "PAYMENT_PENDING",
                              ].includes(r.status)
                            }
                            onClick={() => action("cancel", r.id)}
                          >
                            Cancelar
                          </button>
                          <button
                            class="btn btn-ghost"
                            disabled={busy}
                            onClick={() => action("resend", r.id)}
                          >
                            Reenviar email
                          </button>
                          <button
                            class="btn btn-primary"
                            disabled={
                              busy ||
                              data.reservationMode ||
                              r.status !== "RESERVED"
                            }
                            onClick={() => action("open", r.id)}
                          >
                            Abrir compra
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>Reserva: {r.reservation_number}</p>
                        <p>Reembolsado: {formatMoney(r.refunded_amount)}</p>
                        <ul>
                          {r.commerce_order_items.map((i: any) => (
                            <li key={i.id}>
                              {i.sku} · {i.quantity} x{" "}
                              {formatMoney(i.unit_price)}
                            </li>
                          ))}
                        </ul>
                        <Fulfillment
                          order={r}
                          busy={busy}
                          onSave={(extra) => action("fulfillment", r.id, extra)}
                        />
                      </>
                    )}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.rows.length === 0 && <p>No hay registros.</p>}
      <div class="commerce-admin-nav">
        <button
          class="btn btn-ghost"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>
        <span>Pagina {page + 1}</span>
        <button
          class="btn btn-ghost"
          disabled={!data || (page + 1) * 20 >= data.count}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
function CampaignSettings({ campaign, busy, disabled, onSave, onActivate }: {
  campaign: any; busy: boolean; disabled: boolean; onSave: (config: Record<string, unknown>) => void; onActivate: () => void;
}) {
  const [draft, setDraft] = useState(campaign);
  useEffect(() => setDraft(campaign), [campaign.updated_at]);
  return <details><summary>Campana de pre-reservas</summary>
    <form onSubmit={(e) => { e.preventDefault(); onSave(draft); }}>
      <fieldset disabled={busy || campaign.purchase_activated}>
        <legend>Configuracion</legend>
        <label>Total de edicion (pendiente si esta vacio)<input type="number" min="1" step="1" value={draft.edition_total ?? ""} onInput={(e) => setDraft({ ...draft, edition_total: e.currentTarget.value ? Number(e.currentTarget.value) : null })} /></label>
        <label>Maximo por pre-reserva (vacio: solo limita el stock)<input type="number" min="1" max="50" step="1" value={draft.max_reservation_quantity ?? ""} onInput={(e) => setDraft({ ...draft, max_reservation_quantity: e.currentTarget.value ? Number(e.currentTarget.value) : null })} /></label>
        <label>Ventana de compra (horas)<input type="number" required min="1" max="8760" step="1" value={draft.purchase_window_hours} onInput={(e) => setDraft({ ...draft, purchase_window_hours: Number(e.currentTarget.value) })} /></label>
        {([['reservations_open_at', 'Inicio de pre-reservas (UTC)'], ['purchase_open_at', 'Inicio de compra prioritaria (UTC)']] as const).map(([key, label]) => <label key={key}>{label}
          <input type="datetime-local" value={draft[key] ? new Date(draft[key]).toISOString().slice(0, 16) : ""} onInput={(e) => setDraft({ ...draft, [key]: e.currentTarget.value ? new Date(`${e.currentTarget.value}:00Z`).toISOString() : null })} />
        </label>)}
        <button class="btn btn-ghost" type="submit">Guardar campana</button>
      </fieldset>
    </form>
    <p>Estado: {campaign.purchase_activated ? "Compra prioritaria activada" : "Compra prioritaria desactivada"}</p>
    <button class="btn btn-primary" disabled={busy || disabled || campaign.purchase_activated} onClick={onActivate}>Activar periodo de compra</button>
  </details>;
}

function Fulfillment({
  order,
  busy,
  onSave,
}: {
  order: any;
  busy: boolean;
  onSave: (data: Record<string, string>) => void;
}) {
  const [carrier, setCarrier] = useState(order.carrier ?? "Correos"),
    [tracking, setTracking] = useState(order.tracking_number ?? "");
  const next: Record<string, string> = {
    READY_FOR_FULFILLMENT: "PREPARING",
    PREPARING: "READY_TO_SHIP",
    READY_TO_SHIP: "SHIPPED",
    SHIPPED: "DELIVERED",
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ status: next[order.status], carrier, tracking });
      }}
    >
      <label>
        Transportista
        <input
          value={carrier}
          maxLength={80}
          onInput={(e) => setCarrier(e.currentTarget.value)}
        />
      </label>
      <label>
        Seguimiento
        <input
          value={tracking}
          maxLength={150}
          required={next[order.status] === "SHIPPED"}
          onInput={(e) => setTracking(e.currentTarget.value)}
        />
      </label>
      {next[order.status] && (
        <button class="btn btn-primary" disabled={busy}>
          Marcar: {RESERVATION_STATUS[next[order.status]]}
        </button>
      )}
    </form>
  );
}
