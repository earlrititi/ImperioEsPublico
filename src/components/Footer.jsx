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

export default function Footer({ variant = "light" }) {
  const isDark = variant === "dark";

  return (
    <footer class={`image-footer image-footer--${variant}`} aria-label="Pie de pagina">
      <nav class="image-footer__legal" aria-label="Informacion legal">
        <span class="image-footer__legal-primary">
          {FOOTER_LEGAL_LINKS.map((link) => (
            <a href={withBase(link.href)} key={link.href}>{link.label}</a>
          ))}
        </span>
        <span class="image-footer__legal-utilities">
          <span class="image-footer__cookie-control">
            <span class="image-footer__cookie-label">Cookies opcionales</span>
            <label class="image-footer__cookie-switch">
              <span class="image-footer__sr-only">Permitir cookies opcionales</span>
              <input
                type="checkbox"
                role="switch"
                data-cookie-consent-switch
                aria-label="Permitir cookies opcionales"
              />
              <span class="image-footer__cookie-switch-track" aria-hidden="true" />
            </label>
            <button
              class="image-footer__cookie-settings"
              type="button"
              data-cookie-settings-trigger
            >
              Modificar
            </button>
          </span>
        </span>
      </nav>

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
      </div>

      <style>{`
        .image-footer {
          position: relative;
          width: 100%;
          overflow: hidden;
          background: #f7f5f1;
        }

        .image-footer--dark {
          background: var(--color-black-papers);
        }

        .image-footer__legal {
          position: absolute;
          inset: 0;
          z-index: 4;
          color: #fff;
          font-family: "Inter", "Segoe UI", sans-serif;
          font-size: 0.66rem;
          font-weight: 700;
          line-height: 1;
          pointer-events: none;
          white-space: nowrap;
        }

        .image-footer__legal-primary,
        .image-footer__legal-utilities {
          position: absolute;
          bottom: 0.7%;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          gap: 0.45rem;
        }

        .image-footer__legal-primary {
          left: 50%;
          transform: translateX(-50%);
        }

        .image-footer__legal-utilities {
          right: 1.5%;
          justify-content: flex-end;
        }

        .image-footer--dark .image-footer__legal {
          color: #ead7c1;
        }

        .image-footer__legal a,
        .image-footer__legal button {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          min-height: 28px;
          border: 0;
          border-radius: 3px;
          padding: 0.3rem 0.48rem;
          color: inherit;
          background: rgb(11 12 12 / 68%);
          cursor: pointer;
          font: inherit;
          pointer-events: auto;
          text-decoration: none;
        }

        .image-footer__cookie-control {
          display: inline-flex;
          align-items: center;
          gap: 0.38rem;
          width: fit-content;
          min-height: 28px;
          border-radius: 3px;
          padding: 0.18rem 0.24rem 0.18rem 0.48rem;
          background: rgb(11 12 12 / 68%);
          pointer-events: auto;
        }

        .image-footer__cookie-switch {
          position: relative;
          display: inline-flex;
          flex: 0 0 auto;
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
          display: block;
          width: 38px;
          height: 22px;
          box-sizing: border-box;
          border: 1px solid rgb(255 255 255 / 76%);
          border-radius: 999px;
          background: #555;
          transition: background 180ms ease, border-color 180ms ease;
        }

        .image-footer__cookie-switch-track::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: left 180ms ease;
        }

        .image-footer__cookie-switch-track::before {
          content: "";
          position: absolute;
          top: 6px;
          right: 5px;
          width: 8px;
          height: 8px;
          box-sizing: border-box;
          border: 2px solid #fff;
          border-radius: 50%;
        }

        .image-footer__cookie-switch input:checked + .image-footer__cookie-switch-track::before {
          left: 7px;
          right: auto;
          width: 2px;
          border: 0;
          border-radius: 0;
          background: #fff;
        }

        .image-footer__cookie-switch input:checked + .image-footer__cookie-switch-track {
          border-color: var(--color-red-accent);
          background: var(--color-red-accent);
        }

        .image-footer__cookie-switch input:checked + .image-footer__cookie-switch-track::after {
          left: 18px;
        }

        .image-footer__cookie-switch input:focus-visible + .image-footer__cookie-switch-track {
          outline: 2px solid #fff;
          outline-offset: 2px;
        }

        .image-footer__legal .image-footer__cookie-settings {
          min-height: 22px;
          padding: 0.2rem 0.32rem;
          background: transparent;
        }

        .image-footer__legal a:hover,
        .image-footer__legal a:focus-visible,
        .image-footer__legal button:hover,
        .image-footer__legal button:focus-visible {
          color: #fff;
          background: var(--color-red-accent);
          text-decoration: none;
        }

        @media (max-width: 980px) {
          .image-footer__legal {
            position: absolute;
            top: 22%;
            right: 0;
            bottom: 1.5%;
            left: auto;
            z-index: 4;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-template-rows: repeat(3, minmax(0, 1fr));
            align-items: center;
            justify-items: center;
            column-gap: 0.18rem;
            width: 33.333%;
            padding: 0 0.24rem;
            color: #fff;
            background: transparent;
            font-size: clamp(0.34rem, 1.5vw, 0.68rem);
            line-height: 1;
            pointer-events: none;
            white-space: normal;
          }

          .image-footer__legal-primary,
          .image-footer__legal-utilities {
            display: contents;
          }

          .image-footer--dark .image-footer__legal {
            color: #ead7c1;
            background: transparent;
          }

          .image-footer__legal a,
          .image-footer__legal button {
            justify-content: center;
            max-width: 100%;
            min-height: 0;
            padding: 0.06rem 0.2rem;
            color: #fff;
            line-height: 1;
            text-align: center;
          }

          .image-footer__cookie-control {
            grid-column: 1 / -1;
            align-self: center;
            justify-self: center;
            justify-content: center;
            gap: 0.3rem;
            max-width: 100%;
            min-height: 0;
            padding: 0.12rem 0.2rem;
            text-align: center;
          }

          .image-footer__cookie-label {
            flex: 0 1 auto;
          }

        }

        @media (prefers-reduced-motion: reduce) {
          .image-footer__cookie-switch-track,
          .image-footer__cookie-switch-track::after { transition: none; }
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
  );
}
