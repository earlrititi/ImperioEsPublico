import test from "node:test";
import assert from "node:assert/strict";
import { parseDocument, DomUtils } from "htmlparser2";
import { renderCorporateEmail } from "../src/lib/corporate-email";
import { messagePreview } from "../src/lib/corporate-mail-preview";
import { inertMessage } from "../src/lib/communications-model";
import { AUTH_REAUTHENTICATION_SUBJECT } from "../src/lib/auth-mail-catalog";

const assetBase = "/images/email/pergamino-v1/";
const trusted = [
  "cabecera-v2.png",
  "titulo.jpg",
  "extension-v2.png",
  "firma-nao-v2.jpg",
].map((name) => `${assetBase}${name}`);
const fixture = () =>
  renderCorporateEmail({
    subject: "Carta original",
    visualTitle: "Título original",
    bodyHtml:
      '<p>Contenido original.</p><p><a href="https://imperioes.com/reservas/gestionar#signed-fixture-token">Gestionar</a></p><p><a href="https://imperioes.com/tienda?utm_source=fixture">Tienda</a></p>',
  });

test("corporate preview keeps the original layout and only fixed brand assets; incoming CSS, pixels and signed links stay inert", () => {
  const source = fixture();
  const injected = source.html
    .replace("<body ", "<body ")
    .replace(
      "<p>Contenido original.</p>",
      '<style>@import url(https://tracker.example.invalid/style);body{display:none}</style><p style="position:fixed;background-image:url(https://tracker.example.invalid/bg)">Contenido original.</p><img src="https://tracker.example.invalid/pixel" width="1" height="1"><img src="https://imperioes.com/images/email/pergamino-v1/cabecera-v2.png?reader=private"><script>bad()</script>',
    );
  const preview = messagePreview(injected, source.text, "Carta original");
  assert.equal(preview.corporate, true);
  assert.match(
    DomUtils.textContent(parseDocument(preview.html)),
    /Título original/,
  );
  assert.match(preview.html, /Contenido original/);
  assert.doesNotMatch(
    preview.html,
    /tracker\.example|reader=private|signed-fixture-token|<script|position:fixed|@import|\bhref=/,
  );
  const nodes = DomUtils.findAll(
    (node) => node.type === "tag",
    parseDocument(preview.html).children,
  );
  const resources = nodes.flatMap((node) =>
    [node.attribs.src, node.attribs.background].filter(Boolean),
  );
  assert.ok(resources.length >= 4);
  assert.ok(resources.every((path) => trusted.includes(path)));
  assert.equal(
    resources.filter((path) => path === `${assetBase}cabecera-v2.png`).length,
    1,
  );
  assert.ok(
    nodes.some(
      (node) =>
        node.attribs.class === "imperio-message" &&
        node.attribs.style.includes(
          `background-image:url('${assetBase}extension-v2.png')`,
        ),
    ),
  );
  assert.match(preview.html, /max-width:600px/);
  assert.match(preview.html, /@media only screen and \(max-width:600px\)/);
  assert.deepEqual(
    preview.links.filter((link) => link.includes("tienda")),
    ["https://imperioes.com/tienda"],
  );
  assert.ok(preview.links.every((link) => !link.includes("gestionar")));
});

test("a saved corporate preview can be read again without losing its marker, assets or duplicating the header", () => {
  const source = fixture(),
    saved = messagePreview(source.html, source.text, "Carta original");
  const reopened = messagePreview(saved.html, saved.text, "Carta original");
  assert.equal(reopened.corporate, true);
  assert.match(reopened.html, /data-imperio-email-layout="pergamino-v1"/);
  assert.equal(
    reopened.html.match(
      /src="\/images\/email\/pergamino-v1\/cabecera-v2\.png"/g,
    )?.length,
    1,
  );
  assert.equal(
    reopened.html.match(
      /src="\/images\/email\/pergamino-v1\/firma-nao-v2\.jpg"/g,
    )?.length,
    1,
  );
  assert.match(
    DomUtils.textContent(parseDocument(reopened.html)),
    /Título original/,
  );
  assert.match(reopened.html, /Contenido original/);
});

test("external mail keeps the legacy inert view, while corporate visible secrets and known authentication codes are omitted", () => {
  const external =
    '<p>Mensaje externo</p><img src="https://imperioes.com/images/email/pergamino-v1/cabecera-v2.png">';
  assert.deepEqual(
    messagePreview(external, "Mensaje externo"),
    inertMessage(external, "Mensaje externo"),
  );
  const source = fixture();
  const protectedBody = source.html.replace(
    "Contenido original.",
    "token=<b>split-secret-</b><em>fixture</em>",
  );
  const preview = messagePreview(
    protectedBody,
    "Texto de consulta",
    "Carta original",
  );
  assert.doesNotMatch(preview.html, /split-secret-|fixture<\/em>/);
  assert.match(preview.html, /omitido/);
  assert.match(
    preview.html,
    /src="\/images\/email\/pergamino-v1\/cabecera-v2.png"/,
  );
  const otp = renderCorporateEmail({
    subject: AUTH_REAUTHENTICATION_SUBJECT,
    bodyText: "Tu código: 58372094",
  });
  const protectedCode = messagePreview(
    otp.html,
    otp.text,
    AUTH_REAUTHENTICATION_SUBJECT,
  );
  assert.doesNotMatch(protectedCode.html + protectedCode.text, /58372094/);
  assert.match(protectedCode.text, /Código de acceso omitido/);
});
