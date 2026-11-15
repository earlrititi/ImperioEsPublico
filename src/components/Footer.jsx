import { SITE } from "../config/site";
import { LEGAL_LINKS } from "../config/legal";
import { withBase } from "../utils/basePath";

const SOCIAL_LINKS = [
  {
    className: "image-footer__hotspot--instagram",
    href: "https://www.instagram.com/imperio_e/",
    label: "Instagram",
    iconClassName: "image-footer__social-mark--instagram",
    x: 1479,
    y: 80,
    width: 45,
    height: 45,
    iconPath:
      "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    className: "image-footer__hotspot--facebook",
    href: "https://www.facebook.com/ElMayorImperioDeTodos/",
    label: "Facebook",
    iconClassName: "image-footer__social-mark--facebook",
    x: 1548,
    y: 79,
    width: 47,
    height: 46,
    iconPath:
      "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  {
    className: "image-footer__hotspot--x",
    href: "https://x.com/Imperio_e",
    label: "X",
    iconClassName: "image-footer__social-mark--x",
    x: 1615,
    y: 81,
    width: 49,
    height: 44,
    iconPath:
      "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z",
  },
];

const FOOTER_LEGAL_HREFS = new Set([
  "/legal/aviso-legal",
  "/legal/privacidad",
  "/legal/cookies",
  "/legal/terminos",
]);

const FOOTER_LEGAL_LINKS = LEGAL_LINKS.filter((link) =>
  FOOTER_LEGAL_HREFS.has(link.href)
).map((link) =>
  link.href === "/legal/terminos"
    ? { ...link, label: "Condiciones de contrataci\u00f3n" }
    : link
);

const FOOTER_META = {
  privacy: "Pol\u00edtica de privacidad",
  cookiePreferences: "Preferencias de cookies",
  copyright: `\u00a9 ${new Date().getFullYear()} Imperio Espa\u00f1ol.`,
  creator: "Web creada por Levante Digital",
};

import BrandLogo from './BrandLogo';

