import { useEffect, useState } from "preact/hooks";
import {
  formatMoney,
  RESERVATION_STATUS,
  SHIRT_PRICE_COPY,
} from "../../config/commerce";
import { api } from "./shared";
export default function MyReservations() {
  const [rows, setRows] = useState<any[]>([]),
    [message, setMessage] = useState("Consultando reservas...");
  useEffect(() => {
    let active = true;
    void api("/api/reservations/mine")
      .then((d) => {
        if (active) {
          setRows(d.reservations);
          setMessage(
            d.reservations.length
              ? ""
              : "No tienes reservas asociadas a esta cuenta.",
          );
        }
      })
      .catch(() => {
        if (active) setMessage("No se pudieron consultar las reservas.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section>
      <h2>Mis reservas</h2>
      <p>{SHIRT_PRICE_COPY}</p>
      {rows.map((r) => (
        <p key={r.id}>
          <a class="commerce-reference" href={`/reservas/gestionar?id=${r.id}`}>
            {r.number}
          </a>
          <br />
          {r.total_quantity} unidades · {formatMoney(r.total_price_snapshot)} ·{" "}
          {RESERVATION_STATUS[r.status]}
        </p>
      ))}
      <p role="status">{message}</p>
      <p>
        Las reservas sin cuenta se consultan mediante el enlace privado del
        correo de confirmacion.
      </p>
    </section>
  );
}
