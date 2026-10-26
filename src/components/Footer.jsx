import { SITE } from "../config/site";
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

const FOOTER_META = {
  privacy: "Pol\u00edtica de privacidad",
  cookiePreferences: "Preferencias de cookies",
  copyright: `\u00a9 ${new Date().getFullYear()} Imperio Espa\u00f1ol.`,
  creator: "Web creada por Levante Digital",
};

export default function Footer({ variant = "light" }) {
  const isDark = variant === "dark";

  return (
    <>
    <section class="footer-newsletter" aria-labelledby="footer-newsletter-heading">
      <div><h2 id="footer-newsletter-heading">La historia continúa en tu correo</h2><p>Historias, novedades y lanzamientos. Recibe gratis 7 historias del Siglo de Oro en PDF.</p></div>
      <a href="/newsletter" data-funnel-newsletter>Recibir el PDF y la newsletter</a>
    </section>
    <footer class={`image-footer image-footer--${variant}`} aria-label="Pie de pagina">
      <div class="image-footer__frame">
        <picture class="image-footer__art-wrap">
          <source
            type="image/avif"
            srcSet={
              isDark
                ? "/images/dark-footer-interactive.avif"
                : "/images/imperio-espanol-footer-interactive.avif"
            }
          />
          <img
            class="image-footer__art"
            src={
              isDark
                ? "/images/dark-footer-interactive.webp"
                : "/images/imperio-espanol-footer-interactive.webp"
            }
            alt="Imperio Espanol. Mapa historico, contacto y redes sociales."
            width="1920"
            height="1080"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
          />
        </picture>

        <svg
          class="image-footer__labels"
          viewBox="0 0 1920 660"
          preserveAspectRatio="none"
          role="group"
          aria-label="Enlaces destacados del pie de pagina"
        >
          <a
            class="image-footer__label-link"
            href={`mailto:${SITE.contactEmail}`}
            aria-label="Contacto"
          >
            <text class="image-footer__label-text" x="1127" y="60">
              Contacto
            </text>
          </a>

          <a
            class="image-footer__label-link"
            href="https://www.instagram.com/imperio_e/"
            target="_self"
            rel="noopener noreferrer"
            aria-label="Siguenos en redes sociales"
          >
            <text class="image-footer__label-text image-footer__label-text--social" x="1478" y="64">
              {"\u00a1S\u00edguenos!"}
            </text>
          </a>

          <text class="image-footer__email-mark" x="1128" y="100">
            {SITE.contactEmail}
          </text>

          {SOCIAL_LINKS.map((link) => (
            <svg
              class={`image-footer__social-mark ${link.iconClassName}`}
              x={link.x}
              y={link.y}
              width={link.width}
              height={link.height}
              viewBox="0 0 24 24"
              aria-hidden="true"
              key={`${link.label}-mark`}
            >
              <path d={link.iconPath} />
            </svg>
          ))}
        </svg>

        <nav class="image-footer__links" aria-label="Contacto y redes sociales">
          <a
            class="image-footer__hotspot image-footer__hotspot--email"
            href={`mailto:${SITE.contactEmail}`}
          >
            <span class="image-footer__sr-only">
              Escribir a {SITE.contactEmail}
            </span>
          </a>

          {SOCIAL_LINKS.map((link) => (
            <a
              class={`image-footer__hotspot ${link.className}`}
              href={link.href}
              target="_self"
              rel="noopener noreferrer"
              aria-label={link.label}
              key={link.label}
            />
          ))}
        </nav>

        <div class="image-footer__meta" role="group" aria-label={"Privacidad, cookies y cr\u00e9ditos"}>
          <a href={withBase("/legal/privacidad")}>{FOOTER_META.privacy}</a>
          <span class="image-footer__cookie-preferences">
            <label class="image-footer__cookie-switch image-footer__cookie-switch--meta">
              <span class="image-footer__sr-only">Permitir anal\u00edtica</span>
              <input
                type="checkbox"
                role="switch"
                data-cookie-consent-switch
                aria-label="Permitir anal\u00edtica"
              />
              <span class="image-footer__cookie-switch-track" aria-hidden="true">
                <span class="image-footer__cookie-switch-target">
                  <span class="image-footer__cookie-switch-state-layer">
                    <span class="image-footer__cookie-switch-handle-shape">
                      <span class="image-footer__cookie-switch-handle-container" />
                      <svg
                        class="image-footer__cookie-switch-icon"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <path class="image-footer__cookie-switch-icon--off" d="M4.25 4.25 11.75 11.75M11.75 4.25 4.25 11.75" />
                        <path class="image-footer__cookie-switch-icon--on" d="m3.2 8.2 3.4 3 6.2-6.4" />
                      </svg>
                    </span>
                  </span>
                </span>
              </span>
            </label>
            <a
              class="image-footer__cookie-preferences-link"
              href={withBase("/legal/cookies")}
              data-cookie-settings-trigger
            >
              {FOOTER_META.cookiePreferences}
            </a>
          </span>
          <span>{FOOTER_META.copyright}</span>
          <span class="image-footer__creator">{FOOTER_META.creator}</span>
        </div>
      </div>

      <style>{`
        .footer-newsletter{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:32px max(24px,calc((100% - 1200px)/2));background:#111010;color:#fff;font-family:"Inter","Segoe UI",sans-serif}
        .footer-newsletter h2{font:700 24px/1.3 Georgia,serif;margin:0 0 8px;letter-spacing:0}
        .footer-newsletter p{color:inherit;font-size:15px;line-height:1.6;margin:0;max-width:660px}
        .footer-newsletter a{flex-shrink:0;color:#fff;background:#ffffff14;border:1px solid #ffffff70;border-radius:6px;padding:14px 20px;font-size:15px;font-weight:700;text-align:center;text-decoration:none}
        .footer-newsletter a:hover{background:#ffffff28}.footer-newsletter a:focus-visible{outline:2px solid #fff;outline-offset:4px}
        @media(max-width:760px){.footer-newsletter{flex-direction:column;align-items:stretch}.footer-newsletter a{white-space:normal;overflow-wrap:anywhere}}
        .image-footer {
          position: relative;
          width: 100%;
          overflow: hidden;
          background: #f7f5f1;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 10px);
          mask-image: linear-gradient(to bottom, transparent 0, #000 10px);
        }

        .image-footer--dark {
          margin-top: -10px;
          padding-top: 10px;
          background: var(--color-black-papers);
        }

        .image-footer__cookie-switch {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 32px;
          box-sizing: border-box;
          flex: 0 0 52px;
          cursor: pointer;
        }

        .image-footer__cookie-switch input {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
        }

        .image-footer__cookie-switch-track {
          position: relative;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;
          width: 52px;
          height: 32px;
          box-sizing: border-box;
          padding: 4px;
          overflow: visible;
          border: 1px solid #fff;
          border-radius: 100px;
          background: #e6e0e9;
          box-shadow: none;
          transition: background 180ms ease, border-color 180ms ease;
        }

        .image-footer__cookie-switch-target {
          position: absolute;
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: center;
          box-sizing: border-box;
          width: 48px;
          height: 48px;
          padding: 4px;
          left: -12px;
          top: 50%;
          transform: translate(0, -50%);
          transition: transform 180ms ease;
        }

        .image-footer__cookie-switch-state-layer {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          width: 40px;
          height: 40px;
          box-sizing: border-box;
          padding: 8px;
          gap: 8px;
          border-radius: 100px;
          background: transparent;
          transition: background-color 180ms ease;
        }

        .image-footer__cookie-switch-handle-shape {
          position: relative;
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: center;
          width: 24px;
          height: 24px;
          box-sizing: border-box;
          padding: 11px;
          isolation: isolate;
          border-radius: 24px;
          background: #79747e;
          box-shadow: 0 4px 4px rgb(0 0 0 / 25%);
          flex: 1 1 auto;
          align-self: stretch;
        }

        .image-footer__cookie-switch-handle-container {
          width: 2px;
          height: 2px;
          border-radius: 100px;
          flex: none;
          order: 0;
          z-index: 0;
        }

        .image-footer__cookie-switch-icon {
          position: absolute;
          z-index: 1;
          left: 50%;
          top: 50%;
          width: 16px;
          height: 16px;
          color: #e6e0e9;
          overflow: visible;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .image-footer__cookie-switch-icon path {
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .image-footer__cookie-switch-icon--on {
          display: none;
        }

        .image-footer__cookie-switch input:checked + .image-footer__cookie-switch-track .image-footer__cookie-switch-target {
          transform: translate(28px, -50%);
        }

        .image-footer__cookie-switch input:checked + .image-footer__cookie-switch-track {
          padding: 2px 4px;
          border-width: 0;
          background: radial-gradient(
            50% 50% at 50% 50%,
            rgb(134 21 9 / 64%) 0%,
            rgb(236 38 15 / 72%) 100%
          );
        }

        .image-footer__cookie-switch input:checked + .image-footer__cookie-switch-track .image-footer__cookie-switch-handle-shape {
          background: #fff;
        }

        .image-footer__cookie-switch input:checked + .image-footer__cookie-switch-track .image-footer__cookie-switch-handle-container {
          border-radius: 18px;
        }

        .image-footer__cookie-switch input:checked + .image-footer__cookie-switch-track .image-footer__cookie-switch-icon {
          color: #b3261e;
        }

        .image-footer__cookie-switch input:checked + .image-footer__cookie-switch-track .image-footer__cookie-switch-icon--off {
          display: none;
        }

        .image-footer__cookie-switch input:checked + .image-footer__cookie-switch-track .image-footer__cookie-switch-icon--on {
          display: block;
        }

        .image-footer__cookie-switch:hover .image-footer__cookie-switch-state-layer {
          background: rgb(121 116 126 / 10%);
        }

        .image-footer__cookie-switch:active .image-footer__cookie-switch-state-layer {
          background: rgb(121 116 126 / 16%);
        }

        .image-footer__cookie-switch:hover input:checked + .image-footer__cookie-switch-track .image-footer__cookie-switch-state-layer {
          background: rgb(179 38 30 / 10%);
        }

        .image-footer__cookie-switch:active input:checked + .image-footer__cookie-switch-track .image-footer__cookie-switch-state-layer {
          background: rgb(179 38 30 / 16%);
        }

        .image-footer__cookie-switch input:focus-visible + .image-footer__cookie-switch-track {
          outline: 2px solid #fff;
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .image-footer__cookie-switch-track,
          .image-footer__cookie-switch-target,
          .image-footer__cookie-switch-state-layer { transition: none; }
        }

        .image-footer__frame {
          position: relative;
          width: 100%;
          aspect-ratio: 1920 / 660;
          overflow: hidden;
        }

        .image-footer--dark .image-footer__frame {
          background: var(--color-black-papers);
        }

        .image-footer__art-wrap {
          display: contents;
        }

        .image-footer--dark .image-footer__frame::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 1;
          opacity: 0.42;
          pointer-events: none;
          background-image: var(--imperio-dot-pattern-source);
          background-size: var(--imperio-dot-pattern-size);
        }

        .image-footer__art {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }

        .image-footer--dark .image-footer__art {
          mix-blend-mode: lighten;
        }

        .image-footer__links {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
        }

        .image-footer__labels {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: block;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: visible;
        }

        .image-footer__label-link {
          pointer-events: auto;
          cursor: pointer;
        }

        .image-footer__label-text {
          fill: var(--color-red-accent);
          font-family: "Inter", "Segoe UI", sans-serif;
          font-size: 42px;
          font-weight: 800;
          letter-spacing: 0;
          transform-box: fill-box;
          transform-origin: center;
          transition:
            fill 220ms ease,
            transform 220ms ease;
        }

        .image-footer__label-link:hover .image-footer__label-text,
        .image-footer__label-link:focus-visible .image-footer__label-text {
          fill: #000;
          transform: scale(1.1);
        }

        .image-footer--dark .image-footer__label-link:hover .image-footer__label-text,
        .image-footer--dark .image-footer__label-link:focus-visible .image-footer__label-text {
          fill: #ead7c1;
        }

        .image-footer__label-link:focus-visible {
          outline: none;
        }

        .image-footer__email-mark {
          fill: #000;
          font-family: "Inter", "Segoe UI", sans-serif;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 0;
          pointer-events: none;
          transition: fill 220ms ease;
        }

        .image-footer__social-mark {
          fill: #000;
          pointer-events: none;
          transition: fill 220ms ease;
        }

        .image-footer--dark .image-footer__email-mark,
        .image-footer--dark .image-footer__social-mark {
          fill: #ead7c1;
        }

        .image-footer__frame:has(.image-footer__hotspot--email:hover) .image-footer__email-mark,
        .image-footer__frame:has(.image-footer__hotspot--email:focus-visible) .image-footer__email-mark,
        .image-footer__frame:has(.image-footer__hotspot--instagram:hover) .image-footer__social-mark--instagram,
        .image-footer__frame:has(.image-footer__hotspot--instagram:focus-visible) .image-footer__social-mark--instagram,
        .image-footer__frame:has(.image-footer__hotspot--facebook:hover) .image-footer__social-mark--facebook,
        .image-footer__frame:has(.image-footer__hotspot--facebook:focus-visible) .image-footer__social-mark--facebook,
        .image-footer__frame:has(.image-footer__hotspot--x:hover) .image-footer__social-mark--x,
        .image-footer__frame:has(.image-footer__hotspot--x:focus-visible) .image-footer__social-mark--x {
          fill: var(--color-red-accent);
        }

        .image-footer__hotspot {
          position: absolute;
          display: block;
          border-radius: 4px;
          pointer-events: auto;
        }

        .image-footer__hotspot:focus-visible {
          outline: 3px solid var(--color-red-accent);
          outline-offset: 3px;
          background: rgb(255 255 255 / 18%);
        }

        .image-footer__hotspot--email {
          top: 10.5%;
          left: 58%;
          width: 16%;
          height: 7%;
        }

        .image-footer__hotspot--instagram {
          top: 11.5%;
          left: 76.7%;
          width: 3.1%;
          height: 9%;
        }

        .image-footer__hotspot--facebook {
          top: 11.5%;
          left: 80.4%;
          width: 3.1%;
          height: 9%;
        }

        .image-footer__hotspot--x {
          top: 11.5%;
          left: 84.1%;
          width: 3.2%;
          height: 9%;
        }

        .image-footer__meta {
          --footer-meta-red: #a92317;
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 5;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.7rem 1.25rem;
          min-height: 58px;
          padding: 0.65rem max(1rem, calc((100% - 1200px) / 2));
          border-top: 1px solid rgb(255 255 255 / 70%);
          background: rgb(255 255 255 / 60%);
          box-shadow: 0 -8px 28px rgb(38 14 8 / 12%);
          -webkit-backdrop-filter: blur(10px) saturate(125%);
          backdrop-filter: blur(10px) saturate(125%);
          color: #514a45;
          font-family: "Inter", "Segoe UI", sans-serif;
          font-size: clamp(0.82rem, 1.05vw, 0.96rem);
          line-height: 1.35;
        }

        .image-footer__meta a,
        .image-footer__meta button {
          display: inline-flex;
          align-items: center;
          gap: 0.58rem;
          min-height: 36px;
          margin: 0;
          border: 0;
          padding: 0.25rem 0;
          background: transparent;
          color: #171412;
          cursor: pointer;
          font: inherit;
          text-decoration: none;
        }

        .image-footer__meta .image-footer__cookie-preferences {
          display: inline-flex;
          align-items: center;
          gap: 0.58rem;
          color: var(--footer-meta-red);
          font-weight: 600;
        }

        .image-footer__cookie-switch--meta input:focus-visible + .image-footer__cookie-switch-track {
          outline-color: var(--footer-meta-red);
        }

        .image-footer__meta .image-footer__cookie-preferences-link {
          color: var(--footer-meta-red);
          font-weight: 600;
        }

        .image-footer__creator {
          color: var(--footer-meta-red);
          font-weight: 650;
        }

        .image-footer__meta a:hover,
        .image-footer__meta button:hover,
        .image-footer__meta a:focus-visible,
        .image-footer__meta button:focus-visible {
          color: #8f160e;
          text-decoration: underline;
          text-underline-offset: 0.2em;
        }

        .image-footer__meta a:focus-visible,
        .image-footer__meta button:focus-visible {
          border-radius: 3px;
          outline: 2px solid var(--footer-meta-red);
          outline-offset: 3px;
        }

        @media (max-width: 640px) {
          .image-footer__meta {
            justify-content: flex-start;
            gap: 0.35rem 1rem;
            padding: 0.8rem 1rem;
          }

          .image-footer__meta > span,
          .image-footer__meta > a,
          .image-footer__meta > button {
            flex: 1 1 calc(50% - 0.5rem);
          }
        }

        .image-footer__sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </footer>
    </>
  );
}
