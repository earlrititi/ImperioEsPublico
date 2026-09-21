import {
  PROVINCES,
  SHIRT_PRICE_COPY,
  formatMoney,
} from "../../config/commerce";
import type { ShippingAddress } from "../../lib/reservation-validation";

export const emptyAddress: ShippingAddress = {
  name: "",
  line1: "",
  line2: "",
  postalCode: "",
  city: "",
  province: "",
  country: "ES",
};
export async function api(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la solicitud.");
  return data;
}
export function AddressFields({
  value,
  onChange,
  disabled = false,
}: {
  value: ShippingAddress;
  onChange: (a: ShippingAddress) => void;
  disabled?: boolean;
}) {
  const field = (
    key: keyof ShippingAddress,
    label: string,
    autoComplete: string,
    maxLength = 200,
    required = true,
  ) => (
    <label>
      {label}
      <input
        name={key}
        autoComplete={autoComplete}
        value={value[key]}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
        onInput={(e) => onChange({ ...value, [key]: e.currentTarget.value })}
      />
    </label>
  );
  return (
    <fieldset class="reservation-address" disabled={disabled}>
      <legend>Direccion de entrega</legend>
      {field(
        "name",
        "Nombre y apellidos del destinatario",
        "shipping name",
        150,
      )}
      {field("line1", "Direccion", "shipping address-line1")}
      {field(
        "line2",
        "Piso, puerta u otros datos (opcional)",
        "shipping address-line2",
        200,
        false,
      )}
      <div class="reservation-fields">
        {field("postalCode", "Codigo postal", "shipping postal-code", 5)}
        {field("city", "Localidad", "shipping address-level2", 100)}
      </div>
      <div class="reservation-fields">
        <label>
          Provincia
          <select
            name="province"
            value={value.province}
            required
            onChange={(e) =>
              onChange({ ...value, province: e.currentTarget.value })
            }
          >
            <option value="">Seleccionar provincia</option>
            {PROVINCES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pais
          <input name="country" value="Espana" readOnly />
        </label>
      </div>
      <p>Actualmente no realizamos envios fuera de Espana peninsular.</p>
    </fieldset>
  );
}
export function ItemsSummary({
  items,
  total,
}: {
  items: any[];
  total: number;
}) {
  return (
    <div class="reservation-summary">
      <div class="commerce-table-wrap">
        <table>
          <caption>Resumen</caption>
          <thead>
            <tr>
              <th>Producto / talla</th>
              <th>Unidades</th>
              <th>Precio unitario</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.sku}>
                <th scope="row">
                  {i.product_name ?? "Camiseta Imperial"} · {i.size}
                  <small>
                    {i.color ?? "Diseno Imperial"} · {i.sku}
                  </small>
                </th>
                <td>{i.quantity}</td>
                <td>{formatMoney(i.unit_price_snapshot)}</td>
                <td>{formatMoney(i.quantity * i.unit_price_snapshot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>IVA: incluido · Envio estandar a Peninsula: incluido</p>
      <p class="reservation-total">Total: {formatMoney(total)}</p>
      <p>{SHIRT_PRICE_COPY}</p>
    </div>
  );
}
export function AddressSummary({ address: a }: { address: ShippingAddress | null }) {
  if (!a) return null;
  return (
    <address>
      {a.name}
      <br />
      {a.line1}
      {a.line2 && (
        <>
          <br />
          {a.line2}
        </>
      )}
      <br />
      {a.postalCode} {a.city}
      <br />
      {PROVINCES.find(([code]) => code === a.province)?.[1] ?? a.province},
      Espana
    </address>
  );
}
