import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { APIContext } from "astro";
import { getRequiredEnv } from "./env";
import { createSupabaseServerClient } from "./supabase/server";
import { isAllowedRequestOrigin } from "./request-security";
import { consumeRateLimit } from "./rate-limit";
import { UUID } from "./reservation-validation";

export const optionalEnv = (name: string) => {
  try {
    return getRequiredEnv(name);
  } catch {
    return "";
  }
};
export const reservationMode = () =>
  optionalEnv("RESERVATION_MODE") !== "false";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const sign = (value: string) =>
  createHmac("sha256", getRequiredEnv("RESERVATION_TOKEN_SECRET"))
    .update(value)
    .digest("hex");
export const reservationToken = (requestId: string) =>
  sign(`reservation:${requestId}`);
export const managementLink = (r: { id: string; request_id: string }) =>
  `${getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/, "")}/reservas/gestionar#${r.id}.${reservationToken(r.request_id)}`;
export const safeEqual = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export async function database() {
  return (await import("./supabase/admin")).supabaseAdmin;
}
export async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await (await database()).rpc(name, args);
  if (error)
    throw new Error(
      error.message.match(/^[A-Z_]+$/)?.[0] ?? "DATABASE_UNAVAILABLE",
    );
  return data;
}
export async function requestBody(request: Request) {
  if (!isAllowedRequestOrigin(request, getRequiredEnv("PUBLIC_SITE_URL")))
    throw new Error("ORIGIN_NOT_ALLOWED");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("INVALID_INPUT");
  if (Number(request.headers.get("content-length") ?? 0) > 16384)
    throw new Error("INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16384) {
      await reader.cancel();
      throw new Error("INVALID_INPUT");
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("INVALID_INPUT");
  }
}
export async function limited(request: Request, endpoint: string, limit = 30) {
  if (
    !(await consumeRateLimit({ request, endpoint, limit, windowSeconds: 900 }))
  )
    throw new Error("RATE_LIMITED");
}
export async function getUser(
  context: Pick<APIContext, "cookies" | "request">,
) {
  const { data, error } =
    await createSupabaseServerClient(context).auth.getUser();
  if (error && error.name !== "AuthSessionMissingError")
    throw new Error("AUTH_UNAVAILABLE");
  return data.user;
}
export async function requireAdmin(
  context: Pick<APIContext, "cookies" | "request">,
) {
  const user = await getUser(context);
  if (!user || user.app_metadata?.commerce_admin !== true)
    throw new Error("FORBIDDEN");
  return user;
}
export async function readReservation(id: string) {
  if (!UUID.test(id)) throw new Error("NOT_FOUND");
  const { data, error } = await (
    await database()
  )
    .from("reservations")
    .select(
      "*, reservation_items(*), reservation_payment_attempts(status,shipping_address), commerce_orders!reservation_order_fk(*,commerce_order_items(*))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("DATABASE_UNAVAILABLE");
  if (!data) throw new Error("NOT_FOUND");
  return data;
}
export async function authorizedReservation(
  context: Pick<APIContext, "cookies" | "request">,
  id: string,
  token?: string,
) {
  const r = await readReservation(id);
  if (
    token &&
    /^[a-f0-9]{64}$/.test(token) &&
    safeEqual(hash(token), r.token_hash)
  )
    return r;
  const user = await getUser(context);
  if (
    user &&
    (r.user_id === user.id || user.app_metadata?.commerce_admin === true)
  )
    return r;
  throw new Error("NOT_FOUND");
}
export function publicReservation(r: any) {
  const {
    token_hash,
    payload_hash,
    request_id,
    reservation_payment_attempts,
    ...rest
  } = r;
  const pending = reservation_payment_attempts?.find(
    (attempt: any) => attempt.status === "OPEN",
  );
  return { ...rest, paymentAddress: pending?.shipping_address ?? null };
}
export const privateJson = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
export function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "UNAVAILABLE";
  const messages: Record<string, string> = {
    MAX_RESERVATION_QUANTITY: "Has superado el maximo de unidades por reserva.",
    RESERVATION_EXPIRED: "El plazo de compra de esta reserva ha terminado.",
    CAMPAIGN_ALREADY_ACTIVE: "La campana ya esta activa; no se modifican sus condiciones retroactivamente.",
    INVALID_EDITION_TOTAL: "El total de edicion no puede ser inferior al stock vendible y promocional registrado.",
    CAMPAIGN_NOT_OPEN: "El periodo todavia no esta abierto.",
    CAMPAIGN_CLOSED: "El periodo de nuevas pre-reservas ha terminado.",
    STOCK_AVAILABLE: "Hay unidades disponibles. Puedes reservar directamente.",
    ALREADY_WAITLISTED: "Ya existe una solicitud en espera para este email y talla.",
    WAITLIST_EMPTY: "No hay solicitudes pendientes para esta talla.",
    PAYMENT_IN_PROGRESS:
      "El pago esta en curso o pendiente de confirmacion. No se liberaran las unidades hasta comprobar su estado.",
    OUT_OF_STOCK:
      "No quedan suficientes unidades de una de las tallas. Revisa la disponibilidad.",
    INVALID_MAINLAND_ADDRESS:
      "Comprueba provincia y codigo postal. Solo enviamos a Espana peninsular.",
    INVALID_INPUT: "Revisa los datos y acepta las condiciones.",
    INVALID_CUSTOMER: "Comprueba nombre y email.",
    INVALID_ADDRESS: "Completa la direccion de entrega y comprueba provincia y codigo postal. Solo enviamos a Espana peninsular.",
    INVALID_QUANTITY: "La cantidad no es valida.",
    INVALID_ITEMS: "Revisa las tallas seleccionadas.",
    NOT_FOUND: "Reserva no disponible o enlace incorrecto.",
    FORBIDDEN: "Acceso no autorizado.",
    RATE_LIMITED: "Demasiadas solicitudes. Intentalo mas tarde.",
    PAYMENT_ADDRESS_LOCKED:
      "Ya existe un pago en curso. Cierra esa sesion antes de cambiar la direccion.",
    INVALID_STATE: "Esta accion no esta disponible en el estado actual.",
    RESERVATION_MODE:
      "Las ventas todavia no estan abiertas. No se ha realizado ningun cobro.",
    ANTI_BOT: "No se pudo verificar la solicitud. Recarga la pagina.",
    IDEMPOTENCY_CONFLICT:
      "Esta solicitud ya se uso con otros datos. Recarga la pagina para iniciar otra.",
    EMAIL_DISABLED: "El envio de correo esta desactivado en este entorno.",
  };
  const status =
    code === "NOT_FOUND"
      ? 404
      : ["FORBIDDEN", "ORIGIN_NOT_ALLOWED", "ANTI_BOT"].includes(code)
        ? 403
        : code === "RATE_LIMITED"
          ? 429
          : messages[code]
            ? 409
            : 503;
  return privateJson(
    {
      error:
        messages[code] ??
        "Servicio temporalmente no disponible. No se ha confirmado la operacion.",
      code: messages[code] ? code : "UNAVAILABLE",
    },
    status,
  );
}
export function newChallenge() {
  const payload = `${crypto.randomUUID()}.${Date.now()}.${randomBytes(8).toString("hex")}`;
  return `${payload}.${sign(`challenge:${payload}`)}`;
}
export function verifyChallenge(
  challenge: unknown,
  nonce: unknown,
  requestId: string,
) {
  if (
    typeof challenge !== "string" ||
    typeof nonce !== "string" ||
    nonce.length > 12
  )
    return false;
  const parts = challenge.split(".");
  if (
    parts.length !== 4 ||
    parts[0] !== requestId ||
    Date.now() - Number(parts[1]) < 1000 ||
    Date.now() - Number(parts[1]) > 3600000
  )
    return false;
  return (
    safeEqual(sign(`challenge:${parts.slice(0, 3).join(".")}`), parts[3]) &&
    hash(`${challenge}:${nonce}`).startsWith("000")
  );
}