export default function Footer({ variant = "light" }) {
  const isDark = variant === "dark";
  return (
    <>
      <section class="footer-newsletter" aria-labelledby="footer-newsletter-heading">
        <div><h2 id="footer-newsletter-heading">La historia continúa en tu correo</h2><p>Historias, novedades y lanzamientos. Recibe gratis 7 historias del Siglo de Oro en PDF.</p></div>
        <a href="/newsletter" data-funnel-newsletter>Recibir el PDF y la newsletter</a>
      </section>
      <footer class={`image-footer image-footer--${variant}`} aria-label="Pie de página" data-home-mark-surface={isDark ? "black" : "white"}>
        <div class="image-footer__corporate">
          <a class="image-footer__brand" href={withBase("/")} aria-label="Imperio Español: inicio">
            <BrandLogo variant={isDark ? "dark" : "principal"} width={180} loading="lazy" />
          </a>
          <div class="image-footer__contact">
            <h2>Contacto</h2>
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
          </div>
          <div class="image-footer__social">
            <h2>¡Síguenos!</h2>
            <nav aria-label="Redes sociales">
              {SOCIAL_LINKS.map((link) => (
                <a href={link.href} rel="noopener noreferrer" aria-label={link.label} key={link.label}>
                  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d={link.iconPath} /></svg>
                  <span>{link.label}</span>
                </a>
              ))}
            </nav>
          </div>
        </div>
        <nav class="image-footer__legal" aria-label="Información legal">
          {FOOTER_LEGAL_LINKS.map((link) => <a href={withBase(link.href)} key={link.href}>{link.label}</a>)}
        </nav>
        <div class="image-footer__meta">
          <div class="image-footer__cookie-control">
            <label class="image-footer__cookie-label">
              <input type="checkbox" role="switch" data-cookie-consent-switch aria-label="Permitir analítica" />
              <span>Permitir analítica</span>
            </label>
            <a href={withBase("/legal/cookies")} data-cookie-settings-trigger>{FOOTER_META.cookiePreferences}</a>
          </div>
          <span>{FOOTER_META.copyright}</span>
          <a class="image-footer__creator" href="https://bylevantedigital.com" rel="noopener noreferrer">{FOOTER_META.creator}</a>
        </div>
      </footer>
      <style>{`
        .footer-newsletter{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:36px max(24px,calc((100% - 1280px)/2));background:#1c1b1a;color:#fff}
        .footer-newsletter h2{font:700 24px/1.3 Georgia,serif;margin:0 0 8px;letter-spacing:0}
        .footer-newsletter p{color:inherit;font-size:15px;line-height:1.6;margin:0;max-width:660px}
        .footer-newsletter a{flex-shrink:0;color:#fff;background:#ffffff14;border:1px solid #ffffff70;border-radius:6px;padding:14px 20px;font-size:15px;font-weight:700;text-align:center;text-decoration:none}
        .footer-newsletter a:hover{background:#ffffff28}
        .image-footer{--footer-ink:#24211e;--footer-line:#24211e30;background:#fff;color:var(--footer-ink);padding:32px max(24px,calc((100% - 1280px)/2)) 24px;font:400 15px/1.6 var(--font-body,Arial,sans-serif)}
        .image-footer--dark{--footer-ink:#f7f4ee;--footer-line:#f7f4ee38;background:var(--color-black-papers,#151515)}
        .image-footer__corporate{display:grid;grid-template-columns:220px minmax(0,1fr) minmax(0,1fr);align-items:center;gap:40px;padding-bottom:28px}
        .image-footer__brand{display:block;width:180px;max-width:100%;line-height:0}
        .image-footer__brand img{display:block;width:100%;height:auto}
        .image-footer h2{color:inherit;font:700 20px/1.3 Georgia,serif;letter-spacing:0;margin:0 0 12px}
        .image-footer a{color:inherit;text-underline-offset:4px;overflow-wrap:anywhere}
        .image-footer a:hover{text-decoration:underline}
        .image-footer a:focus-visible,.footer-newsletter a:focus-visible{outline:2px solid currentColor;outline-offset:4px}
        .image-footer__contact>a{display:inline-flex;align-items:center;min-height:44px}
        .image-footer__social nav{display:flex;gap:8px 16px;flex-wrap:wrap}
        .image-footer__social a{display:inline-flex;gap:8px;align-items:center;min-height:44px;text-decoration:none}
        .image-footer__social svg{flex-shrink:0;fill:currentColor}
        .image-footer__legal{display:flex;gap:8px 24px;flex-wrap:wrap;border-top:1px solid var(--footer-line);padding-top:20px}
        .image-footer__legal a{display:inline-flex;align-items:center;min-height:44px}
        .image-footer__meta{display:flex;align-items:center;justify-content:space-between;gap:12px 24px;flex-wrap:wrap;margin-top:16px;padding-top:20px;border-top:1px solid var(--footer-line);font-size:13px}
        .image-footer__cookie-control{display:flex;gap:8px 20px;align-items:center;flex-wrap:wrap}
        .image-footer__cookie-label{display:inline-flex;gap:10px;align-items:center;cursor:pointer;min-height:44px}
        .image-footer__cookie-label input{appearance:auto;accent-color:#b72937;width:20px;height:20px;margin:0;cursor:pointer}
        .image-footer__cookie-label input:focus-visible{outline:2px solid currentColor;outline-offset:4px}
        @media(max-width:760px){.footer-newsletter{flex-direction:column;align-items:stretch}.footer-newsletter a{white-space:normal;overflow-wrap:anywhere}.image-footer__corporate{grid-template-columns:1fr 1fr;gap:24px}.image-footer__brand{grid-column:1/-1;width:152px}.image-footer__meta{align-items:flex-start;flex-direction:column}}
        @media(max-width:420px){.image-footer__corporate{grid-template-columns:1fr}.image-footer__social nav{gap:8px 20px}.image-footer__social a{flex-basis:auto}.image-footer__legal{gap:4px 20px}}
      `}</style>
    </>
  );
}
