import test from "node:test";
import assert from "node:assert/strict";
import { authMailPlans } from "../src/lib/auth-mail-catalog";

const options = { siteUrl: "https://imperio.example.invalid" };
const event = (action: string, changes: Record<string, unknown> = {}) => ({
  user: {
    id: "00000000-0000-4000-8000-000000000011",
    email: "owner@example.invalid",
    new_email: "new@example.invalid",
  },
  email_data: {
    email_action_type: action,
    token_hash: "pkce_fixture-bearer-hash",
    token: "12345678",
    ...changes,
  },
});
function actionLink(html: string) {
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(
    (match) => new URL(match[1].replaceAll("&amp;", "&"), options.siteUrl),
  );
  const link = links.find((url) => url.pathname === "/auth/confirmar");
  assert.ok(link, "The email must include its confirmation link");
  return link;
}

test("The four link actions use the corporate renderer and retain their exact OTP purpose", () => {
  for (const action of ["signup", "invite", "magiclink", "recovery"]) {
    const [plan] = authMailPlans(event(action), options);
    assert.equal(plan.to, "owner@example.invalid");
    assert.equal(plan.slot, "primary");
    assert.equal(plan.action, action);
    assert.ok(plan.subject.trim());
    assert.match(plan.html, /data-imperio-email-layout="pergamino-v1"/);
    assert.match(plan.html, /cabecera-v2\.png/);
    const url = actionLink(plan.html);
    assert.equal(url.origin, options.siteUrl);
    assert.equal(url.searchParams.get("type"), action);
    assert.equal(
      url.searchParams.get("token_hash"),
      "pkce_fixture-bearer-hash",
    );
    assert.equal(
      url.searchParams.get("next"),
      ["invite", "recovery"].includes(action)
        ? "/cuenta/contrasena"
        : "/cuenta",
    );
    assert.ok(plan.text.includes(url.href));
  }
});

test("Secure email change sends the counterintuitive hash pairs to the correct two addresses", () => {
  const plans = authMailPlans(
    event("email_change", {
      token: "11112222",
      token_new: "33334444",
      token_hash: "hash-for-new",
      token_hash_new: "hash-for-current",
    }),
    options,
  );
  assert.equal(plans.length, 2);
  assert.deepEqual(
    plans.map(({ slot, to }) => ({ slot, to })),
    [
      { slot: "current", to: "owner@example.invalid" },
      { slot: "new", to: "new@example.invalid" },
    ],
  );
  assert.equal(
    actionLink(plans[0].html).searchParams.get("token_hash"),
    "hash-for-current",
  );
  assert.equal(
    actionLink(plans[1].html).searchParams.get("token_hash"),
    "hash-for-new",
  );
  for (const plan of plans)
    assert.equal(
      actionLink(plan.html).searchParams.get("type"),
      "email_change",
    );
  assert.doesNotMatch(
    plans.map((plan) => plan.text).join("\n"),
    /11112222|33334444/,
  );
});

test("Single email change supports either OTP field and an anonymous account without an old email", () => {
  for (const fields of [
    { token: "123456" },
    { token: "", token_new: "1234567890" },
  ]) {
    const payload = event("email_change", fields);
    payload.user.email = "";
    const plans = authMailPlans(payload, options);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].slot, "new");
    assert.equal(plans[0].to, "new@example.invalid");
    assert.equal(
      actionLink(plans[0].html).searchParams.get("token_hash"),
      "pkce_fixture-bearer-hash",
    );
  }
});

test("Incomplete or ambiguous email changes fail before returning a partial plan", () => {
  for (const fields of [
    { token_hash: "" },
    { token: "", token_new: "" },
    { token_hash_new: "hash-current", token_new: "" },
    { token_hash_new: "hash-current", token: "", token_new: "12345678" },
  ])
    assert.throws(
      () => authMailPlans(event("email_change", fields), options),
      /AUTH_MAIL_PAYLOAD_INVALID/,
    );
  const same = event("email_change", {
    token_hash_new: "hash-current",
    token_new: "12345678",
  });
  same.user.new_email = same.user.email;
  assert.throws(
    () => authMailPlans(same, options),
    /AUTH_MAIL_PAYLOAD_INVALID/,
  );
});

test("Reauthentication shows a configurable-length nonce and never turns it into a confirmation link", () => {
  for (const code of ["123456", "12345678", "1234567890"]) {
    const [plan] = authMailPlans(
      event("reauthentication", { token: code, token_hash: "" }),
      options,
    );
    assert.match(plan.text, new RegExp(code));
    assert.doesNotMatch(plan.html, /\/auth\/confirmar/);
    assert.doesNotMatch(plan.text, /token_hash=/);
  }
  for (const token of ["", "123", "1234<script>", "123456\n", "1".repeat(33)]) {
    assert.throws(
      () => authMailPlans(event("reauthentication", { token }), options),
      /AUTH_MAIL_PAYLOAD_INVALID/,
    );
  }
});

