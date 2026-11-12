import { escapeEmailHtml, renderCorporateEmail } from "./corporate-email";
import { safeInternalPath } from "./redirects";
export const AUTH_REAUTHENTICATION_SUBJECT =
  "Código para verificar tu identidad";

export type AuthMailPlan = {
  slot: "primary" | "current" | "new";
  to: string;
  action: string;
  subject: string;
  html: string;
  text: string;
};

type RecordValue = Record<string, unknown>;
type Slot = AuthMailPlan["slot"];
const fail = (): never => {
  throw Error("AUTH_MAIL_PAYLOAD_INVALID");
};
const object = (value: unknown): RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : fail();
const string = (value: unknown) => (typeof value === "string" ? value : "");
const actions = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "reauthentication",
  "password_changed_notification",
  "email_changed_notification",
  "phone_changed_notification",
  "identity_linked_notification",
  "identity_unlinked_notification",
  "mfa_factor_enrolled_notification",
  "mfa_factor_unenrolled_notification",
]);

function recipient(value: unknown) {
  const email = string(value);
  if (
    email.length > 254 ||
    !/^[^\s@<>,;:"\\]+@[^\s@<>,;:"\\]+\.[^\s@<>,;:"\\]+$/.test(email)
  )
    return fail();
  return email.toLowerCase();
}

function siteOrigin(siteUrl: string) {
  let url: URL;
  try {
    url = new URL(siteUrl);
  } catch {
    throw Error("AUTH_MAIL_SITE_INVALID");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^\d+(?:\.\d+){3}$/.test(host) ||
    host.startsWith("[")
  ) {
    throw Error("AUTH_MAIL_SITE_INVALID");
  }
  return url.origin;
}

function nextPath(data: RecordValue, origin: string, fallback: string) {
  const redirect = data.redirect_to;
  if (redirect === undefined || redirect === "") return fallback;
  if (typeof redirect !== "string") return fail();
  let url: URL;
  try {
    url = new URL(redirect);
  } catch {
    return fail();
  }
  if (url.origin !== origin || url.username || url.password) return fail();
  const input = ["/api/auth/callback", "/auth/confirmar"].includes(url.pathname)
    ? url.searchParams.get("next")
    : `${url.pathname}${url.search}${url.hash}`;
  const next = safeInternalPath(input, fallback);
  // Avoid redirecting an already consumed token back into a confirmation route.
  return next.startsWith("/api/auth/") ||
    next.split(/[?#]/)[0] === "/auth/confirmar"
    ? fallback
    : next;
}

function tokenHash(value: unknown) {
  const hash = string(value);
  // Opaque bearer value: preserve provider prefixes such as pkce_.
  if (!hash || hash.length > 512 || /\s|[\u0000-\u001f\u007f]/.test(hash))
    return fail();
  return hash;
}

function otp(value: unknown) {
  const token = string(value);
  // The configured OTP length is not fixed to six digits.
  if (!/^\d{4,32}$/.test(token)) return fail();
  return token;
}

/** Pure content planning. The caller authenticates the hook and owns transport,
 * durable idempotency, sender, project isolation and provider receipts. */
export function authMailPlans(
  payload: unknown,
  options: { siteUrl: string },
): AuthMailPlan[] {
  const event = object(payload),
    user = object(event.user),
    data = object(event.email_data);
  const action = string(data.email_action_type);
  if (!actions.has(action)) throw Error("AUTH_MAIL_ACTION_UNSUPPORTED");
  const origin = siteOrigin(options.siteUrl);
  // email_data.site_url and user metadata never choose the application host.
  const fallback = ["recovery", "invite"].includes(action)
    ? "/cuenta/contrasena"
    : "/cuenta";
  const next = nextPath(data, origin, fallback);
  const plans: AuthMailPlan[] = [];
  const add = (
    slot: Slot,
    to: string,
    subject: string,
    paragraphs: string[],
    link?: { hash: unknown; type: string; label: string },
  ) => {
    let html = paragraphs
      .map((paragraph) => `<p>${escapeEmailHtml(paragraph)}</p>`)
      .join("");
    const text = [...paragraphs];
    if (link) {
      const url = new URL("/auth/confirmar", origin);
      url.searchParams.set("token_hash", tokenHash(link.hash));
      url.searchParams.set("type", link.type);
      url.searchParams.set("next", next);
      html += `<p><a href="${escapeEmailHtml(url.href)}">${escapeEmailHtml(link.label)}</a></p>`;
      text.push(`${link.label}: ${url.href}`);
    }
    const rendered = renderCorporateEmail({
      subject,
      visualTitle: subject,
      bodyHtml: html,
      bodyText: text.join("\n\n"),
    });
    plans.push({ slot, to, action, subject, ...rendered });
  };

  if (action === "email_change") {
    const newAddress = recipient(user.new_email);
    const hash = tokenHash(data.token_hash);
    if (string(data.token_hash_new)) {
      const currentAddress = recipient(user.email);
      if (currentAddress === newAddress) return fail();
      otp(data.token);
      otp(data.token_new);
      // Supabase's historical field naming is intentionally reversed:
      // token_hash_new belongs to current email; token_hash to the new email.
      add(
        "current",
        currentAddress,
        "Confirma el cambio de tu correo",
        [
          "Se ha solicitado cambiar el correo de tu cuenta de Imperio Español.",
          "Confirma la solicitud desde esta dirección y desde la nueva. El cambio solo se completa al confirmar ambas.",
          "Si no lo has solicitado, no confirmes el cambio y contacta con nuestro equipo.",
        ],
        {
          hash: data.token_hash_new,
          type: "email_change",
          label: "Confirmar desde mi correo actual",
        },
      );
    }
    otp(string(data.token_new) || data.token);
    add(
      "new",
      newAddress,
      "Confirma tu nueva dirección de correo",
      [
        "Se ha solicitado utilizar esta dirección en tu cuenta de Imperio Español.",
        string(data.token_hash_new)
          ? "Confirma también el enlace enviado al correo actual para completar el cambio."
          : "Confirma que esta dirección es tuya para completar el cambio.",
        "Si no lo has solicitado, puedes ignorar este mensaje.",
      ],
      { hash, type: "email_change", label: "Confirmar mi nueva dirección" },
    );
    return plans;
  }

  // Email-changed security notices protect the previous address, not only the
  // already updated account email.
  const to = recipient(
    action === "email_changed_notification" ? data.old_email : user.email,
  );
  if (action === "reauthentication") {
    add("primary", to, AUTH_REAUTHENTICATION_SUBJECT, [
      "Utiliza este código en la página donde has solicitado verificar tu identidad:",
      otp(data.token),
      "No compartas este código. Si no has solicitado esta operación, ignora el mensaje y revisa la seguridad de tu cuenta.",
    ]);
    return plans;
  }
  const verification: Record<
    string,
    { subject: string; paragraphs: string[]; label: string }
  > = {
    signup: {
      subject: "Confirma tu correo",
      paragraphs: [
        "Confirma tu dirección para terminar de crear tu cuenta de Imperio Español.",
        "Si no has solicitado esta cuenta, puedes ignorar este mensaje.",
      ],
      label: "Confirmar correo y acceder",
    },
    invite: {
      subject: "Tu invitación a Imperio Español",
      paragraphs: [
        "Has recibido una invitación para acceder a Imperio Español.",
        "Acepta la invitación y define la contraseña de tu cuenta. Si no reconoces esta invitación, puedes ignorarla.",
      ],
      label: "Aceptar invitación",
    },
    magiclink: {
      subject: "Tu enlace para acceder a Imperio Español",
      paragraphs: [
        "Has solicitado un enlace de acceso a tu cuenta.",
        "Confirma el acceso desde el siguiente enlace. Si no lo has solicitado, puedes ignorar este mensaje.",
      ],
      label: "Acceder a mi cuenta",
    },
    recovery: {
      subject: "Define tu contraseña",
      paragraphs: [
        "Has solicitado definir o recuperar la contraseña de tu cuenta de Imperio Español.",
        "Tu contraseña no se modifica hasta que completes el proceso. Si no has solicitado este cambio, ignora el mensaje.",
      ],
      label: "Continuar y definir contraseña",
    },
  };
  const confirmation = verification[action];
  if (confirmation) {
    add("primary", to, confirmation.subject, confirmation.paragraphs, {
      hash: data.token_hash,
      type: action,
      label: confirmation.label,
    });
    return plans;
  }

  const notifications: Record<
    string,
    { subject: string; description: string }
  > = {
    password_changed_notification: {
      subject: "Se ha cambiado tu contraseña",
      description:
        "Se ha cambiado la contraseña de tu cuenta de Imperio Español.",
    },
    email_changed_notification: {
      subject: "Se ha cambiado el correo de tu cuenta",
      description:
        "Se ha completado un cambio de la dirección de correo asociada a tu cuenta de Imperio Español.",
    },
    phone_changed_notification: {
      subject: "Se ha cambiado el teléfono de tu cuenta",
      description:
        "Se ha cambiado el número de teléfono asociado a tu cuenta de Imperio Español.",
    },
    identity_linked_notification: {
      subject: "Nuevo método de acceso vinculado",
      description:
        "Se ha vinculado un método de acceso a tu cuenta de Imperio Español.",
    },
    identity_unlinked_notification: {
      subject: "Método de acceso desvinculado",
      description:
        "Se ha desvinculado un método de acceso de tu cuenta de Imperio Español.",
    },
    mfa_factor_enrolled_notification: {
      subject: "Nuevo método de verificación añadido",
      description:
        "Se ha añadido un método de verificación a tu cuenta de Imperio Español.",
    },
    mfa_factor_unenrolled_notification: {
      subject: "Método de verificación eliminado",
      description:
        "Se ha eliminado un método de verificación de tu cuenta de Imperio Español.",
    },
  };
  // Current Supabase payloads omit the pre-promotion recipient of an unlinked
  // identity. Deliver to the signed user.email only; do not infer removed email
  // addresses from metadata or claim coverage of the omitted original address.
  const notification = notifications[action];
  add("primary", to, notification.subject, [
    notification.description,
    "Si no reconoces esta operación, revisa la seguridad de tu cuenta y contacta con contacto@imperioes.com.",
    "Este mensaje es un aviso de seguridad y no requiere confirmar ningún enlace.",
  ]);
  return plans;
}