test("All seven security notifications require no OTP and preserve the previous email recipient", () => {
  const actions = [
    "password_changed_notification",
    "email_changed_notification",
    "phone_changed_notification",
    "identity_linked_notification",
    "identity_unlinked_notification",
    "mfa_factor_enrolled_notification",
    "mfa_factor_unenrolled_notification",
  ];
  for (const action of actions) {
    const [plan] = authMailPlans(
      event(action, {
        token: "",
        token_hash: "",
        old_email: "previous@example.invalid",
      }),
      options,
    );
    assert.equal(
      plan.to,
      action === "email_changed_notification"
        ? "previous@example.invalid"
        : "owner@example.invalid",
    );
    assert.equal(plan.action, action);
    assert.doesNotMatch(plan.html, /\/auth\/confirmar/);
    assert.doesNotMatch(plan.text, /token_hash=/);
  }
  assert.throws(
    () => authMailPlans(event("email_changed_notification"), options),
    /AUTH_MAIL_PAYLOAD_INVALID/,
  );
});

test("The unlinked-identity notice uses the signed current address and never guesses a removed identity from metadata", () => {
  const payload = {
    ...event("identity_unlinked_notification"),
    metadata: { email: "unverified@example.invalid" },
  };
  const [plan] = authMailPlans(payload, options);
  assert.equal(plan.to, "owner@example.invalid");
  assert.doesNotMatch(plan.text, /unverified@example/);
});

test("The configured HTTPS origin owns links; callback next is retained only as a safe internal path", () => {
  const [plan] = authMailPlans(
    event("magiclink", {
      redirect_to: `${options.siteUrl}/api/auth/callback?next=%2Fcuenta%3Ftab%3Dreservas`,
      site_url: "https://attacker.invalid",
    }),
    options,
  );
  assert.equal(
    actionLink(plan.html).searchParams.get("next"),
    "/cuenta?tab=reservas",
  );
  assert.equal(actionLink(plan.html).origin, options.siteUrl);
  for (const unsafe of [
    "https://attacker.invalid/",
    "//attacker.invalid",
    "\\attacker.invalid",
    "/api/auth/logout",
    "/auth/confirmar",
  ]) {
    const [fallback] = authMailPlans(
      event("magiclink", {
        redirect_to: `${options.siteUrl}/api/auth/callback?next=${encodeURIComponent(unsafe)}`,
      }),
      options,
    );
    assert.equal(actionLink(fallback.html).searchParams.get("next"), "/cuenta");
  }
});

test("Reject foreign redirects, credentials, loopback, non-HTTPS and configured site paths", () => {
  for (const redirect_to of [
    "https://attacker.invalid/",
    "http://imperio.example.invalid/",
    "https://a:b@imperio.example.invalid/",
    "//imperio.example.invalid/cuente",
    "javascript:alert(1)",
  ]) {
    assert.throws(
      () => authMailPlans(event("signup", { redirect_to }), options),
      /AUTH_MAIL_PAYLOAD_INVALID/,
    );
  }
  for (const siteUrl of [
    "http://example.invalid",
    "https://localhost",
    "https://127.0.0.1",
    "https://127.1",
    "https://[::1]",
    "https://[::ffff:127.0.0.1]",
    "https://app.localhost",
    "https://a:b@example.invalid",
    "https://example.invalid/path",
    "https://example.invalid/?x=1",
    "https://example.invalid/#hash",
  ]) {
    assert.throws(
      () => authMailPlans(event("signup"), { siteUrl }),
      /AUTH_MAIL_SITE_INVALID/,
    );
  }
});

test("Malformed recipients, missing bearer values and unknown hook actions fail closed", () => {
  for (const email of [
    "",
    "a@example.invalid\nbcc:x@example.invalid",
    "a@example.invalid,b@example.invalid",
    "<a@example.invalid>",
    "not-email",
  ]) {
    const payload = event("signup");
    payload.user.email = email;
    assert.throws(
      () => authMailPlans(payload, options),
      /AUTH_MAIL_PAYLOAD_INVALID/,
    );
  }
  for (const token_hash of ["", null, 42, "hash\nmore"])
    assert.throws(
      () => authMailPlans(event("signup", { token_hash }), options),
      /AUTH_MAIL_PAYLOAD_INVALID/,
    );
  for (const payload of [null, [], {}, { user: {}, email_data: [] }])
    assert.throws(
      () => authMailPlans(payload, options),
      /AUTH_MAIL_PAYLOAD_INVALID/,
    );
  for (const action of [
    "",
    "confirmation",
    "magic_link",
    "reauth",
    "email_change_current",
    "email_change_new",
    "future_action",
  ]) {
    assert.throws(
      () => authMailPlans(event(action), options),
      /AUTH_MAIL_ACTION_UNSUPPORTED/,
    );
  }
});
